const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'js', 'app.js');
const c = fs.readFileSync(file, 'utf8');
try {
  new Function(c);
  console.log('OK');
} catch (e) {
  console.log('ERR:', e.message);
  const lines = c.split('\n');
  const m = String(e.message).match(/(\d+)/);
  if (m) {
    const ln = parseInt(m[1], 10);
    for (let i = Math.max(0, ln - 3); i < Math.min(lines.length, ln + 3); i++) {
      console.log((i + 1) + ': ' + JSON.stringify(lines[i].substring(0, 150)));
    }
  }
}
