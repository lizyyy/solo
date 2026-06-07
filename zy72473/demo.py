#!/usr/bin/env python3
"""
农贸市场装卸时窗 - 完整演示流程
社区书记周姐给新人讲流程用
"""
import os
import shutil
import sys

DEMO_DB = "data/demo_store.json"


def banner(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def section(title):
    print("\n" + "─" * 60)
    print(f"▶ {title}")
    print("─" * 60)


def wait():
    input("\n按回车继续...")


def run(cmd):
    print(f"\n$ {cmd}")
    os.system(f"python3 cli.py --db {DEMO_DB} {cmd}")


def main():
    if os.path.exists(DEMO_DB):
        os.remove(DEMO_DB)

    banner("🥬 农贸市场装卸时窗 - 完整流程演示")
    print("场景：社区书记周姐带新人小李走一遍完整流程")
    print("包含：新旧小区名映射 → 投诉导入 → 补照片 → 摘要生成 → 人工修正 → 重跑 → 复盘")
    wait()

    section("第零步：先登记小区新旧名称映射")
    print("（背景：市政最近把'阳光花园'更名为'阳光佳苑'，系统先记下来）")
    wait()
    run("alias --old 阳光花园 --new 阳光佳苑")
    wait()

    section("第一步：导入居民投诉编号 TS20260607-001")
    print("（注意：居民写的是旧名'阳光花园'，原始结论不能直接照抄）")
    wait()

    run(
        "import "
        "--no TS20260607-001 "
        "--community 阳光花园 "
        "--content '农贸市场北入口凌晨装卸货噪音大，影响3号楼居民休息，6月5日又发生了' "
        "--raw-conclusion '系统自动判定：该路段属于正常装卸时段，投诉不成立' "
        "--operator 小李"
    )
    wait()

    section("第二步：查看刚导入的投诉，发现系统自动打了复核标记")
    print("→ 关键点：同一小区有新旧两个名字，别急着归正常，留给市政巡检员复核")
    wait()
    run("show --cid TS20260607-001")
    wait()

    section("第三步：路口照片后来才补到群里，周姐回看时补上")
    print("（周姐翻了下微信群，发现今早有人发了路口照片）")
    wait()
    run(
        "add-photo "
        "--cid TS20260607-001 "
        "--file 农贸市场北入口_20260607_凌晨5点.jpg "
        "--operator 周姐"
    )
    wait()

    section("第四步：第一次生成给街道看的摘要")
    print("→ 摘要不是冷冰冰的系统日志，要写清：为什么留下、缺什么、找谁")
    wait()
    run("summary --cid TS20260607-001 --auto")
    wait()

    section("第五步：周姐做一次人工修正")
    print("（周姐回看照片，发现原始结论里的'正常时段'其实写得不对）")
    wait()

    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from models import DataStore
    from service import MarketLoadingService

    svc = MarketLoadingService(DataStore(DEMO_DB))
    svc.manual_correct(
        complaint_id="TS20260607-001",
        field="raw_conclusion",
        old_val="系统自动判定：该路段属于正常装卸时段，投诉不成立",
        new_val="系统自动判定：该路段属于正常装卸时段，投诉不成立（已人工修正：实际时段不在规定范围内）",
        operator="周姐"
    )
    print("✅ 周姐已人工修正：原始结论备注")
    print("   修正内容：标注'实际时段不在规定范围内'")
    wait()

    section("第六步：重跑一次摘要，补录照片后摘要自动跟着变")
    wait()
    run("summary --cid TS20260607-001 --auto")
    wait()

    section("第七步：看看完整的投诉详情（含所有版本摘要+操作日志）")
    wait()
    run("show --cid TS20260607-001")
    wait()

    section("第八步：复盘记录 - 每一步都有痕迹，可以重新跑")
    wait()
    run("replay --cid TS20260607-001")
    wait()

    section("演示完成！")
    print("\n📌 给新人小李的总结：")
    print("   1. 同一小区有新旧名字 → 自动标记待市政巡检员复核，不直接归正常")
    print("   2. 原始结论不能直接照抄 → 周姐看过照片后做人工修正")
    print("   3. 给街道的摘要 → 要说明：为什么留下、缺什么材料、下一步找谁")
    print("   4. 补录照片后 → 摘要会跟着变，要重跑一次")
    print("   5. 所有操作都有日志 → 随时可以复盘和重跑")
    print(f"\n💾 演示数据保存在：{DEMO_DB}")
    print(f"🔄 随时重跑：python3 cli.py --db {DEMO_DB} demo")


if __name__ == "__main__":
    main()
