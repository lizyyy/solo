import os
import jieba
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
import joblib

from config import MODELS_DIR, MODEL_CONFIG, RISK_LEVELS


@dataclass
class ClassificationResult:
    call_id: str
    predicted_risk: str
    confidence: float
    probabilities: Dict[str, float]
    important_features: List[Tuple[str, float]]


class TextClassifier:
    RISK_ORDER = ["低风险", "中风险", "高风险", "极高风险"]
    
    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = model_dir or MODELS_DIR
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.classifier: Optional[LogisticRegression] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self._is_trained = False
    
    def _tokenize(self, text: str) -> List[str]:
        return list(jieba.cut(text))
    
    def train(self, texts: List[str], labels: List[str]) -> Dict:
        if len(texts) != len(labels):
            raise ValueError("文本数量和标签数量不匹配")
        
        if len(texts) < 2:
            raise ValueError("训练数据至少需要2个样本")
        
        self.vectorizer = TfidfVectorizer(
            tokenizer=self._tokenize,
            token_pattern=None,
            **MODEL_CONFIG["vectorizer"]
        )
        
        X = self.vectorizer.fit_transform(texts)
        
        self.label_encoder = LabelEncoder()
        self.label_encoder.classes_ = np.array(self.RISK_ORDER)
        y = self.label_encoder.transform(labels)
        
        self.classifier = LogisticRegression(
            multi_class='multinomial',
            **MODEL_CONFIG["classifier"]
        )
        self.classifier.fit(X, y)
        
        self._is_trained = True
        
        train_predictions = self.classifier.predict(X)
        accuracy = (train_predictions == y).mean()
        
        return {
            "total_samples": len(texts),
            "vocab_size": len(self.vectorizer.vocabulary_),
            "train_accuracy": round(accuracy, 4)
        }
    
    def predict(self, text: str, call_id: str = "") -> ClassificationResult:
        if not self._is_trained:
            raise RuntimeError("模型尚未训练，请先调用 train() 或 load_model()")
        
        X = self.vectorizer.transform([text])
        
        probabilities = self.classifier.predict_proba(X)[0]
        predicted_idx = self.classifier.predict(X)[0]
        predicted_risk = self.label_encoder.inverse_transform([predicted_idx])[0]
        confidence = float(probabilities[predicted_idx])
        
        prob_dict = {}
        for i, risk_level in enumerate(self.label_encoder.classes_):
            prob_dict[risk_level] = round(float(probabilities[i]), 4)
        
        important_features = self._get_important_features(text, predicted_idx)
        
        return ClassificationResult(
            call_id=call_id,
            predicted_risk=predicted_risk,
            confidence=round(confidence, 4),
            probabilities=prob_dict,
            important_features=important_features
        )
    
    def _get_important_features(self, text: str, class_idx: int) -> List[Tuple[str, float]]:
        if self.vectorizer is None or self.classifier is None:
            return []
        
        X = self.vectorizer.transform([text])
        feature_names = self.vectorizer.get_feature_names_out()
        coef = self.classifier.coef_[class_idx]
        
        non_zero_indices = X.indices
        important_features = []
        
        for idx in non_zero_indices:
            feature_name = feature_names[idx]
            weight = coef[idx] * X[0, idx]
            if abs(weight) > 0.001:
                important_features.append((feature_name, round(weight, 4)))
        
        important_features.sort(key=lambda x: abs(x[1]), reverse=True)
        
        return important_features[:10]
    
    def save_model(self, model_name: str = "risk_classifier") -> Dict:
        if not self._is_trained:
            raise RuntimeError("模型尚未训练，无法保存")
        
        model_path = self.model_dir / model_name
        
        joblib.dump(self.vectorizer, model_path.with_suffix(".vectorizer"))
        joblib.dump(self.classifier, model_path.with_suffix(".classifier"))
        joblib.dump(self.label_encoder, model_path.with_suffix(".encoder"))
        
        return {
            "vectorizer_path": str(model_path.with_suffix(".vectorizer")),
            "classifier_path": str(model_path.with_suffix(".classifier")),
            "encoder_path": str(model_path.with_suffix(".encoder"))
        }
    
    def load_model(self, model_name: str = "risk_classifier") -> bool:
        model_path = self.model_dir / model_name
        
        vectorizer_path = model_path.with_suffix(".vectorizer")
        classifier_path = model_path.with_suffix(".classifier")
        encoder_path = model_path.with_suffix(".encoder")
        
        if not all(p.exists() for p in [vectorizer_path, classifier_path, encoder_path]):
            return False
        
        self.vectorizer = joblib.load(vectorizer_path)
        self.classifier = joblib.load(classifier_path)
        self.label_encoder = joblib.load(encoder_path)
        self._is_trained = True
        
        return True
    
    def is_trained(self) -> bool:
        return self._is_trained
    
    def get_model_info(self) -> Dict:
        if not self._is_trained:
            return {"status": "not_trained"}
        
        return {
            "status": "trained",
            "vocab_size": len(self.vectorizer.vocabulary_),
            "classes": list(self.label_encoder.classes_),
            "model_type": type(self.classifier).__name__
        }


def get_default_training_data() -> Tuple[List[str], List[str]]:
    texts = []
    labels = []
    
    low_risk_texts = [
        "我最近心情有点低落，想找人聊聊。",
        "工作压力有点大，但是还好，我能应付。",
        "就是觉得有点孤独，想找个人说说话。",
        "最近睡眠不太好，有点失眠。",
        "和朋友吵架了，心情不好。"
    ]
    texts.extend(low_risk_texts)
    labels.extend(["低风险"] * len(low_risk_texts))
    
    medium_risk_texts = [
        "我最近很抑郁，什么都不想做。",
        "感觉活着好累，压力好大。",
        "我被家暴了，不知道该怎么办。",
        "和男朋友分手了，我很难过。",
        "经常失眠，焦虑不安。"
    ]
    texts.extend(medium_risk_texts)
    labels.extend(["中风险"] * len(medium_risk_texts))
    
    high_risk_texts = [
        "我真的不想活了，活着太痛苦了。",
        "有时候真的想结束这一切，太累了。",
        "我觉得活着没有意义，很绝望。",
        "最近一直在想自杀的事情，控制不住。",
        "真的很无助，没有人能帮我。"
    ]
    texts.extend(high_risk_texts)
    labels.extend(["高风险"] * len(high_risk_texts))
    
    extreme_risk_texts = [
        "我已经准备好割腕了，活着没意思。",
        "今天就是我活着的最后一天，我安排好了一切。",
        "我买了药，准备离开这个世界。",
        "我站在楼顶，马上就要跳下去了。",
        "我已经写好了遗书，再见了这个世界。"
    ]
    texts.extend(extreme_risk_texts)
    labels.extend(["极高风险"] * len(extreme_risk_texts))
    
    return texts, labels
