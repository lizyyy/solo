import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from .executor import DeliveryExecutor, ExecutionJournal, ExecutionResult
from .utils import calculate_sha256, get_current_timestamp, ensure_dir


@dataclass
class RollbackPlan:
    rollback_id: str
    source_journal_id: str
    created_at: str
    is_dry_run: bool
    can_rollback: bool
    reasons: List[str] = field(default_factory=list)
    items: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "rollback_id": self.rollback_id,
            "source_journal_id": self.source_journal_id,
            "created_at": self.created_at,
            "is_dry_run": self.is_dry_run,
            "can_rollback": self.can_rollback,
            "reasons": self.reasons,
            "items": self.items
        }


class RollbackManager:
    def __init__(self, delivery_root: Path, audit_dir: Path):
        self.delivery_root = delivery_root
        self.audit_dir = audit_dir
        self.executor = DeliveryExecutor(delivery_root, audit_dir)
    
    def create_rollback_plan(
        self,
        source_journal: ExecutionJournal,
        is_dry_run: bool = True
    ) -> RollbackPlan:
        import uuid
        
        rollback_id = f"RB-{uuid.uuid4().hex[:8]}"
        created_at = get_current_timestamp()
        
        can_rollback = True
        reasons: List[str] = []
        items: List[Dict] = []
        
        for result in source_journal.results:
            device_id = result.device_id
            device_dir = self.delivery_root / device_id
            
            check_result = self._check_device_directory(device_dir, result)
            
            if not check_result["intact"]:
                can_rollback = False
                reasons.append(f"设备 {device_id} 目录已被修改: {check_result['reason']}")
            
            items.append({
                "device_id": device_id,
                "package_id": result.package_id,
                "device_dir": str(device_dir),
                "intact": check_result["intact"],
                "files_to_remove": result.files_copied.copy()
            })
        
        return RollbackPlan(
            rollback_id=rollback_id,
            source_journal_id=source_journal.journal_id,
            created_at=created_at,
            is_dry_run=is_dry_run,
            can_rollback=can_rollback,
            reasons=reasons,
            items=items
        )
    
    def _check_device_directory(
        self,
        device_dir: Path,
        execution_result: ExecutionResult
    ) -> Dict:
        if not device_dir.exists():
            return {
                "intact": False,
                "reason": f"设备目录不存在: {device_dir}"
            }
        
        manifest_path = device_dir / "manifest.json"
        if not manifest_path.exists():
            return {
                "intact": False,
                "reason": "manifest.json 不存在，目录可能已被清理"
            }
        
        try:
            from .manifest import PackageManifest
            manifest = PackageManifest.from_file(manifest_path)
            
            for file_entry in manifest.get_all_files():
                file_path = device_dir / file_entry.filename
                
                if not file_path.exists():
                    return {
                        "intact": False,
                        "reason": f"文件丢失: {file_entry.filename}"
                    }
                
                actual_hash = calculate_sha256(file_path)
                if actual_hash != file_entry.sha256:
                    return {
                        "intact": False,
                        "reason": f"文件 {file_entry.filename} 内容已被修改"
                    }
        
        except Exception as e:
            return {
                "intact": False,
                "reason": f"验证失败: {e}"
            }
        
        return {"intact": True, "reason": ""}
    
    def execute_rollback(self, rollback_plan: RollbackPlan, source_journal: ExecutionJournal) -> ExecutionJournal:
        if not rollback_plan.can_rollback:
            raise ValueError("无法执行回滚: 目标目录已被人工修改")
        
        import uuid
        
        started_at = get_current_timestamp()
        journal_id = f"JNL-RB-{uuid.uuid4().hex[:8]}"
        
        results: List[ExecutionResult] = []
        
        for item in rollback_plan.items:
            result = self._rollback_device(item)
            results.append(result)
        
        completed_at = get_current_timestamp()
        
        success_count = sum(1 for r in results if r.success)
        failure_count = len(results) - success_count
        
        journal = ExecutionJournal(
            journal_id=journal_id,
            plan_id=f"rollback-{rollback_plan.rollback_id}",
            execution_type="rollback",
            started_at=started_at,
            completed_at=completed_at,
            results=results,
            success_count=success_count,
            failure_count=failure_count
        )
        
        self._save_journal(journal)
        
        return journal
    
    def _rollback_device(self, item: Dict) -> ExecutionResult:
        started_at = get_current_timestamp()
        errors: List[str] = []
        files_removed: List[str] = []
        files_verified: List[str] = []
        
        device_dir = Path(item["device_dir"])
        files_to_remove = item.get("files_to_remove", [])
        
        for filename in files_to_remove:
            file_path = device_dir / filename
            if file_path.exists():
                try:
                    file_path.unlink()
                    files_removed.append(filename)
                except Exception as e:
                    errors.append(f"删除文件 {filename} 失败: {e}")
        
        manifest_path = device_dir / "manifest.json"
        if manifest_path.exists():
            try:
                manifest_path.unlink()
                files_removed.append("manifest.json")
            except Exception as e:
                errors.append(f"删除 manifest.json 失败: {e}")
        
        remaining_files = list(device_dir.iterdir()) if device_dir.exists() else []
        if remaining_files:
            files_verified = [f.name for f in remaining_files]
        
        completed_at = get_current_timestamp()
        success = len(errors) == 0
        
        return ExecutionResult(
            success=success,
            device_id=item["device_id"],
            package_id=item.get("package_id", "rollback"),
            files_copied=files_removed,
            files_verified=files_verified,
            errors=errors,
            started_at=started_at,
            completed_at=completed_at
        )
    
    def _save_journal(self, journal: ExecutionJournal) -> None:
        journal_file = self.audit_dir / f"journal-{journal.journal_id}.json"
        with open(journal_file, "w", encoding="utf-8") as f:
            json.dump(journal.to_dict(), f, indent=2, ensure_ascii=False)
