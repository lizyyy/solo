from sqlalchemy.orm import Session
from datetime import datetime
import json

from app.models import SessionLocal, Batch, EvidenceRecord, DownloadAuthorization, ProcessingStatus, RiskType, EvidenceSource
from app.services.evidence_service import generate_uuid


def init_sample_data():
    db = SessionLocal()
    try:
        existing_batch = db.query(Batch).filter(Batch.batch_no == "BATCH-2024-001").first()
        if existing_batch:
            return

        create_normal_sample(db)
        create_conflict_sample(db)
        create_partial_success_sample(db)

    finally:
        db.close()


def create_normal_sample(db: Session):
    batch_id = generate_uuid()

    original_input = json.dumps(
        {
            "store_code": "SH-001",
            "device_count": 3,
            "audit_period": "2024-01-01 to 2024-01-31",
        },
        ensure_ascii=False,
    )

    processing_basis = json.dumps(
        {
            "regulation": "网络安全法第21条",
            "standard": "GB/T 22239-2019",
            "process": "自动采集 -> 哈希校验 -> 分类归档",
        },
        ensure_ascii=False,
    )

    batch = Batch(
        id=batch_id,
        batch_no="BATCH-2024-001",
        environment_name="上海门店-徐汇店",
        operator="张三",
        risk_type=RiskType.DATA_LEAKAGE,
        status=ProcessingStatus.SUCCESS,
        description="上海门店1月份数据泄露风险审计取证",
        original_input=original_input,
        processing_basis=processing_basis,
        created_at=datetime(2024, 2, 1, 10, 0, 0),
        updated_at=datetime(2024, 2, 1, 10, 30, 0),
    )
    db.add(batch)

    evidence_data = [
        {
            "evidence_id": "EVID-001",
            "source": EvidenceSource.SECURITY_LOG,
            "device_name": "收银机-01",
            "device_ip": "192.168.1.101",
            "risk_level": "high",
            "evidence_path": "/data/evidence/EVID-001.log",
            "evidence_hash": "a1b2c3d4e5f6g7h8i9j0",
        },
        {
            "evidence_id": "EVID-002",
            "source": EvidenceSource.NETWORK_TRAFFIC,
            "device_name": "路由器-01",
            "device_ip": "192.168.1.1",
            "risk_level": "medium",
            "evidence_path": "/data/evidence/EVID-002.pcap",
            "evidence_hash": "b2c3d4e5f6g7h8i9j0a1",
        },
        {
            "evidence_id": "EVID-003",
            "source": EvidenceSource.DATABASE_AUDIT,
            "device_name": "数据库服务器",
            "device_ip": "192.168.1.50",
            "risk_level": "high",
            "evidence_path": "/data/evidence/EVID-003.sql",
            "evidence_hash": "c3d4e5f6g7h8i9j0a1b2",
        },
    ]

    for data in evidence_data:
        record = EvidenceRecord(
            id=generate_uuid(),
            batch_id=batch_id,
            status=ProcessingStatus.SUCCESS,
            collected_at=datetime(2024, 2, 1, 10, 15, 0),
            **data,
        )
        db.add(record)

    auth1 = DownloadAuthorization(
        id=generate_uuid(),
        batch_id=batch_id,
        authorized_by="张三",
        authorized_to="李四",
        authorized_at=datetime(2024, 2, 1, 14, 0, 0),
        expires_at=datetime(2024, 2, 8, 14, 0, 0),
        is_used=True,
        used_at=datetime(2024, 2, 2, 9, 30, 0),
        used_by="李四",
        reason="合规审计需要",
    )
    db.add(auth1)

    auth2 = DownloadAuthorization(
        id=generate_uuid(),
        batch_id=batch_id,
        authorized_by="张三",
        authorized_to="王五",
        authorized_at=datetime(2024, 2, 3, 10, 0, 0),
        expires_at=datetime(2024, 2, 10, 10, 0, 0),
        is_used=False,
        reason="内部审计复核",
    )
    db.add(auth2)

    db.commit()


def create_conflict_sample(db: Session):
    batch_id = generate_uuid()

    original_input = json.dumps(
        {
            "store_code": "BJ-001",
            "device_count": 2,
            "audit_period": "2024-01-15 to 2024-02-15",
        },
        ensure_ascii=False,
    )

    processing_basis = json.dumps(
        {
            "regulation": "网络安全法第21条",
            "standard": "GB/T 22239-2019",
            "process": "手动上传 -> 哈希校验 -> 审核确认",
        },
        ensure_ascii=False,
    )

    batch = Batch(
        id=batch_id,
        batch_no="BATCH-2024-002-CONFLICT",
        environment_name="北京门店-朝阳店",
        operator="赵六",
        risk_type=RiskType.UNAUTHORIZED_ACCESS,
        status=ProcessingStatus.PARTIAL_SUCCESS,
        description="北京门店异常登录审计取证（批次冲突示例）",
        original_input=original_input,
        processing_basis=processing_basis,
        created_at=datetime(2024, 2, 5, 14, 0, 0),
        updated_at=datetime(2024, 2, 5, 15, 30, 0),
    )
    db.add(batch)

    evidence_data = [
        {
            "evidence_id": "EVID-004",
            "source": EvidenceSource.ACCESS_LOG,
            "device_name": "POS机-01",
            "device_ip": "192.168.2.101",
            "risk_level": "critical",
            "evidence_path": "/data/evidence/EVID-004.log",
            "evidence_hash": "d4e5f6g7h8i9j0a1b2c3",
        },
        {
            "evidence_id": "EVID-005",
            "source": EvidenceSource.ENDPOINT_LOG,
            "device_name": "办公电脑-03",
            "device_ip": "192.168.2.51",
            "risk_level": "high",
            "evidence_path": "/data/evidence/EVID-005.log",
            "evidence_hash": "e5f6g7h8i9j0a1b2c3d4",
        },
        {
            "evidence_id": "EVID-006",
            "source": EvidenceSource.SECURITY_LOG,
            "device_name": "防火墙-01",
            "device_ip": "192.168.2.1",
            "risk_level": "medium",
            "evidence_path": "/data/evidence/EVID-006.log",
            "evidence_hash": "f6g7h8i9j0a1b2c3d4e5",
        },
    ]

    for i, data in enumerate(evidence_data):
        if i == 2:
            status = ProcessingStatus.FAILED
            error_msg = "文件哈希校验失败，可能已被篡改"
        else:
            status = ProcessingStatus.SUCCESS
            error_msg = None

        record = EvidenceRecord(
            id=generate_uuid(),
            batch_id=batch_id,
            status=status,
            error_message=error_msg,
            collected_at=datetime(2024, 2, 5, 14, 30, 0),
            **data,
        )
        db.add(record)

    db.commit()


def create_partial_success_sample(db: Session):
    batch_id = generate_uuid()

    original_input = json.dumps(
        {
            "store_code": "GZ-001",
            "device_count": 4,
            "audit_period": "2024-02-01 to 2024-02-28",
        },
        ensure_ascii=False,
    )

    processing_basis = json.dumps(
        {
            "regulation": "数据安全法第27条",
            "standard": "GB/T 37988-2019",
            "process": "API对接 -> 自动采集 -> 人工审核",
        },
        ensure_ascii=False,
    )

    batch = Batch(
        id=batch_id,
        batch_no="BATCH-2024-003-PARTIAL",
        environment_name="广州门店-天河店",
        operator="孙七",
        risk_type=RiskType.MALWARE,
        status=ProcessingStatus.PARTIAL_SUCCESS,
        description="广州门店恶意软件检测取证（部分成功示例）",
        original_input=original_input,
        processing_basis=processing_basis,
        created_at=datetime(2024, 3, 1, 9, 0, 0),
        updated_at=datetime(2024, 3, 1, 11, 0, 0),
    )
    db.add(batch)

    evidence_data = [
        {
            "evidence_id": "EVID-007",
            "source": EvidenceSource.ENDPOINT_LOG,
            "device_name": "工作站-01",
            "device_ip": "192.168.3.10",
            "risk_level": "critical",
            "evidence_path": "/data/evidence/EVID-007.log",
            "evidence_hash": "g7h8i9j0a1b2c3d4e5f6",
        },
        {
            "evidence_id": "EVID-008",
            "source": EvidenceSource.ENDPOINT_LOG,
            "device_name": "工作站-02",
            "device_ip": "192.168.3.11",
            "risk_level": "critical",
            "evidence_path": "/data/evidence/EVID-008.log",
            "evidence_hash": "h8i9j0a1b2c3d4e5f6g7",
        },
        {
            "evidence_id": "EVID-009",
            "source": EvidenceSource.SECURITY_LOG,
            "device_name": "EDR管理端",
            "device_ip": "192.168.3.5",
            "risk_level": "high",
            "evidence_path": "/data/evidence/EVID-009.log",
            "evidence_hash": "i9j0a1b2c3d4e5f6g7h8",
        },
        {
            "evidence_id": "EVID-010",
            "source": EvidenceSource.NETWORK_TRAFFIC,
            "device_name": "核心交换机",
            "device_ip": "192.168.3.254",
            "risk_level": "medium",
            "evidence_path": None,
            "evidence_hash": None,
        },
    ]

    for i, data in enumerate(evidence_data):
        if i == 3:
            status = ProcessingStatus.FAILED
            error_msg = "设备连接超时，采集失败"
        elif i == 2:
            status = ProcessingStatus.PENDING
            error_msg = None
        else:
            status = ProcessingStatus.SUCCESS
            error_msg = None

        record = EvidenceRecord(
            id=generate_uuid(),
            batch_id=batch_id,
            status=status,
            error_message=error_msg,
            collected_at=datetime(2024, 3, 1, 10, 0, 0) if i != 3 else None,
            **data,
        )
        db.add(record)

    db.commit()
