// 测试服务器是否正在运行
const http = require('http');

function test(path) {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000' + path, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, path: path, ok: true }));
    });
    req.on('error', (e) => resolve({ status: 0, path: path, ok: false, error: e.message }));
    req.on('timeout', () => resolve({ status: 0, path: path, ok: false, error: 'timeout' }));
    req.end();
  });
}

(async () => {
  console.log('开始测试 http://127.0.0.1:3000 ...');
  const r1 = await test('/');
  console.log('  GET / -> HTTP ' + r1.status + (r1.ok ? ' ✅' : ' ❌ ' + (r1.error || '')));
  const r2 = await test('/api/health');
  console.log('  GET /api/health -> HTTP ' + r2.status + (r2.ok ? ' ✅' : ' ❌ ' + (r2.error || '')));
  const r3 = await test('/api/shops?pageSize=3');
  console.log('  GET /api/shops -> HTTP ' + r3.status + (r3.ok ? ' ✅' : ' ❌ ' + (r3.error || '')));
  const r4 = await test('/api/stats');
  console.log('  GET /api/stats -> HTTP ' + r4.status + (r4.ok ? ' ✅' : ' ❌ ' + (r4.error || '')));
  if (r1.ok && r1.status === 200) console.log('\n🎉 服务器正常运行！请在浏览器访问: http://localhost:3000');
  else console.log('\n⚠️  服务器响应异常，请检查 node server.js 是否仍在运行');
})();
