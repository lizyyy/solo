import os
from typing import List, Dict, Tuple
from datetime import datetime

from .material import MaterialItem, load_materials_from_dir, MATERIAL_TYPES
from .state import (
    ReviewState, MaterialState,
    STATUS_PENDING, STATUS_REVIEWING, STATUS_SUSPENDED,
    STATUS_CONFIRMED, STATUS_COMPLETED,
)


class ReviewEngine:
    def __init__(self, materials_root: str, state, output_dir: str):
        self.materials_root = materials_root
        self.state = state
        self.output_dir = output_dir
        self.changed_materials: List[str] = []
        self.suspension_reasons: List[str] = []
        self.newly_added: List[str] = []

    def run_batch(self, batch_no: int) -> Dict:
        batch_dir = os.path.join(self.materials_root, f"batch_{batch_no:03d}")
        items = load_materials_from_dir(batch_dir)

        if not items:
            return {
                "batch_no": batch_no,
                "loaded": 0,
                "changed": 0,
                "suspended": False,
                "reasons": [],
            }

        self.state.run_count += 1
        self.state.current_batch = max(self.state.current_batch, batch_no)

        grouped = self._group_by_key(items)
        for key, item_list in grouped.items():
            latest = max(item_list, key=lambda x: (x.version, x.batch_no))
            self._process_material(key, latest)

        self._check_batch_continuity(batch_no, items)
        self._check_all_related_refs()
        self._update_overall_status()

        return {
            "batch_no": batch_no,
            "loaded": len(items),
            "changed": len(self.changed_materials),
            "newly_added": len(self.newly_added),
            "suspended": self.state.overall_status == STATUS_SUSPENDED,
            "suspension_reasons": self.suspension_reasons,
            "changed_list": self.changed_materials,
        }

    def _group_by_key(self, items: List[MaterialItem]) -> Dict[str, List[MaterialItem]]:
        grouped: Dict[str, List[MaterialItem]] = {}
        for item in items:
            key = item.key()
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(item)
        return grouped

    def _process_material(self, key: str, item: MaterialItem) -> None:
        if key not in self.state.materials:
            ms = MaterialState(
                material_id=item.material_id,
                material_type=item.material_type,
                current_version=item.version,
                latest_batch=item.batch_no,
                status=STATUS_PENDING,
                signature=item.signature(),
                title=item.title,
                related_to=item.related_to,
                history=[{
                    "version": item.version,
                    "batch_no": item.batch_no,
                    "signature": item.signature(),
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "action": "新增",
                    "title": item.title,
                    "related_to": item.related_to,
                }],
            )
            self.state.materials[key] = ms
            self.newly_added.append(key)
            return

        ms = self.state.materials[key]
        old_sig = ms.signature
        new_sig = item.signature()

        version_jumped = item.version > ms.current_version
        content_changed = old_sig != new_sig

        if version_jumped or content_changed:
            action = "版本升级" if version_jumped else "口径变更"
            if version_jumped and content_changed:
                action = "版本升级+口径变更"

            ms.history.append({
                "version": item.version,
                "batch_no": item.batch_no,
                "old_signature": old_sig,
                "new_signature": new_sig,
                "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "action": action,
                "title": item.title,
                "related_to": item.related_to,
            })
            ms.current_version = item.version
            ms.latest_batch = item.batch_no
            ms.signature = new_sig
            ms.title = item.title
            ms.related_to = item.related_to

            if ms.status == STATUS_CONFIRMED or ms.status == STATUS_COMPLETED:
                ms.status = STATUS_REVIEWING
                self.changed_materials.append(key)
            else:
                self.changed_materials.append(key)
        else:
            ms.latest_batch = max(ms.latest_batch, item.batch_no)

    def _check_batch_continuity(self, batch_no: int, items: List[MaterialItem]) -> None:
        all_batches = set()
        for ms in self.state.materials.values():
            for h in ms.history:
                all_batches.add(h.get("batch_no", 0))
            all_batches.add(ms.latest_batch)

        if not all_batches:
            return

        min_batch = min(all_batches)
        max_batch = max(all_batches)

        missing = []
        for b in range(min_batch, max_batch + 1):
            if b not in all_batches:
                missing.append(b)

        if missing:
            reason = f"批次不连续，缺少批次: {', '.join(f'第{b}批' for b in missing)}"
            if reason not in self.suspension_reasons:
                self.suspension_reasons.append(reason)

        visa_items = [i for i in items if i.material_type == "visa"]
        drawing_items = [i for i in items if i.material_type == "drawing"]

        if visa_items and not drawing_items:
            if self.state.current_batch > 1:
                reason = "本批只有现场签证单，没有对应变更图纸，需确认是否后补"
                if reason not in self.suspension_reasons:
                    self.suspension_reasons.append(reason)

    def _check_all_related_refs(self) -> None:
        all_ids = {ms.material_id for ms in self.state.materials.values()}

        all_withdrawals = [
            ms for ms in self.state.materials.values()
            if ms.material_type == "withdrawal"
        ]

        for ms in self.state.materials.values():
            if "关联缺失" in ms.remarks:
                ms.remarks = ""

        for w_ms in all_withdrawals:
            related_id = w_ms.related_to
            if not related_id:
                continue
            for key, ms in self.state.materials.items():
                if ms.material_id == related_id and ms.material_type != "withdrawal":
                    if not ms.remarks:
                        ms.remarks = f"被撤回记录({w_ms.material_id})关联，需复核"
                    break

        for ms in self.state.materials.values():
            related_id = ms.related_to
            if not related_id:
                continue
            if related_id not in all_ids:
                type_label = MATERIAL_TYPES.get(ms.material_type, ms.material_type)
                reason = f"{type_label} {ms.material_id} 关联的材料 {related_id} 未找到，需确认"
                if reason not in self.suspension_reasons:
                    self.suspension_reasons.append(reason)
                if ms.remarks:
                    if "关联缺失" not in ms.remarks:
                        ms.remarks = f"{ms.remarks}；关联缺失 {related_id}，需确认"
                else:
                    ms.remarks = f"关联缺失 {related_id}，需确认"

    def _update_overall_status(self) -> None:
        if self.suspension_reasons:
            self.state.overall_status = STATUS_SUSPENDED
            self.state.suspension_reasons = self.suspension_reasons
        else:
            if self.state.suspension_reasons:
                self.state.suspension_reasons = []
            all_confirmed = True
            any_pending = False
            for ms in self.state.materials.values():
                if ms.status in (STATUS_PENDING, STATUS_REVIEWING):
                    all_confirmed = False
                    any_pending = True
                    break
            if all_confirmed and self.state.materials:
                self.state.overall_status = STATUS_COMPLETED
            elif any_pending:
                self.state.overall_status = STATUS_REVIEWING
            else:
                self.state.overall_status = STATUS_PENDING

    def confirm_suspension(self) -> None:
        self.state.overall_status = STATUS_REVIEWING
        self.state.suspension_reasons = []
        self.suspension_reasons = []

    def confirm_material(self, key: str) -> bool:
        if key in self.state.materials:
            self.state.materials[key].status = STATUS_CONFIRMED
            self._update_overall_status()
            return True
        return False

    def get_summary(self) -> Dict:
        status_counts: Dict[str, int] = {}
        for ms in self.state.materials.values():
            s = ms.status
            status_counts[s] = status_counts.get(s, 0) + 1

        changed_count = len([
            ms for ms in self.state.materials.values()
            if len(ms.history) > 1
        ])

        return {
            "project_name": self.state.project_name,
            "overall_status": self.state.overall_status,
            "current_batch": self.state.current_batch,
            "total_materials": len(self.state.materials),
            "status_counts": status_counts,
            "changed_materials": changed_count,
            "suspension_reasons": self.state.suspension_reasons,
            "last_run_time": self.state.last_run_time,
            "run_count": self.state.run_count,
        }
