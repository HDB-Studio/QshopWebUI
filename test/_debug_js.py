import re, sys

for fn in ['c:/Users/chcct/Desktop/QshopWebUI/app.js', 'c:/Users/chcct/Desktop/QshopWebUI/db.js']:
    with open(fn, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f'\n=== {fn} ({len(lines)} lines) ===')
    
    # Count backticks per line (anti-nested-template tracking)
    for i, line in enumerate(lines, 1):
        bt = line.count('`')
        if bt % 2 != 0:
            # Only print lines with odd backticks (possible issue)
            print(f'  Line {i}: odd backtick count={bt}: {line.rstrip()[:120]}')
    
    # Check for classic issues: arrow functions in wrong places, missing commas
    content = ''.join(lines)
    bt_count = content.count('`')
    sq_count = content.count("'")
    dq_count = content.count('"')
    print(f'  Balance: `={bt_count} (even={bt_count%2==0}), \'={sq_count} (even={sq_count%2==0}), \"={dq_count} (even={dq_count%2==0})')
    
    # Check for unescaped \r
    cr_count = content.count('\r')
    lf_count = content.count('\n')
    print(f'  CR={cr_count}, LF={lf_count}')

print('\nDone.')
