"""本地快速测试脚本 - 演示完整对账流程"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store_reconcile.db.database import DatabaseManager
from store_reconcile.services.parser import DataParser
from store_reconcile.services.reconciler import ReconcileEngine
from store_reconcile.services.tracer import PettyCashTracer


def test_full_reconcile():
    db = DatabaseManager("test_reconcile.db")
    parser = DataParser()
    engine = ReconcileEngine()
    tracer = PettyCashTracer(db)

    sample_dir = os.path.join(os.path.dirname(__file__), "sample")

    with open(os.path.join(sample_dir, "deposit.csv"), "r", encoding="utf-8") as f:
        deposit_csv = f.read()

    with open(os.path.join(sample_dir, "sales.json"), "r", encoding="utf-8") as f:
        sales_json = f.read()

    with open(os.path.join(sample_dir, "petty_cash.json"), "r", encoding="utf-8") as f:
        petty_cash_json = f.read()

    store_id = "STORE001"
    batch_date = "2026-05-24"

    print("=" * 60)
    print("门店财务对账系统 - 本地测试")
    print("=" * 60)

    deposits = parser.parse_deposit_csv(deposit_csv, store_id)
    print(f"\n✓ 解析缴存记录: {len(deposits)} 条")
    for d in deposits:
        print(f"  {d['deposit_date']}: {d['amount']:.2f} 元 (参考号: {d['reference_no']})")

    sales = parser.parse_sales_json(sales_json, store_id)
    print(f"\n✓ 解析销售记录: {len(sales)} 条")
    for s in sales:
        print(f"  {s['sale_date']}: 总计 {s['total_amount']:.2f} 元 "
              f"(现金: {s['cash_amount']:.2f}, POS: {s['pos_amount']:.2f})")

    petty_cash = parser.parse_petty_cash_json(petty_cash_json, store_id)
    print(f"\n✓ 解析备用金记录: {len(petty_cash)} 条")
    for p in petty_cash:
        type_cn = {"income": "收入", "expense": "支出", "replenish": "充值", "adjust": "调整"}[p['txn_type']]
        print(f"  {p['txn_date']}: {type_cn} {p['amount']:.2f} 元 (余额: {p['balance_after']:.2f})")

    valid, msg = parser.validate_batch_data(deposits, sales, petty_cash)
    print(f"\n✓ 数据校验: {msg}")

    source_hash = db.compute_source_hash(deposits, sales, petty_cash)
    existing = db.is_batch_processed(store_id, batch_date, source_hash)

    if existing:
        print(f"\n⚠ 该批次已处理过 (batch_id: {existing})，返回历史结果")
        items = db.get_reconcile_items(existing)
        print_reconcile_result(None, batch_date, items, existing)
    else:
        print("\n开始对账处理...")
        result = engine.reconcile(
            deposits=deposits,
            sales=sales,
            petty_cash=petty_cash,
            store_id=store_id,
            batch_date=batch_date,
        )

        batch_id = db.create_batch(
            store_id=store_id,
            batch_date=batch_date,
            deposit_count=len(deposits),
            sales_count=len(sales),
            petty_cash_count=len(petty_cash),
            source_hash=source_hash,
        )

        db.save_deposits(batch_id, deposits)
        db.save_sales(batch_id, sales)
        db.save_petty_cash(batch_id, petty_cash)

        all_items = (
            result["normal_items"]
            + result["pending_items"]
            + result["failed_items"]
        )
        db.save_reconcile_items(batch_id, all_items)
        db.update_batch_status(batch_id, "completed")

        print(f"\n✓ 对账完成 (batch_id: {batch_id})")
        print_reconcile_result(result, batch_date, None, batch_id)

    print("\n" + "=" * 60)
    print("备用金历史追溯测试")
    print("=" * 60)

    trace_result = tracer.trace_petty_cash(store_id, batch_date)
    print(f"\n门店: {trace_result['store_id']}")
    print(f"追溯日期: {trace_result['target_date']}")
    print(f"当前余额: {trace_result['current_balance']:.2f} 元")
    print(f"最早记录: {trace_result['earliest_date']}")
    print(f"\n资金来源汇总:")
    print(f"  收入: {trace_result['total_income']:.2f} 元")
    print(f"  支出: {trace_result['total_expense']:.2f} 元")
    print(f"  充值: {trace_result['total_replenish']:.2f} 元")
    print(f"  调整: {trace_result['total_adjust']:.2f} 元")
    print(f"\n流水明细:")
    for node in trace_result["trace_path"]:
        type_cn = {"income": "收入", "expense": "支出", "replenish": "充值", "adjust": "调整"}[node['txn_type']]
        print(f"  {node['txn_date']} | {type_cn} | {node['amount']:>10.2f} | "
              f"余额: {node['balance_after']:>10.2f} | {node.get('description', '')}")

    print("\n" + "=" * 60)
    print("测试幂等性 - 再次提交相同数据")
    print("=" * 60)

    existing2 = db.is_batch_processed(store_id, batch_date, source_hash)
    if existing2:
        print(f"✓ 幂等校验通过: 相同数据不会重复处理")
        print(f"  原始批次ID: {existing2}")
    else:
        print("✗ 幂等校验失败: 数据被重复处理")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


def print_reconcile_result(result, batch_date, items, batch_id):
    if result:
        print(f"\n对账结果:")
        print(f"  总计: {result['total_count']} 条")
        print(f"  正常: {result['normal_count']} 条")
        print(f"  待确认: {result['pending_count']} 条")
        print(f"  失败: {result['failed_count']} 条")

        all_items = result["normal_items"] + result["pending_items"] + result["failed_items"]
    else:
        normal = [i for i in items if i["status"] == "normal"]
        pending = [i for i in items if i["status"] == "pending"]
        failed = [i for i in items if i["status"] == "failed"]
        all_items = normal + pending + failed
        print(f"\n对账结果 (历史):")
        print(f"  总计: {len(items)} 条")
        print(f"  正常: {len(normal)} 条")
        print(f"  待确认: {len(pending)} 条")
        print(f"  失败: {len(failed)} 条")

    print(f"\n详细明细:")
    for item in all_items:
        status_icon = {"normal": "✓", "pending": "?", "failed": "✗"}[item["status"]]
        print(f"\n  [{status_icon}] {item['record_date']} - {item['status'].upper()}")
        if item.get("deposit_amount") is not None:
            print(f"    缴存: {item['deposit_amount']:.2f} 元")
        if item.get("sales_amount") is not None:
            print(f"    销售: {item['sales_amount']:.2f} 元")
        if item.get("petty_cash_change") is not None:
            print(f"    备用金变动: {item['petty_cash_change']:.2f} 元")
        if item.get("difference") is not None:
            print(f"    差额: {item['difference']:.2f} 元")
        if item.get("error_message"):
            print(f"    错误: {item['error_message']}")
        if item.get("suggestion"):
            print(f"    建议: {item['suggestion']}")
        if item.get("rule_matched"):
            print(f"    规则: {', '.join(item['rule_matched'])}")


if __name__ == "__main__":
    test_full_reconcile()
