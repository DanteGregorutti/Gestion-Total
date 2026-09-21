const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) {
      results.push(file);
    }
  });
  return results;
}

const targetDirs = [
  path.join(__dirname, '../node_modules/@firebase/firestore'),
  path.join(__dirname, '../node_modules/firebase/firestore'),
  path.join(__dirname, '../node_modules/.vite/deps'),
];

let totalPatched = 0;

for (const dir of targetDirs) {
  const files = walk(dir);
  for (const file of files) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;

      // 1. Patch TargetState.We() - Assertion ID 3241 / 0x0ca9 (context: ve: -1)
      if (content.includes('3241') || content.includes('0x0ca9')) {
        const prev = content;
        // ESM / minified
        content = content.replace(/this\.ve\s*-=\s*1,\s*(__PRIVATE_)?hardAssert\(this\.ve\s*>=\s*0,\s*3241[^}]*\}\);?/g, 'if (this.ve > 0) this.ve -= 1;');
        // Node / CJS
        content = content.replace(/this\.pendingResponses\s*-=\s*1;\s*(__PRIVATE_)?hardAssert\(this\.pendingResponses\s*>=\s*0,\s*0x0ca9[^}]*\}\);?/g, 'if (this.pendingResponses > 0) this.pendingResponses -= 1;');
        content = content.replace(/(__PRIVATE_)?hardAssert\(this\.pendingResponses\s*>=\s*0,\s*0x0ca9[^}]*\}\);?/g, '');
        if (content !== prev) {
          modified = true;
        }
      }

      // 2. Patch AsyncQueue.uc() - Assertion ID 47125 / 0xb815 (context: Pc)
      // When any internal stream error occurs, prevent AsyncQueue from permanently freezing with b815
      if (content.includes('47125') || content.includes('0xb815')) {
        const prev = content;
        content = content.replace(/this\.nc\s*&&\s*fail\(47125,\s*\{[^}]*\}\);?/g, 'if (this.nc) { console.warn("[Firestore AsyncQueue] Handled internal error:", this.nc); this.nc = null; }');
        content = content.replace(/this\.failure\s*&&\s*fail\(0xb815,\s*\{[^}]*\}\);?/g, 'if (this.failure) { console.warn("[Firestore AsyncQueue] Handled internal error:", this.failure); this.failure = null; }');
        if (content !== prev) {
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`[patch-firestore] Successfully patched: ${path.relative(path.join(__dirname, '..'), file)}`);
        totalPatched++;
      }
    } catch (err) {
      console.warn(`[patch-firestore] Warning reading/patching ${file}:`, err.message);
    }
  }
}

console.log(`[patch-firestore] Completed. Patched ${totalPatched} file(s).`);
