from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import uuid

from .models import (
    OfflineDevice, FormDraft, SyncBatch, FieldConflict, 
    MergeDecision, RollbackVersion
)
from .schemas import (
    FormDraftCreate, SyncRequest, ConflictResolution, MergeDecisionCreate
)


class SyncService:
    def __init__(self, db: Session):
        self.db = db

    def generate_batch_number(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"BATCH-{timestamp}-{str(uuid.uuid4())[:8]}"

    def detect_conflicts(self, client_draft: FormDraftCreate, server_draft: Optional[FormDraft]) -> List[Dict]:
        conflicts = []
        
        if not server_draft:
            return conflicts

        server_data = server_draft.form_data
        client_data = client_draft.form_data
        
        if client_draft.version < server_draft.version or client_draft.version == server_draft.version:
            for key in set(server_data.keys()) | set(client_data.keys()):
                server_val = server_data.get(key)
                client_val = client_data.get(key)
                
                if server_val != client_val:
                    conflicts.append({
                        "field_name": key,
                        "server_value": server_val,
                        "client_value": client_val,
                        "base_version": client_draft.version,
                        "server_version": server_draft.version,
                        "client_version": client_draft.version,
                        "conflict_description": f"字段 '{key}' 值冲突: 服务端='{server_val}', 客户端='{client_val}'"
                    })
        
        return conflicts

    def apply_merge_strategy(self, conflict: FieldConflict, strategy: str, custom_value: Any = None) -> Any:
        if strategy == "server_wins":
            return conflict.server_value
        elif strategy == "client_wins":
            return conflict.client_value
        elif strategy == "latest_wins":
            return conflict.server_value if conflict.server_version > conflict.client_version else conflict.client_value
        elif strategy == "custom" and custom_value is not None:
            return custom_value
        return conflict.server_value

    def create_rollback_snapshot(self, draft: FormDraft, reason: str, user: str) -> RollbackVersion:
        rollback = RollbackVersion(
            draft_id=draft.id,
            version_number=draft.version,
            form_data_snapshot=json.loads(json.dumps(draft.form_data)),
            rollback_reason=reason,
            rolled_back_by=user
        )
        self.db.add(rollback)
        return rollback

    def find_existing_draft(self, draft_data: FormDraftCreate) -> Optional[FormDraft]:
        if draft_data.id:
            existing = self.db.query(FormDraft).filter(FormDraft.id == draft_data.id).first()
            if existing:
                return existing
        
        existing = self.db.query(FormDraft).filter(
            FormDraft.form_type == draft_data.form_type,
            FormDraft.device_id == draft_data.device_id,
            FormDraft.created_by == draft_data.created_by
        ).order_by(FormDraft.created_at.desc()).first()
        
        return existing

    def process_sync(self, sync_request: SyncRequest) -> Dict[str, Any]:
        device = self.db.query(OfflineDevice).filter(OfflineDevice.id == sync_request.device_id).first()
        if not device:
            raise ValueError(f"设备 {sync_request.device_id} 不存在")

        batch_number = self.generate_batch_number()
        batch = SyncBatch(
            device_id=sync_request.device_id,
            batch_number=batch_number,
            status="processing",
            total_items=len(sync_request.drafts),
            started_at=datetime.now()
        )
        self.db.add(batch)
        self.db.flush()

        success_count = 0
        conflict_count = 0
        processed_drafts = []

        for draft_data in sync_request.drafts:
            existing_draft = self.find_existing_draft(draft_data)

            is_duplicate = False
            if existing_draft and existing_draft.sync_batch_id:
                existing_batch = self.db.query(SyncBatch).filter(SyncBatch.id == existing_draft.sync_batch_id).first()
                if existing_batch and existing_batch.id != batch.id:
                    is_duplicate = True
                    processed_drafts.append({
                        "id": existing_draft.id,
                        "status": "duplicate",
                        "message": "该草稿已在之前的批次中同步过（幂等处理）"
                    })
            
            if is_duplicate:
                continue

            conflicts = self.detect_conflicts(draft_data, existing_draft)

            if conflicts:
                if not existing_draft:
                    existing_draft = FormDraft(
                        form_type=draft_data.form_type,
                        form_data=draft_data.form_data,
                        version=draft_data.version,
                        device_id=draft_data.device_id,
                        status="conflict",
                        created_by=draft_data.created_by,
                        sync_batch_id=batch.id
                    )
                    self.db.add(existing_draft)
                    self.db.flush()

                for conflict_data in conflicts:
                    conflict = FieldConflict(
                        draft_id=existing_draft.id,
                        batch_id=batch.id,
                        **conflict_data
                    )
                    self.db.add(conflict)
                
                existing_draft.status = "conflict"
                conflict_count += 1
                processed_drafts.append({
                    "id": existing_draft.id,
                    "status": "conflict",
                    "conflict_count": len(conflicts)
                })
            else:
                if existing_draft:
                    self.create_rollback_snapshot(existing_draft, "同步更新前快照", "system")
                    existing_draft.form_data = draft_data.form_data
                    existing_draft.version = draft_data.version
                    existing_draft.status = "synced"
                    existing_draft.sync_batch_id = batch.id
                else:
                    new_draft = FormDraft(
                        form_type=draft_data.form_type,
                        form_data=draft_data.form_data,
                        version=draft_data.version,
                        device_id=draft_data.device_id,
                        status="synced",
                        created_by=draft_data.created_by,
                        sync_batch_id=batch.id
                    )
                    self.db.add(new_draft)
                success_count += 1
                processed_drafts.append({
                    "id": existing_draft.id if existing_draft else "new",
                    "status": "synced"
                })

        batch.success_count = success_count
        batch.conflict_count = conflict_count
        batch.status = "completed" if conflict_count == 0 else "has_conflicts"
        batch.completed_at = datetime.now()
        device.last_sync_time = datetime.now()

        self.db.commit()

        return {
            "batch_id": batch.id,
            "batch_number": batch_number,
            "status": batch.status,
            "total_items": batch.total_items,
            "success_count": success_count,
            "conflict_count": conflict_count,
            "processed_drafts": processed_drafts
        }

    def resolve_conflict(self, resolution: ConflictResolution) -> Dict[str, Any]:
        conflict = self.db.query(FieldConflict).filter(FieldConflict.id == resolution.conflict_id).first()
        if not conflict:
            raise ValueError(f"冲突记录 {resolution.conflict_id} 不存在")

        final_value = self.apply_merge_strategy(conflict, resolution.resolution, resolution.resolved_value)
        
        conflict.resolved = True
        conflict.resolved_value = final_value
        conflict.resolution_strategy = resolution.resolution
        conflict.resolved_by = resolution.resolved_by
        conflict.resolved_at = datetime.now()

        merge_decision = MergeDecision(
            conflict_id=conflict.id,
            decision_type=resolution.resolution,
            final_value=final_value,
            decided_by=resolution.resolved_by,
            reason=f"使用策略 '{resolution.resolution}' 解决冲突"
        )
        self.db.add(merge_decision)

        draft = conflict.draft
        if draft:
            draft.form_data[conflict.field_name] = final_value
            
            all_conflicts_resolved = all(c.resolved for c in draft.conflicts)
            if all_conflicts_resolved:
                draft.status = "synced"
                draft.version += 1

        batch = conflict.batch
        if batch:
            unresolved_count = self.db.query(FieldConflict).filter(
                FieldConflict.batch_id == batch.id,
                FieldConflict.resolved == False
            ).count()
            if unresolved_count == 0:
                batch.status = "completed"
                batch.completed_at = datetime.now()

        self.db.commit()

        return {
            "conflict_id": conflict.id,
            "resolved": True,
            "final_value": final_value,
            "strategy_used": resolution.resolution
        }

    def rollback_draft(self, draft_id: str, rollback_id: str, user: str) -> Dict[str, Any]:
        rollback = self.db.query(RollbackVersion).filter(RollbackVersion.id == rollback_id).first()
        if not rollback:
            raise ValueError(f"回滚版本 {rollback_id} 不存在")

        draft = self.db.query(FormDraft).filter(FormDraft.id == draft_id).first()
        if not draft:
            raise ValueError(f"草稿 {draft_id} 不存在")

        self.create_rollback_snapshot(draft, "回滚前的当前状态快照", user)

        draft.form_data = rollback.form_data_snapshot
        draft.version = rollback.version_number
        draft.status = "rolled_back"

        self.db.commit()

        return {
            "draft_id": draft_id,
            "rolled_back_to_version": rollback.version_number,
            "status": draft.status
        }

    def export_batch_data(self, batch_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self.db.query(SyncBatch)
        if batch_id:
            query = query.filter(SyncBatch.id == batch_id)
        if status:
            query = query.filter(SyncBatch.status == status)

        batches = query.all()
        export_data = []

        for batch in batches:
            batch_data = {
                "batch_number": batch.batch_number,
                "status": batch.status,
                "device_name": batch.device.device_name if batch.device else None,
                "total_items": batch.total_items,
                "success_count": batch.success_count,
                "conflict_count": batch.conflict_count,
                "created_at": batch.created_at.isoformat() if batch.created_at else None,
                "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
                "drafts": [],
                "status_explanation": self._get_status_explanation(batch)
            }

            for draft in batch.drafts:
                draft_info = {
                    "draft_id": draft.id,
                    "form_type": draft.form_type,
                    "version": draft.version,
                    "status": draft.status,
                    "status_reason": self._get_draft_status_reason(draft, batch),
                    "conflicts": []
                }

                for conflict in draft.conflicts:
                    conflict_info = {
                        "field_name": conflict.field_name,
                        "server_value": conflict.server_value,
                        "client_value": conflict.client_value,
                        "resolved": conflict.resolved,
                        "resolution_strategy": conflict.resolution_strategy,
                        "resolved_value": conflict.resolved_value
                    }
                    draft_info["conflicts"].append(conflict_info)

                batch_data["drafts"].append(draft_info)

            export_data.append(batch_data)

        return export_data

    def _get_status_explanation(self, batch: SyncBatch) -> str:
        if batch.status == "pending":
            return "批次已创建，等待开始同步"
        elif batch.status == "processing":
            return "正在处理同步中..."
        elif batch.status == "completed":
            return f"同步成功完成，{batch.success_count} 个项目成功，无冲突"
        elif batch.status == "has_conflicts":
            return f"同步完成但存在冲突：{batch.success_count} 个成功，{batch.conflict_count} 个需要手动解决"
        elif batch.status == "failed":
            return f"同步失败: {batch.error_message}"
        return "未知状态"

    def _get_draft_status_reason(self, draft: FormDraft, batch: SyncBatch) -> str:
        if draft.status == "draft":
            return "草稿已创建，尚未同步"
        elif draft.status == "synced":
            return "同步成功，无冲突"
        elif draft.status == "conflict":
            return f"存在 {len([c for c in draft.conflicts if not c.resolved])} 个未解决的字段冲突"
        elif draft.status == "rolled_back":
            return "已回滚到历史版本"
        return "未知状态"
