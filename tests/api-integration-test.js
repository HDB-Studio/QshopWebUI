// QshopWebUI v2 - API 综合测试脚本
// 使用: node tests\api-integration-test.js
async function test() {
  const base = 'http://localhost:3001';
  const results = [];
  function check(name, cond, detail) {
    const pass = Boolean(cond);
    console.log((pass ? '✅ ' : '❌ ') + name + (detail ? ' — ' + detail : ''));
    results.push({ name, pass, detail });
  }

  console.log('==========================================================');
  console.log('       QshopWebUI v2 - API 综合测试');
  console.log('==========================================================\n');

  // 1. 健康检查
  try {
    const r = await fetch(base + '/api/health');
    check('/api/health', r.ok, 'HTTP ' + r.status);
  } catch (e) { check('/api/health', false, e.message); }

  // 2. 物品列表（中文名称 + 出售/收购数）
  let firstMat = null;
  try {
    const r = await fetch(base + '/api/items?pageSize=3');
    const d = await r.json();
    const ok = d.success === true && Array.isArray(d.results) && d.results.length > 0;
    if (ok) firstMat = d.results[0].material;
    let detail = 'HTTP ' + r.status + ', count=' + (d.results ? d.results.length : 0);
    if (ok) {
      detail += '; first=' + d.results[0].material + ' → ' + d.results[0].shop_cn_name;
      detail += '; selling=' + d.results[0].selling_shop_count + ', buying=' + d.results[0].buying_shop_count;
    }
    check('/api/items 中文/类型聚合', ok, detail);
  } catch (e) { check('/api/items 中文/类型聚合', false, e.message); }

  // 3. 物品详情页 - 验证 is_system_shop / is_infinite / max_buy / max_stock
  try {
    if (!firstMat) throw new Error('无第一物品，跳过');
    const r = await fetch(base + '/api/items/' + firstMat + '?pageSize=3');
    const d = await r.json();
    const ok = Array.isArray(d.shops) && d.shops.length > 0;
    let detail = 'HTTP ' + r.status;
    if (ok) {
      detail += '; shops=' + d.shops.length;
      for (const s of d.shops) {
        detail += '\n   - ' + s.shop_type + ' / is_system=' + s.is_system_shop +
                  ' / quantity=' + s.quantity + ' / is_infinite=' + s.is_infinite +
                  ' / is_low_stock=' + s.is_low_stock + ' / max_buy=' + s.max_buy_quantity +
                  ' / max_stock=' + s.max_stock_capacity + ' / stock_text=' + s.stock_text;
      }
    }
    check('/api/items/:material 语义字段', ok, detail);
  } catch (e) { check('/api/items/:material 语义字段', false, e.message); }

  // 4. Webhook 事件接收（系统商店）
  try {
    const body = JSON.stringify({
      shop_id: 999999, material: 'DIAMOND_PICKAXE', item_name: '钻石镐',
      price: 500, stacking_amount: 1, shop_type: 'BUYING',
      owner_uuid: 'SYSTEM', owner_name: '[System] 官方商店',
      world: 'world', x: 0, y: 64, z: 0
    });
    const r = await fetch(base + '/webhook/shop-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const d = await r.json();
    const ok = d.success === true;
    const detail = 'HTTP ' + r.status + ' / received: ' + (d.received || 'n/a') +
                   ' / upserted: ' + (d.upserted || 'n/a');
    check('Webhook 系统商店推送', ok, detail);
  } catch (e) { check('Webhook 系统商店推送', false, e.message); }

  // 5. Webhook 事件接收（玩家商店 - 限制检查）
  try {
    const body = JSON.stringify({
      shop_id: 999998, material: 'APPLE', item_name: '苹果',
      price: 5, stacking_amount: 1, shop_type: 'SELLING',
      owner_uuid: 'PLAYER_01', owner_name: '玩家_小明',
      world: 'world', x: 10, y: 64, z: 10
    });
    const r = await fetch(base + '/webhook/shop-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const d = await r.json();
    const ok = d.success === true;
    const detail = 'HTTP ' + r.status + ' / received: ' + (d.received || 'n/a');
    check('Webhook 玩家商店推送', ok, detail);
  } catch (e) { check('Webhook 玩家商店推送', false, e.message); }

  // 6. /api/qsfilter/status - 检查 Webhook 计数器
  try {
    const r = await fetch(base + '/api/qsfilter/status');
    const d = await r.json();
    const ok = d.connected === true && typeof d.webhook === 'object';
    const detail = 'connected=' + d.connected + ', webhook.enabled=' + d.webhook.enabled +
                   ', event_count=' + d.webhook.event_count;
    check('QSFilter 状态接口', ok, detail);
  } catch (e) { check('QSFilter 状态接口', false, e.message); }

  console.log('\n==========================================================');
  const passed = results.filter(r => r.pass).length;
  console.log('  测试结果: ' + passed + ' / ' + results.length + ' 通过');
  if (passed === results.length) console.log('  ✅ 全部通过');
  console.log('==========================================================');
}

test().catch(e => { console.error('❌ 致命错误:', e); process.exit(1); });
