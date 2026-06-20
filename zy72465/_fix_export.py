#!/usr/bin/env python3
import re

path = 'src/pages/Export.tsx'
with open(path) as f:
    txt = f.read()

# Fix 1: <span className={`text-sm font-medium"> -> className="text-sm font-medium"
old1 = '<span className={`text-sm font-medium">'
new1 = '<span className="text-sm font-medium">'
if old1 in txt:
    txt = txt.replace(old1, new1, 1)
    print('Fix 1 done (span className)')
else:
    print('Fix 1 skipped - not found')

# Fix 2: (行#{rec.originalLineNumber} / {rec.recordId} -> 补末尾的 )
old2 = '(行#{rec.originalLineNumber} / {rec.recordId}'
new2 = '(行#{rec.originalLineNumber} / {rec.recordId})'
if old2 in txt:
    txt = txt.replace(old2, new2, 1)
    print('Fix 2 done (missing ) in line 379)')
else:
    print('Fix 2 skipped - not found')

# Fix 3: 把模板字面量末尾单独一行的 > 合并上去
# 形如: xxx`}\n<spases>>  -> xxx`}>
pattern3 = r"('`\})\n\s+>"
m = re.search(pattern3, txt)
if m:
    # 只替换第一个（就是 374-375 那行 div 的）
    before = txt[:m.start()]
    after = txt[m.end():]
    txt = before + m.group(1) + '>' + after
    print('Fix 3 done (div line break merge via regex)')
else:
    print('Fix 3 skipped - not found')

# Fix 4: line 429 的 td 没问题吧？检查末尾
idx = txt.find("text-red-600 font-semibold'}`}>")
if idx >= 0:
    print("Fix4 ok: td ends correctly at pos", idx)
else:
    # 尝试修复
    bad4 = "text-red-600 font-semibold'}`\n"
    idx4 = txt.find(bad4)
    if idx4 >= 0:
        # 下一行是单独的 >
        rest = txt[idx4+len(bad4):]
        lines = rest.split('\n', 1)
        if lines[0].strip() == '>':
            txt = txt[:idx4] + "text-red-600 font-semibold'}`}>" + lines[1]
            print('Fix4 done: td line break merged')
        else:
            print("WARN Fix4: pattern found but next line not >")
    else:
        print("WARN Fix4: td pattern not found at all, manually check")

with open(path, 'w') as f:
    f.write(txt)
print('\nWritten successfully')
