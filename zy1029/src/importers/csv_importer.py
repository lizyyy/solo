import io
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Dict, List, Optional, Any, Tuple, Callable
import pandas as pd

from src.models import RunRecord, PainLocation, DATA_SOURCE_NAMES


@dataclass
class ImportError:
    row_number: int
    error_type: str
    field_name: str
    message: str
    value: Any = None

    def to_display(self) -> str:
        if self.value is not None:
            return f"行 {self.row_number}: [{self.error_type}] {self.field_name}: {self.message} (值: {self.value})"
        return f"行 {self.row_number}: [{self.error_type}] {self.field_name}: {self.message}"


@dataclass
class ImportResult:
    success: bool
    records: List[RunRecord] = field(default_factory=list)
    errors: List[ImportError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    total_rows: int = 0
    imported_rows: int = 0


FIELD_MAPPERS: Dict[str, Dict[str, str]] = {
    "GARMIN": {
        "date": ["Date", "日期", "date", "Activity Date", "开始时间"],
        "distance": ["Distance", "距离", "distance_km", "距离(km)"],
        "duration": ["Time", "Duration", "时长", "时间", "总时间"],
        "avg_hr": ["Avg HR", "Average Heart Rate", "平均心率", "心率"],
        "avg_pace": ["Avg Pace", "平均配速", "配速"],
        "elevation": ["Elevation Gain", "爬升", "总爬升", "Ascent", "海拔上升"],
        "rpe": ["RPE", "主观疲劳", "疲劳度", "感觉"],
        "notes": ["Notes", "备注", "描述", "Description"]
    },
    "KEEP": {
        "date": ["日期", "Date", "date", "运动时间", "开始时间"],
        "distance": ["距离", "Distance", "distance_km", "公里数"],
        "duration": ["时长", "Duration", "Time", "耗时"],
        "avg_hr": ["平均心率", "心率", "Avg HR", "心率平均"],
        "avg_pace": ["平均配速", "配速", "Pace"],
        "elevation": ["爬升", "海拔上升", "累计爬升"],
        "rpe": ["感觉", "RPE", "疲劳度"],
        "notes": ["备注", "感想", "描述"]
    },
    "MANUAL": {
        "date": ["日期", "date", "Date"],
        "distance_km": ["距离", "距离(km)", "distance_km", "km"],
        "duration_min": ["用时(分)", "时长(分)", "duration_min", "分钟"],
        "avg_hr": ["平均心率", "心率", "avg_hr"],
        "pace_min_per_km": ["配速(分/公里)", "配速", "pace"],
        "elevation_m": ["爬升(m)", "海拔上升", "爬升"],
        "rpe": ["RPE", "主观疲劳", "疲劳度(1-10)"],
        "pain_location": ["伤痛位置", "疼痛部位"],
        "pain_severity": ["疼痛程度(1-10)", "疼痛等级"],
        "tags": ["标签", "tag"],
        "notes": ["备注", "注释", "说明"]
    }
}


def parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    val = str(value).strip()
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except ValueError:
        pass
    try:
        return datetime.strptime(val, "%Y/%m/%d").date()
    except ValueError:
        pass
    try:
        return datetime.strptime(val, "%Y-%m-%d %H:%M:%S").date()
    except ValueError:
        pass
    try:
        return datetime.strptime(val, "%Y/%m/%d %H:%M:%S").date()
    except ValueError:
        pass
    try:
        import dateutil.parser
        return dateutil.parser.parse(val).date()
    except (ImportError, ValueError):
        pass
    return None


def parse_distance(value: Any) -> Optional[float]:
    if value is None:
        return None
    val = str(value).strip().lower()
    numeric_val = re.sub(r'[^\d.]', '', val)
    if not numeric_val or numeric_val == '.':
        return None
    try:
        num = float(numeric_val)
        if 'm' in val and 'km' not in val:
            return num / 1000.0
        return num
    except ValueError:
        return None


def parse_duration(value: Any) -> Optional[float]:
    if value is None:
        return None
    val = str(value).strip()
    match = re.match(r'(\d+):(\d+):(\d+)', val)
    if match:
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        return hours * 60.0 + minutes + seconds / 60.0
    match = re.match(r'(\d+):(\d+)', val)
    if match:
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        return minutes + seconds / 60.0
    try:
        return float(re.sub(r'[^\d.]', '', val))
    except ValueError:
        return None


def parse_pace(value: Any) -> Optional[float]:
    if value is None:
        return None
    val = str(value).strip()
    match = re.match(r'(\d+):(\d+)', val)
    if match:
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        return minutes + seconds / 60.0
    try:
        return float(re.sub(r'[^\d.]', '', val))
    except ValueError:
        return None


def parse_integer(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return None


def parse_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return None


def parse_pain_location(value: Any) -> PainLocation:
    if value is None:
        return PainLocation.NONE
    val = str(value).strip().lower()
    mapping = {
        "无": PainLocation.NONE,
        "none": PainLocation.NONE,
        "左膝": PainLocation.KNEE_LEFT,
        "右膝": PainLocation.KNEE_RIGHT,
        "左脚踝": PainLocation.ANKLE_LEFT,
        "右脚踝": PainLocation.ANKLE_RIGHT,
        "左髋": PainLocation.HIP_LEFT,
        "右髋": PainLocation.HIP_RIGHT,
        "左小腿": PainLocation.CALF_LEFT,
        "右小腿": PainLocation.CALF_RIGHT,
        "胫骨": PainLocation.SHIN,
        "小腿前侧": PainLocation.SHIN,
        "下背部": PainLocation.LOWER_BACK,
        "其他": PainLocation.OTHER
    }
    return mapping.get(val, PainLocation.NONE)


def detect_source_by_columns(columns: List[str]) -> str:
    columns_lower = [str(c).strip().lower() for c in columns]
    garmin_indicators = {"activity date", "avg hr", "moving time", "distance"}
    keep_indicators = {"运动时间", "公里数", "配速", "心率平均"}
    manual_indicators = {"距离(km)", "用时(分)", "配速(分/公里)"}

    garmin_match = sum(1 for ind in garmin_indicators if any(ind in c for c in columns_lower))
    keep_match = sum(1 for ind in keep_indicators if any(ind in c for c in columns_lower))
    manual_match = sum(1 for ind in manual_indicators if any(ind in c for c in columns_lower))

    if manual_match >= 2:
        return "MANUAL"
    if garmin_match >= 2:
        return "GARMIN"
    if keep_match >= 2:
        return "KEEP"
    return "UNKNOWN"


def map_column_to_field(columns: List[str], field_aliases: List[str]) -> Optional[str]:
    columns_lower = {str(c).strip().lower(): c for c in columns}
    for alias in field_aliases:
        alias_lower = alias.strip().lower()
        if alias_lower in columns_lower:
            return columns_lower[alias_lower]
        for col_lower, original_col in columns_lower.items():
            if alias_lower in col_lower or col_lower in alias_lower:
                return original_col
    return None


@dataclass
class ColumnMapping:
    source_type: str
    column_map: Dict[str, str]
    raw_columns: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type,
            "column_map": self.column_map,
            "raw_columns": self.raw_columns,
            "source_name": DATA_SOURCE_NAMES.get(self.source_type, "未知来源")
        }


def auto_detect_mapping(columns: List[str]) -> ColumnMapping:
    source_type = detect_source_by_columns(columns)
    mappers = FIELD_MAPPERS.get(source_type, FIELD_MAPPERS["MANUAL"])
    column_map = {}
    for field_name, aliases in mappers.items():
        matched_col = map_column_to_field(columns, aliases)
        if matched_col:
            column_map[field_name] = matched_col
    return ColumnMapping(
        source_type=source_type,
        column_map=column_map,
        raw_columns=columns
    )


def parse_csv_to_records(
    csv_content: str,
    column_mapping: ColumnMapping,
    data_source: str = "UNKNOWN"
) -> ImportResult:
    errors: List[ImportError] = []
    records: List[RunRecord] = []
    warnings: List[str] = []

    try:
        df = pd.read_csv(io.StringIO(csv_content))
    except Exception as e:
        errors.append(ImportError(
            row_number=0,
            error_type="PARSE_ERROR",
            field_name="file",
            message=f"CSV解析失败: {str(e)}"
        ))
        return ImportResult(
            success=False,
            errors=errors,
            total_rows=0,
            imported_rows=0
        )

    total_rows = len(df)
    col_map = column_mapping.column_map

    for idx, row in df.iterrows():
        row_num = idx + 1
        row_errors: List[ImportError] = []

        date_val = None
        if "date" in col_map and col_map["date"] in df.columns:
            date_val = parse_date(row.get(col_map["date"]))
            if date_val is None:
                row_errors.append(ImportError(
                    row_number=row_num,
                    error_type="REQUIRED_MISSING",
                    field_name="日期",
                    message="无法解析日期格式",
                    value=row.get(col_map["date"])
                ))
        else:
            row_errors.append(ImportError(
                row_number=row_num,
                error_type="REQUIRED_MISSING",
                field_name="日期",
                message="缺少日期列"
            ))

        distance_val = None
        distance_col = col_map.get("distance") or col_map.get("distance_km")
        if distance_col and distance_col in df.columns:
            distance_val = parse_distance(row.get(distance_col))
            if distance_val is None:
                row_errors.append(ImportError(
                    row_number=row_num,
                    error_type="INVALID_VALUE",
                    field_name="距离",
                    message="无法解析距离数值",
                    value=row.get(distance_col)
                ))
            elif distance_val <= 0:
                row_errors.append(ImportError(
                    row_number=row_num,
                    error_type="INVALID_VALUE",
                    field_name="距离",
                    message="距离必须大于0",
                    value=distance_val
                ))
        else:
            row_errors.append(ImportError(
                row_number=row_num,
                error_type="REQUIRED_MISSING",
                field_name="距离",
                message="缺少距离列"
            ))

        duration_val = None
        duration_col = col_map.get("duration") or col_map.get("duration_min")
        if duration_col and duration_col in df.columns:
            duration_val = parse_duration(row.get(duration_col))
            if duration_val is None:
                row_errors.append(ImportError(
                    row_number=row_num,
                    error_type="INVALID_VALUE",
                    field_name="用时",
                    message="无法解析时长格式",
                    value=row.get(duration_col)
                ))
            elif duration_val <= 0:
                row_errors.append(ImportError(
                    row_number=row_num,
                    error_type="INVALID_VALUE",
                    field_name="用时",
                    message="用时必须大于0",
                    value=duration_val
                ))
        else:
            row_errors.append(ImportError(
                row_number=row_num,
                error_type="REQUIRED_MISSING",
                field_name="用时",
                message="缺少用时列"
            ))

        if row_errors:
            errors.extend(row_errors)
            continue

        assert date_val is not None
        assert distance_val is not None
        assert duration_val is not None

        avg_hr_val = None
        avg_hr_col = col_map.get("avg_hr")
        if avg_hr_col and avg_hr_col in df.columns:
            avg_hr_val = parse_integer(row.get(avg_hr_col))

        pace_val = None
        pace_col = col_map.get("avg_pace") or col_map.get("pace_min_per_km")
        if pace_col and pace_col in df.columns:
            pace_val = parse_pace(row.get(pace_col))
        if pace_val is None and distance_val and duration_val and distance_val > 0:
            pace_val = duration_val / distance_val

        elevation_val = 0.0
        elevation_col = col_map.get("elevation") or col_map.get("elevation_m")
        if elevation_col and elevation_col in df.columns:
            elevation_val = parse_float(row.get(elevation_col)) or 0.0

        rpe_val = None
        rpe_col = col_map.get("rpe")
        if rpe_col and rpe_col in df.columns:
            rpe_val = parse_integer(row.get(rpe_col))
            if rpe_val is not None:
                if rpe_val < 1:
                    rpe_val = 1
                elif rpe_val > 10:
                    rpe_val = 10

        pain_loc_val = PainLocation.NONE
        pain_loc_col = col_map.get("pain_location")
        if pain_loc_col and pain_loc_col in df.columns:
            pain_loc_val = parse_pain_location(row.get(pain_loc_col))

        pain_severity_val = None
        pain_sev_col = col_map.get("pain_severity")
        if pain_sev_col and pain_sev_col in df.columns:
            pain_severity_val = parse_integer(row.get(pain_sev_col))

        tags_val: List[str] = []
        tags_col = col_map.get("tags")
        if tags_col and tags_col in df.columns:
            tag_str = str(row.get(tags_col, "")).strip()
            if tag_str:
                tags_val = [t.strip() for t in tag_str.split(",") if t.strip()]

        notes_val = ""
        notes_col = col_map.get("notes")
        if notes_col and notes_col in df.columns:
            notes_val = str(row.get(notes_col, "")).strip()

        original_data = {str(k): v for k, v in row.to_dict().items()}

        record = RunRecord(
            record_id=str(uuid.uuid4())[:8],
            date=date_val,
            distance_km=distance_val,
            duration_min=duration_val,
            avg_hr=avg_hr_val,
            pace_min_per_km=pace_val,
            elevation_m=elevation_val,
            rpe=rpe_val,
            pain_location=pain_loc_val,
            pain_severity=pain_severity_val,
            tags=tags_val,
            notes=notes_val,
            data_source=data_source if data_source != "UNKNOWN" else column_mapping.source_type,
            original_data=original_data
        )
        records.append(record)

    success = len(records) > 0 or total_rows == 0
    if total_rows > 0 and len(records) < total_rows:
        warnings.append(f"共 {total_rows} 行数据，成功导入 {len(records)} 行，{len(errors)} 行存在错误。")

    return ImportResult(
        success=success,
        records=records,
        errors=errors,
        warnings=warnings,
        total_rows=total_rows,
        imported_rows=len(records)
    )
