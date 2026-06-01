import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Optional


class AnomalyDetector:
    def __init__(self, params_manager):
        self.params_manager = params_manager
        self.detection_time = None
        self.anomalies: List[Dict[str, Any]] = []
        self.detection_summary: Dict[str, Any] = {}

    def detect(self, data: pd.DataFrame) -> pd.DataFrame:
        self.detection_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        version_info = self.params_manager.get_active_version_info()
        thresholds = self.params_manager.get_thresholds()

        df = data.copy()
        df['anomaly_flags'] = ''
        df['risk_score'] = 0.0
        df['params_version'] = version_info.get('version', '')
        df['detection_time'] = self.detection_time

        for idx, row in df.iterrows():
            flags = []
            risk_components = []

            vel = row.get('water_velocity_normalized', np.nan)
            if pd.notna(vel):
                vel_threshold = thresholds.get('water_velocity_m_s', 3.0)
                if vel > vel_threshold:
                    flags.append(f"流速超限({vel:.2f}>{vel_threshold})")
                    risk_components.append(min((vel / vel_threshold) * 40, 40))

            size = row.get('object_size_normalized', np.nan)
            if pd.notna(size):
                size_threshold = thresholds.get('object_size_m2', 2.0)
                if size > size_threshold:
                    flags.append(f"尺寸超限({size:.2f}>{size_threshold})")
                    risk_components.append(min((size / size_threshold) * 30, 30))

            drift = row.get('drift_distance_normalized', np.nan)
            if pd.notna(drift):
                drift_threshold = thresholds.get('drift_distance_m', 500.0)
                if drift > drift_threshold:
                    flags.append(f"漂移距离超限({drift:.1f}>{drift_threshold})")
                    risk_components.append(min((drift / drift_threshold) * 30, 30))

            risk_score = sum(risk_components)
            df.at[idx, 'anomaly_flags'] = ';'.join(flags) if flags else '正常'
            df.at[idx, 'risk_score'] = round(risk_score, 1)

            if flags:
                self.anomalies.append({
                    'row_index': int(idx),
                    'timestamp': row.get('timestamp', '').strftime("%Y-%m-%d %H:%M:%S") if pd.notna(row.get('timestamp')) else '',
                    'anomaly_type': flags,
                    'risk_score': round(risk_score, 1),
                    'water_velocity': float(vel) if pd.notna(vel) else None,
                    'object_size': float(size) if pd.notna(size) else None,
                    'drift_distance': float(drift) if pd.notna(drift) else None,
                    'params_version': version_info.get('version', ''),
                    'object_id': row.get('object_id', '')
                })

        risk_threshold = thresholds.get('risk_score', 70.0)
        df['risk_level'] = df['risk_score'].apply(
            lambda x: '高风险' if x >= risk_threshold else ('中风险' if x >= risk_threshold * 0.5 else '低风险')
        )

        high_risk = len(df[df['risk_level'] == '高风险'])
        med_risk = len(df[df['risk_level'] == '中风险'])
        low_risk = len(df[df['risk_level'] == '低风险'])

        self.detection_summary = {
            'detection_time': self.detection_time,
            'params_version': version_info.get('version', ''),
            'params_version_note': version_info.get('note', ''),
            'params_created_by': version_info.get('created_by', ''),
            'params_created_at': version_info.get('created_at', ''),
            'thresholds_applied': thresholds,
            'total_records': len(df),
            'anomaly_count': len(self.anomalies),
            'high_risk_count': high_risk,
            'medium_risk_count': med_risk,
            'low_risk_count': low_risk,
            'anomalies': self.anomalies
        }

        return df

    def get_anomalies(self) -> List[Dict[str, Any]]:
        return self.anomalies

    def get_detection_summary(self) -> Dict[str, Any]:
        return self.detection_summary

    def compare_detection_versions(self, data: pd.DataFrame, v1: str, v2: str) -> Dict[str, Any]:
        original_active = self.params_manager.active_version

        self.params_manager.set_active_version(v1)
        result1 = self.detect(data.copy())
        anomalies1 = set([a['row_index'] for a in self.anomalies])
        summary1 = self.detection_summary.copy()

        self.params_manager.set_active_version(v2)
        result2 = self.detect(data.copy())
        anomalies2 = set([a['row_index'] for a in self.anomalies])
        summary2 = self.detection_summary.copy()

        self.params_manager.set_active_version(original_active)

        only_v1 = sorted(anomalies1 - anomalies2)
        only_v2 = sorted(anomalies2 - anomalies1)
        both = sorted(anomalies1 & anomalies2)

        return {
            'version_comparison': {
                'v1': v1,
                'v2': v2,
                'anomalies_only_v1': only_v1,
                'anomalies_only_v2': only_v2,
                'anomalies_in_both': both,
                'count_only_v1': len(only_v1),
                'count_only_v2': len(only_v2),
                'count_in_both': len(both)
            },
            'version_details': {
                v1: {
                    'note': summary1.get('params_version_note', ''),
                    'created_by': summary1.get('params_created_by', ''),
                    'thresholds': summary1.get('thresholds_applied', {}),
                    'total_anomalies': summary1.get('anomaly_count', 0)
                },
                v2: {
                    'note': summary2.get('params_version_note', ''),
                    'created_by': summary2.get('params_created_by', ''),
                    'thresholds': summary2.get('thresholds_applied', {}),
                    'total_anomalies': summary2.get('anomaly_count', 0)
                }
            }
        }

    def generate_processing_suggestions(self) -> List[Dict[str, Any]]:
        suggestions = []

        if not self.anomalies:
            suggestions.append({
                'level': 'info',
                'category': '整体状态',
                'action_item': '正常巡检',
                'description': '本次检测未发现异常记录，可按常规频次继续巡检。',
                'responsible_role': '设备工程师'
            })
            return suggestions

        high_risk_anomalies = [a for a in self.anomalies if a['risk_score'] >= 60]

        if high_risk_anomalies:
            suggestions.append({
                'level': 'urgent',
                'category': '高风险处置',
                'action_item': '立即调度打捞',
                'description': f"发现 {len(high_risk_anomalies)} 条高风险记录，请立即通知河道运维班组前往现场处置。",
                'details': [f"记录{a['row_index']}：{';'.join(a['anomaly_type'])}" for a in high_risk_anomalies[:3]],
                'responsible_role': '值班调度'
            })

        vel_anomalies = [a for a in self.anomalies if any('流速' in t for t in a['anomaly_type'])]
        if vel_anomalies:
            suggestions.append({
                'level': 'warning',
                'category': '流速异常',
                'action_item': '核实水情',
                'description': f"发现 {len(vel_anomalies)} 条流速超限记录，请与水文站确认是否处于汛期或上游放水。",
                'responsible_role': '水文监测员'
            })

        size_anomalies = [a for a in self.anomalies if any('尺寸' in t for t in a['anomaly_type'])]
        if size_anomalies:
            suggestions.append({
                'level': 'warning',
                'category': '大尺寸漂浮物',
                'action_item': '重点跟踪',
                'description': f"发现 {len(size_anomalies)} 条大尺寸漂浮物，可能对水工构筑物造成影响，建议持续跟踪轨迹。",
                'responsible_role': '设备工程师'
            })

        suggestions.append({
            'level': 'info',
            'category': '数据留痕',
            'action_item': '导出归档',
            'description': f"本次检测使用{self.detection_summary.get('params_version', '')}参数，判定结果已自动标注版本号，建议导出PDF存档。",
            'responsible_role': '设备工程师'
        })

        return suggestions
