// 验证 QSDB 作用域修复：模拟浏览器环境
const vm = require('vm');
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/../js/db.js', 'utf8');

// 模拟浏览器环境
const sandbox = {
  window: {},
  document: { addEventListener: () => {} },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  fetch: async () => ({
    json: async () => ({ success: true, message: 'mock' }),
    text: async () => 'ok',
    ok: true
  }),
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.fetch = sandbox.fetch;
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;

const ctx = vm.createContext(sandbox);

try {
  vm.runInContext(code, ctx);
  const QSDB = sandbox.window.QSDB;
  console.log('✅ QSDB 已定义:', typeof QSDB === 'object' ? 'object OK' : 'NOT OBJECT');
  console.log('   getAdminConfig:', typeof QSDB.getAdminConfig);
  console.log('   setAdminConfig:', typeof QSDB.setAdminConfig);
  console.log('   restartServer:', typeof QSDB.restartServer);
  console.log('   getRealtimeStats:', typeof QSDB.getRealtimeStats);
  console.log('   search (existing):', typeof QSDB.search);
  console.log('   getAll (existing):', typeof QSDB.getAll);

  const allFuncs = Object.keys(QSDB).filter(k => typeof QSDB[k] === 'function').length;
  console.log('✅ 总函数数:', allFuncs);
  if (typeof QSDB.getAdminConfig === 'function' &&
      typeof QSDB.setAdminConfig === 'function' &&
      typeof QSDB.restartServer === 'function' &&
      typeof QSDB.getRealtimeStats === 'function') {
    console.log('\n🎉 修复验证通过：4 个管理员 API 函数已暴露到全局 QSDB');
  } else {
    console.log('\n❌ 修复验证失败：部分管理员 API 函数不可访问');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ 执行错误:', e.message);
  console.error(e.stack);
  process.exit(1);
}
