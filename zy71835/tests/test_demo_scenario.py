"""
测试场景脚本

模拟用户提到的场景：
1. 单位表早到
2. 地形规则晚补
3. 战报文本手工改动
4. 补传地形规则旧版本
5. 导出复盘报告
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from robot_football_tactics.models.base import VersionInfo
from robot_football_tactics.parsers.unit_table_parser import UnitTableParser
from robot_football_tactics.parsers.terrain_parser import TerrainRulesParser
from robot_football_tactics.parsers.battle_report_parser import BattleReportParser
from robot_football_tactics.parsers.settlement_parser import BattleSettlementParser
from robot_football_tactics.versioning.version_tracker import VersionTracker
from robot_football_tactics.comparison.comparison_engine import ComparisonEngine
from robot_football_tactics.exporter.review_exporter import ReviewReportExporter
from robot_football_tactics.errors.friendly_errors import FriendlyError

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data")


def load_file(filepath: str) -> str:
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def get_file_type(filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    if ext in ['csv', 'json', 'txt']:
        return ext
    return 'txt'


def run_demo():
    print("=" * 70)
    print("🤖 机器人足球战术 - 战报结算一致性核查工具")
    print("=" * 70)
    print()

    print("场景说明：")
    print("  1. 第一天早上：数值同学先提交了单位表 v1（早到）")
    print("  2. 第一天下午：策划同学提交了不完整的地形规则 v1（缺少效果）")
    print("  3. 第一天晚上：测试同学提交了战报 v1 和结算 v1，开始比对")
    print("  4. 第二天早上：策划同学补充了完整的地形规则 v2（晚补，标记为补材料）")
    print("  5. 第二天中午：策划同学发现有个旧版本地形规则 v0，补传上来（时间戳更早）")
    print("  6. 第二天下午：数值同学调整了 B001 的攻击力（改结论，不是补材料）")
    print("  7. 第二天晚上：测试同学手工修改了战报 v2，添加了一个进球")
    print("  8. 第三天早上：导出复盘报告")
    print()

    tracker = VersionTracker()

    base_time = datetime(2024, 6, 10, 9, 0, 0)

    print("-" * 50)
    print("📥 步骤 1：第一天早上 9:00 - 数值提交单位表 v1（早到）")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "unit_table_v1.csv"))
    version = VersionInfo(
        version_id="001",
        submitted_at=base_time,
        submitted_by="数值-小王",
        comment="初始单位表，A队B队各3人"
    )
    parser = UnitTableParser()
    unit_table, warnings = parser.parse(content, "csv", version)
    is_new, changes, warns = tracker.add_document(
        "unit_table", "半决赛单位表", version, unit_table,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载单位表 v1，共 {len(unit_table.units)} 个单位")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")
    print()

    print("-" * 50)
    print("📥 步骤 2：第一天下午 14:00 - 策划提交地形规则 v1（不完整，缺少效果）")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "terrain_rules_v1.txt"))
    version = VersionInfo(
        version_id="001",
        submitted_at=base_time + timedelta(hours=5),
        submitted_by="策划-小李",
        comment="先传个框架，效果明天补"
    )
    parser = TerrainRulesParser()
    terrain, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "terrain_rules", "半决赛地形规则", version, terrain,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载地形规则 v1，共 {len(terrain.rules)} 条规则（缺少效果）")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")
    print()

    print("-" * 50)
    print("📥 步骤 3：第一天晚上 20:00 - 测试提交战报 v1 和结算 v1，开始比对")
    print("-" * 50)

    content = load_file(os.path.join(SAMPLE_DIR, "battle_report_v1.txt"))
    version = VersionInfo(
        version_id="001",
        submitted_at=base_time + timedelta(hours=11),
        submitted_by="测试-小张",
        comment="自动生成的战报"
    )
    parser = BattleReportParser()
    report, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "battle_report", "半决赛战报", version, report,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载战报 v1，共 {len(report.events)} 个事件")
    if report.manual_modified:
        print(f"⚠️  检测到战报有手工改动痕迹！")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")

    content = load_file(os.path.join(SAMPLE_DIR, "battle_settlement_v1.txt"))
    version = VersionInfo(
        version_id="001",
        submitted_at=base_time + timedelta(hours=11, minutes=30),
        submitted_by="测试-小张",
        comment="自动生成的结算"
    )
    parser = BattleSettlementParser()
    settlement, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "battle_settlement", "半决赛结算", version, settlement,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载结算 v1，共 {len(settlement.items)} 项结算")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")

    print()
    print("🔍 第一次比对（使用不完整的地形规则）：")
    engine = ComparisonEngine(unit_table=unit_table, terrain_rules=terrain)
    result = engine.compare(report, settlement)
    print(result.to_human_string())
    print()

    print("-" * 50)
    print("📥 步骤 4：第二天早上 9:00 - 策划补充完整地形规则 v2（标记为补材料）")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "terrain_rules_v2_complete.txt"))
    version = VersionInfo(
        version_id="002",
        submitted_at=base_time + timedelta(days=1, hours=0),
        submitted_by="策划-小李",
        comment="补上了地形效果，只是补材料，不影响结论"
    )
    parser = TerrainRulesParser()
    terrain_v2, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "terrain_rules", "半决赛地形规则", version, terrain_v2,
        is_material_only=True, detect_backdate=True
    )
    print(f"✅ 已加载地形规则 v2，共 {len(terrain_v2.rules)} 条规则")
    print(f"变更统计：{len(changes)} 处变更")
    for change in changes:
        icon = "🔴" if change.affects_conclusion else "📝"
        print(f"   {icon} {change.human_description}")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")

    print()
    print("🔍 第二次比对（使用完整地形规则，标记为补材料）：")
    engine = ComparisonEngine(unit_table=unit_table, terrain_rules=terrain_v2)
    result = engine.compare(report, settlement)
    print(result.to_human_string())
    print()

    print("-" * 50)
    print("📥 步骤 5：第二天中午 12:00 - 策划补传旧版本地形规则 v0（时间更早！）")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "terrain_rules_v0_old_backdate.txt"))
    version = VersionInfo(
        version_id="000",
        submitted_at=base_time - timedelta(days=1),
        submitted_by="策划-小李",
        comment="哎呀，找到一个更早的版本，你们看看用哪个"
    )
    parser = TerrainRulesParser()
    terrain_v0, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "terrain_rules", "半决赛地形规则", version, terrain_v0,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载地形规则 v0（旧版本），共 {len(terrain_v0.rules)} 条规则")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")
    print()

    print("-" * 50)
    print("📥 步骤 6：第二天下午 15:00 - 数值调整 B001 攻击力（改结论！不是补材料）")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "unit_table_v3_breaking.csv"))
    version = VersionInfo(
        version_id="003",
        submitted_at=base_time + timedelta(days=1, hours=6),
        submitted_by="数值-小王",
        comment="B001攻击力从95调到100，平衡性调整"
    )
    parser = UnitTableParser()
    unit_table_v3, warnings = parser.parse(content, "csv", version)
    is_new, changes, warns = tracker.add_document(
        "unit_table", "半决赛单位表", version, unit_table_v3,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载单位表 v3")
    print(f"变更统计：{len(changes)} 处变更")
    for change in changes:
        icon = "🔴" if change.affects_conclusion else "📝"
        print(f"   {icon} {change.human_description}")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")
    print()

    print("-" * 50)
    print("📥 步骤 7：第二天晚上 20:00 - 测试手工修改战报 v2，添加了一个进球")
    print("-" * 50)
    content = load_file(os.path.join(SAMPLE_DIR, "battle_report_v2_manual_modified.txt"))
    version = VersionInfo(
        version_id="002",
        submitted_at=base_time + timedelta(days=1, hours=11),
        submitted_by="测试-小张",
        comment="刚才那个进球漏记了，我手动加上"
    )
    parser = BattleReportParser()
    report_v2, warnings = parser.parse(content, "txt", version)
    is_new, changes, warns = tracker.add_document(
        "battle_report", "半决赛战报", version, report_v2,
        is_material_only=False, detect_backdate=True
    )
    print(f"✅ 已加载战报 v2，共 {len(report_v2.events)} 个事件")
    if report_v2.manual_modified:
        print(f"⚠️  检测到战报有手工改动痕迹！")
    print(f"变更统计：{len(changes)} 处变更")
    for change in changes:
        icon = "🔴" if change.affects_conclusion else "📝"
        print(f"   {icon} {change.human_description}")
    for w in warns:
        print(f"⚠️  {w.to_human_string()}")
    print()

    print("🔍 最终比对（使用手工修改的战报和最新单位表）：")
    engine = ComparisonEngine(unit_table=unit_table_v3, terrain_rules=terrain_v2)
    result = engine.compare(report_v2, settlement)
    print(result.to_human_string())
    print()

    print("-" * 50)
    print("📤 步骤 8：第三天早上 - 导出复盘报告")
    print("-" * 50)
    exporter = ReviewReportExporter(tracker)
    review_report = exporter.generate_report(
        title="半决赛 A队vsB队 复盘报告",
        comparison_report=result,
        action_items=[
            "请策划确认使用哪个版本的地形规则",
            "请数值确认B001攻击力调整是否正确",
            "请测试确认战报手工修改的进球是否有效",
            "重新比对确认最终结果"
        ],
        notes=[
            "本次提测涉及多次补材料和手工改动，请务必确认所有变更的影响",
            "地形规则有3个版本，其中v0是补传的旧版本"
        ]
    )

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)

    text_path = os.path.join(output_dir, "review_report.txt")
    json_path = os.path.join(output_dir, "review_report.json")

    exporter.export_text(review_report, text_path)
    exporter.export_json(review_report, json_path)

    print(f"✅ 复盘报告已导出：")
    print(f"   文本格式：{text_path}")
    print(f"   JSON格式：{json_path}")
    print()

    print("=" * 70)
    print("📋 版本追踪总结：")
    print("=" * 70)
    print(tracker.generate_version_report())
    print()

    print("=" * 70)
    print("🎉 演示完成！")
    print("=" * 70)
    print()
    print("核心特性总结：")
    print("  ✅ 错误提示像人话，没有内部字段名")
    print("  ✅ 区分补材料（地形规则v2）和改结论（单位表v3、战报v2）")
    print("  ✅ 补传旧版本（地形规则v0）会提醒，不会静默覆盖")
    print("  ✅ 检测战报手工改动痕迹")
    print("  ✅ 复盘报告包含完整时间线、变更详情、原始材料")
    print("  ✅ 下一班同事看报告就够，不用翻聊天记录")
    print()

    return result


if __name__ == "__main__":
    try:
        run_demo()
    except FriendlyError as e:
        print(f"\n❌ 出错了：")
        print(e.to_human_string())
        print()
        print("技术细节（给开发同学）：")
        print(e.to_tech_string())
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 未知错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
