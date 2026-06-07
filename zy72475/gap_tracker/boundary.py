import yaml
from typing import Dict, List, Optional, Tuple
import difflib


class BoundaryRules:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)
        self.rules = self.config["boundary_rules"]
        self.alias_mapping = self.rules["same_community_detection"]["alias_mapping"]
        self.similarity_threshold = self.rules["same_community_detection"]["similarity_threshold"]
        self.status_workflow = self.rules["status_workflow"]
        self.immutable_fields = self.rules["fields"]["immutable_after_import"]
        self.track_history_fields = self.rules["fields"]["track_history"]

    def normalize_community_name(self, name: str) -> str:
        return self.alias_mapping.get(name, name)

    def is_same_community(self, name1: str, name2: str) -> Tuple[bool, str]:
        norm1 = self.normalize_community_name(name1)
        norm2 = self.normalize_community_name(name2)

        if norm1 == norm2:
            return True, "精确匹配别名映射"

        similarity = difflib.SequenceMatcher(None, norm1, norm2).ratio()
        if similarity >= self.similarity_threshold:
            return True, f"相似度{similarity:.2f}达到阈值{self.similarity_threshold}"

        return False, ""

    def can_transition_status(self, current_status: str, target_status: str, role: str) -> Tuple[bool, str]:
        steps = self.status_workflow["steps"]
        if current_status not in steps:
            return False, f"当前状态 {current_status} 不在工作流中"

        current_step = steps[current_status]
        if target_status not in current_step["next"]:
            return False, f"从 {current_status} 不能直接转到 {target_status}，允许的目标: {current_step['next']}"

        if role not in current_step["allowed_roles"]:
            return False, f"角色 {role} 无权执行此状态变更，允许的角色: {current_step['allowed_roles']}"

        return True, ""

    def is_field_immutable(self, field_name: str) -> bool:
        return field_name in self.immutable_fields

    def should_track_history(self, field_name: str) -> bool:
        return field_name in self.track_history_fields

    def get_workflow_summary(self) -> str:
        lines = ["=== 地下通道导视缺口 状态工作流 ==="]
        lines.append(f"初始状态: {self.status_workflow['initial']}")
        lines.append("")
        for status, config in self.status_workflow["steps"].items():
            next_steps = config["next"] if config["next"] else ["(终态)"]
            lines.append(f"  {status}:")
            lines.append(f"    可转到: {', '.join(next_steps)}")
            lines.append(f"    允许角色: {', '.join(config['allowed_roles'])}")
        lines.append("")
        lines.append("=== 同小区新旧名称判定规则 ===")
        lines.append(f"相似度阈值: {self.similarity_threshold}")
        lines.append("别名映射:")
        for alias, canonical in self.alias_mapping.items():
            lines.append(f"  {alias} → {canonical}")
        return "\n".join(lines)

    def get_rollback_guide(self) -> str:
        return """
=== 回滚操作指南 ===
1. 查看变更历史: gap history <complaint_id>
2. 找到要回滚的 history_id
3. 执行回滚: gap rollback <history_id>
4. 回滚会生成一条新的历史记录，标注为回滚操作

注意: 
- 不可变字段(complaint_id, original_line_number, import_timestamp)永不回滚
- 回滚操作本身也会被记录，保证审计链完整
"""
