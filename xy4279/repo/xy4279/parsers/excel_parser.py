import pandas as pd
from typing import Dict, List, Any, Optional
from io import BytesIO
from models.schemas import SettingVersionCreate, SettingValueCreate, PlateStatusCreate, PlateStateCreate


class ExcelParser:
    def __init__(self):
        self.required_columns = {
            "settings": ["name", "value"],
            "plates": ["plate_id", "plate_name", "plate_type", "current_state"]
        }

    def parse_settings(self, file_content: bytes, filename: str, 
                       bay_id: str, bay_name: str, version: str) -> SettingVersionCreate:
        try:
            df = pd.read_excel(BytesIO(file_content))
            df.columns = [str(col).strip().lower() for col in df.columns]
            
            version_info = self._extract_version_info(df, bay_id, bay_name, version)
            values = self._parse_setting_values(df)
            
            return SettingVersionCreate(
                version=version_info.get("version", version),
                bay_id=bay_id,
                bay_name=bay_name,
                device_type=version_info.get("device_type", "线路保护"),
                device_model=version_info.get("device_model", "RCS-931"),
                manufacturer=version_info.get("manufacturer", "南瑞继保"),
                effective_date=version_info.get("effective_date"),
                source_file=filename,
                source_type="excel",
                values=values
            )
        except Exception as e:
            raise ValueError(f"解析Excel定值文件失败: {str(e)}")

    def _extract_version_info(self, df: pd.DataFrame, bay_id: str, bay_name: str, version: str) -> Dict[str, Any]:
        info = {
            "version": version,
            "device_type": "线路保护",
            "device_model": "RCS-931",
            "manufacturer": "南瑞继保",
            "effective_date": None
        }
        
        info_rows = df[df.apply(lambda row: any("版本" in str(cell) or "型号" in str(cell) 
                                                  or "厂家" in str(cell) or "日期" in str(cell)
                                                  for cell in row), axis=1)]
        
        for _, row in info_rows.iterrows():
            for col in df.columns:
                cell_value = str(row[col])
                if "版本" in cell_value:
                    next_col_idx = df.columns.get_loc(col) + 1
                    if next_col_idx < len(df.columns):
                        info["version"] = str(row.iloc[next_col_idx]).strip()
                elif "型号" in cell_value or "装置型号" in cell_value:
                    next_col_idx = df.columns.get_loc(col) + 1
                    if next_col_idx < len(df.columns):
                        info["device_model"] = str(row.iloc[next_col_idx]).strip()
                elif "厂家" in cell_value or "制造商" in cell_value:
                    next_col_idx = df.columns.get_loc(col) + 1
                    if next_col_idx < len(df.columns):
                        info["manufacturer"] = str(row.iloc[next_col_idx]).strip()
                elif "日期" in cell_value or "生效日期" in cell_value:
                    next_col_idx = df.columns.get_loc(col) + 1
                    if next_col_idx < len(df.columns):
                        info["effective_date"] = str(row.iloc[next_col_idx]).strip()
        
        return info

    def _parse_setting_values(self, df: pd.DataFrame) -> List[SettingValueCreate]:
        values = []
        
        name_col = None
        value_col = None
        unit_col = None
        desc_col = None
        category_col = None
        group_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if "名称" in col_lower or "name" in col_lower or "定值项" in col_lower:
                name_col = col
            elif "值" in col_lower or "value" in col_lower or "整定值" in col_lower:
                if "单位" not in col_lower:
                    value_col = col
            elif "单位" in col_lower or "unit" in col_lower:
                unit_col = col
            elif "描述" in col_lower or "说明" in col_lower or "description" in col_lower:
                desc_col = col
            elif "类别" in col_lower or "分类" in col_lower or "category" in col_lower:
                category_col = col
            elif "组" in col_lower or "group" in col_lower:
                group_col = col
        
        if name_col is None and value_col is None:
            for col in df.columns:
                sample_values = df[col].dropna().head(5).tolist()
                if all(isinstance(v, (int, float)) or str(v).replace('.', '', 1).isdigit() for v in sample_values if v):
                    value_col = col
                elif any(isinstance(v, str) and len(v) > 2 for v in sample_values):
                    name_col = col
        
        if name_col is None or value_col is None:
            raise ValueError("无法识别定值名称或定值值列")
        
        current_group = None
        for idx, row in df.iterrows():
            name = str(row.get(name_col, "")).strip()
            value = str(row.get(value_col, "")).strip()
            
            if not name or not value or name == "nan" or value == "nan":
                if name and "保护" in name and "组" in name:
                    current_group = name
                continue
            
            unit = str(row.get(unit_col, "")).strip() if unit_col else None
            description = str(row.get(desc_col, "")).strip() if desc_col else None
            category = str(row.get(category_col, "")).strip() if category_col else None
            group_name = str(row.get(group_col, current_group or "")).strip() if group_col else current_group
            
            values.append(SettingValueCreate(
                name=name,
                value=value,
                unit=unit if unit and unit != "nan" else None,
                description=description if description and description != "nan" else None,
                category=category if category and category != "nan" else None,
                group_name=group_name if group_name and group_name != "nan" else None
            ))
        
        return values

    def parse_plates(self, file_content: bytes, filename: str,
                     bay_id: str, bay_name: str, name: str) -> PlateStatusCreate:
        try:
            df = pd.read_excel(BytesIO(file_content))
            df.columns = [str(col).strip().lower() for col in df.columns]
            
            plates = self._parse_plate_states(df, bay_id)
            
            return PlateStatusCreate(
                name=name,
                bay_id=bay_id,
                bay_name=bay_name,
                source_file=filename,
                plates=plates
            )
        except Exception as e:
            raise ValueError(f"解析Excel压板状态文件失败: {str(e)}")

    def _parse_plate_states(self, df: pd.DataFrame, bay_id: str) -> List[PlateStateCreate]:
        plates = []
        
        id_col = None
        name_col = None
        type_col = None
        state_col = None
        target_col = None
        seq_col = None
        desc_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if "id" in col_lower or "编号" in col_lower or "标识" in col_lower:
                id_col = col
            elif "名称" in col_lower or "name" in col_lower:
                name_col = col
            elif "类型" in col_lower or "type" in col_lower:
                type_col = col
            elif "状态" in col_lower or "state" in col_lower or "当前" in col_lower:
                if "目标" not in col_lower:
                    state_col = col
            elif "目标" in col_lower or "target" in col_lower:
                target_col = col
            elif "顺序" in col_lower or "sequence" in col_lower or "序号" in col_lower:
                seq_col = col
            elif "描述" in col_lower or "说明" in col_lower:
                desc_col = col
        
        if id_col is None:
            for idx, col in enumerate(df.columns):
                sample = df[col].dropna().head(5).tolist()
                if all(isinstance(v, (int, str)) and len(str(v)) <= 20 for v in sample):
                    id_col = col
                    break
        
        for idx, row in df.iterrows():
            plate_id = str(row.get(id_col, idx + 1)).strip()
            plate_name = str(row.get(name_col, f"压板{idx + 1}")).strip()
            plate_type = str(row.get(type_col, "功能压板")).strip()
            current_state = str(row.get(state_col, "退出")).strip()
            
            if not plate_id or plate_id == "nan":
                continue
            
            target_state = str(row.get(target_col, "")).strip() if target_col else None
            
            sequence = None
            if seq_col:
                seq_val = row.get(seq_col)
                if pd.notna(seq_val):
                    try:
                        sequence = int(seq_val)
                    except (ValueError, TypeError):
                        pass
            
            description = str(row.get(desc_col, "")).strip() if desc_col else None
            
            plates.append(PlateStateCreate(
                plate_id=plate_id,
                plate_name=plate_name,
                plate_type=plate_type if plate_type and plate_type != "nan" else "功能压板",
                current_state=current_state if current_state and current_state != "nan" else "退出",
                target_state=target_state if target_state and target_state != "nan" else None,
                sequence=sequence,
                description=description if description and description != "nan" else None,
                bay_id=bay_id
            ))
        
        return plates
