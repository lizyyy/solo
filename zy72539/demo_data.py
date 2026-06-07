from datetime import datetime, timedelta
from data_schema import (
    CostAttributionRecord, BatchRun, AnnotationMessage, ManualCorrection,
    RiskLevel, DisposalType
)


def create_demo_records() -> list[CostAttributionRecord]:
    base_time = datetime(2026, 6, 5, 10, 0, 0)

    # ========== 记录1：顺利记录 ==========
    record1 = CostAttributionRecord(
        record_id="REC-2026-0001",
        content_id="CONTENT-8821",
        content_preview="用户发布正常商品推广内容，无违规表述",
        gray_batch_id="GRAY-20260601-A",
        gray_batch_name="灰度批次20260601-A（模型v3.2.1灰度）",
        first_import_time=base_time
    )
    record1.batch_runs.append(BatchRun(
        batch_id="BATCH-20260601-001",
        batch_name="日常批跑-6月1日第1批",
        model_version="v3.2.1",
        run_time=base_time + timedelta(hours=1),
        risk_level=RiskLevel.LOW,
        confidence=0.92
    ))
    record1.add_history("灰度批次导入，模型初判低风险，置信度0.92")
    record1.add_history("标注员确认无误，无人工修正")
    record1.disposal_type = DisposalType.NORMAL
    record1.final_risk_level = RiskLevel.LOW

    # ========== 记录2：人工改判被下一次批跑覆盖 ==========
    record2 = CostAttributionRecord(
        record_id="REC-2026-0002",
        content_id="CONTENT-8835",
        content_preview="用户发布内容含疑似诱导性话术，需结合上下文判断",
        gray_batch_id="GRAY-20260601-A",
        gray_batch_name="灰度批次20260601-A（模型v3.2.1灰度）",
        first_import_time=base_time + timedelta(minutes=15)
    )
    record2.batch_runs.append(BatchRun(
        batch_id="BATCH-20260601-001",
        batch_name="日常批跑-6月1日第1批",
        model_version="v3.2.1",
        run_time=base_time + timedelta(hours=1, minutes=15),
        risk_level=RiskLevel.MEDIUM,
        confidence=0.68
    ))
    record2.add_history("灰度批次导入，模型初判中风险，置信度0.68")
    
    record2.manual_corrections.append(ManualCorrection(
        operator_id="OP-003",
        operator_name="老唐",
        original_risk=RiskLevel.MEDIUM,
        corrected_risk=RiskLevel.HIGH,
        reason="话术存在明确诱导转账特征，应升为高风险",
        timestamp=base_time + timedelta(hours=3)
    ))
    record2.add_history("老唐人工改判：中风险→高风险，理由：诱导转账特征")
    
    record2.batch_runs.append(BatchRun(
        batch_id="BATCH-20260601-002",
        batch_name="日常批跑-6月1日第2批（重跑）",
        model_version="v3.2.1",
        run_time=base_time + timedelta(hours=6),
        risk_level=RiskLevel.LOW,
        confidence=0.85
    ))
    record2.add_history("第二次批跑覆盖，模型重新判为低风险，置信度0.85")
    record2.add_history("人工改判被批跑覆盖，标记待安全审核复核")
    record2.needs_security_review = True
    record2.review_note = "人工曾判高风险，但后续批跑改回低风险，需安全审核同事确认最终口径"
    record2.disposal_type = DisposalType.OVERRIDDEN

    # ========== 记录3：后来从标注员留言补来的旧口径 ==========
    record3 = CostAttributionRecord(
        record_id="REC-2026-0003",
        content_id="CONTENT-8847",
        content_preview="用户发布内容使用了历史上曾定义为违规的术语，但当前口径未明确",
        gray_batch_id="GRAY-20260601-B",
        gray_batch_name="灰度批次20260601-B（模型v3.2.1灰度）",
        first_import_time=base_time + timedelta(minutes=30)
    )
    record3.batch_runs.append(BatchRun(
        batch_id="BATCH-20260601-001",
        batch_name="日常批跑-6月1日第1批",
        model_version="v3.2.1",
        run_time=base_time + timedelta(hours=1, minutes=30),
        risk_level=RiskLevel.LOW,
        confidence=0.78
    ))
    record3.add_history("灰度批次导入，模型初判低风险，置信度0.78")
    
    record3.annotation_messages.append(AnnotationMessage(
        annotator_id="ANNOT-012",
        annotator_name="小王",
        message="这条内容里的术语在Q1口径里是违规的，当时要求中风险处理。后来口径更新没明确提这条是不是改了，我拿不准，留言备注下。",
        timestamp=base_time + timedelta(hours=2),
        is_old_caliber=True
    ))
    record3.add_history("标注员小王留言：涉及Q1旧口径术语，拿不准")
    record3.add_history("老唐补看标注员留言，发现旧口径线索")
    record3.add_history("追溯旧口径文档，确认该术语仍应按中风险处理")
    record3.add_history("补录旧口径，修正为中风险")
    
    record3.disposal_type = DisposalType.SUPPLEMENTED
    record3.final_risk_level = RiskLevel.MEDIUM

    return [record1, record2, record3]
