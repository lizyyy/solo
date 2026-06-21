import sys
with open("demo.py", "r") as f:
    lines = f.readlines()

start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "TEST INSERTION" in line:
        start_idx = i
    if start_idx is not None and "第三阶段：明细刷新" in line:
        end_idx = i
        break

print(f"Start: {start_idx}, End: {end_idx}")
print("Lines before:", lines[start_idx].strip() if start_idx else "None")
print("Lines after:", lines[end_idx].strip() if end_idx else "None")
