import yaml
import json
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional
from .models import (
    AuditItem, AuditResult, AuditStatus, ErrorCode, AuditError, CorrectionNote
)


class AuditProcessor:
    def __init__(self):
        self.errors: List[AuditError] = []

    def load_audit_data(self, file_path: str) -> List[dict]:
        path = Path(file_path)
        if not path.exists():
            self.errors.append(AuditError(
                code=ErrorCode.FILE_NOT_FOUND,
                message=f"文件不存在: {file_path}",
                details={"file_path": file_path}
            ))
            return []

        try:
            if path.suffix in ('.yaml', '.yml'):
                with open(path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
            elif path.suffix == '.json':
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                self.errors.append(AuditError(
                    code=ErrorCode.INVALID_DATA,
                    message=f"不支持的文件格式: {path.suffix}",
                    details={"file_path": file_path}
                ))
                return []

            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'items' in data:
                return data['items']
            else:
                return [data]

        except Exception as e:
            self.errors.append(AuditError(
                code=ErrorCode.INVALID_DATA,
                message=f"文件解析失败: {str(e)}",
                details={"file_path": file_path, "error": str(e)}
            ))
            return []

    def validate_audit_item(self, item_data: dict) -> Tuple[AuditItem, List[AuditError]]:
        item_errors = []

        try:
            item = AuditItem(
                item_id=item_data.get('item_id', ''),
                item_name=item_data.get('item_name', ''),
                category=item_data.get('category', ''),
                responsible_person=item_data.get('responsible_person'),
                department=item_data.get('department', ''),
                environment_name=item_data.get('environment_name', ''),
                source=item_data.get('source', ''),
                original_data=item_data,
                processing_basis=[
                    "《多源审计取证管理规范》V2.1",
                    "门店设备台账管理办法 第3章第2节"
                ]
            )
        except Exception as e:
            item_errors.append(AuditError(
                code=ErrorCode.INVALID_DATA,
                message=f"审计项数据无效: {str(e)}",
                details={"item_data": item_data}
            ))
            return None, item_errors

        if not item.responsible_person:
            item.status = AuditStatus.FAIL
            item.error_message = "负责人缺失，请确认该审计项的责任人"
            item_errors.append(AuditError(
                code=ErrorCode.MISSING_RESPONSIBLE,
                message=f"审计项 [{item.item_id}] {item.item_name} 负责人缺失",
                details={
                    "item_id": item.item_id,
                    "item_name": item.item_name,
                    "department": item.department
                }
            ))
        else:
            item.status = AuditStatus.PASS

        item.check_time = datetime.now()
        return item, item_errors

    def process_audit(self, file_path: str) -> Tuple[Optional[AuditResult], List[AuditError]]:
        self.errors = []
        audit_items = []

        raw_data = self.load_audit_data(file_path)
        if not raw_data and self.errors:
            return None, self.errors

        all_item_errors = []
        environment_name = ""

        for idx, item_data in enumerate(raw_data):
            item, item_errors = self.validate_audit_item(item_data)
            if item:
                audit_items.append(item)
                if not environment_name:
                    environment_name = item.environment_name
            all_item_errors.extend(item_errors)

        self.errors.extend(all_item_errors)

        if not audit_items:
            return None, self.errors

        pass_count = sum(1 for item in audit_items if item.status == AuditStatus.PASS)
        fail_count = sum(1 for item in audit_items if item.status == AuditStatus.FAIL)
        warning_count = sum(1 for item in audit_items if item.status == AuditStatus.WARNING)
        pending_count = sum(1 for item in audit_items if item.status == AuditStatus.PENDING)

        if fail_count > 0 and pass_count > 0:
            overall_status = AuditStatus.PARTIAL
        elif fail_count > 0:
            overall_status = AuditStatus.FAIL
        elif warning_count > 0:
            overall_status = AuditStatus.WARNING
        else:
            overall_status = AuditStatus.PASS

        result = AuditResult(
            environment_name=environment_name,
            total_count=len(audit_items),
            pass_count=pass_count,
            fail_count=fail_count,
            warning_count=warning_count,
            pending_count=pending_count,
            overall_status=overall_status,
            items=audit_items
        )

        return result, self.errors

    def add_correction_note(
        self,
        item: AuditItem,
        corrector: str,
        corrected_judgment: AuditStatus,
        reason: str,
        evidence: Optional[str] = None
    ) -> AuditItem:
        note = CorrectionNote(
            corrector=corrector,
            original_judgment=item.status,
            corrected_judgment=corrected_judgment,
            reason=reason,
            evidence=evidence
        )
        item.correction_notes.append(note)
        return item
