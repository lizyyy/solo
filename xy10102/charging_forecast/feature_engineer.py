import pandas as pd
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass, field
from .config import Config


@dataclass
class FeatureResult:
    features: pd.DataFrame
    target: pd.Series
    feature_names: List[str]
    target_name: str
    timestamps: Optional[pd.Series] = None


class FeatureEngineer:
    def __init__(self, config: Config):
        self.config = config
        self.cols = config.columns
        self.feat_config = config.feature_engineering

    def transform(self, df: pd.DataFrame) -> FeatureResult:
        df = df.copy()
        
        df = self._aggregate_hourly(df)
        df = self._create_time_features(df)
        df = self._create_lag_features(df)
        df = self._create_rolling_features(df)
        df = self._create_price_features(df)
        
        feature_cols = self._get_feature_columns(df)
        
        df_clean = df.dropna(subset=feature_cols)
        
        target_col = self.cols.charging_power
        
        features = df_clean[feature_cols]
        target = df_clean[target_col] if target_col in df_clean.columns else None
        
        if target is None:
            target = df_clean.get(self.cols.energy_consumed, pd.Series())
        
        timestamps = df_clean[self.cols.timestamp] if self.cols.timestamp in df_clean.columns else None
        
        return FeatureResult(
            features=features,
            target=target,
            feature_names=feature_cols,
            target_name=target_col if target_col in df_clean.columns else self.cols.energy_consumed,
            timestamps=timestamps
        )

    def _aggregate_hourly(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.timestamp not in df.columns:
            return df
        
        df = df.copy()
        df['_hour'] = df[self.cols.timestamp].dt.floor('H')
        
        agg_rules = {}
        if self.cols.charging_power in df.columns:
            agg_rules[self.cols.charging_power] = 'mean'
        if self.cols.energy_consumed in df.columns:
            agg_rules[self.cols.energy_consumed] = 'sum'
        if self.cols.charging_duration in df.columns:
            agg_rules[self.cols.charging_duration] = 'sum'
        if self.cols.electricity_price in df.columns:
            agg_rules[self.cols.electricity_price] = 'first'
        if self.cols.station_id in df.columns:
            agg_rules[self.cols.station_id] = 'first'
        if self.cols.charger_id in df.columns:
            agg_rules[self.cols.charger_id] = 'nunique'
        
        if not agg_rules:
            return df
        
        grouped = df.groupby('_hour').agg(agg_rules).reset_index()
        grouped[self.cols.timestamp] = grouped['_hour']
        grouped = grouped.drop(columns=['_hour'])
        
        return grouped

    def _create_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.timestamp not in df.columns:
            return df
        
        df = df.copy()
        ts = df[self.cols.timestamp]
        
        if 'hour' in self.feat_config.time_features:
            df['hour'] = ts.dt.hour
        if 'day_of_week' in self.feat_config.time_features:
            df['day_of_week'] = ts.dt.dayofweek
        if 'month' in self.feat_config.time_features:
            df['month'] = ts.dt.month
        if 'is_weekend' in self.feat_config.time_features:
            df['is_weekend'] = (ts.dt.dayofweek >= 5).astype(int)
        if 'is_holiday' in self.feat_config.time_features:
            df['is_holiday'] = 0
        
        df['hour_sin'] = np.sin(2 * np.pi * ts.dt.hour / 24)
        df['hour_cos'] = np.cos(2 * np.pi * ts.dt.hour / 24)
        df['day_sin'] = np.sin(2 * np.pi * ts.dt.dayofweek / 7)
        df['day_cos'] = np.cos(2 * np.pi * ts.dt.dayofweek / 7)
        
        df['is_peak_hour'] = df['hour'].apply(
            lambda x: 1 if (17 <= x <= 22) or (8 <= x <= 10) else 0
        )
        
        df['is_night'] = df['hour'].apply(lambda x: 1 if 0 <= x <= 6 else 0)
        
        return df

    def _create_lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.timestamp not in df.columns:
            return df
        
        df = df.copy()
        df = df.sort_values(self.cols.timestamp)
        
        target_col = self.cols.charging_power
        if target_col not in df.columns:
            target_col = self.cols.energy_consumed
        
        if target_col not in df.columns:
            return df
        
        for lag in self.feat_config.lag_features:
            df[f'lag_{lag}h'] = df[target_col].shift(lag)
        
        return df

    def _create_rolling_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.timestamp not in df.columns:
            return df
        
        df = df.copy()
        df = df.sort_values(self.cols.timestamp)
        
        target_col = self.cols.charging_power
        if target_col not in df.columns:
            target_col = self.cols.energy_consumed
        
        if target_col not in df.columns:
            return df
        
        for window in self.feat_config.rolling_window:
            df[f'rolling_mean_{window}h'] = df[target_col].rolling(
                window=window, min_periods=1
            ).mean()
            df[f'rolling_std_{window}h'] = df[target_col].rolling(
                window=window, min_periods=1
            ).std()
            df[f'rolling_max_{window}h'] = df[target_col].rolling(
                window=window, min_periods=1
            ).max()
            df[f'rolling_min_{window}h'] = df[target_col].rolling(
                window=window, min_periods=1
            ).min()
        
        return df

    def _create_price_features(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.electricity_price not in df.columns:
            return df
        
        df = df.copy()
        price = df[self.cols.electricity_price]
        
        df['price_quantile'] = pd.qcut(
            price, q=4, labels=['low', 'medium', 'high', 'very_high'],
            duplicates='drop'
        )
        df = pd.get_dummies(df, columns=['price_quantile'], prefix='price')
        
        price_mean = price.mean()
        df['price_above_mean'] = (price > price_mean).astype(int)
        
        return df

    def _get_feature_columns(self, df: pd.DataFrame) -> List[str]:
        exclude_cols = [
            self.cols.timestamp,
            self.cols.charging_power,
            self.cols.energy_consumed,
            self.cols.station_id,
            self.cols.charger_id
        ]
        
        feature_cols = [
            col for col in df.columns
            if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])
        ]
        
        return feature_cols
