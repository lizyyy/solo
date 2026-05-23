import re
with open('app/services.py', 'r') as f:
    lines = f.readlines()

# Fix lines 201-209 (1-indexed) = 200-208 (0-indexed)
# Line 201 (0:200): if statement
# Line 202 (0:201): should be indented 4 more spaces
# Lines 203-209 (0:202-208): if statements, should be at same level as line 201

# Fix line 201 (0:201) - add 4 spaces
if 201 < len(lines):
    lines[201] = '    ' + lines[201]

# Fix lines 203-209 (0:202-208) - add 4 spaces at beginning
for i in range(202, 210):
    if i < len(lines):
        lines[i] = '    ' + lines[i]

with open('app/services.py', 'w') as f:
    f.writelines(lines)
print('Done')
