import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models import (
    ConsumableRecord, StatusHistory, ReplayException,
    ConsumableStatus, DataSource, AuditLog
)
from loguru import logger


class ReplayService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_exception_code(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:6].upper()
        return f"EXC-{timestamp}-{unique_id}"

    def generate_mock_data(
        self,
        count: int = 50,
        operator: str = "system"
    ) -> Dict[str, Any]:
        consumable_names = [
            "乙醇", "甲醇", "丙酮", "盐酸", "硫酸",
            "氢氧化钠", "氯化钠", "氯化钾", "葡萄糖", "琼脂粉",
            "培养皿", "试管", "移液枪头", "离心管", "PCR管"
        ]
        specifications = [
            "分析纯 500ml", "优级纯 500ml", "色谱纯 500ml",
            "AR 500g", "GR 500g", "生物级 100g"
        ]
        suppliers = [
            "国药集团化学试剂有限公司", "西格玛奥德里奇",
            "赛默飞世尔科技", "百灵威科技", "阿拉丁试剂"
        ]
        labs = [
            "化学实验室A", "生物实验室B", "物理实验室C",
            "材料实验室D", "环境实验室E"
        ]
        research_groups = [
            "纳米材料研究组", "生物医学研究组", "环境科学研究组",
            "新能源研究组", "人工智能研究组"
        ]
        data_sources = [ds for ds in DataSource]

        created_count = 0
        duplicate_count = 0

        for i in range(count):
            try:
                name = random.choice(consumable_names)
                spec = random.choice(specifications)
                batch_no = f"BATCH{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}"
                quantity = round(random.uniform(1, 100), 2)
                
                existing = self.db.query(ConsumableRecord).filter(
                    ConsumableRecord.consumable_name == name,
                    ConsumableRecord.specification == spec,
                    ConsumableRecord.batch_no == batch_no,
                    ConsumableRecord.quantity == quantity,
                    ConsumableRecord.is_duplicate == False
                ).first()

                record_no = f"CONS-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:8].upper()}"
                
                record = ConsumableRecord(
                    record_no=record_no,
                    consumable_name=name,
                    specification=spec,
                    quantity=quantity,
                    unit=random.choice(["瓶", "盒", "袋", "个", "支"]),
                    batch_no=batch_no,
                    expire_date=datetime.now() + timedelta(days=random.randint(30, 365)),
                    supplier=random.choice(suppliers),
                    data_source=random.choice(data_sources).value,
                    lab=random.choice(labs),
                    research_group=random.choice(research_groups),
                    current_status=ConsumableStatus.PENDING.value,
                    is_duplicate=existing is not None,
                    duplicate_of=existing.id if existing else None,
                    original_file_name="mock_data.xlsx",
                    original_row_number=i + 2,
                    original_data={"source": "mock", "index": i},
                    created_by=operator
                )

                self.db.add(record)
                
                if existing:
                    duplicate_count += 1
                else:
                    created_count += 1

            except Exception as e:
                logger.error(f"生成测试数据第 {i} 条失败: {str(e)}")
                continue

        self.db.commit()
        
        logger.info(f"造数完成: 新增 {created_count}, 重复 {duplicate_count}")
        
        return {
            "total_requested": count,
            "created_count": created_count,
            "duplicate_count": duplicate_count,
            "operator": operator
        }

    def change_status(
        self,
        record_id: int,
        new_status: ConsumableStatus,
        change_reason: str,
        operator: str,
        remark: Optional[str] = None
    ) -> StatusHistory:
        record = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.id == record_id
        ).first()
        
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        old_status = record.current_status
        
        status_history = StatusHistory(
            record_id=record_id,
            from_status=old_status,
            to_status=new_status.value,
            change_reason=change_reason,
            operator=operator,
            remark=remark
        )
        
        self.db.add(status_history)
        
        record.current_status = new_status.value
        
        self._create_audit_log(
            record_id=record_id,
            action="状态变更",
            module="耗材管理",
            operator=operator,
            before_data={"status": old_status},
            after_data={"status": new_status.value},
            diff_data={
                "field": "current_status",
                "old": old_status,
                "new": new_status.value,
                "reason": change_reason
            },
            remark=remark
        )
        
        self.db.commit()
        
        logger.info(f"记录 {record_id} 状态变更: {old_status} -> {new_status.value}, 操作者: {operator}")
        
        return status_history

    def reconcile_records(self, operator: str) -> Dict[str, Any]:
        result = {
            "total_checked": 0,
            "exceptions_found": 0,
            "exceptions": []
        }

        records = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.is_duplicate == False
        ).all()

        result["total_checked"] = len(records)

        for record in records:
            exceptions = []

            if not record.lab and not record.research_group:
                exceptions.append({
                    "type": "缺少去向信息",
                    "description": "该耗材既未关联实验室也未关联课题组",
                    "severity": "high"
                })

            if record.borrow_loss_mixed:
                exceptions.append({
                    "type": "借用损耗混合",
                    "description": "课题组借用和损耗记录混合，需要拆分",
                    "severity": "medium"
                })

            if record.current_status in [ConsumableStatus.BORROWED.value, ConsumableStatus.LOST.value]:
                if not record.missing_direction_reason:
                    exceptions.append({
                        "type": "缺少处理原因",
                        "description": f"状态为{record.current_status}但缺少处理原因说明",
                        "severity": "high"
                    })

            if exceptions:
                result["exceptions_found"] += 1
                
                exception_code = self._generate_exception_code()
                exception = ReplayException(
                    exception_code=exception_code,
                    exception_type="对账异常",
                    description="; ".join([e["description"] for e in exceptions]),
                    related_record_ids=[record.id],
                    status="待处理",
                    before_correction={
                        "record_id": record.id,
                        "record_no": record.record_no,
                        "consumable_name": record.consumable_name,
                        "current_status": record.current_status,
                        "lab": record.lab,
                        "research_group": record.research_group,
                        "missing_direction_reason": record.missing_direction_reason,
                        "borrow_loss_mixed": record.borrow_loss_mixed
                    }
                )
                
                self.db.add(exception)
                
                result["exceptions"].append({
                    "exception_code": exception_code,
                    "record_id": record.id,
                    "record_no": record.record_no,
                    "issues": exceptions
                })

                self.change_status(
                    record_id=record.id,
                    new_status=ConsumableStatus.EXCEPTION,
                    change_reason="对账发现异常",
                    operator=operator
                )

        self.db.commit()
        
        logger.info(f"对账完成: 检查 {result['total_checked']} 条, 发现 {result['exceptions_found']} 条异常")
        
        return result

    def resolve_exception(
        self,
        exception_id: int,
        resolution: str,
        resolved_by: str,
        after_correction: Optional[Dict[str, Any]] = None
    ) -> ReplayException:
        exception = self.db.query(ReplayException).filter(
            ReplayException.id == exception_id
        ).first()

        if not exception:
            raise ValueError(f"异常不存在: {exception_id}")

        exception.status = "已处理"
        exception.resolution = resolution
        exception.resolved_by = resolved_by
        exception.resolved_at = datetime.now()
        
        if after_correction:
            exception.after_correction = after_correction

        if exception.related_record_ids:
            for record_id in exception.related_record_ids:
                record = self.db.query(ConsumableRecord).filter(
                    ConsumableRecord.id == record_id
                ).first()
                
                if record:
                    self.change_status(
                        record_id=record_id,
                        new_status=ConsumableStatus.RESOLVED,
                        change_reason=f"异常已解决: {resolution}",
                        operator=resolved_by
                    )

        self.db.commit()
        
        logger.info(f"异常 {exception_id} 已解决, 处理人: {resolved_by}")
        
        return exception

    def _create_audit_log(
        self,
        record_id: Optional[int],
        action: str,
        module: str,
        operator: str,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        diff_data: Optional[Dict[str, Any]] = None,
        remark: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            record_id=record_id,
            action=action,
            module=module,
            operator=operator,
            ip_address=ip_address,
            request_params=None,
            before_data=before_data,
            after_data=after_data,
            diff_data=diff_data,
            remark=remark
        )
        
        self.db.add(audit_log)
        
        return audit_log

    def get_record_history(self, record_id: int) -> Dict[str, Any]:
        record = self.db.query(ConsumableRecord).filter(
            ConsumableRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        status_history = self.db.query(StatusHistory).filter(
            StatusHistory.record_id == record_id
        ).order_by(StatusHistory.change_time.desc()).all()

        audit_logs = self.db.query(AuditLog).filter(
            AuditLog.record_id == record_id
        ).order_by(AuditLog.action_time.desc()).all()

        import_evidence = record.import_evidence

        return {
            "record": {
                "id": record.id,
                "record_no": record.record_no,
                "consumable_name": record.consumable_name,
                "current_status": record.current_status
            },
            "status_history": [
                {
                    "id": sh.id,
                    "from_status": sh.from_status,
                    "to_status": sh.to_status,
                    "change_reason": sh.change_reason,
                    "operator": sh.operator,
                    "change_time": sh.change_time,
                    "remark": sh.remark
                }
                for sh in status_history
            ],
            "audit_logs": [
                {
                    "id": al.id,
                    "action": al.action,
                    "module": al.module,
                    "operator": al.operator,
                    "action_time": al.action_time,
                    "diff_data": al.diff_data,
                    "remark": al.remark
                }
                for al in audit_logs
            ],
            "import_evidence": {
                "source_file_name": import_evidence.source_file_name if import_evidence else None,
                "source_row_number": import_evidence.source_row_number if import_evidence else None,
                "original_raw_value": import_evidence.original_raw_value if import_evidence else None,
                "parsed_standard_value": import_evidence.parsed_standard_value if import_evidence else None,
                "is_manual_corrected": import_evidence.is_manual_corrected if import_evidence else False,
                "correction_history": import_evidence.correction_history if import_evidence else None
            } if import_evidence else None
        }
