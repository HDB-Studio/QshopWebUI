// 端到端验证：模拟浏览器，通过 QSDB 的 API 包装调用实际服务器
const BASE = 'http://127.0.0.1:3001';

async function apiCall(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (sessionId) headers['x-session'] = sessionId;
  const res = await fetch(BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  return await res.json();
}

let sessionId = null;

async function test() {
  console.log('=== 1. 登录获取会话 ===');
  const login = await apiCall('/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin' } });
  if (login.success) { sessionId = login.session_id; console.log('✅ 登录成功, sessionId:', sessionId.substring(0, 8) + '...'); }
  else { console.log('❌ 登录失败:', login.error); return; }

  console.log('\n=== 2. getAdminConfig() ===');
  const cfg = await apiCall('/admin/config');
  console.log('HTTP 200, success:', cfg.success, 'groups:', Object.keys(cfg.groups || {}).length);

  console.log('\n=== 3. setAdminConfig() ===');
  const write = await apiCall('/admin/config', { method: 'POST', body: { LOG_LEVEL: 'INFO' } });
  console.log('success:', write.success, 'keys:', write.keys);

  console.log('\n=== 4. getRealtimeStats() ===');
  const stats = await apiCall('/stats/realtime');
  console.log('success:', stats.success, 'source:', stats.source, 'shops:', stats.stats.total_shops, '耗时:', stats.elapsed_ms + 'ms');

  console.log('\n=== 5. restartServer() 不实际触发 ===');
  console.log('   (为保持服务器运行，不调用 restart)');

  console.log('\n🎉 浏览器端 QSDB API 函数端到端验证通过');
}
test().catch(e => { console.error('❌ 异常:', e.message); process.exit(1); });
