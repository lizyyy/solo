#!/usr/bin/env python3
"""
生成示例数据用于测试"扫描交付质检台"应用

此脚本会创建：
1. 一个示例扫描目录，包含测试图片
2. 一个索引CSV文件
3. 模拟一些常见问题（缺页、重复、低分辨率等）
"""

import os
import csv
import random
from PIL import Image, ImageDraw, ImageFont


def create_test_image(filepath: str, width: int = 2480, height: int = 3508, 
                       text: str = "", is_blank: bool = False, dpi: int = 300):
    """创建一个测试用的图片"""
    
    if is_blank:
        img = Image.new('RGB', (width, height), color='white')
    else:
        img = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 100)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf", 100)
            except:
                font = ImageFont.load_default()
        
        draw.text((width//2 - 200, height//2 - 50), text, fill='black', font=font)
        
        draw.line([(100, 100), (width-100, 100)], fill='black', width=3)
        draw.line([(100, height-100), (width-100, height-100)], fill='black', width=3)
        draw.rectangle([(100, 100), (width-100, height-100)], outline='black', width=2)
    
    img.save(filepath, dpi=(dpi, dpi))


def generate_sample_data(output_dir: str = None):
    """生成完整的示例数据"""
    
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), 'sample_scan')
    
    os.makedirs(output_dir, exist_ok=True)
    
    index_records = []
    
    case_numbers = ['2024001', '2024002', '2024003']
    
    for case_idx, case_num in enumerate(case_numbers):
        box_num = case_idx + 1
        
        page_count = random.randint(5, 8)
        
        for page_num in range(1, page_count + 1):
            if case_num == '2024001' and page_num == 4:
                continue
            
            if case_num == '2024002' and page_num == 3:
                for dup in range(2):
                    filename = f"盒{box_num}_案{case_num}_{page_num}"
                    if dup > 0:
                        filename += f"_dup{dup}"
                    filename += ".jpg"
                    
                    filepath = os.path.join(output_dir, filename)
                    create_test_image(
                        filepath,
                        text=f"盒{box_num}\n案{case_num}\n第{page_num}页",
                        dpi=300
                    )
                continue
            
            if case_num == '2024003' and page_num == 2:
                filename = f"盒{box_num}_案{case_num}_{page_num}_lowres.jpg"
                filepath = os.path.join(output_dir, filename)
                create_test_image(
                    filepath,
                    width=800,
                    height=1132,
                    text=f"盒{box_num}\n案{case_num}\n第{page_num}页\n(低分辨率)",
                    dpi=72
                )
            elif case_num == '2024003' and page_num == 5:
                filename = f"盒{box_num}_案{case_num}_{page_num}_blank.jpg"
                filepath = os.path.join(output_dir, filename)
                create_test_image(
                    filepath,
                    text="",
                    is_blank=True,
                    dpi=300
                )
            elif case_num == '2024003' and page_num == 6:
                filename = f"盒{box_num}_案{case_num}_{page_num}_landscape.jpg"
                filepath = os.path.join(output_dir, filename)
                create_test_image(
                    filepath,
                    width=3508,
                    height=2480,
                    text=f"盒{box_num}\n案{case_num}\n第{page_num}页\n(横版)",
                    dpi=300
                )
            else:
                filename = f"盒{box_num}_案{case_num}_{page_num}.jpg"
                filepath = os.path.join(output_dir, filename)
                create_test_image(
                    filepath,
                    text=f"盒{box_num}\n案{case_num}\n第{page_num}页",
                    dpi=300
                )
            
            index_records.append({
                '盒号': box_num,
                '案卷号': case_num,
                '页码': page_num,
                '文件名': f"盒{box_num}_案{case_num}_{page_num}.jpg"
            })
    
    extra_filename = "盒1_案2024004_1_extra.jpg"
    extra_filepath = os.path.join(output_dir, extra_filename)
    create_test_image(
        extra_filepath,
        text="盒1\n案2024004\n第1页\n(未在索引中)",
        dpi=300
    )
    
    csv_path = os.path.join(output_dir, 'index.csv')
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['盒号', '案卷号', '页码', '文件名'])
        writer.writeheader()
        writer.writerows(index_records)
    
    print(f"示例数据已生成到: {output_dir}")
    print(f"扫描目录: {output_dir}")
    print(f"索引CSV: {csv_path}")
    print(f"文件数量: {len([f for f in os.listdir(output_dir) if f.endswith('.jpg')])}")
    print(f"索引记录数: {len(index_records)}")
    print("\n模拟的问题:")
    print("  - 案卷号 2024001: 缺少第4页 (缺页)")
    print("  - 案卷号 2024002: 第3页有2个文件 (重复)")
    print("  - 案卷号 2024003: 第2页分辨率较低 (72 DPI)")
    print("  - 案卷号 2024003: 第5页是空白页")
    print("  - 案卷号 2024003: 第6页是横版 (方向不一致)")
    print("  - 存在额外文件: 盒1_案2024004_1_extra.jpg (索引中未登记)")
    
    return output_dir, csv_path


if __name__ == '__main__':
    generate_sample_data()
