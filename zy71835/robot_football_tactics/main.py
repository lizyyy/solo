"""
机器人足球战术 - 主入口模块

核心功能：
1. 解析单位表、地形规则、战报、结算数据
2. 版本追踪，区分补材料和改结论
3. 比对战报和结算一致性
4. 导出可追溯的复盘报告
"""

from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime
import os

from .models.base import VersionInfo
from .models.unit_table import UnitTable
from .models.terrain_rules import TerrainRules
from .models.battle_report import BattleReport
from .models.battle_settlement import BattleSettlement
from .parsers.unit_table_parser import UnitTableParser
from .parsers.terrain_parser import TerrainRulesParser
from .parsers.battle_report_parser import BattleReportParser
from .parsers.settlement_parser import BattleSettlementParser
from .versioning.version_tracker import VersionTracker
from .comparison.comparison_engine import ComparisonEngine, ComparisonReport
from .exporter.review_exporter import ReviewReportExporter, ReviewReport
from .errors.friendly_errors import FriendlyError, ParseError, error_context


class FootballTactics:
    """机器人足球战术 - 主类"""

    def __init__(self):
        self.tracker = VersionTracker()
        self._parsers = {
            "unit_table": UnitTableParser(),
            "terrain_rules": TerrainRulesParser(),
            "battle_report": BattleReportParser(),
            "battle_settlement": BattleSettlementParser(),
        }
        self._active_versions: Dict[str, str] = {}

    def load_unit_table(
        self,
        filepath: str,
        submitted_by: str = "未知",
        comment: str = "",
        version_id: Optional[str] = None,
        submitted_at: Optional[datetime] = None,
        is_material_only: bool = False,
        doc_name: str = "单位表"
    ) -> Tuple[UnitTable, List[FriendlyError]]:
        """加载单位表"""
        return self._load_document(
            doc_type="unit_table",
            filepath=filepath,
            submitted_by=submitted_by,
            comment=comment,
            version_id=version_id,
            submitted_at=submitted_at,
            is_material_only=is_material_only,
            doc_name=doc_name
        )

    def load_terrain_rules(
        self,
        filepath: str,
        submitted_by: str = "未知",
        comment: str = "",
        version_id: Optional[str] = None,
        submitted_at: Optional[datetime] = None,
        is_material_only: bool = False,
        doc_name: str = "地形规则"
    ) -> Tuple[TerrainRules, List[FriendlyError]]:
        """加载地形规则"""
        return self._load_document(
            doc_type="terrain_rules",
            filepath=filepath,
            submitted_by=submitted_by,
            comment=comment,
            version_id=version_id,
            submitted_at=submitted_at,
            is_material_only=is_material_only,
            doc_name=doc_name
        )

    def load_battle_report(
        self,
        filepath: str,
        submitted_by: str = "未知",
        comment: str = "",
        version_id: Optional[str] = None,
        submitted_at: Optional[datetime] = None,
        is_material_only: bool = False,
        doc_name: str = "战报"
    ) -> Tuple[BattleReport, List[FriendlyError]]:
        """加载战报"""
        return self._load_document(
            doc_type="battle_report",
            filepath=filepath,
            submitted_by=submitted_by,
            comment=comment,
            version_id=version_id,
            submitted_at=submitted_at,
            is_material_only=is_material_only,
            doc_name=doc_name
        )

    def load_settlement(
        self,
        filepath: str,
        submitted_by: str = "未知",
        comment: str = "",
        version_id: Optional[str] = None,
        submitted_at: Optional[datetime] = None,
        is_material_only: bool = False,
        doc_name: str = "结算数据"
    ) -> Tuple[BattleSettlement, List[FriendlyError]]:
        """加载结算数据"""
        return self._load_document(
            doc_type="battle_settlement",
            filepath=filepath,
            submitted_by=submitted_by,
            comment=comment,
            version_id=version_id,
            submitted_at=submitted_at,
            is_material_only=is_material_only,
            doc_name=doc_name
        )

    def _load_document(
        self,
        doc_type: str,
        filepath: str,
        submitted_by: str,
        comment: str,
        version_id: Optional[str],
        submitted_at: Optional[datetime],
        is_material_only: bool,
        doc_name: str
    ) -> Tuple[Any, List[FriendlyError]]:
        """通用文档加载方法"""
        with error_context(f"加载{doc_name}", filepath=filepath):
            if not os.path.exists(filepath):
                raise ParseError(
                    message=f"找不到文件：{filepath}",
                    suggestion="请检查文件路径是否正确",
                    field_path=f"{doc_type}.filepath",
                    raw_value=filepath
                )

            content = self._read_file(filepath)
            file_type = self._detect_file_type(filepath)

            if submitted_at is None:
                submitted_at = datetime.now()

            if version_id is None:
                history = self.tracker.get_history(doc_type, doc_name)
                next_num = len(history.versions) + 1 if history else 1
                version_id = f"{next_num:03d}"

            version = VersionInfo(
                version_id=version_id,
                submitted_at=submitted_at,
                submitted_by=submitted_by,
                comment=comment
            )

            parser = self._parsers[doc_type]
            document, parse_warnings = parser.parse(content, file_type, version)

            is_new, changes, warnings = self.tracker.add_document(
                doc_type=doc_type,
                doc_name=doc_name,
                version=version,
                document=document,
                is_material_only=is_material_only,
                detect_backdate=True
            )

            self._active_versions[doc_type] = version_id

            all_warnings = warnings.copy()
            for pw in parse_warnings:
                all_warnings.append(FriendlyError(
                    message=pw.message,
                    suggestion=pw.suggestion,
                    field_path=pw.field_path,
                    severity="warning"
                ))

            return document, all_warnings

    def _read_file(self, filepath: str) -> str:
        """读取文件内容"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            with open(filepath, 'r', encoding='gbk') as f:
                return f.read()

    def _detect_file_type(self, filepath: str) -> str:
        """检测文件类型"""
        ext = filepath.split('.')[-1].lower()
        if ext in ['csv', 'json', 'txt']:
            return ext
        return 'txt'

    def set_active_version(self, doc_type: str, version_id: str, doc_name: Optional[str] = None):
        """指定使用哪个版本进行比对"""
        found = False
        all_docs = self.tracker.list_all_documents()

        for dt, dn, _ in all_docs:
            if dt == doc_type:
                history = self.tracker.get_history(doc_type, dn)
                if history and history.get_version(version_id):
                    self._active_versions[doc_type] = version_id
                    found = True
                    break

        if not found:
            raise FriendlyError(
                message=f"找不到 {doc_type} 的版本 {version_id}",
                suggestion="请使用 list_versions 查看可用版本",
                field_path=f"{doc_type}.version_id",
                raw_value=version_id
            )

    def compare(
        self,
        report_doc_name: str = "战报",
        settlement_doc_name: str = "结算数据",
        unit_table_doc_name: str = "单位表",
        terrain_doc_name: str = "地形规则"
    ) -> ComparisonReport:
        """执行比对"""
        unit_table = self._get_active_document("unit_table", unit_table_doc_name)
        terrain_rules = self._get_active_document("terrain_rules", terrain_doc_name)
        battle_report = self._get_active_document("battle_report", report_doc_name)
        settlement = self._get_active_document("battle_settlement", settlement_doc_name)

        if battle_report is None:
            raise FriendlyError(
                message="请先加载战报再进行比对",
                suggestion="使用 load_battle_report() 加载战报文件",
                field_path="battle_report",
                severity="error"
            )

        if settlement is None:
            raise FriendlyError(
                message="请先加载结算数据再进行比对",
                suggestion="使用 load_settlement() 加载结算文件",
                field_path="battle_settlement",
                severity="error"
            )

        engine = ComparisonEngine(
            unit_table=unit_table,
            terrain_rules=terrain_rules
        )

        return engine.compare(battle_report, settlement)

    def _get_active_document(self, doc_type: str, doc_name: str) -> Optional[Any]:
        """获取当前活跃版本的文档"""
        history = self.tracker.get_history(doc_type, doc_name)
        if not history:
            return None

        version_id = self._active_versions.get(doc_type)
        if version_id:
            result = history.get_version(version_id)
            if result:
                return result[1]

        latest = history.get_latest()
        return latest[1] if latest else None

    def list_versions(self, doc_type: Optional[str] = None, doc_name: Optional[str] = None) -> str:
        """列出所有版本"""
        return self.tracker.generate_version_report()

    def export_review_report(
        self,
        title: str,
        comparison_report: Optional[ComparisonReport] = None,
        output_dir: str = ".",
        action_items: Optional[List[str]] = None,
        notes: Optional[List[str]] = None
    ) -> Tuple[str, str]:
        """
        导出复盘报告

        Returns:
            (text_filepath, json_filepath)
        """
        exporter = ReviewReportExporter(self.tracker)
        report = exporter.generate_report(
            title=title,
            comparison_report=comparison_report,
            action_items=action_items,
            notes=notes
        )

        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        text_path = os.path.join(output_dir, f"review_report_{timestamp}.txt")
        json_path = os.path.join(output_dir, f"review_report_{timestamp}.json")

        exporter.export_text(report, text_path)
        exporter.export_json(report, json_path)

        return text_path, json_path

    def get_version_changes(
        self,
        doc_type: str,
        doc_name: str,
        old_version_id: str,
        new_version_id: str
    ) -> str:
        """获取两个版本之间的变更"""
        history = self.tracker.get_history(doc_type, doc_name)
        if not history:
            return f"找不到 {doc_type}: {doc_name} 的版本历史"

        changes = history.get_changes_between(old_version_id, new_version_id)
        if not changes:
            return f"v{old_version_id} 和 v{new_version_id} 之间没有差异"

        lines = [f"v{old_version_id} → v{new_version_id} 变更："]
        for i, change in enumerate(changes, 1):
            icon = "🔴" if change.affects_conclusion else "📝"
            lines.append(f"  {i}. {icon} {change.human_description}")

        return "\n".join(lines)
