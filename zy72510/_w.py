import os
import sys

path = sys.argv[1]
content = sys.stdin.read()
with open(path, 'w') as f:
    f.write(content)
print(f'Written {len(content)} chars to {path}')
