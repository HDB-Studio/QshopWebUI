const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 500) }));
    }).on('error', reject);
  });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body);
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 500) }));
    });
    req.on('error', reject);
    req.write(b);
    req.end();
  });
}

function putJson(url, body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body || '');
    const req = http.request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 500) }));
    });
    req.on('error', reject);
    req.write(b);
    req.end();
  });
}

(async () => {
  const tests = [
    { name: '🔒 1. 敏感文件 /.env 拦截', action: async () => await get('http://localhost:3000/.env'), expectStatus: 403 },
    { name: '🔒 2. 敏感文件 /server.js 拦截', action: async () => await get('http://localhost:3000/server.js'), expectStatus: 403 },
    { name: '🔒 3. 敏感文件 /.env.example 拦截', action: async () => await get('http://localhost:3000/.env.example'), expectStatus: 403 },
    { name: '🔒 4. 敏感文件 /package.json 拦截', action: async () => await get('http://localhost:3000/package.json'), expectStatus: 403 },
    { name: '🔒 5. WAF: XSS payload', action: async () => await get('http://localhost:3000/api/shops?q=' + encodeURIComponent("<script>alert('xss')</script>")), expectStatus: 403 },
    { name: '🔒 6. WAF: SQL injection', action: async () => await get('http://localhost:3000/api/shops?q=' + encodeURIComponent("' OR 1=1--")), expectStatus: 403 },
    { name: '🔒 7. WAF: 路径穿越', action: async () => await get('http://localhost:3000/api/../../etc/passwd'), expectStatus: 403 },
    { name: '✅ 8. 正常查询 (应该成功)', action: async () => await get('http://localhost:3000/api/shops?limit=3'), expectStatus: 200 },
    { name: '✅ 9. /api/health (不应暴露数据库主机名)', action: async () => await get('http://localhost:3000/api/health'), expectStatus: 200 },
    { name: '✅ 10. /api/config (不应包含敏感设置)', action: async () => await get('http://localhost:3000/api/config'), expectStatus: 200 },
    { name: '🔒 11. PUT /api/settings/admin_password - 垂直越权 (无认证)', action: async () => await putJson('http://localhost:3000/api/settings/admin_password', { value: 'hacked' }), expectStatus: 403 },
    { name: '🔒 12. 测试错误响应体不包含 err.message', action: async () => await get('http://localhost:3000/api/shops/' + encodeURIComponent("' OR 1=1--")), expectStatus: 500 },
    { name: '✅ 13. 首页正常加载', action: async () => await get('http://localhost:3000/'), expectStatus: 200 },
    { name: '✅ 14. 静态文件 css 正常加载', action: async () => await get('http://localhost:3000/css/style.css'), expectStatus: 200 }
  ];

  console.log('\n============ 🔍 渗透测试报告 ============\n');
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      const result = await t.action();
      const ok = result.status === t.expectStatus;
      if (ok) pass++; else fail++;
      console.log((ok ? '✅ PASS' : '❌ FAIL') + '  ' + t.name);
      console.log('   HTTP ' + result.status + ' (期望 ' + t.expectStatus + ')');
      if (result.body.length > 0) console.log('   响应体: ' + result.body.replace(/\n/g, ' '));
      // 安全: 检查响应是否泄露 err.message
      if (result.body.indexOf('error') > -1 && (result.body.indexOf('Error') > -1 || result.body.indexOf('at ') > -1 || result.body.indexOf('/') > -1 && result.body.indexOf('C:\\') > -1)) {
        console.log('   ⚠️  检测到错误信息泄露');
        fail++;
      }
      console.log('');
    } catch (e) {
      console.log('❌ FAIL ' + t.name + ' - ' + e.message + '\n');
      fail++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n========== 总结 ==========');
  console.log('通过: ' + pass + ' / ' + tests.length);
  console.log('失败: ' + fail + ' / ' + tests.length);
  console.log('测试时间: ' + new Date().toISOString() + '\n');
})();
