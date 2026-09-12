const fs = require('fs');
let html = fs.readFileSync('Share_FeedBack.html', 'utf8');

const replacement = `
                        if (settingsStr) {
                            applyUserSettings(JSON.parse(settingsStr));
                        }
                        const btn = document.getElementById('header-login-btn');
                        if (btn) btn.style.display = 'none';
`;

html = html.replace(/if \(settingsStr\) \{\s*applyUserSettings\(JSON\.parse\(settingsStr\)\);\s*\}/, replacement.trim());
fs.writeFileSync('Share_FeedBack.html', html, 'utf8');
