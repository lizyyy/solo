#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
色差分析模块 - 分析修复前后图像的色差变化
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional


class ColorAnalyzer:
    """
    色差分析器
    分析修复前后图像的颜色变化，检测异常色差
    """
    
    def __init__(self):
        """初始化色差分析器"""
        self.before_image = None
        self.after_image = None
        
        # 色差阈值配置
        self.delta_e_threshold = 5.0  # 可感知的色差阈值
        self.luminance_threshold = 20.0  # 亮度变化阈值
        self.chroma_threshold = 15.0  # 饱和度变化阈值
    
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
                self.after_image = cv2.resize(
                    self.after_image, 
                    (self.before_image.shape[1], self.before_image.shape[0])
                )
            
            return True
        except Exception as e:
            print(f"图像加载失败: {e}")
            return False
    
    def rgb_to_lab(self, image: np.ndarray) -> np.ndarray:
        """
        将RGB图像转换为LAB颜色空间
        
        Args:
            image: BGR格式的OpenCV图像
            
        Returns:
            LAB格式图像
        """
        return cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    
    def calculate_delta_e(self, lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
        """
        计算两个LAB图像之间的CIEDE2000色差值
        
        Args:
            lab1: 第一个LAB图像
            lab2: 第二个LAB图像
            
        Returns:
            每个像素的Delta E值
        """
        # 分离LAB通道
        l1, a1, b1 = cv2.split(lab1.astype(np.float64))
        l2, a2, b2 = cv2.split(lab2.astype(np.float64))
        
        # 计算CIEDE2000色差
        # 简化版本的CIEDE2000计算
        # 实际应用中可以使用更精确的实现
        
        # 计算L*差异
        delta_l = l2 - l1
        
        # 计算a*和b*的均值
        l_bar = (l1 + l2) / 2
        c1 = np.sqrt(a1**2 + b1**2)
        c2 = np.sqrt(a2**2 + b2**2)
        c_bar = (c1 + c2) / 2
        
        # 计算a*的修正
        a1_prime = a1 + a1 * (1 - np.sqrt(c_bar**7 / (c_bar**7 + 25**7))) / 2
        a2_prime = a2 + a2 * (1 - np.sqrt(c_bar**7 / (c_bar**7 + 25**7))) / 2
        
        # 重新计算C*
        c1_prime = np.sqrt(a1_prime**2 + b1**2)
        c2_prime = np.sqrt(a2_prime**2 + b2**2)
        c_bar_prime = (c1_prime + c2_prime) / 2
        
        # 计算h*
        h1_prime = np.arctan2(b1, a1_prime)
        h2_prime = np.arctan2(b2, a2_prime)
        
        # 计算Delta E
        delta_l_prime = l2 - l1
        delta_c_prime = c2_prime - c1_prime
        
        # 计算Delta h*
        delta_h_prime = np.zeros_like(h1_prime)
        mask = np.abs(h1_prime - h2_prime) <= np.pi
        delta_h_prime[mask] = h2_prime[mask] - h1_prime[mask]
        delta_h_prime[~mask] = h2_prime[~mask] - h1_prime[~mask] + 2 * np.pi
        delta_h_prime = 2 * np.sqrt(c1_prime * c2_prime) * np.sin(delta_h_prime / 2)
        
        # 计算加权因子
        l_bar_prime = (l1 + l2) / 2
        s_l = 1 + (0.015 * (l_bar_prime - 50)**2) / np.sqrt(20 + (l_bar_prime - 50)**2)
        s_c = 1 + 0.045 * c_bar_prime
        
        t = 1 - 0.17 * np.cos(h1_prime - np.pi/6) + \
            0.24 * np.cos(2 * h1_prime) + \
            0.32 * np.cos(3 * h1_prime + np.pi/30) - \
            0.20 * np.cos(4 * h1_prime - 63 * np.pi/180)
        s_h = 1 + 0.015 * c_bar_prime * t
        
        delta_theta = 30 * np.pi / 180 * np.exp(-((180 / np.pi * h1_prime - 275) / 25)**2)
        r_c = 2 * np.sqrt(c_bar_prime**7 / (c_bar_prime**7 + 25**7))
        r_t = -r_c * np.sin(2 * delta_theta)
        
        # 计算最终的Delta E00
        delta_e00 = np.sqrt(
            (delta_l_prime / s_l)**2 +
            (delta_c_prime / s_c)**2 +
            (delta_h_prime / s_h)**2 +
            r_t * (delta_c_prime / s_c) * (delta_h_prime / s_h)
        )
        
        return delta_e00
    
    def analyze_color_changes(self) -> Dict:
        """
        分析修复前后的颜色变化
        
        Returns:
            颜色变化分析结果
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        # 转换为LAB颜色空间
        lab_before = self.rgb_to_lab(self.before_image)
        lab_after = self.rgb_to_lab(self.after_image)
        
        # 计算色差值
        delta_e = self.calculate_delta_e(lab_before, lab_after)
        
        # 计算统计信息
        mean_delta_e = np.mean(delta_e)
        max_delta_e = np.max(delta_e)
        min_delta_e = np.min(delta_e)
        std_delta_e = np.std(delta_e)
        
        # 计算超过阈值的像素比例
        pixels_above_threshold = np.sum(delta_e > self.delta_e_threshold)
        total_pixels = delta_e.size
        percent_above_threshold = (pixels_above_threshold / total_pixels) * 100
        
        # 分析亮度变化
        l_before = lab_before[:, :, 0].astype(np.float64)
        l_after = lab_after[:, :, 0].astype(np.float64)
        delta_l = l_after - l_before
        
        mean_delta_l = np.mean(delta_l)
        max_delta_l = np.max(delta_l)
        min_delta_l = np.min(delta_l)
        
        # 分析饱和度变化
        a_before = lab_before[:, :, 1].astype(np.float64)
        b_before = lab_before[:, :, 2].astype(np.float64)
        chroma_before = np.sqrt(a_before**2 + b_before**2)
        
        a_after = lab_after[:, :, 1].astype(np.float64)
        b_after = lab_after[:, :, 2].astype(np.float64)
        chroma_after = np.sqrt(a_after**2 + b_after**2)
        
        delta_chroma = chroma_after - chroma_before
        mean_delta_chroma = np.mean(delta_chroma)
        
        # 检测异常区域
        abnormal_regions = self._detect_abnormal_regions(delta_e, delta_l, delta_chroma)
        
        return {
            "statistics": {
                "mean_delta_e": mean_delta_e,
                "max_delta_e": max_delta_e,
                "min_delta_e": min_delta_e,
                "std_delta_e": std_delta_e,
                "percent_above_threshold": percent_above_threshold,
                "mean_delta_l": mean_delta_l,
                "max_delta_l": max_delta_l,
                "min_delta_l": min_delta_l,
                "mean_delta_chroma": mean_delta_chroma
            },
            "abnormal_regions": abnormal_regions,
            "delta_e_map": delta_e,
            "delta_l_map": delta_l,
            "delta_chroma_map": delta_chroma
        }
    
    def _detect_abnormal_regions(self, delta_e: np.ndarray, delta_l: np.ndarray, 
                                  delta_chroma: np.ndarray) -> List[Dict]:
        """
        检测颜色异常区域
        
        Args:
            delta_e: 色差值图
            delta_l: 亮度变化图
            delta_chroma: 饱和度变化图
            
        Returns:
            异常区域列表
        """
        # 创建异常掩码
        abnormal_mask = (
            (delta_e > self.delta_e_threshold) |
            (np.abs(delta_l) > self.luminance_threshold) |
            (np.abs(delta_chroma) > self.chroma_threshold)
        ).astype(np.uint8) * 255
        
        # 形态学操作，连接相邻的异常区域
        kernel = np.ones((5, 5), np.uint8)
        abnormal_mask = cv2.morphologyEx(abnormal_mask, cv2.MORPH_CLOSE, kernel)
        
        # 查找轮廓
        contours, _ = cv2.findContours(
            abnormal_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        abnormal_regions = []
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            
            # 过滤掉太小的区域
            if area < 50:
                continue
            
            # 获取边界框
            x, y, w, h = cv2.boundingRect(contour)
            
            # 计算区域内的平均色差值
            mask = np.zeros(delta_e.shape[:2], dtype=np.uint8)
            cv2.drawContours(mask, [contour], 0, 255, -1)
            
            mean_de = cv2.mean(delta_e, mask=mask)[0]
            mean_dl = cv2.mean(delta_l, mask=mask)[0]
            mean_dc = cv2.mean(delta_chroma, mask=mask)[0]
            
            # 分类异常类型
            abnormal_type = []
            if mean_de > self.delta_e_threshold:
                abnormal_type.append("色差过大")
            if np.abs(mean_dl) > self.luminance_threshold:
                if mean_dl > 0:
                    abnormal_type.append("亮度增加")
                else:
                    abnormal_type.append("亮度降低")
            if np.abs(mean_dc) > self.chroma_threshold:
                if mean_dc > 0:
                    abnormal_type.append("饱和度增加")
                else:
                    abnormal_type.append("饱和度降低")
            
            abnormal_regions.append({
                "id": i,
                "bounding_box": (x, y, w, h),
                "area": area,
                "mean_delta_e": mean_de,
                "mean_delta_l": mean_dl,
                "mean_delta_chroma": mean_dc,
                "abnormal_types": abnormal_type
            })
        
        return abnormal_regions
    
    def get_color_visualization(self, viz_type: str = "delta_e") -> np.ndarray:
        """
        获取颜色变化可视化图像
        
        Args:
            viz_type: 可视化类型 ("delta_e", "delta_l", "delta_chroma", "combined")
            
        Returns:
            可视化图像
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        # 分析颜色变化
        color_analysis = self.analyze_color_changes()
        
        if viz_type == "delta_e":
            # 色差值可视化
            delta_e = color_analysis["delta_e_map"]
            # 归一化到0-255
            delta_e_normalized = cv2.normalize(delta_e, None, 0, 255, cv2.NORM_MINMAX)
            delta_e_normalized = delta_e_normalized.astype(np.uint8)
            # 应用伪彩色
            return cv2.applyColorMap(delta_e_normalized, cv2.COLORMAP_JET)
        
        elif viz_type == "delta_l":
            # 亮度变化可视化
            delta_l = color_analysis["delta_l_map"]
            # 归一化到0-255（负到正的映射）
            delta_l_normalized = cv2.normalize(delta_l, None, 0, 255, cv2.NORM_MINMAX)
            delta_l_normalized = delta_l_normalized.astype(np.uint8)
            return cv2.applyColorMap(delta_l_normalized, cv2.COLORMAP_BONE)
        
        elif viz_type == "delta_chroma":
            # 饱和度变化可视化
            delta_chroma = color_analysis["delta_chroma_map"]
            delta_chroma_normalized = cv2.normalize(delta_chroma, None, 0, 255, cv2.NORM_MINMAX)
            delta_chroma_normalized = delta_chroma_normalized.astype(np.uint8)
            return cv2.applyColorMap(delta_chroma_normalized, cv2.COLORMAP_SUMMER)
        
        elif viz_type == "combined":
            # 综合可视化（标注异常区域）
            viz_image = self.after_image.copy()
            
            for region in color_analysis["abnormal_regions"]:
                x, y, w, h = region["bounding_box"]
                
                # 根据异常类型选择颜色
                if "色差过大" in region["abnormal_types"]:
                    color = (0, 0, 255)  # 红色
                elif "亮度增加" in region["abnormal_types"]:
                    color = (0, 255, 255)  # 黄色
                elif "亮度降低" in region["abnormal_types"]:
                    color = (255, 0, 0)  # 蓝色
                else:
                    color = (0, 255, 0)  # 绿色
                
                # 绘制边界框
                cv2.rectangle(viz_image, (x, y), (x + w, y + h), color, 2)
                
                # 绘制标签
                label = f"ΔE: {region['mean_delta_e']:.1f}"
                cv2.putText(
                    viz_image, label, (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1
                )
            
            return viz_image
        
        else:
            raise ValueError(f"未知的可视化类型: {viz_type}")
