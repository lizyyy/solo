from models import (
    create_batch, create_revenue_record,
    DataSource, RecordStatus,
    get_all_batches, get_all_records, get_summary
)
import os
from storage import RECORDS_FILE, BATCHES_FILE


def init_sample_data():
    if os.path.exists(RECORDS_FILE) and os.path.exists(BATCHES_FILE):
        existing_records = get_all_records()
        existing_batches = get_all_batches()
        if existing_records or existing_batches:
            print("⚠️  检测到已有数据，跳过样例数据初始化。")
            print(f"   已有 {len(existing_batches)} 个批次，{len(existing_records)} 条记录")
            return None

    print("📦 正在初始化新能源充电桩收益归集样例数据...")

    batch = create_batch(period="2026-05", operator="门店财务老曹")
    batch_no = batch["batch_no"]
    print(f"✅ 创建归集批次：{batch_no}（账期：2026-05）")

    print("\n📋 正在导入3条典型记录...")

    record1 = create_revenue_record(
        batch_no=batch_no,
        source=DataSource.BANK_RECEIPT,
        source_ref="银行回单-20260528-00123",
        pile_no="CDQ-A03",
        transaction_date="2026-05-28",
        expected_amount=1256.80,
        actual_amount=1256.80,
        original_remarks="5月28日快充区营收，已核对充电明细",
        operator="门店财务老曹",
        period="2026-05"
    )
    print(f"✅ 记录1（顺利归集）：{record1['id']} 充电桩{record1['pile_no']} "
          f"应收{record1['expected_amount']:.2f}元，实收{record1['actual_amount']:.2f}元，"
          f"状态：{RecordStatus.STATUS_LABELS[record1['status']]}")

    record2 = create_revenue_record(
        batch_no=batch_no,
        source=DataSource.BUSINESS_LEDGER,
        source_ref="业务台账-20260525-充电桩B区",
        pile_no="CDQ-B07",
        transaction_date="2026-05-25",
        expected_amount=892.50,
        actual_amount=880.00,
        original_remarks="5月25日B区充电桩，用户反馈有优惠券抵扣，待核实",
        operator="门店财务老曹",
        period="2026-05"
    )
    print(f"⚠️  记录2（需人工确认）：{record2['id']} 充电桩{record2['pile_no']} "
          f"应收{record2['expected_amount']:.2f}元，实收{record2['actual_amount']:.2f}元，"
          f"差异{abs(record2['expected_amount'] - record2['actual_amount']):.2f}元，"
          f"状态：{RecordStatus.STATUS_LABELS[record2['status']]}")

    record3 = create_revenue_record(
        batch_no=batch_no,
        source=DataSource.MONTHLY_STATEMENT,
        source_ref="月底对账表-202604-补录-001",
        pile_no="CDQ-C01",
        transaction_date="2026-04-30",
        expected_amount=568.30,
        actual_amount=None,
        original_remarks="【4月旧口径补录】原对账表备注：C区充电桩4月下旬营收，"
                        "当时未走新流程，从月底对账表补录，银行回单暂缺，"
                        "老曹说等银行6月上旬补打回单",
        operator="门店财务老曹",
        period="2026-05"
    )
    print(f"⏸️  记录3（月底对账表旧口径）：{record3['id']} 充电桩{record3['pile_no']} "
          f"应收{record3['expected_amount']:.2f}元，实收待补，"
          f"状态：{RecordStatus.STATUS_LABELS[record3['status']]}")

    summary = get_summary(batch_no)
    print(f"\n📊 批次{batch_no}归集汇总：")
    print(f"   总记录数：{summary['total_count']}")
    print(f"   台账应收总额：{summary['total_expected']:.2f}元")
    print(f"   银行实收总额：{summary['total_actual']:.2f}元")
    print(f"   ✅ 已确认归集：{summary['confirmed_amount']:.2f}元")
    print(f"   ⏸️  已挂起金额：{summary['suspended_amount']:.2f}元")
    print(f"   ❓ 待确认金额：{summary['unconfirmed_amount']:.2f}元")
    print(f"   状态分布：待确认{summary['status_counts']['pending']}条 / "
          f"已确认{summary['status_counts']['confirmed']}条 / "
          f"已挂起{summary['status_counts']['suspended']}条 / "
          f"有差异{summary['status_counts']['discrepancy']}条")

    print("\n💡 样例数据已准备完成，请继续使用命令行工具或API进行后续操作。")
    print(f"   批次号：{batch_no}")

    return batch_no


if __name__ == "__main__":
    init_sample_data()
