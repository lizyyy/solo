import numpy as np
from PIL import Image, ImageStat
from typing import Dict, Any, List, Tuple
import json


class SimpleFeatureExtractor:
    """简单图像特征提取器 - 用于演示目的
    
    在实际生产环境中，可以替换为：
    1. 预训练的深度学习模型（如ResNet、EfficientNet）
    2. 专门的缺陷检测模型
    3. 使用OpenCV进行更复杂的图像处理
    """
    
    def __init__(self):
        self.feature_dim = 128  # 特征维度
    
    def extract_features(self, image_path: str) -> Dict[str, Any]:
        """提取图像特征
        
        Args:
            image_path: 图像文件路径
            
        Returns:
            包含特征信息的字典
        """
        try:
            # 打开图像
            img = Image.open(image_path)
            
            # 转换为RGB模式
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 调整大小以加快处理
            img_resized = img.resize((256, 256), Image.LANCZOS)
            
            # 提取基本特征
            features = self._extract_basic_features(img_resized)
            
            # 提取颜色特征
            color_features = self._extract_color_features(img_resized)
            
            # 提取纹理特征（简化版）
            texture_features = self._extract_texture_features(img_resized)
            
            # 提取边缘特征
            edge_features = self._extract_edge_features(img_resized)
            
            # 合并所有特征
            all_features = {
                **features,
                **color_features,
                **texture_features,
                **edge_features
            }
            
            # 生成特征向量（用于相似度比较）
            feature_vector = self._generate_feature_vector(all_features)
            
            return {
                "features": all_features,
                "feature_vector": feature_vector.tolist(),
                "image_size": img.size,
                "image_mode": img.mode
            }
            
        except Exception as e:
            print(f"特征提取失败: {e}")
            return {
                "features": {},
                "feature_vector": [],
                "error": str(e)
            }
    
    def _extract_basic_features(self, img: Image.Image) -> Dict[str, float]:
        """提取基本图像特征"""
        # 转换为灰度图
        gray = img.convert('L')
        stat = ImageStat.Stat(gray)
        
        # 计算基本统计量
        mean = stat.mean[0]
        std = stat.stddev[0] if stat.stddev[0] > 0 else 1.0
        
        # 计算直方图
        histogram = gray.histogram()
        
        # 对比度
        contrast = std / mean if mean > 0 else 0
        
        # 亮度分布
        bright_pixels = sum(1 for i in range(128, 256) if histogram[i] > 0) / 128
        
        return {
            "brightness": mean / 255.0,
            "contrast": contrast / 100.0,  # 归一化
            "std_dev": std / 255.0,
            "bright_pixels_ratio": bright_pixels
        }
    
    def _extract_color_features(self, img: Image.Image) -> Dict[str, float]:
        """提取颜色特征"""
        # 获取RGB通道统计
        stat = ImageStat.Stat(img)
        
        # 各通道均值
        r_mean, g_mean, b_mean = stat.mean
        
        # 各通道标准差
        r_std, g_std, b_std = stat.stddev
        
        # 颜色饱和度（简化版）
        r_ratio = r_mean / (r_mean + g_mean + b_mean) if (r_mean + g_mean + b_mean) > 0 else 0
        g_ratio = g_mean / (r_mean + g_mean + b_mean) if (r_mean + g_mean + b_mean) > 0 else 0
        b_ratio = b_mean / (r_mean + g_mean + b_mean) if (r_mean + g_mean + b_mean) > 0 else 0
        
        # 颜色变化程度
        color_variation = (r_std + g_std + b_std) / 3
        
        return {
            "r_ratio": r_ratio,
            "g_ratio": g_ratio,
            "b_ratio": b_ratio,
            "r_std": r_std / 255.0,
            "g_std": g_std / 255.0,
            "b_std": b_std / 255.0,
            "color_variation": color_variation / 255.0
        }
    
    def _extract_texture_features(self, img: Image.Image) -> Dict[str, float]:
        """提取纹理特征（简化版）"""
        # 转换为灰度图并转换为numpy数组
        gray = np.array(img.convert('L'), dtype=np.float32)
        
        # 计算梯度（使用简单差分）
        dx = np.diff(gray, axis=0)
        dy = np.diff(gray, axis=1)
        
        # 梯度幅度
        gradient_magnitude = np.sqrt(np.mean(dx**2) + np.mean(dy**2))
        
        # 局部方差（纹理粗糙度）
        # 简化：使用梯度的标准差
        gradient_std = np.std(dx) + np.std(dy)
        
        # 边缘密度
        # 简化：使用高梯度像素比例
        edge_threshold = 30
        edge_pixels = np.sum(np.abs(dx) > edge_threshold) + np.sum(np.abs(dy) > edge_threshold)
        edge_density = edge_pixels / (dx.size + dy.size) if (dx.size + dy.size) > 0 else 0
        
        return {
            "gradient_magnitude": gradient_magnitude / 255.0,
            "gradient_std": gradient_std / 255.0,
            "edge_density": edge_density
        }
    
    def _extract_edge_features(self, img: Image.Image) -> Dict[str, float]:
        """提取边缘特征（简化版）"""
        # 转换为灰度图
        gray = np.array(img.convert('L'), dtype=np.float32)
        
        # 简单边缘检测（Sobel算子简化版）
        # 水平和垂直差分
        dx = np.abs(np.diff(gray, axis=0))
        dy = np.abs(np.diff(gray, axis=1))
        
        # 边缘强度统计
        edge_intensity = np.mean(np.maximum(dx, dy))
        
        # 边缘方向分布
        horizontal_edges = np.mean(dx > 20)
        vertical_edges = np.mean(dy > 20)
        
        # 线性特征（裂纹可能表现为线性边缘）
        # 简化：使用边缘的连通性（这里用高边缘密度区域比例）
        linear_features = edge_intensity * (horizontal_edges + vertical_edges) / 2
        
        return {
            "edge_intensity": edge_intensity / 255.0,
            "horizontal_edges": horizontal_edges,
            "vertical_edges": vertical_edges,
            "linear_features": linear_features
        }
    
    def _generate_feature_vector(self, features: Dict[str, float]) -> np.ndarray:
        """生成特征向量"""
        # 按固定顺序提取特征值
        feature_order = [
            "brightness", "contrast", "std_dev", "bright_pixels_ratio",
            "r_ratio", "g_ratio", "b_ratio", "r_std", "g_std", "b_std", "color_variation",
            "gradient_magnitude", "gradient_std", "edge_density",
            "edge_intensity", "horizontal_edges", "vertical_edges", "linear_features"
        ]
        
        vector = []
        for key in feature_order:
            value = features.get(key, 0.0)
            # 确保值在合理范围内
            vector.append(max(0.0, min(1.0, value)))
        
        # 填充到固定维度
        while len(vector) < self.feature_dim:
            vector.append(0.0)
        
        return np.array(vector[:self.feature_dim], dtype=np.float32)
    
    def calculate_similarity(self, vector1: List[float], vector2: List[float]) -> float:
        """计算两个特征向量的余弦相似度"""
        v1 = np.array(vector1, dtype=np.float32)
        v2 = np.array(vector2, dtype=np.float32)
        
        # 计算余弦相似度
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(v1, v2) / (norm1 * norm2))


class DefectDetector:
    """缺陷检测器 - 基于规则的简单缺陷检测"""
    
    def __init__(self):
        # 缺陷类型定义
        self.defect_types = {
            "crack": {
                "name": "裂纹",
                "indicators": ["linear_features", "edge_intensity", "gradient_magnitude"],
                "thresholds": [0.3, 0.4, 0.25],
                "weights": [0.4, 0.35, 0.25]
            },
            "lightning_strike": {
                "name": "雷击点",
                "indicators": ["brightness", "edge_intensity", "color_variation"],
                "thresholds": [0.7, 0.5, 0.3],
                "weights": [0.35, 0.35, 0.3]
            },
            "corrosion": {
                "name": "腐蚀",
                "indicators": ["r_ratio", "color_variation", "std_dev"],
                "thresholds": [0.45, 0.2, 0.15],
                "weights": [0.4, 0.3, 0.3]
            },
            "oil_stain": {
                "name": "油污",
                "indicators": ["brightness", "color_variation", "b_ratio"],
                "thresholds": [0.25, 0.25, 0.4],
                "weights": [0.35, 0.35, 0.3]
            }
        }
    
    def detect_defects(self, features: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检测图像中的缺陷
        
        Args:
            features: 图像特征字典
            
        Returns:
            检测到的缺陷列表
        """
        detected = []
        feature_values = features.get("features", {})
        
        for defect_code, defect_info in self.defect_types.items():
            score = self._calculate_defect_score(
                feature_values,
                defect_info["indicators"],
                defect_info["thresholds"],
                defect_info["weights"]
            )
            
            if score > 0.3:  # 最低检测阈值
                detected.append({
                    "type": defect_code,
                    "name": defect_info["name"],
                    "confidence": score,
                    "description": self._generate_description(defect_code, score)
                })
        
        # 按置信度排序
        detected.sort(key=lambda x: x["confidence"], reverse=True)
        
        return detected
    
    def _calculate_defect_score(self, features: Dict[str, float], 
                                 indicators: List[str], 
                                 thresholds: List[float],
                                 weights: List[float]) -> float:
        """计算缺陷得分"""
        total_score = 0.0
        total_weight = 0.0
        
        for indicator, threshold, weight in zip(indicators, thresholds, weights):
            value = features.get(indicator, 0.0)
            
            # 计算该指标的得分（超过阈值后递增）
            if value >= threshold:
                # 超过阈值后的得分计算
                excess = (value - threshold) / (1.0 - threshold) if threshold < 1.0 else 0.0
                indicator_score = 0.5 + 0.5 * min(excess, 1.0)
            else:
                # 低于阈值的得分
                indicator_score = 0.5 * (value / threshold) if threshold > 0 else 0.0
            
            total_score += indicator_score * weight
            total_weight += weight
        
        return total_score / total_weight if total_weight > 0 else 0.0
    
    def _generate_description(self, defect_type: str, confidence: float) -> str:
        """生成缺陷描述"""
        level = "低"
        if confidence >= 0.8:
            level = "高"
        elif confidence >= 0.6:
            level = "中"
        
        descriptions = {
            "crack": f"检测到可能存在裂纹，置信度{level}（{confidence:.1%}）。建议重点检查线性特征区域。",
            "lightning_strike": f"检测到可能存在雷击点，置信度{level}（{confidence:.1%}）。建议检查高亮度区域是否有雷击损伤。",
            "corrosion": f"检测到可能存在腐蚀，置信度{level}（{confidence:.1%}）。建议检查颜色异常区域。",
            "oil_stain": f"检测到可能存在油污，置信度{level}（{confidence:.1%}）。建议检查暗色区域是否有油污。"
        }
        
        return descriptions.get(defect_type, f"检测到异常，置信度{confidence:.1%}")


# 创建全局实例
feature_extractor = SimpleFeatureExtractor()
defect_detector = DefectDetector()
