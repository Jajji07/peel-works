// Writes server/designs.json from assets/catalog.js so the server knows every design.
// Run after adding or renaming designs:   node tools/export-designs.js
const fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'assets', 'catalog.js'));
const { DESIGNS, CONFIG } = window.PW_CATALOG;
const out = { models: CONFIG.models, designs: Object.fromEntries(DESIGNS.map(d => [d.id, `${d.name} (${d.way})`])) };
fs.writeFileSync(path.join(__dirname, '..', 'server', 'designs.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${DESIGNS.length} designs to server/designs.json`);
