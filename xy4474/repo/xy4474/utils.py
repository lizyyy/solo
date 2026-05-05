# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 工具类
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from config import (
    NAMING_RULES, STANDARD_SIZES, STANDARD_BACKGROUNDS, 
    LOG_CONFIG, ISSUE_TYPES
)

# 配置日志
def setup_logger(name: str = "review_tool") -> logging.Logger:
    """
    设置日志记录器
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, LOG_CONFIG["level"]))
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setLevel(getattr(logging, LOG_CONFIG["level"]))
        formatter = logging.Formatter(LOG_CONFIG["format"])
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger

logger = setup_logger()

class FileNameParser:
    """
    文件名解析器
    根据命名规则解析文件名，提取订单号、客户姓名、尺寸、背景色等信息
    """
    
    def __init__(self):
        self.pattern = re.compile(NAMING_RULES["pattern"], re.UNICODE)
        self.groups = NAMING_RULES["groups"]
    
    def parse(self, filename: str) -> Optional[Dict[str, str]]:
        """
        解析文件名
        
        Args:
            filename: 文件名（包含扩展名）
            
        Returns:
            解析结果字典，解析失败返回None
        """
        match = self.pattern.match(filename)
        if not match:
            return None
        
        result = {}
        for key, group_index in self.groups.items():
            result[key] = match.group(group_index)
        
        return result
    
    def validate(self, filename: str) -> Tuple[bool, List[str]]:
        """
        验证文件名是否符合规范
        
        Args:
            filename: 文件名
            
        Returns:
            (是否有效, 问题列表)
        """
        issues = []
        parsed = self.parse(filename)
        
        if not parsed:
            issues.append(f"文件名 '{filename}' 不符合命名规则: {NAMING_RULES['description']}")
            return False, issues
        
        # 验证尺寸是否为标准尺寸
        size = parsed.get("size", "")
        if size and size not in STANDARD_SIZES:
            issues.append(f"尺寸 '{size}' 不是标准尺寸，标准尺寸包括: {list(STANDARD_SIZES.keys())}")
        
        # 验证背景色是否为标准背景色
        background = parsed.get("background", "")
        if background and background not in STANDARD_BACKGROUNDS:
            issues.append(f"背景色 '{background}' 不是标准背景色，标准背景色包括: {list(STANDARD_BACKGROUNDS.keys())}")
        
        return len(issues) == 0, issues


class ImageAnalyzer:
    """
    图像分析器
    分析图像尺寸、背景色等信息
    """
    
    def __init__(self):
        self._has_pillow = None
        self._pillow_available = False
    
    def _check_pillow(self) -> bool:
        """
        检查是否安装了Pillow库
        """
        if self._has_pillow is not None:
            return self._pillow_available
        
        try:
            from PIL import Image
            self._has_pillow = True
            self._pillow_available = True
            return True
        except ImportError:
            self._has_pillow = True
            self._pillow_available = False
            logger.warning("Pillow库未安装，无法进行图像分析")
            return False
    
    def get_image_info(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        获取图像信息（尺寸、模式等）
        
        Args:
            image_path: 图像文件路径
            
        Returns:
            图像信息字典，失败返回None
        """
        if not self._check_pillow():
            return None
        
        try:
            from PIL import Image
            
            with Image.open(image_path) as img:
                info = {
                    "width": img.width,
                    "height": img.height,
                    "mode": img.mode,
                    "size": (img.width, img.height),
                    "format": img.format,
                }
                
                # 获取DPI信息
                if "dpi" in img.info:
                    info["dpi"] = img.info["dpi"]
                
                return info
        except Exception as e:
            logger.error(f"读取图像信息失败: {image_path}, 错误: {e}")
            return None
    
    def analyze_background_color(self, image_path: str, sample_ratio: float = 0.05) -> Optional[Tuple[int, int, int]]:
        """
        分析图像背景色
        通过采样图像边缘像素来估计背景色
        
        Args:
            image_path: 图像文件路径
            sample_ratio: 采样比例（0-1之间）
            
        Returns:
            背景色RGB元组，失败返回None
        """
        if not self._check_pillow():
            return None
        
        try:
            from PIL import Image
            import numpy as np
            
            with Image.open(image_path) as img:
                # 转换为RGB模式
                rgb_img = img.convert("RGB")
                width, height = rgb_img.size
                
                # 采样边缘像素
                edge_pixels = []
                sample_count = int(max(width, height) * sample_ratio)
                sample_count = max(sample_count, 10)
                
                # 采样顶部边缘
                for x in range(0, width, max(1, width // sample_count)):
                    edge_pixels.append(rgb_img.getpixel((x, 0)))
                
                # 采样底部边缘
                for x in range(0, width, max(1, width // sample_count)):
                    edge_pixels.append(rgb_img.getpixel((x, height - 1)))
                
                # 采样左侧边缘（跳过已采样的角落）
                for y in range(1, height - 1, max(1, height // sample_count)):
                    edge_pixels.append(rgb_img.getpixel((0, y)))
                
                # 采样右侧边缘（跳过已采样的角落）
                for y in range(1, height - 1, max(1, height // sample_count)):
                    edge_pixels.append(rgb_img.getpixel((width - 1, y)))
                
                if not edge_pixels:
                    return None
                
                # 计算平均背景色
                pixels_array = np.array(edge_pixels)
                avg_color = tuple(np.mean(pixels_array, axis=0).astype(int))
                
                return avg_color
                
        except ImportError:
            logger.warning("numpy库未安装，无法计算平均背景色")
            return None
        except Exception as e:
            logger.error(f"分析背景色失败: {image_path}, 错误: {e}")
            return None
    
    def check_size_match(self, image_path: str, size_name: str) -> Tuple[bool, Dict[str, Any]]:
        """
        检查图像尺寸是否与标准尺寸匹配
        
        Args:
            image_path: 图像文件路径
            size_name: 标准尺寸名称（如"一寸"、"二寸"）
            
        Returns:
            (是否匹配, 详细信息)
        """
        info = {
            "expected_size": None,
            "actual_size": None,
            "difference": None,
            "tolerance": 5,  # 像素容差
        }
        
        if size_name not in STANDARD_SIZES:
            info["error"] = f"未知的标准尺寸: {size_name}"
            return False, info
        
        standard = STANDARD_SIZES[size_name]
        info["expected_size"] = (standard["width"], standard["height"])
        
        image_info = self.get_image_info(image_path)
        if not image_info:
            info["error"] = "无法读取图像信息"
            return False, info
        
        info["actual_size"] = (image_info["width"], image_info["height"])
        
        # 检查尺寸（考虑可能的横纵方向）
        expected_w, expected_h = info["expected_size"]
        actual_w, actual_h = info["actual_size"]
        
        tolerance = info["tolerance"]
        
        # 正常方向检查
        normal_match = (abs(actual_w - expected_w) <= tolerance and 
                        abs(actual_h - expected_h) <= tolerance)
        
        # 旋转方向检查（宽高互换）
        rotated_match = (abs(actual_w - expected_h) <= tolerance and 
                         abs(actual_h - expected_w) <= tolerance)
        
        info["difference"] = {
            "width_diff": actual_w - expected_w,
            "height_diff": actual_h - expected_h,
        }
        
        return normal_match or rotated_match, info
    
    def check_background_match(self, image_path: str, background_name: str) -> Tuple[bool, Dict[str, Any]]:
        """
        检查图像背景色是否与标准背景色匹配
        
        Args:
            image_path: 图像文件路径
            background_name: 标准背景色名称（如"白色"、"蓝色"）
            
        Returns:
            (是否匹配, 详细信息)
        """
        info = {
            "expected_color": None,
            "actual_color": None,
            "tolerance": None,
            "color_distance": None,
        }
        
        if background_name not in STANDARD_BACKGROUNDS:
            info["error"] = f"未知的标准背景色: {background_name}"
            return False, info
        
        standard = STANDARD_BACKGROUNDS[background_name]
        info["expected_color"] = standard["rgb"]
        info["tolerance"] = standard["tolerance"]
        
        actual_color = self.analyze_background_color(image_path)
        if not actual_color:
            info["error"] = "无法分析背景色"
            return False, info
        
        info["actual_color"] = actual_color
        
        # 计算颜色距离（欧氏距离）
        import math
        color_distance = math.sqrt(
            (actual_color[0] - info["expected_color"][0]) ** 2 +
            (actual_color[1] - info["expected_color"][1]) ** 2 +
            (actual_color[2] - info["expected_color"][2]) ** 2
        )
        info["color_distance"] = color_distance
        
        return color_distance <= info["tolerance"], info


class DataValidator:
    """
    数据验证器
    验证订单数据、修图记录、打印队列等数据的完整性和一致性
    """
    
    def __init__(self):
        self.file_parser = FileNameParser()
        self.image_analyzer = ImageAnalyzer()
    
    def validate_order_data(self, orders: List[Dict[str, Any]]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        验证订单数据
        
        Args:
            orders: 订单列表
            
        Returns:
            (是否全部有效, 问题列表)
        """
        issues = []
        
        for i, order in enumerate(orders):
            order_id = order.get("order_id", f"未知订单_{i}")
            
            # 检查必填字段
            required_fields = ["order_id", "customer_name", "sizes", "background", "status"]
            for field in required_fields:
                if field not in order or order[field] is None:
                    issues.append({
                        "type": "missing_field",
                        "order_id": order_id,
                        "field": field,
                        "message": f"订单 {order_id} 缺少必填字段: {field}",
                    })
            
            # 检查尺寸是否为列表
            if "sizes" in order and not isinstance(order["sizes"], list):
                issues.append({
                    "type": "invalid_format",
                    "order_id": order_id,
                    "field": "sizes",
                    "message": f"订单 {order_id} 的sizes字段格式错误，应为列表",
                })
        
        return len(issues) == 0, issues
    
    def validate_retouch_records(self, records: List[Dict[str, Any]]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        验证修图记录数据
        
        Args:
            records: 修图记录列表
            
        Returns:
            (是否全部有效, 问题列表)
        """
        issues = []
        
        for i, record in enumerate(records):
            order_id = record.get("order_id", f"未知记录_{i}")
            
            # 检查必填字段
            required_fields = ["order_id", "status", "start_time"]
            for field in required_fields:
                if field not in record or record[field] is None:
                    issues.append({
                        "type": "missing_field",
                        "order_id": order_id,
                        "field": field,
                        "message": f"修图记录 {order_id} 缺少必填字段: {field}",
                    })
            
            # 检查状态是否有效
            if "status" in record and record["status"] not in ISSUE_TYPES:
                # 这里应该检查RETOUCH_STATUS，但先简单处理
                pass
        
        return len(issues) == 0, issues
    
    def validate_print_queue(self, queue: List[Dict[str, Any]]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        验证打印队列数据
        
        Args:
            queue: 打印队列列表
            
        Returns:
            (是否全部有效, 问题列表)
        """
        issues = []
        
        for i, item in enumerate(queue):
            order_id = item.get("order_id", f"未知打印项_{i}")
            
            # 检查必填字段
            required_fields = ["order_id", "added_time", "status"]
            for field in required_fields:
                if field not in item or item[field] is None:
                    issues.append({
                        "type": "missing_field",
                        "order_id": order_id,
                        "field": field,
                        "message": f"打印队列项 {order_id} 缺少必填字段: {field}",
                    })
        
        return len(issues) == 0, issues


class DateTimeHelper:
    """
    日期时间辅助类
    处理日期时间的解析、格式化、计算等
    """
    
    @staticmethod
    def parse_datetime(dt_str: str, formats: List[str] = None) -> Optional[datetime]:
        """
        解析日期时间字符串
        
        Args:
            dt_str: 日期时间字符串
            formats: 尝试的格式列表
            
        Returns:
            datetime对象，解析失败返回None
        """
        if formats is None:
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d",
                "%Y%m%d%H%M%S",
                "%Y%m%d",
            ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except (ValueError, TypeError):
                continue
        
        return None
    
    @staticmethod
    def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
        """
        格式化日期时间
        
        Args:
            dt: datetime对象
            fmt: 格式字符串
            
        Returns:
            格式化后的字符串
        """
        return dt.strftime(fmt)
    
    @staticmethod
    def get_time_diff(start: datetime, end: datetime) -> Dict[str, Any]:
        """
        计算时间差
        
        Args:
            start: 开始时间
            end: 结束时间
            
        Returns:
            时间差信息字典
        """
        diff = end - start
        total_seconds = diff.total_seconds()
        
        return {
            "total_seconds": total_seconds,
            "total_minutes": total_seconds / 60,
            "total_hours": total_seconds / 3600,
            "days": diff.days,
            "hours": diff.seconds // 3600,
            "minutes": (diff.seconds % 3600) // 60,
            "seconds": diff.seconds % 60,
        }
    
    @staticmethod
    def is_urgent_overtime(start_time: datetime, limit_hours: float, 
                           current_time: datetime = None) -> Tuple[bool, Dict[str, Any]]:
        """
        检查加急单是否超时
        
        Args:
            start_time: 订单开始时间
            limit_hours: 限时（小时）
            current_time: 当前时间，默认为现在
            
        Returns:
            (是否超时, 详细信息)
        """
        if current_time is None:
            current_time = datetime.now()
        
        time_diff = DateTimeHelper.get_time_diff(start_time, current_time)
        is_overtime = time_diff["total_hours"] > limit_hours
        
        info = {
            "start_time": start_time,
            "current_time": current_time,
            "limit_hours": limit_hours,
            "elapsed_hours": time_diff["total_hours"],
            "remaining_hours": limit_hours - time_diff["total_hours"] if not is_overtime else 0,
        }
        
        return is_overtime, info


class JSONEncoder(json.JSONEncoder):
    """
    自定义JSON编码器
    支持datetime等特殊类型
    """
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def load_json_file(file_path: str) -> Optional[Any]:
    """
    加载JSON文件
    
    Args:
        file_path: JSON文件路径
        
    Returns:
        解析后的数据，失败返回None
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载JSON文件失败: {file_path}, 错误: {e}")
        return None


def save_json_file(file_path: str, data: Any, ensure_ascii: bool = False, indent: int = 2) -> bool:
    """
    保存JSON文件
    
    Args:
        file_path: 保存路径
        data: 要保存的数据
        ensure_ascii: 是否确保ASCII
        indent: 缩进空格数
        
    Returns:
        是否成功
    """
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=ensure_ascii, indent=indent, cls=JSONEncoder)
        return True
    except Exception as e:
        logger.error(f"保存JSON文件失败: {file_path}, 错误: {e}")
        return False


def get_file_list(directory: str, extensions: List[str] = None) -> List[str]:
    """
    获取目录下的文件列表
    
    Args:
        directory: 目录路径
        extensions: 可选的扩展名过滤列表（如[".jpg", ".png"]）
        
    Returns:
        文件路径列表
    """
    if not os.path.exists(directory):
        logger.warning(f"目录不存在: {directory}")
        return []
    
    files = []
    for root, dirs, filenames in os.walk(directory):
        for filename in filenames:
            if extensions:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in [e.lower() for e in extensions]:
                    continue
            files.append(os.path.join(root, filename))
    
    return files
