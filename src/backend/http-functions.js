// // ─────────────────────────────────────────────────────────────────────────────
// //  CRAMS - AMS - http-functions.js
// //      - Built by Marwan Bassam (self-proclaimed genius) for Polaris UAE 2026 
// //
// //  Endpoints:
// //      - GET  /_functions/metaWebhook -> Meta webhook verification handshake
// //      - POST /_functions/metaWebhook -> Receives Meta lead-gen events, fetches full lead data, inserts into Wix CMS
// //
// //  Environment Variables:
// //      - META_VERIFY_TOKEN      -> The verify token you set in Meta Webhook config
// //      - META_PAGE_ACCESS_TOKEN -> The never-expiring Page Access Token for Polaris
// //
// //  Collections:
// //      - PolarisLeads
// // ─────────────────────────────────────────────────────────────────────────────

// import { getSecret } from 'wix-secrets-backend';
// import { ok, serverError, badRequest } from 'wix-http-functions';
// import { fetch } from 'wix-fetch';
// import wixData from 'wix-data';

// const META_GRAPH_VERSION = 'v19.0';


// // ─────────────────────────────────────────────────────────────────────────────
// //  GET /_functions/metaWebhook
// //
// //  Request: Meta requests for setup. Query params include hub.mode, hub.verify_token, and hub.challenge.
// //  Response: hub.challenge as plain text for verification.
// // ─────────────────────────────────────────────────────────────────────────────
// export async function get_metaWebhook(request) {
//     const options = {
//         headers: { 'Content-Type': 'text/plain' },
//         body: ''
//     };

//     const mode = request.query['hub.mode'];
//     const receivedToken = request.query['hub.verify_token'];
//     const challenge = request.query['hub.challenge'];

//     try {
//         const verifyToken = await getSecret('META_VERIFY_TOKEN');

//         if (mode === 'subscribe' && receivedToken === verifyToken) {
//             options.body = challenge;
//             console.log('Meta webhook verified successfully.');
//             return ok({
//                 headers: { 'Content-Type': 'text/plain' },
//                 body: challenge
//             });
//         } else {
//             console.error('Meta webhook verification failed. Token mismatch.');
//             options.body = 'Verification failed';
//             return serverError(options);
//         }

//     } catch (err) {
//         console.error('Error during webhook verification:', err);
//         options.body = 'Internal error during verification';
//         return serverError(options);
//     }
// }


// // ─────────────────────────────────────────────────────────────────────────────
// //  POST /_functions/metaWebhook
// //  
// //  Request: requested upon new lead. The body contains the leadgen_id.
// //  Response: 200 OK then asynchronously handle the lead data.
// //
// //  Request Body Example:
// //  {
// //    "object": "page",
// //    "entry": [{
// //      "id": "<PAGE_ID>",
// //      "time": 1234567890,
// //      "changes": [{
// //        "field": "leadgen", //must check this exact string
// //        "value": {
// //          "leadgen_id": "...",
// //          "page_id": "...",
// //          "form_id": "...",
// //          "ad_id": "...",
// //          "adgroup_id": "...",
// //          "created_time": 1234567890
// //        }
// //      }]
// //    }]
// //  }
// // ─────────────────────────────────────────────────────────────────────────────
// export async function post_metaWebhook(request) {
//     const options = {
//         headers: { 'Content-Type': 'application/json' },
//         body: ''
//     };

//     try {
//         const body = await request.body.json();
//         console.log('Meta webhook received:', JSON.stringify(body, null, 2));

//         if (body.object === 'page' && body.entry) {
//             // Use setTimeout to return 200 immediately while async code continues
//             setTimeout(async () => {
//                 try {
//                     const pageToken = await getSecret('META_PAGE_ACCESS_TOKEN');

//                     for (const entry of body.entry) {
//                         if (!entry.changes) continue;

//                         for (const change of entry.changes) {
//                             if (change.field !== 'leadgen') {
//                                 continue;
//                             }

//                             const { leadgen_id, page_id, form_id, ad_id, created_time } = change.value;
//                             console.log(`New lead received — leadgen_id: ${leadgen_id}`);

//                             // 1. Fetch full lead details from Meta Graph API
//                             const leadData = await fetchLeadFromMeta(leadgen_id, pageToken);
//                             if (!leadData) {
//                                 console.error(`Failed to fetch lead data for leadgen_id: ${leadgen_id}`);
//                                 continue;
//                             }

//                             // 2. Check for duplicate (Meta occasionally sends the same event twice)
//                             const isDuplicate = await checkDuplicate(leadgen_id);
//                             if (isDuplicate) {
//                                 console.warn(`Duplicate lead ignored — leadgen_id: ${leadgen_id}`);
//                                 continue;
//                             }

//                             // 3. Parse Meta's field_data array into a flat object
//                             const parsedFields = parseFieldData(leadData.field_data || []);

//                             // 4. Build the CMS record
//                             const now = new Date();
//                             const metaCreatedDate = created_time
//                                 ? new Date(created_time * 1000)
//                                 : now;

//                             const leadRecord = {
//                                 //  Meta stuff  ──────────────────────────
//                                 leadgenId: leadgen_id,
//                                 pageId: page_id || '',
//                                 formId: form_id || '',
//                                 adId: ad_id || '',
//                                 //  Everything else ────────────────────────────────
//                                 created: metaCreatedDate.toISOString().slice(0, 10),
//                                 createdTime: metaCreatedDate.toISOString().slice(11, 16),
//                                 source: 'Meta Lead Ad', // Meta doesn't distinguish FB vs IG in webhook. ad_name sometimes contains platform info.
//                                 fullName: parsedFields['full_name'] || parsedFields['name'] || '',
//                                 email: parsedFields['email'] || '',
//                                 phone: parsedFields['phone_number'] || parsedFields['phone'] || '',
//                                 vehicleModel: parsedFields['vehicle_model'] || parsedFields['vehicle'] || '',
//                                 adName: leadData.ad_name || '',
//                                 //  CRM Stuff ──────────────────────────
//                                 status: 'New',       // New | Contacted | Qualified | Lost
//                                 assignedTo: '',
//                                 notes: '',
//                             };

//                             // 5. Insert into Wix CMS
//                             await insertLead(leadRecord);
//                             console.log(`Lead inserted successfully — leadgen_id: ${leadgen_id}`);
//                         }
//                     }
//                 } catch (asyncErr) {
//                     console.error('Error processing lead asynchronously:', asyncErr);
//                 }
//             }, 0);
//         }

//         // Respond 200 immediately so Meta doesn't retry
//         options.body = JSON.stringify({ status: 'OK' });
//         return ok(options);

//     } catch (err) {
//         console.error('Error in post_metaWebhook:', err);
//         options.body = JSON.stringify({ error: 'Webhook processing failed' });
//         return serverError(options);
//     }
// }


// // ─────────────────────────────────────────────────────────────────────────────
// //  fetchLeadFromMeta
// //
// //  Request: This server calls Meta to retrieve full lead details using leadgen_id.
// //  Returns an object like:
// //  {
// //    id: "...",
// //    created_time: "2025-04-23T...",
// //    ad_id: "...",
// //    ad_name: "Polaris UAE Spring 2025",
// //    form_id: "...",
// //    field_data: [
// //      { name: "full_name",    values: ["John Doe"] },
// //      { name: "email",        values: ["john@example.com"] },
// //      { name: "phone_number", values: ["+971501234567"] },
// //      { name: "vehicle_model",values: ["Polaris RZR"] }
// //    ]
// //  }
// // ─────────────────────────────────────────────────────────────────────────────
// async function fetchLeadFromMeta(leadgenId, pageAccessToken) {
//     const fields = 'id,created_time,ad_id,ad_name,form_id,field_data';
//     const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?fields=${fields}&access_token=${pageAccessToken}`;

//     try {
//         const res = await fetch(url, { method: 'GET' });
//         const data = await res.json();

//         if (data.error) {
//             console.error('Meta Graph API error:', data.error.message);
//             return null;
//         }

//         return data;
//     } catch (err) {
//         console.error('Network error fetching lead from Meta:', err);
//         return null;
//     }
// }


// // ─────────────────────────────────────────────────────────────────────────────
// //  parseFieldData
// //
// //  Input: fieldDataArray -> [{ name: "full_name", values: ["John Doe"] }, ...]
// //  Output: { full_name: "John Doe", ... }
// // ─────────────────────────────────────────────────────────────────────────────
// function parseFieldData(fieldDataArray) {
//     const result = {};
//     for (const field of fieldDataArray) {
//         result[field.name] = field.values && field.values.length > 0 ? field.values[0] : '';
//     }
//     return result;
// }


// // ─────────────────────────────────────────────────────────────────────────────
// //  checkDuplicate
// //
// //  Input: leadgenId -> used to check dupes in cms
// //  Outputs: Boolean
// // ─────────────────────────────────────────────────────────────────────────────
// async function checkDuplicate(leadgenId) {
//     try {
//         const result = await wixData.query('PolarisLeads').eq('leadgenId', leadgenId).find({ suppressAuth: true });
//         return result.totalCount > 0;
//     } catch (err) {
//         console.error('Duplicate check failed:', err);
//         return false;
//     }
// }


// // ─────────────────────────────────────────────────────────────────────────────
// //  insertLead
// //  Inserts a parsed lead record into the "PolarisLeads" Wix CMS collection.
// //
// //  Required CMS collection fields (create these in Wix Content Manager):
// //  ┌─────────────────┬─────────┬────────────────────────────────────────────┐
// //  │ Field Key       │ Type    │ Notes                                      │
// //  ├─────────────────┼─────────┼────────────────────────────────────────────┤
// //  │ leadgenId       │ Text    │ Meta leadgen_id — used for dedup           │
// //  │ pageId          │ Text    │ Meta page_id                               │
// //  │ formId          │ Text    │ Meta form_id                               │
// //  │ adId            │ Text    │ Meta ad_id                                 │
// //  │ adName          │ Text    │ Meta ad_name (campaign name)               │
// //  │ created         │ Text    │ YYYY-MM-DD — used for date filtering       │
// //  │ createdTime     │ Text    │ HH:MM                                      │
// //  │ source          │ Text    │ "Meta Lead Ad"                             │
// //  │ fullName        │ Text    │                                            │
// //  │ email           │ Text    │                                            │
// //  │ phone           │ Text    │                                            │
// //  │ vehicleModel    │ Text    │ Polaris model interested in                │
// //  │ status          │ Text    │ New | Contacted | Qualified | Lost         │
// //  │ assignedTo      │ Text    │ Sales rep name                             │
// //  │ notes           │ Text    │ Long text — free notes                     │
// //  └─────────────────┴─────────┴────────────────────────────────────────────┘
// // ─────────────────────────────────────────────────────────────────────────────
// async function insertLead(leadRecord) {
//     try {
//         const inserted = await wixData.insert('PolarisLeads', leadRecord, { suppressAuth: true });
//         console.log('Lead inserted into PolarisLeads:', inserted._id);
//         return inserted;
//     } catch (err) {
//         console.error('Failed to insert lead into PolarisLeads:', err);
//         throw err;
//     }
// }


import { ok } from 'wix-http-functions';

export function get_metaWebhook(request) {
    const challenge = request.query['hub.challenge'] || 'alive';
    return ok({
        headers: { 'Content-Type': 'text/plain' },
        body: challenge
    });
}