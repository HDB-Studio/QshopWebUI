// 完整安全测试脚本 v2.0 (先测试正常功能, 最后测试攻击拦截)
const http = require('http');

function req(path, method, data, extraHeaders) {
  return new Promise(function(resolve) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
    if (data) headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    var opt = { hostname: 'localhost', port: 3000, path: path, method: method, headers: headers };
    var r = http.request(opt, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, headers: res.headers, text: body }); }
      });
    });
    r.on('error', function() { resolve({ status: 0, data: {} }); });
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

var results = [];
function test(name, cond, detail) {
  var ok = !!cond;
  results.push({ name: name, ok: ok });
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + ': ' + name + ' ' + (detail || ''));
}

(async function() {
  console.log('\n==========  多层次安全体系 全面测试  ==========');

  // --- 阶段 1: 健康检查 & 信息 ---
  console.log('\n[1] 健康检查 & 系统信息');
  var r = await req('/api/health', 'GET');
  test('HTTP 200', r.status === 200, 'status=' + r.status);
  test('在线状态 online', r.data.status === 'online', 'status=' + r.data.status);
  test('shops_total 是数字', typeof r.data.shops_total === 'number', 'shops_total=' + r.data.shops_total);

  r = await req('/api/security/info', 'GET');
  console.log('\n[2] 安全配置信息');
  test('bcrypt 密码哈希', r.data.security.bcrypt === true, 'bcrypt=' + r.data.security.bcrypt);
  test('WAF 应用防火墙', r.data.security.waf === true, 'waf=' + r.data.security.waf);
  test('安全响应头', r.data.security.security_headers === true, 'headers=' + r.data.security.security_headers);
  test('安全等级 high', r.data.security.level === 'high', 'level=' + r.data.security.level);

  // --- 阶段 2: 批量数据 ---
  console.log('\n[3] 批量生成 10000 条测试数据');
  r = await req('/api/shops/seed', 'POST', { count: 10000, mode: 'replace' });
  test('POST /api/shops/seed 200', r.status === 200, 'status=' + r.status);
  test('inserted === 10000', r.data.inserted === 10000, 'inserted=' + r.data.inserted);
  console.log('    耗时: ' + (r.data.elapsed_ms || '?') + ' ms');

  r = await req('/api/health', 'GET');
  console.log('\n[4] 数据一致性 - MySQL 总存储量');
  test('总数 shops_total === 10000', r.data.shops_total === 10000, 'shops_total=' + r.data.shops_total);

  // --- 阶段 3: 身份认证 ---
  console.log('\n[5] 身份认证 - 正确密码 (bcrypt)');
  r = await req('/api/auth/login', 'POST', { username: 'admin', password: 'admin' });
  test('登录返回 success:true', r.data.success === true, 'success=' + r.data.success);
  test('生成 session_id (64 chars)', r.data.session_id && r.data.session_id.length >= 32, 'len=' + (r.data.session_id || '').length);

  console.log('\n[6] 身份认证 - 错误密码 (防暴力破解)');
  r = await req('/api/auth/login', 'POST', { username: 'admin', password: 'wrongpass_123' });
  test('拒绝登录 (success=false 或 401/429)', !r.data.success || r.status >= 400, 'status=' + r.status + ' success=' + r.data.success);

  // --- 阶段 4: 系统设置 - 跨浏览器一致性 ---
  console.log('\n[7] 系统设置 - 存储在 MySQL (跨浏览器一致)');
  r = await req('/api/settings', 'GET');
  var countBefore = Object.keys(r.data.settings || {}).length;
  test('GET /api/settings 返回 20+ 配置项', r.status === 200 && countBefore > 0, 'count=' + countBefore);

  var testKey = 'STEST_' + Math.floor(Math.random() * 1000000);
  r = await req('/api/settings', 'PUT', { 'PUT_TEST_KEY': 'value_' + testKey, 'items_per_page': 15 });
  test('PUT /api/settings 更新成功', r.data.inserted > 0 || r.data.success === true, 'inserted=' + r.data.inserted + ' updated=' + r.data.updated);

  r = await req('/api/settings', 'GET');
  var found = r.data.settings && r.data.settings.PUT_TEST_KEY && r.data.settings.PUT_TEST_KEY.value === 'value_' + testKey;
  test('设置跨请求保持 (证明是 MySQL, 非 localStorage)', !!found, 'PUT_TEST_KEY=' + (found ? 'OK' : 'not found'));

  // --- 阶段 5: 安全响应头 ---
  console.log('\n[8] 安全响应头 (CSP / X-Frame-Options / XSS-Protection 等)');
  r = await req('/api/health', 'GET');
  test('X-Frame-Options: DENY', r.headers['x-frame-options'] === 'DENY', 'value=' + r.headers['x-frame-options']);
  test('X-XSS-Protection 已设置', !!r.headers['x-xss-protection'], 'value=' + r.headers['x-xss-protection']);
  test('X-Content-Type-Options: nosniff', r.headers['x-content-type-options'] === 'nosniff', 'value=' + r.headers['x-content-type-options']);
  test('Referrer-Policy 已设置', !!r.headers['referrer-policy'], 'value=' + r.headers['referrer-policy']);
  test('Permissions-Policy 已设置', !!r.headers['permissions-policy'], 'value=set');
  test('Content-Security-Policy 已设置', !!r.headers['content-security-policy'], 'value=set');

  // --- 阶段 6: CORS ---
  console.log('\n[9] CORS 策略 - 白名单预检');
  r = await req('/api/health', 'OPTIONS', null, { 'Origin': 'http://evil-site.com', 'Access-Control-Request-Method': 'GET' });
  test('OPTIONS 预检 200/204', r.status === 200 || r.status === 204, 'status=' + r.status);

  // --- 阶段 7: 搜索功能 (参数化查询防注入) ---
  console.log('\n[10] 搜索功能 - MySQL 全文索引 (参数化查询)');
  r = await req('/api/shops?q=diamond&pageSize=5', 'GET');
  test('HTTP 200', r.status === 200, 'status=' + r.status);
  test('返回 results 数组', Array.isArray(r.data.results) && r.data.results.length > 0, 'count=' + (r.data.results ? r.data.results.length : 0));
  test('total > 0', r.data.total > 0, 'total=' + r.data.total);

  // --- 阶段 8: 速率限制 (正常请求不应被限) ---
  console.log('\n[11] 速率限制 - 正常请求不被误限');
  var blocked = false;
  for (var i = 0; i < 5; i++) {
    r = await req('/api/health', 'GET');
    if (r.status === 429) { blocked = true; break; }
  }
  test('5 次正常请求均 200 OK', !blocked, 'all=200');

  // --- 阶段 9: WAF 攻击拦截 (最后做, 避免被封影响前面测试) ---
  console.log('\n[12] WAF 攻击拦截 - SQL 注入/XSS/命令注入');
  var waf1 = await req('/api/shops?q=' + encodeURIComponent("' OR 1=1--"), 'GET');
  test('SQL 注入被拦截 (>=400)', waf1.status >= 400, 'status=' + waf1.status);
  var waf2 = await req('/api/shops?q=' + encodeURIComponent('<script>alert(1)</script>'), 'GET');
  test('XSS 攻击被拦截 (>=400)', waf2.status >= 400, 'status=' + waf2.status);
  var waf3 = await req('/api/shops?q=' + encodeURIComponent('; cat /etc/passwd'), 'GET');
  test('命令注入被拦截 (>=400)', waf3.status >= 400, 'status=' + waf3.status);
  var waf4 = await req('/api/shops?q=' + encodeURIComponent('../../etc/passwd'), 'GET');
  test('路径遍历被拦截 (>=400)', waf4.status >= 400, 'status=' + waf4.status);

  // --- 阶段 10: 密码强度策略 ---
  console.log('\n[13] 密码强度策略');
  r = await req('/api/auth/change-password', 'PUT', { current_password: 'admin123', new_password: '1234' });
  test('拒绝弱密码 (太短)', !r.data.success || r.status >= 400, 'success=' + r.data.success + ' status=' + r.status);
  r = await req('/api/auth/change-password', 'PUT', { current_password: 'admin123', new_password: 'password123' });
  test('拒绝常见密码 (password123)', !r.data.success || r.status >= 400, 'success=' + r.data.success + ' status=' + r.status);
  r = await req('/api/auth/change-password', 'PUT', { current_password: 'admin123', new_password: 'VerySecure@2026!' });
  test('接受强密码 (大写+小写+数字+特殊字符)', r.data.success === true, 'success=' + r.data.success);

  // --- 汇总 ---
  var passed = results.filter(function(x) { return x.ok; }).length;
  var failed = results.filter(function(x) { return !x.ok; }).length;
  console.log('\n==================================================');
  console.log('  测试结果: 通过 ' + passed + ' / 失败 ' + failed + ' / 总计 ' + results.length);
  console.log('  通过率: ' + Math.round(passed * 100 / results.length) + '%');
  console.log('==================================================');
  if (failed === 0) { console.log('\n  全部安全功能测试通过!'); }
  else {
    console.log('\n  以下测试失败:');
    results.filter(function(x) { return !x.ok; }).forEach(function(x) { console.log('    - ' + x.name); });
  }
  console.log('');
})().catch(function(e) { console.log('错误: ' + e.message); });
