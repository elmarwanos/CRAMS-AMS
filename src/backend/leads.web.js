// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - leads.web.js
//
//  Backend web methods for PolarisLeads CMS operations.
//  suppressAuth: true works here (backend) — not on the frontend.
// ─────────────────────────────────────────────────────────────────────────────

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Session hashes are duplicated here to avoid cross-file imports in Wix Velo.
// Keep in sync with login-verification.web.js.
const sessionHashMap = {
    "PolarisUAE": "AMS_k9Xv2mPqL7nRtZwYcJhD4sBf",
};

// ─────────────────────────────────────────────────────────────────────────────
//  updateLead
//  Called from the Dashboard edit popup to save changes to PolarisLeads.
//  Validates the session before allowing the write.
// ─────────────────────────────────────────────────────────────────────────────
export const updateLead = webMethod(Permissions.Anyone, async function (username, sessionHash, item) {
    if (!sessionHashMap[username] || sessionHashMap[username] !== sessionHash) {
        return { success: false, error: 'Unauthorized' };
    }

    if (!item || !item._id) {
        return { success: false, error: 'Missing item or _id' };
    }

    try {
        const saved = await wixData.update('PolarisLeads', item, { suppressAuth: true });
        return { success: true, item: saved };
    } catch (err) {
        console.error('updateLead failed:', err);
        return { success: false, error: err.message || String(err) };
    }
});
