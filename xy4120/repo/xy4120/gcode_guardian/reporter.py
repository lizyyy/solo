import csv
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import MachineConfig
from .parser import Fixture, Tool, Workpiece
from .rules import RuleCategory, RuleViolation, Severity, ViolationSummary
from .session import ReviewDecision, ReviewItem, Session, SessionStatistics


class Reporter:
    def __init__(self, session: Session):
        self.session = session
        self.violation_summary = session.get_violation_summary()

    def generate_markdown_report(self, output_path: Path) -> Path:
        report = self._build_markdown_content()
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        return output_path

    def generate_csv_report(self, output_path: Path) -> Path:
        rows = self._build_csv_rows()
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        return output_path

    def generate_json_report(self, output_path: Path) -> Path:
        report_data = self._build_json_data()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        return output_path

    def generate_all(self, output_dir: Path, prefix: str = "report") -> Dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        md_path = output_dir / f"{prefix}_{timestamp}.md"
        csv_path = output_dir / f"{prefix}_{timestamp}.csv"
        json_path = output_dir / f"{prefix}_{timestamp}.json"

        return {
            "markdown": self.generate_markdown_report(md_path),
            "csv": self.generate_csv_report(csv_path),
            "json": self.generate_json_report(json_path),
        }

    def _build_markdown_content(self) -> str:
        lines = []

        lines.append("# 刀路干运行检查报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 会话ID: {self.session.metadata.id}")
        lines.append(f"> 会话名称: {self.session.metadata.name}")
        if self.session.metadata.description:
            lines.append(f"> 描述: {self.session.metadata.description}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 检查结果概览")
        lines.append("")

        total = self.violation_summary.total_count
        critical = self.violation_summary.critical_count
        errors = self.violation_summary.error_count
        warnings = self.violation_summary.warning_count
        info = self.violation_summary.info_count

        status = "✅ 通过"
        if self.violation_summary.has_blocking_issues:
            status = "❌ 不通过 (存在严重问题)"
        elif warnings > 0:
            status = "⚠️ 通过 (存在警告)"

        lines.append(f"**整体状态**: {status}")
        lines.append("")

        lines.append("| 级别 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 🔴 严重 (CRITICAL) | {critical} |")
        lines.append(f"| 🟠 错误 (ERROR) | {errors} |")
        lines.append(f"| 🟡 警告 (WARNING) | {warnings} |")
        lines.append(f"| ℹ️ 信息 (INFO) | {info} |")
        lines.append(f"| **总计** | **{total}** |")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 统计信息")
        lines.append("")
        stats = self.session.statistics
        lines.append(f"- 总代码块数: {stats.total_blocks}")
        lines.append(f"- 运动代码块数: {stats.motion_blocks}")
        lines.append(f"- 快速移动次数: {stats.rapid_motions}")
        lines.append(f"- 切削移动次数: {stats.cutting_motions}")
        lines.append(f"- 换刀次数: {stats.tool_changes}")
        if stats.tools_used:
            lines.append(f"- 使用刀具: {', '.join(f'T{t}' for t in stats.tools_used)}")
        lines.append("")

        lines.append("**运动范围:**")
        lines.append(f"- X轴: {stats.min_x:.3f} ~ {stats.max_x:.3f}")
        lines.append(f"- Y轴: {stats.min_y:.3f} ~ {stats.max_y:.3f}")
        lines.append(f"- Z轴: {stats.min_z:.3f} ~ {stats.max_z:.3f}")
        lines.append("")
        lines.append("---")
        lines.append("")

        if self.violation_summary.violations:
            lines.append("## 违规详情")
            lines.append("")

            for category, violations in self.violation_summary.by_category.items():
                category_name = self._category_to_display_name(category)
                lines.append(f"### {category_name}")
                lines.append("")

                for i, v in enumerate(violations, 1):
                    severity_icon = self._severity_to_icon(v.severity)
                    lines.append(f"#### {severity_icon} 违规 #{i}")
                    lines.append("")
                    lines.append(f"- **消息**: {v.message}")
                    lines.append(f"- **行号**: {v.line_number}")
                    if v.raw_code:
                        lines.append(f"- **代码**: `{v.raw_code}`")
                    if v.position:
                        lines.append(f"- **位置**: ({v.position[0]:.3f}, {v.position[1]:.3f}, {v.position[2]:.3f})")
                    lines.append(f"- **时间**: {v.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")

                    review = self._find_review_for_violation(self.session.reviews, self.session.violations.index(v) if v in self.session.violations else -1)
                    if review:
                        lines.append("")
                        lines.append("**审核意见:**")
                        decision_text = self._decision_to_text(review.decision)
                        lines.append(f"- **决策**: {decision_text}")
                        if review.reason:
                            lines.append(f"- **原因**: {review.reason}")
                        if review.reviewer:
                            lines.append(f"- **审核人**: {review.reviewer}")

                    lines.append("")

        else:
            lines.append("## 违规详情")
            lines.append("")
            lines.append("✅ 未发现任何违规问题。")
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 配置信息")
        lines.append("")

        lines.append("### 机床配置")
        lines.append("")
        mc = self.session.machine_config
        lines.append(f"- 机床名称: {mc.name}")
        lines.append(f"- 描述: {mc.description}")
        lines.append("")
        lines.append("**行程限制:**")
        lines.append(f"- X轴: {mc.limits.x_min} ~ {mc.limits.x_max}")
        lines.append(f"- Y轴: {mc.limits.y_min} ~ {mc.limits.y_max}")
        lines.append(f"- Z轴: {mc.limits.z_min} ~ {mc.limits.z_max}")
        lines.append("")
        lines.append("**参数:**")
        lines.append(f"- 最大进给速度: {mc.max_feed_rate} mm/min")
        lines.append(f"- 最大主轴转速: {mc.max_spindle_speed} RPM")
        lines.append(f"- 默认快速移动: {mc.default_rapid_rate} mm/min")
        lines.append(f"- 安全高度: {mc.safe_height} mm")
        lines.append(f"- 换刀高度: {mc.tool_change_height} mm")
        lines.append("")

        if self.session.tools:
            lines.append("### 刀具表")
            lines.append("")
            lines.append("| 刀号 | 名称 | 类型 | 直径 | 长度 | 圆角半径 | 刃数 |")
            lines.append("|------|------|------|------|------|----------|------|")
            for tool in self.session.tools:
                lines.append(
                    f"| {tool.number} | {tool.name} | {tool.type} | {tool.diameter} | {tool.length} | {tool.radius} | {tool.flute_count} |"
                )
            lines.append("")

        if self.session.fixtures:
            lines.append("### 夹具配置")
            lines.append("")
            for fixture in self.session.fixtures:
                lines.append(f"**{fixture.name}**")
                lines.append(f"- 偏移: ({fixture.offset_x}, {fixture.offset_y}, {fixture.offset_z})")
                if fixture.min_x is not None and fixture.max_x is not None:
                    lines.append(f"- 边界 X: {fixture.min_x} ~ {fixture.max_x}")
                if fixture.min_y is not None and fixture.max_y is not None:
                    lines.append(f"- 边界 Y: {fixture.min_y} ~ {fixture.max_y}")
                if fixture.min_z is not None and fixture.max_z is not None:
                    lines.append(f"- 边界 Z: {fixture.min_z} ~ {fixture.max_z}")
                if fixture.description:
                    lines.append(f"- 描述: {fixture.description}")
                lines.append("")

        if self.session.workpiece:
            lines.append("### 毛坯尺寸")
            lines.append("")
            wp = self.session.workpiece
            lines.append(f"- 名称: {wp.name}")
            lines.append(f"- 尺寸 X: {wp.min_x} ~ {wp.max_x}")
            lines.append(f"- 尺寸 Y: {wp.min_y} ~ {wp.max_y}")
            lines.append(f"- 尺寸 Z: {wp.min_z} ~ {wp.max_z}")
            lines.append(f"- 原点偏移: ({wp.origin_x}, {wp.origin_y}, {wp.origin_z})")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此报告由刀路干运行守门员生成*")

        return "\n".join(lines)

    def _build_csv_rows(self) -> List[List[Any]]:
        header = [
            "序号",
            "严重程度",
            "类别",
            "消息",
            "行号",
            "原始代码",
            "位置X",
            "位置Y",
            "位置Z",
            "时间",
            "审核决策",
            "审核原因",
            "审核人",
        ]

        rows = [header]

        for i, v in enumerate(self.session.violations, 1):
            pos_x = v.position[0] if v.position else ""
            pos_y = v.position[1] if v.position else ""
            pos_z = v.position[2] if v.position else ""

            review = self._find_review_for_violation(self.session.reviews, i - 1)
            decision = self._decision_to_text(review.decision) if review else ""
            reason = review.reason if review else ""
            reviewer = review.reviewer if review else ""

            rows.append(
                [
                    i,
                    v.severity.value,
                    v.category.value,
                    v.message,
                    v.line_number,
                    v.raw_code,
                    pos_x,
                    pos_y,
                    pos_z,
                    v.timestamp.isoformat(),
                    decision,
                    reason,
                    reviewer,
                ]
            )

        return rows

    def _build_json_data(self) -> Dict[str, Any]:
        return {
            "report": {
                "generated_at": datetime.now().isoformat(),
                "version": "0.1.0",
            },
            "session": {
                "id": self.session.metadata.id,
                "name": self.session.metadata.name,
                "description": self.session.metadata.description,
                "created_at": self.session.metadata.created_at.isoformat(),
                "updated_at": self.session.metadata.updated_at.isoformat(),
                "status": self.session.metadata.status.value,
            },
            "summary": {
                "status": "blocked" if self.violation_summary.has_blocking_issues else "passed",
                "total_count": self.violation_summary.total_count,
                "critical_count": self.violation_summary.critical_count,
                "error_count": self.violation_summary.error_count,
                "warning_count": self.violation_summary.warning_count,
                "info_count": self.violation_summary.info_count,
                "by_category": {k.value: len(v) for k, v in self.violation_summary.by_category.items()},
            },
            "statistics": asdict(self.session.statistics),
            "violations": [
                {
                    "index": i,
                    "severity": v.severity.value,
                    "category": v.category.value,
                    "message": v.message,
                    "line_number": v.line_number,
                    "raw_code": v.raw_code,
                    "position": v.position,
                    "details": v.details,
                    "timestamp": v.timestamp.isoformat(),
                    "review": self._review_to_dict(
                        self._find_review_for_violation(self.session.reviews, i)
                    ),
                }
                for i, v in enumerate(self.session.violations)
            ],
            "machine_config": asdict(self.session.machine_config),
            "tools": [asdict(t) for t in self.session.tools],
            "fixtures": [asdict(f) for f in self.session.fixtures],
            "workpiece": asdict(self.session.workpiece) if self.session.workpiece else None,
        }

    def _category_to_display_name(self, category: RuleCategory) -> str:
        names = {
            RuleCategory.TRAVEL_LIMIT: "行程越界",
            RuleCategory.FEED_SPEED: "进给速度",
            RuleCategory.SPINDLE: "主轴转速",
            RuleCategory.TOOL: "刀具检查",
            RuleCategory.SAFETY_HEIGHT: "安全高度",
            RuleCategory.FIXTURE_COLLISION: "夹具碰撞",
            RuleCategory.PROGRAM_FLOW: "程序流程",
        }
        return names.get(category, category.value)

    def _severity_to_icon(self, severity: Severity) -> str:
        icons = {
            Severity.CRITICAL: "🔴",
            Severity.ERROR: "🟠",
            Severity.WARNING: "🟡",
            Severity.INFO: "ℹ️",
        }
        return icons.get(severity, "❓")

    def _decision_to_text(self, decision: ReviewDecision) -> str:
        texts = {
            ReviewDecision.APPROVE: "批准放行",
            ReviewDecision.REJECT: "拒绝",
            ReviewDecision.WAIVED: "豁免",
        }
        return texts.get(decision, decision.value)

    def _find_review_for_violation(
        self, reviews: List[ReviewItem], violation_index: int
    ) -> Optional[ReviewItem]:
        for review in reviews:
            if review.violation_index == violation_index:
                return review
        return None

    def _review_to_dict(self, review: Optional[ReviewItem]) -> Optional[Dict[str, Any]]:
        if not review:
            return None
        return {
            "violation_index": review.violation_index,
            "decision": review.decision.value,
            "reason": review.reason,
            "reviewer": review.reviewer,
            "timestamp": review.timestamp.isoformat(),
        }
