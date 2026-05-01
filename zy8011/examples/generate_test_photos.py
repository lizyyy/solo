#!/usr/bin/env python3
"""
生成测试照片的脚本
创建带有不同EXIF信息和文件名格式的测试图片
"""
import os
from pathlib import Path
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
from PIL.ExifTags import TAGS, GPSTAGS
import piexif


def create_test_image(output_path: Path, 
                      store_code: str = None,
                      checkpoint: str = None,
                      photo_time: datetime = None,
                      add_exif: bool = True,
                      size: tuple = (800, 600)):
    """
    创建测试图片
    
    Args:
        output_path: 输出路径
        store_code: 门店编码
        checkpoint: 点位
        photo_time: 拍摄时间
        add_exif: 是否添加EXIF信息
        size: 图片尺寸
    """
    # 创建纯色背景
    img = Image.new('RGB', size, color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    
    # 尝试加载字体
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 36)
        font_small = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 24)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        except:
            font = ImageFont.load_default()
            font_small = font
    
    # 绘制标题
    title = "巡检照片"
    draw.text((size[0]//2 - 80, 50), title, fill=(50, 50, 50), font=font)
    
    # 绘制信息
    info_lines = []
    if store_code:
        info_lines.append(f"门店: {store_code}")
    if checkpoint:
        info_lines.append(f"点位: {checkpoint}")
    if photo_time:
        info_lines.append(f"时间: {photo_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    y_pos = 150
    for line in info_lines:
        draw.text((100, y_pos), line, fill=(80, 80, 80), font=font_small)
        y_pos += 50
    
    # 绘制边框
    draw.rectangle([10, 10, size[0]-10, size[1]-10], outline=(100, 100, 100), width=2)
    
    # 准备EXIF数据
    exif_bytes = None
    if add_exif and photo_time:
        # 构建EXIF数据
        exif_dict = {
            "0th": {},
            "Exif": {},
            "GPS": {},
            "1st": {},
            "thumbnail": None,
        }
        
        # EXIF时间格式: "YYYY:MM:DD HH:MM:SS"
        time_str = photo_time.strftime("%Y:%m:%d %H:%M:%S")
        
        # 添加时间标签
        exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = time_str
        exif_dict["Exif"][piexif.ExifIFD.DateTimeDigitized] = time_str
        exif_dict["0th"][piexif.ImageIFD.DateTime] = time_str
        
        # 添加门店信息到ImageDescription
        description = ""
        if store_code:
            description += f"Store: {store_code} "
        if checkpoint:
            description += f"Checkpoint: {checkpoint}"
        
        if description:
            exif_dict["0th"][piexif.ImageIFD.ImageDescription] = description
        
        # 转换为字节
        exif_bytes = piexif.dump(exif_dict)
    
    # 保存图片
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if exif_bytes:
        img.save(output_path, "JPEG", exif=exif_bytes, quality=85)
    else:
        img.save(output_path, "JPEG", quality=85)
    
    print(f"创建图片: {output_path}")


def generate_test_photos(output_dir: str = "test_photos"):
    """
    生成测试照片集
    包含各种情况：
    - 正常照片（有EXIF，正确门店和点位）
    - 无EXIF照片（依赖文件名）
    - 时间偏差的照片
    - 重复照片
    - 未知门店/点位的照片
    - 同名冲突的照片
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    base_time = datetime(2026, 5, 1, 14, 30, 0)
    
    # ==================== SH001 正常照片 ====================
    print("\n=== 生成 SH001 正常照片 ===")
    
    # 入口 (正常时间)
    create_test_image(
        output_path / "SH001_20260501_143000_入口.jpg",
        store_code="SH001",
        checkpoint="入口",
        photo_time=base_time,
        add_exif=True
    )
    
    # 收银台 (正常时间)
    create_test_image(
        output_path / "SH001_20260501_143500_收银台.jpg",
        store_code="SH001",
        checkpoint="收银台",
        photo_time=base_time + timedelta(minutes=5),
        add_exif=True
    )
    
    # 货架A (正常时间)
    create_test_image(
        output_path / "SH001_货架A_20260501.jpg",
        store_code="SH001",
        checkpoint="货架A",
        photo_time=base_time + timedelta(minutes=10),
        add_exif=True
    )
    
    # 货架B - 无EXIF（测试从文件名提取）
    print("\n=== 生成无EXIF照片 ===")
    create_test_image(
        output_path / "SH001_20260501_145000_货架B.jpg",
        store_code="SH001",
        checkpoint="货架B",
        photo_time=base_time + timedelta(minutes=20),
        add_exif=False  # 不添加EXIF
    )
    
    # ==================== 时间偏差照片 ====================
    print("\n=== 生成时间偏差照片 ===")
    
    # 太早（08:00，SH001要求09:00开始）
    create_test_image(
        output_path / "SH001_20260501_080000_消防设备.jpg",
        store_code="SH001",
        checkpoint="消防设备",
        photo_time=datetime(2026, 5, 1, 8, 0, 0),
        add_exif=True
    )
    
    # 太晚（22:00，SH001要求21:00结束）
    create_test_image(
        output_path / "SH001_20260501_220000_卫生间.jpg",
        store_code="SH001",
        checkpoint="卫生间",
        photo_time=datetime(2026, 5, 1, 22, 0, 0),
        add_exif=True
    )
    
    # ==================== 重复照片 ====================
    print("\n=== 生成重复照片 ===")
    
    # 创建第一张
    create_test_image(
        output_path / "SH001_重复_货架A_1.jpg",
        store_code="SH001",
        checkpoint="货架A",
        photo_time=base_time + timedelta(minutes=30),
        add_exif=True
    )
    
    # 复制内容相同但文件名不同
    src = output_path / "SH001_重复_货架A_1.jpg"
    dst = output_path / "SH001_重复_货架A_2.jpg"
    import shutil
    shutil.copy2(src, dst)
    print(f"创建重复图片: {dst}")
    
    # ==================== 未知门店/点位 ====================
    print("\n=== 生成未知门店/点位照片 ===")
    
    # 未知门店编码
    create_test_image(
        output_path / "XX999_20260501_150000_入口.jpg",
        store_code="XX999",
        checkpoint="入口",
        photo_time=base_time + timedelta(minutes=30),
        add_exif=True
    )
    
    # 无法识别点位（文件名中没有点位信息）
    create_test_image(
        output_path / "SH002_20260501_153000.jpg",
        store_code="SH002",
        checkpoint=None,
        photo_time=base_time + timedelta(minutes=60),
        add_exif=True
    )
    
    # ==================== SH002 部分照片（用于测试缺拍） ====================
    print("\n=== 生成 SH002 部分照片 ===")
    
    # 只有入口和收银台，其他点位缺拍
    create_test_image(
        output_path / "SH002_20260501_160000_入口.jpg",
        store_code="SH002",
        checkpoint="入口",
        photo_time=datetime(2026, 5, 1, 16, 0, 0),
        add_exif=True
    )
    
    create_test_image(
        output_path / "SH002_20260501_160500_收银台.jpg",
        store_code="SH002",
        checkpoint="收银台",
        photo_time=datetime(2026, 5, 1, 16, 5, 0),
        add_exif=True
    )
    
    # ==================== 同名冲突测试 ====================
    print("\n=== 生成同名冲突测试照片 ===")
    
    # 创建两张相同名称模式但内容不同的照片
    create_test_image(
        output_path / "SH001_20260501_仓库_v1.jpg",
        store_code="SH001",
        checkpoint="仓库",
        photo_time=base_time + timedelta(minutes=40),
        add_exif=True
    )
    
    # 复制后修改（模拟同名但不同内容）
    src = output_path / "SH001_20260501_仓库_v1.jpg"
    dst = output_path / "SH001_20260501_仓库_v2.jpg"
    
    # 修改图片内容
    img = Image.open(src)
    draw = ImageDraw.Draw(img)
    draw.text((400, 300), "修改后的图片", fill=(255, 0, 0))
    img.save(dst, "JPEG", quality=85)
    print(f"创建冲突图片: {dst}")
    
    print(f"\n=== 完成！共生成测试照片到: {output_path.absolute()} ===")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="生成测试照片")
    parser.add_argument("--output", "-o", default="test_photos", help="输出目录")
    
    args = parser.parse_args()
    
    try:
        generate_test_photos(args.output)
    except ImportError as e:
        print(f"缺少依赖库: {e}")
        print("请安装: pip install Pillow piexif")
        exit(1)
