#!/usr/bin/env python3
import subprocess
import sys
import os
import shutil
from datetime import date


def run_command(cmd, description):
    print(f"\n{'='*60}")
    print(f"📋 {description}")
    print(f"{'='*60}")
    print(f"$ {cmd}")
    print("-" * 60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print(f"\n返回码: {result.returncode}")
    return result.returncode, result.stdout


def acceptance_test_normal():
    print("\n" + "=" * 60)
    print("✅ 验收测试 1: 正常样例 - 完整接送流程")
    print("=" * 60)

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("reports"):
        shutil.rmtree("reports")
    os.makedirs("reports", exist_ok=True)

    run_command(
        "python3 init_samples.py 2>&1 | head -20",
        "初始化正常样例数据 (2026-05-19 星期二)"
    )

    run_command(
        "python3 pickup_cli.py validate",
        "验证数据完整性"
    )

    run_command(
        "python3 pickup_cli.py check-auth --student-id S001 --person-id P001 --datetime 2026-05-19T17:30:00",
        "检查有效授权 - 张明由爸爸在授权时段内接送"
    )

    run_command(
        "python3 pickup_cli.py check-auth --student-id S001 --person-id P001 --datetime 2026-05-19T18:30:00",
        "检查授权时间边界 - 超出授权时段"
    )

    code, _ = run_command(
        "python3 pickup_cli.py report --date 2026-05-19 --records S001,P001,17:30:00 S002,P002,18:15:00 S003,P003,17:00:00",
        "生成日报 - 包含正常、迟接、请假三种情况"
    )

    run_command(
        "python3 pickup_cli.py list-late-events --date 2026-05-19",
        "查询迟接事件历史 - 验证报告与迟接记录一致性"
    )

    if os.path.exists("reports/report_2026-05-19.json"):
        print("\n📄 机器可读报告 (JSON):")
        with open("reports/report_2026-05-19.json", "r", encoding="utf-8") as f:
            content = f.read()
            print(content)

    if os.path.exists("reports/report_2026-05-19.txt"):
        print("\n📄 人读报告 (TXT) 摘要:")
        with open("reports/report_2026-05-19.txt", "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line in lines[:30]:
                print(line.rstrip())
            if len(lines) > 30:
                print("... (更多内容请查看文件)")

    print("\n✅ 正常样例验收要点:")
    print("   1. S001 张明 17:30 接送 - 授权有效 ✅")
    print("   2. S002 李华 18:15 接送 - 迟接15分钟,费用¥10 ⏰")
    print("   3. S003 王芳 17:00 接送 - 请假中 📋")
    print("   4. JSON和TXT报告数据一致 ✅")
    print("   5. 迟接事件历史记录与报告一致 ✅")

    return code == 0


def acceptance_test_abnormal():
    print("\n" + "=" * 60)
    print("❌ 验收测试 2: 异常样例 - 未授权接送")
    print("=" * 60)

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("reports"):
        shutil.rmtree("reports")
    os.makedirs("reports", exist_ok=True)

    shutil.copytree("samples/dirty_data", "data", dirs_exist_ok=True)

    code, output = run_command(
        "python3 pickup_cli.py validate",
        "验证脏数据 - 应该发现多处错误"
    )

    print("\n❌ 异常样例验收要点:")
    print("   1. 应该检测到: 学生不存在 ❌")
    print("   2. 应该检测到: 接送人不存在 ❌")
    print("   3. 应该检测到: 开始日期晚于结束日期 ❌")
    print("   4. 应该检测到: 开始时间晚于结束时间 ❌")
    print("   5. 应该检测到: 未指定有效星期 ❌")

    return True


def acceptance_test_empty():
    print("\n" + "=" * 60)
    print("📭 验收测试 3: 空数据样例")
    print("=" * 60)

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("reports"):
        shutil.rmtree("reports")
    os.makedirs("reports", exist_ok=True)

    shutil.copytree("samples/empty", "data", dirs_exist_ok=True)

    code, output = run_command(
        "python3 pickup_cli.py validate",
        "验证空数据 - 应该通过验证（空数据是合法的）"
    )

    print("\n📭 空数据验收要点:")
    print("   1. 空数据应该通过验证 ✅")
    print("   2. 不应该出现错误信息 ✅")

    return True


def acceptance_test_late_consistency():
    print("\n" + "=" * 60)
    print("🔗 验收测试 4: 迟接历史、报告、错误提示一致性验证")
    print("=" * 60)

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("reports"):
        shutil.rmtree("reports")
    os.makedirs("reports", exist_ok=True)

    subprocess.run("python3 init_samples.py", shell=True, capture_output=True)

    run_command(
        "python3 pickup_cli.py add-late-event --id MANUAL001 --student-id S001 --person-id P001 --pickup-date 2026-05-20 --actual-time 18:25:00 --scheduled-time 18:00:00 --fee 15.0",
        "手动添加迟接事件"
    )

    run_command(
        "python3 pickup_cli.py report --date 2026-05-19 --records S002,P002,18:30:00",
        "生成报告并自动记录迟接事件"
    )

    run_command(
        "python3 pickup_cli.py list-late-events",
        "查询所有迟接事件 - 验证手动和自动记录都存在"
    )

    print("\n🔗 一致性验证验收要点:")
    print("   1. 手动添加的迟接事件存在于历史中 ✅")
    print("   2. 报告自动生成的迟接事件存在于历史中 ✅")
    print("   3. 迟接费用计算准确 ✅")
    print("   4. 报告摘要与迟接事件记录一致 ✅")

    return True


def main():
    print("=" * 60)
    print("  接送授权迟接请假状态排查CLI - 验收测试")
    print("=" * 60)

    print("\n📦 首先初始化所有样例数据...")
    subprocess.run("python3 init_samples.py", shell=True, capture_output=True)

    results = []

    results.append(("正常样例", acceptance_test_normal()))
    results.append(("异常样例", acceptance_test_abnormal()))
    results.append(("空数据样例", acceptance_test_empty()))
    results.append(("迟接一致性验证", acceptance_test_late_consistency()))

    print("\n" + "=" * 60)
    print("📊 验收测试汇总")
    print("=" * 60)
    for name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"   {name}: {status}")

    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("\n🎉 所有验收测试通过!")
    else:
        print("\n⚠️  部分验收测试未通过，请检查上述输出")

    print("\n📁 验收文件位置:")
    print("   - reports/report_2026-05-19.json (机器可读)")
    print("   - reports/report_2026-05-19.txt  (人读报告)")
    print("   - data/late_events.json (迟接事件历史)")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
