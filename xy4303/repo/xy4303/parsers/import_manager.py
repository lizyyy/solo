from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from uuid import uuid4

from models.order import Order
from models.patient import Patient
from models.photo import Photo
from models.stl_file import STLFile
from models.processing_status import ProcessingStatus
from models.workbench import Workbench, WorkbenchItem
from parsers.csv_parser import OrderCSVParser, StatusCSVParser, ParseResult
from parsers.photo_scanner import PhotoScanner, ScanResult
from parsers.stl_scanner import STLScanner, STLScanResult


@dataclass
class ImportResult:
    success: bool = True
    workbench: Optional[Workbench] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=dict)


class ImportManager:
    def __init__(self):
        self.order_parser = OrderCSVParser()
        self.status_parser = StatusCSVParser()
        self.photo_scanner = PhotoScanner()
        self.stl_scanner = STLScanner()

    def import_from_files(
        self,
        order_csv: Optional[Union[str, Path]] = None,
        status_csv: Optional[Union[str, Path]] = None,
        photo_dir: Optional[Union[str, Path]] = None,
        stl_dir: Optional[Union[str, Path]] = None,
        existing_workbench: Optional[Workbench] = None,
    ) -> ImportResult:
        result = ImportResult()

        orders: List[Order] = []
        statuses: List[ProcessingStatus] = []
        photos: List[Photo] = []
        stl_files: List[STLFile] = []

        if order_csv:
            parse_result = self.order_parser.parse(order_csv)
            if not parse_result.success:
                result.errors.extend(parse_result.errors)
                result.success = False
            else:
                orders = parse_result.data
                result.warnings.extend(parse_result.warnings)

        if status_csv:
            parse_result = self.status_parser.parse(status_csv)
            if not parse_result.success:
                result.errors.extend(parse_result.errors)
            else:
                statuses = parse_result.data
                result.warnings.extend(parse_result.warnings)

        if photo_dir:
            scan_result = self.photo_scanner.scan_directory(photo_dir)
            if not scan_result.success:
                result.errors.extend(scan_result.errors)
            else:
                photos = scan_result.photos
                result.warnings.extend(scan_result.warnings)

        if stl_dir:
            scan_result = self.stl_scanner.scan_directory(stl_dir)
            if not scan_result.success:
                result.errors.extend(scan_result.errors)
            else:
                stl_files = scan_result.stl_files
                result.warnings.extend(scan_result.warnings)

        result.stats = {
            "orders": len(orders),
            "statuses": len(statuses),
            "photos": len(photos),
            "stl_files": len(stl_files),
        }

        workbench = existing_workbench or Workbench()
        self._merge_data(workbench, orders, statuses, photos, stl_files)

        result.workbench = workbench
        result.stats["total_items"] = workbench.item_count

        return result

    def _merge_data(
        self,
        workbench: Workbench,
        orders: List[Order],
        statuses: List[ProcessingStatus],
        photos: List[Photo],
        stl_files: List[STLFile],
    ) -> None:
        orders_by_model: Dict[str, Order] = {o.model_id: o for o in orders}
        statuses_by_model: Dict[str, ProcessingStatus] = {s.model_id: s for s in statuses}
        photos_by_model: Dict[str, List[Photo]] = {}
        for p in photos:
            if p.model_id not in photos_by_model:
                photos_by_model[p.model_id] = []
            photos_by_model[p.model_id].append(p)
        stl_by_model: Dict[str, List[STLFile]] = {}
        for s in stl_files:
            if s.model_id not in stl_by_model:
                stl_by_model[s.model_id] = []
            stl_by_model[s.model_id].append(s)

        all_model_ids = set()
        all_model_ids.update(orders_by_model.keys())
        all_model_ids.update(statuses_by_model.keys())
        all_model_ids.update(photos_by_model.keys())
        all_model_ids.update(stl_by_model.keys())

        for model_id in all_model_ids:
            existing_item = workbench.get_item(model_id)

            if existing_item:
                if model_id in orders_by_model:
                    existing_item.order = orders_by_model[model_id]
                if model_id in statuses_by_model:
                    existing_item.processing_status = statuses_by_model[model_id]
                if model_id in photos_by_model:
                    existing_item.photos = photos_by_model[model_id]
                if model_id in stl_by_model:
                    existing_item.stl_files = stl_by_model[model_id]
                existing_item.updated_at = datetime.now()
            else:
                item = WorkbenchItem(
                    model_id=model_id,
                    order=orders_by_model.get(model_id),
                    processing_status=statuses_by_model.get(model_id),
                    photos=photos_by_model.get(model_id, []),
                    stl_files=stl_by_model.get(model_id, []),
                )
                workbench.add_item(item)

        workbench.updated_at = datetime.now()

    def create_sample_workbench(self) -> Workbench:
        workbench = Workbench(name="示例复核台")
        return workbench
