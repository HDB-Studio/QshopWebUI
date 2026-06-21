const http = require('http');
function testAPI(method, path, body, done) {
  const postData = body ? JSON.stringify(body) : null;
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: path,
    method: method,
    headers: postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      try {
        const obj = JSON.parse(data);
        done(method + ' ' + path, obj);
      } catch (e) {
        done(method + ' ' + path, { raw: data.substring(0, 150), statusCode: res.statusCode, data: data.length });
      }
    });
  });
  req.on('error', (e) => done(method + ' ' + path, { error: e.message }));
  if (postData) req.write(postData);
  req.end();
}

const tests = [
  { m: 'POST', p: '/webhook/shop-create', body: { shop_id: 88888, material: 'DIAMOND_SWORD', item_name: 'Diamond Sword', owner_name: 'TestUser', world: 'world', x: 0, y: 64, z: 0, price: 150.0, stacking_amount: 1, shop_type: 'SELLING', price_reasonable: true } },
  { m: 'POST', p: '/webhook/shop-price', body: { shop_id: 88888, old_price: 150.0, new_price: 125.0, shop: { shop_id: 88888, material: 'DIAMOND_SWORD', item_name: 'Diamond Sword', owner_name: 'TestUser', world: 'world', x: 0, y: 64, z: 0, price: 125.0, stacking_amount: 1, shop_type: 'SELLING' } } },
  { m: 'GET', p: '/api/shops/88888' },
  { m: 'POST', p: '/webhook/shop-delete', body: { shop_id: 88888 } },
  { m: 'GET', p: '/api/shops/88888' },
  { m: 'GET', p: '/api/price/diamond_sword' },
  { m: 'GET', p: '/api/items?sort=shops_desc' },
];

let i = 0, passed = 0;
function next() {
  if (i >= tests.length) {
    console.log('\n========== 测试完成 ==========');
    console.log('通过:', passed + '/' + tests.length);
    return;
  }
  const t = tests[i];
  testAPI(t.m, t.p, t.body, (desc, r) => {
    const isGood = r && r.success !== false && r.statusCode !== 404 && r.statusCode !== 500;
    console.log((isGood ? '[OK]  ' : '[?]  ') + desc);
    if (r.total !== undefined) console.log('  total:', r.total);
    if (r.shop) console.log('  shop found:', !!r.shop);
    if (r.material) console.log('  material:', r.material);
    if (r.qs_available !== undefined) console.log('  qs_available:', r.qs_available);
    if (r.note) console.log('  note:', r.note);
    if (r.statusCode !== undefined) console.log('  status:', r.statusCode, 'bytes:', r.data);
    if (isGood) passed++;
    i++;
    setTimeout(next, 300);
  });
}
next();
