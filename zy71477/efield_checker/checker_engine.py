import json
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .data_models import (
    StudentSubmission,
    CheckReport,
    Issue,
    IssueType,
)
from .data_loader import DataLoader
from .electric_field import ElectricFieldCalculator
from .line_geometry import LineGeometryAnalyzer, LineAnalysis
from .direction_checker import DirectionChecker
from .density_checker import DensityChecker
from .line_traversal_checker import LineTraversalChecker


class EFieldChecker:
    def __init__(
        self,
        sampling_distance: float = 0.5,
        angle_threshold_degrees: float = 90.0,
        min_confidence_ratio: float = 0.6,
        charge_radius: float = 0.3,
        density_ratio_threshold: float = 2.0,
        grid_spacing: float = 1.0,
    ):
        self.sampling_distance = sampling_distance
        self.angle_threshold_degrees = angle_threshold_degrees
        self.min_confidence_ratio = min_confidence_ratio
        self.charge_radius = charge_radius
        self.density_ratio_threshold = density_ratio_threshold
        self.grid_spacing = grid_spacing

    def check_file(self, filepath: str) -> CheckReport:
        loader = DataLoader()
        submission, loader_issues = loader.load_submission(filepath)

        if submission is None:
            return CheckReport(
                submission_id="unknown",
                source_file=filepath,
                total_lines_checked=0,
                total_charges_checked=0,
                total_arrows_checked=0,
                issues=loader_issues,
                summary=self._summarize_issues(loader_issues),
            )

        return self.check_submission(submission, loader_issues)

    def check_submission(
        self,
        submission: StudentSubmission,
        pre_existing_issues: Optional[List[Issue]] = None,
    ) -> CheckReport:
        all_issues = pre_existing_issues.copy() if pre_existing_issues else []

        if not submission.charges:
            return CheckReport(
                submission_id=submission.submission_id,
                source_file=submission.source_file,
                total_lines_checked=len(submission.field_lines),
                total_charges_checked=0,
                total_arrows_checked=sum(len(l.arrows) for l in submission.field_lines),
                issues=all_issues,
                summary=self._summarize_issues(all_issues),
            )

        field_calculator = ElectricFieldCalculator(submission.charges)
        geometry_analyzer = LineGeometryAnalyzer(self.sampling_distance)
        direction_checker = DirectionChecker(
            field_calculator,
            geometry_analyzer,
            self.angle_threshold_degrees,
            self.min_confidence_ratio,
        )
        density_checker = DensityChecker(
            field_calculator,
            self.density_ratio_threshold,
            self.grid_spacing,
        )
        traversal_checker = LineTraversalChecker(
            self.charge_radius,
        )

        line_analyses: Dict[str, LineAnalysis] = {}
        for field_line in submission.field_lines:
            analysis = geometry_analyzer.analyze_line(field_line)
            line_analyses[field_line.line_id] = analysis

        for field_line in submission.field_lines:
            analysis = line_analyses[field_line.line_id]

            direction_issues = direction_checker.check_line_direction(
                field_line, analysis
            )
            all_issues.extend(direction_issues)

            traversal_issues = traversal_checker.check_line_traversal(
                field_line, analysis, submission.charges
            )
            all_issues.extend(traversal_issues)

        density_issues = density_checker.check_density(
            submission.field_lines, line_analyses, submission.charges
        )
        all_issues.extend(density_issues)

        total_arrows = sum(len(l.arrows) for l in submission.field_lines)

        return CheckReport(
            submission_id=submission.submission_id,
            source_file=submission.source_file,
            total_lines_checked=len(submission.field_lines),
            total_charges_checked=len(submission.charges),
            total_arrows_checked=total_arrows,
            issues=all_issues,
            summary=self._summarize_issues(all_issues),
        )

    def _summarize_issues(self, issues: List[Issue]) -> Dict[str, int]:
        summary = defaultdict(int)
        for issue in issues:
            summary[issue.issue_type.value] += 1
            summary[f"{issue.issue_type.value}_{issue.severity}"] += 1
        return dict(summary)

    def save_report(self, report: CheckReport, output_path: str):
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

    def print_report(self, report: CheckReport):
        print("=" * 70)
        print("电场线绘制检查报告")
        print("=" * 70)
        print(f"提交ID: {report.submission_id}")
        print(f"源文件: {report.source_file}")
        print(f"检查电场线: {report.total_lines_checked} 条")
        print(f"检查电荷: {report.total_charges_checked} 个")
        print(f"检查箭头: {report.total_arrows_checked} 个")
        print()

        if not report.issues:
            print("✓ 未发现任何问题，检查通过！")
            return

        print("-" * 70)
        print("问题汇总")
        print("-" * 70)
        for issue_type, count in sorted(report.summary.items()):
            if "_" not in issue_type or issue_type.count("_") == 0:
                type_name = self._get_type_name(issue_type)
                print(f"  {type_name}: {count} 个")

        print()
        print("-" * 70)
        print("问题详情（按类型分类）")
        print("-" * 70)

        issues_by_type: Dict[str, List[Issue]] = defaultdict(list)
        for issue in report.issues:
            issues_by_type[issue.issue_type.value].append(issue)

        for issue_type in IssueType:
            type_issues = issues_by_type.get(issue_type.value, [])
            if not type_issues:
                continue

            print()
            print(f"【{self._get_type_name(issue_type.value)}】")
            print(f"  共 {len(type_issues)} 个问题")
            print()

            for idx, issue in enumerate(type_issues, 1):
                severity_icon = "🔴" if issue.severity == "error" else "🟠" if issue.severity == "warning" else "⚪"
                print(f"  {idx}. {severity_icon} [{issue.severity.upper()}] {issue.description}")
                print(f"     业务解释: {issue.business_explanation}")
                if issue.source:
                    src_parts = [f"文件: {issue.source.source_file}"]
                    if issue.source.line_number:
                        src_parts.append(f"行号: {issue.source.line_number}")
                    if issue.source.student_id:
                        src_parts.append(f"学生ID: {issue.source.student_id}")
                    print(f"     来源: {' | '.join(src_parts)}")
                if issue.related_objects:
                    print(f"     关联对象: {', '.join(issue.related_objects)}")
                print()

    def _get_type_name(self, issue_type: str) -> str:
        name_map = {
            "direction_reversed": "方向颠倒（正负号反）",
            "line_traverses_charge": "线条穿电荷",
            "density_misjudged": "密度误判（疏密）",
            "bad_data": "坏数据",
            "data_conflict": "数据冲突",
        }
        return name_map.get(issue_type, issue_type)

    def get_methodology_explanation(self) -> str:
        parts = [
            "电场线绘制检查方法说明",
            "=" * 50,
            "",
            "1. 电荷识别与电场计算",
            "   " + ElectricFieldCalculator.get_business_explanation(ElectricFieldCalculator([])),
            "",
            "2. 线条采样与几何分析",
            "   " + LineGeometryAnalyzer.get_business_explanation(LineGeometryAnalyzer()),
            "",
            "3. 方向校验（正负号反检测）",
            "   " + DirectionChecker.get_business_explanation(DirectionChecker(ElectricFieldCalculator([]), LineGeometryAnalyzer())),
            "",
            "4. 密度校验（疏密误判检测）",
            "   " + DensityChecker.get_business_explanation(DensityChecker(ElectricFieldCalculator([]))),
            "",
            "5. 线条穿电荷检测",
            "   " + LineTraversalChecker.get_business_explanation(LineTraversalChecker()),
            "",
            "6. 坏数据处理原则",
            "   - 遇到格式错误、缺失字段、无效数值时，不静默忽略，全部记录为问题",
            "   - 保留原始数据行、原始内容，便于溯源",
            "   - 数据冲突时（如magnitude为负），仅记录问题，不自动修正",
            "   - 所有问题均标注来源文件、行号（如有）、原始内容",
        ]
        return "\n".join(parts)
