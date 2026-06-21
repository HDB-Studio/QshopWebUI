# 写一个最小的测试 HTML，只加载 app.js 开头的 100 行代码
with open('c:/Users/chcct/Desktop/QshopWebUI/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 生成最小化的 HTML，用 try-catch 包裹每一行
html = '''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Minimal Test</title></head>
<body>
<div id="log" style="font-family:monospace;font-size:12px"></div>
<script>
const log = (msg) => {
  document.getElementById('log').innerHTML += '<div>' + msg + '</div>';
  console.log(msg);
};
'''

# 先加载常量声明和小函数（前 70 行）
chunk = ''.join(lines[0:70])
# 替换内部的 `window` 引用避免问题
html += f'<script>\n// First 70 lines\ntry {{ eval({repr(chunk)}); log("Lines 0-70: OK"); }} catch(e) {{ log("ERR 0-70: " + e.message); }}\n</script>'

# 接下来 70-150
chunk2 = ''.join(lines[70:150])
html += f'<script>\ntry {{ eval({repr(chunk2)}); log("Lines 70-150: OK"); }} catch(e) {{ log("ERR 70-150: " + e.message); }}\n</script>'

# 接下来 150-250
chunk3 = ''.join(lines[150:250])
html += f'<script>\ntry {{ eval({repr(chunk3)}); log("Lines 150-250: OK"); }} catch(e) {{ log("ERR 150-250: " + e.message); }}\n</script>'

html += '</body></html>'

with open('c:/Users/chcct/Desktop/QshopWebUI/minimal_test.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Wrote minimal_test.html, {len(html)} chars')
print(f'Lines 0-70 first 30 chars: {repr(chunk[:80])}')
