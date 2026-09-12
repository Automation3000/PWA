const fs = require('fs');

const indexContent = fs.readFileSync('index.html', 'utf8');

// Extract everything from :root { to the end of the themes
const startStr = ':root {';
const endStr = '/* ═══════════════════════════════════════════════════\n           ANIMATIONS';

const startIndex = indexContent.indexOf(startStr);
const endIndex = indexContent.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const themeCSS = indexContent.substring(startIndex, endIndex);
    fs.writeFileSync('themes.css', themeCSS, 'utf8');
    console.log("Successfully extracted themes to themes.css");
} else {
    console.error("Could not find theme boundaries in index.html");
}
