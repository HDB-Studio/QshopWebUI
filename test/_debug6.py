with open('c:/Users/chcct/Desktop/QshopWebUI/app.js', 'rb') as f:
    raw = f.read()

print(f'File size: {len(raw)} bytes')
print(f'First 20 bytes: {[hex(b) for b in raw[:20]]}')
print(f'First 20 chars as utf-8: {raw[:20].decode("utf-8", errors="replace")}')

# Check for BOM
if raw[:3] == b'\xef\xbb\xbf':
    print('UTF-8 BOM detected!')
if raw[:2] == b'\xff\xfe' or raw[:2] == b'\xfe\xff':
    print('UTF-16 BOM detected!')

# Check for unusual control chars throughout the file
import collections
control_chars = collections.Counter()
for i, b in enumerate(raw):
    if b < 9 or (b > 13 and b < 32):
        control_chars[b] += 1

if control_chars:
    print(f'Control chars found: {dict(control_chars)}')
else:
    print('No unusual control chars found')

# Check line endings
cr_count = raw.count(b'\r')
lf_count = raw.count(b'\n')
crlf_count = raw.count(b'\r\n')
print(f'\\r: {cr_count}, \\n: {lf_count}, \\r\\n: {crlf_count}')

# Compare with db.js
with open('c:/Users/chcct/Desktop/QshopWebUI/db.js', 'rb') as f:
    raw2 = f.read()
print(f'db.js first 20 bytes: {[hex(b) for b in raw2[:20]]}')
