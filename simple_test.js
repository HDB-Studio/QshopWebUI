const http = require('http');

function test(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: d.substring(0, 300) });
      });
    }).on('error', (e) => resolve({ status: -1, body: 'error: ' + e.message }));
  });
}

(async () => {
  const tests = [
    ['首页', 'http://localhost:3000/', 200],
    ['.env 拦截', 'http://localhost:3000/.env', 403],
    ['server.js 拦截', 'http://localhost:3000/server.js', 403],
    ['css 正常', 'http://localhost:3000/css/style.css', 200],
    ['api/health', 'http://localhost:3000/api/health', 200],
    ['api/config', 'http://localhost:3000/api/config', 200],
    ['XSS payload', 'http://localhost:3000/api/shops?q=' + encodeURIComponent("<script>alert(1)</script>"), 403],
    ['SQLi payload', 'http://localhost:3000/api/shops?q=' + encodeURIComponent("' OR 1=1--"), 403],
    ['正常 api/shops', 'http://localhost:3000/api/shops?limit=2', 200]
  ];

  console.log('\n======== 手动测试 ========\n');
  for (const [name, url, expect] of tests) {
    const r = await test(url);
    const ok = r.status === expect;
    console.log((ok ? '✅' : '❌') + ' ' + name + ' → HTTP ' + r.status + ' (期望 ' + expect + ')');
    if (r.body.length > 0) {
      console.log('   ' + r.body.replace(/\r?\n/g, ' ').substring(0, 150));
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\n');
})();
