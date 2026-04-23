// ─────────────────────────────────────────────────────────────────────────────
//  CRAMS - AMS - Welcome / Login
//
//  Required elements on the Welcome page in Wix Studio:
//    #usernameInput   → Text input for username
//    #passwordInput   → Text input for password (set type to Password in settings)
//    #loginBtn        → Button to submit login
//    #errorMsg        → Text element for error/status messages (hidden by default)
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

import { validateLogin } from 'backend/login-verification.web.js';
import { to } from 'wix-location';
import { session as storage } from 'wix-storage';

$w.onReady(function () {
    const usernameInput = $w("#usernameInput");
    const passwordInput = $w("#passwordInput");
    const loginBtn      = $w("#loginBtn");
    const errorMsg      = $w("#errorMsg");

    // If already logged in, skip the login page
    const existingHash = storage.getItem("crams_session_hash");
    const existingUser = storage.getItem("crams_username");
    if (existingHash && existingUser) {
        to("/dashboard");
        return;
    }

    // Allow submitting with Enter key
    passwordInput.onKeyPress((event) => {
        if (event.key === "Enter") handleLogin();
    });

    loginBtn.onClick(() => handleLogin());

    async function handleLogin() {
        // Basic client-side validation
        if (!usernameInput.value || !passwordInput.value) {
            showError("Please enter your username and password.");
            return;
        }

        loginBtn.disable();
        errorMsg.hide();

        try {
            const res = await validateLogin(
                usernameInput.value.trim().toLowerCase(),
                passwordInput.value
            );

            if (res.body.success) {
                // Store session
                storage.setItem("crams_session_hash",  res.body.sessionHash);
                storage.setItem("crams_username",      usernameInput.value.trim().toLowerCase());
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