// 检查 backup_status API 实际返回的完整配置字段
const http = require('http');

http.get('http://127.0.0.1:3000/api/backup/status', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const obj = JSON.parse(data);
    console.log('=== /api/backup/status 完整配置字段 ===');
    console.log('config keys: ' + Object.keys(obj.config).join(', '));
    console.log(JSON.stringify(obj.config, null, 2));
    console.log('\n历史备份最近 3 条:');
    obj.status.history.slice(0, 3).forEach((h, i) => {
      console.log('  [' + (i + 1) + '] ' + h.file_name + ' (' + h.size_kb + ' KB, ' + h.duration_ms + ' ms, ' + h.type + ')');
    });
    console.log('\n✅ 配置读取正常！');
  });
}).on('error', (e) => { console.error('❌ ' + e.message); });
