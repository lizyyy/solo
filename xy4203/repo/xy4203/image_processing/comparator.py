#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图像比对模块 - 支持并排/叠加查看图像
"""

import cv2
import numpy as np
from PIL import Image, ImageTk


class ImageComparator:
    """
    图像比对器
    支持并排显示和叠加显示两种模式
    """
    
    def __init__(self):
        """初始化图像比对器"""
        self.before_image = None
        self.after_image = None
        self.overlay_alpha = 0.5  # 叠加透明度
    
    def load_images(self, before_path: str, after_path: str) -> bool:
        """
        加载修复前后的图像
        
        Args:
            before_path: 修复前图像路径
            after_path: 修复后图像路径
            
        Returns:
            是否加载成功
        """
        try:
            self.before_image = cv2.imread(before_path)
            self.after_image = cv2.imread(after_path)
            
            if self.before_image is None or self.after_image is None:
                return False
            
            # 确保两张图像尺寸一致
            if self.before_image.shape != self.after_image.shape:
                # 调整后图像尺寸以匹配前图像
                self.after_image = cv2.resize(
                    self.after_image, 
                    (self.before_image.shape[1], self.before_image.shape[0])
                )
            
            return True
        except Exception as e:
            print(f"图像加载失败: {e}")
            return False
    
    def get_side_by_side(self) -> np.ndarray:
        """
        获取并排显示的图像
        
        Returns:
            并排显示的图像数组
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        # 水平拼接两张图像
        side_by_side = np.hstack([self.before_image, self.after_image])
        return side_by_side
    
    def get_overlay(self, alpha: float = None) -> np.ndarray:
        """
        获取叠加显示的图像
        
        Args:
            alpha: 叠加透明度 (0-1)，默认使用self.overlay_alpha
            
        Returns:
            叠加显示的图像数组
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        if alpha is None:
            alpha = self.overlay_alpha
        
        # 叠加两张图像
        overlay = cv2.addWeighted(
            self.before_image, alpha, 
            self.after_image, 1 - alpha, 0
        )
        return overlay
    
    def get_difference_map(self) -> np.ndarray:
        """
        获取差异图
        计算修复前后图像的差异
        
        Returns:
            差异图像数组
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        # 转换为灰度图
        before_gray = cv2.cvtColor(self.before_image, cv2.COLOR_BGR2GRAY)
        after_gray = cv2.cvtColor(self.after_image, cv2.COLOR_BGR2GRAY)
        
        # 计算绝对差异
        diff = cv2.absdiff(before_gray, after_gray)
        
        # 增强差异
        diff_enhanced = cv2.convertScaleAbs(diff, alpha=3.0)
        
        # 转换为彩色以便查看
        diff_color = cv2.applyColorMap(diff_enhanced, cv2.COLORMAP_JET)
        
        return diff_color
    
    def resize_for_display(self, image: np.ndarray, max_width: int = 800, max_height: int = 600) -> np.ndarray:
        """
        调整图像大小以适应显示
        
        Args:
            image: 输入图像
            max_width: 最大宽度
            max_height: 最大高度
            
        Returns:
            调整大小后的图像
        """
        height, width = image.shape[:2]
        
        # 计算缩放比例
        scale = min(max_width / width, max_height / height)
        
        if scale < 1.0:
            new_width = int(width * scale)
            new_height = int(height * scale)
            resized = cv2.resize(image, (new_width, new_height))
            return resized
        
        return image
    
    def to_pil_image(self, image: np.ndarray) -> Image.Image:
        """
        将OpenCV图像转换为PIL图像
        
        Args:
            image: OpenCV格式图像 (BGR)
            
        Returns:
            PIL格式图像 (RGB)
        """
        # 转换颜色空间 BGR -> RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_image)
        return pil_image
    
    def to_tk_image(self, image: np.ndarray) -> ImageTk.PhotoImage:
        """
        将OpenCV图像转换为Tkinter图像
        
        Args:
            image: OpenCV格式图像
            
        Returns:
            Tkinter格式图像
        """
        pil_image = self.to_pil_image(image)
        tk_image = ImageTk.PhotoImage(pil_image)
        return tk_image
    
    def get_image_size(self) -> tuple:
        """
        获取图像尺寸
        
        Returns:
            (宽度, 高度) 元组
        """
        if self.before_image is None:
            return (0, 0)
        
        height, width = self.before_image.shape[:2]
        return (width, height)
