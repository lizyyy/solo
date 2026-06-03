from datetime import datetime, timedelta
from models import (
    FeeRateRecord, RecordStatus, Currency, EmailSupplement, SettlementBatch,
    ProcessingResult, ConflictType, ConflictEvidence
)


def create_smooth_record() -> FeeRateRecord:
    record = FeeRateRecord(
        record_id="RATE-2026-0001",
        product_code="LCP-2026-0601",
        product_name="稳健增利理财A款",
        status=RecordStatus.INITIAL
    )

    record.email_supplement = EmailSupplement(
        email_id="EMAIL-2026-0528-001",
        sender="客户经理张伟",
        sent_at=datetime(2026, 5, 28, 14, 30),
        product_code="LCP-2026-0601",
        currency_raw="CNY",
        rate=0.0035,
        effective_date="2026-06-01",
        version_remark="2026年Q2费率调整版本",
        raw_content="主题：稳健增利理财A款费率调整\n\n您好，现提交稳健增利理财A款（LCP-2026-0601）的费率调整申请：\n币种：人民币 CNY\n费率：0.35%\n生效日期：2026-06-01\n版本备注：2026年Q2费率调整版本\n\n请予以办理。\n\n客户经理 张伟"
    )

    record.settlement_batch = SettlementBatch(
        batch_no="SETTLE-2026-05-00123",
        import_time=datetime(2026, 5, 29, 9, 15),
        product_code="LCP-2026-0601",
        currency=Currency.CNY,
        rate=0.0035,
        effective_date="2026-06-01",
        caliber_version="V2.0",
        is_old_caliber=False
    )

    record.processing_result = ProcessingResult.SMOOTH
    return record


def create_mixed_currency_record() -> FeeRateRecord:
    record = FeeRateRecord(
        record_id="RATE-2026-0002",
        product_code="LCP-2026-0602",
        product_name="汇盈精选理财B款",
        status=RecordStatus.INITIAL
    )

    record.email_supplement = EmailSupplement(
        email_id="EMAIL-2026-0528-002",
        sender="客户经理李娜",
        sent_at=datetime(2026, 5, 28, 16, 45),
        product_code="LCP-2026-0602",
        currency_raw="CNY/HKD",
        rate=0.0042,
        effective_date="2026-06-01",
        version_remark="2026年跨境理财通费率版本",
        raw_content="主题：汇盈精选理财B款费率申请\n\n您好，现提交汇盈精选理财B款（LCP-2026-0602）费率：\n币种：人民币/港币 CNY/HKD\n费率：0.42%\n生效日期：2026-06-01\n版本备注：2026年跨境理财通费率版本\n\n谢谢。\n\n客户经理 李娜"
    )

    record.settlement_batch = SettlementBatch(
        batch_no="SETTLE-2026-05-00124",
        import_time=datetime(2026, 5, 29, 10, 20),
        product_code="LCP-2026-0602",
        currency=Currency.MIXED,
        rate=0.0042,
        effective_date="2026-06-01",
        caliber_version="V2.0",
        is_old_caliber=False
    )

    record.processing_result = ProcessingResult.CURRENCY_MIXED
    return record


def create_old_caliber_record() -> FeeRateRecord:
    record = FeeRateRecord(
        record_id="RATE-2026-0003",
        product_code="LCP-2026-0603",
        product_name="鑫享回报理财C款",
        status=RecordStatus.INITIAL
    )

    record.email_supplement = EmailSupplement(
        email_id="EMAIL-2026-0528-003",
        sender="客户经理王强",
        sent_at=datetime(2026, 5, 28, 11, 20),
        product_code="LCP-2026-0603",
        currency_raw="CNY",
        rate=0.0038,
        effective_date="2026-06-01",
        version_remark="补录2026年Q1费率调整",
        raw_content="主题：鑫享回报理财C款费率补录\n\n您好，补录鑫享回报理财C款（LCP-2026-0603）费率：\n币种：人民币 CNY\n费率：0.38%\n生效日期：2026-06-01\n版本备注：补录2026年Q1费率调整\n\n请使用历史清算批次核对。\n\n客户经理 王强"
    )

    record.settlement_batch = SettlementBatch(
        batch_no="SETTLE-2026-03-00089",
        import_time=datetime(2026, 3, 15, 16, 30),
        product_code="LCP-2026-0603",
        currency=Currency.CNY,
        rate=0.0038,
        effective_date="2026-03-01",
        caliber_version="V1.5",
        is_old_caliber=True
    )

    record.processing_result = ProcessingResult.OLD_CALIBER
    return record


def create_conflict_record() -> FeeRateRecord:
    record = FeeRateRecord(
        record_id="RATE-2026-0004",
        product_code="LCP-2026-0604",
        product_name="尊享收益理财D款",
        status=RecordStatus.INITIAL
    )

    record.email_supplement = EmailSupplement(
        email_id="EMAIL-2026-0528-004",
        sender="客户经理赵敏",
        sent_at=datetime(2026, 5, 28, 10, 0),
        product_code="LCP-2026-0604",
        currency_raw="HKD",
        rate=0.0050,
        effective_date="2026-06-01",
        version_remark="2026年Q2港币理财费率",
        raw_content="主题：尊享收益理财D款费率调整\n\n您好，现提交尊享收益理财D款（LCP-2026-0604）的费率调整：\n币种：港币 HKD\n费率：0.50%\n生效日期：2026-06-01\n版本备注：2026年Q2港币理财费率\n\n请予以办理。\n\n客户经理 赵敏"
    )

    record.settlement_batch = SettlementBatch(
        batch_no="SETTLE-2026-05-00126",
        import_time=datetime(2026, 5, 29, 11, 45),
        product_code="LCP-2026-0604",
        currency=Currency.CNY,
        rate=0.0045,
        effective_date="2026-06-01",
        caliber_version="V2.0",
        is_old_caliber=False
    )

    record.has_conflict = True
    record.conflict_evidences = [
        ConflictEvidence(
            conflict_type=ConflictType.CURRENCY_CONFLICT,
            field_name="currency",
            email_value="HKD",
            settlement_value=Currency.CNY,
            description="邮件标注为港币HKD，但清算批次记录为人民币CNY",
            email_source="EMAIL-2026-0528-004 客户经理赵敏",
            settlement_source="SETTLE-2026-05-00126 清算系统"
        ),
        ConflictEvidence(
            conflict_type=ConflictType.RATE_CONFLICT,
            field_name="rate",
            email_value=0.0050,
            settlement_value=0.0045,
            description="邮件费率为0.50%，清算批次费率为0.45%",
            email_source="EMAIL-2026-0528-004 客户经理赵敏",
            settlement_source="SETTLE-2026-05-00126 清算系统"
        )
    ]

    record.processing_result = ProcessingResult.CONFLICT_FOUND
    return record


def get_all_sample_records():
    return [
        create_smooth_record(),
        create_mixed_currency_record(),
        create_old_caliber_record(),
        create_conflict_record()
    ]
