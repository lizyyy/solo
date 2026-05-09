#!/usr/bin/env python3
"""
印刷厂色差追样CLI - 示例数据生成脚本（使用Python API）
"""

import sys
import os
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = PROJECT_ROOT / "output"

sys.path.insert(0, str(PROJECT_ROOT))

from color_tracking.models import (
    ColorSample,
    BatchInfo,
    PaperBatch,
    InkAdjustment,
    SampleRecord,
    WorkflowStatus,
    AlertLevel,
    generate_id,
)
from color_tracking.core import (
    ColorEngine,
    AlertSystem,
    ComparisonEngine,
    DEFAULT_TOLERANCE,
)
from color_tracking.services import DataService, ReportService


def create_sample_record(
    data_service: DataService,
    alert_system: AlertSystem,
    order_id: str,
    sequence: int,
    product_name: str,
    paper_type: str,
    ink_type: str,
    print_machine: str,
    operator: str,
    paper_batch_code: str,
    paper_manufacturer: str,
    paper_weight: float,
    ref_lab: tuple,
    measured_lab: tuple,
    notes: str = "",
) -> SampleRecord:
    """创建打样记录"""
    batch_info = BatchInfo(
        batch_id=generate_id("BATCH_"),
        order_id=order_id,
        product_name=product_name,
        paper_type=paper_type,
        ink_type=ink_type,
        print_machine=print_machine,
        operator=operator,
        notes=notes,
    )

    paper = PaperBatch(
        paper_id=generate_id("PAPER_"),
        batch_code=paper_batch_code,
        manufacturer=paper_manufacturer,
        weight=paper_weight,
    )

    reference = ColorSample(
        sample_id=generate_id("REF_"),
        lab_l=ref_lab[0],
        lab_a=ref_lab[1],
        lab_b=ref_lab[2],
    )

    measured = ColorSample(
        sample_id=generate_id("MEAS_"),
        lab_l=measured_lab[0],
        lab_a=measured_lab[1],
        lab_b=measured_lab[2],
    )

    color_delta = ColorEngine.calculate_color_delta(reference, measured)

    record = SampleRecord(
        record_id=generate_id("REC_"),
        sequence_number=sequence,
        batch_info=batch_info,
        paper_batch=paper,
        reference_sample=reference,
        measured_sample=measured,
        color_delta=color_delta,
        status=WorkflowStatus.COLOR_MEASURED,
    )

    status, alert_level = alert_system.determine_record_status(record)
    record.status = status
    record.alert_level = alert_level

    return record


def add_adjustment(
    record: SampleRecord,
    channel: str,
    before: float,
    after: float,
    reason: str,
    operator: str,
) -> SampleRecord:
    """添加调整记录"""
    adjustment = InkAdjustment(
        adjustment_id=generate_id("ADJ_"),
        color_channel=channel,
        before_value=before,
        after_value=after,
        adjustment_reason=reason,
        adjusted_by=operator,
    )
    record.adjustments.append(adjustment)
    record.status = WorkflowStatus.ADJUSTMENT_APPLIED
    record.updated_at = datetime.now()
    return record


def approve_record(
    record: SampleRecord,
    reviewer: str,
    notes: str = "",
) -> SampleRecord:
    """通过复核"""
    record.approved = True
    record.status = WorkflowStatus.APPROVED
    record.reviewer = reviewer
    record.review_notes = notes
    record.updated_at = datetime.now()
    return record


def reject_record(
    record: SampleRecord,
    reviewer: str,
    notes: str,
) -> SampleRecord:
    """拒绝复核"""
    record.approved = False
    record.status = WorkflowStatus.REJECTED
    record.reviewer = reviewer
    record.review_notes = notes
    record.updated_at = datetime.now()
    return record


def print_record_summary(record: SampleRecord):
    """打印记录摘要"""
    delta = record.color_delta
    print(f"\n--- 第{record.sequence_number}次打样 ---")
    print(f"  记录ID: {record.record_id}")
    print(f"  参考色: L={record.reference_sample.lab_l:.1f}, a={record.reference_sample.lab_a:.1f}, b={record.reference_sample.lab_b:.1f}")
    print(f"  测量色: L={record.measured_sample.lab_l:.1f}, a={record.measured_sample.lab_a:.1f}, b={record.measured_sample.lab_b:.1f}")
    print(f"  ΔE2000: {delta.delta_e2000:.4f}")
    print(f"  ΔE76: {delta.delta_e76:.4f}")
    print(f"  ΔL={delta.delta_l:+.2f}, Δa={delta.delta_a:+.2f}, Δb={delta.delta_b:+.2f}")
    print(f"  纸张批次: {record.paper_batch.batch_code}")
    print(f"  预警级别: {record.alert_level.value}")
    print(f"  工作状态: {record.status.value}")


def generate_successful_case():
    """生成顺利样例：订单ORD-2025-001"""
    print("\n" + "#"*60)
    print("#  生成顺利样例：ORD-2025-001")
    print("#  场景：产品包装盒打样，经过4次打样，色差逐渐改善，最终通过")
    print("#"*60)

    order_id = "ORD-2025-001"
    data_service = DataService(base_dir=str(DATA_DIR))
    alert_system = AlertSystem()

    records = []
    ref_lab = (52.0, 28.0, -16.0)

    samples_config = [
        {
            "measured": (54.5, 26.0, -18.5),
            "paper_batch": "PAPER-2025-A001",
            "description": "第一次打样：ΔE2000约2.5，接近警戒值，偏亮偏蓝",
        },
        {
            "measured": (52.8, 27.2, -16.8),
            "paper_batch": "PAPER-2025-A001",
            "description": "第二次打样：ΔE2000约1.0，在容差范围内",
        },
        {
            "measured": (52.2, 27.8, -16.3),
            "paper_batch": "PAPER-2025-A001",
            "description": "第三次打样：ΔE2000约0.3，非常接近参考色",
        },
        {
            "measured": (51.9, 28.1, -15.9),
            "paper_batch": "PAPER-2025-A001",
            "description": "第四次打样：ΔE2000约0.15，完全符合标准",
        },
    ]

    for i, config in enumerate(samples_config, 1):
        print(f"\n--- {config['description']} ---")

        record = create_sample_record(
            data_service=data_service,
            alert_system=alert_system,
            order_id=order_id,
            sequence=i,
            product_name="高端化妆品包装盒",
            paper_type="铜版纸",
            ink_type="UV油墨",
            print_machine="海德堡XL105",
            operator="李师傅",
            paper_batch_code=config["paper_batch"],
            paper_manufacturer="金东纸业",
            paper_weight=250.0,
            ref_lab=ref_lab,
            measured_lab=config["measured"],
            notes=f"第{i}次打样，{config['description']}",
        )

        if i == 1:
            add_adjustment(record, "M", 85.0, 92.0, "品红不足，需要增加", "李师傅")
            add_adjustment(record, "Y", 45.0, 48.0, "黄色略浅，微调", "李师傅")

        records.append(record)
        print_record_summary(record)
        data_service.save_record(record)

    for i in [1, 2, 3]:
        approve_record(records[i], "张主管", "色差符合标准，通过")
        data_service.save_record(records[i])
        print(f"\n✓ 第{i+1}次打样已通过复核")

    comparison = ComparisonEngine.compare_records(order_id, records)
    data_service.save_comparison(comparison)

    report = ReportService.generate_tracking_report(order_id, records)
    data_service.save_report(report)

    output_dir = OUTPUT_DIR / "successful"
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    text_content = ReportService.generate_text_report(report, records, comparison)
    ReportService.save_text_report(text_content, str(output_dir / f"{order_id}_report_{timestamp}.txt"))

    ReportService.export_to_csv(records, str(output_dir / f"{order_id}_data_{timestamp}.csv"))

    print("\n" + "#"*60)
    print("#  顺利样例生成完成！")
    print("#  订单编号: ORD-2025-001")
    print("#  打样次数: 4次")
    print(f"#  数据目录: {DATA_DIR}/records/{order_id}")
    print(f"#  报告目录: {output_dir}")
    print("#"*60)

    return records


def generate_review_case():
    """生成拦截/待复核样例：订单ORD-2025-002"""
    print("\n" + "#"*60)
    print("#  生成拦截/待复核样例：ORD-2025-002")
    print("#  场景：产品宣传册打样，存在严重色差、纸张批次变更等问题")
    print("#"*60)

    order_id = "ORD-2025-002"
    data_service = DataService(base_dir=str(DATA_DIR))
    alert_system = AlertSystem()

    records = []
    ref_lab = (45.0, 58.0, 35.0)

    samples_config = [
        {
            "measured": (42.0, 52.0, 28.0),
            "paper_batch": "PAPER-2025-B001",
            "description": "第一次打样：ΔE2000约5.0，严重超标，偏暗偏绿偏蓝",
        },
        {
            "measured": (48.0, 65.0, 42.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第二次打样：纸张批次变更，ΔE2000约4.5，偏亮偏红偏黄",
        },
        {
            "measured": (47.5, 63.0, 39.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第三次打样：ΔE2000约3.5，仍需复核",
        },
        {
            "measured": (46.0, 56.0, 32.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第四次打样：ΔE2000约2.0，接近警戒值",
        },
    ]

    for i, config in enumerate(samples_config, 1):
        print(f"\n--- {config['description']} ---")

        record = create_sample_record(
            data_service=data_service,
            alert_system=alert_system,
            order_id=order_id,
            sequence=i,
            product_name="企业宣传册封面",
            paper_type="哑粉纸",
            ink_type="胶印油墨",
            print_machine="小森LS440",
            operator="王师傅",
            paper_batch_code=config["paper_batch"],
            paper_manufacturer="太阳纸业",
            paper_weight=200.0,
            ref_lab=ref_lab,
            measured_lab=config["measured"],
            notes=f"第{i}次打样，{config['description']}",
        )

        if i == 1:
            add_adjustment(record, "M", 78.0, 88.0, "品红严重不足，大幅增加", "王师傅")
            add_adjustment(record, "Y", 62.0, 72.0, "黄色严重不足，大幅增加", "王师傅")
            add_adjustment(record, "K", 35.0, 28.0, "黑色过重，需要减少", "王师傅")

        if i == 2:
            add_adjustment(record, "M", 88.0, 82.0, "品红偏多，减少", "王师傅")

        records.append(record)
        print_record_summary(record)
        data_service.save_record(record)

    reject_record(records[0], "李主管", "色差严重超标，ΔE2000约5.0，必须重新调整")
    data_service.save_record(records[0])
    print("\n✗ 第1次打样已拒绝")

    reject_record(records[1], "李主管", "纸张批次变更导致颜色偏亮偏红，需要重新调整配方")
    data_service.save_record(records[1])
    print("✗ 第2次打样已拒绝")

    comparison = ComparisonEngine.compare_records(order_id, records)
    data_service.save_comparison(comparison)

    report = ReportService.generate_tracking_report(order_id, records)
    data_service.save_report(report)

    output_dir = OUTPUT_DIR / "review_needed"
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    text_content = ReportService.generate_text_report(report, records, comparison)
    ReportService.save_text_report(text_content, str(output_dir / f"{order_id}_report_{timestamp}.txt"))

    ReportService.export_to_csv(records, str(output_dir / f"{order_id}_data_{timestamp}.csv"))

    print("\n" + "#"*60)
    print("#  拦截/待复核样例生成完成！")
    print("#  订单编号: ORD-2025-002")
    print("#  打样次数: 4次")
    print(f"#  数据目录: {DATA_DIR}/records/{order_id}")
    print(f"#  报告目录: {output_dir}")
    print("#  特点:")
    print("#    - 第1-2次打样被拒绝")
    print("#    - 存在纸张批次变更 (PAPER-2025-B001 -> PAPER-2025-B002)")
    print("#    - 多次严重色差预警")
    print("#    - 第3-4次打样仍需人工复核")
    print("#"*60)

    return records


def main():
    print("\n" + "="*60)
    print("  印刷厂色差追样CLI - 示例数据生成工具")
    print("="*60)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generate_successful_case()
    generate_review_case()

    print("\n" + "="*60)
    print("  示例数据生成完成！")
    print("="*60)
    print(f"\n数据文件位置:")
    print(f"  打样记录: {DATA_DIR}/records/")
    print(f"  对比分析: {DATA_DIR}/comparisons/")
    print(f"  报告文件: {DATA_DIR}/reports/")
    print(f"  导出文件: {OUTPUT_DIR}/")
    print("\n你可以使用以下命令继续操作:")
    print("  python3 -m color_tracking.cli.main orders list")
    print("  python3 -m color_tracking.cli.main sample list --order-id ORD-2025-001")
    print("  python3 -m color_tracking.cli.main sample list --order-id ORD-2025-002")
    print("  python3 -m color_tracking.cli.main compare order --order-id ORD-2025-001")
    print("  python3 -m color_tracking.cli.main compare order --order-id ORD-2025-002")
    print("="*60 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
