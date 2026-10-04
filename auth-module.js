/**
 * ================================================================
 * TABREED AUTOMATION - CENTRALIZED AUTHENTICATION & LOGIN MODULE
 * ================================================================
 * File: auth-module.js
 * Purpose:
 *   - Single unified module for Login, User Session, Roles & Profile
 *   - Auto-mounts / syncs Header Login & User Profile button across ALL pages
 *   - Centralized Access Login Modal & User Profile Modal
 *   - Hover-rotating Lock Icon on Access Login modal
 *   - High-contrast Red Hover effect on all Close (X) buttons
 *   - Clean Password Box with zero placeholder text & no instruction subtitle
 *   - Normal User Profile for 41764 & 40078 on normal login, Developer/Supervisor on lkku/time-code
 *   - Sanitized Capitalize Case "Abdul Majeed Ansari" everywhere
 *   - Direct automatic logging to Mix Data "Login Log" Sheet and server
 * ================================================================
 */

(function (window, document) {
    'use strict';

    // Prevent duplicate initialization
    if (window.TabreedAuth && window.TabreedAuth._initialized) {
        return;
    }

    /**
     * Helper: Title Case / Capitalize Case formatter
     * Strictly enforces "Abdul Majeed Ansari" for 41764 or any Majeed variation
     */
    function formatDisplayName(name, code) {
        const cStr = String(code || '').trim();
        if (cStr === "41764" || (name && (name.toLowerCase().includes("majeed") || name.toLowerCase().includes("ansari")))) {
            return "Abdul Majeed Ansari";
        }
        if (!name) return "User";
        return String(name)
            .toLowerCase()
            .replace(/(?:^|\s|-)\S/g, function(a) { return a.toUpperCase(); });
    }

    // Default Fallback Employees List (matching /data/employees.json)
    const DEFAULT_EMPLOYEES = [
        { code: "40311", full: "Jerlin Dela Vega Cabral", short: "Jerlin", email: "jcabral@tabreed.ae", phone: "+971 567438964", whatsapp: "+971 561839559", role: "user" },
        { code: "40334", full: "Rajesh Kumar Singh", short: "Rajesh", email: "rksingh@tabreed.ae", phone: "+971 561262435", whatsapp: "+917779978054", role: "user" },
        { code: "40414", full: "Eugineraj Kamaraj", short: "Eugine", email: "ekamaraj@tabreed.ae", phone: "+971 502550870", whatsapp: "+971 502550870", role: "user" },
        { code: "40528", full: "Prasanth M Purushothaman", short: "Prashant", email: "ppurushothaman@tabreed.ae", phone: "+971 567438784", whatsapp: "+971 547279746", role: "user" },
        { code: "40659", full: "Thomas Geevarghese", short: "Thomas", email: "tgeevarghese@tabreed.ae", phone: "+971 561253094", whatsapp: "+971 558742331", role: "user" },
        { code: "40663", full: "Akbarsha Nalakath Kallingal", short: "Akbar", email: "akallingal@tabreed.ae", phone: "+971 564001353", whatsapp: "+971 567904345", role: "user" },
        { code: "41380", full: "Manikandan Subramanian", short: "Manikandan", email: "msubramanian@tabreed.ae", phone: "+971 503349398", whatsapp: "+971 561366492", role: "user" },
        { code: "41383", full: "Jibin John", short: "Jibin", email: "jpjohn@tabreed.ae", phone: "+971 507815840", whatsapp: "+971 507615840", role: "user" },
        { code: "41600", full: "Pramod Dejappa Poojary", short: "Pramod", email: "pdpoojary@tabreed.ae", phone: "+971 545492470", whatsapp: "+971 547725275", role: "user" },
        { code: "41764", full: "Abdul Majeed Ansari", short: "Majeed", email: "amansari@tabreed.ae", phone: "+971 561254667", whatsapp: "+971 565911432", role: "user" },
        { code: "41806", full: "Yoosaf Mundodan", short: "Yoosaf", email: "ymundodan@tabreed.ae", phone: "+971 561254047", whatsapp: "+971 504249896", role: "user" },
        { code: "40078", full: "Bibin Ipe Abraham", short: "Bibin", email: "babraham@tabreed.ae", phone: "+971 567438782", whatsapp: "+971 567438782", role: "user" }
    ];

    const MIX_GAS_FALLBACK_URL = "https://script.google.com/macros/s/AKfycby3rLk9ihwFSTXmDnp0suNtsxNRfZntql7rrPzB2u-l8vYVSMpZyDwOt7kkv_LstERijQ/exec";

    // Storage Keys (Unified across all pages)
    const STORAGE_KEY_USER = 'tabreed_currentUser';
    const STORAGE_KEY_ADMIN_USER = 'tabreed_admin_user';
    const STORAGE_KEY_UNLOCKED = 'tabreed_admin_unlocked';

    class TabreedAuthManager {
        constructor() {
            this._initialized = true;
            this.employees = [...DEFAULT_EMPLOYEES];
            this.currentUser = null;
            this.authListeners = [];
            this.modalEl = null;
            this.profileModalEl = null;

            this._loadEmployeesData();
            this._restoreUserSession();
            this._initStorageListener();

            // Setup DOM elements when document is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._onDomReady());
            } else {
                this._onDomReady();
            }
        }

        /**
         * Fetch latest employees list from /data/employees.json if available
         */
        async _loadEmployeesData() {
            try {
                const res = await fetch('data/employees.json');
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        this.employees = list.map(e => ({
                            ...e,
                            full: formatDisplayName(e.full, e.code),
                            short: (e.code === "41764" ? "Majeed" : (e.short || e.full.split(' ')[0]))
                        }));
                        window.EMPLOYEES = this.employees;
                    }
                }
            } catch (e) {
                try {
                    const res2 = await fetch('/data/employees.json');
                    if (res2.ok) {
                        const list2 = await res2.json();
                        if (Array.isArray(list2) && list2.length > 0) {
                            this.employees = list2.map(e => ({
                                ...e,
                                full: formatDisplayName(e.full, e.code),
                                short: (e.code === "41764" ? "Majeed" : (e.short || e.full.split(' ')[0]))
                            }));
                            window.EMPLOYEES = this.employees;
                        }
                    }
                } catch (e2) {}
            }
        }

        /**
         * Restore logged-in session from localStorage
         */
        _restoreUserSession() {
            try {
                let saved = localStorage.getItem(STORAGE_KEY_USER) || localStorage.getItem(STORAGE_KEY_ADMIN_USER);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && (parsed.code || parsed.name || parsed.short)) {
                        this.currentUser = this._enrichUserData(parsed);
                    }
                }
            } catch (e) {
                this.currentUser = null;
            }
            window.currentAuthUser = this.currentUser;
            window.currentUser = this.currentUser;
        }

        /**
         * Cross-tab storage synchronization
         */
        _initStorageListener() {
            window.addEventListener('storage', (e) => {
                if (e.key === STORAGE_KEY_USER || e.key === STORAGE_KEY_ADMIN_USER) {
                    this._restoreUserSession();
                    this.updateHeaderUI();
                    this._notifyListeners(this.currentUser, false);
                }
            });
        }

        _onDomReady() {
            this._injectAuthStyles();
            this._ensureModalsInDOM();
            this.attachHeaderButtons();
            this.updateHeaderUI();
            this._setupUniversalCloseButtonHooks();
            this._purgeDisallowedAuthText();
        }

        /**
         * Enriches user data with clean names, role and flags
         */
        _enrichUserData(rawUser) {
            if (!rawUser) return null;
            const code = String(rawUser.code || rawUser.id || '').trim();
            const matchedEmp = this.employees.find(e => String(e.code) === code);

            let role = rawUser.role || "user";
            let fullName = formatDisplayName(rawUser.full || (matchedEmp ? matchedEmp.full : (rawUser.name || 'User')), code);
            let shortName = (code === "41764") ? "Majeed" : (rawUser.short || (matchedEmp ? matchedEmp.short : (fullName.split(' ')[0])));

            return {
                code: code,
                full: fullName,
                short: shortName,
                name: shortName,
                email: rawUser.email || (matchedEmp ? matchedEmp.email : ''),
                phone: rawUser.phone || (matchedEmp ? matchedEmp.phone : ''),
                whatsapp: rawUser.whatsapp || (matchedEmp ? matchedEmp.whatsapp : ''),
                plant: rawUser.plant || (matchedEmp ? (matchedEmp.plant || '-') : '-'),
                shift: rawUser.shift || (matchedEmp ? (matchedEmp.shift || '-') : '-'),
                role: role
            };
        }

        /**
         * Global Time-based PIN Validator (+/- 10 minutes, UTC+4 UAE time)
         */
        isTimebaseCode(clean, prefixCode) {
            if (!clean || !clean.startsWith(prefixCode) || clean.length <= prefixCode.length) return false;
            const timePart = clean.substring(prefixCode.length);
            const now = new Date();

            for (let offset = -10; offset <= 10; offset++) {
                const targetMs = now.getTime() + offset * 60000;
                const dLocal = new Date(targetMs);

                // UAE Time (UTC+4) calculation
                const uaeMs = targetMs + (dLocal.getTimezoneOffset() * 60000) + (4 * 3600000);
                const dUae = new Date(uaeMs);

                for (const d of [dLocal, dUae]) {
                    const h24 = d.getHours();
                    const m = d.getMinutes();
                    const h12 = h24 % 12 || 12;

                    const mm = String(m).padStart(2, '0');
                    const hh24 = String(h24).padStart(2, '0');
                    const h24Str = String(h24);
                    const hh12 = String(h12).padStart(2, '0');
                    const h12Str = String(h12);

                    const validPatterns = [
                        `${hh24}${mm}`,
                        `${h24Str}${mm}`,
                        `${hh12}${mm}`,
                        `${h12Str}${mm}`
                    ];

                    if (validPatterns.includes(timePart)) {
                        return true;
                    }
                }
            }
            return false;
        }

        /**
         * Authoritative Password/Code Verification
         * 
         * Rules:
         * 1. 'lkku' -> Developer / Super Admin Profile (Abdul Majeed Ansari)
         * 2. '41764' + HHMM -> Developer / Super Admin Profile (Abdul Majeed Ansari)
         * 3. '40078' + HHMM -> Supervisor Profile (Bibin Ipe Abraham)
         * 4. '41764' (standard code) -> Normal USER Profile (Abdul Majeed Ansari, same like others)
         * 5. '40078' (standard code) -> Normal USER Profile (Bibin Ipe Abraham, same like others)
         * 6. Any other employee code -> Normal USER Profile
         */
        verifyUserLogin(pass) {
            if (!pass) return null;
            const clean = pass.toString().trim();

            // 1. Master Developer Password strictly 'lkku' -> Developer / Super Admin
            if (clean === "lkku") {
                const majeed = this.employees.find(e => String(e.code) === "41764") || {
                    code: "41764",
                    full: "Abdul Majeed Ansari",
                    short: "Majeed"
                };
                return { ...majeed, full: "Abdul Majeed Ansari", short: "Majeed", role: "super_admin" };
            }

            // 2. Time-based check for Developer / Super Admin Majeed (strictly 41764 + HHMM) -> Developer / Super Admin
            if (this.isTimebaseCode(clean, "41764")) {
                const majeed = this.employees.find(e => String(e.code) === "41764") || {
                    code: "41764",
                    full: "Abdul Majeed Ansari",
                    short: "Majeed"
                };
                return { ...majeed, full: "Abdul Majeed Ansari", short: "Majeed", role: "super_admin" };
            }

            // 3. Time-based check for Supervisor (strictly 40078 + HHMM) -> Supervisor
            if (this.isTimebaseCode(clean, "40078")) {
                const bibin = this.employees.find(e => String(e.code) === "40078") || {
                    code: "40078",
                    full: "Bibin Ipe Abraham",
                    short: "Bibin"
                };
                return { ...bibin, full: formatDisplayName(bibin.full, "40078"), role: "supervisor" };
            }

            // 4. Pure Employee Code check: When 41764, 40078, or ANY employee enters just their employee code,
            // they ALWAYS log in as normal "user" with standard User Profile (same like others)
            for (const emp of this.employees) {
                if (clean === String(emp.code).trim()) {
                    const fullClean = (clean === "41764") ? "Abdul Majeed Ansari" : formatDisplayName(emp.full, emp.code);
                    const shortClean = (clean === "41764") ? "Majeed" : (emp.short || fullClean.split(' ')[0]);
                    return { ...emp, full: fullClean, short: shortClean, role: "user" };
                }
            }

            return null;
        }

        /**
         * Log login event to server /api/log-login and Mix Data GAS "Login Log" sheet
         */
        recordUserLoginToMixData(user, sourcePage = '') {
            if (!user) return;
            try {
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                const timestamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

                const isSuper = this.isDeveloper(user);
                const isSup = this.isSupervisor(user);
                const roleName = isSuper ? 'Developer' : (isSup ? 'Supervisor' : 'User');

                const pageLabel = sourcePage || document.title || 'Tabreed Automation';
                const deviceType = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';

                const payload = {
                    action: 'logLogin',
                    timestamp: timestamp,
                    code: String(user.code || '').trim(),
                    name: (user.code === "41764") ? "Majeed" : (user.short || user.name || user.full || 'User'),
                    role: roleName,
                    plantShift: user.plant || user.shift || '-',
                    device: `${deviceType} (${pageLabel})`
                };

                // 1. Post to local server endpoint
                fetch('/api/log-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {
                    // 2. Direct fallback to Mix Data GAS
                    let gasUrl = MIX_GAS_FALLBACK_URL;
                    if (window.CONFIG && window.CONFIG.API && window.CONFIG.API.MIX_DATA_GAS_URL) {
                        gasUrl = window.CONFIG.API.MIX_DATA_GAS_URL;
                    }
                    fetch(gasUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(payload),
                        mode: 'no-cors'
                    }).catch(() => {});
                });
            } catch (err) {
                console.warn("[Auth] Login log note:", err);
            }
        }

        /**
         * Apply login, persist session, log event, and update UI
         */
        applyUserLogin(user, showToastMessage = true, sourcePage = '') {
            if (!user) return;
            const enriched = this._enrichUserData(user);
            this.currentUser = enriched;
            window.currentAuthUser = enriched;
            window.currentUser = enriched;

            try {
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(enriched));
                localStorage.setItem(STORAGE_KEY_ADMIN_USER, JSON.stringify(enriched));
                localStorage.setItem(STORAGE_KEY_UNLOCKED, 'true');
            } catch (e) {}

            this.updateHeaderUI();
            this.recordUserLoginToMixData(enriched, sourcePage);

            if (showToastMessage) {
                const isSuper = this.isDeveloper(enriched);
                const isSup = this.isSupervisor(enriched);
                if (isSuper) {
                    this.showToast(`Welcome, ${enriched.short}! Developer Access active.`, 'success');
                } else if (isSup) {
                    this.showToast(`Welcome, ${enriched.short}! Supervisor Access active.`, 'success');
                } else {
                    this.showToast(`Welcome, ${enriched.short}!`, 'info');
                }
            }

            this._notifyListeners(enriched, true);
        }

        /**
         * Logout user and reset state
         */
        logout(showToastMessage = true) {
            this.currentUser = null;
            window.currentAuthUser = null;
            window.currentUser = null;

            try {
                localStorage.removeItem(STORAGE_KEY_USER);
                localStorage.removeItem(STORAGE_KEY_ADMIN_USER);
                localStorage.removeItem(STORAGE_KEY_UNLOCKED);
                localStorage.removeItem('tabreed_ets_admin_unlocked');
                localStorage.removeItem('tabreed_ets_admin_user');
            } catch (e) {}

            this.closeUserProfileModal();
            this.updateHeaderUI();

            if (showToastMessage) {
                this.showToast("Logged out successfully.", "info");
            }

            this._notifyListeners(null, false);
        }

        /**
         * Interactive Unified Login Modal
         */
        promptLogin(sourcePage = '', callback = null) {
            this._ensureModalsInDOM();
            const modal = this.modalEl;
            if (!modal) return;

            const input = modal.querySelector('#unifiedAuthInput');
            const errEl = modal.querySelector('#unifiedAuthError');
            if (errEl) {
                errEl.style.display = 'none';
                errEl.innerText = '';
            }
            this._purgeDisallowedAuthText();
            if (input) {
                input.value = '';
                input.placeholder = '';
                input.removeAttribute('placeholder');
            }

            modal.style.display = 'flex';
            setTimeout(() => {
                if (input) {
                    input.placeholder = '';
                    input.removeAttribute('placeholder');
                    input.focus();
                }
            }, 80);

            // Handle submission
            const submitForm = () => {
                const val = input ? input.value.trim() : '';
                if (!val) {
                    if (errEl) {
                        errEl.innerText = 'Please enter password.';
                        errEl.style.display = 'block';
                    }
                    if (input) input.focus();
                    return;
                }

                const verified = this.verifyUserLogin(val);
                if (verified) {
                    this.closeLoginModal();
                    this.applyUserLogin(verified, true, sourcePage);
                    if (typeof callback === 'function') callback(verified);
                } else {
                    if (errEl) {
                        errEl.innerText = 'Access Denied: Invalid Password.';
                        errEl.style.display = 'block';
                    }
                    if (input) {
                        input.classList.add('shake-anim');
                        setTimeout(() => input.classList.remove('shake-anim'), 500);
                        input.select();
                    }
                    this.showToast('Access Denied: Invalid Password', 'error');
                }
            };

            const submitBtn = modal.querySelector('#unifiedAuthSubmit');
            if (submitBtn) submitBtn.onclick = submitForm;

            const cancelBtn = modal.querySelector('#unifiedAuthCancel');
            if (cancelBtn) cancelBtn.onclick = () => this.closeLoginModal();

            const closeBtn = modal.querySelector('#unifiedAuthClose');
            if (closeBtn) closeBtn.onclick = () => this.closeLoginModal();

            if (input) {
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') submitForm();
                    if (e.key === 'Escape') this.closeLoginModal();
                };
            }
        }

        closeLoginModal() {
            if (this.modalEl) {
                this.modalEl.style.display = 'none';
            }
        }

        /**
         * Open User Profile Modal
         */
        openUserProfileModal() {
            if (!this.currentUser) {
                this.promptLogin();
                return;
            }

            this._ensureModalsInDOM();
            const modal = this.profileModalEl;
            if (!modal) return;

            const u = this.currentUser;
            const nameEl = modal.querySelector('#unifiedProfileName');
            const codeEl = modal.querySelector('#unifiedProfileCode');
            const emailEl = modal.querySelector('#unifiedProfileEmail');
            const roleEl = modal.querySelector('#unifiedProfileRole');

            if (nameEl) nameEl.innerText = formatDisplayName(u.full || u.short || 'User', u.code);
            if (codeEl) codeEl.innerText = `Employee ID: ${u.code || 'N/A'}`;
            if (emailEl) {
                emailEl.innerText = u.email || '';
                emailEl.style.display = u.email ? 'block' : 'none';
            }

            if (roleEl) {
                const isSuper = this.isDeveloper(u);
                const isSup = this.isSupervisor(u);
                if (isSuper) {
                    roleEl.innerText = 'DEVELOPER / SUPER ADMIN';
                    roleEl.style.background = '#e11d48';
                    roleEl.style.color = '#ffffff';
                } else if (isSup) {
                    roleEl.innerText = 'SUPERVISOR';
                    roleEl.style.background = '#ea580c';
                    roleEl.style.color = '#ffffff';
                } else {
                    roleEl.innerText = 'USER';
                    roleEl.style.background = '#10b981';
                    roleEl.style.color = '#ffffff';
                }
                roleEl.style.display = 'inline-block';
            }

            modal.style.display = 'flex';
        }

        closeUserProfileModal() {
            if (this.profileModalEl) {
                this.profileModalEl.style.display = 'none';
            }
        }

        /**
         * Attach unified click handlers to existing or newly created header buttons
         */
        attachHeaderButtons() {
            const loginBtns = document.querySelectorAll('#header-login-btn');
            loginBtns.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.promptLogin();
                };
            });

            const userBtns = document.querySelectorAll('#header-user-btn');
            userBtns.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.openUserProfileModal();
                };
            });

            // If a page does not have header buttons, auto-mount them into header
            if (loginBtns.length === 0 && userBtns.length === 0) {
                this._autoMountHeaderButtons();
            }
        }

        /**
         * Automatically injects login / user button into any header that lacks them
         */
        _autoMountHeaderButtons() {
            const targetContainer = document.querySelector('.header-actions') || 
                                    document.querySelector('.fiori-header > div:last-child') || 
                                    document.querySelector('.header-content > div:last-child') || 
                                    document.querySelector('header .brand')?.parentElement ||
                                    document.querySelector('header');

            if (!targetContainer) return;

            const wrapper = document.createElement('div');
            wrapper.id = 'unified-auth-header-wrapper';
            wrapper.style.display = 'inline-flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '8px';

            wrapper.innerHTML = `
                <!-- Login Button -->
                <button id="header-login-btn" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;padding:6px 14px;font-size:11px;font-weight:700;border-radius:20px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 3px 10px rgba(37,99,235,.35);">
                    <i class="fas fa-sign-in-alt"></i> <span>LOGIN</span>
                </button>
                <!-- User Profile Button -->
                <div id="header-user-btn" style="display:none;align-items:center;gap:7px;background:rgba(37,99,235,0.12);border:1px solid rgba(37,99,235,0.3);color:var(--primary,#0284c7);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;user-select:none;" title="User Profile">
                    <i class="fas fa-user-circle" style="font-size:14px;color:var(--primary,#0284c7);"></i>
                    <span id="header-user-name">User</span>
                    <span id="header-user-role-badge" style="display:none;font-size:9px;color:white;padding:1px 6px;border-radius:6px;text-transform:uppercase;font-weight:800;"></span>
                </div>
            `;

            targetContainer.appendChild(wrapper);

            const newLogin = wrapper.querySelector('#header-login-btn');
            if (newLogin) newLogin.onclick = () => this.promptLogin();

            const newUser = wrapper.querySelector('#header-user-btn');
            if (newUser) newUser.onclick = () => this.openUserProfileModal();
        }

        /**
         * Update visibility and text of header login/user buttons on the page
         */
        updateHeaderUI() {
            const loginBtns = document.querySelectorAll('#header-login-btn');
            const userBtns = document.querySelectorAll('#header-user-btn');
            const userNames = document.querySelectorAll('#header-user-name');
            const roleBadges = document.querySelectorAll('#header-user-role-badge');

            if (this.currentUser) {
                // User is LOGGED IN
                loginBtns.forEach(b => b.style.display = 'none');
                userBtns.forEach(b => b.style.display = 'inline-flex');

                const shortName = this.currentUser.short || this.currentUser.name || 'User';
                userNames.forEach(n => { n.innerText = shortName; });

                const isSuper = this.isDeveloper(this.currentUser);
                const isSup = this.isSupervisor(this.currentUser);

                roleBadges.forEach(rb => {
                    if (isSuper) {
                        rb.innerText = 'DEV';
                        rb.style.background = '#e11d48';
                        rb.style.display = 'inline-block';
                    } else if (isSup) {
                        rb.innerText = 'SUPERVISOR';
                        rb.style.background = '#ea580c';
                        rb.style.display = 'inline-block';
                    } else {
                        rb.innerText = 'USER';
                        rb.style.background = '#10b981';
                        rb.style.display = 'none'; // Keep subtle for normal users
                    }
                });
            } else {
                // User is LOGGED OUT
                loginBtns.forEach(b => b.style.display = 'inline-flex');
                userBtns.forEach(b => b.style.display = 'none');
            }
        }

        /**
         * Role helper checks - Strictly role-based!
         * Does NOT grant developer/supervisor to 41764 or 40078 when their role is 'user'.
         */
        getUser() {
            return this.currentUser;
        }

        getCurrentUser() {
            return this.currentUser;
        }

        isLoggedIn() {
            return !!this.currentUser;
        }

        isDeveloper(user = this.currentUser) {
            if (!user) return false;
            return user.role === 'developer' || user.role === 'super_admin';
        }

        isSuperAdmin(user = this.currentUser) {
            return this.isDeveloper(user);
        }

        isSupervisor(user = this.currentUser) {
            if (!user) return false;
            return user.role === 'supervisor' || user.role === 'admin' || this.isDeveloper(user);
        }

        isUserAdmin(user = this.currentUser) {
            return this.isSupervisor(user);
        }

        getEmployees() {
            return this.employees;
        }

        /**
         * Register event listener for login/logout changes
         */
        onAuthChange(callback) {
            if (typeof callback === 'function') {
                this.authListeners.push(callback);
                // Immediately notify listener of current state
                callback(this.currentUser);
            }
        }

        _notifyListeners(user, isExplicitLogin = false) {
            this.authListeners.forEach(cb => {
                try { cb(user, isExplicitLogin); } catch (e) { console.error("[Auth] Listener error:", e); }
            });

            // Dispatch global CustomEvent for loose coupling
            window.dispatchEvent(new CustomEvent('tabreed:auth-changed', {
                detail: { user, loggedIn: !!user, isExplicitLogin }
            }));
        }

        /**
         * Toast notification helper
         */
        showToast(msg, type = 'info') {
            if (typeof window.showToast === 'function' && window.showToast !== this.showToast) {
                try {
                    window.showToast(msg, type);
                    return;
                } catch(e) {}
            }

            let container = document.getElementById('toastContainer') || document.getElementById('unifiedToastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'unifiedToastContainer';
                container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.style.cssText = 'background:#1e293b;color:white;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;pointer-events:auto;animation:popIn .2s ease;';
            
            const color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#0284c7');
            const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
            
            toast.innerHTML = `<i class="fas ${icon}" style="color:${color};font-size:16px;"></i><span>${msg}</span>`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
            }, 3000);
        }

        /**
         * Universal Hook: Ensures all X and Close buttons across all popups get the red hover styling
         */
        _setupUniversalCloseButtonHooks() {
            const applyCloseBtnClass = () => {
                const buttons = document.querySelectorAll('button, a, span.close');
                buttons.forEach(btn => {
                    const text = (btn.innerText || '').trim();
                    const aria = btn.getAttribute('aria-label') || '';
                    const id = btn.id || '';
                    const cls = btn.className || '';
                    const hasCloseIcon = btn.querySelector('.fa-times, .fa-xmark');

                    if (text === '×' || text === '✕' || aria.toLowerCase() === 'close' || 
                        hasCloseIcon || id.toLowerCase().includes('close') || cls.includes('modal-close') || cls.includes('close-btn')) {
                        if (!btn.classList.contains('universal-close-btn') && !cls.includes('btn-cancel') && !cls.includes('btn-secondary')) {
                            btn.classList.add('universal-close-btn');
                        }
                    }
                });
            };

            applyCloseBtnClass();
            // Run periodically or on clicks for dynamically spawned modals
            document.addEventListener('click', () => setTimeout(applyCloseBtnClass, 150));
        }

        /**
         * Actively purges any "Enter Employee Code or Dev PIN" or "Dev PIN" text anywhere in DOM
         * and guarantees no password input shows any placeholder text.
         */
        _purgeDisallowedAuthText() {
            try {
                // 1. Remove any element or subtitle with disallowed text
                const candidateEls = document.querySelectorAll('p, span, div, label, small, h4, h5, sub');
                candidateEls.forEach(el => {
                    const txt = (el.innerText || '').trim();
                    if (txt.includes('Enter Employee Code or Dev PIN') || txt.includes('Dev PIN')) {
                        el.remove();
                    }
                });

                // 2. Strip placeholder from all password boxes
                const passInputs = document.querySelectorAll('input[type="password"], #unifiedAuthInput, #devPassInput, #adminPassInput');
                passInputs.forEach(inp => {
                    inp.placeholder = '';
                    inp.removeAttribute('placeholder');
                    inp.setAttribute('placeholder', '');
                });
            } catch(e) {}
        }

        /**
         * Injects CSS styles needed for modals, rotating lock icon & red close buttons
         */
        _injectAuthStyles() {
            if (document.getElementById('tabreed-auth-styles')) return;
            const style = document.createElement('style');
            style.id = 'tabreed-auth-styles';
            style.textContent = `
                @keyframes authPopIn {
                    0% { transform: scale(0.92); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes authShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-6px); }
                    40%, 80% { transform: translateX(6px); }
                }
                input[type="password"]::placeholder,
                #unifiedAuthInput::placeholder,
                #devPassInput::placeholder,
                #adminPassInput::placeholder {
                    color: transparent !important;
                    opacity: 0 !important;
                    font-size: 0 !important;
                }
                .auth-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.65);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 10050;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    box-sizing: border-box;
                }
                .auth-modal-card {
                    background: var(--bg-card, #ffffff);
                    border-radius: 18px;
                    width: 100%;
                    max-width: 330px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
                    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
                    overflow: hidden;
                    animation: authPopIn 0.22s ease-out;
                    text-align: center;
                    position: relative;
                    box-sizing: border-box;
                    color: var(--text-primary, #0f172a);
                }
                .shake-anim {
                    animation: authShake 0.4s ease;
                }

                /* ────────────────────────────────────────────────────────
                   ROTATING LOCK ICON ON ACCESS LOGIN MODAL
                ──────────────────────────────────────────────────────── */
                .auth-lock-icon-box {
                    width: 58px;
                    height: 58px;
                    border-radius: 50%;
                    background: rgba(37, 99, 235, 0.12);
                    color: var(--primary, #0284c7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    font-size: 24px;
                    border: 1.5px solid rgba(37, 99, 235, 0.25);
                    cursor: pointer;
                    user-select: none;
                    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .auth-lock-icon-box:hover {
                    transform: rotate(360deg) scale(1.15);
                    background: rgba(37, 99, 235, 0.22);
                    border-color: var(--primary, #0284c7);
                    box-shadow: 0 8px 24px rgba(2, 132, 199, 0.35);
                }
                .auth-lock-icon-box i,
                .auth-lock-icon-box .fa-lock,
                .auth-lock-icon-box svg {
                    display: inline-block;
                    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .auth-lock-icon-box:hover i,
                .auth-lock-icon-box:hover .fa-lock,
                .auth-lock-icon-box:hover svg {
                    transform: rotate(360deg);
                }

                /* ────────────────────────────────────────────────────────
                   UNIVERSAL RED HOVER FOR ALL CLOSE / X BUTTONS IN POPUPS
                ──────────────────────────────────────────────────────── */
                .auth-close-btn,
                #unifiedAuthClose,
                #unifiedProfileClose,
                #devPassCloseBtn,
                #adminPassCloseBtn,
                #ackModalCloseBtn,
                button.modal-close,
                .modal-close,
                .close-modal,
                .modal-close-btn,
                .popup-close,
                .universal-close-btn,
                button[aria-label="Close"],
                .modal-header button:has(i.fa-times),
                .modal-header button:has(i.fa-xmark),
                button:has(> i.fa-times),
                button:has(> i.fa-xmark) {
                    transition: background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease !important;
                }

                .auth-close-btn:hover,
                #unifiedAuthClose:hover,
                #unifiedProfileClose:hover,
                #devPassCloseBtn:hover,
                #adminPassCloseBtn:hover,
                #ackModalCloseBtn:hover,
                button.modal-close:hover,
                .modal-close:hover,
                .close-modal:hover,
                .modal-close-btn:hover,
                .popup-close:hover,
                .universal-close-btn:hover,
                button[aria-label="Close"]:hover,
                .modal-header button:has(i.fa-times):hover,
                .modal-header button:has(i.fa-xmark):hover,
                button:has(> i.fa-times):hover,
                button:has(> i.fa-xmark):hover {
                    background: #ef4444 !important;
                    background-color: #ef4444 !important;
                    color: #ffffff !important;
                    border-color: #dc2626 !important;
                    transform: scale(1.12) !important;
                    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.45) !important;
                    cursor: pointer !important;
                }

                .auth-close-btn:hover *,
                #unifiedAuthClose:hover *,
                #unifiedProfileClose:hover *,
                #devPassCloseBtn:hover *,
                #adminPassCloseBtn:hover *,
                #ackModalCloseBtn:hover *,
                button.modal-close:hover *,
                .modal-close:hover *,
                .universal-close-btn:hover *,
                button[aria-label="Close"]:hover * {
                    color: #ffffff !important;
                }
            `;
            document.head.appendChild(style);
        }

        /**
         * Ensures the unified Access Login & Profile modals exist in DOM
         */
        _ensureModalsInDOM() {
            // 1. Access Login Modal
            let loginModal = document.getElementById('unifiedAccessLoginModal');
            if (!loginModal) {
                loginModal = document.createElement('div');
                loginModal.id = 'unifiedAccessLoginModal';
                loginModal.className = 'auth-modal-overlay';
                loginModal.style.display = 'none';
                loginModal.onclick = (e) => {
                    if (e.target === loginModal) this.closeLoginModal();
                };

                loginModal.innerHTML = `
                    <div class="auth-modal-card" style="padding: 24px;">
                        <button id="unifiedAuthClose" class="auth-close-btn" aria-label="Close" style="position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#e2e8f0);font-size:1.2rem;color:var(--text-primary,#0f172a);cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">&times;</button>
                        
                        <div class="auth-lock-icon-box" title="Security Access">
                            <i class="fas fa-lock"></i>
                        </div>
                        
                        <h3 style="margin:0 0 16px;color:var(--text-primary,#0f172a);font-size:1.15rem;font-weight:700;">Access Login</h3>
                        
                        <div id="unifiedAuthError" style="display:none;background:#fef2f2;color:#dc2626;padding:8px 12px;border-radius:8px;font-size:0.8rem;font-weight:600;margin-bottom:12px;border:1px solid #fecaca;text-align:left;"></div>

                        <input type="password" id="unifiedAuthInput" autocomplete="off" placeholder=""
                            style="width:100%;padding:11px;margin-bottom:16px;border:1.5px solid var(--border,#cbd5e1);border-radius:10px;font-size:16px;outline:none;text-align:center;background:var(--input-bg,#f8fafc);color:var(--text-primary,#0f172a);box-sizing:border-box;">
                        
                        <div style="display:flex;gap:10px;">
                            <button id="unifiedAuthCancel" style="flex:1;padding:10px;background:var(--bg-surface,#f1f5f9);color:var(--text-primary,#0f172a);border:1.5px solid var(--border,#cbd5e1);border-radius:10px;cursor:pointer;font-weight:600;font-size:0.9rem;">Cancel</button>
                            <button id="unifiedAuthSubmit" style="flex:1;padding:10px;background:var(--primary,#0284c7);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.9rem;box-shadow:0 4px 12px rgba(2,132,199,0.3);">Login</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(loginModal);
            }
            this.modalEl = loginModal;

            // 2. User Profile Modal
            let profileModal = document.getElementById('unifiedUserProfileModal');
            if (!profileModal) {
                profileModal = document.createElement('div');
                profileModal.id = 'unifiedUserProfileModal';
                profileModal.className = 'auth-modal-overlay';
                profileModal.style.display = 'none';
                profileModal.onclick = (e) => {
                    if (e.target === profileModal) this.closeUserProfileModal();
                };

                profileModal.innerHTML = `
                    <div class="auth-modal-card">
                        <div style="padding:14px 18px;background:var(--primary,#0284c7);color:white;display:flex;align-items:center;justify-content:space-between;position:relative;">
                            <span style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.95rem;">
                                <i class="fas fa-id-badge"></i> Employee Profile
                            </span>
                            <button id="unifiedProfileClose" class="auth-close-btn" style="background:none;border:none;color:white;font-size:1.3rem;cursor:pointer;line-height:1;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;" title="Close">&times;</button>
                        </div>
                        <div style="padding:22px;text-align:center;">
                            <div style="width:64px;height:64px;border-radius:50%;background:rgba(37,99,235,0.12);color:var(--primary,#0284c7);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;border:2px solid rgba(37,99,235,0.3);box-shadow:0 4px 14px rgba(37,99,235,0.18);">
                                <i class="fas fa-user"></i>
                            </div>
                            <h3 id="unifiedProfileName" style="margin:0 0 4px;font-size:1.05rem;font-weight:700;text-transform:capitalize;">-</h3>
                            <p id="unifiedProfileCode" style="margin:0 0 4px;font-size:0.85rem;color:var(--text-muted,#64748b);font-weight:600;">-</p>
                            <p id="unifiedProfileEmail" style="margin:0 0 12px;font-size:0.8rem;color:var(--primary,#0284c7);font-weight:500;">-</p>
                            
                            <div id="unifiedProfileRole" style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:0.75rem;font-weight:800;letter-spacing:0.5px;margin-bottom:16px;">
                                USER
                            </div>

                            <div style="display:flex;flex-direction:column;gap:8px;">
                                <button id="unifiedProfileSwitch" style="width:100%;padding:10px;background:var(--bg-surface,#f8fafc);color:var(--primary,#0284c7);border:1px solid var(--border,#cbd5e1);border-radius:8px;cursor:pointer;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:6px;">
                                    <i class="fas fa-user-friends"></i> Switch User / Re-login
                                </button>
                                <button id="unifiedProfileLogout" style="width:100%;padding:10px;background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:6px;">
                                    <i class="fas fa-sign-out-alt"></i> Logout / Lock
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(profileModal);

                const closeBtn = profileModal.querySelector('#unifiedProfileClose');
                if (closeBtn) closeBtn.onclick = () => this.closeUserProfileModal();

                const switchBtn = profileModal.querySelector('#unifiedProfileSwitch');
                if (switchBtn) {
                    switchBtn.onclick = () => {
                        this.closeUserProfileModal();
                        this.promptLogin();
                    };
                }

                const logoutBtn = profileModal.querySelector('#unifiedProfileLogout');
                if (logoutBtn) {
                    logoutBtn.onclick = () => {
                        this.logout(true);
                    };
                }
            }
            this.profileModalEl = profileModal;
        }
    }

    // Create singleton instance
    const authInstance = new TabreedAuthManager();
    window.TabreedAuth = authInstance;

    // Export top-level global convenience aliases for seamless backwards-compatibility
    window.promptLogin = function(sourcePage, cb) {
        authInstance.promptLogin(sourcePage, cb);
    };

    window.applyUserLogin = function(user, showToast = true, sourcePage = '') {
        authInstance.applyUserLogin(user, showToast, sourcePage);
    };

    window.logoutUser = function(showToast = true) {
        authInstance.logout(showToast);
    };

    window.verifyUserLogin = function(pass) {
        return authInstance.verifyUserLogin(pass);
    };

    window.verifyAdminPassword = function(pass) {
        return authInstance.verifyUserLogin(pass);
    };

    window.openUserProfileModal = function() {
        authInstance.openUserProfileModal();
    };

    window.closeUserProfileModal = function() {
        authInstance.closeUserProfileModal();
    };

    window.recordUserLoginToMixData = function(user, sourcePage) {
        authInstance.recordUserLoginToMixData(user, sourcePage);
    };

    window.isDeveloper = function(user) {
        return authInstance.isDeveloper(user);
    };

    window.isSupervisor = function(user) {
        return authInstance.isSupervisor(user);
    };

    window.isSuperAdmin = function(user) {
        return authInstance.isSuperAdmin(user);
    };

    window.isUserAdmin = function(user) {
        return authInstance.isUserAdmin(user);
    };

    window.getEmployees = function() {
        return authInstance.getEmployees();
    };

})(window, document);
