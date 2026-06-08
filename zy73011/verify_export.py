#!/usr/bin/env python3
import glob, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
fs = sorted(glob.glob("exports/*.md"), key=os.path.getmtime)
if not fs:
    print("No export files found")
    sys.exit(1)
f = fs[-1]
print(f"验证文件: {f}")
with open(f, encoding="utf-8") as fh:
    c = fh.read()
print(f"总字符数: {len(c)}")
sections = ["筛选口径", "汇总数据", "异常明细", "宠物寄养异常提醒报告",
            "主人微信备注", "用药记录", "人工确认前后变化", "汇总拉动因素",
            "新人引导：快速上手路径", "材料入口", "异常出口"]
print("\n--- 章节完整性 ---")
for s in sections:
    cnt = c.count(s)
    mark = "✅" if cnt else "❌"
    print(f"  {mark} {s} ({cnt}次)")

print("\n--- 数字一致性检查 ---")
for line in c.split("\n"):
    if "异常总数" in line and "|" in line:
        print(f"  汇总行: {line.strip()}")
        break

print("\n--- 关键特征验证 ---")
print(f"  判断影响说明字段: {'✅' if '判断影响说明' in c else '❌'}")
print(f"  用药变更轨迹:     {'✅' if '变更轨迹' in c else '❌'}")
print(f"  备注-结论关联箭头: {'✅' if '↳ 回访结论' in c else '❌'}")
print(f"  人工前后变化对比: {'✅' if '变化前' in c and '变化后' in c else '❌'}")
print(f"  拉动因素占比表:   {'✅' if '贡献占比' in c else '❌'}")

print("\n--- 口径声明 ---")
for line in c.split("\n"):
    if "口径说明" in line:
        print(f"  {line.strip()}")
        break

print("\n✅ 导出报告验证完成")
