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
//  
// It took so long to get this working fuck META
// ⡴⠒⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠉⠳⡆⠀
// ⣇⠰⠉⢙⡄⠀⠀⣴⠖⢦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣆⠁⠙⡆
// ⠘⡇⢠⠞⠉⠙⣾⠃⢀⡼⠀⠀⠀⠀⠀⠀⠀⢀⣼⡀⠄⢷⣄⣀⠀⠀⠀⠀⠀⠀⠀⠰⠒⠲⡄⠀⣏⣆⣀⡍
// ⠀⢠⡏⠀⡤⠒⠃⠀⡜⠀⠀⠀⠀⠀⢀⣴⠾⠛⡁⠀⠀⢀⣈⡉⠙⠳⣤⡀⠀⠀⠀⠘⣆⠀⣇⡼⢋⠀⠀⢱
// ⠀⠘⣇⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⡴⢋⡣⠊⡩⠋⠀⠀⠀⠣⡉⠲⣄⠀⠙⢆⠀⠀⠀⣸⠀⢉⠀⢀⠿⠀⢸
// ⠀⠀⠸⡄⠀⠈⢳⣄⡇⠀⠀⢀⡞⠀⠈⠀⢀⣴⣾⣿⣿⣿⣿⣦⡀⠀⠀⠀⠈⢧⠀⠀⢳⣰⠁⠀⠀⠀⣠⠃
// ⠀⠀⠀⠘⢄⣀⣸⠃⠀⠀⠀⡸⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠈⣇⠀⠀⠙⢄⣀⠤⠚⠁⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⢹⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⠀⠀⢘⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⢰⣿⣿⣿⡿⠛⠁⠀⠉⠛⢿⣿⣿⣿⣧⠀⠀⣼⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡀⣸⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⡀⢀⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⡇⠹⠿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⡿⠁⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣤⣞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢢⣀⣠⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
// ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⢤⣀⣀⠀⢀⣀⣀⠤⠒⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
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

                            const { leadgen_id, page_id, form_id, ad_id, ad_name: webhookAdName, created_time } = change.value;
                            console.log(`POST Meta Webhook: received leadgen_id: ${leadgen_id}`);
                            console.log(`[CAMPAIGN] webhook payload — ad_id: "${ad_id}", ad_name (webhookAdName): "${webhookAdName}"`);

                            // 1. Fetch full lead details from Meta Graph API
                            const leadData = await fetchLeadFromMeta(leadgen_id, pageToken);
                            if (!leadData) {
                                console.error(`GET fetchLeadFromMeta: Failed to fetch lead data - leadgen_id: ${leadgen_id}`);
                                continue;
                            }
                            console.log(`GET fetchLeadFromMeta: successfully fetched lead data ${JSON.stringify(leadData, null, 2)}`);
                            console.log(`[CAMPAIGN] leadgen endpoint — ad_name: "${leadData.ad_name}", ad_id: "${leadData.ad_id}"`);

                            // Backfill ad_name if the leadgen endpoint didn't return it
                            if (!leadData.ad_name && (leadData.ad_id || ad_id)) {
                                console.log(`[CAMPAIGN] ad_name missing from leadgen endpoint — fetching from ad_id: "${leadData.ad_id || ad_id}"`);
                                leadData.ad_name = await fetchAdName(leadData.ad_id || ad_id, pageToken);
                                console.log(`[CAMPAIGN] fetchAdName result: "${leadData.ad_name}"`);
                            } else if (leadData.ad_name) {
                                console.log(`[CAMPAIGN] ad_name already present — skipping fetchAdName`);
                            } else {
                                console.log(`[CAMPAIGN] no ad_id available — campaign will be empty (test lead or organic)`);
                            }

                            // 2. Check for duplicate (Meta occasionally sends the same event twice)
                            const isDuplicate = await checkDuplicate(leadgen_id);
                            if (isDuplicate) {
                                console.warn(`Duplicate lead detected & ignored — leadgen_id: ${leadgen_id}`);
                                continue;
                            }

                            // 3. Parse Meta's field_data array into a flat object
                            const parsedFields = parseFieldData(leadData.field_data || []);
                            console.log('parsedFields:', JSON.stringify(parsedFields));

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
                                source: detectSource(leadData),
                                campaign: (() => { const c = detectCampaign(leadData, webhookAdName); console.log(`[CAMPAIGN] final resolved value: "${c}"`); return c; })(),
                                created: createdStr,
                                fullName: parsedFields['full_name'] || parsedFields['name'] || '',
                                phone: parsedFields['phone_number'] || parsedFields['phone'] || '',
                                email: parsedFields['email'] || '',

                                // From Meta form (optional) ─────────────────
                                strength: parsedFields['strength'] || '',
                                salesExec: parsedFields['sales_exec'] || parsedFields['sales_executive'] || '',
                                branch: normalizeBranch(parsedFields['which_branch_would_you_like_to_visit'] || parsedFields['what_showroom_you_would_like_to_visit?'] || parsedFields['branch'] || parsedFields['dealer_location'] || ''),
                                preferredChannel: normalizeChannel(parsedFields['how_to_contact_you'] || parsedFields['what_is_your_preferred_mode_of_contact?'] || parsedFields['preferred_channel'] || parsedFields['contact_method'] || ''),
                                preferredTime: normalizeTime(parsedFields['suggested_time_to_contact_you'] || parsedFields['preferred_time_to_contact_you?'] || parsedFields['preferred_time'] || parsedFields['best_time'] || ''),
                                model: normalizeModel(parsedFields['vehicle_model'] || parsedFields['model'] || parsedFields['which_model_are_you_interested_in?'] || ''),
                                modelDetails: parsedFields['model_details'] || parsedFields['variant'] || '',
                                remarks: parsedFields['remarks'] || parsedFields['comment'] || '',
                                followUp1: parsedFields['follow_up_1'] || parsedFields['follow_up'] || '',
                                reply1: parsedFields['reply_1'] || parsedFields['reply'] || '',
                                followUp2: parsedFields['follow_up_2'] || '',
                                reply2: parsedFields['reply_2'] || '',
                                followUp3: parsedFields['follow_up_3'] || '',
                                reply3: parsedFields['reply_3'] || '',
                                status: parsedFields['status'] || 'Waiting to be contacted',
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
    // ── MOCK FOR TESTING — remove before going live ──
    if (leadgenId.startsWith('TEST_')) {
        return {
            id: leadgenId,
            created_time: "2026-04-27T10:00:00+0000",
            ad_id: "120243105821460256",
            ad_name: "Polaris UAE - RZR - Summer 2026",
            form_id: "1451274946319361",
            platform: "ig",
            field_data: [
                { name: "full_name",                              values: ["Test User"]          },
                { name: "email",                                  values: ["test@example.com"]   },
                { name: "phone",                                  values: ["+971501234567"]      },
                { name: "what_showroom_you_would_like_to_visit?", values: ["dubai"]             },
                { name: "what_is_your_preferred_mode_of_contact?",values: ["whatsapp"]          },
                { name: "preferred_time_to_contact_you?",         values: ["morning"]           }
            ]
        };
    }
    // ── END MOCK ──

    // real fetch below unchanged
    const fields = 'id,created_time,ad_id,ad_name,form_id,field_data,platform';
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?fields=${fields}&access_token=${pageAccessToken}`;
    try {
        const res  = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (data.error) {
            console.error('Meta Graph API error:', data.error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.error('Network error fetching lead:', err);
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  fetchAdName
//
//  Fetches the ad name from Meta Graph API using the ad_id.
//  Used as a fallback when the leadgen endpoint doesn't return ad_name.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAdName(adId, pageAccessToken) {
    if (!adId) return '';
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${adId}?fields=name&access_token=${pageAccessToken}`;
    try {
        const res  = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (data.error) {
            console.error('fetchAdName Graph API error:', data.error.message);
            return '';
        }
        console.log(`fetchAdName: ad_id=${adId} -> name="${data.name}"`);
        return data.name || '';
    } catch (err) {
        console.error('fetchAdName network error:', err);
        return '';
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

function detectSource(leadData) {
    const platform = (leadData.platform || '').toLowerCase();
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'facebook') return 'Facebook';
    if (platform === 'ig') return 'Instagram';
    if (platform === 'fb') return 'Facebook';
    return 'Meta Lead Ad';
}

function detectCampaign(leadData, webhookAdName) {
    // webhookAdName comes directly from the webhook payload (most reliable)
    // leadData.ad_name is from the Graph API fetch (sometimes missing)
    return webhookAdName || leadData.ad_name || '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Normalization helpers — map Meta's raw form values to the CMS standard values
//  so the dashboard dropdowns always display correctly.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeChannel(raw) {
    const map = {
        'whatsapp':   'Whatsapp',
        'phone_call': 'Call',
        'call':       'Call',
        'phone':      'Call',
        'email':      'Email',
        'in_person':  'In Person',
        'in person':  'In Person',
    };
    return map[(raw || '').toLowerCase().trim()] || raw || '';
}

function normalizeTime(raw) {
    const cleaned = (raw || '').toLowerCase().trim().replace(/_+$/, ''); // strip trailing underscores
    const map = {
        'morning':   'Morning',
        'afternoon': 'Afternoon',
        'evening':   'Evening',
        'anytime':   'Anytime',
    };
    return map[cleaned] || raw || '';
}

function normalizeBranch(raw) {
    const map = {
        'abu_dhabi':  'Abu Dhabi',
        'abu dhabi':  'Abu Dhabi',
        'abudhabi':   'Abu Dhabi',
        'al_ain':     'Alain',
        'al ain':     'Alain',
        'alain':      'Alain',
        'dubai':      'Dubai',
        'sharjah':    'Sharjah',
        'other':      'Other',
    };
    return map[(raw || '').toLowerCase().trim()] || raw || '';
}

function normalizeModel(raw) {
    const map = {
        'rzr':              'RZR',
        'ranger':           'RANGER/GENERAL',
        'general':          'RANGER/GENERAL',
        'ranger/general':   'RANGER/GENERAL',
        'xpedition':        'XPEDITION',
        'atv':              'ATV',
        'youth':            'YOUTH',
        'goupil':           'GOUPIL',
        'sherco':           'SHERCO',
        'slingshot':        'SLINGSHOT',
        'imc-heavy weight': 'IMC-HEAVY WEIGHT',
        'imc heavy weight': 'IMC-HEAVY WEIGHT',
        'imc-mid size':     'IMC-MID SIZE',
        'imc mid size':     'IMC-MID SIZE',
    };
    return map[(raw || '').toLowerCase().trim()] || raw || '';
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