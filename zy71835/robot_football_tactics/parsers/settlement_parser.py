from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Tuple
import json
from datetime import datetime
from ..models.battle_settlement import BattleSettlement, SettlementItem
from ..models.base import VersionInfo
from ..errors.friendly_errors import ParseError, error_context


@dataclass
class ParseWarning:
    field_path: str
    message: str
    suggestion: str = ""


class BattleSettlementParser:
    """结算解析器"""

    FIELD_HUMAN_NAMES = {
        "item_id": "结算项编号",
        "item_name": "结算项名称",
        "unit_id": "单位编号",
        "value": "结算值",
        "expected_value": "期望值",
    }

    def __init__(self):
        self.warnings: List[ParseWarning] = []

    def parse(self, content: str, file_type: str, version: VersionInfo) -> Tuple[BattleSettlement, List[ParseWarning]]:
        self.warnings = []
        raw_content = content

        try:
            if file_type == "json":
                data = self._parse_json(content)
            elif file_type == "txt":
                data = self._parse_text(content)
            else:
                raise ParseError(
                    message=f"不支持的结算格式：{file_type}",
                    suggestion="请使用 JSON 或纯文本格式的结算数据",
                    field_path="file_type",
                    raw_value=file_type
                )

            return BattleSettlement(
                settlement_id=f"settlement_{version.version_id}",
                version=version,
                match_name=data.get("match_name", f"结算_{version.version_id}"),
                final_score=data.get("final_score", {}),
                mvp_unit_id=data.get("mvp_unit_id"),
                items=data.get("items", []),
                raw_content=raw_content,
                calculation_log=data.get("calculation_log", "")
            ), self.warnings

        except ParseError:
            raise
        except Exception as e:
            raise ParseError(
                message=f"解析结算数据时出错：{str(e)}",
                suggestion="请检查结算数据格式是否正确",
                field_path="battle_settlement.content",
                raw_value=content[:200] + "..." if len(content) > 200 else content
            ) from e

    def _parse_json(self, content: str) -> Dict[str, Any]:
        with error_context("结算JSON解析"):
            data = json.loads(content)

            items_data = data.get("items", [])
            items = self._build_items(items_data)

            return {
                "match_name": data.get("match_name", data.get("name", "")),
                "final_score": data.get("final_score", data.get("score", {})),
                "mvp_unit_id": data.get("mvp_unit_id", data.get("mvp")),
                "items": items,
                "calculation_log": data.get("calculation_log", data.get("log", ""))
            }

    def _parse_text(self, content: str) -> Dict[str, Any]:
        with error_context("结算文本解析"):
            lines = content.strip().splitlines()
            items_data = []
            final_score = {}
            match_name = ""
            mvp = None
            current_item = None
            in_calc_log = False
            calc_log_lines = []

            for line_num, line in enumerate(lines, start=1):
                line = line.strip()
                if not line:
                    if current_item:
                        items_data.append(current_item)
                        current_item = None
                    continue

                if line.startswith("--- 计算日志 ---") or line.startswith("计算日志："):
                    in_calc_log = True
                    if current_item:
                        items_data.append(current_item)
                        current_item = None
                    continue

                if in_calc_log:
                    calc_log_lines.append(line)
                    continue

                if line.startswith("#") or line.startswith("比赛"):
                    match_name = line.lstrip("#").strip()
                    continue

                if line.startswith("比分：") or line.startswith("比分:"):
                    score_str = line.split("：", 1)[1].strip() if "：" in line else line.split(":", 1)[1].strip()
                    parts = score_str.replace(" ", "").split("-")
                    if len(parts) == 2:
                        try:
                            final_score["team_a"] = int(parts[0])
                            final_score["team_b"] = int(parts[1])
                        except ValueError:
                            self.warnings.append(ParseWarning(
                                field_path=f"line_{line_num}",
                                message=f"第{line_num}行：比分格式不正确：{score_str}",
                                suggestion="比分格式应为：队伍A-队伍B，如 2-1"
                            ))
                    continue

                if line.startswith("MVP：") or line.startswith("MVP:"):
                    mvp_str = line.split("：", 1)[1].strip() if "：" in line else line.split(":", 1)[1].strip()
                    mvp = mvp_str
                    continue

                if ":" in line or "：" in line:
                    sep = ":" if ":" in line else "："
                    key, value = line.split(sep, 1)
                    key = key.strip()
                    value = value.strip()

                    if key in ["结算项", "项目", "item"]:
                        if current_item:
                            items_data.append(current_item)
                        current_item = {"item_name": value}
                    elif current_item is not None:
                        if key == "单位" or key == "unit_id":
                            current_item["unit_id"] = value
                        elif key == "值" or key == "value" or key == "结果":
                            try:
                                if "." in value:
                                    current_item["value"] = float(value)
                                else:
                                    current_item["value"] = int(value)
                            except ValueError:
                                current_item["value"] = value
                        elif key == "编号" or key == "item_id":
                            current_item["item_id"] = value
                        elif key == "期望" or key == "expected":
                            try:
                                if "." in value:
                                    current_item["expected_value"] = float(value)
                                else:
                                    current_item["expected_value"] = int(value)
                            except ValueError:
                                current_item["expected_value"] = value

            if current_item:
                items_data.append(current_item)

            items = self._build_items(items_data)

            return {
                "match_name": match_name,
                "final_score": final_score,
                "mvp_unit_id": mvp,
                "items": items,
                "calculation_log": "\n".join(calc_log_lines)
            }

    def _build_items(self, items_data: List[Dict[str, Any]]) -> List[SettlementItem]:
        items: List[SettlementItem] = []

        for idx, data in enumerate(items_data):
            item_id = data.get("item_id") or f"ITEM{idx+1:03d}"
            item_name = data.get("item_name") or f"结算项{idx+1}"
            unit_id = data.get("unit_id") or "UNKNOWN"
            value = data.get("value")

            if value is None:
                self.warnings.append(ParseWarning(
                    field_path=f"items[{idx}].value",
                    message=f"结算项'{item_name}'缺少结算值",
                    suggestion="请确保每个结算项都有 value 字段"
                ))
                value = 0

            items.append(SettlementItem(
                item_id=item_id,
                item_name=item_name,
                unit_id=unit_id,
                value=value,
                expected_value=data.get("expected_value"),
                calculation_details=data.get("calculation_details", {})
            ))

        return items
