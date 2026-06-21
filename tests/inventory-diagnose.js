// 库存数据诊断脚本 - 检查数据库 vs 内存 vs QSFilter 的数据一致性
const BASE = 'http://127.0.0.1:3001';

async function apiCall(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  return await res.json();
}

async function diagnose() {
  console.log('========== 库存数据诊断报告 ==========\n');

  // 1. 从数据库读取
  console.log('【1/4】数据库实时统计 (GET /api/stats/realtime)');
  const realtime = await apiCall('/stats/realtime');
  if (realtime.success) {
    console.log('   source: ' + realtime.source);
    console.log('   total_shops: ' + realtime.stats.total_shops);
    console.log('   total_materials: ' + realtime.stats.total_materials);
    console.log('   selling_shops: ' + realtime.stats.selling_shops);
    console.log('   buying_shops: ' + realtime.stats.buying_shops);
    console.log('   内存对比 (cache): ' + JSON.stringify(realtime.memory));
    if (realtime.stats.total_shops !== realtime.memory.total_shops) {
      console.log('   ⚠️  警告: 数据库(' + realtime.stats.total_shops + ') vs 内存(' + realtime.memory.total_shops + ') 不一致');
    } else {
      console.log('   ✅ 数据库与内存一致');
    }
  } else {
    console.log('   ❌ 失败: ' + realtime.error);
  }

  // 2. 从内存缓存读取
  console.log('\n【2/4】内存缓存统计 (GET /api/stats)');
  const cache = await apiCall('/stats');
  if (cache.success) {
    console.log('   source: ' + cache.source);
    console.log('   total_shops: ' + cache.stats.total_shops);
    console.log('   total_materials: ' + cache.stats.total_materials);
    console.log('   last_sync_at: ' + new Date(cache.last_sync_at).toLocaleString());
    console.log('   last_update_at: ' + new Date(cache.last_update_at).toLocaleString());
  } else {
    console.log('   ❌ 失败: ' + cache.error);
  }

  // 3. 检查数据库中的实际商店数据
  console.log('\n【3/4】数据库中的商店数据 (管理员搜索)');
  const adminShops = await apiCall('/admin/shops/search?show_all=true&pageSize=50');
  if (adminShops.success) {
    console.log('   total: ' + adminShops.total);
    console.log('   数据库中商店数: ' + (adminShops.shops ? adminShops.shops.length : 0));
    if (adminShops.shops && adminShops.shops.length > 0) {
      // 检查 quantity 字段
      let qtySummary = { null: 0, zero: 0, positive: 0, negative: 0 };
      adminShops.shops.forEach(s => {
        const q = s.quantity;
        if (q === null || q === undefined || q === '') qtySummary.null++;
        else if (Number(q) < 0) qtySummary.negative++;
        else if (Number(q) === 0) qtySummary.zero++;
        else qtySummary.positive++;
      });
      console.log('   quantity 字段分布:');
      console.log('      null/空: ' + qtySummary.null + ' (' + Math.round(qtySummary.null / adminShops.shops.length * 100) + '%)');
      console.log('      负数: ' + qtySummary.negative + ' (' + Math.round(qtySummary.negative / adminShops.shops.length * 100) + '%)');
      console.log('      零: ' + qtySummary.zero + ' (' + Math.round(qtySummary.zero / adminShops.shops.length * 100) + '%)');
      console.log('      正数: ' + qtySummary.positive + ' (' + Math.round(qtySummary.positive / adminShops.shops.length * 100) + '%)');

      // 展示前5家详细信息
      console.log('   前 5 家商店数据库原始数据:');
      adminShops.shops.slice(0, 5).forEach((s, i) => {
        console.log('      [' + (i+1) + '] shop_id=' + s.shop_id + ', material=' + s.material + 
                    ', shop_type=' + s.shop_type + ', price=' + s.price + 
                    ', quantity=' + s.quantity + ', owner=' + s.owner_name);
      });
    }
  } else {
    console.log('   ❌ 失败 (可能需要管理员权限): ' + adminShops.error);
  }

  // 4. 检查 GET /api/shops 返回的内存数据中的 quantity 字段
  console.log('\n【4/4】内存缓存中商店数据 (GET /api/shops)');
  const memShops = await apiCall('/shops?show_all=true&pageSize=50');
  if (memShops.success) {
    console.log('   source: ' + memShops.source);
    console.log('   total: ' + memShops.total);
    console.log('   内存中商店数: ' + (memShops.results ? memShops.results.length : 0));
    if (memShops.results && memShops.results.length > 0) {
      // 检查 quantity 字段
      let qtySummary = { null: 0, zero: 0, positive: 0, negative: 0, inf: 0 };
      memShops.results.forEach(s => {
        const q = s.quantity;
        if (q === null || q === undefined || q === '') qtySummary.null++;
        else if (Number(q) < 0) qtySummary.negative++;
        else if (Number(q) === 0) qtySummary.zero++;
        else qtySummary.positive++;
      });
      console.log('   quantity 字段分布 (内存):');
      console.log('      null/空: ' + qtySummary.null);
      console.log('      负数: ' + qtySummary.negative);
      console.log('      零: ' + qtySummary.zero);
      console.log('      正数: ' + qtySummary.positive);

      // 展示前5家
      console.log('   前 5 家商店内存数据:');
      memShops.results.slice(0, 5).forEach((s, i) => {
        console.log('      [' + (i+1) + '] shop_id=' + s.shop_id + ', material=' + s.material + 
                    ', shop_type=' + s.shop_type + ', price=' + s.price + 
                    ', quantity=' + s.quantity + ', is_system_shop=' + s.is_system_shop);
      });
    }
  } else {
    console.log('   ❌ 失败: ' + memShops.error);
  }

  // 5. 检查 /api/items/:material 返回的增强字段
  console.log('\n【补充】GET /api/items/:material 返回的库存增强字段:');
  const firstMat = (memShops.results && memShops.results[0]) ? memShops.results[0].material : 'DIAMOND';
  const itemData = await apiCall('/items/' + firstMat + '?show_all=true');
  if (itemData.success && itemData.shops && itemData.shops.length > 0) {
    console.log('   material: ' + itemData.material);
    itemData.shops.slice(0, 3).forEach((s, i) => {
      console.log('      [' + (i+1) + '] shop_id=' + s.shop_id + 
                  ', stock_text=' + s.stock_text + 
                  ', quantity_num=' + s.quantity_num + 
                  ', is_infinite=' + s.is_infinite + 
                  ', is_low_stock=' + s.is_low_stock);
    });
  } else {
    console.log('   ❌ 失败: ' + (itemData.error || '无数据'));
  }

  console.log('\n========== 诊断完成 ==========\n');
}

diagnose().catch(e => { console.error('异常:', e.message); process.exit(1); });
