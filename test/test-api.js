// 快速测试所有关键 API 端点
const http = require('http');

function apiCall(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
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

async function run() {
  console.log('=== QshopWebUI 功能测试 ===\n');

  // 1. 测试健康检查
  console.log('[1] 健康检查:');
  const health = await apiCall('/api/health');
  console.log('  状态:', health.status);
  console.log('  结果:', health.body);

  // 2. 测试认证状态
  console.log('\n[2] 认证状态:');
  const authStatus = await apiCall('/api/auth/status');
  console.log('  状态:', authStatus.status);
  console.log('  结果:', JSON.stringify(authStatus.body, null, 2));

  // 3. 测试统计数据
  console.log('\n[3] 统计数据:');
  const stats = await apiCall('/api/stats');
  console.log('  状态:', stats.status);
  console.log('  结果:', JSON.stringify(stats.body, null, 2));

  // 4. 测试物品分类
  console.log('\n[4] 物品分类:');
  const materials = await apiCall('/api/materials');
  console.log('  状态:', materials.status);
  console.log('  数量:', materials.body && materials.body.materials ? materials.body.materials.length : 'N/A');

  // 5. 测试登录 (默认密码 admin123)
  console.log('\n[5] 管理员登录 (测试默认密码):');
  const login = await apiCall('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  console.log('  状态:', login.status);
  console.log('  成功:', login.body && login.body.success);
  let sessionId = null;
  if (login.body && login.body.success) {
    sessionId = login.body.session_id;
    console.log('  会话 ID:', sessionId.slice(0, 16) + '...');
  }

  // 6. 测试已认证的状态检查
  if (sessionId) {
    console.log('\n[6] 带认证的状态检查:');
    const authStatus2 = await apiCall('/api/auth/status', {
      headers: { 'x-session': sessionId }
    });
    console.log('  状态:', authStatus2.status);
    console.log('  已认证:', authStatus2.body && authStatus2.body.authenticated);
  }

  // 7. 测试 seed (需要管理员)
  console.log('\n[7] seed 端点权限测试:');
  const seedNoAuth = await apiCall('/api/shops/seed', {
    method: 'POST',
    body: { count: 100 }
  });
  console.log('  无认证访问: 状态', seedNoAuth.status, JSON.stringify(seedNoAuth.body));

  if (sessionId) {
    const seedWithAuth = await apiCall('/api/shops/seed', {
      method: 'POST',
      body: { count: 100 },
      headers: { 'x-session': sessionId }
    });
    console.log('  已认证访问: 状态', seedWithAuth.status, JSON.stringify(seedWithAuth.body));
  }

  // 8. 测试登出
  if (sessionId) {
    console.log('\n[8] 登出:');
    const logout = await apiCall('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-session': sessionId }
    });
    console.log('  状态:', logout.status);
    console.log('  成功:', logout.body && logout.body.success);
  }

  console.log('\n=== 测试完成 ===');
}
run().catch(console.error);
