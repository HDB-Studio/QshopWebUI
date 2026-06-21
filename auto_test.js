const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 启动服务器
const serverProc = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
serverProc.stdout.on('data', (d) => { serverOutput += d.toString(); });
serverProc.stderr.on('data', (d) => { serverOutput += d.toString(); });

serverProc.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        port: parseInt(u.port),
        path: u.pathname + u.search,
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      const req = http.request(opts, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      });
      req.on('error', (e) => resolve({ status: -1, body: e.message }));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      resolve({ status: -2, body: e.message });
    }
  });
}

const tests = [
  ['首页 /', 'http://127.0.0.1:3000/', 'GET', null, 200],
  ['敏感文件 .env', 'http://127.0.0.1:3000/.env', 'GET', null, 403],
  ['敏感文件 server.js', 'http://127.0.0.1:3000/server.js', 'GET', null, 403],
  ['敏感文件 package.json', 'http://127.0.0.1:3000/package.json', 'GET', null, 403],
  ['敏感文件 package-lock.json', 'http://127.0.0.1:3000/package-lock.json', 'GET', null, 403],
  ['静态资源 css', 'http://127.0.0.1:3000/css/style.css', 'GET', null, 200],
  ['/api/config', 'http://127.0.0.1:3000/api/config', 'GET', null, 200],
  ['/api/health (不应泄露数据库主机)', 'http://127.0.0.1:3000/api/health', 'GET', null, 200],
  ['XSS Payload', 'http://127.0.0.1:3000/api/shops?q=' + encodeURIComponent("<script>alert('xss')</script>"), 'GET', null, 403],
  ['SQL Injection', 'http://127.0.0.1:3000/api/shops?q=' + encodeURIComponent("' OR 1=1--"), 'GET', null, 403],
  ['路径穿越攻击', 'http://127.0.0.1:3000/api/../../etc/passwd', 'GET', null, 403],
  ['命令注入尝试', 'http://127.0.0.1:3000/api/shops?q=' + encodeURIComponent("; ls -la;"), 'GET', null, 403],
  ['PUT /api/settings/admin_password (越权尝试)', 'http://127.0.0.1:3000/api/settings/admin_password', 'PUT', JSON.stringify({ value: 'hacked' }), 403],
  ['API Token 空绕过', 'http://127.0.0.1:3000/api/shops?limit=1', 'GET', null, 200],
  ['普通查询 /api/shops', 'http://127.0.0.1:3000/api/shops?limit=2', 'GET', null, 200]
];

// 等待服务器启动
setTimeout(async () => {
  let output = '\n=========== 🔐 渗透测试报告 ===========\n\n';
  let pass = 0, fail = 0;

  for (const [name, url, method, body, expect] of tests) {
    const r = await makeRequest(url, method, body);
    const ok = r.status === expect;
    if (ok) pass++; else fail++;
    const icon = ok ? 'PASS' : 'FAIL';
    output += '[' + icon + '] ' + name + '\n';
    output += '       HTTP ' + r.status + ' (期望 ' + expect + ')\n';
    if (!ok && r.body.length > 0) {
      output += '       响应: ' + r.body.replace(/\r?\n/g, ' ').substring(0, 120) + '\n';
    }
    output += '\n';
    await new Promise(r => setTimeout(r, 200));
  }

  output += '=========== 总结 ===========\n';
  output += '通过: ' + pass + ' / ' + tests.length + '\n';
  output += '失败: ' + fail + ' / ' + tests.length + '\n';
  output += '测试时间: ' + new Date().toISOString() + '\n';

  fs.writeFileSync(path.join(__dirname, 'test_result.txt'), output);
  console.log(output);

  // 清理
  try { serverProc.kill('SIGKILL'); } catch (e) {}
  setTimeout(() => process.exit(0), 500);
}, 3000);
