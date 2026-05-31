from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Tuple
import json
import csv
from datetime import datetime
from ..models.unit_table import UnitTable, Unit, UnitAttribute
from ..models.base import VersionInfo
from ..errors.friendly_errors import ParseError, error_context


@dataclass
class ParseWarning:
    """解析警告，非致命错误"""
    field_path: str
    message: str
    suggestion: str = ""


class UnitTableParser:
    """单位表解析器，支持CSV、JSON、纯文本格式"""

    # 字段人话映射
    FIELD_HUMAN_NAMES = {
        "unit_id": "单位编号",
        "unit_name": "单位名称",
        "unit_type": "单位类型",
        "hp": "生命值",
        "atk": "攻击力",
        "def": "防御力",
        "spd": "速度",
        "skills": "技能列表",
        "position": "场上位置",
    }

    # 同义词映射，容忍不同的列名
    FIELD_SYNONYMS = {
        "unit_id": ["id", "编号", "单位id", "unitid", "uid"],
        "unit_name": ["name", "名称", "名字", "单位名", "单位名称"],
        "unit_type": ["type", "类型", "种类", "单位类型"],
        "hp": ["生命值", "血量", "体力", "hit_point", "health"],
        "atk": ["攻击力", "攻击", "attack"],
        "def": ["防御力", "防御", "defence", "defense"],
        "spd": ["速度", "移动速度", "speed"],
        "skills": ["技能", "技能列表", "skill", "skill_list"],
        "position": ["位置", "场上位置", "pos", "位置类型"],
    }

    def __init__(self):
        self.warnings: List[ParseWarning] = []

    def _normalize_field_name(self, raw_name: str) -> Tuple[str, str]:
        """将原始字段名标准化，返回(标准字段名, 人话名称)"""
        raw_lower = raw_name.strip().lower()

        for standard_name, synonyms in self.FIELD_SYNONYMS.items():
            if raw_lower in [s.lower() for s in synonyms] or raw_lower == standard_name:
                human_name = self.FIELD_HUMAN_NAMES.get(standard_name, raw_name)
                return standard_name, human_name

        return raw_name, raw_name

    def parse(self, content: str, file_type: str, version: VersionInfo) -> Tuple[UnitTable, List[ParseWarning]]:
        """解析单位表内容"""
        self.warnings = []
        raw_content = content

        try:
            if file_type == "json":
                units = self._parse_json(content)
            elif file_type == "csv":
                units = self._parse_csv(content)
            elif file_type in ["txt", "text"]:
                units = self._parse_text(content)
            else:
                raise ParseError(
                    message=f"不支持的文件格式：{file_type}",
                    suggestion="请使用 CSV、JSON 或纯文本格式的单位表",
                    field_path="file_type",
                    raw_value=file_type
                )

            table = UnitTable(
                table_id=f"unit_table_{version.version_id}",
                version=version,
                units=units,
                raw_content=raw_content
            )

            return table, self.warnings

        except ParseError:
            raise
        except Exception as e:
            raise ParseError(
                message=f"解析单位表时出错：{str(e)}",
                suggestion="请检查文件格式是否正确，内容是否完整",
                field_path="unit_table.content",
                raw_value=content[:200] + "..." if len(content) > 200 else content
            ) from e

    def _parse_json(self, content: str) -> Dict[str, Unit]:
        """解析JSON格式"""
        with error_context("单位表JSON解析"):
            data = json.loads(content)
            units_data = data.get("units", data) if isinstance(data, dict) else data

            if not isinstance(units_data, list):
                raise ParseError(
                    message="JSON格式错误：期望单位列表",
                    suggestion="请确保JSON包含一个单位数组，字段名为 units 或直接是数组",
                    field_path="$.units",
                    raw_value=str(type(units_data))
                )

            return self._build_units(units_data)

    def _parse_csv(self, content: str) -> Dict[str, Unit]:
        """解析CSV格式"""
        with error_context("单位表CSV解析"):
            lines = content.strip().splitlines()
            reader = csv.DictReader(lines)
            fieldnames = reader.fieldnames or []

            normalized_fields = {}
            for field in fieldnames:
                std_name, human_name = self._normalize_field_name(field)
                normalized_fields[field] = (std_name, human_name)

            units_data = []
            for row_num, row in enumerate(reader, start=2):
                unit_data = {}
                for orig_field, (std_name, human_name) in normalized_fields.items():
                    value = row.get(orig_field, "")
                    if value:
                        unit_data[std_name] = value
                units_data.append(unit_data)

            return self._build_units(units_data)

    def _parse_text(self, content: str) -> Dict[str, Unit]:
        """解析纯文本格式"""
        with error_context("单位表文本解析"):
            units_data = []
            current_unit = None

            for line_num, line in enumerate(content.strip().splitlines(), start=1):
                line = line.strip()
                if not line:
                    if current_unit:
                        units_data.append(current_unit)
                        current_unit = None
                    continue

                if ":" in line or "：" in line:
                    sep = ":" if ":" in line else "："
                    key, value = line.split(sep, 1)
                    key = key.strip()
                    value = value.strip()

                    std_name, human_name = self._normalize_field_name(key)

                    if std_name in ["unit_id", "id"] and current_unit is None:
                        current_unit = {}

                    if current_unit is not None:
                        current_unit[std_name] = value
                    else:
                        self.warnings.append(ParseWarning(
                            field_path=f"line_{line_num}",
                            message=f"第{line_num}行：'{key}' 在单位定义之外，已忽略",
                            suggestion="请确保每个单位以编号或ID开头"
                        ))

            if current_unit:
                units_data.append(current_unit)

            return self._build_units(units_data)

    def _build_units(self, units_data: List[Dict[str, Any]]) -> Dict[str, Unit]:
        """构建单位对象列表"""
        units: Dict[str, Unit] = {}

        for idx, data in enumerate(units_data):
            unit_id = data.get("unit_id") or data.get("id")

            if not unit_id:
                self.warnings.append(ParseWarning(
                    field_path=f"units[{idx}].unit_id",
                    message=f"第{idx+1}个单位缺少编号，已跳过",
                    suggestion="请给每个单位添加 unit_id 或 编号 字段"
                ))
                continue

            if unit_id in units:
                self.warnings.append(ParseWarning(
                    field_path=f"units[{idx}].unit_id",
                    message=f"单位编号重复：{unit_id}，后出现的将覆盖先出现的",
                    suggestion="请检查并修正重复的单位编号"
                ))

            unit_name = data.get("unit_name") or data.get("name") or f"单位{unit_id}"
            unit_type = data.get("unit_type") or data.get("type") or "未知类型"

            attributes: Dict[str, UnitAttribute] = {}
            for key, value in data.items():
                if key in ["unit_id", "unit_name", "unit_type", "id", "name", "type"]:
                    continue

                if key == "skills":
                    continue

                _, human_name = self._normalize_field_name(key)
                attributes[key] = UnitAttribute(
                    name=key,
                    value=self._parse_value(value),
                    display_name=human_name
                )

            skills_str = data.get("skills", "")
            skills = [s.strip() for s in str(skills_str).split(",") if s.strip()] if skills_str else []

            units[unit_id] = Unit(
                unit_id=unit_id,
                unit_name=unit_name,
                unit_type=unit_type,
                attributes=attributes,
                skills=skills
            )

        return units

    def _parse_value(self, value: str) -> Any:
        """尝试解析值的类型"""
        if value is None:
            return None

        value_str = str(value).strip()

        try:
            if "." in value_str:
                return float(value_str)
            return int(value_str)
        except ValueError:
            return value_str
