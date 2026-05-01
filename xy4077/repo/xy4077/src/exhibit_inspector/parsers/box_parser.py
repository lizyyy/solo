"""展箱清单CSV解析器"""

from __future__ import annotations

import csv
from pathlib import Path

from ..models import BoxInfo, BoxStatus
from .base import ParserResult, ValidationError
from .utils import generate_record_id


class BoxCSVParser:
    """展箱清单CSV解析器"""
    
    EXPECTED_HEADERS = [
        ["box_id", "箱号", "展箱编号", "箱编号"],
        ["box_name", "箱名", "展箱名称"],
        ["box_type", "类型", "展箱类型"],
        ["weight_kg", "重量", "重量(kg)"],
        ["dimensions", "尺寸"],
        ["sensor_ids", "传感器", "传感器编号"],
        ["contents", "展品", "箱内展品"],
        ["special_requirements", "特殊要求"],
        ["status", "状态"],
    ]
    
    def __init__(self):
        self.header_mapping: dict[str, str] = {}
    
    def parse(self, file_path: str | Path, shipment_id: str | None = None) -> ParserResult[BoxInfo]:
        """解析展箱清单CSV文件"""
        file_path = Path(file_path)
        result = ParserResult[BoxInfo](source_file=str(file_path))
        
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
                        box = self._parse_row(row, row_idx, str(file_path), shipment_id)
                        result.data.append(box)
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
        shipment_id: str | None = None,
    ) -> BoxInfo:
        """解析单行数据"""
        box_id = self._get_field(row, "box_id")
        if not box_id:
            raise ValidationError(
                message="展箱编号不能为空",
                field="box_id",
                line_number=line_number,
                source_file=source_file,
            )
        
        sensor_ids_str = self._get_field(row, "sensor_ids")
        sensor_ids = []
        if sensor_ids_str:
            sensor_ids = [s.strip() for s in sensor_ids_str.split(",") if s.strip()]
        
        contents_str = self._get_field(row, "contents")
        contents = []
        if contents_str:
            contents = [c.strip() for c in contents_str.split(",") if c.strip()]
        
        weight_str = self._get_field(row, "weight_kg")
        weight_kg = None
        if weight_str:
            try:
                weight_kg = float(weight_str)
            except ValueError:
                pass
        
        status_str = self._get_field(row, "status")
        status = self._parse_status(status_str)
        
        return BoxInfo(
            box_id=box_id,
            shipment_id=shipment_id or "UNKNOWN",
            box_name=self._get_field(row, "box_name") or None,
            box_type=self._get_field(row, "box_type") or None,
            weight_kg=weight_kg,
            dimensions_cm=self._get_field(row, "dimensions") or None,
            sensor_ids=sensor_ids,
            contents=contents,
            special_requirements=self._get_field(row, "special_requirements") or None,
            status=status,
        )
    
    def _parse_status(self, value: str) -> BoxStatus:
        """解析展箱状态"""
        mapping = {
            "pending": BoxStatus.PENDING,
            "待处理": BoxStatus.PENDING,
            "未开始": BoxStatus.PENDING,
            "in_transit": BoxStatus.IN_TRANSIT,
            "运输中": BoxStatus.IN_TRANSIT,
            "途中": BoxStatus.IN_TRANSIT,
            "arrived": BoxStatus.ARRIVED,
            "已到达": BoxStatus.ARRIVED,
            "到达": BoxStatus.ARRIVED,
            "opened": BoxStatus.OPENED,
            "已开箱": BoxStatus.OPENED,
            "开箱": BoxStatus.OPENED,
            "inspected": BoxStatus.INSPECTED,
            "已检验": BoxStatus.INSPECTED,
            "检验": BoxStatus.INSPECTED,
            "completed": BoxStatus.COMPLETED,
            "已完成": BoxStatus.COMPLETED,
            "完成": BoxStatus.COMPLETED,
        }
        return mapping.get(value.lower(), BoxStatus.PENDING)


def parse_box_csv(
    file_path: str | Path,
    shipment_id: str | None = None,
) -> ParserResult[BoxInfo]:
    """便捷函数：解析展箱清单CSV文件"""
    parser = BoxCSVParser()
    return parser.parse(file_path, shipment_id)
