// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Welcome / Login
//
//  Required elements on the Welcome page in Wix Studio:
//    #usernameDropdown → Dropdown for selecting username (replaces text input)
//    #passwordInput    → Text input for password (set type to Password in settings)
//    #loginBtn         → Button to submit login
//    #errorMsg         → Text element for error/status messages (hidden by default)
//
//  On login success:
//    admin → /dashboard
//    sales → /dashboard  (same page — role stored in session controls what they see)
//
//  Session storage keys (wix-storage session):
//    "crams_session_hash"  → the session hash for verifyCookie()
//    "crams_username"      → logged-in username
//    "crams_role"          → "admin" | "sales"
//    "crams_display_name"  → human readable name for the dashboard header
// ─────────────────────────────────────────────────────────────────────────────

import { validateLogin, getLoginAccounts } from 'backend/login-verification.web.js';
import { to } from 'wix-location';
import { session as storage } from 'wix-storage';

$w.onReady(async function () {
    const usernameDropdown = $w("#usernameDropdown");
    const passwordInput    = $w("#passwordInput");
    const loginBtn         = $w("#loginBtn");
    const errorMsg         = $w("#errorMsg");

    // If already logged in, skip the login page
    const existingHash = storage.getItem("crams_session_hash");
    const existingUser = storage.getItem("crams_username");
    if (existingHash && existingUser) {
        to("/dashboard");
        return;
    }

    // Populate username dropdown from Accounts CMS, grouped by role
    try {
        const accounts = await getLoginAccounts();

        const CATEGORY_ORDER = ['admin', 'sales', 'test', 'dev'];
        const CATEGORY_LABELS = { admin: '— Admin —', sales: '— Sales —', test: '— Test —', dev: '— Dev —' };

        const grouped = {};
        for (const a of accounts) {
            const roles = (Array.isArray(a.role) ? a.role : [a.role || 'sales']).map(r => r.toLowerCase());
            // dev tag takes precedence for display grouping only
            const bucket = roles.includes('dev') ? 'dev' : (roles[0] || 'sales');
            if (!grouped[bucket]) grouped[bucket] = [];
            grouped[bucket].push(a);
        }

        const options = [];
        for (const cat of CATEGORY_ORDER) {
            if (!grouped[cat] || grouped[cat].length === 0) continue;
            options.push({ label: CATEGORY_LABELS[cat], value: '', disabled: true });
            for (const a of grouped[cat]) {
                options.push({ label: a.displayName, value: a.username });
            }
        }
        // Append any roles not in CATEGORY_ORDER
        for (const [role, members] of Object.entries(grouped)) {
            if (CATEGORY_ORDER.includes(role)) continue;
            const header = `— ${role.charAt(0).toUpperCase() + role.slice(1)} —`;
            options.push({ label: header, value: '', disabled: true });
            for (const a of members) {
                options.push({ label: a.displayName, value: a.username });
            }
        }

        usernameDropdown.options = options;
    } catch (err) {
        console.error("Failed to load accounts:", err);
        showError("Could not load accounts. Please refresh.");
    }

    loginBtn.enable();

    passwordInput.onKeyPress((event) => {
        if (event.key === "Enter") handleLogin();
    });

    loginBtn.onClick(() => handleLogin());

    async function handleLogin() {
        const username = usernameDropdown.value;
        if (!username || !passwordInput.value) {
            showError("Please select your account and enter your password.");
            return;
        }

        loginBtn.disable();
        errorMsg.hide();

        try {
            const res = await validateLogin(username, passwordInput.value);

            if (res.body.success) {
                storage.setItem("crams_session_hash",  res.body.sessionHash);
                storage.setItem("crams_username",      username);
                storage.setItem("crams_role",          res.body.role);
                storage.setItem("crams_display_name",  res.body.displayName);

                showSuccess("Login successful. Redirecting...");
                setTimeout(() => to("/dashboard"), 1000);

            } else {
                showError(res.body.message || "Login failed.");
                loginBtn.enable();
            }

        } catch (err) {
            console.error("Login error:", err);
            showError("An error occurred. Please try again.");
            loginBtn.enable();
        }
    }

    function showError(msg) {
        errorMsg.text = msg;
        errorMsg.style.color = "#CC0000";
        errorMsg.show();
        setTimeout(() => errorMsg.hide(), 4000);
    }

    function showSuccess(msg) {
        errorMsg.text = msg;
        errorMsg.style.color = "#000000";
        errorMsg.show();
    }
});
