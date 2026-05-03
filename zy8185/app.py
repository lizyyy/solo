import streamlit as st
import pandas as pd
import numpy as np
import yaml
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import io


class AnaerobicDigesterDashboard:
    """厌氧发酵罐交接班复盘看板应用类"""
    
    def __init__(self):
        """初始化应用"""
        self.rules = None
        self.sensor_data = None
        self.feed_events = None
        
    def load_rules(self, rules_path: str) -> Dict:
        """加载工艺规则配置"""
        with open(rules_path, 'r', encoding='utf-8') as f:
            self.rules = yaml.safe_load(f)
        return self.rules
    
    def load_sensor_data(self, csv_path: str) -> pd.DataFrame:
        """加载传感器数据"""
        df = pd.read_csv(csv_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df
    
    def load_feed_events(self, jsonl_path: str) -> pd.DataFrame:
        """加载投料事件"""
        events = []
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                events.append(json.loads(line.strip()))
        df = pd.DataFrame(events)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df
    
    def normalize_timeline(self, sensor_df: pd.DataFrame, start_time: datetime, end_time: datetime, 
                          interval_minutes: int = 30) -> pd.DataFrame:
        """
        归一化时间线 - 处理跨午夜和缺采样情况
        
        Args:
            sensor_df: 原始传感器数据
            start_time: 开始时间
            end_time: 结束时间
            interval_minutes: 时间间隔
        
        Returns:
            归一化后的 DataFrame
        """
        all_timestamps = pd.date_range(
            start=start_time,
            end=end_time,
            freq=f'{interval_minutes}T'
        )
        
        all_digesters = sensor_df['digester_id'].unique()
        all_sensors = sensor_df['sensor_type'].unique()
        
        normalized_records = []
        for timestamp in all_timestamps:
            for digester in all_digesters:
                for sensor in all_sensors:
                    # 查找最近的实际数据点（前后各30分钟内）
                    mask = (
                        (sensor_df['digester_id'] == digester) &
                        (sensor_df['sensor_type'] == sensor) &
                        (sensor_df['timestamp'] >= timestamp - timedelta(minutes=30)) &
                        (sensor_df['timestamp'] <= timestamp + timedelta(minutes=30))
                    )
                    
                    if mask.any():
                        # 使用最接近时间点的数据
                        closest_idx = (sensor_df[mask]['timestamp'] - timestamp).abs().idxmin()
                        row = sensor_df.loc[closest_idx]
                        
                        normalized_records.append({
                            'timestamp': timestamp,
                            'digester_id': digester,
                            'sensor_type': sensor,
                            'value': row['value'],
                            'unit': row['unit'],
                            'is_interpolated': False,
                            'actual_timestamp': row['timestamp']
                        })
                    else:
                        # 标记为缺失/插值点
                        normalized_records.append({
                            'timestamp': timestamp,
                            'digester_id': digester,
                            'sensor_type': sensor,
                            'value': np.nan,
                            'unit': '',
                            'is_interpolated': True,
                            'actual_timestamp': pd.NaT
                        })
        
        normalized_df = pd.DataFrame(normalized_records)
        return normalized_df
    
    def calculate_metrics(self, sensor_df: pd.DataFrame, feed_df: pd.DataFrame, 
                          digester_id: str, start_time: datetime, end_time: datetime) -> Dict:
        """
        计算关键指标：pH趋势、温度稳定性、VFA变化、投料负荷、产气效率
        
        Returns:
            包含各类指标的字典
        """
        digester_sensor = sensor_df[
            (sensor_df['digester_id'] == digester_id) &
            (sensor_df['timestamp'] >= start_time) &
            (sensor_df['timestamp'] <= end_time)
        ].copy()
        
        digester_feed = feed_df[
            (feed_df['digester_id'] == digester_id) &
            (feed_df['timestamp'] >= start_time) &
            (feed_df['timestamp'] <= end_time)
        ].copy()
        
        # 按传感器类型分组
        metrics = {
            'pH': {},
            'temperature': {},
            'VFA': {},
            'gas_production': {},
            'loading_rate': {},
            'gas_efficiency': {}
        }
        
        # pH 指标
        ph_data = digester_sensor[
            (digester_sensor['sensor_type'] == 'pH') & 
            (~digester_sensor['value'].isna())
        ]['value']
        
        if len(ph_data) > 0:
            metrics['pH'] = {
                'min': ph_data.min(),
                'max': ph_data.max(),
                'mean': ph_data.mean(),
                'median': ph_data.median(),
                'trend': self._calculate_trend(ph_data),
                'count': len(ph_data)
            }
        
        # 温度指标
        temp_data = digester_sensor[
            (digester_sensor['sensor_type'] == 'temperature') & 
            (~digester_sensor['value'].isna())
        ]['value']
        
        if len(temp_data) > 0:
            metrics['temperature'] = {
                'min': temp_data.min(),
                'max': temp_data.max(),
                'mean': temp_data.mean(),
                'std': temp_data.std(),
                'variation_range': temp_data.max() - temp_data.min() if len(temp_data) > 1 else 0,
                'count': len(temp_data)
            }
        
        # VFA 指标
        vfa_data = digester_sensor[
            (digester_sensor['sensor_type'] == 'VFA') & 
            (~digester_sensor['value'].isna())
        ]['value']
        
        if len(vfa_data) > 0:
            metrics['VFA'] = {
                'min': vfa_data.min(),
                'max': vfa_data.max(),
                'mean': vfa_data.mean(),
                'trend': self._calculate_trend(vfa_data),
                'count': len(vfa_data)
            }
        
        # 产气量指标
        gas_data = digester_sensor[
            (digester_sensor['sensor_type'] == 'gas_production') & 
            (~digester_sensor['value'].isna())
        ]['value']
        
        if len(gas_data) > 0:
            metrics['gas_production'] = {
                'min': gas_data.min(),
                'max': gas_data.max(),
                'mean': gas_data.mean(),
                'total': gas_data.sum() * 0.5,  # 假设30分钟间隔
                'trend': self._calculate_trend(gas_data),
                'count': len(gas_data)
            }
        
        # 投料负荷计算
        if len(digester_feed) > 0:
            total_feed = digester_feed['quantity_kg'].sum()
            time_hours = (end_time - start_time).total_seconds() / 3600
            
            # 获取罐体设计参数
            digester_config = self.rules['digesters'].get(digester_id, {})
            design_volume = digester_config.get('design_volume', 500)
            design_loading = digester_config.get('design_loading_rate', 4.0)
            
            # 计算实际负荷（简化计算，假设VS含量为20%）
            vs_content = 0.2
            actual_loading = (total_feed * vs_content) / (design_volume * (time_hours / 24))
            
            metrics['loading_rate'] = {
                'total_feed_kg': total_feed,
                'feed_count': len(digester_feed),
                'avg_feed_per_event': total_feed / len(digester_feed) if len(digester_feed) > 0 else 0,
                'actual_loading_rate': actual_loading,
                'design_loading_rate': design_loading,
                'loading_ratio': actual_loading / design_loading if design_loading > 0 else 0
            }
            
            # 产气效率
            if metrics['gas_production'].get('total', 0) > 0 and total_feed > 0:
                metrics['gas_efficiency'] = {
                    'gas_per_kg_feed': metrics['gas_production']['total'] / total_feed,
                    'gas_per_kg_vs': metrics['gas_production']['total'] / (total_feed * vs_content)
                }
        
        return metrics
    
    def _calculate_trend(self, data_series: pd.Series) -> str:
        """计算数据趋势"""
        if len(data_series) < 3:
            return '数据不足'
        
        # 使用简单的线性回归斜率判断趋势
        x = np.arange(len(data_series))
        y = data_series.values
        
        # 忽略NaN
        valid_mask = ~np.isnan(y)
        if valid_mask.sum() < 3:
            return '数据不足'
        
        x_valid = x[valid_mask]
        y_valid = y[valid_mask]
        
        if len(x_valid) < 2:
            return '数据不足'
            
        slope, _ = np.polyfit(x_valid, y_valid, 1)
        
        if slope > 0.1:
            return '上升'
        elif slope < -0.1:
            return '下降'
        else:
            return '平稳'
    
    def detect_risks(self, sensor_df: pd.DataFrame, feed_df: pd.DataFrame,
                    digester_id: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        """
        检测各类风险：酸化、温控漂移、投料过载、产气骤降、传感器断采
        
        Returns:
            风险列表
        """
        risks = []
        
        # 获取数据
        digester_sensor = sensor_df[
            (sensor_df['digester_id'] == digester_id) &
            (sensor_df['timestamp'] >= start_time) &
            (sensor_df['timestamp'] <= end_time)
        ].copy()
        
        digester_feed = feed_df[
            (feed_df['digester_id'] == digester_id) &
            (feed_df['timestamp'] >= start_time) &
            (feed_df['timestamp'] <= end_time)
        ].copy()
        
        # 1. 酸化风险检测
        acid_risk = self._detect_acidification_risk(digester_sensor)
        if acid_risk:
            risks.extend(acid_risk)
        
        # 2. 温控漂移检测
        temp_risk = self._detect_temperature_drift(digester_sensor, digester_id)
        if temp_risk:
            risks.extend(temp_risk)
        
        # 3. 投料过载检测
        load_risk = self._detect_overloading(digester_feed, digester_id)
        if load_risk:
            risks.extend(load_risk)
        
        # 4. 产气骤降检测
        gas_risk = self._detect_gas_production_drop(digester_sensor)
        if gas_risk:
            risks.extend(gas_risk)
        
        # 5. 传感器断采检测
        sensor_risk = self._detect_sensor_failure(digester_sensor)
        if sensor_risk:
            risks.extend(sensor_risk)
        
        return risks
    
    def _detect_acidification_risk(self, sensor_data: pd.DataFrame) -> Optional[List[Dict]]:
        """检测酸化风险"""
        risks = []
        rules = self.rules['risk_detection_rules']['acidification']
        thresholds = self.rules['parameter_thresholds']
        
        # 获取pH和VFA数据
        ph_data = sensor_data[
            (sensor_data['sensor_type'] == 'pH') & 
            (~sensor_data['value'].isna())
        ].sort_values('timestamp')
        
        vfa_data = sensor_data[
            (sensor_data['sensor_type'] == 'VFA') & 
            (~sensor_data['value'].isna())
        ].sort_values('timestamp')
        
        if len(ph_data) == 0:
            return None
        
        # 检查pH低值
        ph_warning = ph_data[ph_data['value'] < thresholds['pH']['warning_low']]
        ph_critical = ph_data[ph_data['value'] < thresholds['pH']['critical_low']]
        
        # 检查VFA高值
        vfa_high = pd.DataFrame()
        if len(vfa_data) > 0:
            vfa_high = vfa_data[vfa_data['value'] >= thresholds['VFA']['warning']]
        
        severity = 'warning'
        if len(ph_critical) > 0:
            severity = 'critical'
        elif len(ph_warning) > 0 or len(vfa_high) > 0:
            severity = 'warning'
        else:
            return None
        
        # 计算pH趋势
        ph_trend = self._calculate_trend(ph_data['value'])
        vfa_trend = self._calculate_trend(vfa_data['value']) if len(vfa_data) > 0 else '未知'
        
        risk_details = {
            'risk_type': '酸化风险',
            'severity': severity,
            'description': rules['description'],
            'details': {
                '最低pH': float(ph_data['value'].min()),
                'pH低于警戒值次数': int(len(ph_warning)),
                'pH趋势': ph_trend,
                'VFA最高值': float(vfa_data['value'].max()) if len(vfa_data) > 0 else '无数据',
                'VFA趋势': vfa_trend
            },
            'recommended_action': rules['action'],
            'detected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        risks.append(risk_details)
        return risks
    
    def _detect_temperature_drift(self, sensor_data: pd.DataFrame, digester_id: str) -> Optional[List[Dict]]:
        """检测温控漂移"""
        risks = []
        rules = self.rules['risk_detection_rules']['temperature_drift']
        digester_config = self.rules['digesters'].get(digester_id, {})
        nominal_temp = digester_config.get('nominal_temperature', 35.0)
        
        temp_data = sensor_data[
            (sensor_data['sensor_type'] == 'temperature') & 
            (~sensor_data['value'].isna())
        ].sort_values('timestamp')
        
        if len(temp_data) < 2:
            return None
        
        # 计算偏离
        deviations = abs(temp_data['value'] - nominal_temp)
        max_deviation = deviations.max()
        
        # 计算温度变化速率
        temp_values = temp_data['value'].values
        timestamps = temp_data['timestamp'].values
        time_diffs_hours = (timestamps[1:] - timestamps[:-1]).astype('timedelta64[h]').astype(float)
        
        if len(time_diffs_hours) > 0:
            temp_changes = temp_values[1:] - temp_values[:-1]
            rates = abs(temp_changes / time_diffs_hours)
            max_rate = rates.max() if len(rates) > 0 else 0
        else:
            max_rate = 0
        
        # 判断风险
        drift_threshold = self.rules['parameter_thresholds']['temperature']['drift_threshold']
        rate_threshold = 1.0  # 1℃/小时
        
        severity = None
        details = {
            '标称温度': float(nominal_temp),
            '实际温度范围': f"{float(temp_data['value'].min())} - {float(temp_data['value'].max())} ℃",
            '最大偏离': float(max_deviation),
            '最大变化速率': float(max_rate)
        }
        
        if max_deviation >= drift_threshold:
            severity = 'critical'
        elif max_deviation >= 1.5 or max_rate >= rate_threshold:
            severity = 'warning'
        else:
            return None
        
        risk_details = {
            'risk_type': '温控漂移',
            'severity': severity,
            'description': rules['description'],
            'details': details,
            'recommended_action': rules['action'],
            'detected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        risks.append(risk_details)
        return risks
    
    def _detect_overloading(self, feed_events: pd.DataFrame, digester_id: str) -> Optional[List[Dict]]:
        """检测投料过载"""
        risks = []
        rules = self.rules['risk_detection_rules']['overloading']
        digester_config = self.rules['digesters'].get(digester_id, {})
        
        max_daily_feed = digester_config.get('max_daily_feed', 20000)
        
        if len(feed_events) == 0:
            return None
        
        # 检查单次投料
        single_threshold = max_daily_feed * 0.3  # 单次投料不超过日限额的30%
        large_feeds = feed_events[feed_events['quantity_kg'] > single_threshold]
        
        # 检查累计投料
        total_feed = feed_events['quantity_kg'].sum()
        daily_ratio = total_feed / max_daily_feed if max_daily_feed > 0 else 0
        
        severity = None
        details = {
            '总投料量': float(total_feed),
            '投料次数': int(len(feed_events)),
            '单次最大投料': float(feed_events['quantity_kg'].max()),
            '日限额比例': float(daily_ratio * 100)
        }
        
        if daily_ratio > 1.1 or len(large_feeds) > 0:
            if daily_ratio > 1.2 or any(feed_events['quantity_kg'] > single_threshold * 1.5):
                severity = 'critical'
            else:
                severity = 'warning'
        else:
            return None
        
        risk_details = {
            'risk_type': '投料过载',
            'severity': severity,
            'description': rules['description'],
            'details': details,
            'recommended_action': rules['action'],
            'detected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        risks.append(risk_details)
        return risks
    
    def _detect_gas_production_drop(self, sensor_data: pd.DataFrame) -> Optional[List[Dict]]:
        """检测产气骤降"""
        risks = []
        rules = self.rules['risk_detection_rules']['gas_production_drop']
        thresholds = self.rules['parameter_thresholds']['gas_production']
        
        gas_data = sensor_data[
            (sensor_data['sensor_type'] == 'gas_production') & 
            (~sensor_data['value'].isna())
        ].sort_values('timestamp')
        
        if len(gas_data) < 4:  # 需要至少几个点来判断趋势
            return None
        
        # 计算最近几个点与之前的对比
        gas_values = gas_data['value'].values
        timestamps = gas_data['timestamp'].values
        
        # 取前半部分作为基准，后半部分作为当前
        mid_point = len(gas_values) // 2
        baseline = gas_values[:mid_point].mean()
        current = gas_values[mid_point:].mean()
        
        if baseline <= 0:
            return None
        
        drop_ratio = (baseline - current) / baseline
        drop_percent = drop_ratio * 100
        
        threshold = thresholds['sudden_drop_threshold'] * 100
        
        severity = None
        details = {
            '基准产气量': float(baseline),
            '当前产气量': float(current),
            '下降比例': float(drop_percent),
            '数据点数': int(len(gas_values))
        }
        
        if drop_ratio >= threshold:
            if drop_ratio >= threshold * 1.5:
                severity = 'critical'
            else:
                severity = 'warning'
        else:
            return None
        
        risk_details = {
            'risk_type': '产气骤降',
            'severity': severity,
            'description': rules['description'],
            'details': details,
            'recommended_action': rules['action'],
            'detected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        risks.append(risk_details)
        return risks
    
    def _detect_sensor_failure(self, sensor_data: pd.DataFrame) -> Optional[List[Dict]]:
        """检测传感器断采"""
        risks = []
        rules = self.rules['risk_detection_rules']['sensor_failure']
        sampling_config = self.rules['sampling']
        
        expected_interval = sampling_config['expected_interval_minutes']
        max_missing = sampling_config['max_missing_allowed']
        
        sensor_types = sensor_data['sensor_type'].unique()
        
        for sensor_type in sensor_types:
            type_data = sensor_data[
                (sensor_data['sensor_type'] == sensor_type)
            ].sort_values('timestamp')
            
            # 检查NaN值
            nan_count = type_data['value'].isna().sum()
            total_count = len(type_data)
            
            if total_count == 0:
                continue
            
            # 检查连续缺失
            nan_mask = type_data['value'].isna()
            consecutive_nans = 0
            max_consecutive_nans = 0
            
            for is_nan in nan_mask:
                if is_nan:
                    consecutive_nans += 1
                    max_consecutive_nans = max(max_consecutive_nans, consecutive_nans)
                else:
                    consecutive_nans = 0
            
            if max_consecutive_nans >= max_missing or nan_count > total_count * 0.3:
                severity = 'warning' if max_consecutive_nans < max_missing * 2 else 'critical'
                
                risk_details = {
                    'risk_type': '传感器断采',
                    'severity': severity,
                    'sensor_type': sensor_type,
                    'description': rules['description'],
                    'details': {
                        '传感器类型': sensor_type,
                        '缺失点数': int(nan_count),
                        '总点数': int(total_count),
                        '连续缺失最大值': int(max_consecutive_nans),
                        '缺失比例': float(nan_count / total_count * 100)
                    },
                    'recommended_action': rules['action'],
                    'detected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
                risks.append(risk_details)
        
        return risks if risks else None
    
    def export_issues_csv(self, risks: List[Dict], digester_id: str, 
                          start_time: datetime, end_time: datetime) -> str:
        """导出风险问题到CSV"""
        if not risks:
            return None
        
        records = []
        for risk in risks:
            record = {
                '罐体': digester_id,
                '分析时间范围': f"{start_time.strftime('%Y-%m-%d %H:%M')} 至 {end_time.strftime('%Y-%m-%d %H:%M')}",
                '风险类型': risk['risk_type'],
                '严重程度': risk['severity'],
                '描述': risk['description'],
                '详细信息': str(risk.get('details', {})),
                '建议措施': risk['recommended_action'],
                '检测时间': risk['detected_at']
            }
            records.append(record)
        
        df = pd.DataFrame(records)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
        return csv_buffer.getvalue()
    
    def generate_report_markdown(self, risks: List[Dict], metrics: Dict, 
                                  digester_id: str, start_time: datetime, 
                                  end_time: datetime) -> str:
        """生成交接班复盘报告（Markdown格式）"""
        digester_config = self.rules['digesters'].get(digester_id, {})
        digester_name = digester_config.get('name', digester_id)
        
        report = f"""# 厌氧发酵罐交接班复盘报告

## 基本信息
- **罐体编号**: {digester_id}
- **罐体名称**: {digester_name}
- **分析时间范围**: {start_time.strftime('%Y-%m-%d %H:%M')} 至 {end_time.strftime('%Y-%m-%d %H:%M')}
- **报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

"""
        
        # 运行指标摘要
        report += """## 运行指标摘要

### pH指标
"""
        if metrics.get('pH') and metrics['pH'].get('count', 0) > 0:
            ph = metrics['pH']
            report += f"""- **平均值**: {ph.get('mean', 'N/A'):.2f}
- **范围**: {ph.get('min', 'N/A'):.2f} - {ph.get('max', 'N/A'):.2f}
- **趋势**: {ph.get('trend', '未知')}
- **有效数据点**: {ph.get('count', 0)}
"""
        else:
            report += "- 无有效pH数据\n"
        
        report += """
### 温度指标
"""
        if metrics.get('temperature') and metrics['temperature'].get('count', 0) > 0:
            temp = metrics['temperature']
            report += f"""- **平均值**: {temp.get('mean', 'N/A'):.2f} ℃
- **范围**: {temp.get('min', 'N/A'):.2f} - {temp.get('max', 'N/A'):.2f} ℃
- **波动范围**: {temp.get('variation_range', 'N/A'):.2f} ℃
- **标准差**: {temp.get('std', 'N/A'):.4f}
"""
        else:
            report += "- 无有效温度数据\n"
        
        report += """
### VFA指标
"""
        if metrics.get('VFA') and metrics['VFA'].get('count', 0) > 0:
            vfa = metrics['VFA']
            report += f"""- **平均值**: {vfa.get('mean', 'N/A'):.0f} mg/L
- **范围**: {vfa.get('min', 'N/A'):.0f} - {vfa.get('max', 'N/A'):.0f} mg/L
- **趋势**: {vfa.get('trend', '未知')}
"""
        else:
            report += "- 无有效VFA数据\n"
        
        report += """
### 产气指标
"""
        if metrics.get('gas_production') and metrics['gas_production'].get('count', 0) > 0:
            gas = metrics['gas_production']
            report += f"""- **平均产气量**: {gas.get('mean', 'N/A'):.1f} m³/h
- **范围**: {gas.get('min', 'N/A'):.1f} - {gas.get('max', 'N/A'):.1f} m³/h
- **趋势**: {gas.get('trend', '未知')}
"""
        else:
            report += "- 无有效产气数据\n"
        
        report += """
### 投料负荷
"""
        if metrics.get('loading_rate') and metrics['loading_rate'].get('feed_count', 0) > 0:
            load = metrics['loading_rate']
            report += f"""- **总投料量**: {load.get('total_feed_kg', 'N/A'):.0f} kg
- **投料次数**: {load.get('feed_count', 0)} 次
- **平均单次投料**: {load.get('avg_feed_per_event', 'N/A'):.0f} kg
- **实际容积负荷**: {load.get('actual_loading_rate', 'N/A'):.2f} kg VS/(m³·d)
- **设计容积负荷**: {load.get('design_loading_rate', 'N/A'):.2f} kg VS/(m³·d)
- **负荷比**: {load.get('loading_ratio', 'N/A'):.1%}
"""
        else:
            report += "- 无投料记录\n"
        
        report += """
### 产气效率
"""
        if metrics.get('gas_efficiency'):
            efficiency = metrics['gas_efficiency']
            report += f"""- **每kg进料产气量**: {efficiency.get('gas_per_kg_feed', 'N/A'):.2f} m³/kg
- **每kg VS产气量**: {efficiency.get('gas_per_kg_vs', 'N/A'):.2f} m³/kg
"""
        else:
            report += "- 无法计算产气效率（数据不足）\n"
        
        # 风险检测结果
        report += """
---

## 风险检测结果
"""
        
        if risks:
            critical_risks = [r for r in risks if r['severity'] == 'critical']
            warning_risks = [r for r in risks if r['severity'] == 'warning']
            
            report += f"""
### 风险统计
- **严重风险 (Critical)**: {len(critical_risks)} 项
- **警告风险 (Warning)**: {len(warning_risks)} 项
"""
            
            if critical_risks:
                report += """
### 🚨 严重风险 (Critical)
"""
                for risk in critical_risks:
                    report += f"""
#### {risk['risk_type']}
- **描述**: {risk['description']}
- **详细信息**:
"""
                    for key, value in risk['details'].items():
                        report += f"  - {key}: {value}\n"
                    report += f"- **建议措施**: {risk['recommended_action']}\n"
            
            if warning_risks:
                report += """
### ⚠️ 警告风险 (Warning)
"""
                for risk in warning_risks:
                    report += f"""
#### {risk['risk_type']}
- **描述**: {risk['description']}
- **详细信息**:
"""
                    for key, value in risk['details'].items():
                        report += f"  - {key}: {value}\n"
                    report += f"- **建议措施**: {risk['recommended_action']}\n"
        else:
            report += """
✅ **未检测到风险项**，系统运行正常。
"""
        
        report += """
---

## 交接班建议
"""
        
        if risks:
            report += """
1. **立即处理**: 所有严重风险(Critical)项需要立即处理并记录处理措施
2. **持续监测**: 警告风险(Warning)项需要在接班后持续监测相关参数
3. **记录归档**: 本次报告及风险清单需在交接班记录中归档
4. **操作调整**: 根据建议措施调整后续投料计划和运行参数
"""
        else:
            report += """
1. **正常交接**: 当前罐体运行状态良好，无需要立即处理的风险项
2. **持续监测**: 接班后继续按常规频率监测各项运行参数
3. **记录完善**: 正常填写交接班记录，确认无异常情况
"""
        
        report += """
---

*此报告由厌氧发酵罐复盘看板系统自动生成*
"""
        
        return report


def main():
    """主函数 - Streamlit应用入口"""
    st.set_page_config(
        page_title="厌氧发酵罐交接班复盘看板",
        page_icon="🔬",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    st.title("🔬 厌氧发酵罐交接班复盘看板")
    st.markdown("---")
    
    # 初始化应用
    app = AnaerobicDigesterDashboard()
    
    # 加载数据
    try:
        rules = app.load_rules('process_rules.yaml')
        sensor_data = app.load_sensor_data('sensor_readings.csv')
        feed_events = app.load_feed_events('feed_events.jsonl')
    except Exception as e:
        st.error(f"数据加载失败: {e}")
        st.info("请确保以下文件存在于当前目录：sensor_readings.csv, feed_events.jsonl, process_rules.yaml")
        return
    
    # 侧边栏 - 筛选器
    st.sidebar.header("筛选条件")
    
    # 罐体选择
    available_digesters = list(rules['digesters'].keys())
    selected_digester = st.sidebar.selectbox(
        "选择罐体",
        options=available_digesters,
        format_func=lambda x: f"{x} - {rules['digesters'][x]['name']}"
    )
    
    # 日期选择
    all_dates = sorted(sensor_data['timestamp'].dt.date.unique())
    
    # 默认显示最近的数据
    if len(all_dates) >= 2:
        # 处理跨午夜情况 - 允许选择跨越两天的数据
        date_option = st.sidebar.radio(
            "时间范围模式",
            options=["单班数据", "跨夜班数据（覆盖午夜）"],
            index=1
        )
        
        if date_option == "单班数据":
            selected_date = st.sidebar.date_input(
                "选择日期",
                value=all_dates[-1] if all_dates else datetime.now().date()
            )
            
            # 班段选择
            shift = st.sidebar.selectbox(
                "选择班段",
                options=["白班 (08:00-20:00)", "夜班 (20:00-08:00)"],
                index=1
            )
            
            if shift == "白班 (08:00-20:00)":
                start_time = datetime.combine(selected_date, datetime.min.time().replace(hour=8))
                end_time = datetime.combine(selected_date, datetime.min.time().replace(hour=20))
            else:
                # 夜班跨午夜
                start_time = datetime.combine(selected_date, datetime.min.time().replace(hour=20))
                end_time = datetime.combine(selected_date + timedelta(days=1), datetime.min.time().replace(hour=8))
        else:
            # 跨夜班数据
            start_date = st.sidebar.date_input(
                "开始日期",
                value=all_dates[-2] if len(all_dates) >= 2 else all_dates[-1]
            )
            end_date = st.sidebar.date_input(
                "结束日期",
                value=all_dates[-1] if all_dates else datetime.now().date()
            )
            
            start_time = datetime.combine(start_date, datetime.min.time().replace(hour=20))
            end_time = datetime.combine(end_date, datetime.min.time().replace(hour=8))
    else:
        selected_date = st.sidebar.date_input(
            "选择日期",
            value=all_dates[-1] if all_dates else datetime.now().date()
        )
        
        shift = st.sidebar.selectbox(
            "选择班段",
            options=["白班 (08:00-20:00)", "夜班 (20:00-08:00)"],
            index=1
        )
        
        if shift == "白班 (08:00-20:00)":
            start_time = datetime.combine(selected_date, datetime.min.time().replace(hour=8))
            end_time = datetime.combine(selected_date, datetime.min.time().replace(hour=20))
        else:
            start_time = datetime.combine(selected_date, datetime.min.time().replace(hour=20))
            end_time = datetime.combine(selected_date + timedelta(days=1), datetime.min.time().replace(hour=8))
    
    st.sidebar.markdown("---")
    st.sidebar.info(f"当前分析范围: {start_time.strftime('%Y-%m-%d %H:%M')} 至 {end_time.strftime('%Y-%m-%d %H:%M')}")
    
    # 归一化时间线
    normalized_data = app.normalize_timeline(
        sensor_data,
        start_time,
        end_time,
        interval_minutes=30
    )
    
    # 计算指标
    metrics = app.calculate_metrics(
        normalized_data,
        feed_events,
        selected_digester,
        start_time,
        end_time
    )
    
    # 检测风险
    risks = app.detect_risks(
        normalized_data,
        feed_events,
        selected_digester,
        start_time,
        end_time
    )
    
    # 主页面布局
    # 第一行：运行概览
    st.header("📊 运行概览")
    
    # 指标卡片
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.subheader("pH")
        if metrics.get('pH') and metrics['pH'].get('count', 0) > 0:
            ph_mean = metrics['pH']['mean']
            ph_trend = metrics['pH']['trend']
            
            # 根据pH值设置颜色
            if ph_mean < 6.5:
                st.error(f"{ph_mean:.2f}")
            elif ph_mean < 6.8:
                st.warning(f"{ph_mean:.2f}")
            else:
                st.success(f"{ph_mean:.2f}")
            
            st.caption(f"趋势: {ph_trend}")
        else:
            st.metric("pH", "N/A", "无数据")
    
    with col2:
        st.subheader("温度 (℃)")
        if metrics.get('temperature') and metrics['temperature'].get('count', 0) > 0:
            temp_mean = metrics['temperature']['mean']
            temp_variation = metrics['temperature'].get('variation_range', 0)
            nominal_temp = rules['digesters'][selected_digester]['nominal_temperature']
            
            deviation = abs(temp_mean - nominal_temp)
            
            if deviation > 2.0:
                st.error(f"{temp_mean:.2f}")
            elif deviation > 1.0:
                st.warning(f"{temp_mean:.2f}")
            else:
                st.success(f"{temp_mean:.2f}")
            
            st.caption(f"波动: ±{temp_variation/2:.2f}℃")
        else:
            st.metric("温度", "N/A", "无数据")
    
    with col3:
        st.subheader("VFA (mg/L)")
        if metrics.get('VFA') and metrics['VFA'].get('count', 0) > 0:
            vfa_mean = metrics['VFA']['mean']
            vfa_trend = metrics['VFA']['trend']
            
            if vfa_mean > 5000:
                st.error(f"{vfa_mean:.0f}")
            elif vfa_mean > 3000:
                st.warning(f"{vfa_mean:.0f}")
            else:
                st.success(f"{vfa_mean:.0f}")
            
            st.caption(f"趋势: {vfa_trend}")
        else:
            st.metric("VFA", "N/A", "无数据")
    
    with col4:
        st.subheader("产气 (m³/h)")
        if metrics.get('gas_production') and metrics['gas_production'].get('count', 0) > 0:
            gas_mean = metrics['gas_production']['mean']
            gas_trend = metrics['gas_production']['trend']
            baseline = rules['parameter_thresholds']['gas_production']['baseline']
            
            ratio = gas_mean / baseline if baseline > 0 else 0
            
            if ratio < 0.5:
                st.error(f"{gas_mean:.1f}")
            elif ratio < 0.7:
                st.warning(f"{gas_mean:.1f}")
            else:
                st.success(f"{gas_mean:.1f}")
            
            st.caption(f"趋势: {gas_trend}")
        else:
            st.metric("产气", "N/A", "无数据")
    
    st.markdown("---")
    
    # 第二行：趋势图
    st.header("📈 参数趋势")
    
    # 准备绘图数据
    digester_normalized = normalized_data[normalized_data['digester_id'] == selected_digester]
    
    # 创建子图
    fig = make_subplots(
        rows=3, cols=2,
        shared_xaxes=True,
        vertical_spacing=0.1,
        subplot_titles=("pH变化", "温度变化", "VFA变化", "产气量变化", "pH/VFA关联", "")
    )
    
    # pH图
    ph_data = digester_normalized[
        (digester_normalized['sensor_type'] == 'pH')
    ].sort_values('timestamp')
    
    fig.add_trace(
        go.Scatter(
            x=ph_data['timestamp'],
            y=ph_data['value'],
            mode='lines+markers',
            name='pH',
            line=dict(color='blue'),
            marker=dict(
                size=8,
                color=ph_data['is_interpolated'].map({True: 'red', False: 'blue'})
            )
        ),
        row=1, col=1
    )
    
    # 添加正常范围线
    ph_optimal = rules['parameter_thresholds']['pH']['optimal_range']
    fig.add_hline(y=ph_optimal[0], line_dash="dash", line_color="green", row=1, col=1)
    fig.add_hline(y=ph_optimal[1], line_dash="dash", line_color="green", row=1, col=1)
    fig.add_hline(y=rules['parameter_thresholds']['pH']['warning_low'], line_dash="dot", line_color="orange", row=1, col=1)
    
    # 温度图
    temp_data = digester_normalized[
        (digester_normalized['sensor_type'] == 'temperature')
    ].sort_values('timestamp')
    
    fig.add_trace(
        go.Scatter(
            x=temp_data['timestamp'],
            y=temp_data['value'],
            mode='lines+markers',
            name='温度 (℃)',
            line=dict(color='orange'),
            marker=dict(
                size=8,
                color=temp_data['is_interpolated'].map({True: 'red', False: 'orange'})
            )
        ),
        row=1, col=2
    )
    
    nominal_temp = rules['digesters'][selected_digester]['nominal_temperature']
    fig.add_hline(y=nominal_temp, line_dash="dash", line_color="green", row=1, col=2)
    
    # VFA图
    vfa_data = digester_normalized[
        (digester_normalized['sensor_type'] == 'VFA')
    ].sort_values('timestamp')
    
    fig.add_trace(
        go.Scatter(
            x=vfa_data['timestamp'],
            y=vfa_data['value'],
            mode='lines+markers',
            name='VFA (mg/L)',
            line=dict(color='purple'),
            marker=dict(
                size=8,
                color=vfa_data['is_interpolated'].map({True: 'red', False: 'purple'})
            )
        ),
        row=2, col=1
    )
    
    fig.add_hline(y=rules['parameter_thresholds']['VFA']['warning'], line_dash="dash", line_color="orange", row=2, col=1)
    fig.add_hline(y=rules['parameter_thresholds']['VFA']['critical'], line_dash="dot", line_color="red", row=2, col=1)
    
    # 产气量图
    gas_data = digester_normalized[
        (digester_normalized['sensor_type'] == 'gas_production')
    ].sort_values('timestamp')
    
    fig.add_trace(
        go.Scatter(
            x=gas_data['timestamp'],
            y=gas_data['value'],
            mode='lines+markers',
            name='产气 (m³/h)',
            line=dict(color='green'),
            marker=dict(
                size=8,
                color=gas_data['is_interpolated'].map({True: 'red', False: 'green'})
            )
        ),
        row=2, col=2
    )
    
    # pH/VFA关联图
    valid_ph = ph_data[~ph_data['value'].isna()]
    valid_vfa = vfa_data[~vfa_data['value'].isna()]
    
    if len(valid_ph) > 0 and len(valid_vfa) > 0:
        # 按时间对齐
        merged = pd.merge_asof(
            valid_ph.sort_values('timestamp'),
            valid_vfa.sort_values('timestamp'),
            on='timestamp',
            direction='nearest',
            suffixes=('_ph', '_vfa')
        )
        
        if len(merged) > 0:
            fig.add_trace(
                go.Scatter(
                    x=merged['value_ph'],
                    y=merged['value_vfa'],
                    mode='markers',
                    name='pH/VFA点',
                    marker=dict(
                        size=10,
                        color='rgba(0, 0, 255, 0.5)',
                        line=dict(width=2, color='DarkSlateGrey')
                    )
                ),
                row=3, col=1
            )
            
            fig.update_xaxes(title_text="pH", row=3, col=1)
            fig.update_yaxes(title_text="VFA (mg/L)", row=3, col=1)
    
    # 布局设置
    fig.update_layout(
        height=800,
        showlegend=False,
        title_text=f"{selected_digester} 参数趋势分析",
        title_x=0.5
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # 第三行：投料事件和风险列表
    st.markdown("---")
    
    col_left, col_right = st.columns(2)
    
    with col_left:
        st.header("📋 投料事件记录")
        
        digester_feed = feed_events[
            (feed_events['digester_id'] == selected_digester) &
            (feed_events['timestamp'] >= start_time) &
            (feed_events['timestamp'] <= end_time)
        ].sort_values('timestamp')
        
        if len(digester_feed) > 0:
            feed_display = digester_feed.copy()
            feed_display['时间'] = feed_display['timestamp'].dt.strftime('%Y-%m-%d %H:%M')
            feed_display = feed_display.rename(columns={
                'feed_type': '原料类型',
                'quantity_kg': '投料量(kg)',
                'operator': '操作员',
                'remarks': '备注'
            })
            
            st.dataframe(
                feed_display[['时间', '原料类型', '投料量(kg)', '操作员', '备注']],
                hide_index=True,
                use_container_width=True
            )
            
            total_feed = feed_display['投料量(kg)'].sum()
            st.metric("本班组总投料", f"{total_feed:.0f} kg")
        else:
            st.info("本班无投料记录")
    
    with col_right:
        st.header("⚠️ 风险检测结果")
        
        if risks:
            # 按严重程度分组
            critical_risks = [r for r in risks if r['severity'] == 'critical']
            warning_risks = [r for r in risks if r['severity'] == 'warning']
            
            # 显示风险统计
            risk_stats = st.columns(2)
            with risk_stats[0]:
                st.error(f"🚨 严重风险: {len(critical_risks)} 项")
            with risk_stats[1]:
                st.warning(f"⚠️ 警告风险: {len(warning_risks)} 项")
            
            # 可展开的风险详情
            for i, risk in enumerate(risks):
                severity_icon = "🚨" if risk['severity'] == 'critical' else "⚠️"
                with st.expander(f"{severity_icon} {risk['risk_type']} ({risk['severity']})"):
                    st.write(f"**描述**: {risk['description']}")
                    st.write("**详细信息**:")
                    for key, value in risk['details'].items():
                        st.write(f"  - {key}: {value}")
                    st.write(f"**建议措施**: {risk['recommended_action']}")
        else:
            st.success("✅ 未检测到风险项")
            st.write("罐体运行状态良好，各项参数在正常范围内。")
    
    # 第四行：边界情况说明和导出
    st.markdown("---")
    st.header("📑 数据说明与导出")
    
    # 边界情况说明
    col_info1, col_info2 = st.columns(2)
    
    with col_info1:
        st.subheader("数据质量检查")
        
        # 检查插值点数量
        interpolated_count = normalized_data[
            (normalized_data['digester_id'] == selected_digester) &
            (normalized_data['is_interpolated'] == True)
        ].shape[0]
        
        total_count = normalized_data[
            normalized_data['digester_id'] == selected_digester
        ].shape[0]
        
        if interpolated_count > 0:
            st.warning(f"⚠️ 存在 {interpolated_count} 个插值/缺失数据点 (占比 {interpolated_count/total_count*100:.1f}%)")
            st.info("图表中红色标记点为插值或缺失数据")
        else:
            st.success("✅ 数据完整性良好，无插值点")
        
        # 跨午夜检查
        if start_time.day != end_time.day:
            st.info(f"🔄 当前分析跨越午夜 ({start_time.strftime('%m-%d')} 至 {end_time.strftime('%m-%d')})")
            st.write("已正确处理跨午夜的时间线归一化")
    
    with col_info2:
        st.subheader("导出报告")
        
        # 导出 issues.csv
        if risks:
            csv_content = app.export_issues_csv(
                risks, selected_digester, start_time, end_time
            )
            
            if csv_content:
                st.download_button(
                    label="📥 导出风险清单 (CSV)",
                    data=csv_content,
                    file_name=f"issues_{selected_digester}_{start_time.strftime('%Y%m%d')}.csv",
                    mime="text/csv",
                    key="download_csv"
                )
        else:
            st.info("无风险项可导出")
        
        # 生成并导出报告
        report_content = app.generate_report_markdown(
            risks, metrics, selected_digester, start_time, end_time
        )
        
        st.download_button(
            label="📥 导出交接班报告 (MD)",
            data=report_content,
            file_name=f"digester_report_{selected_digester}_{start_time.strftime('%Y%m%d')}.md",
            mime="text/markdown",
            key="download_report"
        )
    
    # 预览报告
    with st.expander("👁️ 预览报告内容"):
        st.markdown(report_content)
    
    # 页脚
    st.markdown("---")
    st.caption(f"厌氧发酵罐复盘看板 | 数据更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
