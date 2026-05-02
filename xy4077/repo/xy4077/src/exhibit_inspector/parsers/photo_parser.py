"""照片清单CSV解析器"""

from __future__ import annotations

import csv
from pathlib import Path

from ..models import PhotoRecord, PhotoType
from .base import ParserResult, ValidationError
from .utils import parse_timestamp, generate_record_id


class PhotoCSVParser:
    """照片清单CSV解析器"""
    
    EXPECTED_HEADERS = [
        ["filename", "文件名", "照片文件名"],
        ["box_id", "箱号", "展箱编号"],
        ["route_node", "节点", "路书节点"],
        ["photo_type", "类型", "照片类型"],
        ["timestamp", "拍摄时间", "时间"],
        ["location", "地点", "拍摄地点"],
        ["photographer", "拍摄人"],
        ["description", "描述", "照片描述"],
        ["tags", "标签"],
    ]
    
    def __init__(self):
        self.header_mapping: dict[str, str] = {}
    
    def parse(
        self,
        file_path: str | Path,
        box_ids: list[str] | None = None,
    ) -> ParserResult[PhotoRecord]:
        """解析照片清单CSV文件"""
        file_path = Path(file_path)
        result = ParserResult[PhotoRecord](source_file=str(file_path))
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                
                if not reader.fieldnames:
                    result.errors.append(ValidationError(
                        message="无法读取CSV表头",
                        source_file=str(file_path),
                    ))
                    return result
                
                self._map_headers(reader.fieldnames)
                
                for row_idx, row in enumerate(reader, start=2):
                    result.total_rows += 1
                    
                    try:
                        photo = self._parse_row(row, row_idx, str(file_path))
                        result.data.append(photo)
                        result.valid_rows += 1
                    except ValidationError as e:
                        result.errors.append(e)
                    except Exception as e:
                        result.errors.append(ValidationError(
                            message=f"解析行失败: {str(e)}",
                            line_number=row_idx,
                            source_file=str(file_path),
                        ))
        
        except FileNotFoundError:
            result.errors.append(ValidationError(
                message=f"文件不存在: {file_path}",
                source_file=str(file_path),
            ))
        except Exception as e:
            result.errors.append(ValidationError(
                message=f"读取文件失败: {str(e)}",
                source_file=str(file_path),
            ))
        
        return result
    
    def _map_headers(self, fieldnames: list[str]):
        """映射CSV表头到标准字段名"""
        fieldnames_lower = [fn.strip().lower() for fn in fieldnames]
        
        for expected_group in self.EXPECTED_HEADERS:
            standard_name = expected_group[0]
            for alt in expected_group:
                alt_lower = alt.lower()
                if alt_lower in fieldnames_lower:
                    idx = fieldnames_lower.index(alt_lower)
                    self.header_mapping[standard_name] = fieldnames[idx]
                    break
    
    def _get_field(self, row: dict[str, str], field_name: str) -> str:
        """从行中获取字段值"""
        csv_field = self.header_mapping.get(field_name, field_name)
        value = row.get(csv_field, row.get(field_name, ""))
        if value is None:
            return ""
        return str(value).strip()
    
    def _parse_row(
        self,
        row: dict[str, str],
        line_number: int,
        source_file: str,
    ) -> PhotoRecord:
        """解析单行数据"""
        filename = self._get_field(row, "filename")
        if not filename:
            raise ValidationError(
                message="文件名不能为空",
                field="filename",
                line_number=line_number,
                source_file=source_file,
            )
        
        photo_type_str = self._get_field(row, "photo_type")
        photo_type = self._parse_photo_type(photo_type_str)
        
        timestamp_str = self._get_field(row, "timestamp")
        timestamp = None
        if timestamp_str:
            try:
                timestamp = parse_timestamp(timestamp_str)
            except ValueError:
                pass
        
        tags_str = self._get_field(row, "tags")
        tags = []
        if tags_str:
            tags = [t.strip() for t in tags_str.split(",") if t.strip()]
        
        photo_id = generate_record_id("PHOTO", line_number)
        
        return PhotoRecord(
            photo_id=photo_id,
            box_id=self._get_field(row, "box_id") or None,
            route_node_id=self._get_field(row, "route_node") or None,
            filename=filename,
            file_path=None,
            photo_type=photo_type,
            timestamp=timestamp,
            location=self._get_field(row, "location") or None,
            photographer=self._get_field(row, "photographer") or None,
            description=self._get_field(row, "description") or None,
            tags=tags,
            source_list=source_file,
            line_number=line_number,
        )
    
    def _parse_photo_type(self, value: str) -> PhotoType:
        """解析照片类型"""
        mapping = {
            "loading_start": PhotoType.LOADING_START,
            "开始装车": PhotoType.LOADING_START,
            "装车开始": PhotoType.LOADING_START,
            "loading_end": PhotoType.LOADING_END,
            "结束装车": PhotoType.LOADING_END,
            "装车结束": PhotoType.LOADING_END,
            "box_closed": PhotoType.BOX_CLOSED,
            "箱体关闭": PhotoType.BOX_CLOSED,
            "封箱": PhotoType.BOX_CLOSED,
            "seal_intact": PhotoType.SEAL_INTACT,
            "封条完好": PhotoType.SEAL_INTACT,
            "封条完整": PhotoType.SEAL_INTACT,
            "transit": PhotoType.TRANSIT,
            "运输中": PhotoType.TRANSIT,
            "途中": PhotoType.TRANSIT,
            "unloading_start": PhotoType.UNLOADING_START,
            "开始卸车": PhotoType.UNLOADING_START,
            "卸车开始": PhotoType.UNLOADING_START,
            "unloading_end": PhotoType.UNLOADING_END,
            "结束卸车": PhotoType.UNLOADING_END,
            "卸车结束": PhotoType.UNLOADING_END,
            "arrival": PhotoType.ARRIVAL,
            "到达": PhotoType.ARRIVAL,
            "抵达": PhotoType.ARRIVAL,
            "opening_start": PhotoType.OPENING_START,
            "开始开箱": PhotoType.OPENING_START,
            "开箱开始": PhotoType.OPENING_START,
            "opening_end": PhotoType.OPENING_END,
            "结束开箱": PhotoType.OPENING_END,
            "开箱结束": PhotoType.OPENING_END,
            "condition_check": PhotoType.CONDITION_CHECK,
            "状态检查": PhotoType.CONDITION_CHECK,
            "状况检查": PhotoType.CONDITION_CHECK,
            "damage": PhotoType.DAMAGE,
            "损坏": PhotoType.DAMAGE,
            "破损": PhotoType.DAMAGE,
            "seal_broken": PhotoType.SEAL_BROKEN,
            "封条破损": PhotoType.SEAL_BROKEN,
            "封条损坏": PhotoType.SEAL_BROKEN,
            "signature": PhotoType.SIGNATURE,
            "签字": PhotoType.SIGNATURE,
            "签名": PhotoType.SIGNATURE,
            "handover": PhotoType.HANDOVER,
            "交接": PhotoType.HANDOVER,
            "移交": PhotoType.HANDOVER,
            "other": PhotoType.OTHER,
            "其他": PhotoType.OTHER,
        }
        return mapping.get(value.lower(), PhotoType.OTHER)


def parse_photo_csv(
    file_path: str | Path,
    box_ids: list[str] | None = None,
) -> ParserResult[PhotoRecord]:
    """便捷函数：解析照片清单CSV文件"""
    parser = PhotoCSVParser()
    return parser.parse(file_path, box_ids)
