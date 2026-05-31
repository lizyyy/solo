from datetime import datetime
from typing import Optional
from uuid import uuid4

from ..storage import Database
from ..models import (
    ManualConfirmation,
    EvidenceChain,
    EvidenceNode,
    RecordStatus,
    ProcessingResult,
)
from ..utils import ManualCorrectionNeededError


class ManualConfirmationService:
    def __init__(self, db: Database):
        self.db = db

    def create_confirmation(
        self,
        related_record_id: str,
        record_type: str,
        operator_id: str,
        operator_name: str,
        action: str,
        reason: str,
        before_state: Optional[dict] = None,
        after_state: Optional[dict] = None,
        comments: Optional[str] = None,
    ) -> ManualConfirmation:
        conf = ManualConfirmation(
            related_record_id=related_record_id,
            record_type=record_type,
            operator_id=operator_id,
            operator_name=operator_name,
            action=action,
            reason=reason,
            before_state=before_state,
            after_state=after_state,
            comments=comments,
        )
        self.db.save_manual_confirmation(conf)
        self._build_confirmation_chain(conf)
        return conf

    def apply_manual_correction(
        self,
        record_id: str,
        operator_id: str,
        operator_name: str,
        correction_details: dict,
        reason: str,
    ) -> ProcessingResult:
        result = ProcessingResult(
            success=False,
            message="处理中",
            details={"record_id": record_id, "operator": operator_name},
        )

        before_state = correction_details.get("before_state", {})
        after_state = correction_details.get("after_state", {})

        conf = self.create_confirmation(
            related_record_id=record_id,
            record_type=correction_details.get("record_type", "permission_change"),
            operator_id=operator_id,
            operator_name=operator_name,
            action="MANUAL_CORRECTION",
            reason=reason,
            before_state=before_state,
            after_state=after_state,
            comments=correction_details.get("comments"),
        )

        result.success = True
        result.message = f"人工更正已生效，由 {operator_name} 处理"
        result.details.update({
            "confirmation_id": conf.confirmation_id,
            "action": conf.action,
            "reason": reason,
        })
        result.add_evidence(
            "manual_confirmation",
            conf.confirmation_id,
            "人工更正记录",
        )
        return result

    def flag_for_manual_review(
        self,
        record_id: str,
        reason: str,
        suggested_action: str,
    ) -> ProcessingResult:
        result = ProcessingResult(
            success=False,
            message="标记需要人工审核",
            details={"record_id": record_id},
        )

        error = ManualCorrectionNeededError(record_id, reason, suggested_action)
        result.details["error_code"] = error.error_code
        result.details["suggested_action"] = suggested_action
        result.message = error.message
        result.add_evidence(
            "manual_review_needed",
            record_id,
            f"需要人工审核：{reason}",
        )
        return result

    def _build_confirmation_chain(self, conf: ManualConfirmation):
        chain = EvidenceChain(root_record_id=conf.related_record_id)

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="MANUAL_ACTION",
            timestamp=conf.timestamp,
            description=f"人工操作：{conf.action}",
            data_reference=f"manual_confirmation:{conf.confirmation_id}",
            metadata={
                "operator_id": conf.operator_id,
                "operator_name": conf.operator_name,
                "action": conf.action,
                "reason": conf.reason,
            },
        ))

        if conf.before_state:
            chain.add_node(EvidenceNode(
                node_id=str(uuid4()),
                node_type="STATE_BEFORE",
                timestamp=conf.timestamp,
                description="更正前状态",
                data_reference=f"state:before:{conf.confirmation_id}",
                metadata=conf.before_state,
            ))

        if conf.after_state:
            chain.add_node(EvidenceNode(
                node_id=str(uuid4()),
                node_type="STATE_AFTER",
                timestamp=conf.timestamp,
                description="更正后状态",
                data_reference=f"state:after:{conf.confirmation_id}",
                metadata=conf.after_state,
            ))

        self.db.save_evidence_chain(chain)

    def get_confirmations_for_record(self, record_id: str) -> list:
        with self.db._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM manual_confirmations WHERE related_record_id = ? ORDER BY timestamp DESC",
                (record_id,),
            ).fetchall()
            return [
                {
                    "confirmation_id": row["confirmation_id"],
                    "action": row["action"],
                    "operator_name": row["operator_name"],
                    "reason": row["reason"],
                    "timestamp": row["timestamp"],
                    "comments": row["comments"],
                }
                for row in rows
            ]
