import json
import csv
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

from .models import (
    EvidencePackage, 
    Timeline, 
    VideoSegment, 
    GPSPoint, 
    Anomaly, 
    AnomalyType, 
    AnomalySeverity
)


class EvidenceExporter:
    """
    取证包导出器
    负责导出以下文件：
    1. manifest.json - 取证包元数据和哈希清单
    2. timeline.md - 时间线报告
    3. anomalies.csv - 异常列表
    """
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_all(self, package: EvidencePackage) -> Dict[str, str]:
        """
        导出所有文件
        返回: {file_type: file_path, ...}
        """
        results = {}
        
        manifest_path = self.export_manifest(package)
        results['manifest'] = manifest_path
        
        timeline_path = self.export_timeline_md(package)
        results['timeline'] = timeline_path
        
        anomalies_path = self.export_anomalies_csv(package)
        results['anomalies'] = anomalies_path
        
        return results
    
    def export_manifest(self, package: EvidencePackage) -> str:
        """
        导出 manifest.json
        """
        manifest_data = {
            'package_id': package.package_id,
            'generated_at': package.generated_at.isoformat(),
            'tool_version': package.tool_version,
            'source_directory': package.source_directory,
            'metadata': package.metadata,
            'timeline': self._timeline_to_dict(package.timeline) if package.timeline else None,
            'hash_manifest': package.hash_manifest,
            'anomalies_summary': self._anomalies_summary(package.anomalies),
            'file_index': self._file_index_to_dict(package.file_index)
        }
        
        manifest_path = self.output_dir / 'manifest.json'
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        
        return str(manifest_path)
    
    def export_timeline_md(self, package: EvidencePackage) -> str:
        """
        导出 timeline.md
        """
        lines = []
        
        lines.append(f"# 取证时间线报告")
        lines.append("")
        lines.append(f"**包ID**: {package.package_id}")
        lines.append(f"**生成时间**: {package.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**工具版本**: {package.tool_version}")
        lines.append("")
        
        if package.timeline:
            lines.append("## 时间线概览")
            lines.append("")
            lines.append(f"- **开始时间**: {package.timeline.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- **结束时间**: {package.timeline.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            total_duration = package.timeline.end_time - package.timeline.start_time
            lines.append(f"- **总时长**: {self._format_timedelta(total_duration)}")
            lines.append(f"- **视频片段数**: {len(package.timeline.video_segments)}")
            lines.append(f"- **GPS轨迹点数**: {len(package.timeline.gps_points)}")
            lines.append(f"- **时钟校准数**: {len(package.timeline.clock_calibrations)}")
            lines.append("")
            
            lines.append("## 视频片段时间线")
            lines.append("")
            lines.append("| 序号 | 文件名 | 开始时间 | 结束时间 | 时长 | 哈希值 |")
            lines.append("|------|--------|----------|----------|------|--------|")
            
            for i, segment in enumerate(sorted(package.timeline.video_segments, key=lambda x: x.start_time), 1):
                start_str = segment.start_time.strftime('%Y-%m-%d %H:%M:%S')
                end_str = segment.end_time.strftime('%Y-%m-%d %H:%M:%S')
                duration_str = self._format_timedelta(segment.duration)
                hash_str = segment.sha256_hash[:16] + "..." if segment.sha256_hash else "N/A"
                
                lines.append(f"| {i} | {segment.filename} | {start_str} | {end_str} | {duration_str} | {hash_str} |")
            
            lines.append("")
            
            if package.timeline.gps_points:
                lines.append("## GPS轨迹概览")
                lines.append("")
                
                sorted_points = sorted(package.timeline.gps_points, key=lambda x: x.timestamp)
                first_point = sorted_points[0]
                last_point = sorted_points[-1]
                
                lines.append(f"- **起点时间**: {first_point.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **起点坐标**: ({first_point.latitude:.6f}, {first_point.longitude:.6f})")
                lines.append(f"- **终点时间**: {last_point.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **终点坐标**: ({last_point.latitude:.6f}, {last_point.longitude:.6f})")
                lines.append(f"- **总点数**: {len(sorted_points)}")
                lines.append("")
            
            if package.timeline.clock_calibrations:
                lines.append("## 时钟校准记录")
                lines.append("")
                lines.append("| 校准时间 | 设备时间 | 参考时间 | 漂移(秒) | 类型 |")
                lines.append("|----------|----------|----------|----------|------|")
                
                for cal in sorted(package.timeline.clock_calibrations, key=lambda x: x.calibration_time):
                    cal_time = cal.calibration_time.strftime('%Y-%m-%d %H:%M:%S')
                    dev_time = cal.device_time.strftime('%Y-%m-%d %H:%M:%S')
                    ref_time = cal.reference_time.strftime('%Y-%m-%d %H:%M:%S')
                    
                    lines.append(f"| {cal_time} | {dev_time} | {ref_time} | {cal.drift_seconds:.3f} | {cal.calibration_type} |")
                
                lines.append("")
        
        if package.anomalies:
            lines.append("## 异常概览")
            lines.append("")
            
            anomaly_counts = self._count_anomalies_by_type(package.anomalies)
            
            for anomaly_type, count in anomaly_counts.items():
                lines.append(f"- **{anomaly_type.value}**: {count} 个")
            
            lines.append("")
            
            lines.append("### 详细异常列表")
            lines.append("")
            
            for i, anomaly in enumerate(package.anomalies, 1):
                timestamp_str = anomaly.timestamp.strftime('%Y-%m-%d %H:%M:%S') if anomaly.timestamp else "N/A"
                
                lines.append(f"#### 异常 #{i}")
                lines.append("")
                lines.append(f"- **类型**: {anomaly.anomaly_type.value}")
                lines.append(f"- **严重程度**: {anomaly.severity.value}")
                lines.append(f"- **时间戳**: {timestamp_str}")
                lines.append(f"- **描述**: {anomaly.description}")
                
                if anomaly.affected_files:
                    lines.append(f"- **受影响文件**: {', '.join(anomaly.affected_files)}")
                
                if anomaly.affected_time_range:
                    start_str = anomaly.affected_time_range[0].strftime('%Y-%m-%d %H:%M:%S')
                    end_str = anomaly.affected_time_range[1].strftime('%Y-%m-%d %H:%M:%S')
                    lines.append(f"- **受影响时间范围**: {start_str} - {end_str}")
                
                lines.append("")
        
        if package.hash_manifest:
            lines.append("## 哈希清单")
            lines.append("")
            lines.append("| 文件名 | SHA256 哈希值 |")
            lines.append("|--------|---------------|")
            
            for filename, hash_value in package.hash_manifest.items():
                lines.append(f"| {filename} | {hash_value} |")
            
            lines.append("")
        
        timeline_path = self.output_dir / 'timeline.md'
        with open(timeline_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(timeline_path)
    
    def export_anomalies_csv(self, package: EvidencePackage) -> str:
        """
        导出 anomalies.csv
        """
        csv_path = self.output_dir / 'anomalies.csv'
        
        fieldnames = [
            'id',
            'type',
            'severity',
            'timestamp',
            'description',
            'affected_files',
            'time_range_start',
            'time_range_end',
            'details_json'
        ]
        
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for i, anomaly in enumerate(package.anomalies, 1):
                row = {
                    'id': i,
                    'type': anomaly.anomaly_type.value,
                    'severity': anomaly.severity.value,
                    'timestamp': anomaly.timestamp.isoformat() if anomaly.timestamp else '',
                    'description': anomaly.description,
                    'affected_files': '|'.join(anomaly.affected_files) if anomaly.affected_files else '',
                    'time_range_start': '',
                    'time_range_end': '',
                    'details_json': json.dumps(anomaly.details, ensure_ascii=False)
                }
                
                if anomaly.affected_time_range:
                    row['time_range_start'] = anomaly.affected_time_range[0].isoformat()
                    row['time_range_end'] = anomaly.affected_time_range[1].isoformat()
                
                writer.writerow(row)
        
        return str(csv_path)
    
    def _timeline_to_dict(self, timeline: Timeline) -> Dict[str, Any]:
        """
        将时间线转换为字典格式
        """
        return {
            'start_time': timeline.start_time.isoformat(),
            'end_time': timeline.end_time.isoformat(),
            'video_segments': [
                {
                    'filename': seg.filename,
                    'file_path': seg.file_path,
                    'start_time': seg.start_time.isoformat(),
                    'end_time': seg.end_time.isoformat(),
                    'duration_seconds': seg.duration.total_seconds(),
                    'device_id': seg.device_id,
                    'file_size': seg.file_size,
                    'sha256_hash': seg.sha256_hash,
                    'metadata': seg.metadata
                }
                for seg in timeline.video_segments
            ],
            'gps_points': [
                {
                    'timestamp': point.timestamp.isoformat(),
                    'latitude': point.latitude,
                    'longitude': point.longitude,
                    'altitude': point.altitude,
                    'speed': point.speed,
                    'satellites': point.satellites,
                    'quality': point.quality
                }
                for point in timeline.gps_points
            ],
            'clock_calibrations': [
                {
                    'calibration_time': cal.calibration_time.isoformat(),
                    'device_time': cal.device_time.isoformat(),
                    'reference_time': cal.reference_time.isoformat(),
                    'drift_seconds': cal.drift_seconds,
                    'calibration_type': cal.calibration_type
                }
                for cal in timeline.clock_calibrations
            ]
        }
    
    def _file_index_to_dict(self, file_index: Dict[str, VideoSegment]) -> Dict[str, Any]:
        """
        将文件索引转换为字典格式
        """
        return {
            filename: {
                'start_time': segment.start_time.isoformat(),
                'end_time': segment.end_time.isoformat(),
                'duration_seconds': segment.duration.total_seconds(),
                'device_id': segment.device_id,
                'file_size': segment.file_size,
                'sha256_hash': segment.sha256_hash
            }
            for filename, segment in file_index.items()
        }
    
    def _anomalies_summary(self, anomalies: List[Anomaly]) -> Dict[str, Any]:
        """
        生成异常摘要
        """
        if not anomalies:
            return {
                'total_count': 0,
                'by_type': {},
                'by_severity': {}
            }
        
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        
        for anomaly in anomalies:
            type_key = anomaly.anomaly_type.value
            severity_key = anomaly.severity.value
            
            by_type[type_key] = by_type.get(type_key, 0) + 1
            by_severity[severity_key] = by_severity.get(severity_key, 0) + 1
        
        return {
            'total_count': len(anomalies),
            'by_type': by_type,
            'by_severity': by_severity
        }
    
    def _count_anomalies_by_type(self, anomalies: List[Anomaly]) -> Dict[AnomalyType, int]:
        """
        按类型统计异常数量
        """
        counts: Dict[AnomalyType, int] = {}
        for anomaly in anomalies:
            counts[anomaly.anomaly_type] = counts.get(anomaly.anomaly_type, 0) + 1
        return counts
    
    def _format_timedelta(self, delta: timedelta) -> str:
        """
        格式化时间差
        """
        total_seconds = int(delta.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
