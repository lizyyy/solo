#!/usr/bin/env python3
"""测试替补递补逻辑修复和结果稳定性"""

from datetime import datetime, date
from checkin_cli.models import Player, Group, Material, Substitute, CheckinEvent, ValidationStatus
from checkin_cli.engine import run_full_validation


def test_substitute_promotion_logic():
    """测试：选手因原组性别限制失败，但符合目标组G1资格，应该被递补"""
    print("=" * 60)
    print("测试1: 替补递补逻辑 (原组不通过但目标组通过)")
    print("=" * 60)

    players = [
        Player(
            player_id="P001",
            name="正式选手1",
            gender="男",
            birth_date=date(1995, 1, 1),
            group_id="G1",
        ),
        Player(
            player_id="P002",
            name="替补选手",
            gender="男",
            birth_date=date(1995, 6, 1),
            group_id="WAIT",
        ),
    ]

    groups = [
        Group(
            group_id="G1",
            group_name="男子组",
            min_age=18,
            max_age=40,
            allowed_gender="男",
            max_players=2,
            require_materials=["身份证"],
        ),
        Group(
            group_id="WAIT",
            group_name="等待组",
            min_age=18,
            max_age=40,
            allowed_gender="女",
            max_players=10,
            require_materials=["身份证"],
        ),
    ]

    materials = [
        Material(player_id="P001", material_type="身份证", material_status="已验证"),
        Material(player_id="P002", material_type="身份证", material_status="已验证"),
    ]

    substitutes = [
        Substitute(player_id="P002", target_group_id="G1", priority=1),
    ]

    checkins: list[CheckinEvent] = []

    report = run_full_validation(players, groups, materials, substitutes, checkins)

    p002_qual = next(pq for pq in report.player_qualifications if pq.player.player_id == "P002")

    print(f"\n选手 P002 原报名组: WAIT (女性组)")
    print(f"选手 P002 性别: 男")
    print(f"替补目标组: G1 (男子组, 最大人数: 2)")
    print(f"\n递补后选手组别: {p002_qual.player.group_id}")
    print(f"是否被标记为替补: {p002_qual.is_substitute}")
    print(f"选手资格状态: {p002_qual.overall_status}")
    print(f"是否合格: {p002_qual.is_qualified}")
    print(f"发现问题数: {len(p002_qual.issues)}")
    for issue in p002_qual.issues:
        print(f"  - [{issue.rule_type}] {issue.message}")

    print(f"\n报告统计:")
    print(f"  总选手: {report.total_players}")
    print(f"  资格通过: {report.qualified_count}")
    print(f"  资格不通过: {report.disqualified_count}")

    assert p002_qual.player.group_id == "G1", f"期望 P002 被递补到 G1，实际: {p002_qual.player.group_id}"
    assert p002_qual.is_substitute == True, "期望 is_substitute = True"
    assert p002_qual.is_qualified == True, "期望 P002 在 G1 组应该合格"

    print("\n✅ 替补递补逻辑测试通过!")
    return True


def test_stable_report_id():
    """测试：相同输入重复运行产生相同的 report_id"""
    print("\n" + "=" * 60)
    print("测试2: 重复运行结果稳定性 (report_id)")
    print("=" * 60)

    players = [
        Player(player_id="P001", name="测试选手", gender="男", birth_date=date(1995, 1, 1), group_id="G1"),
    ]
    groups = [
        Group(group_id="G1", group_name="测试组", max_players=10, require_materials=[]),
    ]
    materials: list[Material] = []
    substitutes: list[Substitute] = []
    checkins: list[CheckinEvent] = []

    report1 = run_full_validation(players, groups, materials, substitutes, checkins)
    report2 = run_full_validation(players, groups, materials, substitutes, checkins)

    print(f"第一次运行 report_id: {report1.report_id}")
    print(f"第二次运行 report_id: {report2.report_id}")

    assert report1.report_id == report2.report_id, f"期望两次运行 report_id 相同，但 {report1.report_id} != {report2.report_id}"
    assert report1.qualified_count == report2.qualified_count
    assert report1.disqualified_count == report2.disqualified_count

    print("\n✅ 重复运行稳定性测试通过!")
    return True


def test_order_independence():
    """测试：输入顺序不影响结果"""
    print("\n" + "=" * 60)
    print("测试3: 输入顺序独立性")
    print("=" * 60)

    players1 = [
        Player(player_id="P002", name="选手B", gender="女", birth_date=date(1996, 1, 1), group_id="G1"),
        Player(player_id="P001", name="选手A", gender="男", birth_date=date(1995, 1, 1), group_id="G1"),
    ]
    players2 = sorted(players1, key=lambda p: p.player_id)

    groups = [Group(group_id="G1", group_name="测试组", max_players=10, require_materials=[])]
    materials: list[Material] = []
    substitutes: list[Substitute] = []
    checkins: list[CheckinEvent] = []

    report1 = run_full_validation(players1, groups, materials, substitutes, checkins)
    report2 = run_full_validation(players2, groups, materials, substitutes, checkins)

    print(f"乱序输入 report_id: {report1.report_id}")
    print(f"排序输入 report_id: {report2.report_id}")

    assert report1.report_id == report2.report_id, "期望输入顺序不影响 report_id"

    print("\n✅ 输入顺序独立性测试通过!")
    return True


def main():
    all_passed = True
    try:
        all_passed &= test_substitute_promotion_logic()
    except AssertionError as e:
        print(f"\n❌ 替补递补测试失败: {e}")
        all_passed = False
    except Exception as e:
        print(f"\n❌ 替补递补测试异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    try:
        all_passed &= test_stable_report_id()
    except AssertionError as e:
        print(f"\n❌ 稳定性测试失败: {e}")
        all_passed = False
    except Exception as e:
        print(f"\n❌ 稳定性测试异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    try:
        all_passed &= test_order_independence()
    except AssertionError as e:
        print(f"\n❌ 顺序独立性测试失败: {e}")
        all_passed = False
    except Exception as e:
        print(f"\n❌ 顺序独立性测试异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过!")
    else:
        print("⚠️  部分测试失败")
    print("=" * 60)
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
