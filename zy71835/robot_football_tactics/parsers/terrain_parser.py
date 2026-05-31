from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Tuple
import json
import re
from datetime import datetime
from ..models.terrain_rules import TerrainRules, TerrainRule, TerrainEffect
from ..models.base import VersionInfo
from ..errors.friendly_errors import ParseError, error_context


@dataclass
class ParseWarning:
    field_path: str
    message: str
    suggestion: str = ""


class TerrainRulesParser:
    """地形规则解析器"""

    FIELD_HUMAN_NAMES = {
        "rule_id": "规则编号",
        "terrain_name": "地形名称",
        "terrain_type": "地形类型",
        "effect_id": "效果编号",
        "effect_name": "效果名称",
        "target_attr": "影响属性",
        "modifier": "修正值",
        "condition": "触发条件",
        "description": "规则说明",
    }

    FIELD_SYNONYMS = {
        "rule_id": ["id", "规则编号", "ruleid", "rid"],
        "terrain_name": ["name", "名称", "地形名称", "地形名"],
        "terrain_type": ["type", "类型", "地形类型", "地形种类"],
        "effect_id": ["效果id", "effectid", "eid"],
        "effect_name": ["效果", "效果名", "效果名称"],
        "target_attr": ["影响属性", "目标属性", "属性", "attr", "attribute"],
        "modifier": ["修正", "修正值", "数值", "值", "value"],
        "condition": ["条件", "触发条件", "cond", "触发"],
        "description": ["说明", "描述", "desc", "备注"],
    }

    def __init__(self):
        self.warnings: List[ParseWarning] = []

    def _normalize_field_name(self, raw_name: str) -> Tuple[str, str]:
        raw_lower = raw_name.strip().lower()
        for standard_name, synonyms in self.FIELD_SYNONYMS.items():
            if raw_lower in [s.lower() for s in synonyms] or raw_lower == standard_name:
                human_name = self.FIELD_HUMAN_NAMES.get(standard_name, raw_name)
                return standard_name, human_name
        return raw_name, raw_name

    def parse(self, content: str, file_type: str, version: VersionInfo) -> Tuple[TerrainRules, List[ParseWarning]]:
        self.warnings = []
        raw_content = content

        try:
            if file_type == "json":
                rules = self._parse_json(content)
            elif file_type == "txt":
                rules = self._parse_text(content)
            else:
                raise ParseError(
                    message=f"不支持的地形规则格式：{file_type}",
                    suggestion="请使用 JSON 或纯文本格式的地形规则",
                    field_path="file_type",
                    raw_value=file_type
                )

            return TerrainRules(
                rules_id=f"terrain_{version.version_id}",
                version=version,
                rules=rules,
                raw_content=raw_content
            ), self.warnings

        except ParseError:
            raise
        except Exception as e:
            raise ParseError(
                message=f"解析地形规则时出错：{str(e)}",
                suggestion="请检查地形规则格式是否正确",
                field_path="terrain_rules.content",
                raw_value=content[:200] + "..." if len(content) > 200 else content
            ) from e

    def _parse_json(self, content: str) -> Dict[str, TerrainRule]:
        with error_context("地形规则JSON解析"):
            data = json.loads(content)
            rules_data = data.get("rules", data) if isinstance(data, dict) else data

            if not isinstance(rules_data, list):
                raise ParseError(
                    message="JSON格式错误：期望规则列表",
                    suggestion="请确保JSON包含一个规则数组",
                    field_path="$.rules",
                    raw_value=str(type(rules_data))
                )

            return self._build_rules(rules_data)

    def _parse_text(self, content: str) -> Dict[str, TerrainRule]:
        with error_context("地形规则文本解析"):
            rules_data = []
            current_rule = None
            current_effect = None

            for line_num, line in enumerate(content.strip().splitlines(), start=1):
                line = line.strip()
                if not line:
                    if current_effect and current_rule:
                        current_rule.setdefault("effects", []).append(current_effect)
                        current_effect = None
                    if current_rule:
                        rules_data.append(current_rule)
                        current_rule = None
                    continue

                if re.match(r"^[-=]+$", line):
                    continue

                if ":" in line or "：" in line:
                    sep = ":" if ":" in line else "："
                    key, value = line.split(sep, 1)
                    key = key.strip()
                    value = value.strip()

                    std_name, human_name = self._normalize_field_name(key)

                    if std_name in ["rule_id", "terrain_name"] and current_rule is None:
                        current_rule = {}
                        current_effect = None

                    if std_name in ["effect_id", "effect_name"]:
                        if current_effect and current_rule:
                            current_rule.setdefault("effects", []).append(current_effect)
                        current_effect = {}

                    if current_effect is not None:
                        current_effect[std_name] = value
                    elif current_rule is not None:
                        if std_name == "effects":
                            continue
                        current_rule[std_name] = value
                    else:
                        self.warnings.append(ParseWarning(
                            field_path=f"line_{line_num}",
                            message=f"第{line_num}行：'{key}' 在规则定义之外，已忽略",
                            suggestion="请确保每条规则以规则编号或地形名称开头"
                        ))

            if current_effect and current_rule:
                current_rule.setdefault("effects", []).append(current_effect)
            if current_rule:
                rules_data.append(current_rule)

            return self._build_rules(rules_data)

    def _build_rules(self, rules_data: List[Dict[str, Any]]) -> Dict[str, TerrainRule]:
        rules: Dict[str, TerrainRule] = {}

        for idx, data in enumerate(rules_data):
            rule_id = data.get("rule_id") or data.get("id") or f"TR{idx+1:03d}"
            terrain_name = data.get("terrain_name") or data.get("name") or f"地形{rule_id}"
            terrain_type = data.get("terrain_type") or data.get("type") or "通用"

            effects_data = data.get("effects", [])
            effects = []

            for e_idx, e_data in enumerate(effects_data):
                if isinstance(e_data, dict):
                    effect_id = e_data.get("effect_id") or f"E{e_idx+1:03d}"
                    effect_name = e_data.get("effect_name") or e_data.get("name") or "未命名效果"
                    target_attr = e_data.get("target_attr") or e_data.get("attr") or ""
                    modifier = e_data.get("modifier")
                    condition = e_data.get("condition") or ""

                    if modifier is not None:
                        try:
                            modifier = float(modifier)
                        except (ValueError, TypeError):
                            self.warnings.append(ParseWarning(
                                field_path=f"rules[{idx}].effects[{e_idx}].modifier",
                                message=f"规则'{terrain_name}'的效果'{effect_name}'修正值格式不正确：{modifier}",
                                suggestion="修正值应该是数字（如 +10, -5, 0.5）"
                            ))
                            modifier = 0

                    effects.append(TerrainEffect(
                        effect_id=effect_id,
                        effect_name=effect_name,
                        target_attr=target_attr,
                        modifier=modifier,
                        condition=condition
                    ))

            rules[rule_id] = TerrainRule(
                rule_id=rule_id,
                terrain_name=terrain_name,
                terrain_type=terrain_type,
                effects=effects,
                description=data.get("description", "")
            )

        return rules
