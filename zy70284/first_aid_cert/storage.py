import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .models import (
    Personnel,
    Certificate,
    RetrainingPlan,
    HistoryRecord,
    RecordAction,
)


class Storage:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            self.data_dir = Path(os.path.join(os.getcwd(), "first_aid_data"))
        else:
            self.data_dir = Path(data_dir)

        self.personnel_file = self.data_dir / "personnel.json"
        self.certificates_file = self.data_dir / "certificates.json"
        self.retraining_file = self.data_dir / "retraining.json"
        self.history_file = self.data_dir / "history.json"

        self._ensure_dir()

    def _ensure_dir(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _read_json(self, file_path: Path) -> List[Dict[str, Any]]:
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

    def _write_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def list_personnel(self) -> List[Personnel]:
        data = self._read_json(self.personnel_file)
        return [Personnel(**item) for item in data]

    def save_personnel(self, p: Personnel, record_history: bool = True) -> None:
        personnel_list = self._read_json(self.personnel_file)
        existing_idx = next(
            (i for i, item in enumerate(personnel_list) if item["id"] == p.id), None
        )

        if existing_idx is not None:
            old = personnel_list[existing_idx]
            personnel_list[existing_idx] = p.to_dict()
            if record_history:
                self._add_history(
                    "personnel",
                    p.id,
                    RecordAction.UPDATE,
                    before=old,
                    after=p.to_dict(),
                    description=f"更新人员: {p.name}",
                )
        else:
            personnel_list.append(p.to_dict())
            if record_history:
                self._add_history(
                    "personnel",
                    p.id,
                    RecordAction.CREATE,
                    after=p.to_dict(),
                    description=f"新增人员: {p.name}",
                )

        self._write_json(self.personnel_file, personnel_list)

    def get_personnel(self, p_id: str) -> Optional[Personnel]:
        for p in self.list_personnel():
            if p.id == p_id:
                return p
        return None

    def get_personnel_by_employee_id(self, employee_id: str) -> Optional[Personnel]:
        for p in self.list_personnel():
            if p.employee_id == employee_id:
                return p
        return None

    def delete_personnel(self, p_id: str) -> bool:
        personnel_list = self._read_json(self.personnel_file)
        for i, item in enumerate(personnel_list):
            if item["id"] == p_id:
                deleted = personnel_list.pop(i)
                self._add_history(
                    "personnel",
                    p_id,
                    RecordAction.DELETE,
                    before=deleted,
                    description=f"删除人员: {deleted['name']}",
                )
                self._write_json(self.personnel_file, personnel_list)
                return True
        return False

    def list_certificates(self) -> List[Certificate]:
        data = self._read_json(self.certificates_file)
        return [Certificate(**item) for item in data]

    def save_certificate(self, c: Certificate, record_history: bool = True) -> None:
        cert_list = self._read_json(self.certificates_file)
        existing_idx = next(
            (i for i, item in enumerate(cert_list) if item["id"] == c.id), None
        )

        if existing_idx is not None:
            old = cert_list[existing_idx]
            cert_list[existing_idx] = c.to_dict()
            if record_history:
                self._add_history(
                    "certificate",
                    c.id,
                    RecordAction.UPDATE,
                    before=old,
                    after=c.to_dict(),
                    description=f"更新证书: {c.personnel_name} - {c.certificate_type}",
                )
        else:
            cert_list.append(c.to_dict())
            if record_history:
                self._add_history(
                    "certificate",
                    c.id,
                    RecordAction.CREATE,
                    after=c.to_dict(),
                    description=f"新增证书: {c.personnel_name} - {c.certificate_type}",
                )

        self._write_json(self.certificates_file, cert_list)

    def get_certificate(self, c_id: str) -> Optional[Certificate]:
        for c in self.list_certificates():
            if c.id == c_id:
                return c
        return None

    def get_certificates_by_personnel(self, p_id: str) -> List[Certificate]:
        return [c for c in self.list_certificates() if c.personnel_id == p_id]

    def delete_certificate(self, c_id: str) -> bool:
        cert_list = self._read_json(self.certificates_file)
        for i, item in enumerate(cert_list):
            if item["id"] == c_id:
                deleted = cert_list.pop(i)
                self._add_history(
                    "certificate",
                    c_id,
                    RecordAction.DELETE,
                    before=deleted,
                    description=f"删除证书: {deleted['personnel_name']} - {deleted['certificate_type']}",
                )
                self._write_json(self.certificates_file, cert_list)
                return True
        return False

    def list_retraining(self) -> List[RetrainingPlan]:
        data = self._read_json(self.retraining_file)
        return [RetrainingPlan(**item) for item in data]

    def save_retraining(self, r: RetrainingPlan, record_history: bool = True) -> None:
        retraining_list = self._read_json(self.retraining_file)
        existing_idx = next(
            (i for i, item in enumerate(retraining_list) if item["id"] == r.id), None
        )

        if existing_idx is not None:
            old = retraining_list[existing_idx]
            retraining_list[existing_idx] = r.to_dict()
            if record_history:
                self._add_history(
                    "retraining",
                    r.id,
                    RecordAction.UPDATE,
                    before=old,
                    after=r.to_dict(),
                    description=f"更新复训计划: {r.personnel_name}",
                )
        else:
            retraining_list.append(r.to_dict())
            if record_history:
                self._add_history(
                    "retraining",
                    r.id,
                    RecordAction.CREATE,
                    after=r.to_dict(),
                    description=f"新增复训计划: {r.personnel_name}",
                )

        self._write_json(self.retraining_file, retraining_list)

    def get_retraining(self, r_id: str) -> Optional[RetrainingPlan]:
        for r in self.list_retraining():
            if r.id == r_id:
                return r
        return None

    def get_retraining_by_certificate(self, c_id: str) -> List[RetrainingPlan]:
        return [r for r in self.list_retraining() if r.certificate_id == c_id]

    def delete_retraining(self, r_id: str) -> bool:
        retraining_list = self._read_json(self.retraining_file)
        for i, item in enumerate(retraining_list):
            if item["id"] == r_id:
                deleted = retraining_list.pop(i)
                self._add_history(
                    "retraining",
                    r_id,
                    RecordAction.DELETE,
                    before=deleted,
                    description=f"删除复训计划: {deleted['personnel_name']}",
                )
                self._write_json(self.retraining_file, retraining_list)
                return True
        return False

    def list_history(
        self,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
    ) -> List[HistoryRecord]:
        data = self._read_json(self.history_file)
        records = [HistoryRecord(**item) for item in data]

        if entity_type:
            records = [r for r in records if r.entity_type == entity_type]
        if action:
            records = [r for r in records if r.action == action]

        return sorted(records, key=lambda r: r.timestamp, reverse=True)

    def _add_history(
        self,
        entity_type: str,
        entity_id: str,
        action: RecordAction,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
        description: str = "",
    ) -> None:
        history_list = self._read_json(self.history_file)
        record = HistoryRecord.create(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action.value,
            before=before,
            after=after,
            description=description,
        )
        history_list.append(record.to_dict())
        self._write_json(self.history_file, history_list)

    def import_personnel(self, items: List[Dict[str, Any]]) -> Tuple[int, int]:
        success = 0
        failed = 0
        for item in items:
            try:
                p = Personnel.create(
                    name=item["name"],
                    employee_id=item["employee_id"],
                    department=item.get("department", ""),
                    phone=item.get("phone", ""),
                    email=item.get("email", ""),
                )
                self.save_personnel(p, record_history=False)
                success += 1
            except Exception:
                failed += 1

        if success > 0:
            self._add_history(
                "personnel",
                "import",
                RecordAction.IMPORT,
                description=f"批量导入人员: 成功 {success} 条，失败 {failed} 条",
            )

        return success, failed

    def import_certificates(self, items: List[Dict[str, Any]]) -> Tuple[int, int]:
        success = 0
        failed = 0
        for item in items:
            try:
                c = Certificate.create(
                    personnel_id=item["personnel_id"],
                    personnel_name=item["personnel_name"],
                    certificate_type=item["certificate_type"],
                    certificate_number=item["certificate_number"],
                    issue_date=item["issue_date"],
                    expiry_date=item["expiry_date"],
                    issuer=item.get("issuer", "急救培训中心"),
                )
                self.save_certificate(c, record_history=False)
                success += 1
            except Exception:
                failed += 1

        if success > 0:
            self._add_history(
                "certificate",
                "import",
                RecordAction.IMPORT,
                description=f"批量导入证书: 成功 {success} 条，失败 {failed} 条",
            )

        return success, failed

    def import_retraining(self, items: List[Dict[str, Any]]) -> Tuple[int, int]:
        success = 0
        failed = 0
        for item in items:
            try:
                r = RetrainingPlan.create(
                    certificate_id=item["certificate_id"],
                    personnel_id=item["personnel_id"],
                    personnel_name=item["personnel_name"],
                    planned_date=item["planned_date"],
                    trainer=item.get("trainer"),
                    notes=item.get("notes", ""),
                )
                self.save_retraining(r, record_history=False)
                success += 1
            except Exception:
                failed += 1

        if success > 0:
            self._add_history(
                "retraining",
                "import",
                RecordAction.IMPORT,
                description=f"批量导入复训计划: 成功 {success} 条，失败 {failed} 条",
            )

        return success, failed

    def get_all_data(self) -> Dict[str, Any]:
        return {
            "personnel": [p.to_dict() for p in self.list_personnel()],
            "certificates": [c.to_dict() for c in self.list_certificates()],
            "retraining": [r.to_dict() for r in self.list_retraining()],
            "exported_at": datetime.now().isoformat(),
        }

    def is_initialized(self) -> bool:
        return (
            self.personnel_file.exists()
            or self.certificates_file.exists()
            or self.retraining_file.exists()
        )
