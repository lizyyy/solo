import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from .models import (
    EvidencePackage, 
    Timeline, 
    VideoSegment, 
    GPSPoint, 
    ClockCalibration,
    Anomaly
)
from .readers import (
    VideoManifestReader, 
    NMEAReader, 
    ClockCalibrationReader,
    find_data_files
)
from .timeline import TimelineMerger, TimelineAnalyzer
from .hash_utils import SegmentHasher, HashConflictDetector
from .anomaly_detector import AnomalyDetector
from .exporter import EvidenceExporter


__version__ = "1.0.0"


class EvidenceProcessor:
    """
    取证包处理器
    整合所有功能模块，提供完整的处理流程
    """
    
    def __init__(
        self,
        gap_threshold_seconds: float = 60.0,
        clock_drift_threshold_seconds: float = 5.0,
        gps_jump_threshold_meters: float = 100.0,
        hash_chunk_size: int = 8192
    ):
        self.gap_threshold = gap_threshold_seconds
        self.clock_drift_threshold = clock_drift_threshold_seconds
        self.gps_jump_threshold = gps_jump_threshold_meters
        self.hash_chunk_size = hash_chunk_size
        
        self.timeline_merger = TimelineMerger(max_gap_seconds=gap_threshold_seconds)
        self.timeline_analyzer = TimelineAnalyzer(gap_threshold_seconds=gap_threshold_seconds)
        self.segment_hasher = SegmentHasher(chunk_size=hash_chunk_size)
        self.anomaly_detector = AnomalyDetector(
            gap_threshold_seconds=gap_threshold_seconds,
            clock_drift_threshold_seconds=clock_drift_threshold_seconds,
            gps_jump_threshold_meters=gps_jump_threshold_meters
        )
        
        self.last_package: Optional[EvidencePackage] = None
    
    def ingest(
        self,
        source_dir: str,
        manifest_path: Optional[str] = None,
        nmea_path: Optional[str] = None,
        calibration_path: Optional[str] = None,
        calculate_hashes: bool = True,
        skip_missing_files: bool = True
    ) -> EvidencePackage:
        """
        导入并处理数据源
        """
        source_path = Path(source_dir)
        if not source_path.exists():
            raise ValueError(f"Source directory does not exist: {source_dir}")
        
        if manifest_path is None or nmea_path is None or calibration_path is None:
            data_files = find_data_files(source_dir)
            
            if manifest_path is None and data_files['video_manifests']:
                manifest_path = data_files['video_manifests'][0]
            
            if nmea_path is None and data_files['nmea_logs']:
                nmea_path = data_files['nmea_logs'][0]
            
            if calibration_path is None and data_files['clock_calibrations']:
                calibration_path = data_files['clock_calibrations'][0]
        
        video_segments: List[VideoSegment] = []
        if manifest_path and os.path.exists(manifest_path):
            manifest_reader = VideoManifestReader()
            video_segments = manifest_reader.read(manifest_path)
        
        gps_points: List[GPSPoint] = []
        if nmea_path and os.path.exists(nmea_path):
            nmea_reader = NMEAReader()
            gps_points = nmea_reader.read(nmea_path)
        
        clock_calibrations: List[ClockCalibration] = []
        if calibration_path and os.path.exists(calibration_path):
            cal_reader = ClockCalibrationReader()
            clock_calibrations = cal_reader.read(calibration_path)
        
        timeline = self.timeline_merger.merge(
            video_segments=video_segments,
            gps_points=gps_points,
            clock_calibrations=clock_calibrations
        )
        
        hash_anomalies: List[Anomaly] = []
        if calculate_hashes and timeline.video_segments:
            hashed_segments, hash_anomalies = self.segment_hasher.hash_segments(
                timeline.video_segments,
                skip_missing=skip_missing_files
            )
            timeline.video_segments = hashed_segments
        
        all_anomalies = self.anomaly_detector.detect_all(timeline)
        all_anomalies.extend(hash_anomalies)
        
        raw_hash_manifest = self.segment_hasher.get_manifest()
        hash_manifest: Dict[str, str] = {}
        for file_key, hash_value in raw_hash_manifest.items():
            if os.path.isabs(file_key):
                hash_manifest[file_key] = hash_value
            else:
                abs_path = os.path.abspath(file_key)
                hash_manifest[abs_path] = hash_value
                hash_manifest[file_key] = hash_value
        
        file_index: Dict[str, VideoSegment] = {}
        for segment in timeline.video_segments:
            file_index[segment.filename] = segment
            if segment.file_path and segment.file_path != segment.filename:
                file_index[segment.file_path] = segment
                if not os.path.isabs(segment.file_path):
                    abs_path = os.path.abspath(segment.file_path)
                    file_index[abs_path] = segment
        
        package = EvidencePackage(
            package_id=str(uuid.uuid4()),
            generated_at=datetime.now(),
            tool_version=__version__,
            source_directory=str(source_path.absolute()),
            timeline=timeline,
            anomalies=all_anomalies,
            hash_manifest=hash_manifest,
            file_index=file_index,
            metadata={
                'ingest_time': datetime.now().isoformat(),
                'source_files': {
                    'manifest': manifest_path,
                    'nmea': nmea_path,
                    'calibration': calibration_path
                },
                'thresholds': {
                    'gap_threshold_seconds': self.gap_threshold,
                    'clock_drift_threshold_seconds': self.clock_drift_threshold,
                    'gps_jump_threshold_meters': self.gps_jump_threshold
                }
            }
        )
        
        self.last_package = package
        return package
    
    def verify(
        self,
        package_or_dir,
        expected_hashes: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        验证取证包的完整性
        """
        manifest_data = None
        source_dir = None
        
        if isinstance(package_or_dir, str):
            manifest_path = Path(package_or_dir) / 'manifest.json'
            if manifest_path.exists():
                import json
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                
                if expected_hashes is None:
                    expected_hashes = manifest_data.get('hash_manifest', {})
                
                if manifest_data and 'source_directory' in manifest_data:
                    source_dir = manifest_data['source_directory']
        
        if isinstance(package_or_dir, EvidencePackage):
            package = package_or_dir
            if expected_hashes is None:
                expected_hashes = package.hash_manifest
            
            if not expected_hashes:
                return {
                    'valid': False,
                    'message': 'No expected hashes provided',
                    'results': []
                }
            
            results = []
            all_valid = True
            
            for segment in package.timeline.video_segments if package.timeline else []:
                expected_hash = expected_hashes.get(segment.filename) or expected_hashes.get(segment.file_path)
                
                if expected_hash:
                    is_valid, actual_hash = self.segment_hasher.verify_hash(segment, expected_hash)
                    
                    results.append({
                        'filename': segment.filename,
                        'file_path': segment.file_path,
                        'expected_hash': expected_hash,
                        'actual_hash': actual_hash,
                        'is_valid': is_valid
                    })
                    
                    if not is_valid:
                        all_valid = False
            
            return {
                'valid': all_valid,
                'total_files': len(results),
                'valid_files': sum(1 for r in results if r['is_valid']),
                'invalid_files': sum(1 for r in results if not r['is_valid']),
                'results': results
            }
        else:
            if not expected_hashes:
                return {
                    'valid': False,
                    'message': 'No expected hashes provided',
                    'results': []
                }
            
            results = []
            all_valid = True
            processed_files = set()
            
            for file_key, expected_hash in expected_hashes.items():
                filename = os.path.basename(file_key)
                
                if filename in processed_files:
                    continue
                
                possible_paths = []
                
                if os.path.isabs(file_key):
                    possible_paths.append(file_key)
                else:
                    possible_paths.append(os.path.abspath(file_key))
                    possible_paths.append(file_key)
                    
                    if source_dir:
                        possible_paths.append(os.path.join(source_dir, filename))
                        possible_paths.append(os.path.join(source_dir, file_key))
                        
                        source_parent = os.path.dirname(source_dir)
                        possible_paths.append(os.path.join(source_parent, file_key))
                
                actual_file_path = None
                for path in possible_paths:
                    if os.path.exists(path):
                        actual_file_path = path
                        break
                
                if actual_file_path is None:
                    results.append({
                        'filename': filename,
                        'file_path': file_key,
                        'expected_hash': expected_hash,
                        'actual_hash': None,
                        'is_valid': False,
                        'error': f'File not found. Tried: {possible_paths}'
                    })
                    all_valid = False
                    processed_files.add(filename)
                    continue
                
                try:
                    actual_hash = self.segment_hasher.hash_calculator.calculate_file_hash(actual_file_path)
                    is_valid = actual_hash == expected_hash
                    
                    results.append({
                        'filename': filename,
                        'file_path': actual_file_path,
                        'expected_hash': expected_hash,
                        'actual_hash': actual_hash,
                        'is_valid': is_valid
                    })
                    
                    if not is_valid:
                        all_valid = False
                except Exception as e:
                    results.append({
                        'filename': filename,
                        'file_path': actual_file_path,
                        'expected_hash': expected_hash,
                        'actual_hash': None,
                        'is_valid': False,
                        'error': str(e)
                    })
                    all_valid = False
                
                processed_files.add(filename)
            
            return {
                'valid': all_valid,
                'total_files': len(results),
                'valid_files': sum(1 for r in results if r.get('is_valid', False)),
                'invalid_files': sum(1 for r in results if not r.get('is_valid', False)),
                'results': results
            }
    
    def export(
        self,
        output_dir: str,
        package: Optional[EvidencePackage] = None
    ) -> Dict[str, str]:
        """
        导出取证包
        """
        if package is None:
            if self.last_package is None:
                raise ValueError("No package loaded. Please run ingest() first or provide a package.")
            package = self.last_package
        
        exporter = EvidenceExporter(output_dir)
        return exporter.export_all(package)
    
    def get_summary(self, package: Optional[EvidencePackage] = None) -> Dict[str, Any]:
        """
        获取处理摘要
        """
        if package is None:
            package = self.last_package
        
        if package is None:
            return {'error': 'No package available'}
        
        timeline = package.timeline
        
        summary = {
            'package_id': package.package_id,
            'generated_at': package.generated_at.isoformat(),
            'tool_version': package.tool_version,
            'source_directory': package.source_directory,
            'timeline': {
                'start_time': timeline.start_time.isoformat() if timeline else None,
                'end_time': timeline.end_time.isoformat() if timeline else None,
                'video_segments_count': len(timeline.video_segments) if timeline else 0,
                'gps_points_count': len(timeline.gps_points) if timeline else 0,
                'clock_calibrations_count': len(timeline.clock_calibrations) if timeline else 0
            },
            'anomalies': {
                'total_count': len(package.anomalies),
                'by_type': {},
                'by_severity': {}
            },
            'hash_manifest_count': len(package.hash_manifest)
        }
        
        for anomaly in package.anomalies:
            type_key = anomaly.anomaly_type.value
            severity_key = anomaly.severity.value
            
            summary['anomalies']['by_type'][type_key] = \
                summary['anomalies']['by_type'].get(type_key, 0) + 1
            summary['anomalies']['by_severity'][severity_key] = \
                summary['anomalies']['by_severity'].get(severity_key, 0) + 1
        
        if timeline and self.timeline_analyzer:
            coverage = self.timeline_analyzer.get_timeline_coverage(timeline)
            summary['timeline']['coverage_percent'] = round(coverage * 100, 2)
        
        return summary
