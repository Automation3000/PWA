// TABREED - Centralized Configuration Module
const CONFIG = {
    API: {
        GAS_BASE_URL: "https://script.google.com/macros/s/AKfycbw0nKm-j24HwBwVd2u9ji3gqEtQ7j2dtQZmqEd0oA15mmB7nHMtGYOgUfhMrL7TjEc8cQ/exec",
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
console.log("Config loaded successfully.");
