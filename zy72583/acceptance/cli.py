import argparse
import sys
from .engine import AcceptanceEngine
from .demo_data import load_demo_data
from .storage import load_records, save_records, clear_storage


def _create_engine() -> AcceptanceEngine:
    engine = AcceptanceEngine()
    engine.records = load_records()
    return engine


def _save_engine(engine: AcceptanceEngine):
    save_records(engine.records)


def cmd_import(args, engine: AcceptanceEngine):
    record = engine.import_slice(
        slice_id=args.slice_id,
        name=args.name,
        offline_score=args.offline,
        online_score=args.online,
        query_count=args.count,
        tags=args.tags.split(",") if args.tags else [],
    )
    _save_engine(engine)
    print(f"✅ 导入成功，记录编号: {record.record_id}")
    print(f"   当前状态: {record.status.value}")
    print(f"   下一步: {record.next_step}")
    if record.slice.has_bucket_mismatch:
        print(f"   ⚠️  离线分桶={record.slice.offline_bucket.value}, 线上分桶={record.slice.online_bucket.value}，差{record.slice.bucket_diff}个桶")


def cmd_fill_feature(args, engine: AcceptanceEngine):
    record = engine.fill_feature_snapshot(
        record_id=args.record_id,
        snapshot_id=args.snapshot_id,
        feature_version=args.version,
        vector_dim=args.dim,
        index_type=args.index_type,
        remark=args.remark,
    )
    _save_engine(engine)
    print(f"✅ 特征快照补录完成")
    print(f"   快照编号: {record.feature_snapshot.snapshot_id}")
    print(f"   当前状态: {record.status.value}")
    print(f"   负责人: {record.assignee or '未分配'}")
    print(f"   下一步: {record.next_step}")
    if record.slice.has_bucket_mismatch:
        print(f"   ⚠️  离线分桶={record.slice.offline_bucket.value}, 线上分桶={record.slice.online_bucket.value}，差{record.slice.bucket_diff}个桶 → 留给评测运营复核")


def cmd_report(args, engine: AcceptanceEngine):
    report = engine.generate_report(args.record_id)
    print(report)


def cmd_list(args, engine: AcceptanceEngine):
    records = engine.list_records()
    if not records:
        print("暂无验收记录（用 import 命令导入第一条）")
        return
    print(f"{'记录ID':<14} {'切片名称':<25} {'状态':<12} {'负责人':<12} {'分桶差异':<8}")
    print("-" * 75)
    for r in records:
        bucket_info = f"差{r.slice.bucket_diff}桶" if r.slice.has_bucket_mismatch else "一致"
        print(f"{r.record_id:<14} {r.slice.name:<25} {r.status.value:<12} {r.assignee or '-':<12} {bucket_info:<8}")


def cmd_review(args, engine: AcceptanceEngine):
    record = engine.review_result(
        record_id=args.record_id,
        passed=args.passed,
        reviewer=args.reviewer,
        comment=args.comment,
    )
    _save_engine(engine)
    status = "通过" if args.passed else "驳回"
    print(f"✅ 复核{status}")
    print(f"   当前状态: {record.status.value}")
    print(f"   下一步: {record.next_step}")


def cmd_rerun(args, engine: AcceptanceEngine):
    record = engine.re_run(record_id=args.record_id, operator=args.operator)
    _save_engine(engine)
    print(f"✅ 已重跑")
    print(f"   当前状态: {record.status.value}")
    print(f"   下一步: {record.next_step}")
    if record.slice.has_bucket_mismatch:
        print(f"   ⚠️  仍有分桶差异，留给评测运营复核")


def cmd_correct(args, engine: AcceptanceEngine):
    record = engine.manual_correct(
        record_id=args.record_id,
        operator=args.operator,
        field=args.field,
        before=args.before,
        after=args.after,
        reason=args.reason,
    )
    _save_engine(engine)
    print(f"✅ 已记录人工修正")
    print(f"   当前状态: {record.status.value}")


def cmd_demo(args, engine: AcceptanceEngine):
    print("🎬 加载演示数据...")
    demo_records = load_demo_data(engine)
    _save_engine(engine)
    print(f"   已加载 {len(demo_records)} 条演示记录")
    print()
    print("📋 演示记录列表:")
    cmd_list(argparse.Namespace(), engine)
    print()
    print("📄 查看分桶不一致的记录详情:")
    cmd_report(argparse.Namespace(record_id=demo_records["bucket_mismatch_record"].record_id), engine)


def cmd_clear(args, engine: AcceptanceEngine):
    clear_storage()
    print("🧹 已清空所有验收记录")


def main():
    parser = argparse.ArgumentParser(description="向量索引召回验收工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    p_import = subparsers.add_parser("import", help="导入评测切片")
    p_import.add_argument("--slice-id", required=True, help="切片ID")
    p_import.add_argument("--name", required=True, help="切片名称")
    p_import.add_argument("--offline", type=float, required=True, help="离线分数")
    p_import.add_argument("--online", type=float, required=True, help="线上分数")
    p_import.add_argument("--count", type=int, default=1000, help="查询量")
    p_import.add_argument("--tags", default="", help="标签，逗号分隔")

    p_fill = subparsers.add_parser("fill-feature", help="补录特征快照编号")
    p_fill.add_argument("--record-id", required=True, help="验收记录ID (import命令生成的REC-XXXX)")
    p_fill.add_argument("--snapshot-id", required=True, help="特征快照编号")
    p_fill.add_argument("--version", default="v1.0.0", help="特征版本")
    p_fill.add_argument("--dim", type=int, default=768, help="向量维度")
    p_fill.add_argument("--index-type", default="HNSW", help="索引类型")
    p_fill.add_argument("--remark", default="", help="备注")

    p_report = subparsers.add_parser("report", help="生成验收报告")
    p_report.add_argument("--record-id", required=True, help="验收记录ID")

    subparsers.add_parser("list", help="列出所有记录")

    p_review = subparsers.add_parser("review", help="评测运营复核")
    p_review.add_argument("--record-id", required=True, help="验收记录ID")
    p_review.add_argument("--passed", action="store_true", help="是否通过")
    p_review.add_argument("--reviewer", default="评测运营", help="复核人")
    p_review.add_argument("--comment", default="", help="复核意见")

    p_rerun = subparsers.add_parser("rerun", help="重跑实验")
    p_rerun.add_argument("--record-id", required=True, help="验收记录ID")
    p_rerun.add_argument("--operator", default="推荐策略老唐", help="操作人")

    p_correct = subparsers.add_parser("correct", help="人工修正")
    p_correct.add_argument("--record-id", required=True, help="验收记录ID")
    p_correct.add_argument("--operator", required=True, help="操作人")
    p_correct.add_argument("--field", required=True, help="修正字段")
    p_correct.add_argument("--before", required=True, help="修正前")
    p_correct.add_argument("--after", required=True, help="修正后")
    p_correct.add_argument("--reason", required=True, help="修正原因")

    subparsers.add_parser("demo", help="加载并运行演示数据")
    subparsers.add_parser("clear", help="清空所有验收记录")

    args = parser.parse_args()
    engine = _create_engine()

    if args.command == "import":
        cmd_import(args, engine)
    elif args.command == "fill-feature":
        cmd_fill_feature(args, engine)
    elif args.command == "report":
        cmd_report(args, engine)
    elif args.command == "list":
        cmd_list(args, engine)
    elif args.command == "review":
        cmd_review(args, engine)
    elif args.command == "rerun":
        cmd_rerun(args, engine)
    elif args.command == "correct":
        cmd_correct(args, engine)
    elif args.command == "demo":
        cmd_demo(args, engine)
    elif args.command == "clear":
        cmd_clear(args, engine)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
