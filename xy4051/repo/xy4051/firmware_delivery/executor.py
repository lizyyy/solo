import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from .manifest import PackageManifest
from .planner import DeliveryPlan, DeliveryItem
from .utils import calculate_sha256, get_current_timestamp, ensure_dir


@dataclass
class ExecutionResult:
    success: bool
    device_id: str
    package_id: str
    files_copied: List[str]
    files_verified: List[str]
    errors: List[str]
    started_at: str
    completed_at: str
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "device_id": self.device_id,
            "package_id": self.package_id,
            "files_copied": self.files_copied,
            "files_verified": self.files_verified,
            "errors": self.errors,
            "started_at": self.started_at,
            "completed_at": self.completed_at
        }


@dataclass
class ExecutionJournal:
    journal_id: str
    plan_id: str
    execution_type: str
    started_at: str
    completed_at: str
    results: List[ExecutionResult]
    success_count: int
    failure_count: int
    
    def to_dict(self) -> Dict:
        return {
            "journal_id": self.journal_id,
            "plan_id": self.plan_id,
            "execution_type": self.execution_type,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "results": [r.to_dict() for r in self.results],
            "success_count": self.success_count,
            "failure_count": self.failure_count
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ExecutionJournal":
        results = []
        for result_data in data.get("results", []):
            results.append(ExecutionResult(
                success=result_data["success"],
                device_id=result_data["device_id"],
                package_id=result_data["package_id"],
                files_copied=result_data.get("files_copied", []),
                files_verified=result_data.get("files_verified", []),
                errors=result_data.get("errors", []),
                started_at=result_data["started_at"],
                completed_at=result_data["completed_at"]
            ))
        
        return cls(
            journal_id=data["journal_id"],
            plan_id=data["plan_id"],
            execution_type=data.get("execution_type", "delivery"),
            started_at=data["started_at"],
            completed_at=data["completed_at"],
            results=results,
            success_count=data["success_count"],
            failure_count=data["failure_count"]
        )


class DeliveryExecutor:
    def __init__(self, delivery_root: Path, audit_dir: Path):
        self.delivery_root = delivery_root
        self.audit_dir = audit_dir
        ensure_dir(delivery_root)
        ensure_dir(audit_dir)
    
    def execute_plan(
        self,
        plan: DeliveryPlan,
        journal_id: Optional[str] = None
    ) -> ExecutionJournal:
        import uuid
        
        if plan.has_blockers():
            raise ValueError("计划包含阻断项，无法执行")
        
        started_at = get_current_timestamp()
        journal_id = journal_id or f"JNL-{uuid.uuid4().hex[:8]}"
        
        results: List[ExecutionResult] = []
        
        for item in plan.items:
            result = self._deliver_to_device(item)
            results.append(result)
        
        completed_at = get_current_timestamp()
        
        success_count = sum(1 for r in results if r.success)
        failure_count = len(results) - success_count
        
        journal = ExecutionJournal(
            journal_id=journal_id,
            plan_id=plan.plan_id,
            execution_type="delivery",
            started_at=started_at,
            completed_at=completed_at,
            results=results,
            success_count=success_count,
            failure_count=failure_count
        )
        
        self._save_journal(journal)
        
        return journal
    
    def _deliver_to_device(self, item: DeliveryItem) -> ExecutionResult:
        started_at = get_current_timestamp()
        errors: List[str] = []
        files_copied: List[str] = []
        files_verified: List[str] = []
        
        source_dir = Path(item.source_dir)
        target_dir = self.delivery_root / item.device_id
        
        ensure_dir(target_dir)
        
        manifest_path = source_dir / "manifest.json"
        manifest = PackageManifest.from_file(manifest_path)
        
        files_to_copy = manifest.get_all_files()
        
        for file_entry in files_to_copy:
            source_file = source_dir / file_entry.filename
            target_file = target_dir / file_entry.filename
            
            try:
                shutil.copy2(source_file, target_file)
                files_copied.append(file_entry.filename)
                
                actual_hash = calculate_sha256(target_file)
                if actual_hash != file_entry.sha256:
                    errors.append(
                        f"文件 {file_entry.filename} 哈希验证失败: "
                        f"期望 {file_entry.sha256}, 实际 {actual_hash}"
                    )
                else:
                    files_verified.append(file_entry.filename)
            except Exception as e:
                errors.append(f"复制文件 {file_entry.filename} 失败: {e}")
        
        try:
            target_manifest = target_dir / "manifest.json"
            shutil.copy2(manifest_path, target_manifest)
            files_copied.append("manifest.json")
        except Exception as e:
            errors.append(f"复制 manifest.json 失败: {e}")
        
        completed_at = get_current_timestamp()
        success = len(errors) == 0 and len(files_verified) == len(files_to_copy)
        
        return ExecutionResult(
            success=success,
            device_id=item.device_id,
            package_id=item.package_id,
            files_copied=files_copied,
            files_verified=files_verified,
            errors=errors,
            started_at=started_at,
            completed_at=completed_at
        )
    
    def _save_journal(self, journal: ExecutionJournal) -> None:
        journal_file = self.audit_dir / f"journal-{journal.journal_id}.json"
        with open(journal_file, "w", encoding="utf-8") as f:
            json.dump(journal.to_dict(), f, indent=2, ensure_ascii=False)
    
    def load_latest_journal(self) -> Optional[ExecutionJournal]:
        journal_files = sorted(
            self.audit_dir.glob("journal-*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        if not journal_files:
            return None
        
        return self.load_journal(journal_files[0])
    
    def load_journal(self, journal_path: Path) -> Optional[ExecutionJournal]:
        if not journal_path.exists():
            return None
        
        with open(journal_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return ExecutionJournal.from_dict(data)
    
    def get_all_journals(self) -> List[Path]:
        return sorted(
            self.audit_dir.glob("journal-*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
