from datetime import datetime, timedelta
from models import (
    SaleFeeRecord, RecordType, RecordStatus, Attachment, ReviewResult
)
from collector import TailDiffCollector
from auto_judge import AutoJudge
from frozen_manager import FrozenAmountManager
from exporter import ReviewListExporter
from utils import generate_id


def create_sample_data():
    collector = TailDiffCollector()
    auto_judge = AutoJudge()
    frozen_manager = FrozenAmountManager()
    exporter = ReviewListExporter(frozen_manager)
    
    base_date = datetime(2026, 5, 30, 10, 0, 0)
    
    record1 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530001",
        sale_date=base_date,
        product_code="P001",
        product_name="混合基金A类",
        expected_fee=1000.00,
        actual_fee=1000.00,
        tail_diff=0.00,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[
            Attachment(
                id=generate_id(),
                name="销售确认单.pdf",
                uploaded_at=base_date + timedelta(hours=2)
            )
        ]
    )
    
    record2 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530002",
        sale_date=base_date + timedelta(hours=1),
        product_code="P002",
        product_name="股票基金B类",
        expected_fee=500.00,
        actual_fee=499.50,
        tail_diff=0.50,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[
            Attachment(
                id=generate_id(),
                name="费用结算单.pdf",
                uploaded_at=base_date + timedelta(hours=3)
            )
        ]
    )
    
    record3 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530003",
        sale_date=base_date + timedelta(hours=2),
        product_code="P003",
        product_name="债券基金C类",
        expected_fee=2000.00,
        actual_fee=1850.00,
        tail_diff=150.00,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[
            Attachment(
                id=generate_id(),
                name="对账说明.pdf",
                uploaded_at=base_date + timedelta(hours=30)
            )
        ]
    )
    
    record4 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530001",
        sale_date=base_date,
        product_code="P001",
        product_name="混合基金A类",
        expected_fee=1000.00,
        actual_fee=1000.00,
        tail_diff=0.00,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[]
    )
    
    record5 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530005",
        sale_date=base_date + timedelta(hours=5),
        product_code="P005",
        product_name="货币基金D类",
        expected_fee=3000.00,
        actual_fee=2950.00,
        tail_diff=50.00,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[
            Attachment(
                id=generate_id(),
                name="原始凭证.pdf",
                uploaded_at=base_date + timedelta(hours=6)
            )
        ]
    )
    
    record6 = SaleFeeRecord(
        id=generate_id(),
        serial_number="SN20260530006",
        sale_date=base_date + timedelta(hours=6),
        product_code="P006",
        product_name="指数基金E类",
        expected_fee=1500.00,
        actual_fee=1600.00,
        tail_diff=-100.00,
        record_type=RecordType.NORMAL,
        status=RecordStatus.PENDING,
        attachments=[]
    )
    
    collector.add_record(record1)
    collector.add_record(record2)
    collector.add_record(record3)
    collector.add_record(record4)
    collector.add_record(record5)
    collector.add_record(record6)
    
    print("=" * 60)
    print("步骤1: 检测重复项")
    print("=" * 60)
    collector.mark_duplicates()
    dup_records = collector.get_records_by_type(RecordType.DUPLICATE)
    print(f"检测到 {len(dup_records)} 条重复记录")
    
    print("\n" + "=" * 60)
    print("步骤2: 检测晚到附件")
    print("=" * 60)
    late_records = collector.detect_late_attachments(deadline_hours=24)
    print(f"检测到 {len(late_records)} 条晚到附件记录")
    
    print("\n" + "=" * 60)
    print("步骤3: 模拟人工更正")
    print("=" * 60)
    collector.process_manual_correction(
        record5.id,
        correction_note="财务系统更新后发现原始数据录入错误，实际费用应为2980元",
        corrected_fee=2980.00,
        corrector="风控运营-张三"
    )
    print(f"已对记录 {record5.id} 进行人工更正")
    
    print("\n" + "=" * 60)
    print("步骤4: 自动判断所有待处理记录")
    print("=" * 60)
    pending_records = collector.get_records_by_status(RecordStatus.PENDING)
    for record in pending_records:
        auto_judge.judge(record)
        print(f"记录 {record.id}: {record.auto_judgement.judgement}")
    
    print("\n" + "=" * 60)
    print("步骤5: 对大额尾差记录进行额度冻结（风控运营操作）")
    print("=" * 60)
    large_tail_record = collector.get_record_by_id(record3.id)
    if large_tail_record:
        frozen_manager.freeze_amount(
            large_tail_record,
            amount=150.00,
            reason="尾差超过100元，需业务部门确认费用计算依据，核对销售数据真实性",
            operator="风控运营-李四"
        )
        print(f"已冻结记录 {large_tail_record.id}，金额150.00元")
    
    print("\n" + "=" * 60)
    print("步骤6: 模拟风控经理复核部分记录")
    print("=" * 60)
    frozen_record = collector.get_record_by_id(record3.id)
    if frozen_record:
        frozen_manager.add_review_log(
            frozen_record,
            reviewer="风控经理-王五",
            result=ReviewResult.NEED_MORE_INFO,
            comment="冻结理由合理，但请业务部门补充提供销售明细清单，确认尾差产生原因"
        )
        print(f"已对记录 {frozen_record.id} 提出补充材料要求")
    
    manual_correction_record = collector.get_record_by_id(record5.id)
    if manual_correction_record:
        frozen_manager.add_review_log(
            manual_correction_record,
            reviewer="风控经理-王五",
            result=ReviewResult.PASS,
            comment="更正依据充分，尾差计算正确，同意通过"
        )
        print(f"已复核通过人工更正记录 {manual_correction_record.id}")
    
    print("\n" + "=" * 60)
    print("步骤7: 导出复核清单")
    print("=" * 60)
    
    txt_path = "/Users/lzy/pro/solo/workspaces/zy71806/output/代销费尾差归集复核清单.txt"
    csv_path = "/Users/lzy/pro/solo/workspaces/zy71806/output/代销费尾差归集复核清单.csv"
    
    exporter.export_to_text(collector.records, txt_path)
    exporter.export_to_csv(collector.records, csv_path)
    
    print(f"已导出文本格式复核清单: {txt_path}")
    print(f"已导出CSV格式复核清单: {csv_path}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    print(f"\n记录统计:")
    print(f"- 正常记录: {len(collector.get_records_by_type(RecordType.NORMAL))}")
    print(f"- 晚到附件: {len(collector.get_records_by_type(RecordType.LATE_ATTACHMENT))}")
    print(f"- 重复项: {len(collector.get_records_by_type(RecordType.DUPLICATE))}")
    print(f"- 人工更正: {len(collector.get_records_by_type(RecordType.MANUAL_CORRECTION))}")
    
    return collector, frozen_manager, exporter


if __name__ == "__main__":
    create_sample_data()
