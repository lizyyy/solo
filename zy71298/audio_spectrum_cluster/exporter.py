"""数据导出模块
支持将聚类结果、特征数据、异常报告导出为CSV、JSON、Excel等格式。
"""

import os
import json
import pandas as pd
from typing import List, Dict, Optional, Any
from datetime import datetime

from .models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringReport,
    HistoryRecord
)


class DataExporter:
    """数据导出器"""

    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_segments_csv(
        self,
        segments: List[AudioSegment],
        report: Optional[ClusteringReport] = None,
        output_file: Optional[str] = None
    ) -> str:
        """导出音频片段元数据为CSV"""
        data = []
        for seg in segments:
            row = {
                'segment_id': seg.segment_id,
                'file_name': seg.file_name,
                'file_path': seg.file_path,
                'sample_rate': seg.sample_rate,
                'duration': seg.duration,
                'channels': seg.channels,
                'instrument_tags': ', '.join(seg.instrument_tags),
                'performance_version': seg.performance_version or '',
                'composer': seg.composer or '',
                'title': seg.title or '',
                'notes': seg.notes or '',
                'original_segment_id': seg.original_segment_id or '',
                'created_at': seg.created_at.isoformat()
            }

            if report and seg.segment_id in report.clustering_results:
                result = report.clustering_results[seg.segment_id]
                row['cluster_label'] = result.cluster_label
                row['cluster_name'] = result.cluster_name
                row['confidence'] = result.confidence
                row['distance_to_centroid'] = result.distance_to_centroid
                row['umap_x'] = result.umap_2d[0]
                row['umap_y'] = result.umap_2d[1]

            data.append(row)

        df = pd.DataFrame(data)

        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"segments_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )

        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file

    def export_features_csv(
        self,
        features_list: List[SpectralFeatures],
        output_file: Optional[str] = None
    ) -> str:
        """导出频谱特征为CSV"""
        data = []
        for feat in features_list:
            row = {
                'segment_id': feat.segment_id,
                'tempo': feat.tempo,
                'spectral_centroid': feat.spectral_centroid,
                'spectral_bandwidth': feat.spectral_bandwidth,
                'spectral_rolloff': feat.spectral_rolloff,
                'zero_crossing_rate': feat.zero_crossing_rate,
                'rms_energy': feat.rms_energy,
                'rms_energy_std': feat.rms_energy_std,
                'extracted_at': feat.extracted_at.isoformat()
            }

            for i, mfcc_val in enumerate(feat.mfcc, 1):
                row[f'mfcc_{i}'] = mfcc_val
            for i, mfcc_std_val in enumerate(feat.mfcc_std, 1):
                row[f'mfcc_std_{i}'] = mfcc_std_val
            for i, contrast_val in enumerate(feat.spectral_contrast, 1):
                row[f'spectral_contrast_{i}'] = contrast_val
            for i, chroma_val in enumerate(feat.chroma_stft, 1):
                row[f'chroma_{i}'] = chroma_val

            data.append(row)

        df = pd.DataFrame(data)

        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"features_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )

        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file

    def export_clustering_report(
        self,
        report: ClusteringReport,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures],
        output_file: Optional[str] = None
    ) -> str:
        """导出完整聚类报告为JSON"""
        report_data = {
            'report_id': report.report_id,
            'created_at': report.created_at.isoformat(),
            'summary': {
                'n_clusters': report.n_clusters,
                'total_segments': report.total_segments,
                'silhouette_score': report.silhouette_score,
                'calinski_harabasz_score': report.calinski_harabasz_score,
                'notes': report.notes or ''
            },
            'cluster_names': report.cluster_names,
            'clusters_summary': report.clusters_summary,
            'feature_importance': report.feature_importance,
            'anomalies': [a.to_dict() for a in report.anomalies],
            'clustering_results': {
                k: v.to_dict() for k, v in report.clustering_results.items()
            },
            'segments': {s.segment_id: s.to_dict() for s in segments},
            'features': {f.segment_id: f.to_dict() for f in features_list}
        }

        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"clustering_report_{report.report_id}.json"
            )

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return output_file

    def export_anomalies_csv(
        self,
        report: ClusteringReport,
        segments: List[AudioSegment],
        output_file: Optional[str] = None
    ) -> str:
        """导出异常报告为CSV"""
        seg_map = {s.segment_id: s for s in segments}

        data = []
        for anomaly in report.anomalies:
            seg = seg_map.get(anomaly.segment_id)
            row = {
                'segment_id': anomaly.segment_id,
                'file_name': seg.file_name if seg else '',
                'anomaly_type': anomaly.anomaly_type.value,
                'severity': anomaly.severity,
                'description': anomaly.description,
                'detected_at': anomaly.detected_at.isoformat()
            }

            for key, value in anomaly.affected_values.items():
                row[f'affected_{key}'] = str(value)

            data.append(row)

        df = pd.DataFrame(data)

        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"anomalies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )

        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file

    def export_history_csv(
        self,
        history: List[HistoryRecord],
        output_file: Optional[str] = None
    ) -> str:
        """导出历史记录为CSV"""
        data = []
        for record in history:
            data.append({
                'record_id': record.record_id,
                'operation_type': record.operation_type.value,
                'segment_ids': ', '.join(record.segment_ids),
                'timestamp': record.timestamp.isoformat(),
                'operator': record.operator or '',
                'description': record.description or '',
                'previous_state_ref': record.previous_state_ref or '',
                'new_state_ref': record.new_state_ref or ''
            })

        df = pd.DataFrame(data)

        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )

        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return output_file

    def export_comparison_excel(
        self,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures],
        report: ClusteringReport,
        output_file: Optional[str] = None
    ) -> str:
        """导出所有数据为Excel文件，包含多个sheet"""
        if output_file is None:
            output_file = os.path.join(
                self.output_dir,
                f"full_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            )

        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            seg_data = []
            for seg in segments:
                row = seg.to_dict()
                if seg.segment_id in report.clustering_results:
                    result = report.clustering_results[seg.segment_id]
                    row['cluster_label'] = result.cluster_label
                    row['cluster_name'] = result.cluster_name
                    row['confidence'] = result.confidence
                seg_data.append(row)
            pd.DataFrame(seg_data).to_excel(
                writer, sheet_name='音频片段', index=False)

            feat_data = []
            for feat in features_list:
                row = {
                    'segment_id': feat.segment_id,
                    'tempo': feat.tempo,
                    'spectral_centroid': feat.spectral_centroid,
                    'spectral_bandwidth': feat.spectral_bandwidth,
                    'rms_energy': feat.rms_energy,
                    'zero_crossing_rate': feat.zero_crossing_rate
                }
                feat_data.append(row)
            pd.DataFrame(feat_data).to_excel(
                writer, sheet_name='特征摘要', index=False)

            cluster_data = []
            for summary in report.clusters_summary:
                cluster_data.append({
                    '聚类ID': summary['cluster_id'],
                    '聚类名称': summary['cluster_name'],
                    '样本数量': summary['size'],
                    '平均节拍(BPM)': summary['avg_tempo'],
                    '平均频谱质心(Hz)': summary['avg_spectral_centroid'],
                    '平均RMS能量': summary['avg_rms_energy'],
                    '乐器标签': ', '.join(summary['instrument_tags'])
                })
            pd.DataFrame(cluster_data).to_excel(
                writer, sheet_name='聚类概览', index=False)

            if report.anomalies:
                anom_data = []
                seg_map = {s.segment_id: s for s in segments}
                for anomaly in report.anomalies:
                    seg = seg_map.get(anomaly.segment_id)
                    anom_data.append({
                        '片段ID': anomaly.segment_id,
                        '文件名': seg.file_name if seg else '',
                        '异常类型': anomaly.anomaly_type.value,
                        '严重程度': anomaly.severity,
                        '描述': anomaly.description
                    })
                pd.DataFrame(anom_data).to_excel(
                    writer, sheet_name='异常报告', index=False)

            summary_data = [{
                '报告ID': report.report_id,
                '生成时间': report.created_at.isoformat(),
                '聚类数量': report.n_clusters,
                '总片段数': report.total_segments,
                '轮廓系数': report.silhouette_score,
                'CH指数': report.calinski_harabasz_score,
                '异常数量': len(report.anomalies)
            }]
            pd.DataFrame(summary_data).to_excel(
                writer, sheet_name='报告摘要', index=False)

        return output_file

    def export_all(
        self,
        segments: List[AudioSegment],
        features_list: List[SpectralFeatures],
        report: ClusteringReport,
        history: Optional[List[HistoryRecord]] = None
    ) -> Dict[str, str]:
        """一键导出所有格式"""
        output_files = {}

        output_files['segments_csv'] = self.export_segments_csv(segments, report)
        output_files['features_csv'] = self.export_features_csv(features_list)
        output_files['anomalies_csv'] = self.export_anomalies_csv(report, segments)
        output_files['report_json'] = self.export_clustering_report(
            report, segments, features_list)
        output_files['full_excel'] = self.export_comparison_excel(
            segments, features_list, report)

        if history:
            output_files['history_csv'] = self.export_history_csv(history)

        return output_files

