from typing import List, Optional, Dict, Tuple
import pandas as pd
from pathlib import Path
from datetime import datetime

from .models import (
    NegativeSample,
    RecallCandidate,
    FeatureVersion,
    DataStatus,
    NextOwner,
)
from .detector import DuplicateDetector


class DataLoader:
    @staticmethod
    def load_negative_samples(file_path: str) -> List[NegativeSample]:
        path = Path(file_path)
        if path.suffix == ".csv":
            df = pd.read_csv(path)
        elif path.suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        samples = []
        for _, row in df.iterrows():
            sample = NegativeSample.from_dict(row.to_dict())
            samples.append(sample)
        return samples

    @staticmethod
    def load_recall_candidates(file_path: str) -> List[RecallCandidate]:
        path = Path(file_path)
        if path.suffix == ".csv":
            df = pd.read_csv(path)
        elif path.suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        candidates = []
        for _, row in df.iterrows():
            candidate = RecallCandidate.from_dict(row.to_dict())
            candidates.append(candidate)
        return candidates

    @staticmethod
    def load_feature_versions(file_path: str) -> List[FeatureVersion]:
        path = Path(file_path)
        if path.suffix == ".csv":
            df = pd.read_csv(path)
        elif path.suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        versions = []
        for _, row in df.iterrows():
            version = FeatureVersion.from_dict(row.to_dict())
            versions.append(version)
        return versions

    @staticmethod
    def save_data(items: List, file_path: str):
        if not items:
            return

        path = Path(file_path)
        data = [item.to_dict() for item in items]
        df = pd.DataFrame(data)

        if path.suffix == ".csv":
            df.to_csv(path, index=False, encoding="utf-8-sig")
        elif path.suffix in [".xlsx", ".xls"]:
            df.to_excel(path, index=False)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")


class EvaluationWorkflow:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.negative_samples: List[NegativeSample] = []
        self.recall_candidates: List[RecallCandidate] = []
        self.feature_versions: List[FeatureVersion] = []
        self.detector = DuplicateDetector()

        self.step_completed: Dict[str, bool] = {
            "step1_import_negative": False,
            "step2_review_recall": False,
            "step3_update_feature": False,
        }

    def step1_import_negative_samples(
        self, file_path: str, auto_detect: bool = True
    ) -> Dict:
        self.negative_samples = DataLoader.load_negative_samples(file_path)

        if auto_detect:
            self.negative_samples, dup_info = self.detector.detect_in_negative_samples(
                self.negative_samples
            )
            self.negative_samples, _ = self.detector.mark_for_strategy_review(
                self.negative_samples, []
            )
        else:
            dup_info = []

        output_path = self.output_dir / "negative_samples_processed.csv"
        DataLoader.save_data(self.negative_samples, str(output_path))

        self.step_completed["step1_import_negative"] = True

        return {
            "total_imported": len(self.negative_samples),
            "duplicate_groups": len(dup_info),
            "duplicate_items": sum(d["count"] for d in dup_info),
            "output_path": str(output_path),
            "duplicates": dup_info,
        }

    def step2_import_and_review_recall_candidates(
        self, file_path: str, auto_link: bool = True
    ) -> Dict:
        if not self.step_completed["step1_import_negative"]:
            raise RuntimeError("请先执行步骤1：导入负样本列表")

        self.recall_candidates = DataLoader.load_recall_candidates(file_path)

        self.recall_candidates, dup_info = self.detector.detect_in_recall_candidates(
            self.recall_candidates
        )
        _, self.recall_candidates = self.detector.mark_for_strategy_review(
            [], self.recall_candidates
        )

        cross_dups = self.detector.detect_cross_duplicates(
            self.negative_samples, self.recall_candidates
        )

        if auto_link:
            self._link_samples_and_candidates()

        output_path = self.output_dir / "recall_candidates_processed.csv"
        DataLoader.save_data(self.recall_candidates, str(output_path))

        self.step_completed["step2_review_recall"] = True

        return {
            "total_imported": len(self.recall_candidates),
            "duplicate_groups": len(dup_info),
            "duplicate_items": sum(d["count"] for d in dup_info),
            "cross_duplicates": len(cross_dups),
            "output_path": str(output_path),
            "duplicates": dup_info,
            "cross_duplicate_details": cross_dups,
        }

    def _link_samples_and_candidates(self):
        sample_map: Dict[Tuple[str, str], NegativeSample] = {}
        for s in self.negative_samples:
            key = (s.batch_id, s.item_id)
            if key not in sample_map:
                sample_map[key] = s

        for c in self.recall_candidates:
            key = (c.batch_id, c.item_id)
            if key in sample_map:
                c.linked_sample_id = sample_map[key].sample_id

    def step3_update_feature_versions(
        self,
        existing_versions: Optional[List[FeatureVersion]] = None,
        existing_file: Optional[str] = None,
    ) -> Dict:
        if not self.step_completed["step2_review_recall"]:
            raise RuntimeError("请先执行步骤2：导入并复核召回候选表")

        if existing_file:
            self.feature_versions = DataLoader.load_feature_versions(existing_file)
        elif existing_versions:
            self.feature_versions = existing_versions

        self._sync_from_samples_and_candidates()

        output_path = self.output_dir / "feature_versions_updated.csv"
        DataLoader.save_data(self.feature_versions, str(output_path))

        self.step_completed["step3_update_feature"] = True

        return {
            "total_versions": len(self.feature_versions),
            "pending_review": sum(
                1
                for v in self.feature_versions
                if v.status == DataStatus.STRATEGY_REVIEW
            ),
            "needs_ayue_review": sum(
                1
                for v in self.feature_versions
                if v.next_owner == NextOwner.EXPERIMENT_PLATFORM
            ),
            "output_path": str(output_path),
        }

    def _sync_from_samples_and_candidates(self):
        existing_keys = {
            (v.batch_id, v.item_id, v.version_id) for v in self.feature_versions
        }
        version_counter = len(self.feature_versions) + 1

        for sample in self.negative_samples:
            key = (sample.batch_id, sample.item_id, f"v{version_counter}")
            if (sample.batch_id, sample.item_id) not in {
                (v.batch_id, v.item_id) for v in self.feature_versions
            }:
                status = sample.status
                reason = self._generate_reason_kept(sample, None)
                missing = self._determine_missing_materials(sample, None)
                next_owner = self._determine_next_owner(status, missing)

                version = FeatureVersion(
                    version_id=f"v{version_counter}",
                    feature_name=f"特征_{sample.feature_version}",
                    batch_id=sample.batch_id,
                    item_id=sample.item_id,
                    reason_kept=reason,
                    missing_materials=missing,
                    next_owner=next_owner,
                    status=status,
                    linked_sample_id=sample.sample_id,
                    remarks=f"来源：负样本列表。{sample.remarks}",
                )
                self.feature_versions.append(version)
                version_counter += 1

        for candidate in self.recall_candidates:
            existing_versions_for_item = [
                v
                for v in self.feature_versions
                if v.batch_id == candidate.batch_id and v.item_id == candidate.item_id
            ]

            if existing_versions_for_item:
                for v in existing_versions_for_item:
                    if not v.linked_candidate_id:
                        v.linked_candidate_id = candidate.candidate_id
                    v.updated_at = datetime.now()
                    if candidate.status == DataStatus.STRATEGY_REVIEW:
                        v.status = DataStatus.STRATEGY_REVIEW
                        recall_msg = f" 召回候选表状态：{candidate.remarks}"
                        if recall_msg not in v.remarks:
                            v.remarks += recall_msg
            else:
                status = candidate.status
                reason = self._generate_reason_kept(None, candidate)
                missing = self._determine_missing_materials(None, candidate)
                next_owner = self._determine_next_owner(status, missing)

                version = FeatureVersion(
                    version_id=f"v{version_counter}",
                    feature_name=f"特征_recall_{candidate.recall_strategy}",
                    batch_id=candidate.batch_id,
                    item_id=candidate.item_id,
                    reason_kept=reason,
                    missing_materials=missing,
                    next_owner=next_owner,
                    status=status,
                    linked_candidate_id=candidate.candidate_id,
                    remarks=f"来源：召回候选表。{candidate.remarks}",
                )
                self.feature_versions.append(version)
                version_counter += 1

    def _generate_reason_kept(
        self, sample: Optional[NegativeSample], candidate: Optional[RecallCandidate]
    ) -> str:
        reasons = []
        if sample:
            reasons.append(f"负样本来源：{sample.source}")
        if candidate:
            reasons.append(
                f"召回策略：{candidate.recall_strategy}，排名：{candidate.rank}"
            )

        if sample and sample.status == DataStatus.STRATEGY_REVIEW:
            reasons.append("存在重复训练风险，待策略产品复核")
        elif candidate and candidate.status == DataStatus.STRATEGY_REVIEW:
            reasons.append("存在重复训练风险，待策略产品复核")
        else:
            reasons.append("初检正常，待进一步确认")

        return "；".join(reasons)

    def _determine_missing_materials(
        self, sample: Optional[NegativeSample], candidate: Optional[RecallCandidate]
    ) -> List[str]:
        missing = []
        if sample and not sample.feature_version:
            missing.append("特征版本号")
        if candidate and candidate.recall_score == 0:
            missing.append("召回分数确认")
        if (sample and sample.status == DataStatus.STRATEGY_REVIEW) or (
            candidate and candidate.status == DataStatus.STRATEGY_REVIEW
        ):
            missing.append("策略产品复核结论")
        return missing

    def _determine_next_owner(
        self, status: DataStatus, missing_materials: List[str]
    ) -> NextOwner:
        if "策略产品复核结论" in missing_materials:
            return NextOwner.STRATEGY_PM
        if status == DataStatus.STRATEGY_REVIEW:
            return NextOwner.STRATEGY_PM
        return NextOwner.EXPERIMENT_PLATFORM

    def get_workflow_summary(self) -> Dict:
        return {
            "steps_completed": self.step_completed,
            "negative_samples_count": len(self.negative_samples),
            "recall_candidates_count": len(self.recall_candidates),
            "feature_versions_count": len(self.feature_versions),
            "duplicate_summary": self.detector.get_duplicate_summary(),
        }

    def get_dataframes(self) -> Dict[str, pd.DataFrame]:
        result = {}
        if self.negative_samples:
            result["negative_samples"] = pd.DataFrame(
                [s.to_dict() for s in self.negative_samples]
            )
        if self.recall_candidates:
            result["recall_candidates"] = pd.DataFrame(
                [c.to_dict() for c in self.recall_candidates]
            )
        if self.feature_versions:
            result["feature_versions"] = pd.DataFrame(
                [v.to_dict() for v in self.feature_versions]
            )
        return result
