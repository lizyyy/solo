from typing import List, Optional, Tuple, Dict
from datetime import datetime
from models import (
    Sample, ModelOutput, Annotation, Supplement,
    ConfidenceLevel, SampleStatus, NextAction,
    ModelVersionCompare
)


class ConfidenceAnalyzer:
    LOW_THRESHOLD = 0.6
    AVG_WINDOW_SIZE = 10
    HIDDEN_THRESHOLD_DIFF = 0.15

    @classmethod
    def analyze_confidence(cls, samples: List[Sample]) -> Tuple[List[Sample], int, int]:
        low_conf_count = 0
        hidden_by_avg_count = 0

        if len(samples) <= cls.AVG_WINDOW_SIZE:
            avg_confidence = sum(
                s.model_outputs[-1].confidence if s.model_outputs else 0.5
                for s in samples
            ) / len(samples) if samples else 0.5
        else:
            sorted_samples = sorted(
                samples,
                key=lambda s: s.model_outputs[-1].confidence if s.model_outputs else 0.5,
                reverse=True
            )
            top_samples = sorted_samples[:cls.AVG_WINDOW_SIZE]
            avg_confidence = sum(
                s.model_outputs[-1].confidence if s.model_outputs else 0.5
                for s in top_samples
            ) / cls.AVG_WINDOW_SIZE

        for sample in samples:
            if not sample.model_outputs:
                continue

            current_conf = sample.model_outputs[-1].confidence

            if current_conf < cls.LOW_THRESHOLD:
                sample.confidence_level = ConfidenceLevel.LOW
                low_conf_count += 1

                if (avg_confidence - current_conf) >= cls.HIDDEN_THRESHOLD_DIFF:
                    sample.hidden_by_avg = True
                    sample.confidence_level = ConfidenceLevel.HIDDEN_BY_AVG
                    sample.status = SampleStatus.NEEDS_REVIEW
                    sample.next_action = NextAction.TO_KB_EDITOR
                    hidden_by_avg_count += 1
                else:
                    sample.hidden_by_avg = False
            elif current_conf >= 0.85:
                sample.confidence_level = ConfidenceLevel.HIGH
            else:
                sample.confidence_level = ConfidenceLevel.MEDIUM

            sample.updated_at = datetime.now()

        return samples, low_conf_count, hidden_by_avg_count


class ModelVersionComparator:
    @classmethod
    def compare_versions(
        cls,
        sample: Sample,
        baseline_version: str,
        current_version: str
    ) -> Optional[ModelVersionCompare]:
        baseline_output = None
        current_output = None

        for output in sample.model_outputs:
            if output.model_version == baseline_version:
                baseline_output = output
            if output.model_version == current_version:
                current_output = output

        if not baseline_output or not current_output:
            return None

        key_differences = cls._find_differences(
            baseline_output.summary,
            current_output.summary
        )

        confidence_diff = current_output.confidence - baseline_output.confidence

        reason_kept = cls._generate_reason_kept(
            sample, confidence_diff, key_differences
        )

        missing_materials = cls._identify_missing_materials(sample)

        next_action = cls._determine_next_action(
            sample, confidence_diff, key_differences
        )

        return ModelVersionCompare(
            sample_id=sample.sample_id,
            baseline_version=baseline_version,
            current_version=current_version,
            baseline_confidence=baseline_output.confidence,
            current_confidence=current_output.confidence,
            confidence_diff=confidence_diff,
            baseline_summary=baseline_output.summary,
            current_summary=current_output.summary,
            key_differences=key_differences,
            reason_kept=reason_kept,
            missing_materials=missing_materials,
            next_action=next_action,
            is_low_conf_hidden=sample.hidden_by_avg,
            needs_kb_review=sample.hidden_by_avg or sample.status == SampleStatus.NEEDS_REVIEW
        )

    @classmethod
    def _find_differences(cls, text1: str, text2: str) -> List[str]:
        differences = []
        words1 = set(text1.split())
        words2 = set(text2.split())

        only_in_old = words1 - words2
        only_in_new = words2 - words1

        if only_in_old:
            differences.append(f"旧版本特有内容: {', '.join(list(only_in_old)[:5])}")
        if only_in_new:
            differences.append(f"新版本特有内容: {', '.join(list(only_in_new)[:5])}")

        if len(text1) != len(text2):
            differences.append(f"摘要长度变化: {len(text1)} → {len(text2)} 字符")

        if not differences:
            differences.append("无显著差异")

        return differences

    @classmethod
    def _generate_reason_kept(
        cls,
        sample: Sample,
        confidence_diff: float,
        differences: List[str]
    ) -> str:
        reasons = []

        if sample.hidden_by_avg:
            reasons.append("低置信度样本被平均指标掩盖，需知识库编辑重点复核")

        if sample.annotations:
            latest_annotation = sample.annotations[-1]
            if latest_annotation.error_type:
                reasons.append(f"存在标注错误: {latest_annotation.error_type}")

        if confidence_diff < 0:
            reasons.append(f"置信度下降 {abs(confidence_diff):.2f}，新版本表现退步")
        elif confidence_diff > 0.1:
            reasons.append(f"置信度提升 {confidence_diff:.2f}，有优化效果但需验证")

        if len(differences) > 1:
            reasons.append("输出内容存在显著变化，需人工确认脱敏完整性")

        if not reasons:
            reasons.append("常规样本，保留用于模型效果监控")

        return "；".join(reasons)

    @classmethod
    def _identify_missing_materials(cls, sample: Sample) -> List[str]:
        missing = []

        if not sample.annotations:
            missing.append("缺少人工标注修正记录")

        if not sample.supplements:
            missing.append("缺少模型输出原始片段补录")

        if sample.hidden_by_avg and not sample.review_notes:
            missing.append("缺少知识库编辑复核意见")

        if len(sample.model_outputs) < 2:
            missing.append("缺少多版本模型输出对比数据")

        return missing

    @classmethod
    def _determine_next_action(
        cls,
        sample: Sample,
        confidence_diff: float,
        differences: List[str]
    ) -> NextAction:
        if sample.hidden_by_avg or sample.status == SampleStatus.NEEDS_REVIEW:
            if not sample.review_notes:
                return NextAction.TO_KB_EDITOR
            else:
                return NextAction.TO_ALGO_OPER

        if not sample.supplements:
            return NextAction.TO_ALGO_OPER

        if confidence_diff < -0.05 or len(differences) > 2:
            return NextAction.TO_MODEL_RETRAIN

        if not sample.annotations:
            return NextAction.TO_REANNOTATE

        return NextAction.TO_ALGO_OPER


class AnnotationWorkflow:
    @classmethod
    def add_annotation(
        cls,
        sample: Sample,
        annotator: str,
        corrected_summary: str,
        comment: str,
        error_type: Optional[str] = None
    ) -> Sample:
        annotation = Annotation(
            annotator=annotator,
            corrected_summary=corrected_summary,
            comment=comment,
            error_type=error_type
        )
        sample.annotations.append(annotation)
        sample.status = SampleStatus.ANNOTATED
        sample.updated_at = datetime.now()
        return sample

    @classmethod
    def add_supplement(
        cls,
        sample: Sample,
        operator: str,
        model_output_snippet: str,
        reason: str,
        additional_notes: Optional[str] = None
    ) -> Sample:
        supplement = Supplement(
            operator=operator,
            model_output_snippet=model_output_snippet,
            reason=reason,
            additional_notes=additional_notes
        )
        sample.supplements.append(supplement)
        sample.status = SampleStatus.SUPPLEMENTED
        sample.updated_at = datetime.now()
        return sample

    @classmethod
    def add_model_output(
        cls,
        sample: Sample,
        model_version: str,
        summary: str,
        confidence: float,
        entities: Optional[List[Dict]] = None,
        mask_details: Optional[List[Dict]] = None,
        raw_output: Optional[str] = None
    ) -> Sample:
        model_output = ModelOutput(
            model_version=model_version,
            summary=summary,
            confidence=confidence,
            entities=entities or [],
            mask_details=mask_details or [],
            raw_output=raw_output
        )
        sample.model_outputs.append(model_output)
        sample.updated_at = datetime.now()
        return sample

    @classmethod
    def escalate_for_review(
        cls,
        sample: Sample,
        reviewer_notes: str
    ) -> Sample:
        sample.status = SampleStatus.NEEDS_REVIEW
        sample.review_notes = reviewer_notes
        sample.next_action = NextAction.TO_KB_EDITOR
        sample.updated_at = datetime.now()
        return sample

    @classmethod
    def resolve_sample(
        cls,
        sample: Sample,
        resolution_notes: str
    ) -> Sample:
        sample.status = SampleStatus.RESOLVED
        if sample.review_notes:
            sample.review_notes += f" | 处理结果: {resolution_notes}"
        else:
            sample.review_notes = resolution_notes
        sample.updated_at = datetime.now()
        return sample
