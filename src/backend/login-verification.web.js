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

// Session hashes are stored in the Accounts CMS (sessionHash field).
// To add a new user: add a row to Accounts with a unique sessionHash — no code changes needed.


// ─────────────────────────────────────────────────────────────────────────────
//  getLoginAccounts
//  Returns all account usernames + displayNames for the login page dropdown.
//  No sensitive fields (password, role, etc.) are exposed.
// ─────────────────────────────────────────────────────────────────────────────
export const getLoginAccounts = webMethod(Permissions.Anyone, async function () {
    try {
        const { items } = await wixData
            .query("Accounts")
            .ascending("displayName")
            .find({ suppressAuth: true });

        return items.map(u => ({
            username:    u.username,
            displayName: u.displayName || u.username,
        }));
    } catch (err) {
        console.error("getLoginAccounts error:", err);
        return [];
    }
});


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

        if (!user.sessionHash) {
            console.error(`No sessionHash in CMS for user: ${username}`);
            return response({
                status: 500,
                body: { success: false, message: "Login configuration error. Contact admin." }
            });
        }

        // Normalise role — CMS may store a string or an array
        const rawRole = user.role;
        const roles = Array.isArray(rawRole)
            ? rawRole
            : [rawRole || 'sales'];

        // Success
        return response({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: {
                success:     true,
                message:     "Login successful.",
                role:        JSON.stringify(roles),
                displayName: user.displayName || username,
                sessionHash: user.sessionHash,
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
export const verifyCookie = webMethod(Permissions.Anyone, async function (username, sessionHash) {
    try {
        const { items } = await wixData
            .query("Accounts")
            .eq("username", username)
            .find({ suppressAuth: true });

        if (items.length > 0 && items[0].sessionHash && items[0].sessionHash === sessionHash) {
            return response({ status: 200 });
        }
        return response({ status: 401 });
    } catch (err) {
        console.error("verifyCookie error:", err);
        return response({ status: 401 });
    }
});

