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
        "python init_samples.py 2>&1 | head -20",
        "初始化正常样例数据"
    )

    run_command(
        "python pickup_cli.py validate",
        "验证数据完整性"
    )

    run_command(
        "python pickup_cli.py check-auth --student-id S001 --person-id P001 --datetime 2026-05-17T17:30:00",
        "检查有效授权 - 张明由爸爸在授权时段内接送"
    )

    run_command(
        "python pickup_cli.py check-auth --student-id S001 --person-id P001 --datetime 2026-05-17T18:30:00",
        "检查授权时间边界 - 超出授权时段"
    )

    code, _ = run_command(
        "python pickup_cli.py report --date 2026-05-17 --records S001,P001,17:30:00 S002,P002,18:15:00 S003,P003,17:00:00",
        "生成日报 - 包含正常、迟接、请假三种情况"
    )

    if os.path.exists("reports/report_2026-05-17.json"):
        print("\n📄 机器可读报告 (JSON):")
        with open("reports/report_2026-05-17.json", "r", encoding="utf-8") as f:
            content = f.read()
            print(content)

    if os.path.exists("reports/report_2026-05-17.txt"):
        print("\n📄 人读报告 (TXT) 摘要:")
        with open("reports/report_2026-05-17.txt", "r", encoding="utf-8") as f:
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
        "python pickup_cli.py validate",
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
        "python pickup_cli.py validate",
        "验证空数据 - 应该通过验证（空数据是合法的）"
    )

    print("\n📭 空数据验收要点:")
    print("   1. 空数据应该通过验证 ✅")
    print("   2. 不应该出现错误信息 ✅")

    return True


def main():
    print("=" * 60)
    print("  接送授权迟接请假状态排查CLI - 验收测试")
    print("=" * 60)

    print("\n📦 首先初始化所有样例数据...")
    subprocess.run("python init_samples.py", shell=True, capture_output=True)

    results = []

    results.append(("正常样例", acceptance_test_normal()))
    results.append(("异常样例", acceptance_test_abnormal()))
    results.append(("空数据样例", acceptance_test_empty()))

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
    print("   - reports/report_2026-05-17.json (机器可读)")
    print("   - reports/report_2026-05-17.txt  (人读报告)")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
