import argparse
import json
from datetime import datetime
from core import RollbackStore
from models import RecordStatus


store = RollbackStore()


def cmd_import_params(args):
    params = store.import_params_yaml(args.file, imported_by=args.by)
    print(f"✓ 导入参数YAML成功: {params.yaml_id}")
    print(f"  文件: {params.file_path}")
    print(f"  模型: {params.content.get('model', {}).get('name', 'N/A')}")


def cmd_import_slice(args):
    slice_obj = store.import_eval_slice(args.file)
    print(f"✓ 导入评测切片成功: {slice_obj.slice_id}")
    print(f"  名称: {slice_obj.slice_name}")
    print(f"  标签: {', '.join(slice_obj.tags)}")
    print(f"  样本数: {len(slice_obj.data_points)}")
    print(f"  备注长度: {len(slice_obj.raw_remark)} 字")


def cmd_create_record(args):
    metrics = {}
    if args.metrics:
        for m in args.metrics:
            k, v = m.split("=")
            metrics[k] = float(v)

    record = store.create_record(
        model_version=args.model,
        training_window=(args.train_start, args.train_end),
        eval_window=(args.eval_start, args.eval_end),
        metrics=metrics,
        created_by=args.by,
        params_yaml_id=args.params_id,
        raw_remarks=args.remarks or ""
    )
    print(f"✓ 创建记录成功: {record.record_id}")
    print(f"  模型版本: {record.model_version}")
    print(f"  状态: {record.status.value}")
    print(f"  指标: {record.metrics}")


def cmd_attach_slice(args):
    record = store.attach_eval_slice(args.record_id, args.slice_id)
    print(f"✓ 评测切片已关联到记录")
    print(f"  记录ID: {record.record_id}")
    print(f"  当前状态: {record.status.value}")
    print(f"  关联切片数: {len(record.eval_slice_ids)}")
    anomalies = store.get_record_anomalies(args.record_id)
    print(f"  异常样本数: {len(anomalies)}")


def cmd_supplement_old(args):
    record = store.supplement_old_caliber(args.record_id, args.slice_id)
    print(f"✓ 旧口径数据已补录")
    print(f"  记录ID: {record.record_id}")
    print(f"  当前状态: {record.status.value}")


def cmd_list_records(args):
    if not store.records:
        print("暂无记录")
        return
    print(f"{'ID':<15} {'模型版本':<25} {'状态':<30} {'AUC':<8} {'创建人':<10}")
    print("-" * 90)
    for rid, rec in store.records.items():
        auc = rec.metrics.get("auc", "N/A")
        print(f"{rid:<15} {rec.model_version:<25} {rec.status.value:<30} {auc:<8} {rec.created_by:<10}")


def cmd_show_record(args):
    if args.record_id not in store.records:
        print(f"记录 {args.record_id} 不存在")
        return
    rec = store.records[args.record_id]
    print(f"记录ID: {rec.record_id}")
    print(f"模型版本: {rec.model_version}")
    print(f"状态: {rec.status.value}")
    print(f"创建人: {rec.created_by}")
    print(f"创建时间: {rec.created_at.strftime('%Y-%m-%d %H:%M')}")
    print(f"训练窗口: {rec.training_window_start.date()} ~ {rec.training_window_end.date()}")
    print(f"评测窗口: {rec.eval_window_start.date()} ~ {rec.eval_window_end.date()}")
    print(f"指标: {json.dumps(rec.metrics, indent=2, ensure_ascii=False)}")
    print(f"\n关联评测切片 ({len(rec.eval_slice_ids)}):")
    for sid in rec.eval_slice_ids:
        if sid in store.eval_slices:
            s = store.eval_slices[sid]
            print(f"  - {s.slice_id}: {s.slice_name}")
    print(f"\n关联异常样本 ({len(rec.anomaly_sample_ids)}):")
    anomalies = store.get_record_anomalies(args.record_id)
    for a in anomalies:
        print(f"  - {a.sample_id}: actual={a.actual}, 来自切片={a.is_from_eval_slice}")
    print(f"\n原始备注:")
    print("-" * 50)
    print(rec.raw_remarks)
    if rec.review_note:
        print(f"\n复核意见 ({rec.reviewed_by} at {rec.reviewed_at.strftime('%Y-%m-%d %H:%M')}):")
        print(f"  {rec.review_note}")


def cmd_submit_review(args):
    record = store.submit_for_review(args.record_id, args.by)
    print(f"✓ 已提交复核: {record.record_id}")
    print(f"  当前状态: {record.status.value}")


def cmd_review(args):
    record = store.review_record(
        record_id=args.record_id,
        reviewer=args.by,
        note=args.note,
        approve=not args.reject
    )
    print(f"✓ 复核完成: {record.record_id}")
    print(f"  结论: {'通过' if not args.reject else '驳回'}")
    print(f"  状态: {record.status.value}")
    print(f"  意见: {args.note}")


def cmd_demo(args):
    import subprocess
    subprocess.run(["python3", "demo.py"])


def main():
    parser = argparse.ArgumentParser(description="增量训练回滚记录 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_import_params = subparsers.add_parser("import-params", help="导入参数YAML")
    p_import_params.add_argument("file", help="YAML文件路径")
    p_import_params.add_argument("--by", default="system", help="操作人")

    p_import_slice = subparsers.add_parser("import-slice", help="导入评测切片")
    p_import_slice.add_argument("file", help="评测切片JSON路径")

    p_create = subparsers.add_parser("create", help="创建训练记录")
    p_create.add_argument("--model", required=True, help="模型版本")
    p_create.add_argument("--train-start", required=True, help="训练窗口开始 YYYY-MM-DD")
    p_create.add_argument("--train-end", required=True, help="训练窗口结束 YYYY-MM-DD")
    p_create.add_argument("--eval-start", required=True, help="评测窗口开始 YYYY-MM-DD")
    p_create.add_argument("--eval-end", required=True, help="评测窗口结束 YYYY-MM-DD")
    p_create.add_argument("--metrics", nargs="*", help="指标，格式 key=value")
    p_create.add_argument("--by", default="system", help="创建人")
    p_create.add_argument("--params-id", help="关联的参数YAML ID")
    p_create.add_argument("--remarks", help="备注")

    p_attach = subparsers.add_parser("attach-slice", help="关联评测切片到记录")
    p_attach.add_argument("record_id", help="记录ID")
    p_attach.add_argument("slice_id", help="评测切片ID")

    p_supplement = subparsers.add_parser("supplement-old", help="补录旧口径数据")
    p_supplement.add_argument("record_id", help="记录ID")
    p_supplement.add_argument("slice_id", help="评测切片ID")

    subparsers.add_parser("list", help="列出所有记录")

    p_show = subparsers.add_parser("show", help="查看记录详情")
    p_show.add_argument("record_id", help="记录ID")

    p_submit = subparsers.add_parser("submit-review", help="提交复核")
    p_submit.add_argument("record_id", help="记录ID")
    p_submit.add_argument("--by", required=True, help="提交人")

    p_review = subparsers.add_parser("review", help="复核记录")
    p_review.add_argument("record_id", help="记录ID")
    p_review.add_argument("--by", required=True, help="复核人")
    p_review.add_argument("--note", required=True, help="复核意见")
    p_review.add_argument("--reject", action="store_true", help="驳回（默认通过）")

    subparsers.add_parser("demo", help="运行完整演示")

    args = parser.parse_args()

    if args.command == "import-params":
        cmd_import_params(args)
    elif args.command == "import-slice":
        cmd_import_slice(args)
    elif args.command == "create":
        cmd_create_record(args)
    elif args.command == "attach-slice":
        cmd_attach_slice(args)
    elif args.command == "supplement-old":
        cmd_supplement_old(args)
    elif args.command == "list":
        cmd_list_records(args)
    elif args.command == "show":
        cmd_show_record(args)
    elif args.command == "submit-review":
        cmd_submit_review(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "demo":
        cmd_demo(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
