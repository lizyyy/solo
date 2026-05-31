from datetime import datetime, timedelta
from typing import Optional, Dict, List, Set
from models import (
    ApprovalRecord, RollbackResult, RecordStatus,
    Issue, IssueType, PermissionTable, PermissionDiff,
    RollbackPackage
)


class HumanMessageProvider:
    ISSUE_MESSAGES = {
        IssueType.IDEMPOTENT_KEY_INVALID: {
            "message": "这条记录的去重标记已经过期或即将过期了",
            "suggestion": "请联系系统管理员核对，确认是首次回滚不会重复操作"
        },
        IssueType.OLD_CLIENT_PARAMS_CORRUPTED: {
            "message": "旧版本客户端上传的参数有缺失",
            "suggestion": "请导出原始单据对照，必要时请手工补齐缺失的信息再重试"
        },
        IssueType.AUDIT_LOG_GAP: {
            "message": "操作日志不完整",
            "suggestion": "请先补全这段时间的操作日志，或在日志补全后系统会自动重新判断"
        },
    }

    @classmethod
    def make_issue(cls, issue_type: IssueType, context: str = "", **kwargs) -> Issue:
        template = cls.ISSUE_MESSAGES.get(issue_type, {})
        base_msg = template.get("message", "")
        suggestion = template.get("suggestion", "")
        human_msg = f"{base_msg}{'：' + context if context else ''}"
        return Issue(
            issue_type=issue_type,
            human_message=human_msg,
            suggestion=suggestion
        )


class IdempotentKeyValidator:
    def __init__(self, validity_hours: int = 720):
        self.validity_hours = validity_hours
        self._used_keys: Set[str] = set()
        self._key_timestamps: Dict[str, datetime] = {}

    def is_valid(self, record: ApprovalRecord) -> tuple[bool, Optional[str]]:
        if not record.idempotent_key:
            return False, "没有去重标记为空"

        key = record.idempotent_key

        if key in self._used_keys:
            return False, f"去重标记已被使用过"

        approval_time = record.approval_time
        age = datetime.now() - approval_time
        if age > timedelta(hours=self.validity_hours):
            return False, f"去重标记已超过有效期（{self.validity_hours}小时）"

        return True, None

    def mark_used(self, key: str) -> None:
        self._used_keys.add(key)
        self._key_timestamps[key] = datetime.now()


class ClientParamsIntegrityChecker:
    REQUIRED_FIELDS = [
        "applicant", "approver", "approval_time", "status", "content"
    ]

    OLD_CLIENT_VERSION_THRESHOLD = 2.0

    def check(self, record: ApprovalRecord) -> tuple[bool, List[str]]:
        missing = []

        try:
            version = float(record.client_version) if record.client_version else 0.0
        except (ValueError, TypeError):
            version = 0.0

        if version < self.OLD_CLIENT_VERSION_THRESHOLD:
            missing.append(f"客户端版本过低（{record.client_version or '未知'}）")

        for field in self.REQUIRED_FIELDS:
            value = getattr(record, field, None)
            if value is None or value == "":
                field_names = {
                    "applicant": "申请人",
                    "approver": "审批人",
                    "approval_time": "审批时间",
                    "status": "审批状态",
                    "content": "审批内容"
                }
                missing.append(f"{field_names[field]}未填写")

        return len(missing) == 0, missing


class AuditLogGapDetector:
    EXPECTED_LOG_ORDER = [
        "submit", "review", "approve"
    ]

    def detect(self, record: ApprovalRecord) -> tuple[bool, str]:
        log_ids = record.audit_log_ids
        if not log_ids:
            return True, "没有关联任何操作日志记录"

        expected_count = len(self.EXPECTED_LOG_ORDER)
        actual_count = len(log_ids)

        if actual_count < expected_count:
            missing_steps = expected_count - actual_count
            return True, f"应有 {expected_count} 条操作日志，实际只有 {actual_count} 条，缺了 {missing_steps} 条"

        if actual_count != expected_count:
            return True, f"操作日志数量不对（{actual_count} 条）"

        return False, ""


class PermissionTableManager:
    def __init__(self):
        self._versions: Dict[str, PermissionTable] = {}

    def register_version(self, permission_table: PermissionTable) -> None:
        self._versions[permission_table.version] = permission_table

    def get_version(self, version: str) -> Optional[PermissionTable]:
        return self._versions.get(version)

    def compare_with_current(self, new_table: PermissionTable, record_version: Optional[str]) -> Optional[PermissionDiff]:
        if record_version and record_version in self._versions:
            old = self._versions[record_version]
            return old.compare(new_table)
        return None

    def has_version(self, version: str) -> bool:
        return version in self._versions


class RollbackEngine:
    def __init__(
        self,
        idempotent_validity_hours: int = 720
    ):
        self.idempotent_validator = IdempotentKeyValidator(idempotent_validity_hours)
        self.params_checker = ClientParamsIntegrityChecker()
        self.audit_detector = AuditLogGapDetector()
        self.permission_manager = PermissionTableManager()
        self.message_provider = HumanMessageProvider()
        self.previous_results: Dict[str, RollbackResult] = {}

    def process_package(self, package: RollbackPackage) -> List[RollbackResult]:
        if package.permission_table:
            self.permission_manager.register_version(package.permission_table)

        results = []
        for record in package.records:
            result = self.process_single_record(record, package.permission_table)
            results.append(result)
            self.previous_results[record.approval_id] = result

        return results

    def process_single_record(
        self,
        record: ApprovalRecord,
        current_permission_table: Optional[PermissionTable]
    ) -> RollbackResult:
        result = RollbackResult(
            approval_id=record.approval_id,
            success=False,
            record_status=record.record_status
        )

        if record.record_status == RecordStatus.DUPLICATE:
            result.record_status = RecordStatus.DUPLICATE
            result.issues.extend(record.issues)
            result.actions_taken.append("检测到重复记录，已跳过")
            return result

        needs_confirm = False

        idempotent_ok, idempotent_msg = self.idempotent_validator.is_valid(record)
        if not idempotent_ok:
            needs_confirm = True
            issue = self.message_provider.make_issue(
                IssueType.IDEMPOTENT_KEY_INVALID,
                context=idempotent_msg
            )
            issue.affected_fields = ["idempotent_key"]
            result.issues.append(issue)
            result.actions_taken.append("幂等键检查不通过")

        params_ok, missing = self.params_checker.check(record)
        if not params_ok:
            needs_confirm = True
            issue = self.message_provider.make_issue(
                IssueType.OLD_CLIENT_PARAMS_CORRUPTED,
                context="、".join(missing)
            )
            issue.affected_fields = missing
            result.issues.append(issue)
            result.actions_taken.append("客户端参数完整性检查不通过")

        has_gap, gap_msg = self.audit_detector.detect(record)
        if has_gap:
            needs_confirm = True
            issue = self.message_provider.make_issue(
                IssueType.AUDIT_LOG_GAP,
                context=gap_msg
            )
            issue.affected_fields = ["audit_log_ids"]
            result.issues.append(issue)
            result.actions_taken.append("审计日志完整性检查不通过")

        if current_permission_table and record.permission_table_version:
            if self.permission_manager.has_version(record.permission_table_version):
                diff = self.permission_manager.compare_with_current(
                    current_permission_table,
                    record.permission_table_version
                )
                if diff and diff.has_changes:
                    result.permission_changes = diff
                    result.actions_taken.append(
                        f"检测到权限表从版本 {record.permission_table_version} 变更为 {current_permission_table.version}"
                    )

        if needs_confirm:
            result.record_status = RecordStatus.PENDING_CONFIRM
            result.needs_manual_confirm = True
            result.success = False
        else:
            if idempotent_ok and record.idempotent_key:
                self.idempotent_validator.mark_used(record.idempotent_key)
            result.record_status = RecordStatus.ROLLBACK_SUCCESS
            result.success = True
            result.actions_taken.append("回滚操作已执行")

            if record.manual_corrections:
                for corr in record.manual_corrections:
                    result.actions_taken.append(
                        f"已同步撤销人工更正：{corr.field_name} 从「{corr.new_value}」恢复为「{corr.old_value}」"
                    )

            for attachment in record.attachments:
                if attachment.is_late:
                    result.actions_taken.append(
                        f"已标记晚到附件「{attachment.name}」待人工确认是否需要同步撤销"
                    )

        result.issues.extend(record.issues)
        return result

    def get_previous_result(self, approval_id: str) -> Optional[RollbackResult]:
        return self.previous_results.get(approval_id)

    def summarize_results(self, results: List[RollbackResult]) -> str:
        total = len(results)
        success = sum(1 for r in results if r.success)
        pending = sum(1 for r in results if r.needs_manual_confirm)
        failed = total - success - pending

        lines = [
            f"📊 回滚处理汇总",
            f"共处理 {total} 条记录",
            f"  ✅ 成功回滚：{success} 条",
            f"  ❓ 待人工确认：{pending} 条" if pending > 0 else "",
            f"  ❌ 回滚失败：{failed} 条" if failed > 0 else ""
        ]
        lines = [line for line in lines if line]

        if pending > 0:
            lines.append("")
            lines.append("⚠️  待确认清单：")
            for r in results:
                if r.needs_manual_confirm:
                    lines.append(f"  • {r.approval_id}")

        return "\n".join(lines)
