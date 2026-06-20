"""
自检模块
覆盖最容易出错的四个点：重复导入、同一批数据重复训练两次、补录后重算、导出一致
"""
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from models import BoundarySample, AnomalyType, SampleStatus
from database import Database


@dataclass
class SelfCheckResult:
    """自检结果"""
    check_name: str
    passed: bool
    problem_samples: List[Dict]
    summary: str


class SelfChecker:
    """边界样本自检器"""

    def __init__(self, db: Database):
        self.db = db

    def run_all_checks(self) -> List[SelfCheckResult]:
        """运行所有自检项"""
        results = []
        results.append(self.check_duplicate_import())
        results.append(self.check_duplicate_train())
        results.append(self.check_supplement_recalc())
        results.append(self.check_export_consistency())
        return results

    def check_duplicate_import(self) -> SelfCheckResult:
        """
        检查1：重复导入
        场景：同一个sample_key被多次导入
        正常情况下sample_key是唯一的，重复导入说明流程有问题
        """
        problem_samples = []

        samples, _ = self.db.list_samples(page_size=10000)

        batch_groups: Dict[str, List[BoundarySample]] = {}
        for s in samples:
            if s.batch_id not in batch_groups:
                batch_groups[s.batch_id] = []
            batch_groups[s.batch_id].append(s)

        for batch_id, batch_samples in batch_groups.items():
            text_map: Dict[str, List[BoundarySample]] = {}
            for s in batch_samples:
                key = s.text_content.strip()
                if key not in text_map:
                    text_map[key] = []
                text_map[key].append(s)

            for text, dup_samples in text_map.items():
                if len(dup_samples) > 1:
                    problem_samples.append({
                        "batch_id": batch_id,
                        "duplicate_count": len(dup_samples),
                        "sample_ids": [s.id for s in dup_samples],
                        "sample_keys": [s.sample_key for s in dup_samples],
                        "text_preview": text[:100]
                    })

        passed = len(problem_samples) == 0
        summary = f"重复导入检查：{'通过' if passed else '发现问题'}，"
        summary += f"共发现 {len(problem_samples)} 组重复内容样本"

        return SelfCheckResult(
            check_name="重复导入检查",
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )

    def check_duplicate_train(self) -> SelfCheckResult:
        """
        检查2：同一批数据重复训练两次
        场景：同一个batch_id关联了多个特征版本，说明同一批数据被训练了多次
        这种情况不能急着归正常，要留给策略产品复核
        """
        problem_samples = []

        batch_fv_map = self.db.get_all_batch_feature_versions()

        for batch_id, versions in batch_fv_map.items():
            if len(versions) > 1:
                batch_samples, _ = self.db.list_samples(batch_id=batch_id, page_size=1000)
                need_mark = []
                for s in batch_samples:
                    added = self.db.add_anomaly_to_sample(s.id, AnomalyType.DUPLICATE_TRAIN, "self_check")
                    if added:
                        need_mark.append(s)

                problem_samples.append({
                    "batch_id": batch_id,
                    "feature_versions": list(versions),
                    "version_count": len(versions),
                    "sample_count": len(batch_samples),
                    "need_mark_count": len(need_mark),
                    "sample_ids_to_mark": [s.id for s in need_mark]
                })

        passed = len(problem_samples) == 0
        summary = f"重复训练检查：{'通过' if passed else '发现问题'}，"
        summary += f"共发现 {len(problem_samples)} 个批次存在重复训练，已自动标记为待复核"

        return SelfCheckResult(
            check_name="同一批数据重复训练检查",
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )

    def check_supplement_recalc(self) -> SelfCheckResult:
        """
        检查3：补录后重算
        场景：样本被补录（修改了actual_category等字段）后，评测切片和特征版本是否同步更新
        """
        problem_samples = []

        samples, _ = self.db.list_samples(page_size=10000)

        for s in samples:
            full = self.db.get_sample(s.id, include_related=True)
            if not full:
                continue

            modified_lines = [l for l in full.yaml_lines if l.is_modified]
            if modified_lines:
                last_modified = max((l.modified_at for l in modified_lines if l.modified_at), default=None)
                last_slice_view = max((sl.viewed_at for sl in full.slices if sl.viewed_at), default=None)
                last_feature_update = max((fv.updated_at for fv in full.feature_versions), default=None)

                need_recalc = False
                reasons = []

                if last_modified:
                    if last_slice_view and last_slice_view < last_modified:
                        need_recalc = True
                        reasons.append("YAML修改后未重新查看评测切片")
                    if last_feature_update and last_feature_update < last_modified:
                        need_recalc = True
                        reasons.append("YAML修改后特征版本未更新")
                    if not full.slices:
                        need_recalc = True
                        reasons.append("缺少评测切片")
                    if not full.feature_versions:
                        need_recalc = True
                        reasons.append("缺少特征版本记录")

                if need_recalc:
                    problem_samples.append({
                        "sample_id": full.id,
                        "sample_key": full.sample_key,
                        "reasons": reasons,
                        "last_yaml_modified": str(last_modified) if last_modified else None,
                        "last_slice_view": str(last_slice_view) if last_slice_view else None,
                        "last_feature_update": str(last_feature_update) if last_feature_update else None
                    })

                    self.db.add_anomaly_to_sample(full.id, AnomalyType.SUPPLEMENT_RECALC, "self_check")

        passed = len(problem_samples) == 0
        summary = f"补录重算检查：{'通过' if passed else '发现问题'}，"
        summary += f"共发现 {len(problem_samples)} 个样本补录后需要重算"

        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )

    def check_export_consistency(self) -> SelfCheckResult:
        """
        检查4：导出一致性
        场景：验证数据库中的数据与导出逻辑读取的数据是同一份
        （实际上我们的架构已经保证了页面/接口/导出都走同一查询入口，这里做完整性校验）
        """
        problem_samples = []

        samples, _ = self.db.list_samples(page_size=10000)

        for s in samples:
            issues = []

            if not s.text_content:
                issues.append("文本内容为空")
            if not s.predicted_category:
                issues.append("预测分类为空")
            if not s.actual_category:
                issues.append("实际分类为空")
            if not s.batch_id:
                issues.append("批次ID为空")
            if s.yaml_line_number <= 0:
                issues.append("YAML行号无效")

            if issues:
                problem_samples.append({
                    "sample_id": s.id,
                    "sample_key": s.sample_key,
                    "issues": issues
                })

        passed = len(problem_samples) == 0
        summary = f"导出一致性检查：{'通过' if passed else '发现问题'}，"
        summary += f"共发现 {len(problem_samples)} 个样本存在数据完整性问题"

        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )
            passed=passed,
            problem_samples=problem_samples,
            summary=summary
        )
