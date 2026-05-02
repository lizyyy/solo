#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
示例数据模块 - 生成示例图像和CSV文件用于演示
"""

import os
import csv
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np


class SampleDataGenerator:
    """
    示例数据生成器
    生成模拟的修复前后图像、病害标注CSV和材料记录CSV
    """
    
    def __init__(self, output_dir: str = None):
        """
        初始化示例数据生成器
        
        Args:
            output_dir: 输出目录（默认为当前目录下的sample_data文件夹）
        """
        if output_dir is None:
            output_dir = os.path.join(os.getcwd(), "sample_data")
        
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 图像配置
        self.image_width = 800
        self.image_height = 1200
        
        # 纸张颜色（古籍纸张通常偏黄）
        self.paper_color = (220, 240, 255)  # BGR格式 - 淡黄色
        
    def generate_all_samples(self, num_pages: int = 3) -> Dict:
        """
        生成所有示例数据
        
        Args:
            num_pages: 生成的页数
            
        Returns:
            生成的文件路径信息字典
        """
        result = {
            "before_images": [],
            "after_images": [],
            "defect_csv": "",
            "material_csv": "",
            "generated_at": datetime.now().isoformat()
        }
        
        # 生成图像
        defect_annotations = []
        material_records = []
        
        for page_num in range(1, num_pages + 1):
            # 生成修复前图像（带缺陷）
            before_img, defects = self._generate_before_image(page_num)
            before_path = self.output_dir / f"page_{page_num:03d}_before.jpg"
            cv2.imwrite(str(before_path), before_img)
            result["before_images"].append(str(before_path))
            
            # 生成修复后图像
            after_img = self._generate_after_image(page_num, defects)
            after_path = self.output_dir / f"page_{page_num:03d}_after.jpg"
            cv2.imwrite(str(after_path), after_img)
            result["after_images"].append(str(after_path))
            
            # 生成病害标注数据
            for i, defect in enumerate(defects, 1):
                defect_annotations.append({
                    "id": f"defect_{page_num:03d}_{i}",
                    "page_number": page_num,
                    "defect_type": defect["type"],
                    "position_x": defect["center_x"],
                    "position_y": defect["center_y"],
                    "width": defect["width"],
                    "height": defect["height"],
                    "area": defect["area"],
                    "severity": defect["severity"],
                    "description": defect["description"],
                    "repair_status": defect.get("repair_status", "部分修复"),
                    "material_used": defect.get("material_used", "宣纸")
                })
            
            # 生成材料记录数据
            material_records.append({
                "id": f"material_{page_num:03d}_1",
                "page_number": page_num,
                "material_type": "补纸",
                "material_name": "手工宣纸",
                "quantity": 1,
                "unit": "张",
                "usage_area": sum(d["area"] for d in defects if d.get("repair_status") != "未修复"),
                "application_date": datetime.now().strftime("%Y-%m-%d"),
                "technician": "张修复师",
                "notes": f"第{page_num}页补纸修复"
            })
        
        # 生成病害标注CSV
        defect_csv_path = self.output_dir / "defect_annotations.csv"
        self._generate_defect_csv(defect_annotations, str(defect_csv_path))
        result["defect_csv"] = str(defect_csv_path)
        
        # 生成材料记录CSV
        material_csv_path = self.output_dir / "material_records.csv"
        self._generate_material_csv(material_records, str(material_csv_path))
        result["material_csv"] = str(material_csv_path)
        
        return result
    
    def _generate_before_image(self, page_num: int) -> Tuple[np.ndarray, List[Dict]]:
        """
        生成修复前图像（带缺陷）
        
        Args:
            page_num: 页码
            
        Returns:
            (图像数组, 缺陷列表)
        """
        # 创建空白纸张背景
        img = np.full(
            (self.image_height, self.image_width, 3),
            self.paper_color,
            dtype=np.uint8
        )
        
        # 添加纸张纹理
        img = self._add_paper_texture(img)
        
        # 添加页面边缘老化效果
        img = self._add_aging_effect(img)
        
        # 添加文字内容（模拟古籍文字）
        img = self._add_text_content(img, page_num)
        
        # 添加缺陷
        defects = self._generate_defects(page_num)
        img = self._draw_defects(img, defects)
        
        return img, defects
    
    def _generate_after_image(self, page_num: int, defects: List[Dict]) -> np.ndarray:
        """
        生成修复后图像
        
        Args:
            page_num: 页码
            defects: 缺陷列表
            
        Returns:
            修复后的图像数组
        """
        # 创建空白纸张背景
        img = np.full(
            (self.image_height, self.image_width, 3),
            self.paper_color,
            dtype=np.uint8
        )
        
        # 添加纸张纹理
        img = self._add_paper_texture(img)
        
        # 添加页面边缘老化效果（比修复前轻微）
        img = self._add_aging_effect(img, intensity=0.3)
        
        # 添加文字内容
        img = self._add_text_content(img, page_num)
        
        # 模拟修复效果
        for defect in defects:
            if defect.get("repair_status") == "完全修复":
                # 完全修复：不显示缺陷
                continue
            elif defect.get("repair_status") == "部分修复":
                # 部分修复：显示轻微的修复痕迹
                img = self._draw_repaired_defect(img, defect)
            else:
                # 未修复：显示缺陷但轻微
                img = self._draw_defect_faint(img, defect)
        
        # 添加一些色差（模拟修复材料与原纸张的颜色差异）
        if page_num % 2 == 0:  # 第2、4...页添加明显色差
            img = self._add_color_shift(img)
        
        return img
    
    def _add_paper_texture(self, img: np.ndarray) -> np.ndarray:
        """添加纸张纹理"""
        # 添加噪点模拟纸张纹理
        noise = np.random.normal(0, 5, img.shape).astype(np.float32)
        img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        
        return img
    
    def _add_aging_effect(self, img: np.ndarray, intensity: float = 0.5) -> np.ndarray:
        """添加老化效果（边缘变暗）"""
        # 创建边缘掩码
        mask = np.zeros_like(img, dtype=np.float32)
        
        # 边缘渐变
        rows, cols = img.shape[:2]
        for i in range(rows):
            for j in range(cols):
                # 计算到最近边缘的距离
                dist_to_edge = min(i, rows - i - 1, j, cols - j - 1)
                # 边缘30像素内逐渐变暗
                if dist_to_edge < 30:
                    factor = dist_to_edge / 30
                    mask[i, j] = factor
                else:
                    mask[i, j] = 1.0
        
        # 应用强度
        mask = 0.7 + mask * 0.3 * intensity
        
        return (img.astype(np.float32) * mask).astype(np.uint8)
    
    def _add_text_content(self, img: np.ndarray, page_num: int) -> np.ndarray:
        """添加文字内容（模拟古籍文字）"""
        # 使用OpenCV绘制简单的文字
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        color = (80, 80, 80)  # 深灰色文字
        thickness = 2
        
        # 绘制页码
        text = f"Page {page_num}"
        text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
        x = (self.image_width - text_size[0]) // 2
        y = 50
        cv2.putText(img, text, (x, y), font, font_scale, color, thickness)
        
        # 绘制模拟文字行
        for row in range(10):
            y = 100 + row * 60
            # 随机长度的线条模拟文字
            line_length = np.random.randint(400, 700)
            cv2.line(img, (100, y), (100 + line_length, y), color, 2)
        
        return img
    
    def _generate_defects(self, page_num: int) -> List[Dict]:
        """
        生成缺陷数据
        
        Args:
            page_num: 页码
            
        Returns:
            缺陷列表
        """
        defects = []
        
        # 根据页码生成不同数量的缺陷
        num_defects = 2 + (page_num % 3)
        
        defect_types = ["孔洞", "污渍", "褶皱", "残缺", "褪色"]
        severities = ["高", "中", "低"]
        
        for i in range(num_defects):
            # 随机位置（避开边缘）
            x = np.random.randint(150, self.image_width - 150)
            y = np.random.randint(150, self.image_height - 150)
            
            # 随机大小
            width = np.random.randint(30, 120)
            height = np.random.randint(30, 120)
            area = width * height
            
            # 修复状态
            repair_status = np.random.choice(
                ["完全修复", "部分修复", "未修复"],
                p=[0.3, 0.5, 0.2]
            )
            
            defects.append({
                "id": f"{page_num:03d}_{i}",
                "page_number": page_num,
                "type": np.random.choice(defect_types),
                "center_x": x,
                "center_y": y,
                "width": width,
                "height": height,
                "area": area,
                "severity": np.random.choice(severities),
                "description": f"第{page_num}页{i+1}号缺陷",
                "repair_status": repair_status,
                "material_used": "宣纸" if repair_status != "未修复" else ""
            })
        
        return defects
    
    def _draw_defects(self, img: np.ndarray, defects: List[Dict]) -> np.ndarray:
        """在图像上绘制缺陷"""
        for defect in defects:
            x, y = defect["center_x"], defect["center_y"]
            w, h = defect["width"], defect["height"]
            
            defect_type = defect["type"]
            
            if defect_type == "孔洞":
                # 黑色孔洞
                cv2.ellipse(img, (x, y), (w // 2, h // 2), 0, 0, 360, (30, 30, 30), -1)
            elif defect_type == "污渍":
                # 棕色污渍
                cv2.ellipse(img, (x, y), (w // 2, h // 2), 0, 0, 360, (60, 90, 130), -1)
            elif defect_type == "褶皱":
                # 线条褶皱
                for i in range(5):
                    y_offset = y - h // 2 + int(i * h / 5)
                    cv2.line(img, (x - w // 2, y_offset), (x + w // 2, y_offset), (100, 100, 100), 2)
            elif defect_type == "残缺":
                # 边缘残缺（模拟边缘破损）
                pts = np.array([
                    [x - w // 2, y - h // 2],
                    [x + w // 3, y - h // 3],
                    [x + w // 2, y + h // 3],
                    [x, y + h // 2],
                    [x - w // 3, y + h // 4]
                ], np.int32)
                cv2.fillPoly(img, [pts], (255, 255, 255))
            elif defect_type == "褪色":
                # 褪色区域（比背景更亮）
                overlay = img.copy()
                cv2.ellipse(overlay, (x, y), (w // 2, h // 2), 0, 0, 360, (240, 250, 255), -1)
                cv2.addWeighted(overlay, 0.4, img, 0.6, 0, img)
        
        return img
    
    def _draw_repaired_defect(self, img: np.ndarray, defect: Dict) -> np.ndarray:
        """绘制修复后的缺陷痕迹"""
        x, y = defect["center_x"], defect["center_y"]
        w, h = defect["width"], defect["height"]
        
        # 轻微的颜色差异（模拟补纸痕迹）
        overlay = img.copy()
        cv2.ellipse(overlay, (x, y), (w // 2, h // 2), 0, 0, 360, (210, 235, 250), -1)
        cv2.addWeighted(overlay, 0.3, img, 0.7, 0, img)
        
        # 边缘线
        cv2.ellipse(img, (x, y), (w // 2, h // 2), 0, 0, 360, (180, 200, 220), 1)
        
        return img
    
    def _draw_defect_faint(self, img: np.ndarray, defect: Dict) -> np.ndarray:
        """绘制轻微的缺陷（未完全修复）"""
        x, y = defect["center_x"], defect["center_y"]
        w, h = defect["width"], defect["height"]
        
        # 半透明的缺陷
        overlay = img.copy()
        cv2.ellipse(overlay, (x, y), (w // 2, h // 2), 0, 0, 360, (150, 150, 150), -1)
        cv2.addWeighted(overlay, 0.2, img, 0.8, 0, img)
        
        return img
    
    def _add_color_shift(self, img: np.ndarray) -> np.ndarray:
        """添加颜色偏移（模拟色差问题）"""
        # 在图像中心区域添加轻微的颜色偏移
        center_x = self.image_width // 2
        center_y = self.image_height // 2
        radius = 200
        
        # 创建掩码
        mask = np.zeros(img.shape[:2], dtype=np.uint8)
        cv2.circle(mask, (center_x, center_y), radius, 255, -1)
        
        # 颜色偏移
        overlay = img.copy()
        # 轻微偏红
        overlay[:, :, 2] = np.clip(overlay[:, :, 2].astype(np.float32) + 20, 0, 255).astype(np.uint8)
        
        # 应用到掩码区域
        img = np.where(mask[:, :, np.newaxis] == 255, overlay, img)
        
        return img
    
    def _generate_defect_csv(self, defects: List[Dict], output_path: str):
        """
        生成病害标注CSV
        
        Args:
            defects: 缺陷列表
            output_path: 输出路径
        """
        headers = [
            "id", "page_number", "defect_type", "position_x", "position_y",
            "width", "height", "area", "severity", "description",
            "repair_status", "material_used"
        ]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for defect in defects:
                writer.writerow({k: defect.get(k, "") for k in headers})
    
    def _generate_material_csv(self, materials: List[Dict], output_path: str):
        """
        生成材料记录CSV
        
        Args:
            materials: 材料记录列表
            output_path: 输出路径
        """
        headers = [
            "id", "page_number", "material_type", "material_name",
            "quantity", "unit", "usage_area", "application_date",
            "technician", "notes"
        ]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for material in materials:
                writer.writerow({k: material.get(k, "") for k in headers})
    
    def get_sample_info(self) -> Dict:
        """
        获取示例数据的信息
        
        Returns:
            示例数据信息字典
        """
        return {
            "output_directory": str(self.output_dir),
            "expected_files": {
                "before_images": ["page_001_before.jpg", "page_002_before.jpg", "page_003_before.jpg"],
                "after_images": ["page_001_after.jpg", "page_002_after.jpg", "page_003_after.jpg"],
                "defect_csv": "defect_annotations.csv",
                "material_csv": "material_records.csv"
            },
            "image_resolution": f"{self.image_width}x{self.image_height}",
            "description": "包含模拟古籍修复前后的图像、病害标注和材料记录的示例数据"
        }


def create_sample_data(output_dir: str = None) -> Dict:
    """
    便捷函数：创建示例数据
    
    Args:
        output_dir: 输出目录
        
    Returns:
        生成的文件路径信息
    """
    generator = SampleDataGenerator(output_dir)
    return generator.generate_all_samples(num_pages=3)


if __name__ == "__main__":
    # 测试生成示例数据
    result = create_sample_data()
    print(f"示例数据已生成到: {result}")
