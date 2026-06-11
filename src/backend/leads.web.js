//@ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - leads.web.js
//
//  Web methods for PolarisLeads CMS operations.
//
//  Session verification queries the Accounts CMS (sessionHash field).
//  To add a new user: add a row to Accounts with a unique sessionHash — no code changes needed.
//
//  SETUP REQUIRED:
//    1. Set TRIGGERED_EMAIL_ID to the ID of your Wix Triggered Email template.
//       (Marketing Tools → Triggered Emails → your template → copy ID)
//    2. Add a `contactId` field to the Accounts CMS collection and fill it
//       with each rep's Wix Contact ID (found in your site's Contacts panel).
//    3. Template must expose variables:
//       leadName, leadPhone, leadEmail, leadModel, leadBranch, leadSource, leadCampaign
// ─────────────────────────────────────────────────────────────────────────────

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { triggeredEmails } from 'wix-crm-backend';

const TRIGGERED_EMAIL_ID = 'VM8dExZ';

// Session hashes live in the Accounts CMS (sessionHash field) — no hardcoded map needed.
async function verifySession(username, sessionHash) {
    const { items } = await wixData
        .query('Accounts')
        .eq('username', username)
        .find({ suppressAuth: true });
    return items.length > 0 && !!items[0].sessionHash && items[0].sessionHash === sessionHash;
}

// ─────────────────────────────────────────────────────────────────────────────
//  getSalesReps
//  Returns displayName of every Accounts row with role === 'sales'.
//  Used by the Dashboard to populate the Sales Exec assignment dropdown.
// ─────────────────────────────────────────────────────────────────────────────
export const getSalesReps = webMethod(Permissions.Anyone, async function (username, sessionHash) {
    if (!await verifySession(username, sessionHash)) {
        return { success: false, reps: [] };
    }

    try {
        const result = await wixData.query('Accounts')
            .find({ suppressAuth: true });

        // role may be a string "sales" or an array ["sales"] — handle both
        const reps = result.items
            .filter(i => {
                const r = i.role;
                return Array.isArray(r) ? r.includes('sales') : r === 'sales';
            })
            .map(i => i.displayName)
            .filter(Boolean);
        return { success: true, reps };
    } catch (err) {
        console.error('getSalesReps failed:', err);
        return { success: false, reps: [] };
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  updateLead
//  Validates session, saves the item, and fires an assignment notification
//  if the salesExec field changed to a new (non-empty) value.
// ─────────────────────────────────────────────────────────────────────────────
export const updateLead = webMethod(Permissions.Anyone, async function (username, sessionHash, item) {
    if (!await verifySession(username, sessionHash)) {
        return { success: false, error: 'Unauthorized' };
    }

    if (!item || !item._id) {
        return { success: false, error: 'Missing item or _id' };
    }

    try {
        // Fetch existing item to detect salesExec change before overwriting
        const existing = await wixData.get('PolarisLeads', item._id, { suppressAuth: true });
        const salesExecChanged = existing &&
            existing.salesExec !== item.salesExec &&
            !!item.salesExec;

        const saved = await wixData.update('PolarisLeads', item, { suppressAuth: true });

        // Fire-and-forget — don't let a notification failure break the save response
        if (salesExecChanged) {
            notifyAssignedRep(item.salesExec, saved).catch(err =>
                console.error('notifyAssignedRep failed:', err)
            );
        }

        return { success: true, item: saved };
    } catch (err) {
        console.error('updateLead failed:', err);
        return { success: false, error: err.message || String(err) };
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  notifyAssignedRep
//  Looks up the rep's Wix contactId from the Accounts collection and sends
//  a triggered email via the Wix marketing triggered-emails service.
// ─────────────────────────────────────────────────────────────────────────────
async function notifyAssignedRep(salesExecName, lead) {
    const accountResult = await wixData.query('Accounts')
        .eq('displayName', salesExecName)
        .find({ suppressAuth: true });

    const rep = accountResult.items[0];

    if (!rep || !rep.contactId) {
        console.warn(`notifyAssignedRep: no contactId found for "${salesExecName}" — skipping email`);
        return;
    }

    await triggeredEmails.emailContact(TRIGGERED_EMAIL_ID, rep.contactId, {
        variables: {
            leadName:     lead.fullName  || '—',
            leadPhone:    lead.phone     || '—',
            leadEmail:    lead.email     || '—',
            leadModel:    lead.model     || '—',
            leadBranch:   lead.branch    || '—',
            leadSource:   lead.source    || '—',
            leadCampaign: lead.campaign  || '—',
            leadDate:     lead.created   || '—',
        }
    });

    console.log(`Assignment notification sent to "${salesExecName}" (contact: ${rep.contactId}) for lead ${lead._id}`);
}
