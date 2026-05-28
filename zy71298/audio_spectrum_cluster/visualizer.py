"""可视化模块
生成聚类散点图、特征分布图、特征重要性图等图表。
"""

import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Dict, Optional, Any, Tuple
from matplotlib.figure import Figure
import io
import base64

from .models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringReport,
    AnomalyReport
)


class ClusterVisualizer:
    """聚类结果可视化器"""

    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        sns.set_style("whitegrid")
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
        self.colors = sns.color_palette("husl", 10)

    def _get_cluster_color(self, cluster_id: int) -> Tuple[float, float, float]:
        return self.colors[cluster_id % len(self.colors)]

    def plot_umap_clusters(
        self,
        segments: List[AudioSegment],
        report: ClusteringReport,
        output_file: Optional[str] = None,
        show_labels: bool = True
    ) -> str:
        """绘制UMAP聚类散点图"""
        fig, ax = plt.subplots(figsize=(10, 8))

        cluster_points: Dict[int, List[Tuple[float, float, str, str]]] = {}

        for seg in segments:
            result = report.clustering_results[seg.segment_id]
            cluster_id = result.cluster_label
            x, y = result.umap_2d

            if cluster_id not in cluster_points:
                cluster_points[cluster_id] = []
            cluster_points[cluster_id].append(
                (x, y, seg.file_name, seg.segment_id)
            )

        for cluster_id, points in cluster_points.items():
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            labels = [p[2] for p in points]

            color = self._get_cluster_color(cluster_id)
            cluster_name = report.cluster_names.get(cluster_id, f"Cluster {cluster_id}")

            ax.scatter(
                xs, ys,
                c=[color],
                label=cluster_name,
                s=100,
                alpha=0.8,
                edgecolors='white',
                linewidths=1.5
            )

            if show_labels:
                for x, y, label, _ in points:
                    ax.annotate(
                        label, (x, y),
                        xytext=(5, 5),
                        textcoords='offset points',
                        fontsize=8,
                        alpha=0.7
                    )

        ax.set_xlabel('UMAP Dimension 1', fontsize=12)
        ax.set_ylabel('UMAP Dimension 2', fontsize=12)
        ax.set_title('音频片段谱聚类结果 (UMAP 2D投影)', fontsize=14, fontweight='bold')
        ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "umap_clusters.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_feature_distribution(
        self,
        features_list: List[SpectralFeatures],
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """绘制特征分布箱线图"""
        feature_data = {
            'Tempo (BPM)': [f.tempo for f in features_list],
            'Spectral Centroid (Hz)': [f.spectral_centroid for f in features_list],
            'RMS Energy': [f.rms_energy for f in features_list],
            'Zero Crossing Rate': [f.zero_crossing_rate for f in features_list],
            'Spectral Bandwidth (Hz)': [f.spectral_bandwidth for f in features_list]
        }

        clusters = [
            report.clustering_results[f.segment_id].cluster_label
            for f in features_list
        ]

        n_features = len(feature_data)
        fig, axes = plt.subplots(2, 3, figsize=(15, 10))
        axes = axes.flatten()

        for idx, (feature_name, values) in enumerate(feature_data.items()):
            ax = axes[idx]
            df_data = {
                'Value': values,
                'Cluster': [report.cluster_names.get(c, f'Cluster {c}') for c in clusters]
            }

            sns.boxplot(
                data=df_data,
                x='Cluster',
                y='Value',
                ax=ax,
                palette='husl',
                hue='Cluster',
                legend=False
            )
            ax.set_title(feature_name, fontsize=11)
            ax.set_xlabel('')
            ax.set_ylabel('')
            ax.tick_params(axis='x', rotation=45)

        for i in range(n_features, len(axes)):
            axes[i].axis('off')

        fig.suptitle('各聚类的音乐特征分布比较', fontsize=14, fontweight='bold')
        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "feature_distributions.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_feature_importance(
        self,
        report: ClusteringReport,
        top_n: int = 15,
        output_file: Optional[str] = None
    ) -> str:
        """绘制特征重要性条形图"""
        importance = sorted(
            report.feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_n]

        feature_names = [item[0] for item in importance]
        importance_values = [item[1] * 100 for item in importance]

        fig, ax = plt.subplots(figsize=(10, 8))

        y_pos = np.arange(len(feature_names))
        bars = ax.barh(y_pos, importance_values, color=sns.color_palette("viridis", len(feature_names)))

        ax.set_yticks(y_pos)
        ax.set_yticklabels(feature_names, fontsize=10)
        ax.set_xlabel('重要性 (%)', fontsize=12)
        ax.set_title('聚类特征重要性排序', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='x')

        for bar, value in zip(bars, importance_values):
            width = bar.get_width()
            ax.text(
                width + 0.5,
                bar.get_y() + bar.get_height() / 2,
                f'{value:.1f}%',
                ha='left',
                va='center',
                fontsize=9
            )

        ax.invert_yaxis()
        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "feature_importance.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_cluster_sizes(
        self,
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """绘制聚类大小饼图"""
        sizes = []
        labels = []
        colors = []

        for summary in report.clusters_summary:
            sizes.append(summary['size'])
            labels.append(summary['cluster_name'])
            colors.append(self._get_cluster_color(summary['cluster_id']))

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        wedges, texts, autotexts = ax1.pie(
            sizes,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            textprops={'fontsize': 10}
        )
        ax1.set_title('各聚类样本占比', fontsize=12, fontweight='bold')

        x_pos = np.arange(len(labels))
        bars = ax2.bar(x_pos, sizes, color=colors)
        ax2.set_xticks(x_pos)
        ax2.set_xticklabels(labels, rotation=45, ha='right', fontsize=10)
        ax2.set_ylabel('样本数量', fontsize=11)
        ax2.set_title('各聚类样本数量', fontsize=12, fontweight='bold')

        for bar, size in zip(bars, sizes):
            height = bar.get_height()
            ax2.text(
                bar.get_x() + bar.get_width() / 2,
                height + 0.1,
                str(size),
                ha='center',
                va='bottom',
                fontsize=10
            )

        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "cluster_sizes.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_anomalies(
        self,
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """绘制异常检测结果统计图"""
        if not report.anomalies:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.text(
                0.5, 0.5,
                '未检测到任何异常',
                ha='center',
                va='center',
                fontsize=14,
                transform=ax.transAxes
            )
            ax.axis('off')
            if output_file is None:
                output_file = os.path.join(self.output_dir, "anomalies.png")
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            plt.close(fig)
            return output_file

        anomaly_types = {}
        anomaly_severity = {}

        for anomaly in report.anomalies:
            atype = anomaly.anomaly_type.value
            severity = anomaly.severity

            if atype not in anomaly_types:
                anomaly_types[atype] = 0
            anomaly_types[atype] += 1

            if severity not in anomaly_severity:
                anomaly_severity[severity] = 0
            anomaly_severity[severity] += 1

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        type_names = {
            'sample_rate_mismatch': '采样率不一致',
            'silence_segment': '静音段',
            'label_conflict': '标签冲突'
        }

        labels = [type_names.get(k, k) for k in anomaly_types.keys()]
        values = list(anomaly_types.values())
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']

        bars = ax1.bar(range(len(labels)), values, color=colors[:len(labels)])
        ax1.set_xticks(range(len(labels)))
        ax1.set_xticklabels(labels, fontsize=11)
        ax1.set_ylabel('数量', fontsize=11)
        ax1.set_title('异常类型分布', fontsize=12, fontweight='bold')

        for bar, val in zip(bars, values):
            height = bar.get_height()
            ax1.text(
                bar.get_x() + bar.get_width() / 2,
                height + 0.1,
                str(val),
                ha='center',
                va='bottom',
                fontsize=11
            )

        severity_order = ['high', 'medium', 'low']
        severity_labels = ['高', '中', '低']
        severity_colors = ['#E74C3C', '#F39C12', '#3498DB']

        sev_values = [anomaly_severity.get(s, 0) for s in severity_order]
        non_zero_indices = [i for i, v in enumerate(sev_values) if v > 0]
        sev_values_filtered = [sev_values[i] for i in non_zero_indices]
        sev_labels_filtered = [severity_labels[i] for i in non_zero_indices]
        sev_colors_filtered = [severity_colors[i] for i in non_zero_indices]

        if sev_values_filtered:
            wedges, texts, autotexts = ax2.pie(
                sev_values_filtered,
                labels=sev_labels_filtered,
                colors=sev_colors_filtered,
                autopct='%1.1f%%',
                startangle=90
            )
        ax2.set_title('异常严重程度分布', fontsize=12, fontweight='bold')

        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "anomalies.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_tempo_comparison(
        self,
        features_list: List[SpectralFeatures],
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """绘制节拍速度对比小提琴图"""
        tempos = []
        clusters = []

        for feat in features_list:
            result = report.clustering_results[feat.segment_id]
            tempos.append(feat.tempo)
            clusters.append(report.cluster_names.get(
                result.cluster_label,
                f"Cluster {result.cluster_label}"
            ))

        fig, ax = plt.subplots(figsize=(12, 6))

        sns.violinplot(
            x=clusters,
            y=tempos,
            ax=ax,
            palette='husl',
            hue=clusters,
            legend=False,
            inner='quartile'
        )

        sns.stripplot(
            x=clusters,
            y=tempos,
            ax=ax,
            color='black',
            size=5,
            alpha=0.6
        )

        ax.set_xlabel('聚类', fontsize=12)
        ax.set_ylabel('节拍速度 (BPM)', fontsize=12)
        ax.set_title('各聚类节拍速度分布对比', fontsize=14, fontweight='bold')
        ax.tick_params(axis='x', rotation=45)
        ax.grid(True, alpha=0.3, axis='y')

        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "tempo_comparison.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def plot_cluster_heatmap(
        self,
        features_list: List[SpectralFeatures],
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """绘制聚类特征热力图"""
        feature_keys = [
            'tempo', 'spectral_centroid', 'spectral_bandwidth',
            'spectral_rolloff', 'zero_crossing_rate', 'rms_energy'
        ]
        feature_labels = [
            'Tempo', 'Centroid', 'Bandwidth',
            'Rolloff', 'ZCR', 'RMS'
        ]

        cluster_ids = sorted(report.cluster_names.keys())

        heatmap_data = np.zeros((len(cluster_ids), len(feature_keys)))

        for i, cluster_id in enumerate(cluster_ids):
            cluster_features = [
                f for f in features_list
                if report.clustering_results[f.segment_id].cluster_label == cluster_id
            ]

            for j, key in enumerate(feature_keys):
                values = [getattr(f, key) for f in cluster_features]
                heatmap_data[i, j] = np.mean(values)

        heatmap_data = (heatmap_data - heatmap_data.mean(axis=0)) / heatmap_data.std(axis=0)

        fig, ax = plt.subplots(figsize=(10, 8))

        cluster_labels = [report.cluster_names[cid] for cid in cluster_ids]

        sns.heatmap(
            heatmap_data,
            annot=True,
            fmt='.2f',
            xticklabels=feature_labels,
            yticklabels=cluster_labels,
            cmap='RdBu_r',
            center=0,
            ax=ax,
            cbar_kws={'label': '标准化均值 (Z-score)'}
        )

        ax.set_title('各聚类平均特征热力图', fontsize=14, fontweight='bold')
        plt.tight_layout()

        if output_file is None:
            output_file = os.path.join(self.output_dir, "cluster_heatmap.png")

        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close(fig)

        return output_file

    def generate_all_charts(
        self,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures],
        report: ClusteringReport
    ) -> Dict[str, str]:
        """生成所有图表"""
        charts = {}

        charts['umap_clusters'] = self.plot_umap_clusters(segments, report)
        charts['feature_distributions'] = self.plot_feature_distribution(
            features_list, report)
        charts['feature_importance'] = self.plot_feature_importance(report)
        charts['cluster_sizes'] = self.plot_cluster_sizes(report)
        charts['anomalies'] = self.plot_anomalies(report)
        charts['tempo_comparison'] = self.plot_tempo_comparison(
            features_list, report)
        charts['cluster_heatmap'] = self.plot_cluster_heatmap(
            features_list, report)

        return charts

    def fig_to_base64(self, fig: Figure) -> str:
        """将matplotlib图表转换为base64字符串（用于Web界面）"""
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return f"data:image/png;base64,{img_str}"

    def generate_umap_html(
        self,
        segments: List[AudioSegment],
        report: ClusteringReport
    ) -> str:
        """生成UMAP图的base64 HTML图像"""
        output_file = self.plot_umap_clusters(segments, report, show_labels=False)
        with open(output_file, 'rb') as f:
            img_str = base64.b64encode(f.read()).decode('utf-8')
        return f"data:image/png;base64,{img_str}"

