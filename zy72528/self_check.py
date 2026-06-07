from typing import List, Dict, Any
from models import SelfCheckResult, SampleRecord, HistoryRecord
from errors import ExportMismatchError
import hashlib
import json


class SelfChecker:
    def __init__(self, samples: Dict[str, SampleRecord], history: List[HistoryRecord]):
        self.samples = samples
        self.history = history

    def run_all_checks(self) -> List[SelfCheckResult]:
        return [
            self.check_duplicate_import(),
            self.check_404_not_marked(),
            self.check_supplementary_recalculation(),
            self.check_export_consistency()
        ]

    def check_duplicate_import(self) -> SelfCheckResult:
        sample_ids = list(self.samples.keys())
        seen = set()
        duplicates = []
        for sid in sample_ids:
            if sid in seen:
                duplicates.append(sid)
            seen.add(sid)

        supplementary_ids = [s for s in self.samples.values() if s.supplementary_from]
        for sup in supplementary_ids:
            original_id = sup.supplementary_from
            if original_id not in self.samples:
                duplicates.append(f"{sup.sample_id} 的补录来源 {original_id} 不存在")

        if duplicates:
            return SelfCheckResult(
                check_type="重复导入检查",
                passed=False,
                message=f"发现 {len(duplicates)} 个重复导入或来源问题",
                details=duplicates
            )
        return SelfCheckResult(
            check_type="重复导入检查",
            passed=True,
            message="没有发现重复导入问题"
        )

    def check_404_not_marked(self) -> SelfCheckResult:
        problems = []
        for sample in self.samples.values():
            if sample.link_valid is False and sample.status.value != "待产品复核":
                problems.append(
                    f"样本 {sample.sample_id} 链接404但状态是 {sample.status.value}，应该是待产品复核"
                )
            if sample.link_valid is None and sample.status.value == "正常":
                problems.append(
                    f"样本 {sample.sample_id} 标记为正常但还没检测过链接有效性"
                )

        if problems:
            return SelfCheckResult(
                check_type="404链接标记检查",
                passed=False,
                message=f"发现 {len(problems)} 个404链接未正确标记",
                details=problems
            )
        return SelfCheckResult(
            check_type="404链接标记检查",
            passed=True,
            message="所有404链接都已正确标记为待产品复核"
        )

    def check_supplementary_recalculation(self) -> SelfCheckResult:
        problems = []
        supplementary_samples = [
            s for s in self.samples.values() if s.supplementary_from
        ]

        for sup in supplementary_samples:
            original_id = sup.supplementary_from
            if original_id in self.samples:
                original = self.samples[original_id]
                has_history = any(
                    h.sample_id == original_id and "补录" in h.action
                    for h in self.history
                )
                if not has_history:
                    problems.append(
                        f"补录样本 {sup.sample_id} 对应的原始样本 {original_id} 没有补录操作记录"
                    )

        if problems:
            return SelfCheckResult(
                check_type="补录后重算检查",
                passed=False,
                message=f"发现 {len(problems)} 个补录记录不一致",
                details=problems
            )
        return SelfCheckResult(
            check_type="补录后重算检查",
            passed=True,
            message="补录样本和原始样本的记录一致"
        )

    def check_export_consistency(self) -> SelfCheckResult:
        try:
            exported_data = [s.to_dict() for s in self.samples.values()]
            data_str = json.dumps(exported_data, sort_keys=True, ensure_ascii=False)
            export_hash = hashlib.md5(data_str.encode()).hexdigest()

            reconstructed = []
            for s in self.samples.values():
                reconstructed.append(s.to_dict())
            recon_str = json.dumps(reconstructed, sort_keys=True, ensure_ascii=False)
            recon_hash = hashlib.md5(recon_str.encode()).hexdigest()

            if export_hash != recon_hash:
                raise ExportMismatchError("导出数据哈希不一致")

            status_counts = {}
            for s in self.samples.values():
                status = s.status.value
                status_counts[status] = status_counts.get(status, 0) + 1

            details = [f"{k}: {v} 个" for k, v in status_counts.items()]
            details.append(f"导出校验哈希: {export_hash}")

            return SelfCheckResult(
                check_type="导出一致性检查",
                passed=True,
                message=f"共 {len(self.samples)} 个样本，导出数据一致",
                details=details
            )
        except Exception as e:
            return SelfCheckResult(
                check_type="导出一致性检查",
                passed=False,
                message=f"导出一致性检查失败: {str(e)}",
                details=[str(e)]
            )

    def generate_report(self) -> str:
        results = self.run_all_checks()
        passed = sum(1 for r in results if r.passed)
        total = len(results)

        report_lines = [
            "=" * 50,
            "代码解释幻觉标记 - 自检报告",
            "=" * 50,
            f"通过: {passed}/{total}",
            ""
        ]

        for result in results:
            status = "✅ 通过" if result.passed else "❌ 失败"
            report_lines.append(f"[{status}] {result.check_type}")
            report_lines.append(f"     说明: {result.message}")
            if result.details:
                for d in result.details:
                    report_lines.append(f"     - {d}")
            report_lines.append("")

        return "\n".join(report_lines)
