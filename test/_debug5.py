import os

with open('c:/Users/chcct/Desktop/QshopWebUI/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Generate a binary search test HTML
html = '''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Binary Search Test</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="./db.js"></script>
</head>
<body>
<div id="log" style="font-family:monospace;font-size:11px;line-height:1.3"></div>
<script>
let log = (m, ok) => {
  const d = document.createElement('div');
  d.style.color = ok ? 'green' : 'red';
  d.textContent = m;
  document.getElementById('log').appendChild(d);
};
</script>
'''

# Binary search: test in halves
# First, test entire file
# (function(global){ ... })(window);
full_code = ''.join(lines)
html += f'''
<script>
try {{
  eval({repr(full_code[:10000])});
  log("Lines 0-~200: OK", true);
}} catch(e) {{
  log("Lines 0-~200: " + e.message, false);
}}
</script>
'''

# Then test next 10000
html += f'''
<script>
try {{
  eval({repr(full_code[10000:20000])});
  log("Lines ~200-~400: OK", true);
}} catch(e) {{
  log("Lines ~200-~400: " + e.message, false);
}}
</script>
'''

# Then test next 10000
html += f'''
<script>
try {{
  eval({repr(full_code[20000:30000])});
  log("Lines ~400-~600: OK", true);
}} catch(e) {{
  log("Lines ~400-~600: " + e.message, false);
}}
</script>
'''

html += f'''
<script>
try {{
  eval({repr(full_code[30000:40000])});
  log("Lines ~600-~800: OK", true);
}} catch(e) {{
  log("Lines ~600-~800: " + e.message, false);
}}
</script>
'''

html += f'''
<script>
try {{
  eval({repr(full_code[40000:])});
  log("Lines ~800-end: OK", true);
}} catch(e) {{
  log("Lines ~800-end: " + e.message, false);
}}
</script>
'''

html += '</body></html>'

with open('c:/Users/chcct/Desktop/QshopWebUI/binary_test.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Wrote binary_test.html: {len(html)} chars')
