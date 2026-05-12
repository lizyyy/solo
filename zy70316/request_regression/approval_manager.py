import os
import json
import hashlib
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from .models import Approval, ComparisonResult
from .config import RegressionConfig


class ApprovalManager:
    def __init__(self, config: RegressionConfig):
        self.config = config
        self.approvals: Dict[str, Approval] = {}
        self._load_approvals()

    def _load_approvals(self) -> None:
        approvals_dir = self.config.approvals_dir
        if not os.path.exists(approvals_dir):
            return

        for filename in os.listdir(approvals_dir):
            if not filename.endswith(".json"):
                continue

            file_path = os.path.join(approvals_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    approval = Approval.from_dict(data)
                    self.approvals[approval.diffs_hash] = approval
            except Exception:
                continue

    def create_approval(
        self,
        result: ComparisonResult,
        reason: str,
        approver: str,
    ) -> Approval:
        diffs_hash = self._calculate_diffs_hash(result)

        approval = Approval(
            approval_id=str(uuid.uuid4()),
            sample_id=result.sample_id,
            diffs_hash=diffs_hash,
            reason=reason,
            approver=approver,
            timestamp=datetime.now(),
        )

        self.approvals[diffs_hash] = approval
        self._save_approval(approval)

        return approval

    def _calculate_diffs_hash(self, result: ComparisonResult) -> str:
        diffs_data = [d.to_dict() for d in result.diffs if not d.ignored]
        content = json.dumps(diffs_data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def get_approval(self, result: ComparisonResult) -> Optional[Approval]:
        diffs_hash = self._calculate_diffs_hash(result)
        return self.approvals.get(diffs_hash)

    def is_approved(self, result: ComparisonResult) -> bool:
        return self.get_approval(result) is not None

    def _save_approval(self, approval: Approval) -> str:
        os.makedirs(self.config.approvals_dir, exist_ok=True)
        file_path = os.path.join(self.config.approvals_dir, f"{approval.approval_id}.json")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(approval.to_dict(), f, indent=2, ensure_ascii=False)

        return file_path

    def apply_approvals(self, results: Dict[str, ComparisonResult]) -> Dict[str, ComparisonResult]:
        for sample_id, result in results.items():
            approval = self.get_approval(result)
            if approval:
                result.approved = True
                result.approval_record = f"{approval.approver}@{approval.timestamp.isoformat()} - {approval.reason}"

        return results

    def list_approvals(self, sample_id: Optional[str] = None) -> List[Approval]:
        approvals = list(self.approvals.values())
        if sample_id:
            approvals = [a for a in approvals if a.sample_id == sample_id]
        return approvals
