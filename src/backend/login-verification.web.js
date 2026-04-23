// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - login-verification.web.js
//
//  Functions:
//    validateLogin(username, password) → { success, message, role, displayName, sessionHash }
//    verifyCookie(username, sessionHash) → { status }
//
//  Accounts collection fields used:
//    username    → login username
//    password    → plaintext password (upgrade to hashed for production)
//    role        → "admin" | "sales"
//    displayName → human readable name shown in dashboard
//
//  Session cookie pattern (same as genesis-leads):
//    On login success, a sessionHash is returned and stored in wix-storage.
//    Every protected page calls verifyCookie() on load to verify the session.
//    The hashMap below maps each username to a unique random string.
//    To add a new user: add their account row in the Accounts CMS collection
//    AND add their username → hash entry in the hashMap below.
// ─────────────────────────────────────────────────────────────────────────────

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { response } from 'wix-http-functions';

// ─────────────────────────────────────────────────────────────────────────────
//  Session Hash Map
//  Each username maps to a unique random string used as the session cookie.
//  Generate new hashes at: https://www.uuidgenerator.net/
//  Add a row here for every user in the Accounts collection.
// ─────────────────────────────────────────────────────────────────────────────
const sessionHashMap = {
    "PolarisUAE":    "AMS_k9Xv2mPqL7nRtZwYcJhD4sBf",
    // Add sales users below as AMS provides them:
    // "salesuser1": "AMS_<generate_unique_hash_here>",
    // "salesuser2": "AMS_<generate_unique_hash_here>",
};


// ─────────────────────────────────────────────────────────────────────────────
//  validateLogin
//  Called from the Welcome page on form submit.
//  Queries the Accounts collection, checks password, returns session data.
// ─────────────────────────────────────────────────────────────────────────────
export const validateLogin = webMethod(Permissions.Anyone, async function (username, password) {
    try {
        const { items } = await wixData
            .query("Accounts")
            .eq("username", username)
            .find({ suppressAuth: true });

        // Username not found
        if (items.length === 0) {
            return response({
                status: 401,
                body: { success: false, message: "Username not recognised." }
            });
        }

        const user = items[0];

        // Wrong password
        if (user.password !== password) {
            return response({
                status: 401,
                body: { success: false, message: "Incorrect password." }
            });
        }

        // No hash defined for this user (code needs updating)
        if (!sessionHashMap[username]) {
            console.error(`No session hash defined for user: ${username}`);
            return response({
                status: 500,
                body: { success: false, message: "Login configuration error. Contact admin." }
            });
        }

        // Success
        return response({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: {
                success:     true,
                message:     "Login successful.",
                role:        user.role        || "sales",
                displayName: user.displayName || username,
                sessionHash: sessionHashMap[username],
            }
        });

    } catch (err) {
        console.error("validateLogin error:", err);
        return response({
            status: 500,
            body: { success: false, message: "An error occurred. Please try again." }
        });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
//  verifyCookie
//  Called on every protected page load to validate the session.
//  Returns 200 if valid, 401 if not.
// ─────────────────────────────────────────────────────────────────────────────
export const verifyCookie = webMethod(Permissions.Anyone, function (username, sessionHash) {
    if (sessionHashMap[username] && sessionHashMap[username] === sessionHash) {
        return response({ status: 200 });
    }
    return response({ status: 401 });
});