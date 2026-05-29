#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from io import StringIO

old_stdout = sys.stdout
sys.stdout = output_buffer = StringIO()

try:
    exec(open('verify_and_run.py').read())
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)

sys.stdout = old_stdout
output = output_buffer.getvalue()

with open('verification_output.txt', 'w', encoding='utf-8') as f:
    f.write(output)

print("输出已保存到 verification_output.txt")
print("前50行内容:")
print("\n".join(output.split("\n")[:50]))
