from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import os
from ..models.base import VersionInfo, ChangeRecord
from ..models.unit_table import UnitTable
from ..models.terrain_rules import TerrainRules
from ..models.battle_report import BattleReport
from ..models.battle_settlement import BattleSettlement
from ..comparison.comparison_engine import ComparisonReport, CheckResult, MatchSeverity
from ..versioning.version_tracker import VersionTracker
from ..errors.friendly_errors import FriendlyError


@dataclass
class ReviewReport:
    """复盘报告 - 包含完整可追溯信息"""
    report_id: str
    generated_at: datetime
    title: str
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    version_changes: List[Dict[str, Any]] = field(default_factory=list)
    comparison_result: Optional[Dict[str, Any]] = None
    raw_materials: Dict[str, Any] = field(default_factory=dict)
    action_items: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


class ReviewReportExporter:
    """复盘报告导出器"""

    def __init__(self, tracker: VersionTracker):
        self.tracker = tracker

    def generate_report(
        self,
        title: str,
        comparison_report: Optional[ComparisonReport] = None,
        action_items: Optional[List[str]] = None,
        notes: Optional[List[str]] = None
    ) -> ReviewReport:
        """生成完整的复盘报告"""
        report = ReviewReport(
            report_id=f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            generated_at=datetime.now(),
            title=title
        )

        report.timeline = self._build_timeline()
        report.version_changes = self._build_version_changes()

        if comparison_report:
            report.comparison_result = self._serialize_comparison_report(comparison_report)

        report.raw_materials = self._collect_raw_materials()

        if action_items:
            report.action_items = action_items
        if notes:
            report.notes = notes

        if comparison_report and comparison_report.has_errors():
            errors = comparison_report.get_errors()
            for i, err in enumerate(errors, 1):
                report.action_items.append(f"【问题{i}】{err.check_name}：{err.message}")

        if comparison_report and comparison_report.get_uncertain():
            uncertain = comparison_report.get_uncertain()
            for i, unc in enumerate(uncertain, 1):
                report.action_items.append(f"【存疑{i}】{unc.check_name}：{unc.message} - {unc.suggestion}")

        for warning in self._collect_all_warnings():
            report.notes.append(warning.to_human_string())

        return report

    def _build_timeline(self) -> List[Dict[str, Any]]:
        """构建时间线"""
        timeline = []

        all_docs = self.tracker.list_all_documents()

        for doc_type, doc_name, version_count in all_docs:
            history = self.tracker.get_history(doc_type, doc_name)
            if not history:
                continue

            doc_type_human = {
                "unit_table": "单位表",
                "terrain_rules": "地形规则",
                "battle_report": "战报",
                "battle_settlement": "结算数据",
            }.get(doc_type, doc_type)

            for i, (version, doc) in enumerate(history.versions):
                changes = history.change_history[i] if i > 0 else []
                conclusion_changes = [c for c in changes if c.affects_conclusion]
                material_changes = [c for c in changes if not c.affects_conclusion]

                entry = {
                    "timestamp": version.submitted_at.isoformat(),
                    "type": doc_type,
                    "type_human": doc_type_human,
                    "name": doc_name,
                    "version_id": version.version_id,
                    "submitted_by": version.submitted_by,
                    "comment": version.comment,
                    "is_material_only": version.is_material_only,
                    "changes": {
                        "total": len(changes),
                        "conclusion": len(conclusion_changes),
                        "material": len(material_changes),
                        "details": [self._serialize_change(c) for c in changes]
                    }
                }
                timeline.append(entry)

        timeline.sort(key=lambda x: x["timestamp"])

        for i, entry in enumerate(timeline, 1):
            entry["order"] = i

        return timeline

    def _build_version_changes(self) -> List[Dict[str, Any]]:
        """构建版本变更详情"""
        changes_list = []

        all_docs = self.tracker.list_all_documents()

        for doc_type, doc_name, version_count in all_docs:
            history = self.tracker.get_history(doc_type, doc_name)
            if not history or len(history.versions) < 2:
                continue

            for i in range(1, len(history.versions)):
                old_version, _ = history.versions[i-1]
                new_version, _ = history.versions[i]
                changes = history.change_history[i]

                conclusion_changes = [c for c in changes if c.affects_conclusion]
                material_changes = [c for c in changes if not c.affects_conclusion]

                changes_list.append({
                    "doc_type": doc_type,
                    "doc_name": doc_name,
                    "old_version": old_version.version_id,
                    "old_time": old_version.submitted_at.isoformat(),
                    "new_version": new_version.version_id,
                    "new_time": new_version.submitted_at.isoformat(),
                    "is_backdated": new_version.submitted_at < old_version.submitted_at,
                    "is_material_only": new_version.is_material_only,
                    "conclusion_changes": [self._serialize_change(c) for c in conclusion_changes],
                    "material_changes": [self._serialize_change(c) for c in material_changes],
                })

        return changes_list

    def _serialize_change(self, change: ChangeRecord) -> Dict[str, Any]:
        """序列化变更记录"""
        return {
            "field_path": change.field_path,
            "old_value": str(change.old_value),
            "new_value": str(change.new_value),
            "change_type": change.change_type,
            "human_description": change.human_description,
            "affects_conclusion": change.affects_conclusion,
        }

    def _serialize_comparison_report(self, report: ComparisonReport) -> Dict[str, Any]:
        """序列化比对报告"""
        return {
            "match_name": report.match_name,
            "check_time": report.check_time.isoformat(),
            "is_consistent": report.is_consistent(),
            "has_errors": report.has_errors(),
            "stats": {
                "total": len(report.results),
                "match": len(report.get_matches()),
                "tolerable": len(report.get_tolerable()),
                "mismatch": len(report.get_errors()),
                "uncertain": len(report.get_uncertain()),
            },
            "versions": {
                "unit_table": report.unit_table_version,
                "terrain_rules": report.terrain_rules_version,
                "battle_report": report.battle_report_version,
                "settlement": report.settlement_version,
            },
            "warnings": [w.to_human_string() for w in report.warnings],
            "errors": [self._serialize_check_result(r) for r in report.get_errors()],
            "tolerable": [self._serialize_check_result(r) for r in report.get_tolerable()],
            "uncertain": [self._serialize_check_result(r) for r in report.get_uncertain()],
            "all_results": [self._serialize_check_result(r) for r in report.results],
        }

    def _serialize_check_result(self, result: CheckResult) -> Dict[str, Any]:
        """序列化检查结果"""
        return {
            "check_name": result.check_name,
            "field_path": result.field_path,
            "severity": result.severity.value,
            "report_value": str(result.report_value),
            "settlement_value": str(result.settlement_value),
            "expected_value": str(result.expected_value) if result.expected_value is not None else None,
            "message": result.message,
            "suggestion": result.suggestion,
            "calculation_trace": result.calculation_trace,
        }

    def _collect_raw_materials(self) -> Dict[str, Any]:
        """收集所有原始材料内容，方便追溯"""
        materials = {}

        all_docs = self.tracker.list_all_documents()

        for doc_type, doc_name, version_count in all_docs:
            history = self.tracker.get_history(doc_type, doc_name)
            if not history:
                continue

            key = f"{doc_type}:{doc_name}"
            materials[key] = {
                "type": doc_type,
                "name": doc_name,
                "versions": []
            }

            for version, doc in history.versions:
                version_data = {
                    "version_id": version.version_id,
                    "submitted_at": version.submitted_at.isoformat(),
                    "submitted_by": version.submitted_by,
                    "comment": version.comment,
                    "is_material_only": version.is_material_only,
                    "raw_content": getattr(doc, "raw_content", ""),
                }
                materials[key]["versions"].append(version_data)

        return materials

    def _collect_all_warnings(self) -> List[FriendlyError]:
        """收集所有警告"""
        warnings = []
        all_docs = self.tracker.list_all_documents()

        for doc_type, doc_name, version_count in all_docs:
            history = self.tracker.get_history(doc_type, doc_name)
            if not history:
                continue

            for i, (version, _) in enumerate(history.versions):
                if i == 0:
                    continue

                changes = history.change_history[i]
                prev_version, _ = history.versions[i-1]

                if version.submitted_at < prev_version.submitted_at:
                    doc_type_human = {
                        "unit_table": "单位表",
                        "terrain_rules": "地形规则",
                        "battle_report": "战报",
                        "battle_settlement": "结算数据",
                    }.get(doc_type, doc_type)
                    warnings.append(FriendlyError(
                        message=f"检测到补传{doc_type_human}旧版本 v{version.version_id}",
                        suggestion=f"该版本提交时间({version.submitted_at.strftime('%Y-%m-%d %H:%M')})早于上一版本 v{prev_version.version_id}({prev_version.submitted_at.strftime('%Y-%m-%d %H:%M')})。已保留历史，未静默覆盖。",
                        severity="warning"
                    ))

                if version.is_material_only:
                    conclusion_changes = [c for c in changes if c.affects_conclusion]
                    if conclusion_changes:
                        warnings.append(FriendlyError(
                            message=f"{doc_name} v{version.version_id} 标记为补材料，但包含 {len(conclusion_changes)} 处可能影响结论的变更",
                            suggestion="请确认这些变更是否真的只是补材料",
                            severity="warning"
                        ))

        return warnings

    def export_text(self, report: ReviewReport, filepath: str) -> str:
        """导出为纯文本格式 - 不追求排版，重点是信息完整可追溯"""
        lines = []

        lines.append("=" * 70)
        lines.append(f"机器人足球战术 - 复盘报告")
        lines.append(f"报告编号：{report.report_id}")
        lines.append(f"生成时间：{report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"报告标题：{report.title}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("=" * 50)
        lines.append("一、时间线 - 谁在什么时候传了什么")
        lines.append("=" * 50)
        lines.append("")

        for entry in report.timeline:
            lines.append(f"[{entry['order']}] {entry['timestamp']}")
            lines.append(f"    类型：{entry['type_human']} - {entry['name']}")
            lines.append(f"    版本：v{entry['version_id']}")
            lines.append(f"    提交人：{entry['submitted_by']}")
            if entry['comment']:
                lines.append(f"    备注：{entry['comment']}")
            if entry['is_material_only']:
                lines.append(f"    标记：补材料（不影响结论）")
            if entry['changes']['total'] > 0:
                if entry['changes']['conclusion'] > 0:
                    lines.append(f"    变更：🔴 {entry['changes']['conclusion']} 处影响结论")
                if entry['changes']['material'] > 0:
                    lines.append(f"    变更：📝 {entry['changes']['material']} 处补材料")
                for change in entry['changes']['details']:
                    icon = "🔴" if change['affects_conclusion'] else "📝"
                    lines.append(f"       {icon} {change['human_description']}")
            else:
                lines.append(f"    变更：✅ 无实质变化")
            lines.append("")

        if report.version_changes:
            lines.append("=" * 50)
            lines.append("二、版本变更详情 - 每次改了什么")
            lines.append("=" * 50)
            lines.append("")

            for i, change in enumerate(report.version_changes, 1):
                lines.append(f"【变更 {i}】{change['doc_name']}")
                lines.append(f"    {change['old_version']} ({change['old_time']}) → {change['new_version']} ({change['new_time']})")
                if change['is_backdated']:
                    lines.append(f"    ⚠️  警告：新版本时间早于旧版本（补传旧版本）")
                if change['is_material_only']:
                    lines.append(f"    📝 标记：补材料")

                if change['conclusion_changes']:
                    lines.append(f"    🔴 影响结论的变更（{len(change['conclusion_changes'])} 处）：")
                    for c in change['conclusion_changes']:
                        lines.append(f"       - {c['human_description']}")

                if change['material_changes']:
                    lines.append(f"    📝 补材料变更（{len(change['material_changes'])} 处）：")
                    for c in change['material_changes']:
                        lines.append(f"       - {c['human_description']}")
                lines.append("")

        if report.comparison_result:
            lines.append("=" * 50)
            lines.append("三、比对结果 - 战报和结算是否一致")
            lines.append("=" * 50)
            lines.append("")

            cr = report.comparison_result
            lines.append(f"比赛：{cr['match_name']}")
            lines.append(f"检查时间：{cr['check_time']}")
            lines.append(f"一致性：{'✅ 一致' if cr['is_consistent'] else '❌ 不一致'}")
            lines.append(f"统计：共 {cr['stats']['total']} 项检查")
            lines.append(f"      ✅ 一致 {cr['stats']['match']} | 🟡 可容忍 {cr['stats']['tolerable']} | ❓ 存疑 {cr['stats']['uncertain']} | ❌ 不一致 {cr['stats']['mismatch']}")
            lines.append("")

            if cr['versions']:
                lines.append(f"使用版本：")
                for key, ver in cr['versions'].items():
                    if ver:
                        lines.append(f"  - {key}: v{ver}")
                lines.append("")

            if cr['warnings']:
                lines.append(f"注意事项：")
                for w in cr['warnings']:
                    lines.append(f"  ⚠️  {w}")
                lines.append("")

            if cr['errors']:
                lines.append(f"❌ 不一致项（{len(cr['errors'])}）：")
                for i, r in enumerate(cr['errors'], 1):
                    lines.append(f"  【问题{i}】{r['check_name']}")
                    lines.append(f"     问题：{r['message']}")
                    lines.append(f"     战报：{r['report_value']}")
                    lines.append(f"     结算：{r['settlement_value']}")
                    if r['expected_value']:
                        lines.append(f"     预期：{r['expected_value']}")
                    if r['calculation_trace']:
                        lines.append(f"     计算过程：")
                        for t in r['calculation_trace']:
                            lines.append(f"       → {t}")
                    if r['suggestion']:
                        lines.append(f"     建议：{r['suggestion']}")
                    lines.append("")

            if cr['tolerable']:
                lines.append(f"🟡 可容忍差异（{len(cr['tolerable'])}）：")
                for i, r in enumerate(cr['tolerable'], 1):
                    lines.append(f"  【差异{i}】{r['check_name']}")
                    lines.append(f"     {r['message']}")
                    if r['suggestion']:
                        lines.append(f"     建议：{r['suggestion']}")
                    lines.append("")

            if cr['uncertain']:
                lines.append(f"❓ 无法判断（{len(cr['uncertain'])}）：")
                for i, r in enumerate(cr['uncertain'], 1):
                    lines.append(f"  【存疑{i}】{r['check_name']}")
                    lines.append(f"     {r['message']}")
                    if r['suggestion']:
                        lines.append(f"     建议：{r['suggestion']}")
                    lines.append("")

        if report.action_items:
            lines.append("=" * 50)
            lines.append("四、待办事项 - 下一班继续查这里")
            lines.append("=" * 50)
            lines.append("")
            for i, item in enumerate(report.action_items, 1):
                lines.append(f"  [{i}] {item}")
            lines.append("")

        if report.notes:
            lines.append("=" * 50)
            lines.append("五、备注 - 重要提醒")
            lines.append("=" * 50)
            lines.append("")
            for i, note in enumerate(report.notes, 1):
                lines.append(f"  [{i}] {note}")
            lines.append("")

        if report.raw_materials:
            lines.append("=" * 50)
            lines.append("六、原始材料存档 - 不用翻聊天记录")
            lines.append("=" * 50)
            lines.append("")

            for key, material in report.raw_materials.items():
                lines.append(f"--- {material['type']}: {material['name']} ---")
                for version in material['versions']:
                    lines.append(f"版本 v{version['version_id']} - {version['submitted_at']}")
                    lines.append(f"提交人：{version['submitted_by']}")
                    if version['comment']:
                        lines.append(f"备注：{version['comment']}")
                    if version['is_material_only']:
                        lines.append(f"标记：补材料")
                    lines.append(f"原始内容：")
                    lines.append(version['raw_content'] or "(无原始内容)")
                    lines.append("")

        output = "\n".join(lines)

        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(output)

        return output

    def export_json(self, report: ReviewReport, filepath: str) -> str:
        """导出为JSON格式 - 方便程序处理"""
        data = {
            "report_id": report.report_id,
            "generated_at": report.generated_at.isoformat(),
            "title": report.title,
            "timeline": report.timeline,
            "version_changes": report.version_changes,
            "comparison_result": report.comparison_result,
            "action_items": report.action_items,
            "notes": report.notes,
            "raw_materials": report.raw_materials,
        }

        output = json.dumps(data, ensure_ascii=False, indent=2)

        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(output)

        return output
