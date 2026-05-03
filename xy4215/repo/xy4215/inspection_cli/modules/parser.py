"""
解析模块
负责解析不同格式的巡检数据文件：JSON视频索引、CSV传感器数据、YAML缺陷标注
"""

import json
import csv
import os
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from datetime import datetime

import yaml


class InspectionPackage:
    """
    巡检包数据结构
    包含一个机器人单次巡检的所有相关数据
    """
    
    def __init__(self, package_name: str):
        self.package_name = package_name
        self.video_index: List[Dict[str, Any]] = []
        self.sensor_data: List[Dict[str, Any]] = []
        self.defect_annotations: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {}
        self.errors: List[str] = []
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_name": self.package_name,
            "metadata": self.metadata,
            "video_segments_count": len(self.video_index),
            "sensor_records_count": len(self.sensor_data),
            "defect_count": len(self.defect_annotations),
            "errors": self.errors
        }


class DataParser:
    """
    数据解析器
    负责解析不同格式的巡检数据文件
    """
    
    def __init__(self):
        self.supported_formats = {
            "video_index": [".json"],
            "sensor_data": [".csv"],
            "defect_annotations": [".yaml", ".yml"]
        }
    
    def parse_package(self, package_path: Union[str, Path]) -> InspectionPackage:
        """
        解析整个巡检包目录
        自动识别并解析目录中的所有数据文件
        """
        package_path = Path(package_path)
        
        if not package_path.exists():
            raise FileNotFoundError(f"巡检包目录不存在: {package_path}")
        
        if not package_path.is_dir():
            raise NotADirectoryError(f"指定路径不是目录: {package_path}")
        
        package_name = package_path.name
        package = InspectionPackage(package_name)
        
        package.metadata["parsed_at"] = datetime.now().isoformat()
        package.metadata["original_path"] = str(package_path)
        
        # 查找并解析所有支持的文件
        json_files = list(package_path.glob("**/*.json"))
        csv_files = list(package_path.glob("**/*.csv"))
        yaml_files = list(package_path.glob("**/*.yaml")) + list(package_path.glob("**/*.yml"))
        
        # 解析视频索引 (JSON)
        for json_file in json_files:
            try:
                video_data = self._parse_video_index(json_file)
                package.video_index.extend(video_data)
                package.metadata.setdefault("video_files", []).append(str(json_file))
            except Exception as e:
                package.errors.append(f"解析视频索引文件失败 {json_file}: {str(e)}")
        
        # 解析传感器数据 (CSV)
        for csv_file in csv_files:
            try:
                sensor_data = self._parse_sensor_data(csv_file)
                package.sensor_data.extend(sensor_data)
                package.metadata.setdefault("sensor_files", []).append(str(csv_file))
            except Exception as e:
                package.errors.append(f"解析传感器数据文件失败 {csv_file}: {str(e)}")
        
        # 解析缺陷标注 (YAML)
        for yaml_file in yaml_files:
            try:
                defect_data = self._parse_defect_annotations(yaml_file)
                package.defect_annotations.extend(defect_data)
                package.metadata.setdefault("defect_files", []).append(str(yaml_file))
            except Exception as e:
                package.errors.append(f"解析缺陷标注文件失败 {yaml_file}: {str(e)}")
        
        return package
    
    def _parse_video_index(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析视频索引JSON文件
        预期格式包含分段视频信息、时间戳、里程桩号等
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        video_segments = []
        
        # 处理不同的JSON结构
        if isinstance(data, list):
            # 直接是视频片段列表
            segments = data
        elif isinstance(data, dict):
            # 可能是包装对象，尝试常见的键名
            segments = data.get("segments", data.get("video_segments", [data]))
        else:
            raise ValueError(f"不支持的JSON格式: {type(data)}")
        
        for segment in segments:
            parsed_segment = self._normalize_video_segment(segment)
            if parsed_segment:
                video_segments.append(parsed_segment)
        
        return video_segments
    
    def _normalize_video_segment(self, segment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        标准化视频片段数据格式
        处理不同机器人可能使用的不同字段名
        """
        if not isinstance(segment, dict):
            return None
        
        normalized = {}
        
        # 时间戳处理 - 支持多种字段名和格式
        timestamp = None
        for key in ["timestamp", "time", "start_time", "record_time", "datetime"]:
            if key in segment:
                timestamp = segment[key]
                break
        
        if timestamp is not None:
            if isinstance(timestamp, (int, float)):
                normalized["timestamp"] = timestamp
                normalized["timestamp_type"] = "unix"
            elif isinstance(timestamp, str):
                # 尝试解析为datetime
                try:
                    # 常见的ISO格式
                    parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    normalized["timestamp"] = parsed_time.timestamp()
                    normalized["timestamp_type"] = "iso"
                    normalized["timestamp_original"] = timestamp
                except ValueError:
                    # 保留原始字符串
                    normalized["timestamp"] = timestamp
                    normalized["timestamp_type"] = "string"
        
        # 里程桩号处理
        mileage = None
        for key in ["mileage", "mileage_stake", "stake_number", "position", "distance", "km"]:
            if key in segment:
                mileage = segment[key]
                break
        
        if mileage is not None:
            if isinstance(mileage, (int, float)):
                normalized["mileage"] = mileage
            elif isinstance(mileage, str):
                # 尝试解析为数字
                try:
                    normalized["mileage"] = float(mileage.replace('km', '').replace('m', '').strip())
                except ValueError:
                    normalized["mileage_original"] = mileage
        
        # 视频文件信息
        for key in ["file_name", "filename", "video_file", "path", "file"]:
            if key in segment:
                normalized["file_name"] = segment[key]
                break
        
        # 片段序号
        for key in ["segment_id", "id", "sequence", "index", "segment_number"]:
            if key in segment:
                normalized["segment_id"] = segment[key]
                break
        
        # 持续时间
        for key in ["duration", "length", "duration_seconds"]:
            if key in segment:
                normalized["duration"] = segment[key]
                break
        
        # 保留所有原始字段的副本
        normalized["_raw_data"] = segment.copy()
        
        return normalized
    
    def _parse_sensor_data(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析传感器CSV数据
        支持多种CSV格式，自动识别表头
        """
        sensor_records = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            # 尝试自动检测CSV方言
            dialect = csv.Sniffer().sniff(f.read(4096))
            f.seek(0)
            
            reader = csv.DictReader(f, dialect=dialect)
            
            for row_num, row in enumerate(reader, start=2):  # 从第2行开始，因为第1行是表头
                try:
                    normalized_record = self._normalize_sensor_record(row, row_num)
                    if normalized_record:
                        sensor_records.append(normalized_record)
                except Exception as e:
                    # 记录解析错误但继续处理其他行
                    raise ValueError(f"CSV第{row_num}行解析失败: {str(e)}")
        
        return sensor_records
    
    def _normalize_sensor_record(self, row: Dict[str, str], row_num: int) -> Optional[Dict[str, Any]]:
        """
        标准化传感器数据记录
        """
        if not row:
            return None
        
        normalized = {}
        
        # 时间戳处理
        timestamp = None
        for key in ["timestamp", "time", "datetime", "record_time", "date_time", "采集时间", "时间戳"]:
            if key in row and row[key].strip():
                timestamp = row[key].strip()
                break
        
        if timestamp is not None:
            try:
                # 尝试解析为数字
                normalized["timestamp"] = float(timestamp)
                normalized["timestamp_type"] = "unix"
            except ValueError:
                # 尝试解析为ISO格式
                try:
                    parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    normalized["timestamp"] = parsed_time.timestamp()
                    normalized["timestamp_type"] = "iso"
                    normalized["timestamp_original"] = timestamp
                except ValueError:
                    normalized["timestamp"] = timestamp
                    normalized["timestamp_type"] = "string"
        
        # 里程桩号
        mileage = None
        for key in ["mileage", "mileage_stake", "stake_number", "position", "distance", "km", "里程", "桩号"]:
            if key in row and row[key].strip():
                mileage = row[key].strip()
                break
        
        if mileage is not None:
            try:
                normalized["mileage"] = float(mileage.replace('km', '').replace('m', '').strip())
            except ValueError:
                normalized["mileage_original"] = mileage
        
        # 传感器数值
        sensor_values = {}
        for key, value in row.items():
            if value is None or value.strip() == '':
                continue
            
            # 跳过已知的元数据字段
            if key.lower() in ["timestamp", "time", "datetime", "mileage", "stake_number", "position", "row_num", "id"]:
                continue
            
            # 尝试转换为数值
            try:
                float_val = float(value)
                int_val = int(float_val)
                if float_val == int_val:
                    sensor_values[key] = int_val
                else:
                    sensor_values[key] = float_val
            except ValueError:
                # 保持字符串类型
                sensor_values[key] = value
        
        if sensor_values:
            normalized["sensor_values"] = sensor_values
        
        # 保留原始行号
        normalized["row_number"] = row_num
        normalized["_raw_row"] = row.copy()
        
        return normalized
    
    def _parse_defect_annotations(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析缺陷标注YAML文件
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ValueError(f"YAML解析错误: {str(e)}")
        
        defects = []
        
        if data is None:
            return defects
        
        # 处理不同的YAML结构
        if isinstance(data, list):
            defect_list = data
        elif isinstance(data, dict):
            # 尝试常见的键名
            defect_list = data.get("defects", data.get("annotations", data.get("issues", [data])))
        else:
            raise ValueError(f"不支持的YAML格式: {type(data)}")
        
        if not isinstance(defect_list, list):
            defect_list = [defect_list]
        
        for defect in defect_list:
            parsed_defect = self._normalize_defect(defect)
            if parsed_defect:
                defects.append(parsed_defect)
        
        return defects
    
    def _normalize_defect(self, defect: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        标准化缺陷标注数据
        """
        if not isinstance(defect, dict):
            return None
        
        normalized = {}
        
        # 缺陷ID
        for key in ["id", "defect_id", "annotation_id", "issue_id"]:
            if key in defect:
                normalized["defect_id"] = defect[key]
                break
        
        # 缺陷类型
        for key in ["type", "defect_type", "category", "问题类型", "缺陷类型"]:
            if key in defect:
                normalized["defect_type"] = defect[key]
                break
        
        # 位置信息 - 里程桩号
        for key in ["mileage", "mileage_stake", "stake_number", "position", "location", "桩号", "位置"]:
            if key in defect:
                mileage = defect[key]
                if isinstance(mileage, (int, float)):
                    normalized["mileage"] = mileage
                elif isinstance(mileage, str):
                    try:
                        normalized["mileage"] = float(mileage.replace('km', '').replace('m', '').strip())
                    except ValueError:
                        normalized["mileage_original"] = mileage
                break
        
        # 管段信息
        for key in ["segment", "pipe_segment", "section", "管段", "区域"]:
            if key in defect:
                normalized["pipe_segment"] = defect[key]
                break
        
        # 严重程度
        for key in ["severity", "level", "priority", "严重程度", "等级"]:
            if key in defect:
                normalized["severity"] = defect[key]
                break
        
        # 描述
        for key in ["description", "desc", "note", "comment", "描述", "备注"]:
            if key in defect:
                normalized["description"] = defect[key]
                break
        
        # 时间戳
        for key in ["timestamp", "time", "discovery_time", "发现时间", "时间"]:
            if key in defect:
                timestamp = defect[key]
                if isinstance(timestamp, (int, float)):
                    normalized["timestamp"] = timestamp
                elif isinstance(timestamp, str):
                    try:
                        parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        normalized["timestamp"] = parsed_time.timestamp()
                        normalized["timestamp_original"] = timestamp
                    except ValueError:
                        normalized["timestamp_original"] = timestamp
                break
        
        # 标注者/机器人信息
        for key in ["annotator", "robot_id", "inspector", "source", "标注者", "机器人", "来源"]:
            if key in defect:
                normalized["source"] = defect[key]
                break
        
        # 保留所有原始字段
        normalized["_raw_defect"] = defect.copy()
        
        return normalized
