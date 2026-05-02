#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缺损分析模块 - 自动估算缺损区域变化
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional


class DefectAnalyzer:
    """
    缺损分析器
    分析修复前后图像的缺损区域变化
    """
    
    def __init__(self):
        """初始化缺损分析器"""
        self.before_image = None
        self.after_image = None
        self.defect_regions_before = []
        self.defect_regions_after = []
    
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
    
    def detect_defects(self, image: np.ndarray, threshold: float = 30) -> List[Dict]:
        """
        检测图像中的缺损区域
        
        Args:
            image: 输入图像
            threshold: 缺损检测阈值（颜色差异阈值）
            
        Returns:
            缺损区域列表，每个区域包含：位置、面积、类型等信息
        """
        # 转换为灰度图
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 使用自适应阈值检测缺损
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # 形态学操作，去除噪声
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        
        # 查找轮廓
        contours, _ = cv2.findContours(
            cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        defects = []
        total_area = image.shape[0] * image.shape[1]
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            
            # 过滤掉太小的区域
            if area < 10:  # 最小面积阈值
                continue
            
            # 获取边界框
            x, y, w, h = cv2.boundingRect(contour)
            
            # 计算质心
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
            else:
                cx, cy = x + w // 2, y + h // 2
            
            # 分析缺损类型（基于颜色和形状）
            defect_type = self._classify_defect(image, contour)
            
            # 计算相对面积
            relative_area = (area / total_area) * 100
            
            defects.append({
                "id": i,
                "position": (cx, cy),
                "bounding_box": (x, y, w, h),
                "contour": contour,
                "area": area,
                "relative_area": relative_area,
                "type": defect_type
            })
        
        return defects
    
    def _classify_defect(self, image: np.ndarray, contour) -> str:
        """
        分类缺损类型
        
        Args:
            image: 输入图像
            contour: 轮廓
            
        Returns:
            缺损类型
        """
        # 创建掩码
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.drawContours(mask, [contour], 0, 255, -1)
        
        # 计算区域内的平均颜色
        mean_color = cv2.mean(image, mask=mask)
        
        # 简单分类（基于颜色）
        # 这里是简化版，实际应用可能需要更复杂的分类逻辑
        if mean_color[0] < 100:  # 较暗的区域
            return "孔洞"
        elif mean_color[0] > 200:  # 较亮的区域
            return "褪色"
        else:
            return "污渍"
    
    def analyze_defect_changes(self) -> Dict:
        """
        分析修复前后缺损区域的变化
        
        Returns:
            缺损变化分析结果
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        # 检测修复前后的缺损
        self.defect_regions_before = self.detect_defects(self.before_image)
        self.defect_regions_after = self.detect_defects(self.after_image)
        
        # 计算统计信息
        total_before = len(self.defect_regions_before)
        total_after = len(self.defect_regions_after)
        
        area_before = sum(d["area"] for d in self.defect_regions_before)
        area_after = sum(d["area"] for d in self.defect_regions_after)
        
        # 计算面积变化
        area_change = area_after - area_before
        area_change_percent = (area_change / area_before * 100) if area_before > 0 else 0
        
        # 计算匹配的缺损（简化版：基于位置和大小匹配）
        matched_defects = self._match_defects(
            self.defect_regions_before, 
            self.defect_regions_after
        )
        
        # 分析修复效果
        repaired_count = 0
        partially_repaired_count = 0
        new_defects_count = 0
        
        for match in matched_defects:
            if match["before"] and not match["after"]:
                repaired_count += 1
            elif match["before"] and match["after"]:
                before_area = match["before"]["area"]
                after_area = match["after"]["area"]
                if after_area < before_area * 0.5:  # 面积减少50%以上视为部分修复
                    partially_repaired_count += 1
            elif not match["before"] and match["after"]:
                new_defects_count += 1
        
        return {
            "statistics": {
                "defects_before": total_before,
                "defects_after": total_after,
                "area_before": area_before,
                "area_after": area_after,
                "area_change": area_change,
                "area_change_percent": area_change_percent
            },
            "repair_analysis": {
                "repaired_count": repaired_count,
                "partially_repaired_count": partially_repaired_count,
                "new_defects_count": new_defects_count,
                "unrepaired_count": total_after - new_defects_count
            },
            "defects_before": self.defect_regions_before,
            "defects_after": self.defect_regions_after,
            "matched_defects": matched_defects
        }
    
    def _match_defects(self, defects_before: List[Dict], defects_after: List[Dict]) -> List[Dict]:
        """
        匹配修复前后的缺损
        
        Args:
            defects_before: 修复前缺损列表
            defects_after: 修复后缺损列表
            
        Returns:
            匹配结果列表
        """
        matched = []
        matched_after_indices = set()
        
        # 匹配修复前的缺损到修复后
        for defect_before in defects_before:
            best_match = None
            best_distance = float("inf")
            
            for i, defect_after in enumerate(defects_after):
                if i in matched_after_indices:
                    continue
                
                # 计算位置距离
                dist = np.sqrt(
                    (defect_before["position"][0] - defect_after["position"][0])**2 +
                    (defect_before["position"][1] - defect_after["position"][1])**2
                )
                
                # 计算面积相似性
                area_ratio = defect_after["area"] / defect_before["area"]
                
                # 综合评分（距离越近、面积越相似越好）
                score = dist * (1 + abs(1 - area_ratio))
                
                if score < best_distance and score < 100:  # 阈值
                    best_distance = score
                    best_match = defect_after
                    best_match_index = i
            
            if best_match:
                matched_after_indices.add(best_match_index)
                matched.append({
                    "before": defect_before,
                    "after": best_match,
                    "match_score": best_distance
                })
            else:
                matched.append({
                    "before": defect_before,
                    "after": None,
                    "match_score": None
                })
        
        # 处理修复后新增的缺损
        for i, defect_after in enumerate(defects_after):
            if i not in matched_after_indices:
                matched.append({
                    "before": None,
                    "after": defect_after,
                    "match_score": None
                })
        
        return matched
    
    def get_defect_visualization(self, image_type: str = "both") -> np.ndarray:
        """
        获取缺损可视化图像
        
        Args:
            image_type: 图像类型 ("before", "after", "both", "diff")
            
        Returns:
            可视化图像
        """
        if self.before_image is None or self.after_image is None:
            raise ValueError("请先加载图像")
        
        if image_type == "before":
            return self._draw_defects(self.before_image.copy(), self.defect_regions_before)
        elif image_type == "after":
            return self._draw_defects(self.after_image.copy(), self.defect_regions_after)
        elif image_type == "both":
            before_viz = self._draw_defects(self.before_image.copy(), self.defect_regions_before)
            after_viz = self._draw_defects(self.after_image.copy(), self.defect_regions_after)
            return np.hstack([before_viz, after_viz])
        elif image_type == "diff":
            # 计算差异图
            before_gray = cv2.cvtColor(self.before_image, cv2.COLOR_BGR2GRAY)
            after_gray = cv2.cvtColor(self.after_image, cv2.COLOR_BGR2GRAY)
            diff = cv2.absdiff(before_gray, after_gray)
            diff_color = cv2.applyColorMap(diff, cv2.COLORMAP_JET)
            return diff_color
        else:
            raise ValueError(f"未知的图像类型: {image_type}")
    
    def _draw_defects(self, image: np.ndarray, defects: List[Dict]) -> np.ndarray:
        """
        在图像上绘制缺损区域
        
        Args:
            image: 输入图像
            defects: 缺损列表
            
        Returns:
            绘制了缺损区域的图像
        """
        for defect in defects:
            # 绘制轮廓
            cv2.drawContours(image, [defect["contour"]], 0, (0, 255, 0), 2)
            
            # 绘制边界框
            x, y, w, h = defect["bounding_box"]
            cv2.rectangle(image, (x, y), (x + w, y + h), (255, 0, 0), 1)
            
            # 绘制标签
            label = f"{defect['type']}: {defect['area']:.0f}px"
            cv2.putText(
                image, label, (x, y - 10), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1
            )
        
        return image
