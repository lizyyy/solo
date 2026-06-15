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

        negative_output_path = self.output_dir / "negative_samples_processed.csv"
        DataLoader.save_data(self.negative_samples, str(negative_output_path))

        output_path = self.output_dir / "recall_candidates_processed.csv"
        DataLoader.save_data(self.recall_candidates, str(output_path))

        self.step_completed["step2_review_recall"] = True

        return {
            "total_imported": len(self.recall_candidates),
            "duplicate_groups": len(dup_info),
            "duplicate_items": sum(d["count"] for d in dup_info),
            "cross_duplicates": len(cross_dups),
            "negative_output_path": str(negative_output_path),
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
        samples_by_key: Dict[Tuple[str, str], NegativeSample] = {}
        for s in self.negative_samples:
            key = (s.batch_id, s.item_id)
            if key not in samples_by_key:
                samples_by_key[key] = s

        candidates_by_key: Dict[Tuple[str, str], RecallCandidate] = {}
        for c in self.recall_candidates:
            key = (c.batch_id, c.item_id)
            if key not in candidates_by_key:
                candidates_by_key[key] = c

        existing_by_key: Dict[Tuple[str, str], FeatureVersion] = {}
        for v in self.feature_versions:
            existing_by_key[(v.batch_id, v.item_id)] = v

        version_counter = len(self.feature_versions) + 1
        all_keys = set(samples_by_key.keys()) | set(candidates_by_key.keys())

        for key in all_keys:
            batch_id, item_id = key
            sample = samples_by_key.get(key)
            candidate = candidates_by_key.get(key)
            existing = existing_by_key.get(key)

            status = self._merge_status(sample, candidate)
            reason = self._generate_reason_kept(sample, candidate)
            missing = self._determine_missing_materials(sample, candidate)
            next_owner = self._determine_next_owner(status, missing)
            remarks_parts = self._build_remarks(sample, candidate)

            if existing:
                existing.status = status
                existing.reason_kept = reason
                existing.missing_materials = missing
                existing.next_owner = next_owner
                existing.updated_at = datetime.now()
                if sample and not existing.linked_sample_id:
                    existing.linked_sample_id = sample.sample_id
                if candidate and not existing.linked_candidate_id:
                    existing.linked_candidate_id = candidate.candidate_id
                merged_remarks = " ".join(remarks_parts)
                if merged_remarks and merged_remarks not in existing.remarks:
                    if existing.remarks and existing.remarks not in ("", "nan"):
                        existing.remarks = existing.remarks + " " + merged_remarks
                    else:
                        existing.remarks = merged_remarks
            else:
                feature_name = self._build_feature_name(sample, candidate)
                version = FeatureVersion(
                    version_id=f"v{version_counter}",
                    feature_name=feature_name,
                    batch_id=batch_id,
                    item_id=item_id,
                    reason_kept=reason,
                    missing_materials=missing,
                    next_owner=next_owner,
                    status=status,
                    linked_sample_id=sample.sample_id if sample else None,
                    linked_candidate_id=candidate.candidate_id if candidate else None,
                    remarks=" ".join(remarks_parts),
                )
                self.feature_versions.append(version)
                existing_by_key[key] = version
                version_counter += 1

    def _merge_status(
        self,
        sample: Optional[NegativeSample],
        candidate: Optional[RecallCandidate],
    ) -> DataStatus:
        statuses: List[DataStatus] = []
        if sample:
            statuses.append(sample.status)
        if candidate:
            statuses.append(candidate.status)
        priority_order = [
            DataStatus.STRATEGY_REVIEW,
            DataStatus.DUPLICATE,
            DataStatus.NEEDS_MORE_INFO,
            DataStatus.PENDING,
            DataStatus.NORMAL,
            DataStatus.CONFIRMED,
        ]
        for s in priority_order:
            if s in statuses:
                return s
        return DataStatus.PENDING

    def _build_feature_name(
        self,
        sample: Optional[NegativeSample],
        candidate: Optional[RecallCandidate],
    ) -> str:
        parts = []
        if sample:
            parts.append(f"特征_{sample.feature_version}")
        if candidate:
            parts.append(f"recall_{candidate.recall_strategy}")
        return "+".join(parts) if parts else "特征_未知"

    def _build_remarks(
        self,
        sample: Optional[NegativeSample],
        candidate: Optional[RecallCandidate],
    ) -> List[str]:
        parts = []
        if sample:
            src_note = f"来源：负样本列表。{sample.remarks if sample.remarks and sample.remarks != 'nan' else ''}"
            parts.append(src_note.strip())
        if candidate:
            src_note = f"来源：召回候选表。{candidate.remarks if candidate.remarks and candidate.remarks != 'nan' else ''}"
            parts.append(src_note.strip())
        return [p for p in parts if p]

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

        merged_status = self._merge_status(sample, candidate)
        if merged_status == DataStatus.STRATEGY_REVIEW:
            reasons.append("存在重复训练风险（含表内或跨表交叉重复），待策略产品复核")
        else:
            reasons.append("初检正常，待进一步确认")

        return "；".join(reasons)

    def _determine_missing_materials(
        self, sample: Optional[NegativeSample], candidate: Optional[RecallCandidate]
    ) -> List[str]:
        missing = []
        if sample and (not sample.feature_version or sample.feature_version == "nan"):
            missing.append("特征版本号")
        if candidate and candidate.recall_score == 0:
            missing.append("召回分数确认")

        merged_status = self._merge_status(sample, candidate)
        if merged_status in (DataStatus.STRATEGY_REVIEW, DataStatus.DUPLICATE):
            missing.append("策略产品复核结论")
        return missing

    def _determine_next_owner(
        self, status: DataStatus, missing_materials: List[str]
    ) -> NextOwner:
        if "策略产品复核结论" in missing_materials:
            return NextOwner.STRATEGY_PM
        if status in (DataStatus.STRATEGY_REVIEW, DataStatus.DUPLICATE):
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
