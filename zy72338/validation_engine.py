import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from models import (
    GridBoundaryData,
    WarningItem,
    WarningType,
    DataSource,
    HistoryRecord,
)


class ValidationEngine:
    def __init__(self):
        self.imported_grid_ids: List[Tuple[str, datetime]] = []
        self.percent_pattern = re.compile(r'^(-?\d+\.?\d*)%$')
        self.decimal_pattern = re.compile(r'^(-?\d+\.?\d*)$')
        self.history_records: List[HistoryRecord] = []

    def parse_value(self, raw_value: str) -> Tuple[Optional[float], Optional[bool], str]:
        raw_value = raw_value.strip()
        
        percent_match = self.percent_pattern.match(raw_value)
        if percent_match:
            numeric = float(percent_match.group(1))
            return numeric, True, "解析为百分数"
        
        decimal_match = self.decimal_pattern.match(raw_value)
        if decimal_match:
            numeric = float(decimal_match.group(1))
            return numeric, False, "解析为小数"
        
        return None, None, "无法解析数值"

    def detect_percent_decimal_mix(
        self, 
        grid_data_list: List[GridBoundaryData]
    ) -> List[WarningItem]:
        warnings = []
        grid_groups: Dict[str, List[GridBoundaryData]] = {}
        
        for data in grid_data_list:
            if data.grid_id not in grid_groups:
                grid_groups[data.grid_id] = []
            grid_groups[data.grid_id].append(data)
        
        for grid_id, data_list in grid_groups.items():
            if len(data_list) < 2:
                continue
            
            has_percent = any(d.is_percent is True for d in data_list)
            has_decimal = any(d.is_percent is False for d in data_list)
            
            if has_percent and has_decimal:
                for data in data_list:
                    warnings.append(WarningItem(
                        warning_type=WarningType.PERCENT_DECIMAL_MIX,
                        grid_id=grid_id,
                        field_name="boundary_threshold",
                        current_value=data.raw_value,
                        description=f"网格[{grid_id}]同时存在百分数和小数格式的边界值，"
                                   f"当前行({data.row_index})值为{data.raw_value}",
                        suggestion="请统一数值格式，全部使用百分数或全部使用小数，"
                                  "不自动判定为正常，需活动负责人复核",
                        need_manager_review=True
                    ))
        
        return warnings

    def detect_duplicate_import(
        self,
        grid_data_list: List[GridBoundaryData],
        source: DataSource
    ) -> List[WarningItem]:
        warnings = []
        current_import = set()
        
        for data in grid_data_list:
            if data.grid_id in current_import:
                warnings.append(WarningItem(
                    warning_type=WarningType.DUPLICATE_IMPORT,
                    grid_id=data.grid_id,
                    field_name="grid_id",
                    current_value=data.grid_id,
                    description=f"网格[{data.grid_id}]在本次导入中重复出现，"
                               f"重复位置：第{data.row_index}行",
                    suggestion="请检查导入文件，删除重复数据后重新导入",
                    need_manager_review=False
                ))
            current_import.add(data.grid_id)
            
            for imported_id, import_time in self.imported_grid_ids:
                if data.grid_id == imported_id:
                    warnings.append(WarningItem(
                        warning_type=WarningType.DUPLICATE_IMPORT,
                        grid_id=data.grid_id,
                        field_name="grid_id",
                        current_value=data.grid_id,
                        expected_value=None,
                        description=f"网格[{data.grid_id}]曾在{import_time.strftime('%Y-%m-%d %H:%M:%S')}"
                                   f"导入过，本次为重复导入",
                        suggestion="如需更新数据请走补录流程，不要重复导入",
                        need_manager_review=False
                    ))
        
        return warnings

    def detect_data_mismatch(
        self,
        new_data: List[GridBoundaryData],
        old_data: List[GridBoundaryData]
    ) -> List[WarningItem]:
        warnings = []
        old_data_map = {d.grid_id: d for d in old_data}
        
        for new_d in new_data:
            if new_d.grid_id in old_data_map:
                old_d = old_data_map[new_d.grid_id]
                if new_d.numeric_value != old_d.numeric_value:
                    warnings.append(WarningItem(
                        warning_type=WarningType.DATA_MISMATCH,
                        grid_id=new_d.grid_id,
                        field_name="boundary_value",
                        current_value=new_d.raw_value,
                        expected_value=old_d.raw_value,
                        description=f"网格[{new_d.grid_id}]边界值与历史记录不一致："
                                   f"历史值{old_d.raw_value}，当前值{new_d.raw_value}",
                        suggestion="请确认数据是否正确，如需修改请走补录流程",
                        need_manager_review=True
                    ))
        
        return warnings

    def validate_grid_data(
        self,
        grid_data_list: List[GridBoundaryData],
        source: DataSource,
        historical_data: Optional[List[GridBoundaryData]] = None,
        check_duplicate: bool = True
    ) -> List[WarningItem]:
        all_warnings = []
        
        for data in grid_data_list:
            if data.numeric_value is None or data.is_percent is None:
                numeric, is_percent, msg = self.parse_value(data.raw_value)
                if numeric is None:
                    all_warnings.append(WarningItem(
                        warning_type=WarningType.MISSING_DATA,
                        grid_id=data.grid_id,
                        field_name="boundary_threshold",
                        current_value=data.raw_value,
                        description=f"网格[{data.grid_id}]边界值格式错误：{data.raw_value}，{msg}",
                        suggestion="请检查边界值格式，应为百分数（如5%）或小数（如0.05）",
                        need_manager_review=False
                    ))
                else:
                    data.numeric_value = numeric
                    data.is_percent = is_percent
        
        percent_mix_warnings = self.detect_percent_decimal_mix(grid_data_list)
        all_warnings.extend(percent_mix_warnings)
        
        if check_duplicate:
            duplicate_warnings = self.detect_duplicate_import(grid_data_list, source)
            all_warnings.extend(duplicate_warnings)
        
        if historical_data:
            mismatch_warnings = self.detect_data_mismatch(grid_data_list, historical_data)
            all_warnings.extend(mismatch_warnings)
        
        return all_warnings

    def record_import(self, grid_data_list: List[GridBoundaryData]):
        now = datetime.now()
        for data in grid_data_list:
            self.imported_grid_ids.append((data.grid_id, now))
        
        self.history_records.append(HistoryRecord(
            record_id=f"hist_{now.strftime('%Y%m%d%H%M%S')}",
            operation_type="导入数据",
            operator="system",
            operation_time=now,
            detail=f"成功导入{len(grid_data_list)}条网格边界数据",
            data_after={"count": len(grid_data_list)}
        ))

    def get_import_history(self) -> List[HistoryRecord]:
        return self.history_records
