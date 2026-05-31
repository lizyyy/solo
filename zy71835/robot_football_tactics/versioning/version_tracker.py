from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple, TypeVar, Generic
from datetime import datetime
import hashlib
import copy
from ..models.base import VersionInfo, ChangeRecord
from ..models.unit_table import UnitTable
from ..models.terrain_rules import TerrainRules
from ..models.battle_report import BattleReport
from ..models.battle_settlement import BattleSettlement
from ..errors.friendly_errors import VersionConflict, FriendlyError, ErrorCollector, translate_field


T = TypeVar('T')


MATERIAL_ONLY_FIELDS = {
    "unit_table": ["unit_name", "unit_type", "display_name", "description", "comment"],
    "terrain_rules": ["description", "terrain_name", "display_name"],
    "battle_report": ["raw_text", "description", "comment"],
    "battle_settlement": ["calculation_log", "description", "comment"],
}

CONCLUSION_AFFECTING_FIELDS = {
    "unit_table": ["hp", "atk", "def", "spd", "skills", "attributes"],
    "terrain_rules": ["modifier", "target_attr", "condition", "effects"],
    "battle_report": ["event_type", "result", "details", "events", "timestamp", "manual_modified"],
    "battle_settlement": ["value", "final_score", "items", "mvp_unit_id"],
}


def get_field_category(field_path: str, doc_type: str) -> str:
    """判断字段属于哪一类"""
    for material_field in MATERIAL_ONLY_FIELDS.get(doc_type, []):
        if material_field in field_path:
            return "material"

    for conclusion_field in CONCLUSION_AFFECTING_FIELDS.get(doc_type, []):
        if conclusion_field in field_path:
            return "conclusion"

    return "unknown"


def describe_change(field_path: str, old_value: Any, new_value: Any, doc_type: str) -> Tuple[str, bool, str]:
    """
    生成人类可读的变更描述

    Returns:
        (human_description, affects_conclusion, change_type)
    """
    category = get_field_category(field_path, doc_type)
    human_field = translate_field(field_path)

    if category == "material":
        desc = f"{human_field} 从 '{old_value}' 更新为 '{new_value}'"
        affects = False
        change_type = "material"
    elif category == "conclusion":
        desc = f"{human_field} 从 {old_value} 改为 {new_value}（可能影响结论）"
        affects = True
        change_type = "conclusion"
    else:
        desc = f"{human_field} 从 {old_value} 变为 {new_value}"
        affects = True
        change_type = "unknown"

    return desc, affects, change_type


def deep_diff(old_obj: Any, new_obj: Any, path: str = "", doc_type: str = "") -> List[ChangeRecord]:
    """深度比较两个对象，返回变更记录列表"""
    changes: List[ChangeRecord] = []

    if old_obj == new_obj:
        return changes

    if isinstance(old_obj, dict) and isinstance(new_obj, dict):
        all_keys = set(old_obj.keys()) | set(new_obj.keys())
        for key in all_keys:
            new_path = f"{path}.{key}" if path else key
            if key not in old_obj:
                human_desc, affects, change_type = describe_change(new_path, "<不存在>", new_obj[key], doc_type)
                changes.append(ChangeRecord(
                    field_path=new_path,
                    old_value=None,
                    new_value=new_obj[key],
                    change_type=change_type,
                    human_description=human_desc,
                    affects_conclusion=affects
                ))
            elif key not in new_obj:
                human_desc, affects, change_type = describe_change(new_path, old_obj[key], "<已删除>", doc_type)
                changes.append(ChangeRecord(
                    field_path=new_path,
                    old_value=old_obj[key],
                    new_value=None,
                    change_type=change_type,
                    human_description=human_desc,
                    affects_conclusion=affects
                ))
            else:
                changes.extend(deep_diff(old_obj[key], new_obj[key], new_path, doc_type))
    elif isinstance(old_obj, list) and isinstance(new_obj, list):
        max_len = max(len(old_obj), len(new_obj))
        for i in range(max_len):
            new_path = f"{path}[{i}]"
            if i >= len(old_obj):
                human_desc, affects, change_type = describe_change(new_path, "<不存在>", new_obj[i], doc_type)
                changes.append(ChangeRecord(
                    field_path=new_path,
                    old_value=None,
                    new_value=new_obj[i],
                    change_type=change_type,
                    human_description=human_desc,
                    affects_conclusion=affects
                ))
            elif i >= len(new_obj):
                human_desc, affects, change_type = describe_change(new_path, old_obj[i], "<已删除>", doc_type)
                changes.append(ChangeRecord(
                    field_path=new_path,
                    old_value=old_obj[i],
                    new_value=None,
                    change_type=change_type,
                    human_description=human_desc,
                    affects_conclusion=affects
                ))
            else:
                changes.extend(deep_diff(old_obj[i], new_obj[i], new_path, doc_type))
    elif hasattr(old_obj, '__dict__') and hasattr(new_obj, '__dict__'):
        changes.extend(deep_diff(old_obj.__dict__, new_obj.__dict__, path, doc_type))
    else:
        human_desc, affects, change_type = describe_change(path, old_obj, new_obj, doc_type)
        changes.append(ChangeRecord(
            field_path=path,
            old_value=old_obj,
            new_value=new_obj,
            change_type=change_type,
            human_description=human_desc,
            affects_conclusion=affects
        ))

    return changes


def to_diffable(obj: Any) -> Any:
    """把对象转换成可比较的形式（排除版本信息等不比较的字段"""
    if isinstance(obj, dict):
        return {k: to_diffable(v) for k, v in obj.items() if k not in ["version", "version_id", "submitted_at", "submitted_by", "comment", "raw_content", "_id"]}
    elif isinstance(obj, list):
        return [to_diffable(item) for item in obj]
    elif hasattr(obj, '__dict__'):
        result = {}
        for k, v in obj.__dict__.items():
            if k not in ["version", "version_id", "submitted_at", "submitted_by", "comment", "raw_content", "_id", "table_id", "rules_id", "report_id", "settlement_id"]:
                result[k] = to_diffable(v)
        return result
    else:
        return copy.deepcopy(obj)


@dataclass
class VersionHistory(Generic[T]):
    """某份文档的版本历史"""
    doc_type: str
    doc_name: str
    versions: List[Tuple[VersionInfo, T]] = field(default_factory=list)
    change_history: List[List[ChangeRecord]] = field(default_factory=list)

    def add_version(self, version: VersionInfo, document: T, is_material_only: bool = False) -> Tuple[bool, List[ChangeRecord]]:
        """
        添加新版本，返回（是否是新版本，变更记录列表）
        如果是补材料版本，标记为 material_only
        """
        if not self.versions:
            self.versions.append((version, document))
            self.change_history.append([])
            return True, []

        last_version, last_doc = self.versions[-1]

        old_diffable = to_diffable(last_doc)
        new_diffable = to_diffable(document)

        changes = deep_diff(old_diffable, new_diffable, doc_type=self.doc_type)

        if not changes:
            return False, []

        if is_material_only:
            for change in changes:
                if change.affects_conclusion:
                    change.affects_conclusion = False
                    change.change_type = "material"
                    change.human_description += "（已标记为补材料，不影响结论）"

        version.is_material_only = is_material_only
        self.versions.append((version, document))
        self.change_history.append(changes)

        return True, changes

    def get_latest(self) -> Optional[Tuple[VersionInfo, T]]:
        """获取最新版本"""
        return self.versions[-1] if self.versions else None

    def get_version(self, version_id: str) -> Optional[Tuple[VersionInfo, T]]:
        """根据版本ID获取版本"""
        for v, doc in self.versions:
            if v.version_id == version_id:
                return v, doc
        return None

    def get_changes_between(self, old_version_id: str, new_version_id: str) -> List[ChangeRecord]:
        """获取两个版本之间的变更"""
        old_doc = None
        new_doc = None

        for v, doc in self.versions:
            if v.version_id == old_version_id:
                old_doc = doc
            if v.version_id == new_version_id:
                new_doc = doc

        if old_doc is None or new_doc is None:
            return []

        return deep_diff(to_diffable(old_doc), to_diffable(new_doc), doc_type=self.doc_type)

    def has_conclusion_changes(self) -> bool:
        """检查是否有影响结论的变更"""
        return any(
            any(change.affects_conclusion for change in changes)
            for changes in self.change_history
        )

    def summarize_changes(self) -> Dict[str, int]:
        """统计变更类型"""
        stats = {"material": 0, "conclusion": 0, "unknown": 0}
        for changes in self.change_history:
            for change in changes:
                stats[change.change_type] += 1
        return stats


class VersionTracker:
    """版本追踪器，追踪所有文档的版本历史"""

    def __init__(self):
        self._histories: Dict[str, VersionHistory] = {}
        self._errors = ErrorCollector()

    def _get_key(self, doc_type: str, doc_name: str) -> str:
        return f"{doc_type}:{doc_name}"

    def add_document(
        self,
        doc_type: str,
        doc_name: str,
        version: VersionInfo,
        document: Any,
        is_material_only: bool = False,
        detect_backdate: bool = False
    ) -> Tuple[bool, List[ChangeRecord], List[FriendlyError]]:
        """
        添加文档新版本

        Args:
            doc_type: 文档类型（unit_table/terrain_rules/battle_report/battle_settlement）
            doc_name: 文档名称（用于区分不同的同类型文档）
            version: 版本信息
            document: 文档内容
            is_material_only: 是否只是补材料（不影响结论）
            detect_backdate: 是否检测补传旧版本

        Returns:
            (is_new_version, changes, warnings)
        """
        key = self._get_key(doc_type, doc_name)
        warnings: List[FriendlyError] = []

        if key not in self._histories:
            self._histories[key] = VersionHistory(doc_type, doc_name)

        history = self._histories[key]

        latest = history.get_latest()
        if latest and detect_backdate:
            latest_version, _ = latest
            if version.submitted_at < latest_version.submitted_at:
                doc_type_human = {
                    "unit_table": "单位表",
                    "terrain_rules": "地形规则",
                    "battle_report": "战报",
                    "battle_settlement": "结算数据",
                }.get(doc_type, doc_type)

                warnings.append(VersionConflict(
                    message=f"检测到补传{doc_type_human}旧版本！",
                    suggestion=f"这个版本的提交时间({version.submitted_at}) 早于当前最新版本({latest_version.version_id}, {latest_version.submitted_at})。已保留历史记录，不会静默覆盖。",
                    field_path=f"{doc_type}.{doc_name}.version",
                    raw_value=version.submitted_at,
                    context={
                        "new_version_id": version.version_id,
                        "latest_version_id": latest_version.version_id
                    },
                    severity="warning"
                ))

        is_new, changes = history.add_version(version, document, is_material_only)

        if is_new and changes:
            conclusion_changes = [c for c in changes if c.affects_conclusion]
            material_changes = [c for c in changes if not c.affects_conclusion]

            if conclusion_changes and is_material_only:
                warnings.append(FriendlyError(
                    message=f"该版本标记为补材料，但包含 {len(conclusion_changes)} 处可能影响结论的变更",
                    suggestion="请确认这些变更是否真的只是补材料。如果确实会影响结论，请不要标记为补材料。",
                    field_path=f"{doc_type}.{doc_name}",
                    severity="warning"
                ))

        return is_new, changes, warnings

    def get_latest(self, doc_type: str, doc_name: str) -> Optional[Tuple[VersionInfo, Any]]:
        """获取最新版本"""
        key = self._get_key(doc_type, doc_name)
        history = self._histories.get(key)
        return history.get_latest() if history else None

    def get_history(self, doc_type: str, doc_name: str) -> Optional[VersionHistory]:
        """获取版本历史"""
        key = self._get_key(doc_type, doc_name)
        return self._histories.get(key)

    def list_all_documents(self) -> List[Tuple[str, str, int]]:
        """列出所有文档及其版本数量"""
        result = []
        for key, history in self._histories.items():
            doc_type, doc_name = key.split(":", 1)
            result.append((doc_type, doc_name, len(history.versions)))
        return result

    def generate_version_report(self) -> str:
        """生成版本追踪报告"""
        lines = ["📋 版本追踪报告"]
        lines.append("=" * 50)

        if not self._histories:
            lines.append("暂无版本记录")
            return "\n".join(lines)

        for key, history in self._histories.items():
            doc_type, doc_name = key.split(":", 1)
            doc_type_human = {
                "unit_table": "单位表",
                "terrain_rules": "地形规则",
                "battle_report": "战报",
                "battle_settlement": "结算数据",
            }.get(doc_type, doc_type)

            lines.append(f"\n📄 {doc_type_human}：{doc_name}")
            lines.append(f"   共 {len(history.versions)} 个版本")

            stats = history.summarize_changes()
            if stats["conclusion"] > 0:
                lines.append(f"   ⚠️  包含 {stats['conclusion']} 处影响结论的变更")
            if stats["material"] > 0:
                lines.append(f"   📝 包含 {stats['material']} 处补材料变更")

            for i, (version, _doc) in enumerate(history.versions):
                    marker = ""
                    if i > 0:
                        changes = history.change_history[i]
                        if any(c.affects_conclusion for c in changes):
                            marker = " 🔴"
                        elif changes:
                            marker = " 🟡"
                        else:
                            marker = " ✅"
                        if version.is_material_only:
                            marker += " (补材料)"

                    lines.append(f"   {i+1}. v{version.version_id} - {version.submitted_at.strftime('%Y-%m-%d %H:%M')}")
                    lines.append(f"      提交人：{version.submitted_by}")
                    if version.comment:
                        lines.append(f"      备注：{version.comment}")
                    if i > 0 and history.change_history[i]:
                        changes = history.change_history[i]
                        for j, change in enumerate(changes):
                            icon = "🔴" if change.affects_conclusion else "📝"
                            lines.append(f"      {icon} {change.human_description}")

        return "\n".join(lines)
