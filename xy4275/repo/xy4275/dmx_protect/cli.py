"""
命令行入口模块

提供 init、import、check、review、report 等命令。
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from .models import (
    TheaterConfig, ProjectData, IssueType, ReviewDecision, Severity,
    Cue, Fixture, FixtureType, TriggerType, Modification, ChannelChange
)
from .storage import Storage
from .rules import RuleEngine
from .reporter import Reporter


def get_sample_cues() -> List[Cue]:
    """获取示例 CUE 数据（包含问题场景）"""
    return [
        Cue(
            cue_number="CUE_001",
            description="开场定点 - 主舞台",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={1: 200, 2: 150, 3: 100}
        ),
        Cue(
            cue_number="CUE_002",
            description="换景1 - 演员出场",
            trigger_type=TriggerType.TIME,
            trigger_value=4.5,
            duration=3.0,
            channels={1: 50, 2: 255, 3: 0, 10: 128}
        ),
        Cue(
            cue_number="CUE_003",
            description="烟机启动 - 场景氛围",
            trigger_type=TriggerType.TIME,
            trigger_value=7.0,
            duration=2.0,
            channels={20: 200, 21: 255}
        ),
        Cue(
            cue_number="CUE_004",
            description="升降台升起 - 道具上场",
            trigger_type=TriggerType.TIME,
            trigger_value=8.0,
            duration=5.0,
            channels={30: 180}
        ),
        Cue(
            cue_number="CUE_005",
            description="高潮场景 - 全亮",
            trigger_type=TriggerType.TIME,
            trigger_value=12.0,
            duration=10.0,
            channels={1: 255, 2: 255, 3: 255, 4: 255, 5: 255}
        ),
    ]


def get_sample_fixtures() -> List[Fixture]:
    """获取示例灯具数据"""
    return [
        Fixture(
            id="SPOT_001",
            name="聚光灯1 - 舞台左",
            type=FixtureType.SPOT,
            start_channel=1,
            channel_count=3,
            channels={"dimmer": 1, "pan": 2, "tilt": 3},
            requires_confirmation=False
        ),
        Fixture(
            id="WASH_001",
            name="染色灯1 - 舞台右",
            type=FixtureType.WASH,
            start_channel=4,
            channel_count=5,
            channels={"dimmer": 4, "r": 5, "g": 6, "b": 7, "w": 8},
            requires_confirmation=False
        ),
        Fixture(
            id="HAZER_001",
            name="烟机1 - 后舞台",
            type=FixtureType.HAZER,
            start_channel=20,
            channel_count=2,
            channels={"output": 20, "fan": 21},
            requires_confirmation=True
        ),
        Fixture(
            id="LIFT_001",
            name="升降台1 - 主舞台",
            type=FixtureType.LIFT,
            start_channel=30,
            channel_count=1,
            channels={"position": 30},
            requires_confirmation=True
        ),
    ]


def get_sample_modifications() -> List[Modification]:
    """获取示例修改记录"""
    return [
        Modification(
            id="MOD_001",
            cue_number="CUE_001",
            modified_at=datetime.now(),
            modified_by="李舞台",
            changes=[
                ChannelChange(channel=1, old_value=180, new_value=200, reason="导演要求更亮"),
                ChannelChange(channel=2, old_value=120, new_value=150, reason="调整色温"),
            ],
            confirmed=True
        ),
        Modification(
            id="MOD_002",
            cue_number="CUE_005",
            modified_at=datetime.now(),
            modified_by="王灯光",
            changes=[
                ChannelChange(channel=1, old_value=200, new_value=255, reason="高潮场景全亮"),
            ],
            confirmed=False
        ),
    ]


def print_banner():
    """打印程序横幅"""
    banner = r"""
╔══════════════════════════════════════════════════════════════╗
║                    换景灯光防撞器                               ║
║                 DMX 演出线索核对工具                            ║
╠══════════════════════════════════════════════════════════════╣
║  功能: 通道冲突检测 | 时间重叠检测 | 危险跳变检测 | 安全确认  ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def cmd_init(args: argparse.Namespace) -> int:
    """init 命令: 初始化剧场配置"""
    storage = Storage(args.config_dir)
    
    existing_config = storage.load_config()
    if existing_config and not args.force:
        print(f"错误: 配置已存在于 {storage.config_dir}")
        print(f"使用 --force 参数覆盖现有配置")
        return 1
    
    config = TheaterConfig(
        name=args.name,
        total_channels=args.total_channels,
        dangerous_jump_threshold=args.threshold
    )
    
    if storage.save_config(config):
        print(f"✅ 剧场配置已初始化")
        print(f"   剧场名称: {config.name}")
        print(f"   总通道数: {config.total_channels}")
        print(f"   跳变阈值: {config.dangerous_jump_threshold}")
        print(f"   配置目录: {storage.config_dir}")
        return 0
    else:
        print("❌ 保存配置失败")
        return 1


def cmd_import(args: argparse.Namespace) -> int:
    """import 命令: 导入数据"""
    storage = Storage(args.config_dir)
    
    config = storage.load_config()
    if config is None:
        print("❌ 错误: 未找到剧场配置，请先运行 init 命令")
        return 1
    
    success_count = 0
    total_count = 0
    
    if args.cue:
        total_count += 1
        print(f"📥 导入 CUE 表: {args.cue}")
        if storage.import_cues_from_csv(args.cue):
            cues = storage.load_cues()
            print(f"   ✅ 成功导入 {len(cues)} 个 CUE")
            success_count += 1
        else:
            print(f"   ❌ 导入失败")
    
    if args.patch:
        total_count += 1
        print(f"📥 导入灯具 Patch: {args.patch}")
        if storage.import_fixtures_from_json(args.patch):
            fixtures = storage.load_fixtures()
            print(f"   ✅ 成功导入 {len(fixtures)} 个灯具")
            success_count += 1
        else:
            print(f"   ❌ 导入失败")
    
    if args.modifications:
        total_count += 1
        print(f"📥 导入修改记录: {args.modifications}")
        if storage.import_modifications_from_json(args.modifications):
            mods = storage.load_modifications()
            print(f"   ✅ 成功导入 {len(mods)} 条修改记录")
            success_count += 1
        else:
            print(f"   ❌ 导入失败")
    
    if total_count == 0:
        print("ℹ️ 未指定任何要导入的文件")
        print("   使用 --cue、--patch 或 --modifications 参数")
        return 0
    
    if success_count == total_count:
        print(f"\n✅ 全部 {total_count} 个文件导入成功")
        return 0
    else:
        print(f"\n⚠️ 部分导入失败: {success_count}/{total_count}")
        return 1


def cmd_check(args: argparse.Namespace) -> int:
    """check 命令: 运行检测"""
    storage = Storage(args.config_dir)
    project = storage.load_project_data()
    
    if not project.cues:
        print("❌ 错误: 未找到 CUE 数据，请先导入 CUE 表")
        return 1
    
    print(f"🔍 开始检测...")
    print(f"   CUE 数量: {len(project.cues)}")
    print(f"   灯具数量: {len(project.fixtures)}")
    print()
    
    engine = RuleEngine(project)
    all_issues = []
    
    check_types = args.type if args.type else ["all"]
    
    if "all" in check_types or "channel_conflict" in check_types:
        print("📌 检测通道冲突...")
        issues = engine.check_channel_conflict()
        all_issues.extend(issues)
        print(f"   发现 {len(issues)} 个问题")
    
    if "all" in check_types or "time_overlap" in check_types:
        print("📌 检测时间重叠...")
        issues = engine.check_time_overlap()
        all_issues.extend(issues)
        print(f"   发现 {len(issues)} 个问题")
    
    if "all" in check_types or "dangerous_jump" in check_types:
        print("📌 检测危险跳变...")
        issues = engine.check_dangerous_jump()
        all_issues.extend(issues)
        print(f"   发现 {len(issues)} 个问题")
    
    if "all" in check_types or "missing_confirmation" in check_types:
        print("📌 检测安全确认缺失...")
        issues = engine.check_missing_confirmation()
        all_issues.extend(issues)
        print(f"   发现 {len(issues)} 个问题")
    
    print()
    
    critical_count = sum(1 for i in all_issues if i.severity == Severity.CRITICAL)
    warning_count = sum(1 for i in all_issues if i.severity == Severity.WARNING)
    
    if all_issues:
        print("═" * 60)
        print(f"📊 检测结果汇总:")
        print(f"   🔴 严重问题: {critical_count}")
        print(f"   🟡 警告问题: {warning_count}")
        print(f"   📋 总计: {len(all_issues)} 个问题")
        print("═" * 60)
        print()
        
        for issue in all_issues:
            sev_icon = "🔴" if issue.severity == Severity.CRITICAL else "🟡"
            status_icon = "✅" if issue.is_resolved else "⚠️"
            print(f"{status_icon} [{issue.id}] {sev_icon} {issue.title}")
            print(f"   类型: {issue.type.value} | 级别: {issue.severity.value}")
            if issue.affected_cues:
                print(f"   影响 CUE: {', '.join(issue.affected_cues)}")
            if issue.affected_channels:
                print(f"   影响通道: {', '.join(map(str, issue.affected_channels))}")
            print()
        
        project.issues = all_issues
        storage.save_issues(all_issues)
        print(f"💾 问题列表已保存到: {storage.config_dir}")
        
        if critical_count > 0:
            print(f"\n⚠️ 注意: 检测到 {critical_count} 个严重问题，建议演出前修复!")
            return 2
        elif warning_count > 0:
            return 1
        return 0
    else:
        print("✅ 未检测到任何问题!")
        return 0


def cmd_review(args: argparse.Namespace) -> int:
    """review 命令: 人工判定"""
    storage = Storage(args.config_dir)
    project = storage.load_project_data()
    
    if args.list:
        if not project.issues:
            print("ℹ️ 未找到任何问题，请先运行 check 命令")
            return 0
        
        print("📋 问题列表:")
        print()
        
        for issue in project.issues:
            sev_icon = "🔴" if issue.severity == Severity.CRITICAL else "🟡"
            status_icon = "✅" if issue.is_resolved else "⚠️"
            decision = issue.review_decision.value if issue.is_resolved else "待处理"
            
            print(f"{status_icon} [{issue.id}] {sev_icon} {issue.title}")
            print(f"   判定状态: {decision}")
            if issue.review_comment:
                print(f"   判定注释: {issue.review_comment}")
            print()
        
        return 0
    
    if args.issue_id:
        issue = project.get_issue_by_id(args.issue_id)
        if not issue:
            print(f"❌ 未找到问题 ID: {args.issue_id}")
            return 1
        
        if args.decision:
            try:
                decision = ReviewDecision(args.decision.lower())
            except ValueError:
                print(f"❌ 无效的判定值: {args.decision}")
                print("   有效值: accept, reject, pending")
                return 1
            
            issue.review_decision = decision
            issue.review_comment = args.comment or ""
            issue.reviewed_at = datetime.now()
            issue.reviewed_by = args.reviewer or "未知用户"
            
            if storage.save_issues(project.issues):
                decision_desc = "接受（忽略）" if decision == ReviewDecision.ACCEPT else "拒绝（需要修复）"
                print(f"✅ 问题 [{issue.id}] 已判定: {decision_desc}")
                if issue.review_comment:
                    print(f"   注释: {issue.review_comment}")
                return 0
            else:
                print("❌ 保存判定失败")
                return 1
        
        print(f"📋 问题详情:")
        print(f"   ID: {issue.id}")
        print(f"   标题: {issue.title}")
        print(f"   类型: {issue.type.value}")
        print(f"   严重级别: {issue.severity.value}")
        print(f"   状态: {'已处理' if issue.is_resolved else '待处理'}")
        print()
        print("描述:")
        for line in issue.description.split('\n'):
            print(f"   {line}")
        
        return 0
    
    print("ℹ️ 请指定操作:")
    print("   --list: 列出所有问题")
    print("   --issue-id <ID>: 查看或判定指定问题")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    """report 命令: 导出报告"""
    storage = Storage(args.config_dir)
    project = storage.load_project_data()
    
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    reporter = Reporter(project)
    
    formats = args.format if args.format else ["all"]
    
    print(f"📄 生成报告到: {output_dir}")
    print()
    
    exported_files = []
    
    if "all" in formats or "markdown" in formats:
        print("   📝 生成 Markdown 报告...")
        md_file = reporter.export_markdown(str(output_dir))
        exported_files.append(md_file)
        print(f"      ✅ {md_file}")
    
    if "all" in formats or "json" in formats:
        print("   📋 生成 JSON 报告...")
        json_file = reporter.export_json(str(output_dir))
        exported_files.append(json_file)
        print(f"      ✅ {json_file}")
    
    if "all" in formats or "csv" in formats:
        print("   📊 生成 CSV 报告...")
        csv_files = reporter.export_csv(str(output_dir))
        exported_files.extend(csv_files)
        for f in csv_files:
            print(f"      ✅ {f}")
    
    print()
    print(f"✅ 报告生成完成!")
    print(f"   共导出 {len(exported_files)} 个文件")
    
    return 0


def cmd_example(args: argparse.Namespace) -> int:
    """example 命令: 生成示例数据"""
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📦 生成示例数据到: {output_dir}")
    print()
    
    cues = get_sample_cues()
    cues_csv_path = output_dir / "cues.csv"
    with open(cues_csv_path, 'w', encoding='utf-8', newline='') as f:
        import csv
        writer = csv.writer(f)
        writer.writerow([
            "cue_number", "description", "trigger_type",
            "trigger_value", "duration", "channels"
        ])
        for cue in cues:
            channels_str = str({k: v for k, v in cue.channels.items()})
            writer.writerow([
                cue.cue_number,
                cue.description,
                cue.trigger_type.value,
                cue.trigger_value,
                cue.duration,
                channels_str
            ])
    print(f"   ✅ CUE 表: {cues_csv_path}")
    
    fixtures = get_sample_fixtures()
    fixtures_json_path = output_dir / "patch.json"
    fixtures_data = {
        "fixtures": [f.to_dict() for f in fixtures]
    }
    with open(fixtures_json_path, 'w', encoding='utf-8') as f:
        json.dump(fixtures_data, f, ensure_ascii=False, indent=2)
    print(f"   ✅ 灯具 Patch: {fixtures_json_path}")
    
    modifications = get_sample_modifications()
    mods_json_path = output_dir / "mods.json"
    mods_data = {
        "modifications": [m.to_dict() for m in modifications]
    }
    with open(mods_json_path, 'w', encoding='utf-8') as f:
        json.dump(mods_data, f, ensure_ascii=False, indent=2)
    print(f"   ✅ 修改记录: {mods_json_path}")
    
    print()
    print("ℹ️ 示例数据说明:")
    print("   - CUE_001 和 CUE_002 有时间重叠（4.5s 开始冲突）")
    print("   - CUE_001 和 CUE_002 对通道 1、2、3 设置了不同值（通道冲突）")
    print("   - CUE_002 到 CUE_005 有亮度跳变（通道 2 从 255 降到 0）")
    print("   - HAZER_001 和 LIFT_001 需要安全确认（CUE_003、CUE_004）")
    print()
    print("💡 使用示例数据快速测试:")
    print(f"   python -m dmx_protect.cli init --name \"测试剧场\" --config-dir {output_dir}/config")
    print(f"   python -m dmx_protect.cli import --cue {cues_csv_path} --patch {fixtures_json_path} --config-dir {output_dir}/config")
    print(f"   python -m dmx_protect.cli check --config-dir {output_dir}/config")
    
    return 0


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        prog="dmx-protect",
        description="换景灯光防撞器 - DMX 演出线索核对工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  dmx-protect init --name "我的剧场"
  dmx-protect import --cue cues.csv --patch patch.json
  dmx-protect check
  dmx-protect review --list
  dmx-protect report --output ./report
        """
    )
    
    parser.add_argument(
        "--config-dir", "-C",
        default=None,
        help="配置目录路径（默认: ~/.dmx-protect）"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    init_parser = subparsers.add_parser("init", help="初始化剧场配置")
    init_parser.add_argument("--name", "-n", required=True, help="剧场名称")
    init_parser.add_argument("--total-channels", "-c", type=int, default=512, help="总通道数（默认 512）")
    init_parser.add_argument("--threshold", "-t", type=int, default=150, help="危险跳变阈值（默认 150）")
    init_parser.add_argument("--force", "-f", action="store_true", help="覆盖现有配置")
    
    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument("--cue", "-q", help="CUE 表 CSV 文件路径")
    import_parser.add_argument("--patch", "-p", help="灯具 Patch JSON 文件路径")
    import_parser.add_argument("--modifications", "-m", help="修改记录 JSON 文件路径")
    
    check_parser = subparsers.add_parser("check", help="运行检测")
    check_parser.add_argument(
        "--type", "-t",
        action="append",
        choices=["all", "channel_conflict", "time_overlap", "dangerous_jump", "missing_confirmation"],
        help="指定检测类型（可多次使用）"
    )
    
    review_parser = subparsers.add_parser("review", help="人工判定问题")
    review_parser.add_argument("--list", "-l", action="store_true", help="列出所有问题")
    review_parser.add_argument("--issue-id", "-i", help="问题 ID")
    review_parser.add_argument(
        "--decision", "-d",
        choices=["accept", "reject", "pending"],
        help="判定结果"
    )
    review_parser.add_argument("--comment", "-c", help="判定注释")
    review_parser.add_argument("--reviewer", "-r", help="判定人姓名")
    
    report_parser = subparsers.add_parser("report", help="导出报告")
    report_parser.add_argument("--output", "-o", required=True, help="输出目录")
    report_parser.add_argument(
        "--format", "-f",
        action="append",
        choices=["all", "markdown", "json", "csv"],
        help="输出格式（可多次使用）"
    )
    
    example_parser = subparsers.add_parser("example", help="生成示例数据")
    example_parser.add_argument("--output", "-o", required=True, help="输出目录")
    
    args = parser.parse_args()
    
    if not args.command:
        print_banner()
        parser.print_help()
        sys.exit(0)
    
    commands = {
        "init": cmd_init,
        "import": cmd_import,
        "check": cmd_check,
        "review": cmd_review,
        "report": cmd_report,
        "example": cmd_example,
    }
    
    if args.command in commands:
        sys.exit(commands[args.command](args))
    else:
        print(f"❌ 未知命令: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
