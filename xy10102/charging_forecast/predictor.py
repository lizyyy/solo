import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error,
    r2_score, mean_absolute_percentage_error
)
import joblib
from .config import Config
from .feature_engineer import FeatureResult


@dataclass
class PredictionResult:
    model: Any
    predictions: np.ndarray
    actual_values: np.ndarray
    timestamps: Optional[pd.DatetimeIndex]
    metrics: Dict[str, float] = field(default_factory=dict)
    feature_importance: Dict[str, float] = field(default_factory=dict)
    train_indices: np.ndarray = None
    test_indices: np.ndarray = None


class LoadPredictor:
    def __init__(self, config: Config):
        self.config = config
        self.model_config = config.model

    def train(self, features: FeatureResult, timestamps: Optional[pd.DatetimeIndex] = None) -> PredictionResult:
        X = features.features.values
        y = features.target.values
        feature_names = features.feature_names
        
        if self.model_config.random_state is not None:
            np.random.seed(self.model_config.random_state)
        
        test_size = self.model_config.test_size
        n_samples = len(X)
        n_test = int(n_samples * test_size)
        n_train = n_samples - n_test
        
        train_indices = np.arange(n_train)
        test_indices = np.arange(n_train, n_samples)
        
        X_train, X_test = X[train_indices], X[test_indices]
        y_train, y_test = y[train_indices], y[test_indices]
        
        model = self._create_model()
        model.fit(X_train, y_train)
        
        predictions = model.predict(X_test)
        
        metrics = self._calculate_metrics(y_test, predictions)
        
        feature_importance = {}
        if hasattr(model, 'feature_importances_'):
            for name, importance in zip(feature_names, model.feature_importances_):
                feature_importance[name] = float(importance)
        
        cv_scores = cross_val_score(
            model, X, y, cv=5,
            scoring='neg_mean_squared_error'
        )
        metrics['cv_rmse_mean'] = float(np.sqrt(-cv_scores).mean())
        metrics['cv_rmse_std'] = float(np.sqrt(-cv_scores).std())
        
        test_timestamps = timestamps[n_train:] if timestamps is not None else None
        
        return PredictionResult(
            model=model,
            predictions=predictions,
            actual_values=y_test,
            timestamps=test_timestamps,
            metrics=metrics,
            feature_importance=feature_importance,
            train_indices=train_indices,
            test_indices=test_indices
        )

    def predict(self, model: Any, features: pd.DataFrame) -> np.ndarray:
        return model.predict(features.values)

    def _create_model(self):
        model_type = self.model_config.type
        params = self.model_config.parameters.copy()
        
        if self.model_config.random_state is not None:
            params['random_state'] = self.model_config.random_state
        
        if model_type == 'RandomForest':
            return RandomForestRegressor(**params)
        else:
            return RandomForestRegressor(**params)

    def _calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        metrics = {}
        
        metrics['mse'] = float(mean_squared_error(y_true, y_pred))
        metrics['rmse'] = float(np.sqrt(metrics['mse']))
        metrics['mae'] = float(mean_absolute_error(y_true, y_pred))
        metrics['r2'] = float(r2_score(y_true, y_pred))
        
        mask = y_true != 0
        if np.any(mask):
            metrics['mape'] = float(mean_absolute_percentage_error(
                y_true[mask], y_pred[mask]
            ))
        else:
            metrics['mape'] = float('nan')
        
        metrics['max_error'] = float(np.max(np.abs(y_true - y_pred)))
        
        peak_mask = y_true > np.percentile(y_true, 80)
        if np.any(peak_mask):
            metrics['peak_rmse'] = float(np.sqrt(mean_squared_error(
                y_true[peak_mask], y_pred[peak_mask]
            )))
            metrics['peak_mae'] = float(mean_absolute_error(
                y_true[peak_mask], y_pred[peak_mask]
            ))
        else:
            metrics['peak_rmse'] = float('nan')
            metrics['peak_mae'] = float('nan')
        
        return metrics

    def save_model(self, model: Any, path: str):
        joblib.dump(model, path)

    def load_model(self, path: str) -> Any:
        return joblib.load(path)
