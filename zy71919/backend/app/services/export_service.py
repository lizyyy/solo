import json
import os
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import pandas as pd

from ..models.models import ExportRecord, ExportItem, SoundMaterial, MatchRelation
from ..schemas.export import (
    ExportRequest,
    ExportResponse,
    ExportPreviewRequest,
    ExportPreviewResponse,
    ExportRecordResponse,
)
from ..schemas.common import ConsistencyCheckResult, PaginationParams
from ..core.config import settings
from ..utils.common import (
    generate_export_no,
    generate_trace_id,
    calculate_filter_hash,
    parse_tags,
)
from .material_service import MaterialService
from .history_service import HistoryService


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.material_service = MaterialService(db)
        self.history_service = HistoryService(db)

    def _build_material_query(self, filter_params: Dict[str, Any]):
        from ..schemas.common import MaterialFilterParams

        filters = MaterialFilterParams(**filter_params) if filter_params else MaterialFilterParams()
        filters.page = 1
        filters.page_size = 10000

        items, total = self.material_service.get_sound_material_list(filters)
        return items, total

    def check_consistency(
        self,
        filter_params: Dict[str, Any],
        screen_count: int,
    ) -> ConsistencyCheckResult:
        _, export_count = self._build_material_query(filter_params)

        mismatch_details = []
        passed = screen_count == export_count

        if not passed:
            mismatch_details.append(
                f"屏幕显示数量({screen_count})与后端查询数量({export_count})不一致"
            )

        return ConsistencyCheckResult(
            passed=passed,
            screen_count=screen_count,
            export_count=export_count,
            mismatch_details=mismatch_details,
        )

    def get_export_preview(
        self,
        request: ExportPreviewRequest,
        screen_count: Optional[int] = None,
    ) -> ExportPreviewResponse:
        filter_params = request.filter_params or {}
        filter_hash = calculate_filter_hash(filter_params)

        items, total = self._build_material_query(filter_params)

        consistency_check = self.check_consistency(filter_params, screen_count or total)

        return ExportPreviewResponse(
            data=items,
            total_count=total,
            consistency_check=consistency_check,
            filter_hash=filter_hash,
        )

    def export_materials(
        self,
        request: ExportRequest,
    ) -> ExportResponse:
        filter_params = request.filter_params or {}
        current_filter_hash = calculate_filter_hash(filter_params)

        if current_filter_hash != request.filter_hash:
            raise ValueError("筛选条件已变更，请重新获取导出预览")

        consistency_check = self.check_consistency(filter_params, request.screen_count)

        if not consistency_check.passed:
            raise ValueError(
                f"数据不一致: {'; '.join(consistency_check.mismatch_details)}"
            )

        items, total = self._build_material_query(filter_params)

        export_no = generate_export_no()
        trace_id = generate_trace_id()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = "xlsx" if request.format == "xlsx" else "csv"
        filename = f"环境音素材清单_{export_no}_{timestamp}.{ext}"
        file_path = settings.EXPORT_DIR / filename

        export_data = []
        for item in items:
            row = {
                "ID": item.id,
                "素材编号": item.material_no,
                "素材名称": item.name,
                "素材类型": item.type,
                "时长(秒)": item.duration,
                "文件路径": item.file_path or "",
                "文件哈希": item.file_hash,
                "标签": ",".join(item.tags) if item.tags else "",
                "描述": item.description or "",
                "状态": self._get_status_text(item.status),
                "置信度": item.confidence or "",
                "溯源ID": item.trace_id,
                "创建时间": item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
            }

            if request.columns:
                row = {k: v for k, v in row.items() if k in request.columns or k == "溯源ID"}

            export_data.append(row)

        df = pd.DataFrame(export_data)

        if request.format == "xlsx":
            with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="素材清单")

                worksheet = writer.sheets["素材清单"]
                for idx, col in enumerate(df.columns):
                    max_len = max(len(str(col)), df[col].astype(str).map(len).max())
                    worksheet.column_dimensions[chr(65 + idx)].width = min(max_len + 2, 50)
        else:
            df.to_csv(file_path, index=False, encoding="utf-8-sig")

        export_record = ExportRecord(
            export_no=export_no,
            filename=filename,
            file_path=str(file_path),
            total_count=total,
            filter_params=json.dumps(filter_params, ensure_ascii=False),
            filter_hash=request.filter_hash,
            exported_by=request.exported_by,
            trace_id=trace_id,
        )
        self.db.add(export_record)
        self.db.flush()

        for idx, item in enumerate(items):
            material_snapshot = json.dumps(item.model_dump(), ensure_ascii=False)
            export_item = ExportItem(
                export_id=export_record.id,
                material_id=item.id,
                material_snapshot=material_snapshot,
                sort_order=idx,
            )
            self.db.add(export_item)

        self.db.flush()

        self.history_service.create_operation_history(
            operation_type="export",
            target_type="export_record",
            target_id=export_record.id,
            operator=request.exported_by,
            after_data={
                "export_no": export_no,
                "filename": filename,
                "total_count": total,
                "filter_params": filter_params,
            },
            trace_id=trace_id,
        )

        download_url = f"/api/v1/export/records/{export_record.id}/download"

        return ExportResponse(
            export_no=export_no,
            filename=filename,
            download_url=download_url,
            total_count=total,
            consistency_check=consistency_check,
        )

    def _get_status_text(self, status: str) -> str:
        status_map = {
            "pending": "待匹配",
            "matched": "已匹配",
            "confirmed": "已确认",
            "rejected": "已驳回",
        }
        return status_map.get(status, status)

    def get_export_record_list(
        self,
        filter_hash: Optional[str] = None,
        exported_by: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[ExportRecordResponse], int]:
        query = self.db.query(ExportRecord)

        if filter_hash:
            query = query.filter(ExportRecord.filter_hash == filter_hash)
        if exported_by:
            query = query.filter(ExportRecord.exported_by == exported_by)

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(ExportRecord, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(ExportRecord, sort_by).desc())
                else:
                    query = query.order_by(getattr(ExportRecord, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()
        response_items = []
        for item in items:
            response_items.append(
                ExportRecordResponse(
                    id=item.id,
                    export_no=item.export_no,
                    filename=item.filename,
                    file_path=item.file_path,
                    total_count=item.total_count,
                    filter_params=json.loads(item.filter_params) if item.filter_params else None,
                    filter_hash=item.filter_hash,
                    exported_by=item.exported_by,
                    trace_id=item.trace_id,
                    created_at=item.created_at,
                )
            )

        return response_items, total

    def get_export_file_path(self, record_id: int) -> Optional[Tuple[str, str]]:
        record = self.db.query(ExportRecord).filter(ExportRecord.id == record_id).first()
        if not record or not os.path.exists(record.file_path):
            return None

        return record.file_path, record.filename

    def verify_export_consistency(self, record_id: int) -> Tuple[bool, List[str]]:
        record = self.db.query(ExportRecord).filter(ExportRecord.id == record_id).first()
        if not record:
            return False, ["导出记录不存在"]

        export_items = (
            self.db.query(ExportItem)
            .filter(ExportItem.export_id == record_id)
            .order_by(ExportItem.sort_order)
            .all()
        )

        filter_params = json.loads(record.filter_params) if record.filter_params else {}
        current_filter_hash = calculate_filter_hash(filter_params)

        issues = []

        if current_filter_hash != record.filter_hash:
            issues.append("筛选条件哈希不匹配，可能筛选条件已变更")

        export_material_ids = [item.material_id for item in export_items]
        items, total = self._build_material_query(filter_params)
        current_material_ids = [item.id for item in items]

        if len(export_material_ids) != len(current_material_ids):
            issues.append(
                f"导出时数量({len(export_material_ids)})与当前查询数量({len(current_material_ids)})不一致"
            )

        missing_ids = set(export_material_ids) - set(current_material_ids)
        if missing_ids:
            issues.append(f"以下ID在当前筛选结果中不存在: {list(missing_ids)}")

        extra_ids = set(current_material_ids) - set(export_material_ids)
        if extra_ids:
            issues.append(f"当前筛选结果多出以下ID: {list(extra_ids)}")

        return len(issues) == 0, issues
