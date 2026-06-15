from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Tuple
import logging

from models import WorkOrder, WorkOrderStatus, DesensitizationRemark, HistoryRecord, OperationType
from utils import load_json, load_csv, generate_id, generate_batch_id, save_json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ImportType(str, Enum):
    NORMAL = "normal"
    WRONG_CALIBER = "wrong_caliber"
    SUPPLEMENTARY = "supplementary"


class DataImporter:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.work_orders: Dict[str, WorkOrder] = {}
        self.remarks: Dict[str, DesensitizationRemark] = {}
        self.history: List[HistoryRecord] = []
        self._imported_ids: set = set()

    def _load_work_order_from_row(self, row: Dict, import_type: ImportType, batch_id: str) -> WorkOrder:
        work_order_id = row.get("id") or generate_id("WO")
        existing = self.work_orders.get(work_order_id)

        status_value = row.get("status")
        if status_value:
            try:
                parsed_status = WorkOrderStatus(status_value)
            except ValueError:
                parsed_status = WorkOrderStatus.PENDING
        else:
            parsed_status = WorkOrderStatus.PENDING

        reviewer = row.get("reviewer")
        review_time = None
        if row.get("review_time"):
            try:
                review_time = datetime.fromisoformat(row["review_time"])
            except (ValueError, TypeError):
                review_time = None

        work_order = WorkOrder(
            id=work_order_id,
            title=row.get("title", ""),
            content=row.get("content", ""),
            category=row.get("category", ""),
            source=row.get("source", ""),
            feedback_time=datetime.fromisoformat(row["feedback_time"]) if row.get("feedback_time") else datetime.now(),
            import_time=datetime.now(),
            status=parsed_status,
            reference_links=row.get("reference_links", "").split("|") if row.get("reference_links") else [],
            original_raw_data=dict(row),
            import_batch=batch_id,
            is_supplementary=(import_type == ImportType.SUPPLEMENTARY),
            reviewer=reviewer,
            review_time=review_time,
            review_notes=row.get("review_notes", ""),
        )

        if existing and import_type == ImportType.SUPPLEMENTARY:
            work_order.import_time = existing.import_time
            if not status_value:
                work_order.status = existing.status
            if existing.reviewer and not reviewer:
                work_order.reviewer = existing.reviewer
            if existing.review_time and not review_time:
                work_order.review_time = existing.review_time

        return work_order

    def _load_remark_from_row(self, row: Dict) -> DesensitizationRemark:
        return DesensitizationRemark(
            id=row.get("id") or generate_id("DR"),
            work_order_id=row.get("work_order_id", ""),
            remark_content=row.get("remark_content", ""),
            owner=row.get("owner", "周姐"),
            create_time=datetime.fromisoformat(row["create_time"]) if row.get("create_time") else datetime.now(),
            tags=row.get("tags", "").split("|") if row.get("tags") else [],
            is_important=row.get("is_important", "").lower() in ("true", "1", "yes"),
            related_rules=row.get("related_rules", "").split("|") if row.get("related_rules") else [],
        )

    def import_work_orders(
        self,
        file_path: str,
        import_type: ImportType = ImportType.NORMAL,
        operator: str = "system",
    ) -> Tuple[List[WorkOrder], List[str]]:
        batch_id = generate_batch_id()
        logger.info(f"Importing work orders: {file_path}, type={import_type.value}, batch={batch_id}")

        rows = self._load_file(file_path)
        imported = []
        warnings = []

        for row in rows:
            work_order = self._load_work_order_from_row(row, import_type, batch_id)

            if work_order.id in self._imported_ids and import_type != ImportType.SUPPLEMENTARY:
                warnings.append(f"重复导入检测: 工单 {work_order.id} 已存在，跳过")
                continue

            self._imported_ids.add(work_order.id)
            old_state = self.work_orders.get(work_order.id)
            self.work_orders[work_order.id] = work_order

            self.history.append(HistoryRecord(
                id=generate_id("HIS"),
                operation_type=OperationType.SUPPLEMENTARY_IMPORT if import_type == ImportType.SUPPLEMENTARY else OperationType.IMPORT,
                operator=operator,
                operate_time=datetime.now(),
                target_id=work_order.id,
                target_type="work_order",
                before_state=old_state.to_dict() if old_state else None,
                after_state=work_order.to_dict(),
                notes=f"批次 {batch_id}, 导入类型: {import_type.value}",
            ))

            imported.append(work_order)

        logger.info(f"Imported {len(imported)} work orders, {len(warnings)} warnings")
        return imported, warnings

    def import_remarks(self, file_path: str, operator: str = "周姐") -> List[DesensitizationRemark]:
        logger.info(f"Importing desensitization remarks: {file_path}")

        rows = self._load_file(file_path)
        imported = []

        for row in rows:
            remark = self._load_remark_from_row(row)
            self.remarks[remark.id] = remark
            imported.append(remark)

            self.history.append(HistoryRecord(
                id=generate_id("HIS"),
                operation_type=OperationType.REVIEW_REMARK,
                operator=operator,
                operate_time=datetime.now(),
                target_id=remark.id,
                target_type="desensitization_remark",
                after_state=remark.to_dict(),
                notes=f"脱敏规则备注导入/更新",
            ))

        logger.info(f"Imported {len(imported)} remarks")
        return imported

    def _load_file(self, file_path: str) -> List[Dict]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if path.suffix == ".json":
            data = load_json(str(path))
            return data if isinstance(data, list) else [data]
        elif path.suffix == ".csv":
            return load_csv(str(path))
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    def get_remarks_by_work_order(self, work_order_id: str) -> List[DesensitizationRemark]:
        return [r for r in self.remarks.values() if r.work_order_id == work_order_id]

    def save_state(self, output_dir: str = "output"):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        save_json(
            [wo.to_dict() for wo in self.work_orders.values()],
            str(output_path / "work_orders.json"),
        )
        save_json(
            [r.to_dict() for r in self.remarks.values()],
            str(output_path / "desensitization_remarks.json"),
        )
        save_json(
            [h.to_dict() for h in self.history],
            str(output_path / "history_records.json"),
        )
