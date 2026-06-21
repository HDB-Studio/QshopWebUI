// 启动服务器后台进程
const { spawn } = require('child_process');
const path = require('path');

const child = spawn('node', ['server.js'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
  windowsHide: true
});

let started = false;
child.stdout.on('data', (data) => {
  const line = data.toString('utf8');
  process.stdout.write(line);
  if (line.includes('服务器已启动') || line.includes('已启动，可通过浏览器访问')) {
    if (!started) {
      started = true;
      console.log('\n✅ 服务器启动完成！');
      child.unref();
      setTimeout(() => process.exit(0), 1000);
    }
  }
});
child.stderr.on('data', (data) => {
  process.stdout.write(data.toString('utf8'));
});
child.on('error', (err) => {
  console.error('启动失败: ' + err.message);
  process.exit(1);
});

// 30 秒超时
setTimeout(() => {
  console.log('\n⏱️  超时退出，但服务器进程可能已启动');
  child.unref();
  process.exit(0);
}, 30000);
