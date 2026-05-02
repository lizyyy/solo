"""镜头瑕疵分拣台 - 状态存储模块"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List, Any

from .models import (
    SessionState,
    LensInspection,
    DefectDetection,
    ImageFeatures,
    LensNote,
    InspectionStatus,
    DefectType,
)


class StateStorageError(Exception):
    pass


class JSONStateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, SessionState):
            return obj.to_dict()
        if isinstance(obj, LensInspection):
            return obj.to_dict()
        if isinstance(obj, DefectDetection):
            return obj.to_dict()
        if isinstance(obj, ImageFeatures):
            return obj.to_dict()
        if isinstance(obj, LensNote):
            return obj.to_dict()
        if isinstance(obj, InspectionStatus):
            return obj.value
        if isinstance(obj, DefectType):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Path):
            return str(obj)
        return super().default(obj)


class StateStorage:
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.getcwd(), ".lens_inspector")
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _get_session_path(self, session_id: str) -> Path:
        return self.storage_dir / f"session_{session_id}.json"

    def _get_sessions_list_path(self) -> Path:
        return self.storage_dir / "sessions.json"

    def save_session(self, state: SessionState) -> Path:
        try:
            state.updated_at = datetime.now()
            session_path = self._get_session_path(state.session_id)

            with open(session_path, "w", encoding="utf-8") as f:
                json.dump(state.to_dict(), f, ensure_ascii=False, indent=2, cls=JSONStateEncoder)

            self._update_sessions_list(state)

            return session_path
        except Exception as e:
            raise StateStorageError(f"保存会话状态失败: {e}") from e

    def load_session(self, session_id: str) -> SessionState:
        try:
            session_path = self._get_session_path(session_id)
            if not session_path.exists():
                raise StateStorageError(f"会话不存在: {session_id}")

            with open(session_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            return SessionState.from_dict(data)
        except StateStorageError:
            raise
        except Exception as e:
            raise StateStorageError(f"加载会话状态失败: {e}") from e

    def delete_session(self, session_id: str) -> bool:
        try:
            session_path = self._get_session_path(session_id)
            if session_path.exists():
                session_path.unlink()
                return True
            return False
        except Exception as e:
            raise StateStorageError(f"删除会话失败: {e}") from e

    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions_list_path = self._get_sessions_list_path()
        if not sessions_list_path.exists():
            return []

        try:
            with open(sessions_list_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise StateStorageError(f"读取会话列表失败: {e}") from e

    def _update_sessions_list(self, state: SessionState):
        sessions_list_path = self._get_sessions_list_path()

        sessions = []
        if sessions_list_path.exists():
            try:
                with open(sessions_list_path, "r", encoding="utf-8") as f:
                    sessions = json.load(f)
            except:
                sessions = []

        session_info = {
            "session_id": state.session_id,
            "inspection_dir": state.inspection_dir,
            "notes_csv": state.notes_csv,
            "inspection_count": len(state.inspections),
            "created_at": state.created_at.isoformat(),
            "updated_at": state.updated_at.isoformat(),
        }

        existing_idx = None
        for i, s in enumerate(sessions):
            if s.get("session_id") == state.session_id:
                existing_idx = i
                break

        if existing_idx is not None:
            sessions[existing_idx] = session_info
        else:
            sessions.append(session_info)

        sessions.sort(key=lambda x: x["updated_at"], reverse=True)

        with open(sessions_list_path, "w", encoding="utf-8") as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2)

    def create_new_session(
        self,
        inspection_dir: str,
        notes_csv: str = "",
        session_id: Optional[str] = None,
    ) -> SessionState:
        if session_id is None:
            session_id = uuid.uuid4().hex[:12]

        state = SessionState(
            session_id=session_id,
            inspection_dir=inspection_dir,
            notes_csv=notes_csv,
        )

        return state

    def update_inspection(
        self,
        state: SessionState,
        lens_id: str,
        inspection: LensInspection,
    ) -> SessionState:
        if lens_id not in state.inspections:
            raise StateStorageError(f"镜头不存在: {lens_id}")

        inspection.updated_at = datetime.now()
        state.inspections[lens_id] = inspection
        state.updated_at = datetime.now()

        return state

    def confirm_inspection(
        self,
        state: SessionState,
        lens_id: str,
        human_notes: str = "",
        confirmed_defects: Optional[List[str]] = None,
    ) -> SessionState:
        if lens_id not in state.inspections:
            raise StateStorageError(f"镜头不存在: {lens_id}")

        inspection = state.inspections[lens_id]
        inspection.human_verified = True
        inspection.human_notes = human_notes
        inspection.status = InspectionStatus.HUMAN_CONFIRMED
        inspection.updated_at = datetime.now()

        state.updated_at = datetime.now()

        return state

    def flag_for_review(
        self,
        state: SessionState,
        lens_id: str,
        flag_notes: str = "",
    ) -> SessionState:
        if lens_id not in state.inspections:
            raise StateStorageError(f"镜头不存在: {lens_id}")

        inspection = state.inspections[lens_id]
        inspection.status = InspectionStatus.FLAGGED
        if flag_notes:
            if inspection.human_notes:
                inspection.human_notes += f"\n复检备注: {flag_notes}"
            else:
                inspection.human_notes = f"复检备注: {flag_notes}"
        inspection.updated_at = datetime.now()

        state.updated_at = datetime.now()

        return state

    def get_inspection_summary(
        self,
        state: SessionState,
    ) -> Dict[str, Any]:
        inspections = state.inspections.values()

        status_counts: Dict[str, int] = {}
        cluster_counts: Dict[str, int] = {}
        defect_type_counts: Dict[str, int] = {}

        total_anomaly_score = 0.0
        high_anomaly_count = 0

        for inspection in inspections:
            status = inspection.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

            cluster_label = inspection.cluster_label or "未聚类"
            cluster_counts[cluster_label] = cluster_counts.get(cluster_label, 0) + 1

            for defect in inspection.defects:
                defect_type = defect.defect_type.value
                defect_type_counts[defect_type] = defect_type_counts.get(defect_type, 0) + 1

            total_anomaly_score += inspection.anomaly_score
            if inspection.anomaly_score > 0.5:
                high_anomaly_count += 1

        inspection_count = len(state.inspections)
        avg_anomaly_score = (
            total_anomaly_score / inspection_count if inspection_count > 0 else 0.0
        )

        return {
            "session_id": state.session_id,
            "inspection_dir": state.inspection_dir,
            "notes_csv": state.notes_csv,
            "created_at": state.created_at.isoformat(),
            "updated_at": state.updated_at.isoformat(),
            "summary": {
                "total_inspections": inspection_count,
                "status_counts": status_counts,
                "cluster_counts": cluster_counts,
                "defect_type_counts": defect_type_counts,
                "avg_anomaly_score": avg_anomaly_score,
                "high_anomaly_count": high_anomaly_count,
            },
        }

    def export_audit_package(
        self,
        state: SessionState,
        output_path: str,
    ) -> Path:
        try:
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)

            audit_data = {
                "audit_version": "1.0",
                "generated_at": datetime.now().isoformat(),
                "session": state.to_dict(),
            }

            with open(output, "w", encoding="utf-8") as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2, cls=JSONStateEncoder)

            return output
        except Exception as e:
            raise StateStorageError(f"导出审计包失败: {e}") from e
