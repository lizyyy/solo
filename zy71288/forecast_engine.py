import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import logging
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

from config import config
from data_models import ForecastResult, AnomalyRecord

logger = logging.getLogger(__name__)


class TimeSeriesForecaster:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = [
            'hour', 'day_of_week', 'is_weekend', 'is_peak_hour',
            'temperature', 'rain_probability', 'has_event',
            'event_attendance', 'reservation_count'
        ]
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df['hour'] = df['hour'].astype(int)
        df['day_of_week'] = pd.to_datetime(df['date']).dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['is_peak_hour'] = ((df['hour'] >= config.PEAK_HOUR_START) & 
                               (df['hour'] <= config.PEAK_HOUR_END)).astype(int)
        
        for col in ['temperature', 'rain_probability', 'has_event', 
                     'event_attendance', 'reservation_count']:
            if col not in df.columns:
                df[col] = 0
        
        temp_mean = df['temperature'].mean()
        if pd.isna(temp_mean):
            temp_mean = 20
        df['temperature'] = df['temperature'].fillna(temp_mean)
        df['rain_probability'] = df['rain_probability'].fillna(0.3)
        
        for col in self.feature_columns:
            if col in df.columns:
                df[col] = df[col].fillna(0)
        
        return df
    
    def _prepare_training_data(self, historical_data: List[Dict[str, Any]],
                                weather_data: List[Dict[str, Any]],
                                event_data: List[Dict[str, Any]],
                                reservation_data: List[Dict[str, Any]]) -> pd.DataFrame:
        
        hist_df = pd.DataFrame(historical_data)
        hist_df['date'] = hist_df['date'].astype(str)
        
        weather_df = pd.DataFrame(weather_data) if weather_data else pd.DataFrame()
        event_df = pd.DataFrame(event_data) if event_data else pd.DataFrame()
        res_df = pd.DataFrame(reservation_data) if reservation_data else pd.DataFrame()
        
        merged = hist_df.copy()
        
        if not weather_df.empty:
            weather_df['date'] = weather_df['date'].astype(str)
            merged = merged.merge(weather_df[['date', 'hour', 'temperature', 'rain_probability']],
                                   on=['date', 'hour'], how='left')
        
        merged['has_event'] = 0
        merged['event_attendance'] = 0
        
        if not event_df.empty:
            event_df['date'] = event_df['date'].astype(str)
            for _, row in event_df.iterrows():
                mask = (merged['date'] == row['date']) & (merged['hour'] == row['hour'])
                merged.loc[mask, 'has_event'] = 1
                merged.loc[mask, 'event_attendance'] += row.get('expected_attendance', 0)
        
        merged['reservation_count'] = 0
        
        if not res_df.empty:
            res_df['date'] = res_df['date'].astype(str)
            res_agg = res_df[res_df['status'] == 'confirmed'].groupby(['date', 'hour'])['people_count'].sum().reset_index()
            merged = merged.merge(res_agg, on=['date', 'hour'], how='left', suffixes=('', '_res'))
            merged['reservation_count'] = merged['people_count'].fillna(0)
        
        merged = self._prepare_features(merged)
        return merged
    
    def train(self, historical_data: List[Dict[str, Any]],
              weather_data: List[Dict[str, Any]] = None,
              event_data: List[Dict[str, Any]] = None,
              reservation_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        
        logger.info("训练时间序列预测模型...")
        
        training_data = self._prepare_training_data(
            historical_data, weather_data, event_data, reservation_data
        )
        
        if len(training_data) < 24:
            raise ValueError("训练数据不足，至少需要24小时的历史数据")
        
        X = training_data[self.feature_columns]
        y = training_data['actual_visitors']
        
        X_scaled = self.scaler.fit_transform(X)
        
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=15,
            random_state=42
        )
        self.model.fit(X_scaled, y)
        
        feature_importance = dict(zip(self.feature_columns, self.model.feature_importances_))
        
        logger.info("模型训练完成")
        return {
            "training_samples": len(training_data),
            "feature_importance": feature_importance,
            "model_type": "RandomForest"
        }
    
    def _generate_forecast_dates(self, start_date: Optional[str] = None, hours: int = 24) -> pd.DataFrame:
        if start_date:
            start = pd.to_datetime(start_date)
        else:
            start = pd.Timestamp.now().floor('H')
        
        dates = [start + timedelta(hours=i) for i in range(hours)]
        df = pd.DataFrame({
            'date': [d.strftime('%Y-%m-%d') for d in dates],
            'hour': [d.hour for d in dates]
        })
        return df
    
    def predict(self, weather_data: List[Dict[str, Any]] = None,
                event_data: List[Dict[str, Any]] = None,
                reservation_data: List[Dict[str, Any]] = None,
                start_date: Optional[str] = None,
                forecast_hours: int = 24,
                scenario: str = "base") -> List[ForecastResult]:
        
        logger.info(f"生成{scenario}情景预测，预测{forecast_hours}小时...")
        
        if self.model is None:
            raise ValueError("模型尚未训练，请先调用train()方法")
        
        forecast_df = self._generate_forecast_dates(start_date, forecast_hours)
        
        for col in ['temperature', 'rain_probability', 'has_event', 'event_attendance', 'reservation_count']:
            forecast_df[col] = 0
        
        weather_df = pd.DataFrame(weather_data) if weather_data else pd.DataFrame()
        if not weather_df.empty:
            weather_df['date'] = weather_df['date'].astype(str)
            if 'temperature' in weather_df.columns and 'rain_probability' in weather_df.columns:
                forecast_df = forecast_df.merge(
                    weather_df[['date', 'hour', 'temperature', 'rain_probability']],
                    on=['date', 'hour'], how='left', suffixes=('', '_weather')
                )
                if 'temperature_weather' in forecast_df.columns:
                    forecast_df['temperature'] = forecast_df['temperature_weather']
                    forecast_df.drop('temperature_weather', axis=1, inplace=True)
                if 'rain_probability_weather' in forecast_df.columns:
                    forecast_df['rain_probability'] = forecast_df['rain_probability_weather']
                    forecast_df.drop('rain_probability_weather', axis=1, inplace=True)
        
        forecast_df = self._prepare_features(forecast_df)
        
        forecast_df['has_event'] = 0
        forecast_df['event_attendance'] = 0
        event_df = pd.DataFrame(event_data) if event_data else pd.DataFrame()
        if not event_df.empty:
            event_df['date'] = event_df['date'].astype(str)
            for _, row in event_df.iterrows():
                mask = (forecast_df['date'] == row['date']) & (forecast_df['hour'] == row['hour'])
                forecast_df.loc[mask, 'has_event'] = 1
                forecast_df.loc[mask, 'event_attendance'] += row.get('expected_attendance', 0)
        
        forecast_df['reservation_count'] = 0
        res_df = pd.DataFrame(reservation_data) if reservation_data else pd.DataFrame()
        if not res_df.empty:
            res_df['date'] = res_df['date'].astype(str)
            res_agg = res_df[res_df['status'] == 'confirmed'].groupby(['date', 'hour'])['people_count'].sum().reset_index()
            forecast_df = forecast_df.merge(res_agg, on=['date', 'hour'], how='left', suffixes=('', '_res'))
            forecast_df['reservation_count'] = forecast_df['reservation_count'].fillna(0)
        
        X_pred = forecast_df[self.feature_columns].copy()
        for col in self.feature_columns:
            if col not in X_pred.columns:
                X_pred[col] = 0
        
        X_pred_scaled = self.scaler.transform(X_pred)
        
        predictions = self.model.predict(X_pred_scaled)
        
        base_prediction = np.mean(predictions)
        lower_bound = predictions * 0.75
        upper_bound = predictions * 1.25
        confidence_level = 0.85
        
        results = []
        for i, row in forecast_df.iterrows():
            results.append(ForecastResult(
                date=row['date'],
                hour=int(row['hour']),
                predicted_visitors=float(predictions[i]),
                lower_bound=float(lower_bound[i]),
                upper_bound=float(upper_bound[i]),
                confidence_level=confidence_level,
                scenario=scenario
            ))
        
        logger.info(f"预测完成，共{len(results)}条记录")
        return results
    
    def predict_with_scenarios(self, weather_data: List[Dict[str, Any]] = None,
                                event_data: List[Dict[str, Any]] = None,
                                reservation_data: List[Dict[str, Any]] = None,
                                start_date: Optional[str] = None,
                                forecast_hours: int = 24) -> Dict[str, List[ForecastResult]]:
        
        logger.info("生成多情景对比预测...")
        
        base_predictions = self.predict(
            weather_data, event_data, reservation_data,
            start_date, forecast_hours, "base"
        )
        
        optimistic_weather = []
        if weather_data:
            for w in weather_data:
                w_opt = w.copy()
                w_opt['rain_probability'] = max(0, w.get('rain_probability', 0) - 0.3)
                w_opt['temperature'] = w.get('temperature', 20) + 2
                optimistic_weather.append(w_opt)
        
        optimistic_predictions = self.predict(
            optimistic_weather, event_data, reservation_data,
            start_date, forecast_hours, "optimistic"
        )
        
        pessimistic_weather = []
        if weather_data:
            for w in weather_data:
                w_pess = w.copy()
                w_pess['rain_probability'] = min(1, w.get('rain_probability', 0) + 0.3)
                w_pess['temperature'] = w.get('temperature', 20) - 2
                pessimistic_weather.append(w_pess)
        
        pessimistic_events = []
        if event_data:
            for e in event_data:
                e_pess = e.copy()
                e_pess['expected_attendance'] = int(e.get('expected_attendance', 0) * 0.7)
                pessimistic_events.append(e_pess)
        
        pessimistic_predictions = self.predict(
            pessimistic_weather, pessimistic_events, reservation_data,
            start_date, forecast_hours, "pessimistic"
        )
        
        return {
            "base": base_predictions,
            "optimistic": optimistic_predictions,
            "pessimistic": pessimistic_predictions
        }
    
    def calculate_error_metrics(self, historical_data: List[Dict[str, Any]],
                                 predictions: List[ForecastResult]) -> Dict[str, float]:
        logger.info("计算预测误差...")
        
        hist_df = pd.DataFrame(historical_data)
        pred_df = pd.DataFrame([p.model_dump() for p in predictions])
        
        merged = hist_df.merge(pred_df, on=['date', 'hour'], how='inner')
        
        if len(merged) == 0:
            return {"mae": 0, "rmse": 0, "mape": 0, "sample_count": 0}
        
        actual = merged['actual_visitors']
        predicted = merged['predicted_visitors']
        
        mae = np.mean(np.abs(actual - predicted))
        rmse = np.sqrt(np.mean((actual - predicted) ** 2))
        mape = np.mean(np.abs((actual - predicted) / actual)) * 100 if (actual > 0).all() else 0
        
        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "mape": float(mape),
            "sample_count": len(merged)
        }
