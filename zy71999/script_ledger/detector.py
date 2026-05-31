import os
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set
from collections import defaultdict

from .ledger import ScriptRecord, Ledger


class Issue:
    SEVERITY_INFO = "info"
    SEVERITY_WARNING = "warning"
    SEVERITY_ERROR = "error"
    SEVERITY_CRITICAL = "critical"

    def __init__(self, record_id: str, issue_type: str, message: str,
                 severity: str = SEVERITY_WARNING, details: Optional[Dict] = None):
        self.record_id = record_id
        self.issue_type = issue_type
        self.message = message
        self.severity = severity
        self.details = details or {}

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "issue_type": self.issue_type,
            "message": self.message,
            "severity": self.severity,
            "details": self.details
        }

    def __str__(self) -> str:
        return f"[{self.severity.upper()}] {self.issue_type}: {self.message}"


class Detector:
    def __init__(self, ledger: Ledger):
        self.ledger = ledger

    def detect_all(self, records: Optional[List[ScriptRecord]] = None) -> List[Issue]:
        if records is None:
            records = self.ledger.get_all_records(reverse=False)
        
        issues = []
        issues.extend(self.detect_space_in_paths(records))
        issues.extend(self.detect_duplicate_runs(records))
        issues.extend(self.detect_file_version_issues(records))
        issues.extend(self.detect_failed_scripts(records))
        issues.extend(self.detect_missing_outputs(records))
        issues.extend(self.detect_rollback_issues(records))
        issues.extend(self.detect_suspicious_success(records))
        
        return sorted(issues, key=lambda x: self._severity_order(x.severity))

    def _severity_order(self, severity: str) -> int:
        order = {
            Issue.SEVERITY_CRITICAL: 0,
            Issue.SEVERITY_ERROR: 1,
            Issue.SEVERITY_WARNING: 2,
            Issue.SEVERITY_INFO: 3
        }
        return order.get(severity, 99)

    def detect_space_in_paths(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        for record in records:
            has_space = False
            space_paths = []
            
            if ' ' in record.cwd:
                has_space = True
                space_paths.append(f"cwd: {record.cwd}")
            
            if ' ' in record.command:
                cmd_parts = record.command.split()
                for part in cmd_parts:
                    if ' ' in part and (part.startswith('/') or part.startswith('.') or part.endswith(('.sh', '.py'))):
                        has_space = True
                        space_paths.append(f"command: {part}")
            
            for f in record.output_files:
                if ' ' in f:
                    has_space = True
                    space_paths.append(f"output: {f}")
            
            if has_space:
                issues.append(Issue(
                    record_id=record.id,
                    issue_type="space_in_path",
                    message=f"路径包含空格，可能导致脚本执行异常",
                    severity=Issue.SEVERITY_WARNING,
                    details={"affected_paths": space_paths}
                ))
        
        return issues

    def detect_duplicate_runs(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        groups = defaultdict(list)
        
        for record in records:
            sig = record.signature()
            groups[sig].append(record)
        
        for sig, group_records in groups.items():
            if len(group_records) > 1:
                group_records.sort(key=lambda r: r.start_time)
                first = group_records[0]
                duplicates = group_records[1:]
                
                for dup in duplicates:
                    time_diff = dup.start_time - first.start_time
                    issues.append(Issue(
                        record_id=dup.id,
                        issue_type="duplicate_run",
                        message=f"同一脚本在{time_diff:.0f}秒内被重复执行",
                        severity=Issue.SEVERITY_WARNING,
                        details={
                            "original_id": first.id,
                            "original_time": datetime.fromtimestamp(first.start_time).isoformat(),
                            "duplicate_time": datetime.fromtimestamp(dup.start_time).isoformat(),
                            "time_diff_seconds": time_diff
                        }
                    ))
        
        return issues

    def detect_file_version_issues(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        script_versions: Dict[str, List[Tuple[ScriptRecord, str]]] = defaultdict(list)
        
        for record in records:
            script_path = record._extract_script_path()
            if script_path and record.script_hash:
                key = f"{record.cwd}|{script_path}"
                script_versions[key].append((record, record.script_hash))
        
        for key, versions in script_versions.items():
            if len(versions) < 2:
                continue
            
            versions.sort(key=lambda x: x[0].start_time)
            seen_hashes: Dict[str, ScriptRecord] = {}
            
            for record, hash_val in versions:
                if hash_val in seen_hashes:
                    prev_record = seen_hashes[hash_val]
                    if record.rollback_to:
                        issues.append(Issue(
                            record_id=record.id,
                            issue_type="rollback_detected",
                            message=f"脚本已回滚到 {datetime.fromtimestamp(prev_record.start_time).strftime('%Y-%m-%d %H:%M')} 的版本",
                            severity=Issue.SEVERITY_INFO,
                            details={
                                "rollback_from_id": prev_record.id,
                                "script_hash": hash_val
                            }
                        ))
                    else:
                        issues.append(Issue(
                            record_id=record.id,
                            issue_type="old_script_version",
                            message=f"脚本使用的是旧版本（与{datetime.fromtimestamp(prev_record.start_time).strftime('%Y-%m-%d %H:%M')}版本相同），可能是回滚后未更新",
                            severity=Issue.SEVERITY_WARNING,
                            details={
                                "previous_id": prev_record.id,
                                "script_hash": hash_val
                            }
                        ))
                else:
                    seen_hashes[hash_val] = record
        
        return issues

    def detect_rollback_issues(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        
        for record in records:
            if record.rollback_to and record.exit_code == 0:
                for f, current_hash in record.file_hashes.items():
                    if not current_hash:
                        continue
                    
                    original = self.ledger.find_by_id(record.rollback_to)
                    if original and f in original.file_hashes:
                        original_hash = original.file_hashes[f]
                        if current_hash != original_hash:
                            issues.append(Issue(
                                record_id=record.id,
                                issue_type="rollback_output_mismatch",
                                message=f"回滚后输出文件 {f} 未恢复到原版本",
                                severity=Issue.SEVERITY_ERROR,
                                details={
                                    "output_file": f,
                                    "original_hash": original_hash,
                                    "current_hash": current_hash,
                                    "original_record_id": record.rollback_to
                                }
                            ))
        
        return issues

    def detect_failed_scripts(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        for record in records:
            if record.exit_code is not None and record.exit_code != 0:
                if record.failure_reason:
                    severity = Issue.SEVERITY_WARNING
                    msg = f"脚本执行失败（退出码 {record.exit_code}），已记录失败原因"
                else:
                    severity = Issue.SEVERITY_ERROR
                    msg = f"脚本执行失败（退出码 {record.exit_code}），未记录失败原因"
                
                issues.append(Issue(
                    record_id=record.id,
                    issue_type="script_failed",
                    message=msg,
                    severity=severity,
                    details={
                        "exit_code": record.exit_code,
                        "failure_reason": record.failure_reason
                    }
                ))
        
        return issues

    def detect_missing_outputs(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        for record in records:
            if record.exit_code == 0:
                missing = []
                for f in record.output_files:
                    full_path = os.path.join(record.cwd, f) if not os.path.isabs(f) else f
                    if not os.path.exists(full_path):
                        missing.append(f)
                
                if missing:
                    issues.append(Issue(
                        record_id=record.id,
                        issue_type="missing_output",
                        message=f"脚本声称成功但输出文件缺失: {', '.join(missing)}",
                        severity=Issue.SEVERITY_ERROR,
                        details={"missing_files": missing}
                    ))
        
        return issues

    def detect_suspicious_success(self, records: List[ScriptRecord]) -> List[Issue]:
        issues = []
        
        sig_groups = defaultdict(list)
        for record in records:
            sig = record.signature()
            sig_groups[sig].append(record)
        
        for sig, group in sig_groups.items():
            failed_runs = [r for r in group if r.exit_code != 0]
            success_runs = [r for r in group if r.exit_code == 0]
            
            if failed_runs and success_runs:
                for success in success_runs:
                    for failed in failed_runs:
                        if success.start_time > failed.start_time:
                            time_diff = success.start_time - failed.start_time
                            if time_diff < 3600 and not success.is_rerun:
                                issues.append(Issue(
                                    record_id=success.id,
                                    issue_type="suspicious_success",
                                    message=f"该脚本之前{time_diff:.0f}秒内有失败记录，本次成功请确认是否为补跑",
                                    severity=Issue.SEVERITY_WARNING,
                                    details={
                                        "failed_record_id": failed.id,
                                        "time_diff_seconds": time_diff,
                                        "previous_exit_code": failed.exit_code
                                    }
                                ))
                            break
        
        return issues

    def check_output_file_changed(self, record: ScriptRecord) -> Dict[str, Tuple[str, str]]:
        changes = {}
        for f, stored_hash in record.file_hashes.items():
            full_path = os.path.join(record.cwd, f) if not os.path.isabs(f) else f
            if os.path.exists(full_path) and os.path.isfile(full_path):
                try:
                    with open(full_path, 'rb') as fh:
                        current_hash = hashlib.sha256(fh.read()).hexdigest()
                        if current_hash != stored_hash:
                            changes[f] = (stored_hash, current_hash)
                except Exception:
                    pass
        return changes
