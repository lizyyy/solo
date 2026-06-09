import os
import sys
import json
import argparse

import config
from models import init_db, Reconciliation, ExportBatch
from reconcile_engine import (
    run_reconciliation, export_csv, save_manual_note,
    save_filter_state, load_filter_state, generate_batch_no,
)


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="宠物减重排程对账主流程")
    parser.add_argument("--round", type=int, default=1, dest="process_round",
                        help="处理轮次（1=首轮，2+=重跑）")
    parser.add_argument("--batch", type=str, default=None,
                        help="指定批次号（重跑时使用同一批次号）")
    parser.add_argument("--add-note", type=str, nargs=2, metavar=("REC_ID", "CONTENT"),
                        help="给指定对账ID添加人工备注")
    parser.add_argument("--export", action="store_true",
                        help="跑完对账后自动导出全部CSV")
    parser.add_argument("--export-filtered", type=str, default=None,
                        help='按JSON筛选条件导出，例: \'{"review_status":"需复核"}\'')
    parser.add_argument("--show-latest", action="store_true",
                        help="显示最新批次的概况")
    args = parser.parse_args()

    session = init_db()

    if args.show_latest:
        print_section("最新对账批次概况")
        batches = session.query(Reconciliation.batch_no).distinct().order_by(
            Reconciliation.created_at.desc()
        ).limit(3).all()
        for (bn,) in batches:
            recs = session.query(Reconciliation).filter(Reconciliation.batch_no == bn).all()
            total = len(recs)
            need = sum(1 for r in recs if r.review_status == "需复核")
            ok = total - need
            rounds = sorted(set(r.process_round for r in recs))
            print(f"批次 {bn}: 共{total}条  正常{ok}  需复核{need}  轮次{rounds}")
        session.close()
        return

    if args.add_note:
        rec_id, content = args.add_note
        try:
            rec_id_int = int(rec_id)
        except ValueError:
            print("错误：REC_ID 必须是整数")
            sys.exit(1)
        note = save_manual_note(session, rec_id_int, content)
        if note:
            print(f"已添加备注：对账ID={rec_id_int}，内容：{content}")
        else:
            print(f"未找到对账ID={rec_id_int}")
        session.close()
        return

    batch_no = args.batch
    if batch_no is None and args.process_round > 1:
        latest = session.query(Reconciliation.batch_no).distinct().order_by(
            Reconciliation.created_at.desc()
        ).first()
        if latest:
            batch_no = latest[0]
            print(f"[自动] 使用上一批次号: {batch_no}")
        else:
            print("尚未找到任何批次，将使用新批次号")

    print_section(f"宠物减重排程对账 - 第{args.process_round}轮")
    print(f"批次号: {batch_no or '(将自动生成)'}")

    batch_no, results, logs = run_reconciliation(
        session, batch_no=batch_no, process_round=args.process_round,
    )

    for line in logs:
        print(line)

    print_section("对账结果摘要")
    total = len(results)
    need_review = sum(1 for r in results if r["review_status"] == "需复核")
    ok = total - need_review
    name_unmatched = sum(1 for r in results if r["name_match_status"] == "未匹配")
    weight_mix = sum(1 for r in results if r["weight_unit_status"] == "混写(已转换)")

    print(f"对账记录总数: {total}")
    print(f"  - 正常:      {ok}")
    print(f"  - 需复核:    {need_review}  (含名称未匹配 {name_unmatched} 条, 单位混写 {weight_mix} 条)")
    print(f"  - 批次号:    {batch_no}")
    print(f"  - 处理轮次:  {args.process_round}")

    need_list = [r for r in results if r["review_status"] == "需复核"]
    if need_list:
        print("\n[需复核明细]")
        for r in need_list:
            print(f"  * 手写名={r['handwritten_name']}  匹配={r['name_match_status']}  "
                  f"体重={r['weight_unit_status']}  "
                  f"原因: {r['review_reason'][:60]}...")

    if args.export:
        print_section("导出全部CSV明细")
        path, cnt = export_csv(session, batch_no, filters={})
        print(f"已导出 {cnt} 条记录 -> {path}")

    if args.export_filtered:
        print_section(f"按筛选条件导出: {args.export_filtered}")
        try:
            f = json.loads(args.export_filtered)
        except json.JSONDecodeError as e:
            print(f"筛选JSON解析失败: {e}")
            sys.exit(1)
        path, cnt = export_csv(session, batch_no, filters=f)
        print(f"已导出 {cnt} 条记录 -> {path}")
        save_filter_state(session, f"filter_{batch_no}_default", f)
        print(f"筛选条件已持久化，刷新页面后自动恢复")

    session.close()
    print_section("完成")
    print(f"下次可用：python run_pipeline.py --batch {batch_no} --round {args.process_round + 1} 重跑")


if __name__ == "__main__":
    main()
