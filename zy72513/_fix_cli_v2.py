
import subprocess
import sys
import re

filepath = "learning_path_recommender/cli/main.py"
fix_count = 0

while True:
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", filepath],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"
✅ 编译通过！共修复 {fix_count} 处")
        break
    
    # Parse error line number from: File "...", line NNN
    m = re.search(r"line (\d+)", result.stderr)
    if not m:
        print("❌ 无法解析错误:", result.stderr)
        break
    
    err_line = int(m.group(1))
    print(f"发现错误: 行 {err_line}")
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Merge err_line (1-indexed) with err_line+1
    # err_line is where Python detected the error (the broken line start)
    # The actual broken line is err_line-1 (0-indexed), merge with next
    idx = err_line - 1
    if idx + 1 >= len(lines):import subprocess
import sys
import re

filepath = ?mport sys
imporreimp    
   
filepat= lfix_count = 0

while True:
    result = subprocesMe
while Trve act    resulte         [sys.executable, "-li        capture_output=True, text=True
    )
    if red     )
    if result.returncode == 0:
eb    
         print(f"
✅ 编译?)        break
    
    # Parse error line number from: File "..      
    # P=    "
    m = re.search(r"line (\d+)", result.stderr)
    if ri    if not m:
        print("❌ 无法解析?         prinin        break
    
    err_line = int(m.group(1))
    
     
    errs[   ]     print(f"发现错误: 行t     
    with open(filepath, "r", encodin1]             lines = f.readlines()
    
    # Merge err_f:    
    # Merge err_line (1
    
     # err_line is where Python detected the err    rint("❌ 修复次数超限，停止")
        break
 idx = err_line - 1
