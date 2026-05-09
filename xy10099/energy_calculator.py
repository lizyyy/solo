import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from config import config
from logger import get_logger
from data_loader import DataLoader


@dataclass
class CalculationStep:
    step_name: str
    description: str
    timestamp: str
    parameters: Dict
    result_summary: Dict


class EnergyCalculator:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
        self.calculation_log: List[CalculationStep] = []
        self.baseline_established = False
        self.specific_energy_baseline: Optional[float] = None
    
    def _log_step(self, step_name: str, description: str, parameters: Dict, result_summary: Dict):
        step = CalculationStep(
            step_name=step_name,
            description=description,
            timestamp=datetime.now().isoformat(),
            parameters=parameters,
            result_summary=result_summary
        )
        self.calculation_log.append(step)
        self.logger.log_info(f"[{step_name}] {description}")
    
    def calculate_specific_energy(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.log_info("计算单位产量能耗（比能耗）")
        
        energy_col = self.loader.mapping.get('energy')
        production_col = self.loader.mapping.get('production')
        
        if not energy_col or not production_col:
            self.logger.log_warning("缺少能耗或产量列，无法计算比能耗")
            return df
        
        df['_specific_energy'] = np.nan
        
        valid_mask = (
            df[energy_col].notna() & 
            df[production_col].notna() & 
            (df[production_col] > 0)
        )
        
        invalid_mask = (
            df[energy_col].notna() & 
            df[production_col].notna() & 
            (df[production_col] <= 0)
        )
        
        for idx in df[invalid_mask].index:
            self.logger.record_failed_sample(
                df.loc[idx, '_original_index'],
                df.loc[idx].to_dict(),
                f"产量值 {df.loc[idx, production_col]} 小于等于0，无法计算比能耗",
                'calculation_error'
            )
        
        df.loc[valid_mask, '_specific_energy'] = (
            df.loc[valid_mask, energy_col] / df.loc[valid_mask, production_col]
        )
        
        valid_count = valid_mask.sum()
        self._log_step(
            "计算比能耗",
            "能耗 / 产量",
            {
                'energy_column': energy_col,
                'production_column': production_col
            },
            {
                'valid_count': int(valid_count),
                'mean': float(df['_specific_energy'].mean()) if valid_count > 0 else None,
                'median': float(df['_specific_energy'].median()) if valid_count > 0 else None
            }
        )
        
        return df
    
    def establish_baseline(self, df: pd.DataFrame, baseline_period: Optional[Tuple[str, str]] = None) -> pd.DataFrame:
        self.logger.log_info("建立能耗基准线")
        
        specific_energy_col = '_specific_energy'
        if specific_energy_col not in df.columns:
            df = self.calculate_specific_energy(df)
        
        datetime_col = self.loader.mapping.get('datetime')
        baseline_data = df
        
        if baseline_period and datetime_col and datetime_col in df.columns:
            try:
                start_date = pd.to_datetime(baseline_period[0])
                end_date = pd.to_datetime(baseline_period[1])
                baseline_mask = (df[datetime_col] >= start_date) & (df[datetime_col] <= end_date)
                baseline_data = df[baseline_mask]
                self.logger.log_info(f"使用指定基准期: {start_date} 到 {end_date}")
            except Exception as e:
                self.logger.log_warning(f"基准期解析失败，使用全部数据: {e}")
        
        valid_baseline = baseline_data[specific_energy_col].dropna()
        
        if len(valid_baseline) < 5:
            self.logger.log_warning(f"基准数据不足 ({len(valid_baseline)}条)，无法建立可靠基准线")
            return df
        
        if config.specific_energy_baseline is not None:
            self.specific_energy_baseline = config.specific_energy_baseline
        else:
            q1 = valid_baseline.quantile(0.25)
            q3 = valid_baseline.quantile(0.75)
            iqr = q3 - q1
            filtered = valid_baseline[(valid_baseline >= q1 - 1.5 * iqr) & (valid_baseline <= q3 + 1.5 * iqr)]
            self.specific_energy_baseline = filtered.mean()
        
        baseline_std = valid_baseline.std()
        
        df['_energy_deviation'] = df[specific_energy_col] - self.specific_energy_baseline
        df['_energy_deviation_pct'] = (df['_energy_deviation'] / self.specific_energy_baseline) * 100
        
        deviation_threshold = 2 * baseline_std
        df['_is_anomaly'] = (
            df['_specific_energy'].notna() & 
            (df['_energy_deviation'].abs() > deviation_threshold)
        )
        
        self.baseline_established = True
        
        self._log_step(
            "建立基准线",
            "计算比能耗基准和异常阈值",
            {
                'baseline_method': 'filtered_mean' if config.specific_energy_baseline is None else 'configured',
                'deviation_threshold_method': '2*std'
            },
            {
                'baseline_value': float(self.specific_energy_baseline),
                'baseline_std': float(baseline_std),
                'deviation_threshold': float(deviation_threshold),
                'anomaly_count': int(df['_is_anomaly'].sum())
            }
        )
        
        return df
    
    def calculate_expected_energy(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.baseline_established:
            self.logger.log_warning("基准线未建立，先建立基准线")
            df = self.establish_baseline(df)
        
        production_col = self.loader.mapping.get('production')
        
        if not production_col or self.specific_energy_baseline is None:
            return df
        
        df['_expected_energy'] = np.nan
        df['_energy_waste'] = np.nan
        
        valid_mask = df[production_col].notna() & (df[production_col] > 0)
        
        df.loc[valid_mask, '_expected_energy'] = (
            df.loc[valid_mask, production_col] * self.specific_energy_baseline
        )
        
        energy_col = self.loader.mapping.get('energy')
        if energy_col:
            waste_mask = valid_mask & df[energy_col].notna()
            df.loc[waste_mask, '_energy_waste'] = (
                df.loc[waste_mask, energy_col] - df.loc[waste_mask, '_expected_energy']
            )
        
        self._log_step(
            "计算预期能耗",
            "产量 * 单位能耗基准",
            {
                'specific_energy_baseline': float(self.specific_energy_baseline) if self.specific_energy_baseline else None
            },
            {
                'total_expected_energy': float(df['_expected_energy'].sum()),
                'total_actual_energy': float(df[energy_col].sum()) if energy_col else None,
                'total_waste': float(df['_energy_waste'].sum()) if energy_col else None
            }
        )
        
        return df
    
    def aggregate_by_period(self, df: pd.DataFrame, period: str = 'D') -> pd.DataFrame:
        datetime_col = self.loader.mapping.get('datetime')
        if not datetime_col or datetime_col not in df.columns:
            self.logger.log_warning("缺少时间列，无法按周期聚合")
            return df
        
        period_name_map = {
            'H': '小时', 'h': '小时',
            'D': '日', 'd': '日',
            'W': '周', 'w': '周',
            'M': '月', 'm': '月'
        }
        period_name = period_name_map.get(period, period)
        
        agg_cols = []
        agg_funcs = {}
        
        for col_type, col_name in self.loader.mapping.items():
            if col_name and col_name in df.columns:
                if df[col_name].dtype in [np.float64, np.int64, float, int]:
                    agg_cols.append(col_name)
                    agg_funcs[col_name] = ['sum', 'mean', 'min', 'max']
        
        for internal_col in ['_specific_energy', '_energy_deviation', '_expected_energy', '_energy_waste', '_is_anomaly']:
            if internal_col in df.columns:
                if internal_col == '_is_anomaly':
                    agg_funcs[internal_col] = ['sum', 'count']
                else:
                    agg_funcs[internal_col] = ['sum', 'mean', 'min', 'max']
        
        try:
            agg_df = df.set_index(datetime_col).resample(period).agg(agg_funcs)
            agg_df.columns = ['_'.join(col).strip() for col in agg_df.columns.values]
            agg_df = agg_df.reset_index()
            
            self._log_step(
                f"按{period_name}聚合",
                f"按{period_name}周期聚合统计",
                {
                    'period': period,
                    'aggregated_columns': list(agg_funcs.keys())
                },
                {
                    'period_count': len(agg_df),
                    'date_range': f"{agg_df[datetime_col].min()} 到 {agg_df[datetime_col].max()}"
                }
            )
            
            return agg_df
        except Exception as e:
            self.logger.log_error(f"聚合计算失败: {e}")
            return df
    
    def get_calculation_log(self) -> List[Dict]:
        return [asdict(step) for step in self.calculation_log]
    
    def get_reproducibility_info(self) -> Dict:
        return {
            'calculation_timestamp': datetime.now().isoformat(),
            'baseline_value': self.specific_energy_baseline,
            'steps': self.get_calculation_log(),
            'config': {
                'outlier_iqr_multiplier': config.outlier_iqr_multiplier,
                'zscore_threshold': config.zscore_threshold,
                'missing_threshold': config.missing_threshold,
                'pressure_normal_range': config.pressure_normal_range,
                'leak_threshold': config.leak_threshold
            }
        }
