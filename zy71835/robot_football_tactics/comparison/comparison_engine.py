from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from datetime import datetime
from ..models.unit_table import UnitTable
from ..models.terrain_rules import TerrainRules
from ..models.battle_report import BattleReport, BattleEvent
from ..models.battle_settlement import BattleSettlement, SettlementItem
from ..errors.friendly_errors import (
    ComparisonMismatch,
    FriendlyError,
    ErrorCollector,
    create_mismatch_error,
    translate_field,
    ValidationError
)


class MatchSeverity(str, Enum):
    MATCH = "match"          # 完全一致
    TOLERABLE = "tolerable"  # 在容忍范围内
    MISMATCH = "mismatch"    # 不一致
    UNCERTAIN = "uncertain"  # 无法判断（缺少材料）


@dataclass
class CheckResult:
    """单项检查结果"""
    check_name: str
    field_path: str
    severity: MatchSeverity
    report_value: Any
    settlement_value: Any
    expected_value: Optional[Any]
    message: str
    suggestion: str = ""
    calculation_trace: List[str] = field(default_factory=list)

    def to_human_string(self) -> str:
        if self.severity == MatchSeverity.MATCH:
            icon = "✅"
        elif self.severity == MatchSeverity.TOLERABLE:
            icon = "🟡"
        elif self.severity == MatchSeverity.UNCERTAIN:
            icon = "❓"
        else:
            icon = "❌"

        lines = [f"{icon} {self.check_name}：{self.message}"]

        if self.severity in [MatchSeverity.MISMATCH, MatchSeverity.TOLERABLE]:
            lines.append(f"   战报：{self.report_value}")
            lines.append(f"   结算：{self.settlement_value}")
            if self.expected_value is not None:
                lines.append(f"   预期：{self.expected_value}")

        if self.calculation_trace:
            lines.append(f"   计算过程：")
            for trace in self.calculation_trace:
                lines.append(f"     → {trace}")

        if self.suggestion:
            lines.append(f"   💡 建议：{self.suggestion}")

        return "\n".join(lines)


@dataclass
class ComparisonReport:
    """比对报告"""
    match_name: str
    check_time: datetime
    results: List[CheckResult] = field(default_factory=list)
    warnings: List[FriendlyError] = field(default_factory=list)
    unit_table_version: Optional[str] = None
    terrain_rules_version: Optional[str] = None
    battle_report_version: Optional[str] = None
    settlement_version: Optional[str] = None

    def get_errors(self) -> List[CheckResult]:
        return [r for r in self.results if r.severity == MatchSeverity.MISMATCH]

    def get_tolerable(self) -> List[CheckResult]:
        return [r for r in self.results if r.severity == MatchSeverity.TOLERABLE]

    def get_matches(self) -> List[CheckResult]:
        return [r for r in self.results if r.severity == MatchSeverity.MATCH]

    def get_uncertain(self) -> List[CheckResult]:
        return [r for r in self.results if r.severity == MatchSeverity.UNCERTAIN]

    def has_errors(self) -> bool:
        return any(r.severity == MatchSeverity.MISMATCH for r in self.results)

    def is_consistent(self) -> bool:
        return not self.has_errors() and not self.get_uncertain()

    def to_human_string(self) -> str:
        lines = ["=" * 60]
        lines.append(f"📊 战报结算比对报告 - {self.match_name}")
        lines.append(f"⏰ 检查时间：{self.check_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)

        version_info = []
        if self.unit_table_version:
            version_info.append(f"单位表: v{self.unit_table_version}")
        if self.terrain_rules_version:
            version_info.append(f"地形规则: v{self.terrain_rules_version}")
        if self.battle_report_version:
            version_info.append(f"战报: v{self.battle_report_version}")
        if self.settlement_version:
            version_info.append(f"结算: v{self.settlement_version}")
        if version_info:
            lines.append(f"📋 使用版本：{'、'.join(version_info)}")
            lines.append("")

        errors = self.get_errors()
        tolerable = self.get_tolerable()
        matches = self.get_matches()
        uncertain = self.get_uncertain()

        lines.append(f"📈 统计：共 {len(self.results)} 项检查")
        lines.append(f"   ✅ 一致：{len(matches)}")
        lines.append(f"   🟡 可容忍：{len(tolerable)}")
        lines.append(f"   ❓ 存疑：{len(uncertain)}")
        lines.append(f"   ❌ 不一致：{len(errors)}")
        lines.append("")

        if self.warnings:
            lines.append(f"⚠️  注意事项（{len(self.warnings)} 条）：")
            for i, warn in enumerate(self.warnings, 1):
                lines.append(f"   {i}. {warn.to_human_string()}")
            lines.append("")

        if errors:
            lines.append(f"❌ 发现 {len(errors)} 处不一致：")
            for i, result in enumerate(errors, 1):
                lines.append(f"\n【问题 {i}】{result.to_human_string()}")
            lines.append("")

        if tolerable:
            lines.append(f"🟡 可容忍差异（{len(tolerable)} 处）：")
            for i, result in enumerate(tolerable, 1):
                lines.append(f"\n【差异 {i}】{result.to_human_string()}")
            lines.append("")

        if uncertain:
            lines.append(f"❓ 无法判断（{len(uncertain)} 处）：")
            for i, result in enumerate(uncertain, 1):
                lines.append(f"\n【存疑 {i}】{result.to_human_string()}")
            lines.append("")

        if self.is_consistent():
            lines.append("🎉 结论：战报和结算完全一致，可以继续提测！")
        elif self.has_errors():
            lines.append("🚨 结论：战报和结算存在不一致，需要排查后再提测。")
        else:
            lines.append("⚠️  结论：存在不确定项，建议补全材料后再查一遍。")

        return "\n".join(lines)


class ComparisonEngine:
    """比对引擎 - 检查战报和结算的一致性"""

    def __init__(
        self,
        unit_table: Optional[UnitTable] = None,
        terrain_rules: Optional[TerrainRules] = None,
        tolerance: float = 0.01
    ):
        self.unit_table = unit_table
        self.terrain_rules = terrain_rules
        self.tolerance = tolerance
        self.warnings: List[FriendlyError] = []

    def _warn_if_missing_materials(self, report: BattleReport, settlement: BattleSettlement):
        """检查是否缺少必要材料"""
        if self.unit_table is None:
            self.warnings.append(FriendlyError(
                message="未提供单位表，无法进行基于单位属性的精确校验",
                suggestion="请上传单位表后重新比对，可以获得更准确的结果",
                severity="warning"
            ))

        if self.terrain_rules is None:
            self.warnings.append(FriendlyError(
                message="未提供地形规则，无法进行地形修正相关的校验",
                suggestion="请上传地形规则后重新比对",
                severity="warning"
            ))

        if report.manual_modified:
            self.warnings.append(FriendlyError(
                message="战报检测到手工改动痕迹，请特别留意改动部分是否与结算一致",
                suggestion="请确认战报改动是否有相应的结算修改",
                severity="warning"
            ))

    def compare(
        self,
        report: BattleReport,
        settlement: BattleSettlement
    ) -> ComparisonReport:
        """执行完整比对"""
        self.warnings = []
        results: List[CheckResult] = []

        self._warn_if_missing_materials(report, settlement)

        results.extend(self._check_basic_info(report, settlement))
        results.extend(self._check_final_score(report, settlement))
        results.extend(self._check_goal_events(report, settlement))
        results.extend(self._check_mvp(report, settlement))
        results.extend(self._check_statistics(report, settlement))
        results.extend(self._check_event_sequence(report, settlement))

        if self.unit_table:
            results.extend(self._check_unit_attributes_consistency(report, settlement))

        if self.terrain_rules:
            results.extend(self._check_terrain_effects(report, settlement))

        report_obj = ComparisonReport(
            match_name=report.match_name or settlement.match_name,
            check_time=datetime.now(),
            results=results,
            warnings=self.warnings.copy()
        )

        if self.unit_table:
            report_obj.unit_table_version = self.unit_table.version.version_id
        if self.terrain_rules:
            report_obj.terrain_rules_version = self.terrain_rules.version.version_id
        report_obj.battle_report_version = report.version.version_id
        report_obj.settlement_version = settlement.version.version_id

        return report_obj

    def _check_basic_info(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查基本信息"""
        results = []

        if report.match_name and settlement.match_name:
            severity = MatchSeverity.MATCH if report.match_name == settlement.match_name else MatchSeverity.TOLERABLE
            results.append(CheckResult(
                check_name="比赛名称",
                field_path="match_name",
                severity=severity,
                report_value=report.match_name,
                settlement_value=settlement.match_name,
                expected_value=report.match_name,
                message="比赛名称一致" if severity == MatchSeverity.MATCH else f"比赛名称不一致（战报：{report.match_name}，结算：{settlement.match_name}）",
                suggestion="如果只是命名差异，不影响结论；否则请确认是否是同一场比赛"
            ))

        return results

    def _check_final_score(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查最终比分"""
        results = []

        report_goals = len([e for e in report.events if e.event_type == "进球"])
        settlement_goals = sum(settlement.final_score.values())

        report_score = self._calculate_team_scores(report)

        if settlement.final_score:
            for team, score in settlement.final_score.items():
                report_team_score = report_score.get(team, 0)
                severity = MatchSeverity.MATCH if report_team_score == score else MatchSeverity.MISMATCH

                results.append(CheckResult(
                    check_name=f"{team} 最终得分",
                    field_path=f"final_score.{team}",
                    severity=severity,
                    report_value=report_team_score,
                    settlement_value=score,
                    expected_value=report_team_score,
                    message=f"{team} 得分一致" if severity == MatchSeverity.MATCH else f"{team} 得分不一致，战报统计{report_team_score}分，结算{score}分",
                    suggestion="请逐球核对，确认是战报漏记进球还是结算计算错误",
                    calculation_trace=[
                        f"根据战报，{team} 有 {report_team_score} 个进球事件",
                        f"结算中 {team} 得分为 {score}"
                    ]
                ))

        severity = MatchSeverity.MATCH if report_goals == settlement_goals else MatchSeverity.MISMATCH
        results.append(CheckResult(
            check_name="总进球数",
            field_path="total_goals",
            severity=severity,
            report_value=report_goals,
            settlement_value=settlement_goals,
            expected_value=report_goals,
            message=f"总进球数一致，共 {report_goals} 球" if severity == MatchSeverity.MATCH else f"总进球数不一致，战报{report_goals}球，结算{settlement_goals}球",
            suggestion="请检查战报中是否有进球事件遗漏，或结算中是否有误算"
        ))

        return results

    def _calculate_team_scores(self, report: BattleReport) -> Dict[str, int]:
        """根据战报计算各队得分"""
        scores = {"team_a": 0, "team_b": 0}

        if self.unit_table:
            for event in report.events:
                if event.event_type == "进球":
                    unit = self.unit_table.get_unit(event.actor_unit_id)
                    if unit:
                        if unit.unit_type == "team_a":
                            scores["team_a"] += 1
                        elif unit.unit_type == "team_b":
                            scores["team_b"] += 1
                        else:
                            scores["team_a" if event.actor_unit_id.startswith("A") else "team_b"] += 1
                    else:
                        scores["team_a" if event.actor_unit_id.startswith("A") else "team_b"] += 1
        else:
            for event in report.events:
                if event.event_type == "进球":
                    scores["team_a" if event.actor_unit_id.startswith("A") else "team_b"] += 1

        return scores

    def _check_goal_events(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查进球事件"""
        results = []

        goal_events = report.get_events_by_type("进球")
        shot_events = report.get_events_by_type("射门")

        if shot_events:
            goal_rate = len(goal_events) / len(shot_events) if shot_events else 0
            results.append(CheckResult(
                check_name="射门进球转化率",
                field_path="goal_conversion_rate",
                severity=MatchSeverity.MATCH,
                report_value=f"{goal_rate:.1%}",
                settlement_value=None,
                expected_value=None,
                message=f"共 {len(shot_events)} 次射门，{len(goal_events)} 个进球，转化率 {goal_rate:.1%}",
                calculation_trace=[
                    f"射门次数：{len(shot_events)}",
                    f"进球次数：{len(goal_events)}",
                    f"转化率：{len(goal_events)}/{len(shot_events)} = {goal_rate:.1%}"
                ]
            ))

        for i, goal_event in enumerate(goal_events, 1):
            unit_name = goal_event.actor_unit_id
            if self.unit_table:
                unit_name = self.unit_table.get_unit_display_name(goal_event.actor_unit_id)

            if goal_event.result and goal_event.result != "成功" and goal_event.result != "进球":
                results.append(CheckResult(
                    check_name=f"第{i}个进球事件校验",
                    field_path=f"events[{goal_event.timestamp}].result",
                    severity=MatchSeverity.MISMATCH,
                    report_value=goal_event.result,
                    settlement_value="进球",
                    expected_value="进球",
                    message=f"第{i}个进球（{unit_name}在{goal_event.timestamp}分钟）的事件结果标记为'{goal_event.result}'，但事件类型是进球",
                    suggestion="请修正事件结果，进球事件的结果应该是'成功'或'进球'"
                ))

        return results

    def _check_mvp(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查MVP是否合理"""
        results = []

        if not settlement.mvp_unit_id:
            return results

        mvp_name = settlement.mvp_unit_id
        if self.unit_table:
            mvp_name = self.unit_table.get_unit_display_name(settlement.mvp_unit_id)

        mvp_events = [e for e in report.events if e.actor_unit_id == settlement.mvp_unit_id]
        mvp_goals = len([e for e in mvp_events if e.event_type == "进球"])
        mvp_assists = len([e for e in mvp_events if e.event_type == "传球" and e.result == "成功"])

        all_player_stats = self._calculate_player_stats(report)
        max_goals = max([s["goals"] for s in all_player_stats.values()], default=0)
        max_contribution = max([s["goals"] * 2 + s["assists"] for s in all_player_stats.values()], default=0)

        mvp_contribution = mvp_goals * 2 + mvp_assists

        if mvp_contribution < max_contribution:
            top_player = max(all_player_stats.items(), key=lambda x: x[1]["goals"] * 2 + x[1]["assists"])
            top_name = top_player[0]
            if self.unit_table:
                top_name = self.unit_table.get_unit_display_name(top_player[0])

            results.append(CheckResult(
                check_name="MVP合理性",
                field_path="mvp_unit_id",
                severity=MatchSeverity.TOLERABLE,
                report_value=f"{mvp_name}（{mvp_goals}球{mvp_assists}助，贡献度{mvp_contribution}）",
                settlement_value=mvp_name,
                expected_value=f"贡献度最高的球员",
                message=f"MVP是{mvp_name}，但{top_name}的贡献度更高（{top_player[1]['goals']}球{top_player[1]['assists']}助，贡献度{max_contribution}）",
                suggestion="请确认MVP评选标准。如果有其他评选标准（如防守贡献），请在备注中说明",
                calculation_trace=[
                    f"MVP {mvp_name}：进球{mvp_goals}×2 + 助攻{mvp_assists}×1 = {mvp_contribution}",
                    f"最高 {top_name}：进球{top_player[1]['goals']}×2 + 助攻{top_player[1]['assists']}×1 = {max_contribution}"
                ]
            ))
        else:
            results.append(CheckResult(
                check_name="MVP合理性",
                field_path="mvp_unit_id",
                severity=MatchSeverity.MATCH,
                report_value=f"{mvp_name}（{mvp_goals}球{mvp_assists}助）",
                settlement_value=mvp_name,
                expected_value=mvp_name,
                message=f"MVP合理，{mvp_name}是场上贡献最高的球员之一"
            ))

        return results

    def _calculate_player_stats(self, report: BattleReport) -> Dict[str, Dict[str, int]]:
        """计算每个球员的统计数据"""
        stats: Dict[str, Dict[str, int]] = {}

        for event in report.events:
            player_id = event.actor_unit_id
            if player_id not in stats:
                stats[player_id] = {"goals": 0, "assists": 0, "shots": 0, "passes": 0}

            if event.event_type == "进球":
                stats[player_id]["goals"] += 1
            elif event.event_type == "射门":
                stats[player_id]["shots"] += 1
            elif event.event_type == "传球":
                stats[player_id]["passes"] += 1
                if event.result == "成功":
                    stats[player_id]["assists"] += 1

        return stats

    def _check_statistics(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查统计数据"""
        results = []

        player_stats = self._calculate_player_stats(report)

        for item in settlement.items:
            unit_name = item.unit_id
            if self.unit_table:
                unit_name = self.unit_table.get_unit_display_name(item.unit_id)

            if item.item_id.startswith("GOALS_") or "进球" in item.item_name:
                expected = player_stats.get(item.unit_id, {}).get("goals", 0)
                actual = item.value if isinstance(item.value, int) else 0

                severity = MatchSeverity.MATCH if expected == actual else MatchSeverity.MISMATCH
                results.append(CheckResult(
                    check_name=f"{unit_name} 进球数",
                    field_path=f"items[{item.item_id}].value",
                    severity=severity,
                    report_value=expected,
                    settlement_value=actual,
                    expected_value=expected,
                    message=f"{unit_name}进球数一致" if severity == MatchSeverity.MATCH else f"{unit_name}进球数不一致，战报{expected}，结算{actual}",
                    suggestion="请逐一核对该球员的进球事件",
                    calculation_trace=[f"战报中{unit_name}有{expected}个进球事件", f"结算中{unit_name}进球数为{actual}"]
                ))

            if item.item_id.startswith("PASSES_") or "传球" in item.item_name:
                expected = player_stats.get(item.unit_id, {}).get("passes", 0)
                actual = item.value if isinstance(item.value, int) else 0

                severity = MatchSeverity.MATCH if expected == actual else MatchSeverity.MISMATCH
                results.append(CheckResult(
                    check_name=f"{unit_name} 传球数",
                    field_path=f"items[{item.item_id}].value",
                    severity=severity,
                    report_value=expected,
                    settlement_value=actual,
                    expected_value=expected,
                    message=f"{unit_name}传球数一致" if severity == MatchSeverity.MATCH else f"{unit_name}传球数不一致，战报{expected}，结算{actual}",
                    suggestion="请逐一核对该球员的传球事件"
                ))

        return results

    def _check_event_sequence(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查事件时序是否合理"""
        results = []

        sorted_events = sorted(report.events, key=lambda e: e.timestamp)
        time_gaps = []
        for i in range(1, len(sorted_events)):
            gap = sorted_events[i].timestamp - sorted_events[i-1].timestamp
            if gap < 0:
                results.append(CheckResult(
                    check_name=f"事件时序 - 第{i}个事件",
                    field_path=f"events[{i}].timestamp",
                    severity=MatchSeverity.MISMATCH,
                    report_value=f"{sorted_events[i].timestamp}分钟（在{sorted_events[i-1].timestamp}分钟之前）",
                    settlement_value=None,
                    expected_value="时间递增",
                    message=f"事件时间倒序！第{i}个事件（{sorted_events[i].event_type}）发生在{sorted_events[i].timestamp}分钟，比前一个事件（{sorted_events[i-1].event_type}）的{sorted_events[i-1].timestamp}分钟更早",
                    suggestion="请修正战报中的事件时间顺序",
                    calculation_trace=[
                        f"事件{i-1}: {sorted_events[i-1].timestamp}分钟 - {sorted_events[i-1].event_type}",
                        f"事件{i}: {sorted_events[i].timestamp}分钟 - {sorted_events[i].event_type}",
                        f"时间差: {gap}分钟（负数表示倒序）"
                    ]
                ))
            time_gaps.append(gap)

        if time_gaps:
            max_gap = max(time_gaps)
            if max_gap > 30:
                gap_idx = time_gaps.index(max_gap) + 1
                results.append(CheckResult(
                    check_name=f"事件时间间隔",
                    field_path=f"events[{gap_idx}].timestamp",
                    severity=MatchSeverity.TOLERABLE,
                    report_value=f"最大间隔 {max_gap:.1f} 分钟",
                    settlement_value=None,
                    expected_value="< 30分钟",
                    message=f"第{gap_idx}个事件和前一个事件间隔{max_gap:.1f}分钟，间隔较长",
                    suggestion="请确认中间是否遗漏了重要事件",
                    calculation_trace=[
                        f"事件{gap_idx-1}: {sorted_events[gap_idx-1].timestamp}分钟",
                        f"事件{gap_idx}: {sorted_events[gap_idx].timestamp}分钟",
                        f"间隔: {max_gap:.1f}分钟"
                    ]
                ))

        return results

    def _check_unit_attributes_consistency(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查单位属性一致性"""
        results = []

        for event in report.events:
            unit = self.unit_table.get_unit(event.actor_unit_id) if self.unit_table else None
            if unit and event.event_type in ["射门", "进球"]:
                atk = unit.get_attr("atk", 0)
                spd = unit.get_attr("spd", 0)

                if event.result == "成功" or event.event_type == "进球":
                    if atk < 30:
                        results.append(CheckResult(
                            check_name=f"攻击力合理性 - {unit.unit_name}",
                            field_path=f"units[{unit.unit_id}].atk",
                            severity=MatchSeverity.TOLERABLE,
                            report_value=f"攻击力{atk}，但射门成功",
                            settlement_value=None,
                            expected_value="攻击力应该足够支撑射门成功",
                            message=f"{unit.unit_name}攻击力只有{atk}，但{event.timestamp}分钟的射门成功了",
                            suggestion="请确认攻击力阈值设置是否合理，或者是否有其他加成因素",
                            calculation_trace=[
                                f"单位: {unit.unit_name}({unit.unit_id})",
                                f"攻击力: {atk}",
                                f"事件: {event.timestamp}分钟 {event.event_type} - {event.result}",
                            ]
                        ))

        return results

    def _check_terrain_effects(self, report: BattleReport, settlement: BattleSettlement) -> List[CheckResult]:
        """检查地形效果是否生效"""
        results = []

        if not self.terrain_rules:
            return results

        for event in report.events:
            if event.terrain_id:
                terrain = self.terrain_rules.get_rule(event.terrain_id)
                if terrain:
                    for effect in terrain.effects:
                        if effect.modifier > 0:
                            results.append(CheckResult(
                                check_name=f"地形效果 - {terrain.terrain_name} {effect.effect_name}",
                                field_path=f"terrain_rules[{terrain.rule_id}].effects[{effect.effect_id}]",
                                severity=MatchSeverity.MATCH,
                                report_value=f"{terrain.terrain_name} +{effect.modifier} {effect.target_attr}",
                                settlement_value=None,
                                expected_value=f"{effect.modifier}",
                                message=f"{event.timestamp}分钟在{terrain.terrain_name}发生{event.event_type}，地形加成{effect.modifier}点{effect.target_attr}",
                                calculation_trace=[
                                    f"地形: {terrain.terrain_name}",
                                    f"效果: {effect.effect_name}",
                                    f"目标属性: {effect.target_attr}",
                                    f"修正值: {effect.modifier}"
                                ]
                            ))
                else:
                    results.append(CheckResult(
                        check_name=f"未知地形 - {event.terrain_id}",
                        field_path=f"events[{event.timestamp}].terrain_id",
                        severity=MatchSeverity.UNCERTAIN,
                        report_value=event.terrain_id,
                        settlement_value=None,
                        expected_value="在地形规则中定义的地形",
                        message=f"战报中提到的地形'{event.terrain_id}'在地形规则中找不到定义",
                        suggestion="请确认地形ID是否正确，或补充地形规则"
                    ))

        return results
