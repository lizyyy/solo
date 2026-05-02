#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
色差检查模块 - 检测色差变化太大的问题
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class ColorIssue:
    """色差问题数据结构"""
    issue_type: str  # "color_anomaly", "luminance_change", "chroma_shift", "global_color_shift"
    severity: str  # "high", "medium", "low", "warning"
    page_number: Optional[int] = None
    region_id: Optional[str] = None
    message: str = ""
    details: Dict[str, Any] = None


class ColorChecker:
    """
    色差检查器
    检测色差变化太大、亮度异常、饱和度偏移等问题
    """
    
    def __init__(self):
        """初始化色差检查器"""
        # 配置参数
        self.delta_e_threshold = 5.0  # 可感知的色差阈值（CIEDE2000）
        self.delta_e_warning = 8.0    # 警告级别的色差阈值
        self.delta_e_critical = 12.0  # 严重级别的色差阈值
        
        self.luminance_threshold = 15.0  # 亮度变化阈值（L*通道）
        self.chroma_threshold = 12.0     # 饱和度变化阈值
        
        self.min_anomaly_area = 500  # 最小异常区域面积（像素）
        
    def check_color_changes(self, 
                            before_image: np.ndarray,
                            after_image: np.ndarray,
                            page_number: int = None) -> List[ColorIssue]:
        """
        检查修复前后的颜色变化
        
        Args:
            before_image: 修复前图像（BGR格式）
            after_image: 修复后图像（BGR格式）
            page_number: 页码（用于报告）
            
        Returns:
            色差问题列表
        """
        issues = []
        
        # 确保图像尺寸一致
        if before_image.shape != after_image.shape:
            after_image = cv2.resize(
                after_image, 
                (before_image.shape[1], before_image.shape[0])
            )
        
        # 转换为LAB颜色空间
        lab_before = cv2.cvtColor(before_image, cv2.COLOR_BGR2LAB)
        lab_after = cv2.cvtColor(after_image, cv2.COLOR_BGR2LAB)
        
        # 分离LAB通道
        l1, a1, b1 = cv2.split(lab_before.astype(np.float64))
        l2, a2, b2 = cv2.split(lab_after.astype(np.float64))
        
        # 计算全局统计
        global_stats = self._calculate_global_color_stats(lab_before, lab_after)
        
        # 检查全局颜色偏移
        if global_stats["mean_delta_e"] > self.delta_e_threshold:
            severity = self._get_severity(global_stats["mean_delta_e"])
            issues.append(ColorIssue(
                issue_type="global_color_shift",
                severity=severity,
                page_number=page_number,
                message=f"全局颜色偏移：平均ΔE = {global_stats['mean_delta_e']:.2f}",
                details={
                    "mean_delta_e": global_stats["mean_delta_e"],
                    "max_delta_e": global_stats["max_delta_e"],
                    "mean_delta_l": global_stats["mean_delta_l"],
                    "mean_delta_c": global_stats["mean_delta_c"]
                }
            ))
        
        # 检测局部颜色异常区域
        abnormal_regions = self._detect_abnormal_color_regions(
            lab_before, lab_after, page_number
        )
        
        for region in abnormal_regions:
            issues.append(region)
        
        return issues
    
    def _calculate_global_color_stats(self, lab_before: np.ndarray, lab_after: np.ndarray) -> Dict:
        """
        计算全局颜色统计
        
        Args:
            lab_before: 修复前LAB图像
            lab_after: 修复后LAB图像
            
        Returns:
            统计信息字典
        """
        # 分离通道
        l1, a1, b1 = cv2.split(lab_before.astype(np.float64))
        l2, a2, b2 = cv2.split(lab_after.astype(np.float64))
        
        # 计算亮度变化
        delta_l = l2 - l1
        mean_delta_l = np.mean(delta_l)
        
        # 计算饱和度变化
        chroma1 = np.sqrt(a1**2 + b1**2)
        chroma2 = np.sqrt(a2**2 + b2**2)
        delta_c = chroma2 - chroma1
        mean_delta_c = np.mean(delta_c)
        
        # 计算CIEDE2000色差（简化版）
        # 实际应用中应使用完整的CIEDE2000公式
        delta_l_prime = l2 - l1
        
        l_bar = (l1 + l2) / 2
        c1 = np.sqrt(a1**2 + b1**2)
        c2 = np.sqrt(a2**2 + b2**2)
        c_bar = (c1 + c2) / 2
        
        # 简化的Delta E计算（用于全局统计）
        delta_e_simple = np.sqrt(
            (l2 - l1)**2 +
            (a2 - a1)**2 +
            (b2 - b1)**2
        )
        
        return {
            "mean_delta_e": np.mean(delta_e_simple),
            "max_delta_e": np.max(delta_e_simple),
            "std_delta_e": np.std(delta_e_simple),
            "mean_delta_l": mean_delta_l,
            "mean_delta_c": mean_delta_c,
            "percent_above_threshold": np.mean(delta_e_simple > self.delta_e_threshold) * 100
        }
    
    def _detect_abnormal_color_regions(self, 
                                         lab_before: np.ndarray,
                                         lab_after: np.ndarray,
                                         page_number: int = None) -> List[ColorIssue]:
        """
        检测局部颜色异常区域
        
        Args:
            lab_before: 修复前LAB图像
            lab_after: 修复后LAB图像
            page_number: 页码
            
        Returns:
            颜色异常问题列表
        """
        issues = []
        
        # 分离通道
        l1, a1, b1 = cv2.split(lab_before.astype(np.float64))
        l2, a2, b2 = cv2.split(lab_after.astype(np.float64))
        
        # 计算各通道差异
        delta_l = l2 - l1
        delta_a = a2 - a1
        delta_b = b2 - b1
        
        # 计算简化的Delta E
        delta_e = np.sqrt(delta_l**2 + delta_a**2 + delta_b**2)
        
        # 计算饱和度变化
        chroma1 = np.sqrt(a1**2 + b1**2)
        chroma2 = np.sqrt(a2**2 + b2**2)
        delta_c = chroma2 - chroma1
        
        # 1. 检测色差过大区域
        delta_e_mask = (delta_e > self.delta_e_threshold).astype(np.uint8) * 255
        issues.extend(self._find_color_regions(
            delta_e_mask, delta_e, "color_anomaly", "色差过大", page_number
        ))
        
        # 2. 检测亮度异常变化区域
        luminance_mask = (np.abs(delta_l) > self.luminance_threshold).astype(np.uint8) * 255
        issues.extend(self._find_color_regions(
            luminance_mask, np.abs(delta_l), "luminance_change", "亮度变化异常", page_number
        ))
        
        # 3. 检测饱和度异常变化区域
        chroma_mask = (np.abs(delta_c) > self.chroma_threshold).astype(np.uint8) * 255
        issues.extend(self._find_color_regions(
            chroma_mask, np.abs(delta_c), "chroma_shift", "饱和度偏移", page_number
        ))
        
        return issues
    
    def _find_color_regions(self, 
                             mask: np.ndarray,
                             value_map: np.ndarray,
                             issue_type: str,
                             issue_name: str,
                             page_number: int = None) -> List[ColorIssue]:
        """
        在掩码中查找连通区域并生成问题报告
        
        Args:
            mask: 二进制掩码
            value_map: 对应的值映射（用于计算统计）
            issue_type: 问题类型
            issue_name: 问题名称
            page_number: 页码
            
        Returns:
            颜色问题列表
        """
        issues = []
        
        # 形态学操作，连接相邻区域
        kernel = np.ones((5, 5), np.uint8)
        cleaned_mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        # 查找连通区域
        contours, _ = cv2.findContours(
            cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            
            # 跳过太小的区域
            if area < self.min_anomaly_area:
                continue
            
            # 获取边界框
            x, y, w, h = cv2.boundingRect(contour)
            
            # 创建区域掩码
            region_mask = np.zeros(mask.shape[:2], dtype=np.uint8)
            cv2.drawContours(region_mask, [contour], 0, 255, -1)
            
            # 计算区域内的统计值
            region_values = value_map[region_mask == 255]
            
            if len(region_values) == 0:
                continue
            
            mean_value = np.mean(region_values)
            max_value = np.max(region_values)
            
            # 确定严重程度
            if issue_type == "color_anomaly":
                severity = self._get_severity(mean_value)
            elif issue_type == "luminance_change":
                if mean_value > self.luminance_threshold * 2:
                    severity = "high"
                elif mean_value > self.luminance_threshold * 1.5:
                    severity = "medium"
                else:
                    severity = "warning"
            else:  # chroma_shift
                if mean_value > self.chroma_threshold * 2:
                    severity = "high"
                elif mean_value > self.chroma_threshold * 1.5:
                    severity = "medium"
                else:
                    severity = "warning"
            
            # 生成问题描述
            if issue_type == "color_anomaly":
                message = f"{issue_name}：平均ΔE = {mean_value:.2f}，最大ΔE = {max_value:.2f}"
            elif issue_type == "luminance_change":
                direction = "增加" if np.mean(value_map[region_mask == 255] - value_map[region_mask == 255]) > 0 else "减少"
                message = f"{issue_name}：平均变化 {mean_value:.2f}，区域面积 {area:.0f}px"
            else:
                message = f"{issue_name}：平均变化 {mean_value:.2f}，区域面积 {area:.0f}px"
            
            issues.append(ColorIssue(
                issue_type=issue_type,
                severity=severity,
                page_number=page_number,
                region_id=f"{issue_type}_{i}",
                message=message,
                details={
                    "bounding_box": (x, y, w, h),
                    "area": area,
                    "mean_value": mean_value,
                    "max_value": max_value,
                    "pixel_count": len(region_values)
                }
            ))
        
        return issues
    
    def _get_severity(self, delta_e: float) -> str:
        """
        根据色差值确定严重程度
        
        Args:
            delta_e: CIEDE2000色差值
            
        Returns:
            严重程度字符串
        """
        if delta_e >= self.delta_e_critical:
            return "high"
        elif delta_e >= self.delta_e_warning:
            return "medium"
        elif delta_e >= self.delta_e_threshold:
            return "warning"
        else:
            return "low"
    
    def check_color_consistency(self, 
                                 image_list: List[np.ndarray],
                                 page_numbers: List[int] = None) -> List[ColorIssue]:
        """
        检查多页图像之间的颜色一致性
        
        Args:
            image_list: 图像列表（BGR格式）
            page_numbers: 对应的页码列表
            
        Returns:
            颜色一致性问题列表
        """
        issues = []
        
        if len(image_list) < 2:
            return issues
        
        # 计算每张图像的平均颜色
        mean_colors = []
        for img in image_list:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            mean_l = np.mean(lab[:, :, 0])
            mean_a = np.mean(lab[:, :, 1])
            mean_b = np.mean(lab[:, :, 2])
            mean_colors.append((mean_l, mean_a, mean_b))
        
        # 计算相邻图像的色差
        for i in range(len(mean_colors) - 1):
            l1, a1, b1 = mean_colors[i]
            l2, a2, b2 = mean_colors[i + 1]
            
            # 计算简化的Delta E
            delta_e = np.sqrt((l2 - l1)**2 + (a2 - a1)**2 + (b2 - b1)**2)
            
            if delta_e > self.delta_e_threshold:
                page1 = page_numbers[i] if page_numbers and i < len(page_numbers) else i + 1
                page2 = page_numbers[i + 1] if page_numbers and i + 1 < len(page_numbers) else i + 2
                
                severity = self._get_severity(delta_e)
                
                issues.append(ColorIssue(
                    issue_type="global_color_shift",
                    severity=severity,
                    pages=[page1, page2],
                    message=f"页码 {page1} 和 {page2} 之间颜色差异较大：ΔE = {delta_e:.2f}",
                    details={
                        "page1_color": (l1, a1, b1),
                        "page2_color": (l2, a2, b2),
                        "delta_e": delta_e
                    }
                ))
        
        return issues
    
    def get_color_statistics(self, 
                              before_image: np.ndarray,
                              after_image: np.ndarray) -> Dict:
        """
        获取颜色统计信息
        
        Args:
            before_image: 修复前图像
            after_image: 修复后图像
            
        Returns:
            颜色统计信息字典
        """
        # 确保图像尺寸一致
        if before_image.shape != after_image.shape:
            after_image = cv2.resize(
                after_image, 
                (before_image.shape[1], before_image.shape[0])
            )
        
        # 转换为LAB
        lab_before = cv2.cvtColor(before_image, cv2.COLOR_BGR2LAB)
        lab_after = cv2.cvtColor(after_image, cv2.COLOR_BGR2LAB)
        
        # 计算全局统计
        global_stats = self._calculate_global_color_stats(lab_before, lab_after)
        
        # 计算各区域统计
        l1, a1, b1 = cv2.split(lab_before.astype(np.float64))
        l2, a2, b2 = cv2.split(lab_after.astype(np.float64))
        
        delta_l = l2 - l1
        chroma1 = np.sqrt(a1**2 + b1**2)
        chroma2 = np.sqrt(a2**2 + b2**2)
        delta_c = chroma2 - chroma1
        
        # 计算简化的Delta E
        delta_e = np.sqrt(delta_l**2 + (a2 - a1)**2 + (b2 - b1)**2)
        
        # 分类统计
        stats = {
            "global": global_stats,
            "delta_e_distribution": {
                "below_threshold": np.sum(delta_e < self.delta_e_threshold),
                "between_thresholds": np.sum(
                    (delta_e >= self.delta_e_threshold) & 
                    (delta_e < self.delta_e_warning)
                ),
                "warning": np.sum(
                    (delta_e >= self.delta_e_warning) & 
                    (delta_e < self.delta_e_critical)
                ),
                "critical": np.sum(delta_e >= self.delta_e_critical)
            },
            "luminance_change": {
                "brightened": np.sum(delta_l > 0),
                "darkened": np.sum(delta_l < 0),
                "unchanged": np.sum(delta_l == 0),
                "mean_brightening": np.mean(delta_l[delta_l > 0]) if np.sum(delta_l > 0) > 0 else 0,
                "mean_darkening": np.mean(delta_l[delta_l < 0]) if np.sum(delta_l < 0) > 0 else 0
            },
            "chroma_change": {
                "increased": np.sum(delta_c > 0),
                "decreased": np.sum(delta_c < 0),
                "unchanged": np.sum(delta_c == 0),
                "mean_increase": np.mean(delta_c[delta_c > 0]) if np.sum(delta_c > 0) > 0 else 0,
                "mean_decrease": np.mean(delta_c[delta_c < 0]) if np.sum(delta_c < 0) > 0 else 0
            }
        }
        
        return stats
