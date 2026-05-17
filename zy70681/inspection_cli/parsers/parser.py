import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd

from ..models.base import (
    Store,
    InspectionItem,
    RectificationTask,
    Recheck,
    Deduction,
    PhotoEvidence,
    SourceLocation,
    ParsingError,
    InspectionSession,
    RectificationStatus,
    RecheckResult
)
from ..utils.helpers import (
    normalize_string,
    parse_date,
    safe_float,
    safe_int,
    generate_id
)


@dataclass
class ParseResult:
    session: InspectionSession
    stats: Dict[str, int]


class DataParser:
    def __init__(self):
        self.file_mapping = {
            "stores": ["门店", "店铺", "store"],
            "items": ["巡检", "检查", "inspection"],
            "tasks": ["整改", "任务", "task"],
            "rechecks": ["复查", "recheck"],
            "deductions": ["扣分", "deduction"],
            "photos": ["照片", "图片", "photo"]
        }

    def detect_sheet_type(self, sheet_name: str) -> Optional[str]:
        sheet_lower = sheet_name.lower()
        for data_type, keywords in self.file_mapping.items():
            for kw in keywords:
                if kw in sheet_lower:
                    return data_type
        return None

    def parse_file(self, file_path: str, session: Optional[InspectionSession] = None) -> ParseResult:
        file_path = str(Path(file_path).resolve())
        if session is None:
            session = InspectionSession(session_id=generate_id(file_path))

        stats = {
            "stores": 0,
            "items": 0,
            "tasks": 0,
            "rechecks": 0,
            "deductions": 0,
            "photos": 0,
            "errors": 0
        }

        if file_path.endswith('.csv'):
            result = self._parse_csv(file_path, session)
            for k, v in result.stats.items():
                stats[k] += v
        elif file_path.endswith(('.xlsx', '.xls')):
            excel_file = pd.ExcelFile(file_path)
            for sheet_name in excel_file.sheet_names:
                sheet_type = self.detect_sheet_type(sheet_name)
                if sheet_type:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    result = self._parse_dataframe(df, sheet_type, file_path, sheet_name, session)
                    for k, v in result.items():
                        stats[k] += v
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        return ParseResult(session=session, stats=stats)

    def _parse_csv(self, file_path: str, session: InspectionSession) -> ParseResult:
        stats = {
            "stores": 0,
            "items": 0,
            "tasks": 0,
            "rechecks": 0,
            "deductions": 0,
            "photos": 0,
            "errors": 0
        }

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = [h.strip() for h in reader.fieldnames] if reader.fieldnames else []

            sheet_type = self._detect_data_type(headers)
            if not sheet_type:
                raise ValueError(f"无法识别CSV文件类型: {file_path}")

            for row_idx, row in enumerate(reader, start=2):
                try:
                    row_data = {k.strip(): v for k, v in row.items()}
                    self._parse_row(row_data, sheet_type, file_path, None, row_idx, session)
                    stats[sheet_type] += 1
                except Exception as e:
                    error = ParsingError(
                        error_type="解析错误",
                        message=str(e),
                        source_location=SourceLocation(
                            file_path=file_path,
                            row_number=row_idx
                        ),
                        raw_data=row
                    )
                    session.add_parsing_error(error)
                    stats["errors"] += 1

        return ParseResult(session=session, stats=stats)

    def _parse_dataframe(
        self,
        df: pd.DataFrame,
        sheet_type: str,
        file_path: str,
        sheet_name: str,
        session: InspectionSession
    ) -> Dict[str, int]:
        stats = {
            "stores": 0,
            "items": 0,
            "tasks": 0,
            "rechecks": 0,
            "deductions": 0,
            "photos": 0,
            "errors": 0
        }

        for row_idx, (_, row) in enumerate(df.iterrows(), start=2):
            try:
                row_data = row.to_dict()
                self._parse_row(row_data, sheet_type, file_path, sheet_name, row_idx, session)
                if sheet_type in stats:
                    stats[sheet_type] += 1
            except Exception as e:
                error = ParsingError(
                    error_type="解析错误",
                    message=str(e),
                    source_location=SourceLocation(
                        file_path=file_path,
                        sheet_name=sheet_name,
                        row_number=row_idx
                    ),
                    raw_data={k: str(v) for k, v in row.to_dict().items()}
                )
                session.add_parsing_error(error)
                stats["errors"] += 1

        return stats

    def _detect_data_type(self, headers: List[str]) -> Optional[str]:
        header_lower = [h.lower() for h in headers]
        if any(kw in h for h in header_lower for kw in ["门店", "店铺", "store"]):
            return "stores"
        if any(kw in h for h in header_lower for kw in ["巡检", "检查", "inspection"]):
            return "items"
        if any(kw in h for h in header_lower for kw in ["整改", "任务", "task"]):
            return "tasks"
        if any(kw in h for h in header_lower for kw in ["复查", "recheck"]):
            return "rechecks"
        if any(kw in h for h in header_lower for kw in ["扣分", "deduction"]):
            return "deductions"
        if any(kw in h for h in header_lower for kw in ["照片", "图片", "photo"]):
            return "photos"
        return None

    def _parse_row(
        self,
        row_data: Dict[str, Any],
        sheet_type: str,
        file_path: str,
        sheet_name: Optional[str],
        row_number: int,
        session: InspectionSession
    ) -> None:
        source_location = SourceLocation(
            file_path=file_path,
            sheet_name=sheet_name,
            row_number=row_number
        )

        if sheet_type == "stores":
            store = self._parse_store_row(row_data, source_location)
            session.add_store(store)
        elif sheet_type == "items":
            item = self._parse_inspection_row(row_data, source_location)
            session.add_item(item)
        elif sheet_type == "tasks":
            task = self._parse_task_row(row_data, source_location)
            session.add_task(task)
        elif sheet_type == "rechecks":
            recheck = self._parse_recheck_row(row_data, source_location)
            session.add_recheck(recheck)
        elif sheet_type == "deductions":
            deduction = self._parse_deduction_row(row_data, source_location)
            session.add_deduction(deduction)
        elif sheet_type == "photos":
            photo = self._parse_photo_row(row_data, source_location)
            session.photos[photo.photo_id] = photo

    def _parse_store_row(self, row: Dict[str, Any], source_location: SourceLocation) -> Store:
        get_val = lambda *keys: self._get_value(row, keys)

        store_id = normalize_string(get_val("门店编号", "店铺ID", "store_id", "storeid"))
        if not store_id:
            store_id = generate_id(get_val("门店名称", "店铺名称", "store_name"))

        return Store(
            store_id=store_id,
            store_name=normalize_string(get_val("门店名称", "店铺名称", "store_name", "storename")),
            region=normalize_string(get_val("区域", "region", "大区")),
            manager=normalize_string(get_val("店长", "经理", "manager")),
            address=normalize_string(get_val("地址", "address")),
            source_location=source_location
        )

    def _parse_inspection_row(self, row: Dict[str, Any], source_location: SourceLocation) -> InspectionItem:
        get_val = lambda *keys: self._get_value(row, keys)

        item_id = normalize_string(get_val("巡检项编号", "检查项ID", "item_id"))
        if not item_id:
            item_id = generate_id(
                get_val("门店编号", "store_id"),
                get_val("巡检项", "检查项", "item_name"),
                get_val("巡检时间", "inspected_at")
            )

        score = safe_float(get_val("得分", "score"))
        max_score = safe_float(get_val("满分", "总分", "max_score"), 10.0)
        is_pass = self._parse_bool(get_val("是否通过", "pass", "合格"))

        return InspectionItem(
            item_id=item_id,
            store_id=normalize_string(get_val("门店编号", "store_id")),
            category=normalize_string(get_val("分类", "类别", "category")),
            item_name=normalize_string(get_val("巡检项", "检查项", "item_name")),
            score=score,
            max_score=max_score,
            is_pass=is_pass,
            inspector=normalize_string(get_val("巡检人", "检查员", "inspector")),
            inspected_at=parse_date(get_val("巡检时间", "检查时间", "inspected_at")) or parse_date("now"),
            remarks=normalize_string(get_val("备注", "remarks")),
            source_location=source_location
        )

    def _parse_task_row(self, row: Dict[str, Any], source_location: SourceLocation) -> RectificationTask:
        get_val = lambda *keys: self._get_value(row, keys)

        task_id = normalize_string(get_val("任务编号", "整改任务ID", "task_id"))
        if not task_id:
            task_id = generate_id(
                get_val("巡检项编号", "item_id"),
                get_val("创建时间", "created_at")
            )

        status_str = normalize_string(get_val("状态", "status"))
        status = self._parse_rectification_status(status_str)

        return RectificationTask(
            task_id=task_id,
            item_id=normalize_string(get_val("巡检项编号", "检查项ID", "item_id")),
            store_id=normalize_string(get_val("门店编号", "store_id")),
            description=normalize_string(get_val("整改要求", "任务描述", "description")),
            deadline=parse_date(get_val("截止时间", "deadline")) or parse_date("now"),
            assigned_to=normalize_string(get_val("负责人", "assigned_to", "整改人")),
            status=status,
            created_at=parse_date(get_val("创建时间", "created_at")) or parse_date("now"),
            source_location=source_location
        )

    def _parse_recheck_row(self, row: Dict[str, Any], source_location: SourceLocation) -> Recheck:
        get_val = lambda *keys: self._get_value(row, keys)

        recheck_id = normalize_string(get_val("复查编号", "recheck_id"))
        if not recheck_id:
            recheck_id = generate_id(
                get_val("整改任务编号", "task_id"),
                get_val("复查时间", "rechecked_at")
            )

        result_str = normalize_string(get_val("复查结果", "result"))
        result = self._parse_recheck_result(result_str)

        return Recheck(
            recheck_id=recheck_id,
            task_id=normalize_string(get_val("整改任务编号", "任务编号", "task_id")),
            item_id=normalize_string(get_val("巡检项编号", "item_id")),
            store_id=normalize_string(get_val("门店编号", "store_id")),
            rechecker=normalize_string(get_val("复查人", "rechecker")),
            rechecked_at=parse_date(get_val("复查时间", "rechecked_at")) or parse_date("now"),
            result=result,
            reason=normalize_string(get_val("原因", "理由", "reason")),
            source_location=source_location
        )

    def _parse_deduction_row(self, row: Dict[str, Any], source_location: SourceLocation) -> Deduction:
        get_val = lambda *keys: self._get_value(row, keys)

        deduction_id = normalize_string(get_val("扣分编号", "deduction_id"))
        if not deduction_id:
            deduction_id = generate_id(
                get_val("巡检项编号", "item_id"),
                get_val("扣分时间", "deducted_at")
            )

        return Deduction(
            deduction_id=deduction_id,
            item_id=normalize_string(get_val("巡检项编号", "item_id")),
            store_id=normalize_string(get_val("门店编号", "store_id")),
            reason=normalize_string(get_val("扣分原因", "reason")),
            points=safe_float(get_val("扣分数", "points", "扣分")),
            deducted_at=parse_date(get_val("扣分时间", "deducted_at")) or parse_date("now"),
            deducted_by=normalize_string(get_val("扣分人", "deducted_by")),
            source_location=source_location
        )

    def _parse_photo_row(self, row: Dict[str, Any], source_location: SourceLocation) -> PhotoEvidence:
        get_val = lambda *keys: self._get_value(row, keys)

        photo_id = normalize_string(get_val("照片编号", "photo_id"))
        if not photo_id:
            photo_id = generate_id(get_val("文件路径", "file_path"))

        return PhotoEvidence(
            photo_id=photo_id,
            file_path=normalize_string(get_val("文件路径", "路径", "file_path")),
            photo_type=normalize_string(get_val("照片类型", "type", "类别")),
            description=normalize_string(get_val("描述", "说明", "description")),
            taken_at=parse_date(get_val("拍摄时间", "taken_at")),
            taken_by=normalize_string(get_val("拍摄人", "taken_by")),
            source_location=source_location
        )

    def _get_value(self, row: Dict[str, Any], keys: Tuple[str, ...]) -> Any:
        row_lower = {k.lower(): v for k, v in row.items()}
        for key in keys:
            key_lower = key.lower()
            if key_lower in row_lower:
                return row_lower[key_lower]
            for k, v in row.items():
                if key_lower in k.lower():
                    return v
        return ""

    def _parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        s = normalize_string(str(value)).lower()
        return s in ["是", "true", "yes", "通过", "合格", "1"]

    def _parse_rectification_status(self, status_str: str) -> RectificationStatus:
        s = status_str.lower()
        if "待" in s or "pending" in s:
            return RectificationStatus.PENDING
        elif "进行" in s or "progress" in s:
            return RectificationStatus.IN_PROGRESS
        elif "提交" in s or "submit" in s:
            return RectificationStatus.SUBMITTED
        elif "通过" in s or "pass" in s:
            return RectificationStatus.PASSED
        elif "驳回" in s or "reject" in s:
            return RectificationStatus.REJECTED
        return RectificationStatus.PENDING

    def _parse_recheck_result(self, result_str: str) -> RecheckResult:
        s = result_str.lower()
        if "通过" in s or "pass" in s:
            return RecheckResult.PASSED
        elif "驳回" in s or "reject" in s:
            return RecheckResult.REJECTED
        elif "再次" in s or "again" in s:
            return RecheckResult.NEEDS_RECTIFICATION
        return RecheckResult.REJECTED
