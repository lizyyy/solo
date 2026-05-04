import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_squared_error, mean_absolute_error, r2_score,
    roc_auc_score, confusion_matrix, classification_report
)
import joblib
from models import db, TrainingRun, Validation

class ModelTrainer:
    def __init__(self, config):
        self.config = config
        self.model = None
    
    def build_model(self):
        model_type = self.config.get('model_type', 'logistic_regression')
        params = self.config.get('hyperparameters', {})
        
        if model_type == 'logistic_regression':
            self.model = LogisticRegression(**params)
        elif model_type == 'linear_regression':
            self.model = LinearRegression(**params)
        elif model_type == 'ridge':
            self.model = Ridge(**params)
        elif model_type == 'lasso':
            self.model = Lasso(**params)
        elif model_type == 'random_forest_classifier':
            self.model = RandomForestClassifier(**params)
        elif model_type == 'random_forest_regressor':
            self.model = RandomForestRegressor(**params)
        elif model_type == 'decision_tree_classifier':
            self.model = DecisionTreeClassifier(**params)
        elif model_type == 'decision_tree_regressor':
            self.model = DecisionTreeRegressor(**params)
        elif model_type == 'svm_classifier':
            self.model = SVC(**params)
        elif model_type == 'svm_regressor':
            self.model = SVR(**params)
        elif model_type == 'knn_classifier':
            self.model = KNeighborsClassifier(**params)
        elif model_type == 'knn_regressor':
            self.model = KNeighborsRegressor(**params)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        return self.model
    
    def train(self, X_train, y_train):
        if not self.model:
            self.build_model()
        self.model.fit(X_train, y_train)
        return self.model
    
    def predict(self, X):
        return self.model.predict(X)
    
    def predict_proba(self, X):
        if hasattr(self.model, 'predict_proba'):
            return self.model.predict_proba(X)
        return None
    
    def evaluate(self, X_test, y_test, is_classification=True):
        y_pred = self.predict(X_test)
        
        metrics = {}
        
        if is_classification:
            metrics['accuracy'] = accuracy_score(y_test, y_pred)
            metrics['precision'] = precision_score(y_test, y_pred, average='weighted', zero_division=0)
            metrics['recall'] = recall_score(y_test, y_pred, average='weighted', zero_division=0)
            metrics['f1'] = f1_score(y_test, y_pred, average='weighted', zero_division=0)
            
            try:
                y_prob = self.predict_proba(X_test)
                if y_prob is not None:
                    if len(np.unique(y_test)) == 2:
                        metrics['roc_auc'] = roc_auc_score(y_test, y_prob[:, 1])
                    else:
                        metrics['roc_auc'] = roc_auc_score(y_test, y_prob, multi_class='ovr')
            except:
                pass
        else:
            metrics['mse'] = mean_squared_error(y_test, y_pred)
            metrics['rmse'] = np.sqrt(mean_squared_error(y_test, y_pred))
            metrics['mae'] = mean_absolute_error(y_test, y_pred)
            metrics['r2'] = r2_score(y_test, y_pred)
        
        return metrics
    
    def save_model(self, filepath):
        joblib.dump(self.model, filepath)
        return filepath
    
    def load_model(self, filepath):
        self.model = joblib.load(filepath)
        return self.model


def run_training(training_run_id, data_folder, models_folder):
    training_run = TrainingRun.query.get(training_run_id)
    if not training_run:
        return False, "Training run not found"
    
    from core.data_uploader import load_yaml_file
    
    try:
        training_run.status = 'running'
        training_run.started_at = datetime.utcnow()
        db.session.commit()
        
        feature_version = training_run.feature_version
        df = pd.read_csv(feature_version.output_file_path)
        
        config = load_yaml_file(training_run.config_file_path)
        
        target_col = config.get('target_column', 'target')
        feature_cols = config.get('feature_columns', [col for col in df.columns if col != target_col])
        
        if not feature_cols:
            feature_cols = [col for col in df.columns if col != target_col]
        
        X = df[feature_cols]
        y = df[target_col]
        
        test_size = config.get('test_size', 0.2)
        random_state = config.get('random_state', 42)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        
        training_run.train_rows = len(X_train)
        training_run.test_rows = len(X_test)
        training_run.model_type = config.get('model_type')
        training_run.hyperparameters = json.dumps(config.get('hyperparameters', {}))
        
        trainer = ModelTrainer(config)
        trainer.build_model()
        trainer.train(X_train, y_train)
        
        is_classification = config.get('task_type', 'classification') == 'classification'
        metrics = trainer.evaluate(X_test, y_test, is_classification)
        
        model_filename = f"model_{training_run.version}.joblib"
        model_path = os.path.join(models_folder, model_filename)
        trainer.save_model(model_path)
        
        training_run.model_file_path = model_path
        training_run.status = 'completed'
        training_run.completed_at = datetime.utcnow()
        
        thresholds_config = config.get('validation_thresholds', {})
        for metric_name, value in metrics.items():
            threshold = thresholds_config.get(metric_name)
            status = 'passed'
            if threshold is not None:
                if is_classification:
                    if metric_name in ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']:
                        if value < threshold:
                            status = 'failed'
                else:
                    if metric_name in ['mse', 'rmse', 'mae']:
                        if value > threshold:
                            status = 'failed'
                    elif metric_name == 'r2':
                        if value < threshold:
                            status = 'failed'
            
            validation = Validation(
                training_run_id=training_run.id,
                metric_name=metric_name,
                value=value,
                threshold=threshold,
                status=status
            )
            db.session.add(validation)
        
        db.session.commit()
        return True, f"Training completed. Metrics: {metrics}"
    
    except Exception as e:
        training_run.status = 'failed'
        training_run.error_message = str(e)
        db.session.commit()
        return False, str(e)


def compare_models(model_run_ids, data_folder):
    from core.data_uploader import load_yaml_file
    
    comparisons = []
    
    for run_id in model_run_ids:
        training_run = TrainingRun.query.get(run_id)
        if not training_run:
            continue
        
        validations = Validation.query.filter_by(training_run_id=run_id).all()
        metrics = {v.metric_name: v.value for v in validations}
        
        comparisons.append({
            'run_id': run_id,
            'version': training_run.version,
            'model_type': training_run.model_type,
            'metrics': metrics,
            'status': training_run.status,
            'created_at': training_run.created_at
        })
    
    return comparisons


def run_test_set_playback(training_run_id, test_data_path):
    training_run = TrainingRun.query.get(training_run_id)
    if not training_run:
        return None, "Training run not found"
    
    if not os.path.exists(training_run.model_file_path):
        return None, "Model file not found"
    
    try:
        trainer = ModelTrainer({})
        trainer.load_model(training_run.model_file_path)
        
        df_test = pd.read_csv(test_data_path)
        
        from core.data_uploader import load_yaml_file
        config = load_yaml_file(training_run.config_file_path)
        
        target_col = config.get('target_column', 'target')
        feature_cols = config.get('feature_columns', [col for col in df_test.columns if col != target_col])
        
        if target_col in df_test.columns:
            X = df_test[feature_cols]
            y = df_test[target_col]
            
            is_classification = config.get('task_type', 'classification') == 'classification'
            metrics = trainer.evaluate(X, y, is_classification)
            
            predictions = trainer.predict(X)
            
            return {
                'metrics': metrics,
                'predictions': predictions.tolist(),
                'actuals': y.tolist(),
                'row_count': len(df_test)
            }, "Playback completed"
        else:
            X = df_test[feature_cols]
            predictions = trainer.predict(X)
            
            return {
                'predictions': predictions.tolist(),
                'row_count': len(df_test)
            }, "Prediction completed (no target column for evaluation)"
    
    except Exception as e:
        return None, str(e)
