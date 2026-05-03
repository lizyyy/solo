"""
数据解析模块
解析 cameras.csv、mask_rules.yaml、frames/ 图片和旧版配置 JSON
"""

import csv
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any

import yaml
import cv2
import numpy as np


class CameraConfig:
    """相机配置类"""
    
    def __init__(self, camera_id: str, name: str, location: str, 
                 width: int, height: int, stations: List[str]):
        self.camera_id = camera_id
        self.name = name
        self.location = location
        self.width = width
        self.height = height
        self.stations = stations
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "location": self.location,
            "width": self.width,
            "height": self.height,
            "stations": self.stations
        }


class MaskRule:
    """遮罩规则类"""
    
    def __init__(self, station: str, mask_type: str, 
                 x_min: float, x_max: float, y_min: float, y_max: float):
        self.station = station
        self.mask_type = mask_type
        self.x_min = x_min
        self.x_max = x_max
        self.y_min = y_min
        self.y_max = y_max
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "station": self.station,
            "mask_type": self.mask_type,
            "x_min": self.x_min,
            "x_max": self.x_max,
            "y_min": self.y_min,
            "y_max": self.y_max
        }


class FrameImage:
    """帧图片类"""
    
    def __init__(self, camera_id: str, frame_path: str, 
                 width: int, height: int, image: Optional[np.ndarray] = None):
        self.camera_id = camera_id
        self.frame_path = frame_path
        self.width = width
        self.height = height
        self._image = image
    
    @property
    def image(self) -> np.ndarray:
        if self._image is None:
            self._image = cv2.imread(self.frame_path)
        return self._image
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "frame_path": self.frame_path,
            "width": self.width,
            "height": self.height
        }


class OldMaskConfig:
    """旧版遮罩配置类"""
    
    def __init__(self, camera_id: str, masks: List[Dict[str, Any]], 
                 version: str = "v1"):
        self.camera_id = camera_id
        self.masks = masks
        self.version = version
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "masks": self.masks,
            "version": self.version
        }


class DataParser:
    """数据解析器"""
    
    def parse_cameras_csv(self, csv_path: str) -> Dict[str, CameraConfig]:
        """解析 cameras.csv 文件"""
        cameras = {}
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                camera_id = row['camera_id'].strip()
                stations = [s.strip() for s in row['stations'].split(',')]
                
                camera = CameraConfig(
                    camera_id=camera_id,
                    name=row.get('name', camera_id),
                    location=row.get('location', ''),
                    width=int(row['width']),
                    height=int(row['height']),
                    stations=stations
                )
                cameras[camera_id] = camera
        
        return cameras
    
    def parse_mask_rules_yaml(self, yaml_path: str) -> Dict[str, MaskRule]:
        """解析 mask_rules.yaml 文件"""
        rules = {}
        
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        for rule_data in data.get('mask_rules', []):
            station = rule_data['station']
            rule = MaskRule(
                station=station,
                mask_type=rule_data.get('mask_type', 'privacy'),
                x_min=float(rule_data['x_min']),
                x_max=float(rule_data['x_max']),
                y_min=float(rule_data['y_min']),
                y_max=float(rule_data['y_max'])
            )
            rules[station] = rule
        
        return rules
    
    def parse_frames_directory(self, frames_dir: str, 
                                 known_camera_ids: Optional[List[str]] = None) -> Dict[str, FrameImage]:
        """
        解析 frames/ 目录下的图片
        
        Args:
            frames_dir: 图片目录路径
            known_camera_ids: 已知的 camera_id 列表（可选，用于精确匹配）
        
        Returns:
            相机 ID 到 FrameImage 的映射
        """
        frames = {}
        
        frames_path = Path(frames_dir)
        if not frames_path.exists():
            return frames
        
        # 支持的图片扩展名（大小写不敏感）
        supported_extensions = ['.jpg', '.jpeg', '.png', '.bmp']
        
        for img_file in frames_path.iterdir():
            if img_file.is_file():
                file_ext = img_file.suffix.lower()
                
                if file_ext in supported_extensions:
                    stem = img_file.stem
                    camera_id = self._extract_camera_id(stem, known_camera_ids)
                    
                    if camera_id and camera_id not in frames:
                        # 读取图片获取尺寸
                        img = cv2.imread(str(img_file))
                        if img is not None:
                            height, width = img.shape[:2]
                            frame = FrameImage(
                                camera_id=camera_id,
                                frame_path=str(img_file),
                                width=width,
                                height=height,
                                image=img
                            )
                            frames[camera_id] = frame
        
        return frames
    
    def _extract_camera_id(self, stem: str, 
                           known_camera_ids: Optional[List[str]] = None) -> Optional[str]:
        """
        从文件名中提取 camera_id
        
        支持的文件名格式:
        - {camera_id}.jpg
        - {camera_id}_{timestamp}.jpg
        - {camera_id}--{timestamp}.jpg (使用 -- 分隔更清晰)
        
        如果提供了 known_camera_ids，会优先进行精确匹配
        """
        if known_camera_ids:
            # 优先使用已知的 camera_id 进行精确匹配
            # 按长度降序排序，优先匹配更长的 ID（避免 cam 匹配到 cam_001）
            sorted_ids = sorted(known_camera_ids, key=len, reverse=True)
            
            for cid in sorted_ids:
                # 检查: 完全匹配 或 以 cid + 分隔符 开头
                if stem == cid:
                    return cid
                # 支持 _ 或 -- 作为分隔符
                if stem.startswith(cid + '_') or stem.startswith(cid + '--'):
                    return cid
            
            return None
        
        # 没有已知 ID 时，使用启发式方法
        # 假设时间戳部分有固定模式: YYYYMMDD 或 YYYYMMDD_HHMMSS
        # 尝试移除常见的时间戳后缀
        
        # 方法1: 尝试用 -- 分隔（更清晰的分隔符）
        if '--' in stem:
            return stem.split('--')[0]
        
        # 方法2: 尝试识别时间戳模式
        # 常见模式: _YYYYMMDD 或 _YYYYMMDD_HHMMSS
        import re
        # 匹配 _8位数字 或 _8位数字_6位数字
        timestamp_pattern = r'_\d{8}(_\d{6})?$'
        match = re.search(timestamp_pattern, stem)
        if match:
            return stem[:match.start()]
        
        # 方法3: 简单的下划线分割（作为回退方案）
        parts = stem.split('_')
        if parts:
            return parts[0]
        
        return stem
    
    def parse_old_config_json(self, json_path: str) -> Dict[str, OldMaskConfig]:
        """解析旧版配置 JSON 文件"""
        configs = {}
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 支持两种格式: 
        # 1. 直接包含 camera_id 列表的数组
        # 2. 包含 cameras 字段的对象
        
        if isinstance(data, list):
            camera_list = data
        elif isinstance(data, dict) and 'cameras' in data:
            camera_list = data['cameras']
        else:
            # 单个相机配置
            camera_list = [data]
        
        for cam_data in camera_list:
            camera_id = cam_data.get('camera_id') or cam_data.get('id')
            if not camera_id:
                continue
            
            masks = cam_data.get('masks', [])
            version = cam_data.get('version', 'v1')
            
            config = OldMaskConfig(
                camera_id=camera_id,
                masks=masks,
                version=version
            )
            configs[camera_id] = config
        
        return configs
