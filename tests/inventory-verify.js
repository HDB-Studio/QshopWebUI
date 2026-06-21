// 库存数据修复验证脚本
const BASE = 'http://127.0.0.1:3000';

async function apiCall(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  return await res.json();
}

async function main() {
  console.log('========== 库存数据修复验证 ==========\n');

  // 1. 登录获取 session
  const login = await apiCall('/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin' } });
  const sid = login.session_id;
  console.log('【1】登录: ' + (login.success ? '✅ session=' + sid.substring(0, 8) + '...' : '❌ ' + login.error));
  const headers = { 'x-session': sid };

  // 2. 等待数据库写入完成
  console.log('\n等待 QSFilter 数据写入数据库...');
  await new Promise(r => setTimeout(r, 1500));

  // 3. 内存缓存统计
  console.log('\n【2】内存缓存统计 (GET /api/stats)');
  const stats = await apiCall('/stats', { headers });
  console.log('   source: ' + stats.source);
  console.log('   total_shops: ' + stats.stats.total_shops);
  console.log('   total_materials: ' + stats.stats.total_materials);

  // 4. 数据库实时统计
  console.log('\n【3】数据库实时统计 (GET /api/stats/realtime)');
  const rt = await apiCall('/stats/realtime', { headers });
  console.log('   success: ' + rt.success + ', source: ' + rt.source);
  console.log('   DB shops: ' + rt.stats.total_shops + ', memory shops: ' + rt.memory.total_shops);
  if (rt.stats.total_shops === rt.memory.total_shops) {
    console.log('   ✅ 数据库与内存缓存一致');
  } else {
    console.log('   ⚠️  数据库与内存缓存不一致（首次同步可能还在写入中）');
  }

  // 5. 检查 /api/shops 中的 quantity 字段
  console.log('\n【4】GET /api/shops — 检查数量字段');
  const shops = await apiCall('/shops?show_all=true&pageSize=5', { headers });
  console.log('   total: ' + shops.total);
  if (shops.results && shops.results.length > 0) {
    shops.results.slice(0, 3).forEach((s, i) => {
      console.log('   [' + (i+1) + '] ' + s.material + '/' + s.shop_type + ' | quantity=' + s.quantity + ' | is_system=' + s.is_system_shop);
    });
  }

  // 6. 检查 /api/items/:material 中的库存语义字段
  console.log('\n【5】GET /api/items/:material — 检查库存语义化');
  const firstMat = shops.results[0].material;
  const item = await apiCall('/items/' + firstMat + '?show_all=true', { headers });
  console.log('   material: ' + item.material + ', total_shops: ' + item.total_shops);
  if (item.shops && item.shops.length > 0) {
    item.shops.slice(0, 2).forEach((s, i) => {
      console.log('   [' + (i+1) + '] ' + s.shop_type + ' | stock_text=' + s.stock_text + ' | quantity_num=' + s.quantity_num + ' | is_infinite=' + s.is_infinite + ' | is_low_stock=' + s.is_low_stock);
    });
  }

  // 7. 关键验证：quantity 字段是否不再是 "2000"（虚构的默认上限）
  console.log('\n【6】关键验证：quantity 字段真实性检查');
  let fakeCount = 0;
  let nullCount = 0;
  let realCount = 0;
  if (shops.results) {
    shops.results.forEach(s => {
      const q = s.quantity;
      if (q === null || q === undefined || q === '') nullCount++;
      else if (Number(q) === 2000) fakeCount++;
      else realCount++;
    });
  }
  console.log('   null/未设置: ' + nullCount + ' 家');
  console.log('   实际数值: ' + realCount + ' 家');
  console.log('   2000 (虚构默认值): ' + fakeCount + ' 家');
  if (fakeCount === 0) {
    console.log('   ✅ 没有再出现伪造的 2000 库存默认值！');
  } else {
    console.log('   ⚠️  仍有 ' + fakeCount + ' 家显示 2000，可能是 QSFilter 返回的真实数据');
  }

  console.log('\n========== 验证完成 ==========\n');
}

main().catch(e => { console.error('异常:', e.message); process.exit(1); });
