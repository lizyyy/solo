import base64
import sys

content_b64 = sys.argv[1]
target = sys.argv[2]
content = base64.b64decode(content_b64).decode('utf-8')
with open(target, 'w') as f:
    f.write(content)
print(f'Written {len(content)} chars to {target}, {len(content.splitlines())} lines')
