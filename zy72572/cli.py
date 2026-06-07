#!/usr/bin/env python3
import argparse
import json
import sys

from image_retrieval_mining import HardCaseMiner, generate_demo_data
from image_retrieval_mining.demo_flow import run_step_by_step_demo


def cmd_demo(args):
    if args.step_by_step:
        run_step_by_step_demo()
    else:
        miner, result = generate_demo_data()
        print("=" * 60)
        print("图像检索难例挖掘 - 演示数据结果")
        print("=" * 60)
        print("\n【数据摘要】")
        for k, v in result.summary().items():
            print(f"  {k}: {v}")

        print("\n【记录详情】")
        for r in result.records:
            print(f"\n  {r.image_id}: {r.query}")
            print(f"    离线: {r.offline_score:.3f} ({r.offline_bucket.value}桶)")
            print(f"    线上: {r.online_score:.3f} ({r.online_bucket.value}桶)")
            print(f"    状态: {r.status.value}")
            if r.remark:
                print(f"    备注: {r.remark}")

        print("\n【实验对比】")
        for c in result.comparisons:
            print(f"  {c.note}: 离线差={c.offline_delta:+.3f}, 线上差={c.online_delta:+.3f}")


def cmd_mine(args):
    miner = HardCaseMiner()

    if args.training_log:
        with open(args.training_log, "r") as f:
            log_data = json.load(f)
        miner.import_training_log(
            log_id=log_data.get("log_id", "imported_log"),
            experiment_name=log_data.get("experiment_name", "导入实验"),
            points=[(p["step"], p["train_loss"], p["val_mAP"]) for p in log_data["points"]],
            model_version=log_data.get("model_version", ""),
        )

    if args.records:
        with open(args.records, "r") as f:
            records_data = json.load(f)
        for rec in records_data:
            miner.add_record(
                image_id=rec["image_id"],
                query=rec["query"],
                offline_score=rec["offline_score"],
                online_score=rec["online_score"],
                training_log_id=rec.get("training_log_id"),
                remark=rec.get("remark", ""),
            )

    if args.threshold_notes:
        with open(args.threshold_notes, "r") as f:
            notes_data = json.load(f)
        for note_data in notes_data:
            note = miner.add_threshold_note(
                record_id=note_data["record_id"],
                old_offline_score=note_data.get("old_offline_score"),
                old_online_score=note_data.get("old_online_score"),
                new_offline_score=note_data["new_offline_score"],
                new_online_score=note_data["new_online_score"],
                caliber_note=note_data["caliber_note"],
                operator=note_data.get("operator", "阿越"),
            )
            if note_data.get("apply", False):
                miner.apply_threshold_note(note.note_id)

    result = miner.run_mining()

    if args.output:
        output = {
            "summary": result.summary(),
            "records": [
                {
                    "record_id": r.record_id,
                    "image_id": r.image_id,
                    "query": r.query,
                    "offline_score": r.offline_score,
                    "online_score": r.online_score,
                    "offline_bucket": r.offline_bucket.value,
                    "online_bucket": r.online_bucket.value,
                    "status": r.status.value,
                    "bucket_diff": r.bucket_diff,
                    "remark": r.remark,
                }
                for r in result.records
            ],
            "comparisons": [
                {
                    "baseline_offline_score": c.baseline_offline_score,
                    "baseline_online_score": c.baseline_online_score,
                    "compared_offline_score": c.compared_offline_score,
                    "compared_online_score": c.compared_online_score,
                    "offline_delta": c.offline_delta,
                    "online_delta": c.online_delta,
                    "note": c.note,
                }
                for c in result.comparisons
            ],
            "step_log": miner.get_step_log(),
        }
        with open(args.output, "w") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"结果已写入: {args.output}")
    else:
        print("=" * 60)
        print("难例挖掘结果")
        print("=" * 60)
        for k, v in result.summary().items():
            print(f"  {k}: {v}")

        if args.verbose:
            print("\n【操作轨迹】")
            for line in miner.get_step_log():
                print(f"  {line}")


def main():
    parser = argparse.ArgumentParser(description="图像检索难例挖掘工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="运行演示")
    demo_parser.add_argument("--step-by-step", action="store_true", help="分步演示流程")
    demo_parser.set_defaults(func=cmd_demo)

    mine_parser = subparsers.add_parser("mine", help="执行难例挖掘")
    mine_parser.add_argument("--training-log", type=str, help="训练日志JSON文件路径")
    mine_parser.add_argument("--records", type=str, help="检索记录JSON文件路径")
    mine_parser.add_argument("--threshold-notes", type=str, help="阈值调参笔记JSON文件路径")
    mine_parser.add_argument("--output", "-o", type=str, help="输出结果JSON文件路径")
    mine_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细操作轨迹")
    mine_parser.set_defaults(func=cmd_mine)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
