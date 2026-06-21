// 彻底停止并重新启动服务器
const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('1. 停止所有 node 进程...');
try { execSync('taskkill /F /IM node.exe', { timeout: 10000, stdio: 'ignore' }); } catch (e) {}
setTimeout(() => {
  console.log('2. 启动新服务器...');
  const logFile = path.join(__dirname, '..', 'server.log');
  const child = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    detached: true
  });
  child.unref();
  console.log('   新服务器 PID: ' + child.pid);
  setTimeout(() => {
    console.log('3. 验证 API...');
    const http = require('http');
    http.get('http://127.0.0.1:3000/api/backup/status', (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        const obj = JSON.parse(data);
        console.log('   HTTP ' + res.statusCode);
        console.log('   config keys: ' + Object.keys(obj.config).join(', '));
        console.log('   backup_interval_minutes: ' + obj.config.backup_interval_minutes);
        if (obj.config.backup_interval_minutes !== undefined) {
          console.log('\n✅ 服务器已成功重启！新代码生效！');
        } else {
          console.log('\n⚠️ 字段未出现，检查配置读取...');
        }
        process.exit(0);
      });
    }).on('error', (e) => {
      console.log('   ❌ 连接失败: ' + e.message);
      console.log('   等待更长时间后重试...');
      setTimeout(() => {
        http.get('http://127.0.0.1:3000/api/backup/status', (res2) => {
          let d2 = '';
          res2.on('data', (c) => d2 += c);
          res2.on('end', () => {
            try { console.log('   重试: ' + d2.substring(0, 200)); } catch (e) {}
            process.exit(0);
          });
        }).on('error', (e2) => { console.log('   ❌ ' + e2.message); process.exit(1); });
      }, 3000);
    });
  }, 5000);
}, 3000);
