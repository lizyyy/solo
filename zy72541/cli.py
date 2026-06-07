import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DataStore
from core import AlertProcessor
from exporter import ExportManager
from demo import DemoDataLoader


def main():
    parser = argparse.ArgumentParser(description="客服知识片段过期预警系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="加载演示数据")

    list_parser = subparsers.add_parser("list", help="列出数据")
    list_parser.add_argument("--type", choices=["batches", "results", "annotations"], default="results", help="数据类型")

    export_parser = subparsers.add_parser("export", help="导出预警结果")
    export_parser.add_argument("--batch", help="批次ID，不传则导出全部")
    export_parser.add_argument("--output", help="输出文件名")

    process_parser = subparsers.add_parser("process", help="处理批次")
    process_parser.add_argument("--batch", required=True, help="批次ID")
    process_parser.add_argument("--operator", default="system", help="操作人")

    rerun_parser = subparsers.add_parser("rerun", help="重跑批次")
    rerun_parser.add_argument("--batch", required=True, help="批次ID")
    rerun_parser.add_argument("--operator", default="system", help="操作人")

    show_parser = subparsers.add_parser("show", help="查看详情")
    show_parser.add_argument("--id", required=True, help="结果ID")

    args = parser.parse_args()

    if args.command == "demo":
        cmd_demo()
    elif args.command == "list":
        cmd_list(args.type)
    elif args.command == "export":
        cmd_export(args.batch, args.output)
    elif args.command == "process":
        cmd_process(args.batch, args.operator)
    elif args.command == "rerun":
        cmd_rerun(args.batch, args.operator)
    elif args.command == "show":
        cmd_show(args.id)
    else:
        parser.print_help()


def cmd_demo():
    loader = DemoDataLoader()
    loader.load_full_demo()


def cmd_list(data_type: str):
    store = DataStore()
    if data_type == "batches":
        batches = store.get_all_batches()
        print(f"\n📦 批次列表 (共{len(batches)}个)")
        for b in batches:
            status = "✓ 已处理" if b.processed else "⏳ 待处理"
            print(f"  {b.batch_id}: {b.name} - {status}, {len(b.records)}条记录")
    elif data_type == "results":
        results = store.get_all_results()
        print(f"\n📋 预警结果 (共{len(results)}条)")
        for r in results:
            print(f"  {r.result_id} | {r.session_id} | 预警:{r.alert_status.value} | 脱敏:{r.desensitization_status.value} | v{r.version}")
    elif data_type == "annotations":
        anns = store.get_all_annotations()
        print(f"\n📝 标注员留言 (共{len(anns)}条)")
        for a in anns:
            print(f"  {a.annotation_id} | {a.session_id} | 标注员:{a.annotator} | {a.on_site_statement[:30]}...")


def cmd_export(batch_id: str = None, output: str = None):
    store = DataStore()
    exporter = ExportManager()

    if batch_id:
        results = store.get_results_by_batch(batch_id)
    else:
        results = store.get_all_results()

    path = exporter.export_results_to_excel(results, filename=output, batch_id=batch_id or "")
    print(f"✓ 导出完成: {path}")
    print(f"  共导出 {len(results)} 条记录")


def cmd_process(batch_id: str, operator: str):
    store = DataStore()
    processor = AlertProcessor()
    batch = store.get_batch(batch_id)
    if not batch:
        print(f"✗ 批次不存在: {batch_id}")
        return

    results = processor.process_batch(batch, operator=operator)
    print(f"✓ 批次处理完成，生成 {len(results)} 条预警结果")
    for r in results:
        print(f"  {r.session_id}: {r.alert_status.value}")


def cmd_rerun(batch_id: str, operator: str):
    processor = AlertProcessor()
    results = processor.rerun_batch(batch_id, operator=operator)
    print(f"✓ 批次重跑完成，共 {len(results)} 条结果")


def cmd_show(result_id: str):
    store = DataStore()
    result = store.get_result(result_id)
    if not result:
        print(f"✗ 结果不存在: {result_id}")
        return

    print(f"\n{'='*60}")
    print(f"  预警结果详情 - {result.result_id}")
    print(f"{'='*60}")
    print(f"  批次号:     {result.batch_id}")
    print(f"  会话ID:     {result.session_id}")
    print(f"  知识片段ID: {result.knowledge_id}")
    print(f"  原始问题:   {result.original_question}")
    print(f"  当前口径:   {result.current_answer}")
    print(f"  标注员留言: {result.annotation_remark or '-'}")
    print(f"  现场说法:   {result.on_site_statement or '-'}")
    print(f"  预警状态:   {result.alert_status.value}")
    print(f"  脱敏状态:   {result.desensitization_status.value}")
    print(f"  证据来源:   {result.evidence_source.value}")
    print(f"  发现手机号: {result.raw_phone_found or '无'}")
    print(f"  处理人:     {result.processed_by or '-'}")
    print(f"  处理时间:   {result.processed_at or '-'}")
    print(f"  版本:       v{result.version}")
    print(f"\n📜 操作历史:")
    for h in result.history:
        print(f"  [{h.get('time', '')}] v{h.get('version', 1)} | {h.get('operator', '')} | {h.get('action', '')}")
        print(f"    → {h.get('detail', '')}")


if __name__ == "__main__":
    main()
