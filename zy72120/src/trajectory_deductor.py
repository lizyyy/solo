import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.dates import DateFormatter
import os


class TrajectoryDeductor:
    def __init__(self, params_manager, output_dir: str = "output"):
        self.params_manager = params_manager
        self.output_dir = output_dir
        self.deduction_time = None
        self.deduction_results: Dict[str, Any] = {}
        self.figures_generated: List[str] = []

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def deduce(self, data: pd.DataFrame) -> Dict[str, Any]:
        self.deduction_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        config = self.params_manager.get_deduction_config()
        version_info = self.params_manager.get_active_version_info()

        df = data.copy()
        if 'timestamp' not in df.columns:
            raise ValueError("数据缺少 timestamp 列，无法进行轨迹推演")

        object_ids = df['object_id'].unique() if 'object_id' in df.columns else ['unknown']
        all_trajectories = {}

        for obj_id in object_ids:
            obj_data = df[df['object_id'] == obj_id].sort_values('timestamp').reset_index(drop=True) if 'object_id' in df.columns else df.sort_values('timestamp').reset_index(drop=True)

            if len(obj_data) < 2:
                continue

            actual_traj = self._extract_actual_trajectory(obj_data)
            predicted_traj = self._predict_future_trajectory(obj_data, config)

            all_trajectories[str(obj_id)] = {
                'actual': actual_traj,
                'predicted': predicted_traj,
                'summary': {
                    'total_points': len(actual_traj),
                    'predicted_points': len(predicted_traj),
                    'avg_velocity': np.mean([p['velocity'] for p in actual_traj if p['velocity']]),
                    'max_drift': max([p['drift_distance'] for p in actual_traj if p['drift_distance']], default=0)
                }
            }

        self.deduction_results = {
            'deduction_time': self.deduction_time,
            'params_version': version_info.get('version', ''),
            'config_applied': config,
            'objects_count': len(all_trajectories),
            'trajectories': all_trajectories
        }

        return self.deduction_results

    def _extract_actual_trajectory(self, obj_data: pd.DataFrame) -> List[Dict[str, Any]]:
        trajectory = []
        for _, row in obj_data.iterrows():
            point = {
                'timestamp': row['timestamp'].strftime("%Y-%m-%d %H:%M:%S"),
                'x': float(row.get('x_coordinate', np.random.uniform(0, 1000))),
                'y': float(row.get('y_coordinate', np.random.uniform(0, 500))),
                'velocity': float(row.get('water_velocity_normalized', 0)),
                'drift_distance': float(row.get('drift_distance_normalized', 0)),
                'object_size': float(row.get('object_size_normalized', 0)),
                'risk_level': row.get('risk_level', '未知'),
                'anomaly_flags': row.get('anomaly_flags', '正常')
            }
            trajectory.append(point)
        return trajectory

    def _predict_future_trajectory(self, obj_data: pd.DataFrame, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        if len(obj_data) < 2:
            return []

        last_row = obj_data.iloc[-1]
        last_time = last_row['timestamp']
        last_x = float(last_row.get('x_coordinate', 500))
        last_y = float(last_row.get('y_coordinate', 250))

        recent_velocities = obj_data['water_velocity_normalized'].dropna().tail(5)
        avg_velocity = recent_velocities.mean() if len(recent_velocities) > 0 else 1.0
        drift_coeff = config.get('drift_coefficient', 0.85)
        time_step = config.get('time_step_min', 5)
        pred_steps = config.get('prediction_steps', 10)

        dx_base = avg_velocity * drift_coeff * time_step * 60
        dy_base = avg_velocity * drift_coeff * 0.1 * time_step * 60

        predicted = []
        for i in range(1, pred_steps + 1):
            pred_time = last_time + timedelta(minutes=i * time_step)
            noise_x = np.random.normal(0, dx_base * 0.1)
            noise_y = np.random.normal(0, dy_base * 0.1)

            pred_x = last_x + dx_base * i + noise_x
            pred_y = last_y + dy_base * i + noise_y
            pred_velocity = avg_velocity * (1 + np.random.normal(0, 0.05))
            pred_drift = np.sqrt((pred_x - last_x) ** 2 + (pred_y - last_y) ** 2)

            predicted.append({
                'step': i,
                'timestamp': pred_time.strftime("%Y-%m-%d %H:%M:%S"),
                'predicted_x': round(pred_x, 2),
                'predicted_y': round(pred_y, 2),
                'predicted_velocity': round(pred_velocity, 3),
                'predicted_drift': round(pred_drift, 2),
                'confidence': round(max(0.95 - i * 0.05, 0.5), 2)
            })

        return predicted

    def generate_trajectory_chart(self, object_id: str = None, filename: str = None) -> str:
        if not self.deduction_results:
            raise ValueError("请先执行轨迹推演")

        trajectories = self.deduction_results['trajectories']
        if not trajectories:
            return ""

        if object_id is None or object_id not in trajectories:
            object_id = list(trajectories.keys())[0]

        traj = trajectories[object_id]
        actual = traj['actual']
        predicted = traj['predicted']

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f'河道漂浮物轨迹推演 - 物体 {object_id}\n参数版本: {self.deduction_results.get("params_version", "")}', fontsize=14, fontweight='bold')

        ax1 = axes[0, 0]
        actual_x = [p['x'] for p in actual]
        actual_y = [p['y'] for p in actual]
        ax1.plot(actual_x, actual_y, 'b-o', label='实际轨迹', linewidth=2, markersize=6)

        if predicted:
            pred_x = [p['predicted_x'] for p in predicted]
            pred_y = [p['predicted_y'] for p in predicted]
            confidences = [p['confidence'] for p in predicted]
            ax1.plot(pred_x, pred_y, 'r--s', label='预测轨迹', linewidth=2, markersize=5, alpha=0.7)
            for i, (x, y, c) in enumerate(zip(pred_x, pred_y, confidences)):
                ax1.annotate(f'{c:.0%}', (x, y), textcoords="offset points", xytext=(0, 10), ha='center', fontsize=8)

        ax1.set_xlabel('河道横向坐标 (m)')
        ax1.set_ylabel('河道纵向坐标 (m)')
        ax1.set_title('空间轨迹图')
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        ax2 = axes[0, 1]
        times_actual = [datetime.strptime(p['timestamp'], "%Y-%m-%d %H:%M:%S") for p in actual]
        velocities_actual = [p['velocity'] for p in actual]
        ax2.plot(times_actual, velocities_actual, 'b-o', label='实际流速', linewidth=2)

        if predicted:
            times_pred = [datetime.strptime(p['timestamp'], "%Y-%m-%d %H:%M:%S") for p in predicted]
            velocities_pred = [p['predicted_velocity'] for p in predicted]
            ax2.plot(times_pred, velocities_pred, 'r--s', label='预测流速', linewidth=2)

        threshold = self.params_manager.get_threshold('water_velocity_m_s')
        if threshold:
            ax2.axhline(y=threshold, color='orange', linestyle='--', label=f'阈值 {threshold} m/s')

        ax2.set_xlabel('时间')
        ax2.set_ylabel('流速 (m/s)')
        ax2.set_title('流速变化趋势')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        ax2.xaxis.set_major_formatter(DateFormatter('%H:%M'))
        plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45)

        ax3 = axes[1, 0]
        drifts_actual = [p['drift_distance'] for p in actual]
        ax3.plot(times_actual, drifts_actual, 'b-o', label='实际漂移距离', linewidth=2)

        if predicted:
            drifts_pred = [p['predicted_drift'] for p in predicted]
            ax3.plot(times_pred, drifts_pred, 'r--s', label='预测累计漂移', linewidth=2)

        drift_threshold = self.params_manager.get_threshold('drift_distance_m')
        if drift_threshold:
            ax3.axhline(y=drift_threshold, color='orange', linestyle='--', label=f'阈值 {drift_threshold} m')

        ax3.set_xlabel('时间')
        ax3.set_ylabel('漂移距离 (m)')
        ax3.set_title('漂移距离趋势')
        ax3.legend()
        ax3.grid(True, alpha=0.3)
        ax3.xaxis.set_major_formatter(DateFormatter('%H:%M'))
        plt.setp(ax3.xaxis.get_majorticklabels(), rotation=45)

        ax4 = axes[1, 1]
        risk_levels = {'低风险': 1, '中风险': 2, '高风险': 3}
        risk_values = [risk_levels.get(p['risk_level'], 1) for p in actual]
        colors = ['green' if r == 1 else ('yellow' if r == 2 else 'red') for r in risk_values]
        ax4.scatter(times_actual, risk_values, c=colors, s=100, zorder=5)
        ax4.plot(times_actual, risk_values, 'b-', alpha=0.5)

        ax4.set_yticks([1, 2, 3])
        ax4.set_yticklabels(['低风险', '中风险', '高风险'])
        ax4.set_xlabel('时间')
        ax4.set_title('风险等级变化')
        ax4.grid(True, alpha=0.3)
        ax4.xaxis.set_major_formatter(DateFormatter('%H:%M'))
        plt.setp(ax4.xaxis.get_majorticklabels(), rotation=45)

        plt.tight_layout()

        if filename is None:
            filename = f"trajectory_{object_id}_{self.deduction_time.replace(' ', '_').replace(':', '-')}.png"

        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        self.figures_generated.append(filepath)
        return filepath

    def generate_summary_chart(self, anomaly_summary: Dict[str, Any], filename: str = None) -> str:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        fig.suptitle(f'河道漂浮物检测汇总报告\n检测时间: {self.deduction_time} | 参数版本: {self.deduction_results.get("params_version", "")}', fontsize=14, fontweight='bold')

        ax1 = axes[0]
        risk_counts = [
            anomaly_summary.get('high_risk_count', 0),
            anomaly_summary.get('medium_risk_count', 0),
            anomaly_summary.get('low_risk_count', 0)
        ]
        risk_labels = ['高风险', '中风险', '低风险']
        risk_colors = ['#ff6b6b', '#ffd93d', '#6bcb77']
        wedges, texts, autotexts = ax1.pie(risk_counts, labels=risk_labels, colors=risk_colors, autopct='%1.1f%%', startangle=90)
        ax1.set_title('风险等级分布')

        ax2 = axes[1]
        anomaly_types = ['流速超限', '尺寸超限', '漂移超限']
        anomalies = anomaly_summary.get('anomalies', [])
        type_counts = [0, 0, 0]
        for a in anomalies:
            flags = ';'.join(a.get('anomaly_type', []))
            if '流速' in flags:
                type_counts[0] += 1
            if '尺寸' in flags:
                type_counts[1] += 1
            if '漂移' in flags:
                type_counts[2] += 1

        bars = ax2.bar(anomaly_types, type_counts, color=['#4ecdc4', '#45b7d1', '#96ceb4'])
        ax2.set_title('异常类型统计')
        ax2.set_ylabel('记录数')
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width() / 2., height, f'{int(height)}', ha='center', va='bottom')

        ax3 = axes[2]
        thresholds = anomaly_summary.get('thresholds_applied', {})
        threshold_items = list(thresholds.items())[:4]
        labels = [k.replace('_', '\n') for k, _ in threshold_items]
        values = [v for _, v in threshold_items]
        bars = ax3.barh(labels, values, color='#667eea')
        ax3.set_title('当前生效阈值')
        ax3.set_xlabel('阈值数值')
        for i, bar in enumerate(bars):
            width = bar.get_width()
            ax3.text(width, bar.get_y() + bar.get_height() / 2., f'{values[i]}', ha='left', va='center')

        plt.tight_layout()

        if filename is None:
            filename = f"summary_report_{self.deduction_time.replace(' ', '_').replace(':', '-')}.png"

        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        self.figures_generated.append(filepath)
        return filepath

    def get_deduction_results(self) -> Dict[str, Any]:
        return self.deduction_results
