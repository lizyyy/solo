import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except (ImportError, OSError):
    HAS_LIGHTGBM = False

from claim_risk_scanner.features import FeatureSet
from claim_risk_scanner.rules import RuleEngine, RiskLevel


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    model_type: str = "randomforest"
    random_state: int = 42
    test_size: float = 0.2
    cv_folds: int = 5
    
    n_estimators: int = 100
    max_depth: int = 6
    learning_rate: float = 0.1
    min_samples_split: int = 2
    min_samples_leaf: int = 1
    
    class_weight: str = "balanced"
    use_scaler: bool = False
    
    feature_weights: Dict[str, float] = field(default_factory=lambda: {
        'exact_duplicate_count': 2.0,
        'amount_variation_score': 3.0,
        'risk_sample_match_score': 2.5,
        'item_amount_mismatch_score': 2.0,
        'tax_id_mismatch_score': 2.0,
        'duplicate_claim_count': 2.5,
        'date_variation_score': 2.0,
    })


@dataclass
class TrainingResult:
    model_path: str
    config: ModelConfig
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    confusion_matrix: List[List[int]]
    classification_report: Dict[str, Any]
    feature_importance: Dict[str, float]
    cv_scores: List[float]
    training_time: str
    timestamp: str
    train_samples: int
    test_samples: int


@dataclass
class PredictionResult:
    invoice_number: str
    risk_score: float
    risk_level: str
    risk_probability: float
    feature_contribution: Dict[str, float]
    top_features: List[Tuple[str, float]]
    model_confidence: float
    is_high_risk: bool
    threshold: float


class RiskModel:
    FEATURE_COLUMNS = [
        'amount_anomaly_score',
        'date_anomaly_score',
        'ocr_confidence_score',
        'item_amount_mismatch_score',
        'tax_ratio_anomaly_score',
        'amount_roundness_score',
        'risk_sample_match_score',
        'vendor_appearance_frequency',
        'vendor_risk_level_num',
        'name_variation_count',
        'tax_id_mismatch_score',
        'exact_duplicate_count',
        'partial_duplicate_count',
        'amount_variation_score',
        'date_variation_score',
        'duplicate_claim_count',
    ]
    
    def __init__(
        self, 
        model: Any = None, 
        scaler: Any = None,
        config: Optional[ModelConfig] = None
    ):
        self.model = model
        self.scaler = scaler
        self.config = config or ModelConfig()
        self.feature_names: List[str] = self.FEATURE_COLUMNS
        
    def preprocess(self, X: np.ndarray, fit: bool = False) -> np.ndarray:
        if self.config.use_scaler and self.scaler:
            if fit:
                return self.scaler.fit_transform(X)
            else:
                return self.scaler.transform(X)
        return X
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X_processed = self.preprocess(X, fit=False)
        
        if hasattr(self.model, 'predict_proba'):
            proba = self.model.predict_proba(X_processed)
            if proba.shape[1] == 2:
                return proba[:, 1]
            return proba
        
        return self.model.predict(X_processed)
    
    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        proba = self.predict_proba(X)
        return (proba >= threshold).astype(int)
    
    def get_feature_importance(self) -> Dict[str, float]:
        if self.model is None:
            return {}
        
        importance = {}
        
        if hasattr(self.model, 'feature_importances_'):
            for name, imp in zip(self.feature_names, self.model.feature_importances_):
                importance[name] = float(imp)
        elif hasattr(self.model, 'coef_'):
            for name, coef in zip(self.feature_names, self.model.coef_[0]):
                importance[name] = float(abs(coef))
        
        total = sum(importance.values()) if importance else 1.0
        return {k: v / total for k, v in importance.items()}
    
    def explain_prediction(
        self, 
        X: np.ndarray, 
        feature_vector: Dict[str, float]
    ) -> Dict[str, float]:
        importance = self.get_feature_importance()
        
        contribution = {}
        for feature_name in self.feature_names:
            feat_value = feature_vector.get(feature_name, 0.0)
            feat_importance = importance.get(feature_name, 0.0)
            weight = self.config.feature_weights.get(feature_name, 1.0)
            contribution[feature_name] = feat_value * feat_importance * weight
        
        return contribution
    
    def save(self, path: Path):
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        
        joblib.dump(self.model, path / "model.joblib")
        if self.scaler:
            joblib.dump(self.scaler, path / "scaler.joblib")
        
        config_dict = asdict(self.config)
        config_dict['feature_names'] = self.feature_names
        with open(path / "config.json", 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def load(cls, path: Path) -> 'RiskModel':
        path = Path(path)
        
        model = joblib.load(path / "model.joblib")
        
        scaler = None
        if (path / "scaler.joblib").exists():
            scaler = joblib.load(path / "scaler.joblib")
        
        config_dict = {}
        if (path / "config.json").exists():
            with open(path / "config.json", 'r', encoding='utf-8') as f:
                config_dict = json.load(f)
        
        config = ModelConfig(**{k: v for k, v in config_dict.items() 
                                if k in ModelConfig.__dataclass_fields__})
        
        risk_model = cls(model=model, scaler=scaler, config=config)
        if 'feature_names' in config_dict:
            risk_model.feature_names = config_dict['feature_names']
        
        return risk_model


class ModelTrainer:
    def __init__(self, config: Optional[ModelConfig] = None):
        self.config = config or ModelConfig()
        self.rule_engine = RuleEngine()
    
    def prepare_training_data(
        self, 
        feature_sets: List[FeatureSet],
        labels: Optional[List[int]] = None
    ) -> Tuple[pd.DataFrame, Optional[np.ndarray]]:
        records = []
        for fs in feature_sets:
            feat_vector = fs.to_feature_vector()
            record = {}
            for col in RiskModel.FEATURE_COLUMNS:
                record[col] = feat_vector.get(col, 0.0)
            records.append(record)
        
        X = pd.DataFrame(records)
        
        y = None
        if labels:
            y = np.array(labels)
        else:
            y = self._generate_pseudo_labels(feature_sets)
        
        return X, y
    
    def _generate_pseudo_labels(self, feature_sets: List[FeatureSet]) -> np.ndarray:
        labels = []
        
        for fs in feature_sets:
            rule_results = self.rule_engine.evaluate(fs)
            risk_info = self.rule_engine.calculate_risk_score(rule_results)
            
            score = risk_info['total_score']
            max_level = risk_info['max_risk_level']
            
            if max_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
                labels.append(1)
            elif score >= 0.6:
                labels.append(1)
            elif score >= 0.3:
                labels.append(1)
            else:
                labels.append(0)
        
        return np.array(labels)
    
    def _build_model(self):
        model_type = self.config.model_type.lower()
        
        if model_type == 'lightgbm' and HAS_LIGHTGBM:
            return lgb.LGBMClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                class_weight=self.config.class_weight,
                random_state=self.config.random_state,
                verbose=-1
            )
        elif model_type == 'randomforest':
            return RandomForestClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                min_samples_split=self.config.min_samples_split,
                min_samples_leaf=self.config.min_samples_leaf,
                class_weight=self.config.class_weight,
                random_state=self.config.random_state,
                n_jobs=-1
            )
        elif model_type == 'logistic':
            return LogisticRegression(
                class_weight=self.config.class_weight,
                random_state=self.config.random_state,
                max_iter=1000
            )
        else:
            logger.warning(f"模型类型 {model_type} 不可用，使用 RandomForest")
            return RandomForestClassifier(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                class_weight=self.config.class_weight,
                random_state=self.config.random_state,
                n_jobs=-1
            )
    
    def train(
        self,
        feature_sets: List[FeatureSet],
        labels: Optional[List[int]] = None,
        save_path: Optional[Path] = None
    ) -> TrainingResult:
        start_time = datetime.now()
        
        X, y = self.prepare_training_data(feature_sets, labels)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=self.config.test_size,
            random_state=self.config.random_state,
            stratify=y
        )
        
        model = self._build_model()
        scaler = None
        
        if self.config.use_scaler:
            scaler = StandardScaler()
            X_train = scaler.fit_transform(X_train)
            X_test = scaler.transform(X_test)
        else:
            X_train = X_train.values
            X_test = X_test.values
        
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X_test)[:, 1]
        else:
            y_proba = y_pred.astype(float)
        
        cv = StratifiedKFold(
            n_splits=self.config.cv_folds,
            shuffle=True,
            random_state=self.config.random_state
        )
        cv_scores = cross_val_score(
            model, X.values if not self.config.use_scaler else scaler.transform(X), 
            y, cv=cv, scoring='roc_auc'
        )
        
        risk_model = RiskModel(model=model, scaler=scaler, config=self.config)
        
        if save_path:
            risk_model.save(save_path)
        
        end_time = datetime.now()
        training_time = str(end_time - start_time)
        
        cm = confusion_matrix(y_test, y_pred).tolist()
        
        feature_importance = {}
        if hasattr(model, 'feature_importances_'):
            for name, imp in zip(X.columns, model.feature_importances_):
                feature_importance[name] = float(imp)
        elif hasattr(model, 'coef_'):
            for name, coef in zip(X.columns, model.coef_[0]):
                feature_importance[name] = float(abs(coef))
        
        return TrainingResult(
            model_path=str(save_path) if save_path else "",
            config=self.config,
            accuracy=float(accuracy_score(y_test, y_pred)),
            precision=float(precision_score(y_test, y_pred, zero_division=0)),
            recall=float(recall_score(y_test, y_pred, zero_division=0)),
            f1_score=float(f1_score(y_test, y_pred, zero_division=0)),
            roc_auc=float(roc_auc_score(y_test, y_proba) if len(np.unique(y_test)) > 1 else 0.5),
            confusion_matrix=cm,
            classification_report=classification_report(
                y_test, y_pred, 
                output_dict=True, 
                zero_division=0
            ),
            feature_importance=feature_importance,
            cv_scores=cv_scores.tolist(),
            training_time=training_time,
            timestamp=datetime.now().isoformat(),
            train_samples=len(X_train),
            test_samples=len(X_test)
        )
    
    def predict(
        self,
        model: RiskModel,
        feature_sets: List[FeatureSet],
        threshold: float = 0.5
    ) -> List[PredictionResult]:
        results = []
        
        X, _ = self.prepare_training_data(feature_sets)
        X_values = X.values
        
        if model.config.use_scaler and model.scaler:
            X_values = model.scaler.transform(X_values)
        
        probabilities = model.predict_proba(X_values)
        predictions = (probabilities >= threshold).astype(int)
        
        feature_importance = model.get_feature_importance()
        
        for idx, (fs, prob, pred) in enumerate(zip(feature_sets, probabilities, predictions)):
            feat_vector = fs.to_feature_vector()
            
            feature_contribution = {}
            for col in RiskModel.FEATURE_COLUMNS:
                feat_val = feat_vector.get(col, 0.0)
                feat_imp = feature_importance.get(col, 0.0)
                feature_contribution[col] = feat_val * feat_imp
            
            sorted_features = sorted(
                feature_contribution.items(),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:5]
            
            rule_results = self.rule_engine.evaluate(fs)
            rule_risk = self.rule_engine.calculate_risk_score(rule_results)
            
            combined_score = (prob * 0.6 + rule_risk['total_score'] * 0.4)
            
            if combined_score >= 0.7:
                risk_level = 'high'
            elif combined_score >= 0.4:
                risk_level = 'medium'
            else:
                risk_level = 'low'
            
            is_high_risk = combined_score >= threshold
            
            results.append(PredictionResult(
                invoice_number=fs.invoice_data.invoice_number,
                risk_score=float(combined_score),
                risk_level=risk_level,
                risk_probability=float(prob),
                feature_contribution=feature_contribution,
                top_features=[(f[0], float(f[1])) for f in sorted_features],
                model_confidence=float(prob if pred == 1 else 1 - prob),
                is_high_risk=is_high_risk,
                threshold=threshold
            ))
        
        return results
