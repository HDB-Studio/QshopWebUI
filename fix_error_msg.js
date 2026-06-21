// 批量修复 server.js 中的错误信息泄露
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server.js');
let content = fs.readFileSync(file, 'utf8');
let count = 0;

// 1. 替换 JSON 错误响应: { success: false, error: err.message } -> safeErr 版本
content = content.replace(/\{\s*success:\s*false,\s*error:\s*err\.message\s*\}/g, () => {
  count++;
  return '{ success: false, error: safeErr(err, \'操作失败\') }';
});
console.log('Replaced 1:', count, 'places');

// 2. 替换更简单模式: error: err.message,
content = content.replace(/error:\s*err\.message(,?)/g, (m, comma) => {
  count++;
  return 'error: safeErr(err, \'操作失败\')' + comma;
});
console.log('After 2, total:', count);

// 3. health 接口特殊处理
content = content.replace(/status:\s*'offline',\s*database:\s*'disconnected',\s*error:\s*err\.message/g, () => {
  count++;
  return 'status: \'offline\', database: \'disconnected\', error: safeErr(err, \'服务健康检查失败\')';
});

fs.writeFileSync(file, content, 'utf8');
console.log('Total fixed:', count);
