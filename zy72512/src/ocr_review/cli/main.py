import argparse
import json
import sys
from pathlib import Path
from typing import List

from ..storage.store import DataStore
from ..importer.ticket_importer import TicketImporter
from ..detector.phone_leak_detector import LeakDetector
from ..review.workflow import ReviewWorkflow
from ..exporter.export_manager import ExportManager
from ..report.report_generator import ReportGenerator
from ..audit.audit_checker import AuditChecker
from ..models.rule import MaskRule, RuleStatus, RuleType
from ..utils.mask import mask_text


def init_store(data_dir: str = "data") -> DataStore:
    return DataStore(base_dir=data_dir)


def cmd_init(args):
    """初始化系统，导入样例规则和数据"""
    store = init_store(args.data_dir)
    print("🚀 初始化发票 OCR 置信度复核系统...")

    samples_dir = Path("samples")
    if samples_dir.exists():
        rules_path = samples_dir / "sample_rules.json"
        if rules_path.exists():
            print(f"📋 导入脱敏规则: {rules_path}")
            with open(rules_path, "r", encoding="utf-8") as f:
                rules_data = json.load(f)
            for rd in rules_data:
                rd["rule_type"] = RuleType(rd["rule_type"])
                rd["status"] = RuleStatus(rd["status"])
                rule = MaskRule(**rd)
                store.save_rule(rule)
            print(f"   ✅ 导入了 {len(rules_data)} 条脱敏规则")

    print("\n✅ 初始化完成！")
    print(f"   数据目录: {store.base_dir.absolute()}")
    print(f"   使用 'python -m ocr_review.cli.main import' 导入样例工单")


def cmd_import(args):
    """导入工单数据"""
    store = init_store(args.data_dir)
    importer = TicketImporter(store)

    file_path = args.file
    if not file_path:
        file_path = "samples/sample_tickets.json"

    print(f"📥 导入工单数据: {file_path}")
    result = importer.import_from_json(file_path)

    if result.success:
        print(f"✅ 导入成功: {result.imported_count} 条工单")
        for tid in result.ticket_ids:
            print(f"   - {tid}")
    else:
        print(f"❌ 导入失败: {result.errors}")
        sys.exit(1)


def cmd_detect(args):
    """检测手机号漏遮"""
    store = init_store(args.data_dir)
    detector = LeakDetector(store)

    if args.ticket_id:
        ticket = store.load_ticket(args.ticket_id)
        if not ticket:
            print(f"❌ 工单 {args.ticket_id} 不存在")
            sys.exit(1)
        result = detector.detect_ticket(ticket)
        _print_detection_result(result)
    else:
        tickets = store.list_tickets()
        print(f"🔍 批量检测 {len(tickets)} 条工单...")
        results = detector.batch_detect(tickets)
        summary = detector.get_leak_summary(results)
        print(f"\n📊 检测汇总:")
        print(f"   总工单: {summary['total_tickets']}")
        print(f"   含泄露: {summary['tickets_with_leaks']} ({summary['leak_rate']}%)")
        print(f"   泄露字段: {summary['total_leaked_fields']}")
        if summary['leak_type_distribution']:
            print(f"   泄露类型: {summary['leak_type_distribution']}")
        print(f"\n📋 详情:")
        for result in results:
            if result.has_leaks:
                _print_detection_result(result, short=True)


def _print_detection_result(result, short=False):
    status = "🔴 发现泄露" if result.has_leaks else "🟢 无泄露"
    print(f"\n[{result.ticket_id}] {status} ({result.leaked_fields}/{result.total_fields} 字段)")
    if not short and result.leaks:
        for leak in result.leaks:
            print(f"   - {leak.field_name}: {leak.suggestion}")
            print(f"     OCR置信度: {leak.ocr_confidence}")


def cmd_review(args):
    """运营老唐复核工单"""
    store = init_store(args.data_dir)
    workflow = ReviewWorkflow(store)

    if args.list:
        tickets = workflow.list_tickets_for_role("operation")
        if not tickets:
            print("✅ 没有待运营处理的工单")
        else:
            print(f"📋 待运营老唐处理的工单 ({len(tickets)}):")
            for t in tickets:
                missing_info = ""
                if t.get("missing_materials"):
                    missing_info = f" - 还缺: {', '.join(t['missing_materials'])}"
                print(f"   [{t['ticket_id']}] {t['title']} - 泄露字段: {t['leak_count']}{missing_info}")
        return

    if not args.ticket_id:
        print("❌ 请指定 --ticket-id 或使用 --list 查看待处理工单")
        sys.exit(1)

    if args.notes:
        notes = json.loads(args.notes)
    else:
        notes = [{"field_name": None, "note": args.note or "运营已查看，需补充脱敏规则"}]

    result = workflow.operation_review(args.ticket_id, notes, reviewer="老唐")

    ticket = store.load_ticket(args.ticket_id)
    if args.set_missing:
        missing_map = json.loads(args.set_missing)
        for field_name, materials in missing_map.items():
            ticket.set_missing_materials(field_name, materials, author="老唐")
        store.save_ticket(ticket)
        print(f"   ✅ 已更新 {len(missing_map)} 个字段的缺材料清单")

    print(f"\n📝 复核结果:")
    print(f"   工单: {result.ticket_id}")
    print(f"   状态: {result.previous_status.value} → {result.new_status.value}")
    print(f"   消息: {result.message}")
    if ticket.change_logs:
        latest = ticket.change_logs[-1]
        print(f"   变更ID: {latest.change_id} ({latest.change_type})")
        if latest.affected_exports:
            print(f"   影响导出: {', '.join(latest.affected_exports)}")


def cmd_algorithm(args):
    """算法同事复核工单"""
    store = init_store(args.data_dir)
    workflow = ReviewWorkflow(store)

    if args.list:
        tickets = workflow.list_tickets_for_role("algorithm")
        if not tickets:
            print("✅ 没有待算法处理的工单")
        else:
            print(f"📋 待算法同事处理的工单 ({len(tickets)}):")
            for t in tickets:
                low_conf = ""
                if t.get("low_confidence_fields"):
                    low_conf = f" - 低置信度字段: {', '.join(t['low_confidence_fields'])}"
                missing_info = ""
                if t.get("missing_materials"):
                    missing_info = f" - 还缺: {', '.join(t['missing_materials'])}"
                print(f"   [{t['ticket_id']}] {t['title']} - 泄露字段: {t['leak_count']}{low_conf}{missing_info}")
        return

    if not args.ticket_id:
        print("❌ 请指定 --ticket-id 或使用 --list 查看待处理工单")
        sys.exit(1)

    reviewer = args.reviewer or "算法同事"
    if args.notes:
        notes = json.loads(args.notes)
    else:
        notes = [{"field_name": None, "note": args.note or "算法已复核OCR结果"}]

    result = workflow.algorithm_review(args.ticket_id, notes, reviewer=reviewer)

    ticket = store.load_ticket(args.ticket_id)
    print(f"\n🔬 算法复核结果:")
    print(f"   工单: {result.ticket_id}")
    print(f"   状态: {result.previous_status.value} → {result.new_status.value}")
    print(f"   消息: {result.message}")
    if ticket and ticket.change_logs:
        latest = ticket.change_logs[-1]
        print(f"   变更ID: {latest.change_id} ({latest.change_type})")
        if latest.affected_exports:
            print(f"   影响导出: {', '.join(latest.affected_exports)}")


def cmd_export(args):
    """生成脱敏导出"""
    store = init_store(args.data_dir)
    exporter = ExportManager(store, output_dir=args.output_dir)

    if not args.ticket_id:
        print("❌ 请指定 --ticket-id")
        sys.exit(1)

    print(f"📤 生成工单 {args.ticket_id} 的脱敏导出...")
    output = exporter.generate_export(args.ticket_id, generated_by=args.generated_by or "system")

    print(f"✅ 导出完成:")
    print(f"   导出ID: {output.export_id}")
    print(f"   泄露风险: {'🔴 有' if output.has_leaks else '🟢 无'} ({output.leak_count} 字段)")
    print(f"   数据文件: {output.json_path}")
    print(f"   详细报告: {output.report_path}")
    print(f"   快速摘要: {output.summary_path}")


def cmd_report(args):
    """生成综合报告"""
    store = init_store(args.data_dir)
    generator = ReportGenerator(store, output_dir=args.output_dir)

    if args.dashboard:
        path = generator.generate_html_report()
        print(f"📊 HTML看板已生成: {path}")
        print(f"   用浏览器打开即可查看交互式图表")
    else:
        summary = generator.generate_text_summary()
        print(summary)


def cmd_audit(args):
    """脱敏复查审计"""
    checker = AuditChecker()

    if args.dir:
        print(f"🔍 审计目录: {args.dir}")
        results = checker.audit_directory(args.dir)
    elif args.file:
        print(f"🔍 审计文件: {args.file}")
        result = checker.audit_file(args.file)
        results = [result]
    else:
        print("❌ 请指定 --dir 或 --file")
        sys.exit(1)

    report = checker.generate_audit_report(results)
    print(f"\n{report}")


def cmd_demo(args):
    """运行完整演示流程"""
    print("=" * 60)
    print("🎬 发票 OCR 置信度复核 - 完整流程演示")
    print("=" * 60)

    args.file = None
    args.ticket_id = None
    args.dashboard = False

    store = init_store(args.data_dir)

    # 步骤1: 初始化
    print("\n📍 步骤1: 初始化系统")
    cmd_init(args)

    # 步骤2: 导入工单（导入时自动检测泄露）
    print("\n📍 步骤2: 导入线上反馈工单（导入时自动检测手机号漏遮）")
    cmd_import(args)

    # 步骤3: 人工触发检测（验证已标记的泄露不会消失）
    print("\n📍 步骤3: 重新检测（验证手机号漏遮不会被掩盖）")
    cmd_detect(args)

    # 步骤4: 运营老唐复核 TICKET-001
    print("\n📍 步骤4: 算法运营老唐补看脱敏规则备注 (TICKET-001)")
    workflow = ReviewWorkflow(store)
    result_001 = workflow.operation_review(
        "TICKET-20260601-001",
        [
            {"field_name": "buyer_phone", "note": "已补充脱敏规则，该字段需按手机号规则遮蔽"},
            {"field_name": "seller_phone", "note": "已补充脱敏规则，文本中的手机号也需要处理"},
        ],
        reviewer="老唐",
    )
    print(f"   ✅ TICKET-001 运营复核完成")
    print(f"      状态: {result_001.previous_status.value} → {result_001.new_status.value}")
    print(f"      消息: {result_001.message}")

    # 步骤5: 运营老唐复核 TICKET-003（含低置信度身份证 → 自动升级算法）
    print("\n📍 步骤5: 运营老唐复核 TICKET-003（含OCR=0.58身份证）")
    result_003 = workflow.operation_review(
        "TICKET-20260601-003",
        [
            {"field_name": "remarks", "note": "已补充脱敏规则，文本中手机号纳入遮蔽"},
        ],
        reviewer="老唐",
    )
    print(f"   ✅ TICKET-003 运营复核完成")
    print(f"      状态: {result_003.previous_status.value} → {result_003.new_status.value}")
    print(f"      消息: {result_003.message}")
    print(f"      自动升级算法: {'是' if result_003.escalated_to_algorithm else '否'}")

    # 步骤5b: 验证算法待处理列表
    print("\n📍 步骤5b: 查看算法同事待处理列表")
    algo_tickets = workflow.list_tickets_for_role("algorithm")
    for t in algo_tickets:
        print(f"   [{t['ticket_id']}] 低置信度字段: {t.get('low_confidence_fields', [])} - 还缺: {', '.join(t.get('missing_materials', []))}")

    # 步骤6: 导出 TICKET-001（运营已完全复核 → 无风险）
    print("\n📍 步骤6: 脱敏导出 TICKET-001（运营复核完成 → 无风险）")
    exporter = ExportManager(store, output_dir=args.output_dir)
    output_001 = exporter.generate_export("TICKET-20260601-001", generated_by="demo")
    print(f"   ✅ 导出ID: {output_001.export_id}")
    print(f"      泄露风险: {'🔴 有' if output_001.has_leaks else '🟢 无'} ({output_001.leak_count} 字段)")

    # 步骤7: 导出 TICKET-003（运营已复核但算法未复核 → buyer_id_card 仍高风险）
    print("\n📍 步骤7: 脱敏导出 TICKET-003（运营已复核，但低置信度身份证仍🔴高风险）")
    output_003 = exporter.generate_export("TICKET-20260601-003", generated_by="demo")
    print(f"   ✅ 导出ID: {output_003.export_id}")
    print(f"      泄露风险: {'🔴 有' if output_003.has_leaks else '🟢 无'} ({output_003.leak_count} 字段)")

    # 步骤8: 算法同事复核 TICKET-003 低置信度字段
    print("\n📍 步骤8: 算法同事复核 TICKET-003 低置信度身份证字段")
    result_algo = workflow.algorithm_review(
        "TICKET-20260601-003",
        [
            {"field_name": "buyer_id_card", "note": "算法已确认识别结果正确，已调整OCR模型参数，确认识别无误"},
        ],
        reviewer="算法同事",
    )
    print(f"   ✅ TICKET-003 算法复核完成")
    print(f"      状态: {result_algo.previous_status.value} → {result_algo.new_status.value}")
    print(f"      消息: {result_algo.message}")

    # 步骤9: 重新导出 TICKET-003（算法+运营双重复核 → 无风险）
    print("\n📍 步骤9: 重新导出 TICKET-003（算法+运营双重复核 → 🟢无风险）")
    output_003_v2 = exporter.generate_export("TICKET-20260601-003", generated_by="demo")
    print(f"   ✅ 导出ID: {output_003_v2.export_id}")
    print(f"      泄露风险: {'🔴 有' if output_003_v2.has_leaks else '🟢 无'} ({output_003_v2.leak_count} 字段)")

    # 步骤10: 生成看板
    print("\n📍 步骤10: 生成综合报告看板")
    generator = ReportGenerator(store, output_dir=args.output_dir)
    path = generator.generate_html_report()
    print(f"   ✅ HTML看板: {path}")

    # 步骤11: 脱敏复查
    print("\n📍 步骤11: 脱敏复查（确保无原始号码）")
    checker = AuditChecker()
    results = checker.audit_directory(args.output_dir)
    report = checker.generate_audit_report(results)
    for line in report.split("\n")[:8]:
        print(f"   {line}")

    # 步骤12: 脱敏复查 data 目录
    print("\n📍 步骤12: 脱敏复查 data 目录")
    data_results = checker.audit_directory(args.data_dir)
    data_report = checker.generate_audit_report(data_results)
    for line in data_report.split("\n")[:8]:
        print(f"   {line}")

    print("\n" + "=" * 60)
    print("✅ 演示完成！核心验证点:")
    print("   1. 导入后detect能识别手机号漏遮（不会报0泄露）")
    print("   2. 低置信度身份证(OCR<0.7)自动留给算法同事复核")
    print("   3. 运营补备注后低置信度字段仍🔴高风险")
    print("   4. 算法复核后低置信度字段风险清除")
    print("   5. 所有输出物无原始敏感号码")
    print("=" * 60)


def build_parser():
    parser = argparse.ArgumentParser(
        prog="ocr-review",
        description="发票 OCR 置信度复核系统 - 手机号漏遮检测与脱敏复核工具",
    )
    parser.add_argument("--data-dir", default="data", help="数据存储目录 (默认: data)")
    parser.add_argument("--output-dir", default="output", help="输出目录 (默认: output)")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # init
    p_init = subparsers.add_parser("init", help="初始化系统，导入样例脱敏规则")
    p_init.set_defaults(func=cmd_init)

    # import
    p_import = subparsers.add_parser("import", help="导入线上反馈工单 (JSON格式)")
    p_import.add_argument("--file", help="工单JSON文件路径")
    p_import.set_defaults(func=cmd_import)

    # detect
    p_detect = subparsers.add_parser("detect", help="检测手机号在导出里漏遮")
    p_detect.add_argument("--ticket-id", help="指定工单ID检测，不指定则批量检测全部")
    p_detect.set_defaults(func=cmd_detect)

    # review (运营)
    p_review = subparsers.add_parser("review", help="运营老唐复核工单")
    p_review.add_argument("--list", action="store_true", help="列出待运营处理的工单")
    p_review.add_argument("--ticket-id", help="工单ID")
    p_review.add_argument("--note", help="备注内容")
    p_review.add_argument("--notes", help="JSON格式的备注数组")
    p_review.add_argument("--set-missing", help="JSON格式的缺材料补录，如 {\"buyer_phone\":[\"脱敏规则截图\",\"审批单\"]}")
    p_review.set_defaults(func=cmd_review)

    # algorithm (算法)
    p_algo = subparsers.add_parser("algorithm", help="算法同事复核工单")
    p_algo.add_argument("--list", action="store_true", help="列出待算法处理的工单")
    p_algo.add_argument("--ticket-id", help="工单ID")
    p_algo.add_argument("--reviewer", default="算法同事", help="复核人姓名")
    p_algo.add_argument("--note", help="备注内容")
    p_algo.add_argument("--notes", help="JSON格式的备注数组")
    p_algo.set_defaults(func=cmd_algorithm)

    # export
    p_export = subparsers.add_parser("export", help="生成脱敏导出报告")
    p_export.add_argument("--ticket-id", required=True, help="工单ID")
    p_export.add_argument("--generated-by", help="生成人")
    p_export.set_defaults(func=cmd_export)

    # report
    p_report = subparsers.add_parser("report", help="生成综合报告")
    p_report.add_argument("--dashboard", action="store_true", help="生成HTML交互式看板")
    p_report.set_defaults(func=cmd_report)

    # audit
    p_audit = subparsers.add_parser("audit", help="脱敏复查审计")
    p_audit.add_argument("--dir", help="审计目录")
    p_audit.add_argument("--file", help="审计单个文件")
    p_audit.set_defaults(func=cmd_audit)

    # demo
    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.set_defaults(func=cmd_demo)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
