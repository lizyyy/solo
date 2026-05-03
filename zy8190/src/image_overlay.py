"""
图片叠加模块
生成遮罩叠加预览和变更 diff 图片
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

import cv2
import numpy as np

from .data_parser import (
    CameraConfig, MaskRule, FrameImage, OldMaskConfig
)


class MaskColors:
    """遮罩颜色配置"""
    PRIVACY_MASK = (0, 0, 255)
    ADDED_MASK = (0, 255, 0)
    REMOVED_MASK = (255, 0, 0)
    MODIFIED_MASK = (255, 165, 0)
    KEY_STATION = (255, 255, 0)
    TEXT_COLOR = (255, 255, 255)
    BORDER_COLOR = (255, 255, 255)


class ImageOverlay:
    """图片叠加器"""
    
    def __init__(self, alpha: float = 0.5, thickness: int = 2):
        self.alpha = alpha
        self.thickness = thickness
    
    def create_mask_preview(self, image: np.ndarray, 
                              camera: CameraConfig,
                              mask_rules: Dict[str, MaskRule],
                              output_path: Optional[str] = None) -> np.ndarray:
        """
        创建遮罩叠加预览图
        
        Args:
            image: 原始图片
            camera: 相机配置
            mask_rules: 遮罩规则
            output_path: 输出路径（可选）
        
        Returns:
            叠加后的图片
        """
        overlay = image.copy()
        output = image.copy()
        height, width = image.shape[:2]
        
        # 为每个工位绘制遮罩
        for station in camera.stations:
            if station not in mask_rules:
                continue
            
            rule = mask_rules[station]
            
            # 将归一化坐标转换为像素坐标
            x1 = int(rule.x_min * width)
            y1 = int(rule.y_min * height)
            x2 = int(rule.x_max * width)
            y2 = int(rule.y_max * height)
            
            # 确保坐标在图片范围内
            x1 = max(0, min(x1, width))
            y1 = max(0, min(y1, height))
            x2 = max(0, min(x2, width))
            y2 = max(0, min(y2, height))
            
            # 选择颜色
            color = MaskColors.PRIVACY_MASK
            if rule.mask_type == 'key_station':
                color = MaskColors.KEY_STATION
            
            # 绘制半透明填充矩形
            cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
            
            # 绘制边框
            cv2.rectangle(output, (x1, y1), (x2, y2), color, self.thickness)
            
            # 添加标签
            label = f"{station}"
            self._draw_label(output, x1, y1, label, color)
        
        # 混合图片
        cv2.addWeighted(overlay, self.alpha, output, 1 - self.alpha, 0, output)
        
        # 添加相机信息
        self._draw_camera_info(output, camera, width, height)
        
        # 保存输出
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cv2.imwrite(output_path, output)
        
        return output
    
    def create_diff_image(self, image: np.ndarray,
                           camera: CameraConfig,
                           current_rules: Dict[str, MaskRule],
                           old_config: Optional[OldMaskConfig],
                           mask_diff: Dict[str, Any],
                           output_path: Optional[str] = None) -> np.ndarray:
        """
        创建变更 diff 图片
        
        Args:
            image: 原始图片
            camera: 相机配置
            current_rules: 当前遮罩规则
            old_config: 旧版配置
            mask_diff: 遮罩差异信息
            output_path: 输出路径（可选）
        
        Returns:
            diff 图片
        """
        overlay = image.copy()
        output = image.copy()
        height, width = image.shape[:2]
        
        # 1. 绘制新增的遮罩（绿色）
        for mask in mask_diff.get('added', []):
            self._draw_diff_mask(overlay, output, mask, MaskColors.ADDED_MASK, 
                                 "ADDED", width, height)
        
        # 2. 绘制移除的遮罩（红色）
        for mask in mask_diff.get('removed', []):
            self._draw_diff_mask(overlay, output, mask, MaskColors.REMOVED_MASK, 
                                 "REMOVED", width, height)
        
        # 3. 绘制修改的遮罩（橙色显示新位置，虚线显示旧位置）
        for mod in mask_diff.get('modified', []):
            old_mask = mod.get('old', {})
            new_mask = mod.get('new', {})
            
            # 绘制旧遮罩（虚线）
            self._draw_diff_mask(overlay, output, old_mask, MaskColors.REMOVED_MASK, 
                                 "OLD", width, height, dashed=True)
            
            # 绘制新遮罩
            self._draw_diff_mask(overlay, output, new_mask, MaskColors.MODIFIED_MASK, 
                                 "NEW", width, height)
        
        # 混合图片
        cv2.addWeighted(overlay, self.alpha, output, 1 - self.alpha, 0, output)
        
        # 添加图例
        self._draw_diff_legend(output, width)
        
        # 添加相机信息
        self._draw_camera_info(output, camera, width, height)
        
        # 保存输出
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cv2.imwrite(output_path, output)
        
        return output
    
    def _draw_diff_mask(self, overlay: np.ndarray, output: np.ndarray,
                        mask: Dict[str, Any], color: Tuple[int, int, int],
                        label: str, width: int, height: int,
                        dashed: bool = False):
        """绘制 diff 遮罩"""
        x_min = mask.get('x_min', 0)
        x_max = mask.get('x_max', 0)
        y_min = mask.get('y_min', 0)
        y_max = mask.get('y_max', 0)
        
        x1 = int(x_min * width)
        y1 = int(y_min * height)
        x2 = int(x_max * width)
        y2 = int(y_max * height)
        
        # 确保坐标在范围内
        x1 = max(0, min(x1, width))
        y1 = max(0, min(y1, height))
        x2 = max(0, min(x2, width))
        y2 = max(0, min(y2, height))
        
        if x1 >= x2 or y1 >= y2:
            return
        
        if dashed:
            # 绘制虚线边框
            self._draw_dashed_rectangle(output, (x1, y1), (x2, y2), color, self.thickness)
        else:
            # 绘制半透明填充
            cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
            cv2.rectangle(output, (x1, y1), (x2, y2), color, self.thickness)
        
        # 添加标签
        station = mask.get('station', 'unknown')
        full_label = f"{label}: {station}"
        self._draw_label(output, x1, y1, full_label, color)
    
    def _draw_dashed_rectangle(self, image: np.ndarray,
                                pt1: Tuple[int, int], pt2: Tuple[int, int],
                                color: Tuple[int, int, int], thickness: int):
        """绘制虚线矩形"""
        x1, y1 = pt1
        x2, y2 = pt2
        
        dash_length = 10
        gap_length = 5
        
        # 顶部边
        self._draw_dashed_line(image, (x1, y1), (x2, y1), color, thickness, dash_length, gap_length)
        # 底部边
        self._draw_dashed_line(image, (x1, y2), (x2, y2), color, thickness, dash_length, gap_length)
        # 左边
        self._draw_dashed_line(image, (x1, y1), (x1, y2), color, thickness, dash_length, gap_length)
        # 右边
        self._draw_dashed_line(image, (x2, y1), (x2, y2), color, thickness, dash_length, gap_length)
    
    def _draw_dashed_line(self, image: np.ndarray,
                          pt1: Tuple[int, int], pt2: Tuple[int, int],
                          color: Tuple[int, int, int], thickness: int,
                          dash_length: int, gap_length: int):
        """绘制虚线"""
        x1, y1 = pt1
        x2, y2 = pt2
        
        # 计算方向和长度
        dx = x2 - x1
        dy = y2 - y1
        length = np.sqrt(dx * dx + dy * dy)
        
        if length == 0:
            return
        
        # 单位向量
        dx_norm = dx / length
        dy_norm = dy / length
        
        current_pos = 0
        is_dash = True
        
        while current_pos < length:
            segment_length = dash_length if is_dash else gap_length
            segment_end = min(current_pos + segment_length, length)
            
            if is_dash:
                start_x = int(x1 + dx_norm * current_pos)
                start_y = int(y1 + dy_norm * current_pos)
                end_x = int(x1 + dx_norm * segment_end)
                end_y = int(y1 + dy_norm * segment_end)
                cv2.line(image, (start_x, start_y), (end_x, end_y), color, thickness)
            
            current_pos = segment_end
            is_dash = not is_dash
    
    def _draw_label(self, image: np.ndarray, x: int, y: int,
                    text: str, color: Tuple[int, int, int]):
        """绘制标签"""
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 1
        
        # 获取文本大小
        text_size, _ = cv2.getTextSize(text, font, font_scale, thickness)
        text_width, text_height = text_size
        
        # 计算标签位置（在矩形上方）
        label_x = x
        label_y = y - 5
        
        # 确保标签在图片内
        if label_y - text_height - 5 < 0:
            label_y = y + text_height + 15
        
        # 绘制背景矩形
        padding = 3
        cv2.rectangle(image,
                      (label_x - padding, label_y - text_height - padding),
                      (label_x + text_width + padding, label_y + padding),
                      color, -1)
        
        # 绘制文本
        cv2.putText(image, text, (label_x, label_y),
                    font, font_scale, MaskColors.TEXT_COLOR, thickness)
    
    def _draw_camera_info(self, image: np.ndarray, camera: CameraConfig,
                           width: int, height: int):
        """绘制相机信息"""
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2
        
        info_text = f"Camera: {camera.camera_id} | Res: {width}x{height} | Location: {camera.location}"
        
        # 绘制背景
        text_size, _ = cv2.getTextSize(info_text, font, font_scale, thickness)
        padding = 10
        y_offset = 30
        
        cv2.rectangle(image,
                      (0, 0),
                      (text_size[0] + 2 * padding, y_offset + text_size[1] + padding),
                      (0, 0, 0), -1)
        
        # 绘制文本
        cv2.putText(image, info_text, (padding, y_offset),
                    font, font_scale, MaskColors.TEXT_COLOR, thickness)
    
    def _draw_diff_legend(self, image: np.ndarray, width: int):
        """绘制 diff 图例"""
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 1
        
        legend_items = [
            ("Added", MaskColors.ADDED_MASK),
            ("Removed", MaskColors.REMOVED_MASK),
            ("Modified", MaskColors.MODIFIED_MASK),
        ]
        
        start_x = width - 150
        start_y = 80
        line_height = 25
        box_size = 15
        
        # 绘制背景
        cv2.rectangle(image,
                      (start_x - 10, start_y - 30),
                      (start_x + 140, start_y + len(legend_items) * line_height),
                      (0, 0, 0), -1)
        
        # 绘制标题
        cv2.putText(image, "Legend:", (start_x, start_y - 5),
                    font, font_scale, MaskColors.TEXT_COLOR, thickness)
        
        # 绘制图例项
        for i, (label, color) in enumerate(legend_items):
            y = start_y + i * line_height
            
            # 绘制颜色方块
            cv2.rectangle(image,
                          (start_x, y),
                          (start_x + box_size, y + box_size),
                          color, -1)
            cv2.rectangle(image,
                          (start_x, y),
                          (start_x + box_size, y + box_size),
                          MaskColors.BORDER_COLOR, 1)
            
            # 绘制文本
            cv2.putText(image, label, (start_x + box_size + 10, y + box_size - 2),
                        font, font_scale, MaskColors.TEXT_COLOR, thickness)
