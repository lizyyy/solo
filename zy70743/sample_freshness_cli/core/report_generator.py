import uuid
from datetime import datetime
from typing import List
from core.models import Sample, RunResult, FixRecord, FreshnessReport, RunStatus, FixStatus
from core.checker import SampleChecker


class ReportGenerator:
    def __init__(self, checker: SampleChecker = None):
        self.checker = checker or SampleChecker()

    def generate_report(self, samples: List[Sample], results: List[RunResult],
                        fix_records: List[FixRecord]) -> FreshnessReport:
        total = len(samples)
        passed = sum(1 for r in results if r.status == RunStatus.PASSED)
        failed = sum(1 for r in results if r.status == RunStatus.FAILED)
        version_mismatch = sum(1 for r in results if not r.version_matched)

        fixed_count = sum(1 for f in fix_records if f.status == FixStatus.FIXED)
        fix_rate = fixed_count / max(failed, 1) if failed > 0 else 1.0

        avg_duration = sum(r.duration_ms for r in results) / max(len(results), 1)

        recommendations = self._generate_recommendations(results, samples)

        return FreshnessReport(
            report_id=f"report_{uuid.uuid4().hex[:8]}",
            generated_at=datetime.now(),
            total_samples=total,
            passed_samples=passed,
            failed_samples=failed,
            version_mismatch_count=version_mismatch,
            fix_rate=round(fix_rate, 2),
            average_duration_ms=int(avg_duration),
            sample_results=results,
            fix_records=fix_records,
            recommendations=recommendations
        )

    def _generate_recommendations(self, results: List[RunResult], samples: List[Sample]) -> List[str]:
        recommendations = []
        sample_map = {s.sample_id: s for s in samples}

        failed_count = sum(1 for r in results if r.status == RunStatus.FAILED)
        if failed_count > 0:
            recommendations.append(f"共有 {failed_count} 个样例运行失败，建议优先修复")

        version_mismatch = sum(1 for r in results if not r.version_matched)
        if version_mismatch > 0:
            recommendations.append(f"发现 {version_mismatch} 个版本不匹配的样例，请及时更新")

        api_changed = sum(1 for r in results if r.failure_category == "api_changed")
        if api_changed > 0:
            recommendations.append(f"有 {api_changed} 个样例因API字段变更失败，请更新代码样例")

        for result in results:
            if result.status == RunStatus.FAILED and result.sample_id in sample_map:
                sample = sample_map[result.sample_id]
                rec = self.checker.generate_fix_recommendation(result, sample)
                recommendations.append(f"[{sample.sample_id}] {rec}")

        return recommendations

    def generate_human_readable(self, report: FreshnessReport) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("           开发门户样例保鲜检查报告")
        lines.append("=" * 60)
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("概览统计")
        lines.append("-" * 60)
        lines.append(f"  总样例数: {report.total_samples}")
        lines.append(f"  通过数量: {report.passed_samples}")
        lines.append(f"  失败数量: {report.failed_samples}")
        lines.append(f"  版本不匹配: {report.version_mismatch_count}")
        lines.append(f"  修复率: {report.fix_rate * 100:.1f}%")
        lines.append(f"  平均耗时: {report.average_duration_ms}ms")
        lines.append("")
        lines.append("-" * 60)
        lines.append("样例运行详情")
        lines.append("-" * 60)

        for result in report.sample_results:
            status_icon = "✓" if result.status == RunStatus.PASSED else "✗"
            lines.append(f"  {status_icon} {result.sample_id} - {result.status.value}")
            lines.append(f"      耗时: {result.duration_ms}ms | 版本匹配: {'是' if result.version_matched else '否'}")
            if result.error_message:
                lines.append(f"      错误: {result.error_message}")
                lines.append(f"      分类: {result.failure_category.value if result.failure_category else 'N/A'}")

        lines.append("")
        lines.append("-" * 60)
        lines.append("修复记录")
        lines.append("-" * 60)

        if report.fix_records:
            for record in report.fix_records:
                lines.append(f"  [{record.status.value}] {record.sample_id}: {record.description}")
                if record.fixer:
                    lines.append(f"      修复人: {record.fixer}")
        else:
            lines.append("  暂无修复记录")

        lines.append("")
        lines.append("-" * 60)
        lines.append("修复建议")
        lines.append("-" * 60)

        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"  {i}. {rec}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
