// 测试 REQUIRE_AUTH=true 模式
const http = require('http');

function apiCall(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

// 启动一个临时的 require_auth=true 服务器
// 通过环境变量
const { spawn } = require('child_process');

async function test() {
  console.log('=== 测试 REQUIRE_AUTH=true 模式 ===\n');
  
  // 先杀掉可能的旧服务器
  try { await apiCall('/api/health'); } catch (e) {}
  
  // 启动测试服务器 (使用不同端口避免冲突)
  console.log('> 启动 require_auth=true 测试服务器 (端口 3001)...');
  const env = { ...process.env, PORT: '3001', REQUIRE_AUTH: 'true', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin123' };
  const server = spawn('node', ['server.js'], {
    env: env,
    cwd: 'c:\\Users\\chcct\\Desktop\\QshopWebUI'
  });

  server.stderr.on('data', (d) => {
    const str = d.toString();
    if (str.includes('ERROR') || str.includes('error')) console.log('SERVER ERR:', str.slice(0, 200));
  });

  // 等待服务器启动
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n> 测试各端点:');

  // 1. auth/status (未登录，require_auth=true)
  console.log('\n[1] 未登录状态下 auth/status:');
  const r1 = await apiCall('/api/auth/status');
  console.log('  状态:', r1.status);
  console.log('  authenticated:', r1.body && r1.body.authenticated);
  console.log('  require_auth:', r1.body && r1.body.require_auth);

  // 2. seed (未登录，require_auth=true) → 应该拒绝
  console.log('\n[2] 未登录状态下 seed:');
  const r2 = await apiCall('/api/shops/seed', {
    method: 'POST',
    body: { count: 50 }
  });
  console.log('  状态:', r2.status);
  console.log('  结果:', JSON.stringify(r2.body).slice(0, 100));

  // 3. 登录
  console.log('\n[3] 登录测试 (admin/admin123):');
  const r3 = await apiCall('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  console.log('  状态:', r3.status);
  console.log('  成功:', r3.body && r3.body.success);
  let sessionId = null;
  if (r3.body && r3.body.success) {
    sessionId = r3.body.session_id;
    console.log('  session_id (前16位):', sessionId.slice(0, 16));
  }

  // 4. 登录后的状态
  if (sessionId) {
    console.log('\n[4] 已登录状态下 auth/status:');
    const r4 = await apiCall('/api/auth/status', {
      headers: { 'x-session': sessionId }
    });
    console.log('  状态:', r4.status);
    console.log('  authenticated:', r4.body && r4.body.authenticated);
  }

  // 5. 登录后的 seed
  if (sessionId) {
    console.log('\n[5] 已登录状态下 seed:');
    const r5 = await apiCall('/api/shops/seed', {
      method: 'POST',
      body: { count: 50 },
      headers: { 'x-session': sessionId }
    });
    console.log('  状态:', r5.status);
    console.log('  成功:', r5.body && r5.body.success);
    if (r5.body && r5.body.success) console.log('  插入:', r5.body.inserted);
  }

  // 6. 错误密码测试
  console.log('\n[6] 错误密码测试:');
  const r6 = await apiCall('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'wrongpassword' }
  });
  console.log('  状态:', r6.status);
  console.log('  成功:', r6.body && r6.body.success);

  // 清理
  console.log('\n> 停止测试服务器...');
  server.kill();
  console.log('\n=== 测试完成 ===');
}
test().catch(console.error);
