# 将 app.js 分段，每个段用 try/catch 包围，便于定位
with open('c:/Users/chcct/Desktop/QshopWebUI/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 寻找关键分隔点 —— IIFE 的结构是：
# (function(global){ ... })(window);
# 内部是一连串的常量和函数声明

# 策略：找到 "function " 关键字位置
import re
positions = [m.start() for m in re.finditer(r'^    (?:function|const|var|let)\s+\w+\s*[=;(]', content, re.MULTILINE)]
print(f'Found {len(positions)} declarations')

# 写出带调试的版本
parts = []
last = 0
for i, p in enumerate(positions):
    parts.append((last, p))
    last = p
parts.append((last, len(content)))

print(f'Split into {len(parts)} chunks, last={len(content)}')
for i, (start, end) in enumerate(parts[:10]):
    print(f'  Chunk {i}: {start}-{end} (len={end-start})')
    snippet = content[start:min(start+80, end)].replace('\n', '\\n')
    print(f'    >>> {snippet}')
