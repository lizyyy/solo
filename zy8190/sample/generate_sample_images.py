#!/usr/bin/env python3
"""
生成样例测试图片
"""

import os
import cv2
import numpy as np
from pathlib import Path


def generate_test_image(width: int, height: int, camera_id: str, 
                         output_path: str, add_pattern: bool = True):
    """生成测试图片"""
    
    # 创建灰色背景
    image = np.ones((height, width, 3), dtype=np.uint8) * 200
    
    if add_pattern:
        # 添加一些模拟的场景元素
        # 绘制地板
        floor_y = int(height * 0.7)
        cv2.rectangle(image, (0, floor_y), (width, height), (150, 130, 100), -1)
        
        # 绘制工作台
        table_x1 = int(width * 0.1)
        table_x2 = int(width * 0.4)
        table_y1 = int(height * 0.3)
        table_y2 = int(height * 0.6)
        cv2.rectangle(image, (table_x1, table_y1), (table_x2, table_y2), (180, 160, 120), -1)
        cv2.rectangle(image, (table_x1, table_y1), (table_x2, table_y2), (100, 80, 60), 3)
        
        # 绘制另一个工作台
        table2_x1 = int(width * 0.5)
        table2_x2 = int(width * 0.9)
        table2_y1 = int(height * 0.2)
        table2_y2 = int(height * 0.5)
        cv2.rectangle(image, (table2_x1, table2_y1), (table2_x2, table2_y2), (180, 160, 120), -1)
        cv2.rectangle(image, (table2_x1, table2_y1), (table2_x2, table2_y2), (100, 80, 60), 3)
        
        # 绘制模拟的人物轮廓
        # 工作台1旁边
        person1_x = int(width * 0.05)
        person1_y = int(height * 0.4)
        cv2.circle(image, (person1_x + 30, person1_y), 25, (120, 100, 80), -1)
        cv2.ellipse(image, (person1_x + 30, person1_y + 60), (30, 50), 0, 0, 360, (100, 80, 160), -1)
        
        # 工作台2旁边
        person2_x = int(width * 0.95)
        person2_y = int(height * 0.35)
        cv2.circle(image, (person2_x - 30, person2_y), 25, (120, 100, 80), -1)
        cv2.ellipse(image, (person2_x - 30, person2_y + 60), (30, 50), 0, 0, 360, (80, 120, 160), -1)
    
    # 添加相机ID文字
    font = cv2.FONT_HERSHEY_SIMPLEX
    text = f"Camera: {camera_id} | {width}x{height}"
    cv2.putText(image, text, (20, 50), font, 1, (0, 0, 0), 2, cv2.LINE_AA)
    
    # 添加时间戳
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(image, timestamp, (20, height - 20), font, 0.6, (0, 0, 0), 1, cv2.LINE_AA)
    
    # 保存图片
    cv2.imwrite(output_path, image)
    print(f"生成图片: {output_path}")


def main():
    """主函数"""
    script_dir = Path(__file__).parent
    frames_dir = script_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成 cam_001 (1920x1080)
    generate_test_image(
        1920, 1080, "cam_001",
        str(frames_dir / "cam_001_20240101_080000.jpg")
    )
    
    # 生成 cam_002 (1920x1080)
    generate_test_image(
        1920, 1080, "cam_002",
        str(frames_dir / "cam_002_20240101_080000.jpg")
    )
    
    # 生成 cam_003 (1280x720) - 注意：相机配置是 1280x720
    generate_test_image(
        1280, 720, "cam_003",
        str(frames_dir / "cam_003_20240101_080000.jpg")
    )
    
    # 生成 cam_004 但使用不同分辨率 (1280x720) - 用于测试分辨率不匹配
    # 注意：相机配置是 1920x1080，但图片是 1280x720
    generate_test_image(
        1280, 720, "cam_004 (1280x720 vs config 1920x1080)",
        str(frames_dir / "cam_004_20240101_080000.jpg")
    )
    
    print(f"\n所有样例图片已生成到: {frames_dir}")


if __name__ == '__main__':
    main()
