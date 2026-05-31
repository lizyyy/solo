import sys
import argparse
import json
from datetime import datetime
from typing import List

from models import DrumRecord, Student, RecordStatus
from processor import RecordProcessor
from review import RecordReviewer
from exporter import SummaryExporter


def create_sample_records() -> List[DrumRecord]:
    students = [
        Student("S001", "张三", "高声部", "第一声部长"),
        Student("S002", "李四", "高声部", "第二声部长"),
        Student("S003", "王五", "低声部", "第一声部长"),
        Student("S004", "赵六", "低声部", "第二声部长"),
        Student("S005", "钱七", "中声部", "声部长"),
    ]

    records = [
        DrumRecord(
            record_id="R001",
            student=students[0],
            practice_date="2024-01-15",
            practice_content="基础节奏练习1-8小节",
            rhythm_accuracy=85.5,
            tempo_stability=88.0,
            overall_score=86.8,
            teacher_notes="节奏稳，继续保持",
            accompanist_notes="配合良好"
        ),
        DrumRecord(
            record_id="R002",
            student=students[1],
            practice_date="2024-01-15",
            practice_content="基础节奏练习1-8小节",
            rhythm_accuracy=82.0,
            tempo_stability=80.5,
            overall_score=81.2,
            teacher_notes="注意第5小节的切分音"
        ),
        DrumRecord(
            record_id="R003",
            student=students[2],
            practice_date="2024-01-15",
            practice_content="基础节奏练习1-8小节",
            rhythm_accuracy=90.0,
            tempo_stability=92.5,
            overall_score=91.2,
            teacher_notes="表现优秀"
        ),
        DrumRecord(
            record_id="R001_DUP",
            student=students[0],
            practice_date="2024-01-15",
            practice_content="基础节奏练习1-8小节",
            rhythm_accuracy=85.5,
            tempo_stability=88.0,
            overall_score=86.8,
            teacher_notes="节奏稳，继续保持",
            accompanist_notes="配合良好"
        ),
        DrumRecord(
            record_id="R004",
            student=students[3],
            practice_date="2024-01-16",
            practice_content="复合节奏练习",
            rhythm_accuracy=78.5,
            tempo_stability=75.0,
            overall_score=76.8,
            teacher_notes="需要多练习三连音"
        ),
        DrumRecord(
            record_id="R005",
            student=students[4],
            practice_date="2024-01-16",
            practice_content="复合节奏练习",
            rhythm_accuracy=88.0,
            tempo_stability=85.0,
            overall_score=86.5
        ),
    ]

    return records


def print_separator(title: str = ""):
    line = "=" * 60
    if title:
        print(f"\n{line}")
        print(f"  {title}")
        print(line)
    else:
        print(f"\n{line}")


def cmd_import_batch(args):
    processor = RecordProcessor()
    
    if args.sample:
        records = create_sample_records()
        batch_id = args.batch_id or f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = processor.process_batch(records, batch_id, "sample_data")
        
        print_separator(f"批次处理完成 - {batch_id}")
        print(f"总记录数: {result.total_records}")
        print(f"新增记录: {result.new_records}")
        print(f"重复记录: {result.duplicate_records}")
        print(f"冲突记录(待审核): {result.conflict_records}")
        print()
        
        for record in result.processed_records:
            status_icon = {
                RecordStatus.PROCESSED: "✅",
                RecordStatus.DUPLICATE: "⚠️",
                RecordStatus.CONFLICT: "❓",
                RecordStatus.PENDING: "⏳",
                RecordStatus.ARCHIVED: "📦"
            }.get(record.status, "❓")
            
            dup_info = ""
            if record.status == RecordStatus.DUPLICATE:
                dup_info = f" -> 重复于 {record.duplicate_of}"
            
            print(f"{status_icon} [{record.record.record_id}] {record.record.student.name} "
                  f"({record.record.practice_date}) - {record.status.value}{dup_info}")
    else:
        print("请提供数据文件路径或使用 --sample 参数导入示例数据")


def cmd_explain(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    
    explanation = reviewer.explain_record(args.record_id)
    
    if "error" in explanation:
        print(f"错误: {explanation['error']}")
        return
    
    print_separator(f"记录详情 - {args.record_id}")
    print(json.dumps(explanation, ensure_ascii=False, indent=2))


def cmd_stats(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    
    stats = reviewer.get_statistics()
    
    print_separator("统计概览")
    print(f"总记录数: {stats['total_records']}")
    print()
    
    print("状态分布:")
    for status, count in stats['status_breakdown'].items():
        print(f"  {status}: {count}")
    print()
    
    print("各声部统计:")
    for section, data in stats['by_section'].items():
        print(f"  {section}: 总计{data['total']}条, "
              f"有效{data['valid']}条, "
              f"重复{data['duplicate']}条, "
              f"待审核{data['conflict']}条")
    print()
    
    if stats['duplicate_reasons']:
        print("重复原因分布:")
        for reason, count in stats['duplicate_reasons'].items():
            print(f"  {reason}: {count}")
    
    if stats['batches']:
        print()
        print("批次统计:")
        for batch_id, count in stats['batches'].items():
            print(f"  {batch_id}: {count}条")


def cmd_duplicates(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    
    chains = reviewer.get_duplicate_chains()
    
    if not chains:
        print("没有发现重复记录链")
        return
    
    print_separator("重复记录链")
    for i, chain in enumerate(chains, 1):
        print(f"\n链 #{i}:")
        print(f"  原始记录: [{chain['original_id']}] "
              f"{chain['original_info']['student']} "
              f"({chain['original_info']['practice_date']})")
        print(f"  重复数量: {chain['duplicate_count']}")
        print("  重复记录:")
        for dup in chain['duplicates']:
            print(f"    - [{dup['record_id']}] (批次: {dup['batch_id']})")


def cmd_conflicts(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    
    conflicts = reviewer.get_conflicts_for_review()
    
    if not conflicts:
        print("没有待审核的冲突记录")
        return
    
    print_separator(f"待审核冲突记录 ({len(conflicts)}条)")
    for conflict in conflicts:
        print(f"\n[{conflict['record_id']}] {conflict['student']} "
              f"({conflict['practice_date']})")
        print(f"  练习内容: {conflict['practice_content']}")
        if 'conflict_info' in conflict:
            print(f"  同日已有记录: {conflict['conflict_info']['same_day_count']}条")
            print(f"  处理建议: {conflict['conflict_info']['action_required']}")


def cmd_resolve(args):
    processor = RecordProcessor()
    
    success = processor.resolve_conflict(
        record_id=args.record_id,
        is_duplicate=args.mark_duplicate,
        reviewer=args.reviewer,
        notes=args.notes or ""
    )
    
    if success:
        status = "重复" if args.mark_duplicate else "有效"
        print(f"✅ 记录 [{args.record_id}] 已标记为{status}")
    else:
        print("❌ 操作失败，请检查记录ID是否存在且处于冲突状态")


def cmd_export(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    exporter = SummaryExporter(processor, reviewer)
    
    sections = args.sections.split(',') if args.sections else None
    
    summary = exporter.export_rehearsal_summary(
        start_date=args.start_date,
        end_date=args.end_date,
        sections=sections,
        include_duplicates=args.include_duplicates
    )
    
    if args.format == 'json':
        filepath = exporter.export_to_json(summary, args.filename)
    else:
        filepath = exporter.export_to_csv(summary, args.filename)
    
    print(f"✅ 排练小结已导出: {filepath}")
    print(f"   有效记录: {summary['summary_counts']['valid_records']}条")
    print(f"   重复记录: {summary['summary_counts']['duplicate_records']}条")
    print(f"   待审核: {summary['summary_counts']['conflict_records']}条")


def cmd_student(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    exporter = SummaryExporter(processor, reviewer)
    
    report = exporter.export_student_report(args.student_key)
    
    if "error" in report:
        print(f"错误: {report['error']}")
        return
    
    print_separator(f"学生报告 - {report['student_info']['name']}")
    print(f"学号: {report['student_info']['student_id']}")
    print(f"声部: {report['student_info']['section']}")
    print(f"声部长: {report['student_info']['voice_part']}")
    print()
    print(f"总记录数: {report['total_records']}")
    print(f"有效记录: {report['valid_records']}")
    print(f"重复记录: {report['duplicate_records']}")
    print(f"待审核: {report['conflict_records']}")
    print()
    
    if 'performance_summary' in report:
        perf = report['performance_summary']
        print("表现汇总:")
        print(f"  平均分: {perf['avg_overall_score']}")
        print(f"  节奏准确率: {perf['avg_rhythm_accuracy']}")
        print(f"  速度稳定性: {perf['avg_tempo_stability']}")
        print(f"  练习天数: {perf['practice_days']}")
        print()
    
    print("练习记录:")
    for date, records in report['records_by_date'].items():
        print(f"  {date}:")
        for rec in records:
            status_icon = "✅" if rec['status_code'] == 'PROCESSED' else "⚠️" if rec['status_code'] == 'DUPLICATE' else "❓"
            print(f"    {status_icon} [{rec['record_id']}] {rec['practice_content']} - "
                  f"{rec['overall_score']}分 ({rec['status']})")


def cmd_export_batch(args):
    processor = RecordProcessor()
    reviewer = RecordReviewer(processor)
    exporter = SummaryExporter(processor, reviewer)
    
    summary = exporter.export_batch_summary(args.batch_id)
    
    if "error" in summary:
        print(f"错误: {summary['error']}")
        return
    
    filepath = exporter.export_to_json(summary, f"batch_{args.batch_id}.json")
    print(f"✅ 批次小结已导出: {filepath}")
    print(f"   总记录: {summary['total_records']}")
    print(f"   新增: {summary['new_records']}")
    print(f"   重复: {summary['duplicate_records']}")
    print(f"   待审核: {summary['conflict_records']}")


def main():
    parser = argparse.ArgumentParser(description="鼓组节奏复盘系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入批次数据")
    import_parser.add_argument("--sample", action="store_true", help="导入示例数据")
    import_parser.add_argument("--batch-id", help="批次ID")
    import_parser.set_defaults(func=cmd_import_batch)

    explain_parser = subparsers.add_parser("explain", help="解释单条记录")
    explain_parser.add_argument("record_id", help="记录ID")
    explain_parser.set_defaults(func=cmd_explain)

    stats_parser = subparsers.add_parser("stats", help="查看统计信息")
    stats_parser.set_defaults(func=cmd_stats)

    dup_parser = subparsers.add_parser("duplicates", help="查看重复记录链")
    dup_parser.set_defaults(func=cmd_duplicates)

    conflict_parser = subparsers.add_parser("conflicts", help="查看待审核冲突")
    conflict_parser.set_defaults(func=cmd_conflicts)

    resolve_parser = subparsers.add_parser("resolve", help="解决冲突记录")
    resolve_parser.add_argument("record_id", help="记录ID")
    resolve_parser.add_argument("--mark-duplicate", action="store_true", help="标记为重复")
    resolve_parser.add_argument("--reviewer", required=True, help="审核人")
    resolve_parser.add_argument("--notes", help="审核备注")
    resolve_parser.set_defaults(func=cmd_resolve)

    export_parser = subparsers.add_parser("export", help="导出排练小结")
    export_parser.add_argument("--format", choices=['json', 'csv'], default='csv', help="导出格式")
    export_parser.add_argument("--filename", help="导出文件名")
    export_parser.add_argument("--start-date", help="开始日期 (YYYY-MM-DD)")
    export_parser.add_argument("--end-date", help="结束日期 (YYYY-MM-DD)")
    export_parser.add_argument("--sections", help="声部过滤，逗号分隔")
    export_parser.add_argument("--include-duplicates", action="store_true", help="包含重复记录")
    export_parser.set_defaults(func=cmd_export)

    student_parser = subparsers.add_parser("student", help="查看学生报告")
    student_parser.add_argument("student_key", help="学生唯一键 (学号_姓名)")
    student_parser.set_defaults(func=cmd_student)

    batch_export_parser = subparsers.add_parser("export-batch", help="导出批次小结")
    batch_export_parser.add_argument("batch_id", help="批次ID")
    batch_export_parser.set_defaults(func=cmd_export_batch)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        print("\n快速开始:")
        print("  1. 导入示例数据: python cli.py import --sample")
        print("  2. 查看统计: python cli.py stats")
        print("  3. 查看重复: python cli.py duplicates")
        print("  4. 导出小结: python cli.py export")
        return

    args.func(args)


if __name__ == "__main__":
    main()
