from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


STANDARD_COLUMNS = {
    "record_id": ["记录编号", "记录ID", "ID", "编号", "record_id", "id", "序号"],
    "station_name": ["站点名称", "测站名称", "测站", "站点", "station_name", "station", "站名"],
    "timestamp": ["观测时间", "时间", "日期时间", "timestamp", "time", "date", "datetime"],
    "tidal_range": ["潮差数值", "潮差", "潮差值", "tidal_range", "range", "水位差"],
    "tidal_range_unit": ["潮差单位", "单位", "tidal_range_unit", "range_unit"],
    "flow_rate": ["流量数值", "流量", "flow_rate", "flow"],
    "flow_rate_unit": ["流量单位", "单位_流量", "flow_rate_unit", "flow_unit"],
    "water_velocity": ["流速", "水流速度", "water_velocity", "velocity", "speed"],
    "water_velocity_unit": ["流速单位", "速度单位", "water_velocity_unit", "velocity_unit"],
    "cross_sectional_area": ["过水面积", "截面面积", "过流面积", "cross_sectional_area", "area"],
    "cross_sectional_area_unit": ["面积单位", "cross_sectional_area_unit", "area_unit"],
    "turbine_efficiency": ["水轮机效率", "效率", "turbine_efficiency", "efficiency"],
    "data_source": ["数据来源", "来源", "data_source", "source"],
    "notes": ["备注", "说明", "注释", "notes", "remark", "comment"],
}


@dataclass
class ColumnMapping:
    source_column: str
    target_column: str
    confidence: float = 0.0
    is_custom: bool = False


@dataclass
class ImportPreview:
    filename: str
    total_rows: int
    total_columns: int
    sample_data: List[Dict] = field(default_factory=list)
    source_columns: List[str] = field(default_factory=list)
    suggested_mappings: List[ColumnMapping] = field(default_factory=list)
    raw_preview: str = ""


class ColumnNameNormalizer:
    def __init__(self):
        self.standard_columns = STANDARD_COLUMNS

    def _normalize_string(self, s: str) -> str:
        return str(s).strip().lower().replace(" ", "").replace("_", "")

    def suggest_mapping(self, source_column: str) -> Tuple[str, float]:
        normalized_source = self._normalize_string(source_column)
        
        best_match = None
        best_score = 0.0
        
        for standard_name, aliases in self.standard_columns.items():
            for alias in aliases:
                normalized_alias = self._normalize_string(alias)
                if normalized_source == normalized_alias:
                    return standard_name, 1.0
                
                if normalized_source in normalized_alias or normalized_alias in normalized_source:
                    score = 0.7 + 0.3 * (min(len(normalized_source), len(normalized_alias)) / max(len(normalized_source), len(normalized_alias)))
                    if score > best_score:
                        best_score = score
                        best_match = standard_name
                
                import difflib
                similarity = difflib.SequenceMatcher(None, normalized_source, normalized_alias).ratio()
                if similarity > 0.6 and similarity > best_score:
                    best_score = similarity
                    best_match = standard_name
        
        return best_match or "", best_score

    def generate_suggested_mappings(self, source_columns: List[str]) -> List[ColumnMapping]:
        mappings = []
        used_targets = set()
        
        for source_col in source_columns:
            target, confidence = self.suggest_mapping(source_col)
            if target and target not in used_targets:
                mappings.append(ColumnMapping(
                    source_column=source_col,
                    target_column=target,
                    confidence=confidence,
                    is_custom=False
                ))
                used_targets.add(target)
            else:
                mappings.append(ColumnMapping(
                    source_column=source_col,
                    target_column="",
                    confidence=0.0,
                    is_custom=False
                ))
        
        return mappings

    def get_standard_column_names(self) -> List[str]:
        return list(self.standard_columns.keys())

    def get_target_aliases(self, target_column: str) -> List[str]:
        return self.standard_columns.get(target_column, [])
