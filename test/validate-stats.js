// 验证: 首页统计联动 + seed 功能
const http = require('http');

function post(path, body, cb) {
  const data = JSON.stringify(body);
  const opt = {
    hostname: 'localhost', port: 3000, path: path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  };
  const r = http.request(opt, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => cb(res.statusCode, body));
  });
  r.on('error', (e) => console.log('ERR: ' + e.message));
  r.write(data); r.end();
}

function getJson(path, cb) {
  http.get('http://localhost:3000' + path, (res) => {
    let b = '';
    res.on('data', (c) => b += c);
    res.on('end', () => cb(res.statusCode, b));
  });
}

console.log('\n======== 验证: 首页统计 & seed 联动 ========\n');

// 步骤 1: 先检查当前统计
getJson('/api/stats', (s, body) => {
  try {
    const d = JSON.parse(body);
    console.log('[1] 当前统计: status=' + s + ', total_shops=' + d.stats.total_shops + ', success=' + d.success);

    // 步骤 2: 生成 10,000 条测试数据 (replace 模式)
    console.log('\n[2] 发送 POST /api/shops/seed (10,000 条, replace 模式)...');
    const t0 = Date.now();
    post('/api/shops/seed', { count: 10000, mode: 'replace' }, (s, body) => {
      try {
        const d = JSON.parse(body);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log('    → status=' + s + ', success=' + d.success + ', inserted=' + d.inserted + ', batch_size=' + d.batch_size + ', elapsed=' + elapsed + 's');
        if (d.errors && d.errors.length) console.log('    → 错误: ' + d.errors.slice(0, 3).join('; '));

        // 步骤 3: 再次获取统计, 确认 total_shops 与 inserted 一致
        getJson('/api/stats', (s, body) => {
          try {
            const d2 = JSON.parse(body);
            console.log('\n[3] seed 后统计: total_shops=' + d2.stats.total_shops);
            const match = d2.stats.total_shops === 10000;
            console.log('    → 统计联动检查: ' + (match ? '✅ 通过 (total_shops=10000)' : '❌ 失败 (expected 10000, got ' + d2.stats.total_shops + ')'));

            // 步骤 4: 检查健康检查
            getJson('/api/health', (s, body) => {
              try {
                const d3 = JSON.parse(body);
                console.log('\n[4] 健康检查: status=' + d3.status + ', shops_total=' + d3.shops_total);

                console.log('\n======== 测试完成 ========\n');
              } catch (e) { console.log('健康检查解析失败: ' + e.message); }
            });
          } catch (e) { console.log('统计解析失败: ' + e.message); }
        });
      } catch (e) { console.log('seed 响应解析失败: ' + e.message + ', body=' + body.substring(0, 200)); }
    });
  } catch (e) { console.log('初始统计解析失败: ' + e.message + ', body=' + body.substring(0, 200)); }
});
