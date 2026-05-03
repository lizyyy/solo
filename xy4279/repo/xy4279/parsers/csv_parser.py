import csv
from typing import Dict, List, Any, Optional
from io import StringIO, BytesIO
from models.schemas import SettingVersionCreate, SettingValueCreate, PlateStatusCreate, PlateStateCreate


class CSVParser:
    def __init__(self):
        self.encoding = "utf-8"

    def parse_settings(self, file_content: bytes, filename: str,
                       bay_id: str, bay_name: str, version: str) -> SettingVersionCreate:
        try:
            content = file_content.decode(self.encoding)
            reader = csv.DictReader(StringIO(content))
            
            version_info = self._extract_version_info(reader.fieldnames or [])
            values = self._parse_setting_values(reader)
            
            return SettingVersionCreate(
                version=version_info.get("version", version),
                bay_id=bay_id,
                bay_name=bay_name,
                device_type=version_info.get("device_type", "线路保护"),
                device_model=version_info.get("device_model", "RCS-931"),
                manufacturer=version_info.get("manufacturer", "南瑞继保"),
                effective_date=version_info.get("effective_date"),
                source_file=filename,
                source_type="csv",
                values=values
            )
        except UnicodeDecodeError:
            content = file_content.decode("gbk")
            reader = csv.DictReader(StringIO(content))
            
            version_info = self._extract_version_info(reader.fieldnames or [])
            values = self._parse_setting_values(reader)
            
            return SettingVersionCreate(
                version=version_info.get("version", version),
                bay_id=bay_id,
                bay_name=bay_name,
                device_type=version_info.get("device_type", "线路保护"),
                device_model=version_info.get("device_model", "RCS-931"),
                manufacturer=version_info.get("manufacturer", "南瑞继保"),
                effective_date=version_info.get("effective_date"),
                source_file=filename,
                source_type="csv",
                values=values
            )
        except Exception as e:
            raise ValueError(f"解析CSV定值文件失败: {str(e)}")

    def _extract_version_info(self, fieldnames: List[str]) -> Dict[str, Any]:
        info = {
            "version": "1.0",
            "device_type": "线路保护",
            "device_model": "RCS-931",
            "manufacturer": "南瑞继保",
            "effective_date": None
        }
        
        for name in fieldnames:
            name_lower = str(name).lower()
            if "version" in name_lower or "版本" in name_lower:
                info["version"] = "from_csv"
            elif "model" in name_lower or "型号" in name_lower:
                info["device_model"] = "from_csv"
            elif "manufacturer" in name_lower or "厂家" in name_lower:
                info["manufacturer"] = "from_csv"
        
        return info

    def _parse_setting_values(self, reader) -> List[SettingValueCreate]:
        values = []
        
        name_col = None
        value_col = None
        unit_col = None
        desc_col = None
        category_col = None
        group_col = None
        
        fieldnames = reader.fieldnames or []
        for col in fieldnames:
            col_lower = str(col).lower()
            if "name" in col_lower or "名称" in col_lower or "定值项" in col_lower:
                name_col = col
            elif "value" in col_lower or "值" in col_lower or "整定值" in col_lower:
                if "单位" not in col_lower:
                    value_col = col
            elif "unit" in col_lower or "单位" in col_lower:
                unit_col = col
            elif "description" in col_lower or "描述" in col_lower or "说明" in col_lower:
                desc_col = col
            elif "category" in col_lower or "类别" in col_lower or "分类" in col_lower:
                category_col = col
            elif "group" in col_lower or "组" in col_lower:
                group_col = col
        
        if name_col is None and value_col is None:
            if len(fieldnames) >= 2:
                name_col = fieldnames[0]
                value_col = fieldnames[1]
        
        if name_col is None or value_col is None:
            raise ValueError("无法识别定值名称或定值值列")
        
        current_group = None
        for row in reader:
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
            content = file_content.decode(self.encoding)
            reader = csv.DictReader(StringIO(content))
            
            plates = self._parse_plate_states(reader, bay_id)
            
            return PlateStatusCreate(
                name=name,
                bay_id=bay_id,
                bay_name=bay_name,
                source_file=filename,
                plates=plates
            )
        except UnicodeDecodeError:
            content = file_content.decode("gbk")
            reader = csv.DictReader(StringIO(content))
            
            plates = self._parse_plate_states(reader, bay_id)
            
            return PlateStatusCreate(
                name=name,
                bay_id=bay_id,
                bay_name=bay_name,
                source_file=filename,
                plates=plates
            )
        except Exception as e:
            raise ValueError(f"解析CSV压板状态文件失败: {str(e)}")

    def _parse_plate_states(self, reader, bay_id: str) -> List[PlateStateCreate]:
        plates = []
        
        fieldnames = reader.fieldnames or []
        
        id_col = None
        name_col = None
        type_col = None
        state_col = None
        target_col = None
        seq_col = None
        desc_col = None
        
        for col in fieldnames:
            col_lower = str(col).lower()
            if "id" in col_lower or "编号" in col_lower or "标识" in col_lower:
                id_col = col
            elif "name" in col_lower or "名称" in col_lower:
                name_col = col
            elif "type" in col_lower or "类型" in col_lower:
                type_col = col
            elif "state" in col_lower or "状态" in col_lower or "当前" in col_lower:
                if "目标" not in col_lower:
                    state_col = col
            elif "target" in col_lower or "目标" in col_lower:
                target_col = col
            elif "sequence" in col_lower or "顺序" in col_lower or "序号" in col_lower:
                seq_col = col
            elif "description" in col_lower or "描述" in col_lower or "说明" in col_lower:
                desc_col = col
        
        if id_col is None and len(fieldnames) >= 1:
            id_col = fieldnames[0]
        
        for idx, row in enumerate(reader):
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
                if seq_val and str(seq_val).strip() != "nan":
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
