const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 找到 npm 的 JS 入口
function findNpmJs() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm.js'),
    path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(os.homedir(), '.npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

console.log('========================================');
console.log('  fuck-u-code 代码质量分析');
console.log('========================================');

// 查找 npm
const npmJs = findNpmJs();
if (!npmJs) {
  console.log('  ❌ 找不到 npm 的 JS 入口文件，可用候选:');
  console.log('     - ' + path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  console.log('     - ' + path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'));
  process.exit(1);
}
console.log('  npm入口: ' + npmJs);

// 安装
console.log('\n[1/3] 本地安装 eff-u-code...');
const install = spawnSync(process.execPath, [npmJs, 'install', '--save-dev', 'eff-u-code'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  timeout: 180000,
  cwd: process.cwd(),
  env: process.env,
});
console.log('  退出代码: ' + install.status);
if (install.stdout) {
  const t = install.stdout.trim();
  if (t.length > 100) console.log('  stdout: ...' + t.substring(t.length - 800));
  else if (t.length > 0) console.log('  stdout: ' + t);
}
if (install.stderr) {
  const t = install.stderr.trim();
  if (t.length > 100) console.log('  stderr: ...' + t.substring(t.length - 800));
  else if (t.length > 0) console.log('  stderr: ' + t);
}
if (install.error) console.log('  error: ' + install.error.message);

// 找到工具入口
console.log('\n[2/3] 查找工具入口...');
const pkgPath = path.join(process.cwd(), 'node_modules', 'eff-u-code', 'package.json');
let entryFile = null;
let packageName = '';
let packageVersion = '';

if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    packageName = pkg.name;
    packageVersion = pkg.version;
    console.log('  ✅ 找到: ' + pkg.name + ' v' + pkg.version);
    if (pkg.bin) {
      if (typeof pkg.bin === 'string') entryFile = path.join(process.cwd(), 'node_modules', 'eff-u-code', pkg.bin);
      else {
        const key = pkg.bin['fuck-u-code'] || pkg.bin['eff-u-code'] || Object.keys(pkg.bin)[0];
        entryFile = path.join(process.cwd(), 'node_modules', 'eff-u-code', pkg.bin[key]);
      }
    } else if (pkg.main) {
      entryFile = path.join(process.cwd(), 'node_modules', 'eff-u-code', pkg.main);
    }
    if (entryFile) console.log('  入口文件: ' + entryFile);
  } catch (e) {
    console.log('  解析失败: ' + e.message);
  }
}

// 如果没找到，尝试直接从包目录里找文件
if (!entryFile || !fs.existsSync(entryFile)) {
  const baseDir = path.join(process.cwd(), 'node_modules', 'eff-u-code');
  if (fs.existsSync(baseDir)) {
    const files = fs.readdirSync(baseDir);
    console.log('  扫描目录: ' + baseDir);
    console.log('  文件: ' + files.join(', '));
    // 找 cli.js / index.js / bin
    for (const f of files) {
      if (f.match(/(cli|index|main|bin)\.(js|mjs|cjs)$/i)) {
        entryFile = path.join(baseDir, f);
        console.log('  候选入口: ' + f);
        break;
      }
    }
    if (!entryFile) {
      // 扫描子目录
      if (fs.existsSync(path.join(baseDir, 'dist'))) {
        const distFiles = fs.readdirSync(path.join(baseDir, 'dist'));
        for (const f of distFiles) {
          if (f.match(/(cli|index|main)\.(js|mjs|cjs)$/i)) {
            entryFile = path.join(baseDir, 'dist', f);
            break;
          }
        }
      }
    }
  }
}

if (!entryFile || !fs.existsSync(entryFile)) {
  console.log('  ❌ 无法找到入口文件，安装可能未完成');
  console.log('  检查 package.json: ' + (fs.existsSync(pkgPath) ? '存在' : '不存在'));
  const baseDir = path.join(process.cwd(), 'node_modules', 'eff-u-code');
  if (fs.existsSync(baseDir)) {
    console.log('  目录内容: ' + fs.readdirSync(baseDir).join(', '));
  }
  process.exit(1);
}

// 创建配置
console.log('\n[3/3] 运行代码分析...');
try {
  const config = {
    exclude: ['node_modules/**', 'backups/**', 'reports/**', 'dist/**', 'build/**', '**/*.min.js'],
    concurrency: 8,
    output: { top: 20, maxIssues: 10 }
  };
  fs.writeFileSync('.fuckucoderc.json', JSON.stringify(config, null, 2), 'utf8');
} catch (e) {}

console.log('  执行: node ' + path.basename(entryFile) + ' analyze . -l zh -v -t 20');
console.log('  （可能需要 1-3 分钟）\n');

const result = spawnSync(process.execPath, [entryFile, 'analyze', '.', '-l', 'zh', '-v', '-t', '20'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  timeout: 300000,
  cwd: process.cwd(),
  env: process.env,
  maxBuffer: 100 * 1024 * 1024,
});

console.log('  退出代码: ' + result.status + '  ' + (result.signal ? ' 信号: ' + result.signal : ''));
if (result.error) console.log('  error: ' + result.error.message);

const output = (result.stdout || '').trim();
const errOut = (result.stderr || '').trim();

if (output) {
  console.log('\n=========== 分析结果 ===========');
  console.log(output.substring(0, 12000));
  if (output.length > 12000) console.log('\n... (截断，完整内容见报告文件)');
}
if (errOut && errOut !== output) {
  console.log('\n=========== 附加信息 ===========');
  console.log(errOut.substring(0, 3000));
}

// 保存报告
if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
const mdPath = path.join(process.cwd(), 'reports', 'fuck-u-code-report.md');
const combined = (output || '(无 stdout)') + '\n\n[ stderr ]\n' + (errOut || '(无 stderr)');
fs.writeFileSync(mdPath,
  '# fuck-u-code 代码质量报告\n\n' +
  '> 生成时间: ' + new Date().toLocaleString('zh-CN') + '\n' +
  '> 项目: ' + process.cwd() + '\n' +
  '> 工具: ' + (packageName || 'eff-u-code') + ' v' + (packageVersion || '') + '\n' +
  '> 命令: `' + path.basename(entryFile) + ' analyze . -l zh -v -t 20`\n\n' +
  '## 分析结果\n\n```\n' + combined + '\n```\n',
  'utf8'
);
console.log('\n✅ 报告已保存: ' + mdPath + ' (' + (fs.statSync(mdPath).size / 1024).toFixed(1) + ' KB)');
console.log('\n========================================');
console.log('  完成！');
console.log('========================================');
