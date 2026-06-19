#!/usr/bin/env python3
"""
测试脚本：TRK003 音频备注补录链路全链路验证

覆盖场景：
1. 打开已有状态 → 导入票务 → 补录音频备注 → 保存 → 刷新 → 重算排练变更 → 导出报告
核对：TRK003 从 "正常" → "副歌重录一次，需版权确认"后：
- 返工原因
- 复核状态
- 历史记录
- 待复核数量
- 导出说明
"""
import sys
import os
import subprocess
import json

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def run(cmd, desc=None, expect_fail=False):
    print(f"\n{BLUE}▶ 执行: {cmd}{RESET}")
    if desc:
        print(f"  说明: {desc}")
    result = subprocess.run(
        cmd, shell=True, cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True, text=True
    )
    output = result.stdout.strip()
    err = result.stderr.strip()
    if output:
        print(output)
    if err:
        print(f"{RED}{err}{RESET}")
    if not expect_fail and result.returncode != 0:
        print(f"{RED}  ✗ 命令失败，退出码: {result.returncode}{RESET}")
        sys.exit(1)
    return output

def assert_contains(text, needle, desc):
    if needle in text:
        print(f"{GREEN}  ✓ {desc}{RESET}")
        return True
    else:
        print(f"{RED}  ✗ {desc} (未找到: {needle}){RESET}")
        return False

def assert_not_contains(text, needle, desc):
    if needle not in text:
        print(f"{GREEN}  ✓ {desc}{RESET}")
        return True
    else:
        print(f"{RED}  ✗ {desc} (不该出现: {needle}){RESET}")
        return False

all_ok = True

print("=" * 70)
print("  录音棚工时尾差核对 - TRK003 音频备注链路验证")
print("=" * 70)
print()

# Step 0: 清理数据
run("rm -rf data", "清理旧数据，模拟全新开始")

# Step 1: 导入票务导出表
out = run("python3 cli.py import --ticket-csv samples/ticket_export.csv", "Step1: 导入票务导出表")
all_ok &= assert_contains(out, "共导入 8 条轨道，其中 4 条包含返工原因标记", "初始4条返工，此时TRK003票务备注正常")

# Step 2: 阿梅补看音频备注（默认样例的音频备注是正常的
out = run("python3 cli.py amei --audio-csv samples/audio_files.csv", "Step2: 阿梅补看音频备注（默认样例TRK003音频备注=正常")
all_ok &= assert_contains(out, "关联更新 8 条排练记录", "全部关联成功")

# Step 3: 更新排练变更
out = run("python3 cli.py update", "Step3: 生成排练变更记录")
all_ok &= assert_contains(out, "4 条待版权运营复核", "此时待复核应为4条（TRK003正常，所以还是4条）")

# Step 4: 查看 TRK003 的初始状态
print(f"\n{BLUE}--- 检查 TRK003 初始状态（修改前 ---{RESET}")
out = run("python3 cli.py detail --track-id TRK003", "Step4: 查看 TRK003 修改前")
all_ok &= assert_contains(out, "状态: normal", "初始状态为 normal")
all_ok &= assert_contains(out, "票务导出表备注:\n   正常", "票务备注=正常")
all_ok &= assert_contains(out, "音频文件备注:\n   正常", "音频备注=正常")
all_ok &= assert_contains(out, "判定: ✅ 正常 | 依据: 未检测到返工相关关键词", "票务判定正常")
all_ok &= assert_contains(out, "判定: ✅ 正常 | 依据: 未检测到返工相关关键词", "音频判定正常")
all_ok &= assert_not_contains(out, "重录", "此时不应有重录关键词")

# Step 5: 保存状态
run("python3 cli.py status", "Step5: 查看当前状态，4条待复核")

# Step 6: 补录TRK003音频备注为含重录内容（模拟阿梅发现真实情况
print(f"\n{YELLOW}*** 关键操作：模拟人工补录音频备注为“副歌重录一次，需版权确认 ***{RESET}")
out = run(
    'python3 cli.py edit --track-id TRK003 --type audio '
    '--remark "副歌重录一次，需版权确认" '
    '--by 巡演统筹阿梅 '
    '--reason "核对原始录音频发现副歌有返工需要补录"',
    "Step6: 人工补录 TRK003 音频备注"
)
all_ok &= assert_contains(out, "音频文件备注已更新", "音频备注更新成功")
all_ok &= assert_contains(out, "旧值: 正常", "旧值=正常")
all_ok &= assert_contains(out, "新值: 副歌重录一次，需版权确认", "新值=含重录")
all_ok &= assert_contains(out, "是否返工: 是", "新判定=是")
all_ok &= assert_contains(out, "检测到返工关键词: 重录", "识别到关键词重录")

# Step 7: 保存（edit 之后，重新 load 验证持久化
run("python3 cli.py status", "Step7: 刷新后查看状态：待复核从4条变5条")

# Step 8: 查看更新后的明细
print(f"\n{BLUE}--- 检查 TRK003 修改后状态 ---{RESET}")
out = run("python3 cli.py detail --track-id TRK003", "Step8: 重新打开TRK003 修改后")
all_ok &= assert_contains(out, "音频文件备注:\n   副歌重录一次，需版权确认", "TRK003 音频备注更新后")
all_ok &= assert_contains(out, "判定: ✅ 含返工原因 | 依据: 检测到返工关键词: 重录", "音频判定为含返工原因")
all_ok &= assert_contains(out, "状态: ⚠️ 待版权运营复核", "状态变为待复核")
all_ok &= assert_contains(out, "为什么留下: 音频备注含: 重录，需版权运营复核后确认", "为什么留下 要包含音频备注含: 重录")
all_ok &= assert_contains(out, "综合匹配关键词: 重录", "综合关键词包含重录")
all_ok &= assert_contains(out, "【音频备注】检测到返工关键词: 重录", "判定说明中包含音频备注的判定")
all_ok &= assert_contains(out, "音频备注中检测到返工原因", "综合判定为有返工")

# Step 9: 查看变更历史
print(f"\n{BLUE}--- 检查变更历史 ---{RESET}")
out = run("python3 cli.py history --track-id TRK003", "Step9: 查看 TRK003 变更历史")
all_ok &= assert_contains(out, "巡演统筹阿梅", "修改人=巡演统筹阿梅")
all_ok &= assert_contains(out, "音频文件备注", "修改的是音频文件备注")
all_ok &= assert_contains(out, "旧: 正常", "历史记录旧值正常")
all_ok &= assert_contains(out, "新: 副歌重录一次，需版权确认", "历史记录新值含重录")
all_ok &= assert_contains(out, "核对原始录音频发现副歌有返工需要补录", "修改原因")

# Step 10: 重新生成报告并验证
print(f"\n{BLUE}--- 重新生成文本报告并核对 ---{RESET}")
run("python3 cli.py report --format text --output data/reports/trk003_test.txt", "Step10: 重新导出报告")

with open("data/reports/trk003_test.txt", "r", encoding="utf-8") as f:
    report = f.read()

print(f"{YELLOW}报告中与 TRK003 相关的内容:{RESET}")
# 提取相关段落
lines = report.split("\n")
in_trk003 = False
for line in lines:
    if "TRK003" in line or in_trk003:
        in_trk003 = True
        print("  " + line)
        if line.startswith("  ✅") or line.startswith("  ⏳"):
            if "TRK003" not in line and not line.startswith("    "):
                in_trk003 = False
                break

all_ok &= assert_contains(report, "含返工原因: 5 条", "报告概览：含返工原因从4→5")
all_ok &= assert_contains(report, "待版权运营复核: 5 条", "报告概览：待复核从4→5")
all_ok &= assert_contains(report, "返工来源: 音频备注", "返工来源是音频备注")
all_ok &= assert_contains(report, "返工关键词: 重录", "返工关键词包含重录")
all_ok &= assert_contains(report, "⏳ 待版权运营复核 | 轨道 TRK003: 夏日回忆", "TRK003 的排练变更为待复核")
all_ok &= assert_contains(report, "为什么留下: 音频备注含: 重录，需版权运营复核后确认", "为什么留下说明音频备注原因")
all_ok &= assert_contains(report, "判定说明: 【票务备注】未检测到返工相关关键词", "判定说明包含票务备注判定")
all_ok &= assert_contains(report, "【音频备注】检测到返工关键词: 重录", "判定说明包含音频备注判定")
all_ok &= assert_contains(report, "【综合判定】票务或音频备注中检测到返工原因", "判定说明包含综合判定")
all_ok &= assert_contains(report, "- 音频备注: 副歌重录一次，需版权确认", "报告中的音频备注值")

# Step 11: 生成HTML看板验证JS数据
run("python3 cli.py report --format html --output data/reports/trk003_dashboard.html", "Step11: 生成HTML看板")

with open("data/reports/trk003_dashboard.html", "r", encoding="utf-8") as f:
    html = f.read()

print(f"\n{BLUE}--- HTML 看板数据校验 ---{RESET}")
all_ok &= assert_contains(html, '"TRK003": "副歌重录一次，需版权确认"', "audioRemarks 里 TRK003 音频备注已更新")
all_ok &= assert_contains(html, '"TRK003": "正常"', "ticketRemarks 里 TRK003 票务备注是正常")
all_ok &= assert_contains(html, "【音频备注】检测到返工关键词: 重录", "judgmentData 包含音频备注判定")
all_ok &= assert_contains(html, "【综合判定】票务或音频备注中检测到返工原因", "judgmentData 包含综合判定")
all_ok &= assert_contains(html, "showDetail('TRK003', 'audio'", "TRK003 音频备注点击事件绑定（点击弹窗查看）")
all_ok &= assert_contains(html, "showDetail('TRK003', 'ticket'", "TRK003 票务备注点击事件绑定")
all_ok &= assert_contains(html, "showJudgment('TRK003'", "TRK003 判定说明点击事件绑定")
all_ok &= assert_contains(html, "含返工原因（票务或音频）", "看板表头说明正确")

# 总结
print("\n" + "=" * 70)
if all_ok:
    print(f"{GREEN}✅ 所有断言全部通过！{RESET}")
    print(f"  TRK003 音频备注补录链路验证成功！")
    print()
    print(f"  验证过的要点:")
    print(f"  1. 导入票务导出表 → TRK003 初始正常")
    print(f"  2. 阿梅补看默认音频 → 还是正常")
    print(f"  3. 人工补录 TRK003 音频备注 = 副歌重录一次，需版权确认")
    print(f"  4. 保存后 → 检测立即识别到重录")
    print(f"  5. 明细：状态从 normal → 待版权运营复核")
    print(f"  6. 历史：记录了巡演统筹阿梅修改了音频备注")
    print(f"  7. 待复核数量：4 → 5 条")
    print(f"  8. 文本报告：判定说明/返工来源/关键词全部正确")
    print(f"  9. HTML看板：票务/音频/判定 三条弹窗都可点击弹窗")
    print(f" 10. 重新打开后判定依据都在弹窗对照查看")
else:
    print(f"{RED}✗ 有断言失败，请检查上方日志{RESET}")
print("=" * 70)
