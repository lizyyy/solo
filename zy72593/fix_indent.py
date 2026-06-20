import ast

file_path = "/Users/lzy/pro/solo/workspaces/zy72593/cutoff_eval/detector.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start = 117
end = 154

for i in range(start, end + 1):
    if lines[i].startswith("    "):
        lines[i] = lines[i][4:]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

with open(file_path, "r", encoding="utf-8") as f:
    source = f.read()

try:
    ast.parse(source)
    print("语法验证通过 ✓")
except SyntaxError as e:
    print(f"语法错误: {e}")
    raise
