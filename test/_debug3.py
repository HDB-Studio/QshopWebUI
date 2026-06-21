with open('c:/Users/chcct/Desktop/QshopWebUI/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 取 IIFE 内部内容
# 开头: (function(global) {
# 结尾: })(window);
import re
# 找到函数体的开始
start_idx = content.index('{', content.index('function(global)')) + 1
end_idx = content.rindex('})(window);')
body = content[start_idx:end_idx]

print(f'IIFE body: {len(body)} chars, start={start_idx}, end={end_idx}')

# 按 function 或 const/let/var 声明分段
lines = body.split('\n')
# 每个 300 行分一段
chunk_size = 250
chunks = []
for i in range(0, len(lines), chunk_size):
    chunk = '\n'.join(lines[i:i+chunk_size])
    chunks.append(chunk)

print(f'Chunks: {len(chunks)}')

# 生成测试 HTML
html = '''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Debug</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="./db.js"></script>
</head><body>
<div id="log"></div>
<script>
(function(global){
'''

for i, chunk in enumerate(chunks):
    html += f'''
// ==== Chunk {i} (lines ~{i*chunk_size}-{(i+1)*chunk_size}) ====
(function() {{
  try {{
{chunk}
    document.getElementById('log').innerHTML += '<div style="color:green">OK chunk {i}</div>';
  }} catch(e) {{
    document.getElementById('log').innerHTML += '<div style="color:red">ERR chunk {i}: ' + e.message + '</div>';
    console.error('Chunk {i} error:', e);
    throw e;
  }}
}})();
'''

html += '''
})(window);
</script>
</body></html>
'''

with open('c:/Users/chcct/Desktop/QshopWebUI/debug_test.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Wrote debug_test.html, {len(html)} chars')
