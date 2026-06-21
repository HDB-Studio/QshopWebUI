// 修复 app.js 中的字符串跨多行问题（\n 被当成了真实换行）
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'js', 'app.js');
let content = fs.readFileSync(file, 'utf8');

// 修复 CSV 部分的换行字符串
// 问题 1: "s.indexOf('\n')" 变成 "s.indexOf('" + "\n" + "')" 
// 问题 2: lines.join('\n') 中的 '\n' 变成真实换行
// 统一修复方案:
// 1) 把所有像 `') > -1) return '"' + s.replace(/"/g, '""') + '"'; return s; };` 
//    这样的 broken 字符串中的真实 \n 替换成 \n 字符字面量
// 2) 用更简单的方式重写这两处

// 方案: 用正则找到这两个问题行并替换
const brokenLines = content.split('\n');
const fixed = [];
let skipNextJoin = false;
for (let i = 0; i < brokenLines.length; i++) {
  const line = brokenLines[i];
  // 检测 broken 行 1: 以 "    const esc = (v) => { const s = v === null ..." 开头且后续有跨行字符串
  if (line.indexOf("const esc = (v) => {") > -1 && line.indexOf("return s; };") === -1 && brokenLines[i+1] && brokenLines[i+1].indexOf("') > -1) return '\"'") > -1) {
    // 合并这两行并修复
    fixed.push("        const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); if (s.indexOf(',') > -1 || s.indexOf('\"') > -1 || s.indexOf('\\n') > -1) return '\"' + s.replace(/\"/g, '\"\"') + '\"'; return s; };");
    i++; // 跳过下一行
    continue;
  }
  // 检测 broken 行 2: "        shops.forEach((s) => lines.push(headers.map((h) => esc(s[h])).join(',')));"
  // 接下来的 lines.join 也会 broken
  if (line.trim() === "});" && brokenLines[i-1] && brokenLines[i-1].indexOf("shops.forEach") > -1) {
    // 先 push 当前行
    fixed.push(line);
    continue;
  }
  // 修复: "        const blob = new Blob([lines.join(' " + "\n" + " ')], ...)"
  if (line.indexOf("const blob = new Blob") > -1 && (brokenLines[i+1] || '').trim() === "')], { type: 'text/csv;charset=utf-8' });") {
    fixed.push("        const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8' });");
    i++; // 跳过下一行
    continue;
  }
  // 修复: 类似 "text.split(/ \\r?\\n/) " 的 broken 正则（689行附近）
  if (line.indexOf("const rows = text.split(/") > -1 && line.indexOf(".filter(") === -1) {
    // 这行和下一行被分割
    const next = brokenLines[i+1] || '';
    fixed.push(line + next);
    i++;
    continue;
  }
  fixed.push(line);
}

content = fixed.join('\n');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ' + fixed.length + ' lines');

// 验证语法
try {
  new Function(content);
  console.log('Syntax OK');
} catch (e) {
  console.log('Syntax ERR:', e.message);
  // 打印出错行附近
  const m = String(e.message).match(/line (\d+)/i);
  if (m) {
    const ln = parseInt(m[1], 10);
    const lines = content.split('\n');
    for (let i = Math.max(0, ln - 3); i < Math.min(lines.length, ln + 3); i++) {
      console.log((i + 1) + ': ' + lines[i]);
    }
  }
}
