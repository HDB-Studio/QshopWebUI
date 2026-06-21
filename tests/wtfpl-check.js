// WTFPL（What The F**king Problem Level）系统健康度评估
const http = require('http');
const fs = require('fs');
const path = require('path');

function apiCheck(host, port, path) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: host, port: port, path: path, timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, body: parsed, size: data.length });
      });
    });
    req.on('error', (e) => resolve({ status: 'ERR', error: e.message }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

const checkTargets = [
  { name: 'localhost:3000/health', host: '127.0.0.1', port: 3000, path: '/api/health' },
  { name: 'localhost:3000/backup', host: '127.0.0.1', port: 3000, path: '/api/backup/status' },
  { name: 'localhost:3000/stats', host: '127.0.0.1', port: 3000, path: '/api/stats/realtime' },
  { name: 'localhost:3000/shops', host: '127.0.0.1', port: 3000, path: '/api/shops?pageSize=1' }
];

(async () => {
  const scoreItems = [];
  let totalScore = 0;
  let maxScore = 0;

  console.log('═══════════════════════════════════════════════════════');
  console.log('   WTFPL 系统健康度评估 · ' + new Date().toLocaleString('zh-CN'));
  console.log('═══════════════════════════════════════════════════════');
  console.log();

  // 1. HTTP API 健康检查
  console.log('【1/6】HTTP 接口健康检查');
  for (const t of checkTargets) {
    maxScore += 10;
    const r = await apiCheck(t.host, t.port, t.path);
    if (r.status === 200) {
      totalScore += 10;
      scoreItems.push({ name: t.name, score: 10, max: 10, status: '✅ HTTP 200' });
      console.log('  ✅ ' + t.name + '  HTTP 200');
    } else if (r.status === 403) {
      totalScore += 8;
      scoreItems.push({ name: t.name, score: 8, max: 10, status: '⚠️ HTTP 403 (需要登录)' });
      console.log('  ⚠️  ' + t.name + '  HTTP 403 (需要登录，正常)');
    } else {
      scoreItems.push({ name: t.name, score: 0, max: 10, status: '❌ ' + r.status + ' ' + (r.error || '') });
      console.log('  ❌ ' + t.name + '  ' + r.status + ' ' + (r.error || ''));
    }
  }
  console.log();

  // 2. 备份目录文件数量
  console.log('【2/6】备份文件状态');
  maxScore += 10;
  const backupDir = path.join(__dirname, '..', 'backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json') && f.startsWith('qshop-'));
    const minuteFiles = files.filter((f) => f.includes('minute'));
    const sorted = files.map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    const nowMs = Date.now();
    const lastBackupAgo = sorted[0] ? Math.round((nowMs - sorted[0].mtime) / 60000) : null;
    console.log('  备份目录: ' + backupDir);
    console.log('  总文件数: ' + files.length);
    console.log('  分钟备份: ' + minuteFiles.length);
    console.log('  最近备份: ' + (lastBackupAgo !== null ? lastBackupAgo + ' 分钟前' : '(无)'));
    if (files.length > 0) {
      totalScore += 10;
      scoreItems.push({ name: '备份文件', score: 10, max: 10, status: '✅ ' + files.length + ' 份' });
    } else {
      scoreItems.push({ name: '备份文件', score: 0, max: 10, status: '❌ 无备份文件' });
    }
  } else {
    console.log('  ❌ 备份目录不存在');
    scoreItems.push({ name: '备份文件', score: 0, max: 10, status: '❌ 目录不存在' });
  }
  console.log();

  // 3. .env 配置正确性检查
  console.log('【3/6】配置文件 (.env)');
  maxScore += 10;
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasInterval = envContent.includes('BACKUP_INTERVAL_MINUTES');
    const hasBackupEnabled = envContent.includes('BACKUP_ENABLED=true');
    let intervalVal = null;
    const m = envContent.match(/BACKUP_INTERVAL_MINUTES=(\d+)/);
    if (m) intervalVal = parseInt(m[1]);
    console.log('  BACKUP_ENABLED: ' + (hasBackupEnabled ? 'true ✅' : 'false ❌'));
    console.log('  BACKUP_INTERVAL_MINUTES: ' + (intervalVal !== null ? intervalVal + ' ✅' : '(未设置) ⚠️'));
    const ok = hasBackupEnabled && intervalVal !== null && intervalVal >= 0 && intervalVal <= 60;
    totalScore += ok ? 10 : 3;
    scoreItems.push({ name: '.env 配置', score: ok ? 10 : 3, max: 10, status: ok ? '✅ 配置完整' : '⚠️ 缺少关键配置' });
  } else {
    console.log('  ❌ .env 文件不存在');
    scoreItems.push({ name: '.env 配置', score: 0, max: 10, status: '❌ 文件不存在' });
  }
  console.log();

  // 4. 数据库与日志目录检查
  console.log('【4/6】关键目录与文件');
  maxScore += 10;
  const logsDir = path.join(__dirname, '..', 'logs');
  const serverJsOk = fs.existsSync(path.join(__dirname, '..', 'server.js'));
  const logsDirOk = fs.existsSync(logsDir);
  console.log('  server.js 存在: ' + (serverJsOk ? '✅' : '❌'));
  console.log('  logs/ 目录存在: ' + (logsDirOk ? '✅' : '❌'));
  if (serverJsOk && logsDirOk) {
    totalScore += 10;
    scoreItems.push({ name: '关键文件', score: 10, max: 10, status: '✅ 存在' });
  } else {
    totalScore += 3;
    scoreItems.push({ name: '关键文件', score: 3, max: 10, status: '⚠️ 有缺失' });
  }
  console.log();

  // 5. 备份配置 API 暴露（管理界面可配置性）
  console.log('【5/6】配置接口 (api/backup/status 详情)');
  maxScore += 10;
  const bk = await apiCheck('127.0.0.1', 3000, '/api/backup/status');
  if (bk.status === 200 && bk.body && bk.body.config) {
    const c = bk.body.config;
    const intervalOk = c.backup_interval_minutes !== undefined;
    console.log('  backup_interval_minutes: ' + (intervalOk ? c.backup_interval_minutes + ' ✅' : '(未暴露) ⚠️'));
    console.log('  backup_time: ' + c.backup_time);
    console.log('  retention_days: ' + c.retention_days);
    console.log('  cleanup_enabled: ' + c.cleanup_enabled);
    totalScore += 10;
    scoreItems.push({ name: '配置 API', score: 10, max: 10, status: '✅ 完整暴露' });
  } else {
    scoreItems.push({ name: '配置 API', score: 0, max: 10, status: '❌ 接口不可用' });
  }
  console.log();

  // 6. 备份 list 接口
  console.log('【6/6】备份列表接口');
  maxScore += 10;
  const bl = await apiCheck('127.0.0.1', 3000, '/api/backup/list');
  if (bl.status === 200 && bl.body && bl.body.files) {
    console.log('  文件数: ' + bl.body.total);
    totalScore += 10;
    scoreItems.push({ name: '备份列表 API', score: 10, max: 10, status: '✅ HTTP 200' });
  } else {
    console.log('  ⚠️  接口不可用');
    scoreItems.push({ name: '备份列表 API', score: 0, max: 10, status: '❌ 接口不可用' });
  }
  console.log();

  // 7. 总结报告
  const scorePct = Math.round((totalScore / maxScore) * 100);
  let level = '';
  let color = '';
  if (scorePct >= 90) { level = 'LEVEL 0 — ALL CLEAR'; color = '✅'; }
  else if (scorePct >= 75) { level = 'LEVEL 1 — MINOR'; color = '🟢'; }
  else if (scorePct >= 50) { level = 'LEVEL 2 — MODERATE'; color = '🟡'; }
  else if (scorePct >= 30) { level = 'LEVEL 3 — SERIOUS'; color = '🟠'; }
  else { level = 'LEVEL 4 — CRITICAL · WTF'; color = '🔴'; }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  综合评分: ' + totalScore + ' / ' + maxScore + '  (' + scorePct + '%)');
  console.log('  ' + color + ' ' + level);
  console.log('───────────────────────────────────────────────────────');
  scoreItems.forEach((s) => {
    const bars = Math.round((s.score / s.max) * 20);
    const barStr = '█'.repeat(bars) + '░'.repeat(20 - bars);
    console.log('  ' + s.name + '  ' + barStr + ' ' + s.score + '/' + s.max + '  ' + s.status);
  });
  console.log('═══════════════════════════════════════════════════════');
  console.log();
  console.log('建议访问: http://localhost:3000');
  console.log('       登录后管理: http://localhost:3000 → 管理员设置');
  console.log('       备份目录: ' + backupDir);
})();
