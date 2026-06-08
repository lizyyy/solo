import json
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from collections import defaultdict
from .schemas import (
    SampleRecord, ModelPrediction, HumanReview, OnlineFeedback, EvaluationRecord
)


class DataLoader:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.samples_dir = os.path.join(data_dir, "samples")
        self.predictions_dir = os.path.join(data_dir, "model_outputs")
        self.reviews_dir = os.path.join(data_dir, "human_review")
        self.feedback_dir = os.path.join(data_dir, "online_feedback")

    def list_model_versions(self) -> List[str]:
        if not os.path.exists(self.predictions_dir):
            return []
        versions = []
        for item in os.listdir(self.predictions_dir):
            item_path = os.path.join(self.predictions_dir, item)
            if os.path.isdir(item_path):
                versions.append(item)
        return sorted(versions)

    def load_samples(self) -> List[SampleRecord]:
        samples = []
        if not os.path.exists(self.samples_dir):
            return samples
        for filename in os.listdir(self.samples_dir):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(self.samples_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    record = SampleRecord.from_dict(item)
                    samples.append(record)
            else:
                record = SampleRecord.from_dict(data)
                samples.append(record)
        return samples

    def load_predictions(self, model_version: str) -> List[ModelPrediction]:
        predictions = []
        version_dir = os.path.join(self.predictions_dir, model_version)
        if not os.path.exists(version_dir):
            return predictions
        for filename in os.listdir(version_dir):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(version_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    pred = ModelPrediction(**item)
                    predictions.append(pred)
            else:
                pred = ModelPrediction(**data)
                predictions.append(pred)
        return predictions

    def load_reviews(self) -> Dict[str, List[HumanReview]]:
        reviews = {}
        if not os.path.exists(self.reviews_dir):
            return reviews
        for filename in os.listdir(self.reviews_dir):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(self.reviews_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    review = HumanReview(**item)
                    if review.sample_id not in reviews:
                        reviews[review.sample_id] = []
                    reviews[review.sample_id].append(review)
            else:
                review = HumanReview(**data)
                if review.sample_id not in reviews:
                    reviews[review.sample_id] = []
                reviews[review.sample_id].append(review)
        for sid in reviews:
            reviews[sid].sort(key=lambda r: r.reviewed_at)
        return reviews

    def load_feedback(self) -> Dict[str, List[OnlineFeedback]]:
        feedback = {}
        if not os.path.exists(self.feedback_dir):
            return feedback
        for filename in os.listdir(self.feedback_dir):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(self.feedback_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    fb = OnlineFeedback(**item)
                    if fb.sample_id not in feedback:
                        feedback[fb.sample_id] = []
                    feedback[fb.sample_id].append(fb)
            else:
                fb = OnlineFeedback(**data)
                if fb.sample_id not in feedback:
                    feedback[fb.sample_id] = []
                feedback[fb.sample_id].append(fb)
        for sid in feedback:
            feedback[sid].sort(key=lambda f: f.collected_at)
        return feedback

    def load_evaluation_data(
        self, model_version: str
    ) -> Tuple[
        List[SampleRecord],
        List[ModelPrediction],
        Dict[str, List[HumanReview]],
        Dict[str, List[OnlineFeedback]]
    ]:
        samples = self.load_samples()
        predictions = self.load_predictions(model_version)
        reviews = self.load_reviews()
        feedback = self.load_feedback()
        return samples, predictions, reviews, feedback

    def build_evaluation_records(
        self,
        samples: List[SampleRecord],
        predictions: List[ModelPrediction],
        reviews: Dict[str, List[HumanReview]],
        feedback: Dict[str, List[OnlineFeedback]]
    ) -> List[EvaluationRecord]:
        pred_map = defaultdict(list)
        for pred in predictions:
            pred_map[pred.sample_id].append(pred)
        sample_map = defaultdict(list)
        for sample in samples:
            sample_map[sample.sample_id].append(sample)
        records = []
        seen = set()
        for sample in samples:
            sid = sample.sample_id
            if sid not in pred_map:
                continue
            for pred in pred_map[sid]:
                key = (sid, id(sample), id(pred))
                if key in seen:
                    continue
                seen.add(key)
                review_list = reviews.get(sid, [])
                latest_review = review_list[-1] if review_list else None
                feedback_list = feedback.get(sid, [])
                latest_feedback = feedback_list[-1] if feedback_list else None
                record = EvaluationRecord(
                    sample_id=sid,
                    sample=sample,
                    prediction=pred,
                    review=latest_review,
                    feedback=latest_feedback,
                    anomalies=[],
                    metrics={}
                )
                records.append(record)
        return records
