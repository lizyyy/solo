"""图片文件解析器"""
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def parse_image(file_path: str) -> Dict[str, Any]:
    """解析图片文件，提取元数据和基本信息
    
    Args:
        file_path: 图片文件路径
    
    Returns:
        包含图片信息的字典
    """
    if not HAS_PIL:
        raise ImportError("需要安装 Pillow 库: pip install Pillow")
    
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    result = {
        "file_path": str(path.absolute()),
        "format": None,
        "size": None,
        "width": None,
        "height": None,
        "mode": None,
        "exif": {},
        "dpi": None,
    }
    
    try:
        with Image.open(file_path) as img:
            result["format"] = img.format
            result["size"] = img.size
            result["width"] = img.width
            result["height"] = img.height
            result["mode"] = img.mode
            
            # 获取DPI信息
            if hasattr(img, "info") and "dpi" in img.info:
                result["dpi"] = img.info["dpi"]
            
            # 提取EXIF信息
            if hasattr(img, "_getexif") and img._getexif() is not None:
                exif_data = img._getexif()
                if exif_data:
                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        result["exif"][tag] = str(value)
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


def get_image_dimensions(file_path: str) -> Dict[str, int]:
    """获取图片尺寸
    
    Args:
        file_path: 图片文件路径
    
    Returns:
        包含宽度和高度的字典
    """
    if not HAS_PIL:
        raise ImportError("需要安装 Pillow 库: pip install Pillow")
    
    with Image.open(file_path) as img:
        return {
            "width": img.width,
            "height": img.height,
            "aspect_ratio": round(img.width / img.height, 4) if img.height > 0 else None,
        }


def check_image_signatures(file_path: str) -> Dict[str, Any]:
    """检查图片是否包含签名特征（通过颜色和边缘检测简单判断）
    
    Args:
        file_path: 图片文件路径
    
    Returns:
        签名检查结果
    """
    result = {
        "likely_has_signature": False,
        "confidence": 0.0,
        "notes": [],
    }
    
    if not HAS_PIL:
        return result
    
    try:
        with Image.open(file_path) as img:
            # 转换为灰度
            gray_img = img.convert("L")
            
            # 获取图像统计信息
            extrema = gray_img.getextrema()
            min_val, max_val = extrema
            
            # 如果图像有较暗的区域（可能是签名）
            if min_val < 100:
                result["notes"].append("存在较暗区域，可能包含签名或印章")
                result["confidence"] += 0.3
            
            # 检查图像尺寸比例
            width, height = gray_img.size
            aspect_ratio = width / height
            
            # 常见的签名页比例
            if 0.7 < aspect_ratio < 1.5:
                result["notes"].append("图像比例接近常见文档页面")
                result["confidence"] += 0.2
            
            # 简单的颜色分析
            # 如果图像有大量深色区域但不是全黑
            pixel_count = width * height
            dark_pixels = 0
            
            # 只取样分析以提高性能
            sample_step = max(1, (width * height) // 10000)
            
            pixels = list(gray_img.getdata())
            for i in range(0, len(pixels), sample_step):
                if pixels[i] < 100:
                    dark_pixels += 1
            
            dark_ratio = (dark_pixels * sample_step) / pixel_count
            
            if 0.01 < dark_ratio < 0.5:
                result["notes"].append(f"深色像素占比约 {dark_ratio:.1%}，可能包含签名/印章")
                result["confidence"] += 0.3
            
            if result["confidence"] > 0.5:
                result["likely_has_signature"] = True
    
    except Exception as e:
        result["notes"].append(f"分析时出错: {str(e)}")
    
    return result
