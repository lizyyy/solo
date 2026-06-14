import os
import base64

encoded = open('/tmp/test_code.b64', 'r').read().strip()
decoded = base64.b64decode(encoded).decode('utf-8')

output_path = '/Users/lzy/pro/solo/workspaces/zy72513/e2e_repeat_import_test.py'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(decoded)

print("✅ 文件已创建:", output_path)
print("✅ 文件大小:", os.path.getsize(output_path), "字节")
