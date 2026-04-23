//@ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - http-functions.js
//      - Built by Marwan Bassam (self-proclaimed genius) for Polaris UAE 2026 
//
//  Endpoints:
//      - GET  /_functions/metaWebhook -> Meta webhook verification handshake
//      - POST /_functions/metaWebhook -> Receives Meta lead-gen events, fetches full lead data, inserts into Wix CMS
//
//  Environment Variables:
//      - META_VERIFY_TOKEN      -> The verify token you set in Meta Webhook config
//      - META_PAGE_ACCESS_TOKEN -> The never-expiring Page Access Token for Polaris
//
//  Collections:
//                            ┌──────────────┐
//                            | PolarisLeads |
//  ┌───────────────────┬─────┴───┬──────────┴─────────────────────────────-────────────────┐
//  │ Field Key         │ Type    │ Notes                                                   │
//  ├───────────────────┼─────────┼─────────────────────────────────────────────────────────┤
//  │ leadgenId         │ Text    │ PRIMARY — Meta leadgen_id, used for dedup               │
//  │ strength          │ Text    │ CRM managed — lead quality rating                       │
//  │ source            │ Text    │ Auto-filled: "Meta Lead Ad"                             │
//  │ campaign          │ Text    │ Auto-filled from Meta ad_name                           │
//  │ salesExec         │ Text    │ CRM managed — assigned sales executive                  │
//  │ created           │ Text    │ Auto-filled: YYYY-MM-DD HH:MM from Meta created_time    │
//  │ fullName          │ Text    │ REQUIRED — from Meta form full_name / name              │
//  │ phone             │ Text    │ REQUIRED — from Meta form phone_number / phone          │
//  │ email             │ Text    │ REQUIRED — from Meta form email                         │
//  │ preferredChannel  │ Text    │ From Meta form preferred_channel if available           │
//  │ preferredTime     │ Text    │ From Meta form preferred_time if available              │
//  │ branch            │ Text    │ From Meta form branch if available                      │
//  │ model             │ Text    │ From Meta form vehicle_model / model                    │
//  │ modelDetails      │ Text    │ From Meta form model_details if available               │
//  │ remarks           │ Text    │ CRM managed                                             │
//  │ followUp1         │ Text    │ CRM managed — date/note of first follow up              │
//  │ reply1            │ Text    │ CRM managed — lead reply to follow up 1                 │
//  │ followUp2         │ Text    │ CRM managed                                             │
//  │ reply2            │ Text    │ CRM managed                                             │
//  │ followUp3         │ Text    │ CRM managed                                             │
//  │ reply3            │ Text    │ CRM managed                                             │
//  │ status            │ Text    │ New | Contacted | Qualified | Lost                      │
//  │ quotationIssued   │ Text    │ CRM managed — Yes / No / date issued                    │
//  │ lostSaleReason    │ Text    │ CRM managed                                             │
//  │ lostSaleRemarks   │ Text    │ CRM managed                                             │
//  │ notes             │ Text    │ CRM managed — long text, free notes                     │
//  │ month             │ Text    │ CRM managed — e.g. "April 2025"                         │
//  │ day               │ Text    │ CRM managed                                             │
//  │ qty               │ Number  │ CRM managed — units sold                                │
//  │ amtWithVat        │ Number  │ CRM managed — sale amount including VAT                 │
//  │ amtWithoutVat     │ Number  │ CRM managed — sale amount excluding VAT                 │
//  ├───────────────────┼─────────┼─────────────────────────────────────────────────────────┤
//  │ pageId            │ Text    │ Internal — Meta page_id                                 │
//  │ formId            │ Text    │ Internal — Meta form_id                                 │
//  │ adId              │ Text    │ Internal — Meta ad_id                                   │
//  └───────────────────┴─────────┴─────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import { getSecret } from 'wix-secrets-backend';
import { ok, serverError, badRequest } from 'wix-http-functions';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

const META_GRAPH_VERSION = 'v19.0';


// ─────────────────────────────────────────────────────────────────────────────
//  GET /_functions/metaWebhook
//
//  Request: Meta requests for setup. Query params include hub.mode, hub.verify_token, and hub.challenge.
//  Response: hub.challenge as plain text for verification.
// ─────────────────────────────────────────────────────────────────────────────
export async function get_metaWebhook(request) {
    const options = {
        headers: { 'Content-Type': 'text/plain' },
        body: ''
    };

    const mode = request.query['hub.mode'];
    const receivedToken = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    try {
        const verifyToken = await getSecret('META_VERIFY_TOKEN');

        if (mode === 'subscribe' && receivedToken === verifyToken) {
            options.body = challenge;
            console.log('GET Meta Webhook: verified successfully.');
            return ok({
                headers: { 'Content-Type': 'text/plain' },
                body: challenge
            });
        } else {
            console.error('GET Meta Webhook: verification failed. Token mismatch.');
            options.body = 'Verification failed';
            return serverError(options);
        }

    } catch (err) {
        console.error('GET Meta Webhook: Error during verification:', err);
        options.body = 'Internal error during verification';
        return serverError(options);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  POST /_functions/metaWebhook
//  
//  Request: requested upon new lead. The body contains the leadgen_id.
//  Response: 200 OK then asynchronously handle the lead data.
//
//  Request Body Example:
//  {
//    "object": "page",
//    "entry": [{
//      "id": "<PAGE_ID>",
//      "time": 1234567890,
//      "changes": [{
//        "field": "leadgen", //must check this exact string
//        "value": {
//          "leadgen_id": "...",
//          "page_id": "...",
//          "form_id": "...",
//          "ad_id": "...",
//          "adgroup_id": "...",
//          "created_time": 1234567890
//        }
//      }]
//    }]
//  }
// ─────────────────────────────────────────────────────────────────────────────
export async function post_metaWebhook(request) {
    const options = {
        headers: { 'Content-Type': 'application/json' },
        body: ''
    };

    try {
        const body = await request.body.json();
        if (body.object === 'page' && body.entry) {
            // Use setTimeout to return 200 immediately while async code continues
            setTimeout(async () => {
                try {
                    const pageToken = await getSecret('META_PAGE_ACCESS_TOKEN');

                    for (const entry of body.entry) {
                        if (!entry.changes) continue;

                        for (const change of entry.changes) {
                            if (change.field !== 'leadgen') {
                                continue;
                            }

                            const { leadgen_id, page_id, form_id, ad_id, created_time } = change.value;
                            console.log(`POST Meta Webhook: received leadgen_id: ${leadgen_id}`);

                            // 1. Fetch full lead details from Meta Graph API
                            const leadData = await fetchLeadFromMeta(leadgen_id, pageToken);
                            if (!leadData) {
                                console.error(`GET fetchLeadFromMeta: Failed to fetch lead data - leadgen_id: ${leadgen_id}`);
                                continue;
                            }
                            console.log(`GET fetchLeadFromMeta: successfully fetched lead data ${JSON.stringify(leadData, null, 2)}`);

                            // 2. Check for duplicate (Meta occasionally sends the same event twice)
                            const isDuplicate = await checkDuplicate(leadgen_id);
                            if (isDuplicate) {
                                console.warn(`Duplicate lead detected & ignored — leadgen_id: ${leadgen_id}`);
                                continue;
                            }

                            // 3. Parse Meta's field_data array into a flat object
                            const parsedFields = parseFieldData(leadData.field_data || []);

                            // 4. Build the CMS record
                            const metaDate = created_time ? new Date(created_time * 1000) : new Date();
                            const createdStr = metaDate.toISOString().slice(0, 10) + ' ' + metaDate.toISOString().slice(11, 16);

                            const leadRecord = {
                                // Primary / Meta identifiers ────────────────
                                leadgenId: leadgen_id,
                                pageId: page_id || '',
                                formId: form_id || '',
                                adId: ad_id || '',

                                // From Meta form (required) ─────────────────
                                source:   await detectSource(ad_id, pageToken),
                                campaign: await detectCampaign(form_id, leadData, pageToken),
                                created: createdStr,
                                fullName: parsedFields['full_name'] || parsedFields['name'] || '',
                                phone: parsedFields['phone_number'] || parsedFields['phone'] || '',
                                email: parsedFields['email'] || '',

                                // From Meta form (optional) ─────────────────
                                strength: parsedFields['strength'] || '',
                                salesExec: parsedFields['sales_exec'] || parsedFields['sales_executive'] || '',
                                preferredChannel: parsedFields['preferred_channel'] || parsedFields['contact_method'] || '',
                                preferredTime: parsedFields['preferred_time'] || parsedFields['best_time'] || '',
                                branch: parsedFields['branch'] || parsedFields['dealer_location'] || '',
                                model: parsedFields['vehicle_model'] || parsedFields['model'] || '',
                                modelDetails: parsedFields['model_details'] || parsedFields['variant'] || '',
                                remarks: parsedFields['remarks'] || parsedFields['comment'] || '',
                                followUp1: parsedFields['follow_up_1'] || parsedFields['follow_up'] || '',
                                reply1: parsedFields['reply_1'] || parsedFields['reply'] || '',
                                followUp2: parsedFields['follow_up_2'] || '',
                                reply2: parsedFields['reply_2'] || '',
                                followUp3: parsedFields['follow_up_3'] || '',
                                reply3: parsedFields['reply_3'] || '',
                                status: parsedFields['status'] || 'New',
                                quotationIssued: parsedFields['quotation_issued'] || '',
                                lostSaleReason: parsedFields['lost_sale_reason'] || '',
                                lostSaleRemarks: parsedFields['lost_sale_remarks'] || '',
                                notes: parsedFields['notes'] || parsedFields['additional_info'] || '',
                                month: parsedFields['month'] || '',
                                day: parsedFields['day'] || '',
                                qty: parsedFields['qty'] || 0,
                                amtWithVat: parsedFields['amt_with_vat'] || 0,
                                amtWithoutVat: parsedFields['amt_without_vat'] || 0,
                            };

                            // 5. Insert into Wix CMS
                            await insertLead(leadRecord);
                        }
                    }
                } catch (asyncErr) {
                    console.error('Error processing lead asynchronously:', asyncErr);
                }
            }, 0);
        }

        // Respond 200 immediately so Meta doesn't retry
        options.body = JSON.stringify({ status: 'OK' });
        return ok(options);

    } catch (err) {
        console.error('POST metaWebhook:', err);
        options.body = JSON.stringify({ error: 'Webhook processing failed' });
        return serverError(options);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  fetchLeadFromMeta
//
//  Request: This server calls Meta to retrieve full lead details using leadgen_id.
//  Returns an object like:
//  {
//    id: "...",
//    created_time: "2025-04-23T...",
//    ad_id: "...",
//    ad_name: "Polaris UAE Spring 2025",
//    form_id: "...",
//    field_data: [
//      { name: "full_name",    values: ["John Doe"] },
//      { name: "email",        values: ["john@example.com"] },
//      { name: "phone_number", values: ["+971501234567"] },
//      { name: "vehicle_model",values: ["Polaris RZR"] }
//    ]
//  }
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLeadFromMeta(leadgenId, pageAccessToken) {
    const fields = 'id,created_time,ad_id,ad_name,form_id,field_data';
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?fields=${fields}&access_token=${pageAccessToken}`;

    try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();

        if (data.error) {
            console.error('POST fetchLeadFromMeta: Meta Graph API error:', data.error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('POST fetchLeadFromMeta: Network error fetching lead from Meta:', err);
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  parseFieldData
//
//  Input: fieldDataArray -> [{ name: "full_name", values: ["John Doe"] }, ...]
//  Output: { full_name: "John Doe", ... }
// ─────────────────────────────────────────────────────────────────────────────
function parseFieldData(fieldDataArray) {
    console.log('!!!!!!!!!Parsing field_data array from Meta:', fieldDataArray);
    const result = {};
    for (const field of fieldDataArray) {
        result[field.name] = field.values && field.values.length > 0 ? field.values[0] : '';
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  detectSource
//  Fetches the ad's publisher_platform to determine Instagram vs Facebook.
//  Returns "Instagram" | "Facebook" | "Meta Lead Ad" (fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function detectSource(adId, pageToken) {
    if (!adId) return 'Meta Lead Ad';
 
    try {
        const url  = `https://graph.facebook.com/${META_GRAPH_VERSION}/${adId}?fields=adset_id&access_token=${pageToken}`;
        const res  = await fetch(url, { method: 'GET' });
        const data = await res.json();
 
        if (data.error || !data.adset_id) return 'Meta Lead Ad';
 
        // Fetch publisher platforms from the adset
        const adsetUrl  = `https://graph.facebook.com/${META_GRAPH_VERSION}/${data.adset_id}?fields=targeting&access_token=${pageToken}`;
        const adsetRes  = await fetch(adsetUrl, { method: 'GET' });
        const adsetData = await adsetRes.json();
 
        if (adsetData.error) return 'Meta Lead Ad';
 
        const platforms = adsetData?.targeting?.publisher_platforms || [];
 
        if (platforms.includes('instagram') && !platforms.includes('facebook')) return 'Instagram';
        if (platforms.includes('facebook')  && !platforms.includes('instagram')) return 'Facebook';
        if (platforms.includes('instagram') && platforms.includes('facebook'))   return 'Instagram & Facebook';
 
        return 'Meta Lead Ad';
    } catch (err) {
        console.error('detectSource error:', err);
        return 'Meta Lead Ad';
    }
}
 
 
// ─────────────────────────────────────────────────────────────────────────────
//  detectCampaign
//  Uses the Lead Form name as the campaign value — it's the most human-readable
//  identifier AMS will have set when building the form in Ads Manager.
//  Falls back to ad_name if form name unavailable.
// ─────────────────────────────────────────────────────────────────────────────
async function detectCampaign(formId, leadData, pageToken) {
    if (!formId) return leadData.ad_name || '';
 
    try {
        const url  = `https://graph.facebook.com/${META_GRAPH_VERSION}/${formId}?fields=name&access_token=${pageToken}`;
        const res  = await fetch(url, { method: 'GET' });
        const data = await res.json();
 
        if (data.error || !data.name) return leadData.ad_name || '';
 
        return data.name;
    } catch (err) {
        console.error('detectCampaign error:', err);
        return leadData.ad_name || '';
    }
}
 

// ─────────────────────────────────────────────────────────────────────────────
//  checkDuplicate
//
//  Input: leadgenId -> used to check dupes in cms
//  Outputs: Boolean
// ─────────────────────────────────────────────────────────────────────────────
async function checkDuplicate(leadgenId) {
    try {
        const result = await wixData.query('PolarisLeads').eq('leadgenId', leadgenId).find({ suppressAuth: true });
        return result.totalCount > 0;
    } catch (err) {
        console.error('Duplicate check failed:', err);
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  insertLead
//
//  Input: leadRecord -> the object to insert into PolarisLeads collection
//  Output: the inserted record (using _id) or throws an error
// ─────────────────────────────────────────────────────────────────────────────
async function insertLead(leadRecord) {
    try {
        const inserted = await wixData.insert('PolarisLeads', leadRecord, { suppressAuth: true });
        console.log('Lead inserted into PolarisLeads CMS:', inserted._id);
        return inserted;
    } catch (err) {
        console.error('Failed to insert lead into PolarisLeads CMS:', err);
        throw err;
    }
}