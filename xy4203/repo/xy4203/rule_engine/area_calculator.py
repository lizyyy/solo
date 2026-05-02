#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
面积计算模块 - 检测局部补纸面积漏算问题
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field


@dataclass
class AreaIssue:
    """面积问题数据结构"""
    issue_type: str  # "missing_annotation", "area_mismatch", "unrecorded_repair", "coverage_inconsistent"
    severity: str  # "high", "medium", "low", "warning"
    defect_id: Optional[str] = None
    page_number: Optional[int] = None
    message: str = ""
    details: Dict[str, Any] = None


class AreaCalculator:
    """
    面积计算器
    检测局部补纸面积漏算、标注面积与实际修复面积不匹配等问题
    """
    
    def __init__(self):
        """初始化面积计算器"""
        # 配置参数
        self.area_tolerance_percent = 20.0  # 面积差异容忍百分比
        self.min_repair_area = 100  # 最小修复面积（像素）
        self.overlap_threshold = 0.5  # 重叠判定阈值（IOU）
        
    def compare_annotation_vs_actual(self, 
                                       annotated_defects: List[Dict],
                                       detected_defects: List[Dict],
                                       image_width: int,
                                       image_height: int) -> List[AreaIssue]:
        """
        比较标注缺损与实际检测到的缺损
        
        Args:
            annotated_defects: 人工标注的缺损列表
            detected_defects: 自动检测到的缺损列表
            image_width: 图像宽度
            image_height: 图像高度
            
        Returns:
            面积问题列表
        """
        issues = []
        
        # 1. 检查每个标注的缺损是否有对应的实际检测
        for annot_defect in annotated_defects:
            annot_area = annot_defect.get("area", 0)
            annot_bbox = annot_defect.get("bounding_box")
            
            if not annot_bbox:
                # 尝试从位置和宽高构建边界框
                x = annot_defect.get("position_x", 0) - annot_defect.get("width", 0) / 2
                y = annot_defect.get("position_y", 0) - annot_defect.get("height", 0) / 2
                w = annot_defect.get("width", 0)
                h = annot_defect.get("height", 0)
                annot_bbox = (int(x), int(y), int(w), int(h))
            
            # 查找匹配的检测缺损
            best_match = None
            best_iou = 0
            
            for detect_defect in detected_defects:
                detect_bbox = detect_defect.get("bounding_box")
                if not detect_bbox:
                    continue
                
                iou = self._calculate_iou(annot_bbox, detect_bbox)
                
                if iou > self.overlap_threshold and iou > best_iou:
                    best_iou = iou
                    best_match = detect_defect
            
            if best_match:
                # 比较面积
                detect_area = best_match.get("area", 0)
                area_diff = abs(annot_area - detect_area)
                
                if annot_area > 0:
                    area_diff_percent = (area_diff / annot_area) * 100
                else:
                    area_diff_percent = 100.0
                
                if area_diff_percent > self.area_tolerance_percent:
                    issues.append(AreaIssue(
                        issue_type="area_mismatch",
                        severity="medium" if area_diff_percent < 50 else "high",
                        defect_id=annot_defect.get("id", "unknown"),
                        page_number=annot_defect.get("page_number"),
                        message=f"标注面积与实际检测面积差异过大：标注 {annot_area:.0f}px，检测 {detect_area:.0f}px，差异 {area_diff_percent:.1f}%",
                        details={
                            "annotated_area": annot_area,
                            "detected_area": detect_area,
                            "difference_percent": area_diff_percent,
                            "iou": best_iou
                        }
                    ))
            else:
                # 标注的缺损没有被检测到（可能已修复）
                issues.append(AreaIssue(
                    issue_type="unrecorded_repair",
                    severity="warning",
                    defect_id=annot_defect.get("id", "unknown"),
                    page_number=annot_defect.get("page_number"),
                    message=f"标注的缺损 {annot_defect.get('id')} 在修复后未检测到，可能已完全修复",
                    details={
                        "annotated_area": annot_area,
                        "bounding_box": annot_bbox
                    }
                ))
        
        # 2. 检查是否有未标注的新缺损
        for detect_defect in detected_defects:
            detect_area = detect_defect.get("area", 0)
            
            # 跳过太小的区域
            if detect_area < self.min_repair_area:
                continue
            
            detect_bbox = detect_defect.get("bounding_box")
            if not detect_bbox:
                continue
            
            # 查找是否有匹配的标注
            has_match = False
            for annot_defect in annotated_defects:
                annot_bbox = annot_defect.get("bounding_box")
                if not annot_bbox:
                    # 尝试构建边界框
                    x = annot_defect.get("position_x", 0) - annot_defect.get("width", 0) / 2
                    y = annot_defect.get("position_y", 0) - annot_defect.get("height", 0) / 2
                    w = annot_defect.get("width", 0)
                    h = annot_defect.get("height", 0)
                    annot_bbox = (int(x), int(y), int(w), int(h))
                
                iou = self._calculate_iou(detect_bbox, annot_bbox)
                
                if iou > self.overlap_threshold:
                    has_match = True
                    break
            
            if not has_match:
                issues.append(AreaIssue(
                    issue_type="missing_annotation",
                    severity="medium",
                    page_number=detect_defect.get("page_number"),
                    message=f"检测到未标注的缺损区域，面积 {detect_area:.0f}px",
                    details={
                        "detected_area": detect_area,
                        "bounding_box": detect_bbox,
                        "defect_type": detect_defect.get("type", "unknown")
                    }
                ))
        
        return issues
    
    def _calculate_iou(self, bbox1: Tuple[int, int, int, int], 
                       bbox2: Tuple[int, int, int, int]) -> float:
        """
        计算两个边界框的交并比（IOU）
        
        Args:
            bbox1: 第一个边界框 (x, y, w, h)
            bbox2: 第二个边界框 (x, y, w, h)
            
        Returns:
            IOU值（0-1之间）
        """
        # 解包边界框
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        # 计算交集区域
        xi1 = max(x1, x2)
        yi1 = max(y1, y2)
        xi2 = min(x1 + w1, x2 + w2)
        yi2 = min(y1 + h1, y2 + h2)
        
        inter_width = xi2 - xi1
        inter_height = yi2 - yi1
        
        if inter_width <= 0 or inter_height <= 0:
            return 0.0
        
        inter_area = inter_width * inter_height
        
        # 计算并集区域
        area1 = w1 * h1
        area2 = w2 * h2
        union_area = area1 + area2 - inter_area
        
        if union_area <= 0:
            return 0.0
        
        return inter_area / union_area
    
    def check_material_area_match(self, 
                                   material_records: List[Dict],
                                   annotated_defects: List[Dict],
                                   detected_repair_areas: List[Dict]) -> List[AreaIssue]:
        """
        检查材料记录面积与实际修复面积是否匹配
        
        Args:
            material_records: 材料记录列表
            annotated_defects: 标注的缺损列表
            detected_repair_areas: 检测到的修复区域列表
            
        Returns:
            面积匹配问题列表
        """
        issues = []
        
        # 计算材料记录的总使用面积
        total_material_area = sum(m.get("usage_area", 0) for m in material_records)
        
        # 计算标注的缺损总面积
        total_annotated_area = sum(d.get("area", 0) for d in annotated_defects)
        
        # 计算检测到的修复区域总面积
        total_detected_area = sum(a.get("area", 0) for a in detected_repair_areas)
        
        # 比较材料记录与标注面积
        if total_material_area > 0 and total_annotated_area > 0:
            area_diff = abs(total_material_area - total_annotated_area)
            area_diff_percent = (area_diff / max(total_material_area, total_annotated_area)) * 100
            
            if area_diff_percent > self.area_tolerance_percent:
                issues.append(AreaIssue(
                    issue_type="coverage_inconsistent",
                    severity="medium",
                    message=f"材料记录面积与标注缺损面积不匹配：材料 {total_material_area:.0f}px，标注 {total_annotated_area:.0f}px，差异 {area_diff_percent:.1f}%",
                    details={
                        "material_area": total_material_area,
                        "annotated_area": total_annotated_area,
                        "difference_percent": area_diff_percent
                    }
                ))
        
        # 比较材料记录与检测面积
        if total_material_area > 0 and total_detected_area > 0:
            area_diff = abs(total_material_area - total_detected_area)
            area_diff_percent = (area_diff / max(total_material_area, total_detected_area)) * 100
            
            if area_diff_percent > self.area_tolerance_percent:
                issues.append(AreaIssue(
                    issue_type="coverage_inconsistent",
                    severity="medium" if area_diff_percent < 50 else "high",
                    message=f"材料记录面积与实际检测面积不匹配：材料 {total_material_area:.0f}px，检测 {total_detected_area:.0f}px，差异 {area_diff_percent:.1f}%",
                    details={
                        "material_area": total_material_area,
                        "detected_area": total_detected_area,
                        "difference_percent": area_diff_percent
                    }
                ))
        
        return issues
    
    def calculate_area_statistics(self, 
                                   annotated_defects: List[Dict],
                                   detected_defects: List[Dict],
                                   image_width: int,
                                   image_height: int) -> Dict:
        """
        计算面积统计信息
        
        Args:
            annotated_defects: 标注的缺损列表
            detected_defects: 检测到的缺损列表
            image_width: 图像宽度
            image_height: 图像高度
            
        Returns:
            面积统计信息字典
        """
        total_image_area = image_width * image_height
        
        # 标注统计
        total_annotated_area = sum(d.get("area", 0) for d in annotated_defects)
        annotated_coverage = (total_annotated_area / total_image_area * 100) if total_image_area > 0 else 0
        
        # 检测统计
        total_detected_area = sum(d.get("area", 0) for d in detected_defects)
        detected_coverage = (total_detected_area / total_image_area * 100) if total_image_area > 0 else 0
        
        # 按类型统计标注
        type_stats = {}
        for defect in annotated_defects:
            defect_type = defect.get("defect_type", "未分类")
            if defect_type not in type_stats:
                type_stats[defect_type] = {
                    "count": 0,
                    "total_area": 0.0,
                    "avg_area": 0.0
                }
            type_stats[defect_type]["count"] += 1
            type_stats[defect_type]["total_area"] += defect.get("area", 0)
        
        # 计算平均面积
        for defect_type, stats in type_stats.items():
            if stats["count"] > 0:
                stats["avg_area"] = stats["total_area"] / stats["count"]
        
        return {
            "image_area": total_image_area,
            "annotated": {
                "total_count": len(annotated_defects),
                "total_area": total_annotated_area,
                "coverage_percent": annotated_coverage,
                "type_statistics": type_stats
            },
            "detected": {
                "total_count": len(detected_defects),
                "total_area": total_detected_area,
                "coverage_percent": detected_coverage
            },
            "comparison": {
                "area_difference": abs(total_annotated_area - total_detected_area),
                "difference_percent": (
                    abs(total_annotated_area - total_detected_area) / 
                    max(total_annotated_area, total_detected_area) * 100
                ) if max(total_annotated_area, total_detected_area) > 0 else 0
            }
        }
    
    def estimate_repair_effectiveness(self, 
                                       before_defects: List[Dict],
                                       after_defects: List[Dict]) -> Dict:
        """
        估算修复效果
        
        Args:
            before_defects: 修复前缺损列表
            after_defects: 修复后缺损列表
            
        Returns:
            修复效果评估字典
        """
        total_before_area = sum(d.get("area", 0) for d in before_defects)
        total_after_area = sum(d.get("area", 0) for d in after_defects)
        
        area_reduction = total_before_area - total_after_area
        reduction_percent = (area_reduction / total_before_area * 100) if total_before_area > 0 else 0
        
        # 分析每个缺损的修复情况
        repair_details = []
        matched_count = 0
        fully_repaired_count = 0
        partially_repaired_count = 0
        
        for before_defect in before_defects:
            before_area = before_defect.get("area", 0)
            before_bbox = before_defect.get("bounding_box")
            
            if not before_bbox:
                continue
            
            # 查找匹配的修复后缺损
            best_match = None
            best_iou = 0
            
            for after_defect in after_defects:
                after_bbox = after_defect.get("bounding_box")
                if not after_bbox:
                    continue
                
                iou = self._calculate_iou(before_bbox, after_bbox)
                if iou > self.overlap_threshold and iou > best_iou:
                    best_iou = iou
                    best_match = after_defect
            
            if best_match:
                matched_count += 1
                after_area = best_match.get("area", 0)
                
                if after_area < before_area * 0.1:  # 面积减少90%以上视为完全修复
                    fully_repaired_count += 1
                    repair_status = "完全修复"
                elif after_area < before_area * 0.5:  # 面积减少50%以上视为部分修复
                    partially_repaired_count += 1
                    repair_status = "部分修复"
                else:
                    repair_status = "未修复"
                
                repair_details.append({
                    "before_defect_id": before_defect.get("id"),
                    "after_defect_id": best_match.get("id"),
                    "before_area": before_area,
                    "after_area": after_area,
                    "area_reduction": before_area - after_area,
                    "reduction_percent": ((before_area - after_area) / before_area * 100) if before_area > 0 else 0,
                    "repair_status": repair_status,
                    "iou": best_iou
                })
            else:
                # 没有匹配，可能已完全修复
                fully_repaired_count += 1
                repair_details.append({
                    "before_defect_id": before_defect.get("id"),
                    "after_defect_id": None,
                    "before_area": before_area,
                    "after_area": 0,
                    "area_reduction": before_area,
                    "reduction_percent": 100.0,
                    "repair_status": "完全修复（无残留）",
                    "iou": 0
                })
        
        return {
            "summary": {
                "total_before_defects": len(before_defects),
                "total_after_defects": len(after_defects),
                "total_before_area": total_before_area,
                "total_after_area": total_after_area,
                "area_reduction": area_reduction,
                "reduction_percent": reduction_percent,
                "fully_repaired_count": fully_repaired_count,
                "partially_repaired_count": partially_repaired_count,
                "unrepaired_count": len(before_defects) - fully_repaired_count - partially_repaired_count
            },
            "details": repair_details
        }
