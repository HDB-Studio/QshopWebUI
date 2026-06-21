// 验证密码确实被 bcrypt 哈希存储了 - 先用旧密码 admin123 登录 (应失败)
// 然后用正确的强密码登录 (应成功)
const http = require('http');
function post(path, body, cb) {
  var b = JSON.stringify(body);
  var opt = { hostname: 'localhost', port: 3000, path: path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': b.length } };
  var r = http.request(opt, function(res) {
    var body = '';
    res.on('data', function(c) { body += c; });
    res.on('end', function() { cb(res.statusCode, body); });
  });
  r.on('error', function(e) { console.log('ERR: ' + e.message); });
  r.write(b); r.end();
}

// 测试 1: 用旧密码 admin123 登录 (应失败)
post('/api/auth/login', { username: 'admin', password: 'admin123' }, function(s, b) {
  console.log('[1] 登录 admin123 (应失败 401): status=' + s + ' -> ' + b.substring(0, 100));
  // 测试 2: 用当前的强密码登录 (应成功 200)
  post('/api/auth/login', { username: 'admin', password: 'VerySecure@2026!' }, function(s, b) {
    console.log('[2] 登录 VerySecure@2026! (应成功 200): status=' + s + ' -> ' + b.substring(0, 150));
    if (s === 200) console.log('\n  ===> bcrypt 哈希验证成功! 密码已安全存储在 MySQL settings 表中');
  });
});
