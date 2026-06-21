const http = require('http');

function getJson(path, done) {
  http.get('http://localhost:3000' + path, function(res) {
    var b = '';
    res.on('data', function(c) { b += c; });
    res.on('end', function() { done(b); });
  });
}

function putJson(path, bodyObj, done) {
  var body = JSON.stringify(bodyObj);
  var opt = { hostname: 'localhost', port: 3000, path: path, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } };
  var req = http.request(opt, function(res) {
    var b = '';
    res.on('data', function(c) { b += c; });
    res.on('end', function() { done(res.statusCode, b); });
  });
  req.on('error', function(e) { console.log('ERR: ' + e.message); });
  req.write(body); req.end();
}

// 1. health 检查
getJson('/api/health', function(d) {
  try {
    var o = JSON.parse(d);
    console.log('[1] health keys: ' + Object.keys(o).join(', '));
    console.log('    values: ' + JSON.stringify(o));
  } catch (e) { console.log('[1] error: ' + e.message); }
});

// 2. 搜索
setTimeout(function() {
  getJson('/api/shops?q=diamond&pageSize=3', function(d) {
    try {
      var o = JSON.parse(d);
      console.log('[2] shops keys: ' + Object.keys(o).join(', '));
      console.log('    total: ' + o.total);
      var arr = o.data || o.shops;
      if (Array.isArray(arr) && arr.length > 0) {
        console.log('    first item: ' + JSON.stringify(arr[0]).substring(0, 200));
      } else {
        console.log('    full: ' + JSON.stringify(o).substring(0, 300));
      }
    } catch (e) { console.log('[2] error: ' + e.message); }
  });
}, 2000);

// 3. 密码变更
setTimeout(function() {
  putJson('/api/auth/change-password', { current_password: 'admin123', new_password: 'VerySecure@2026!' }, function(status, b) {
    console.log('[3] change-password status=' + status + ' -> ' + b.substring(0, 300));
  });
}, 4000);
