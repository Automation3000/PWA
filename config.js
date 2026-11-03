// TABREED - Centralized Configuration Module
(function() {
    'use strict';
    var APP_CONFIG = {
        API: {
            GAS_BASE_URL: "https://script.google.com/macros/s/AKfycbwnUqgWqfPwnPLtmsSXvXfqNj66wcOjVoft3ou_t4RDBQ-Iscyp3wuiv45Z1o9UND6OZQ/exec",
            OP_REQUEST_GAS_URL: "https://script.google.com/macros/s/AKfycby_XKC1cV1VaeqKB2MbQgmRSOYmcxQI0v-5qcAAKhFczNOwU3GsindACIkuawzQZN4/exec",
            MIX_DATA_GAS_URL: "https://script.google.com/macros/s/AKfycby3rLk9ihwFSTXmDnp0suNtsxNRfZntql7rrPzB2u-l8vYVSMpZyDwOt7kkv_LstERijQ/exec",
            PWA_DRIVE_FILE_ID: "1AlvVbRj3DOQIMOQ2DaWikRoOlilJMmlX"
        },
        SYNC: {
            MAX_RETRIES: 3,
            AUTO_SYNC_INTERVAL: 60000 // 1 minute
        },
        FEATURES: {
            DARK_MODE: true,
            OFFLINE_FIRST: true,
            BETA_TOOLS: false
        }
    };

    if (typeof window !== 'undefined') {
        window.CONFIG = APP_CONFIG;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.CONFIG = APP_CONFIG;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = APP_CONFIG;
    }
    console.log("Config loaded successfully.");
})();
