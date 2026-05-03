#!/usr/bin/env python3
"""
示例数据生成器
用于生成测试用的订单、状态、照片和STL文件
"""

import csv
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any

SAMPLE_DATA_DIR = Path(__file__).resolve().parent


def generate_orders_csv() -> List[Dict[str, Any]]:
    """生成订单CSV数据"""
    orders = [
        {
            "订单编号": "ORD2024001",
            "模型编号": "MDL001",
            "医生姓名": "张医生",
            "患者姓名": "张三",
            "患者性别": "男",
            "患者年龄": "45",
            "牙位": "#11-#12",
            "修复类型": "烤瓷冠",
            "订单日期": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
            "备注": "左上切牙",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024002",
            "模型编号": "MDL002",
            "医生姓名": "李医生",
            "患者姓名": "李四",
            "患者性别": "女",
            "患者年龄": "38",
            "牙位": "#14-#15",
            "修复类型": "全瓷冠",
            "订单日期": (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d"),
            "备注": "右上后牙",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024003",
            "模型编号": "MDL003",
            "医生姓名": "王医生",
            "患者姓名": "王五",
            "患者性别": "男",
            "患者年龄": "52",
            "牙位": "#35-#36",
            "修复类型": "金属支架",
            "订单日期": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            "备注": "左下大牙",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024004",
            "模型编号": "MDL004",
            "医生姓名": "张医生",
            "患者姓名": "赵六",
            "患者性别": "女",
            "患者年龄": "60",
            "牙位": "#16-#17",
            "修复类型": "全瓷冠",
            "订单日期": (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d"),
            "备注": "右上智齿区",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024005",
            "模型编号": "MDL005",
            "医生姓名": "李医生",
            "患者姓名": "孙七",
            "患者性别": "男",
            "患者年龄": "28",
            "牙位": "#21-#22",
            "修复类型": "贴面",
            "订单日期": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
            "备注": "前牙美容",
            "加急": "是"
        },
        {
            "订单编号": "ORD2024006",
            "模型编号": "MDL006",
            "医生姓名": "王医生",
            "患者姓名": "周八",
            "患者性别": "女",
            "患者年龄": "42",
            "牙位": "#45-#46",
            "修复类型": "活动义齿",
            "订单日期": (datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d"),
            "备注": "右下缺牙",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024007",
            "模型编号": "MDL007",
            "医生姓名": "张医生",
            "患者姓名": "吴九",
            "患者性别": "男",
            "患者年龄": "55",
            "牙位": "#11-#21",
            "修复类型": "固定桥",
            "订单日期": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
            "备注": "上门牙缺失",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024008",
            "模型编号": "MDL008",
            "医生姓名": "李医生",
            "患者姓名": "郑十",
            "患者性别": "女",
            "患者年龄": "35",
            "牙位": "#36-#37",
            "修复类型": "种植牙冠",
            "订单日期": datetime.now().strftime("%Y-%m-%d"),
            "备注": "左下种植",
            "加急": "是"
        }
    ]
    return orders


def generate_status_csv() -> List[Dict[str, Any]]:
    """生成状态CSV数据"""
    today = datetime.now()
    statuses = [
        {
            "订单编号": "ORD2024001",
            "模型编号": "MDL001",
            "当前状态": "加工中",
            "接收日期": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
            "预期交付日期": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "张工",
            "返工次数": "0",
            "返工原因1": "",
            "返工日期1": "",
            "返工解决方案1": "",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024002",
            "模型编号": "MDL002",
            "当前状态": "待返工",
            "接收日期": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
            "预期交付日期": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "李工",
            "返工次数": "1",
            "返工原因1": "咬合过高",
            "返工日期1": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "返工解决方案1": "调磨咬合",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024003",
            "模型编号": "MDL003",
            "当前状态": "待检验",
            "接收日期": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            "预期交付日期": today.strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "王工",
            "返工次数": "0",
            "返工原因1": "",
            "返工日期1": "",
            "返工解决方案1": "",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024004",
            "模型编号": "MDL004",
            "当前状态": "返工中",
            "接收日期": (today - timedelta(days=6)).strftime("%Y-%m-%d"),
            "预期交付日期": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "张工",
            "返工次数": "2",
            "返工原因1": "边缘不密合",
            "返工日期1": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            "返工解决方案1": "重新制作",
            "返工原因2": "颜色偏差",
            "返工日期2": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
            "返工解决方案2": "重新比色",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024005",
            "模型编号": "MDL005",
            "当前状态": "已完成",
            "接收日期": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "预期交付日期": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "实际交付日期": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "负责人": "李工",
            "返工次数": "0",
            "返工原因1": "",
            "返工日期1": "",
            "返工解决方案1": "",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "是"
        },
        {
            "订单编号": "ORD2024006",
            "模型编号": "MDL006",
            "当前状态": "超期",
            "接收日期": (today - timedelta(days=8)).strftime("%Y-%m-%d"),
            "预期交付日期": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "王工",
            "返工次数": "3",
            "返工原因1": "模型变形",
            "返工日期1": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
            "返工解决方案1": "重新取模",
            "返工原因2": "咬合不对",
            "返工日期2": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
            "返工解决方案2": "重新上架",
            "返工原因3": "颜色不对",
            "返工日期3": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
            "返工解决方案3": "重新比色",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024007",
            "模型编号": "MDL007",
            "当前状态": "加工中",
            "接收日期": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
            "预期交付日期": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "张工",
            "返工次数": "0",
            "返工原因1": "",
            "返工日期1": "",
            "返工解决方案1": "",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "否"
        },
        {
            "订单编号": "ORD2024008",
            "模型编号": "MDL008",
            "当前状态": "待接收",
            "接收日期": today.strftime("%Y-%m-%d"),
            "预期交付日期": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
            "实际交付日期": "",
            "负责人": "李工",
            "返工次数": "0",
            "返工原因1": "",
            "返工日期1": "",
            "返工解决方案1": "",
            "返工原因2": "",
            "返工日期2": "",
            "返工解决方案2": "",
            "加急": "是"
        }
    ]
    return statuses


def write_csv(file_path: Path, data: List[Dict[str, Any]]):
    """写入CSV文件"""
    if not data:
        return
    
    fieldnames = list(data[0].keys())
    
    with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    
    print(f"已生成: {file_path}")


def generate_sample_stl(file_path: Path, model_id: str, jaw: str = "upper"):
    """生成简单的STL示例文件"""
    height = 1.0 if jaw == "upper" else -0.5
    normal_z = 1.0 if jaw == "upper" else -1.0
    
    stl_content = f"""solid {model_id}_{jaw}
facet normal 0.0 0.0 {normal_z}
  outer loop
    vertex 0.0 0.0 0.0
    vertex 1.0 0.0 0.0
    vertex 0.5 0.5 {height}
  endloop
endfacet
facet normal 0.0 0.0 {normal_z}
  outer loop
    vertex 1.0 0.0 0.0
    vertex 1.0 1.0 0.0
    vertex 0.5 0.5 {height}
  endloop
endfacet
facet normal 0.0 0.0 {normal_z}
  outer loop
    vertex 1.0 1.0 0.0
    vertex 0.0 1.0 0.0
    vertex 0.5 0.5 {height}
  endloop
endfacet
facet normal 0.0 0.0 {normal_z}
  outer loop
    vertex 0.0 1.0 0.0
    vertex 0.0 0.0 0.0
    vertex 0.5 0.5 {height}
  endloop
endfacet
endsolid {model_id}_{jaw}
"""
    
    with open(file_path, 'w') as f:
        f.write(stl_content)
    
    print(f"已生成: {file_path}")


def generate_sample_photo(file_path: Path, model_id: str, photo_type: str):
    """生成简单的照片占位文件"""
    content = f"""示例照片占位文件 - {model_id} {photo_type}

这是一个占位文件，实际使用时请替换为真实的患者取模照片。

文件名格式说明：
- {model_id}: 模型编号
- {photo_type}: 照片类型

支持的照片类型：
- 咬合关系（必需）
- 模型正面（必需）
- 模型侧面（必需）
- 模型咬合面（必需）
"""
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"已生成: {file_path}")


def main():
    """主函数"""
    print("=" * 50)
    print("示例数据生成器")
    print("=" * 50)
    
    os.makedirs(SAMPLE_DATA_DIR, exist_ok=True)
    os.makedirs(SAMPLE_DATA_DIR / "photos", exist_ok=True)
    os.makedirs(SAMPLE_DATA_DIR / "stl", exist_ok=True)
    
    print("\n[1/4] 生成订单CSV...")
    orders = generate_orders_csv()
    write_csv(SAMPLE_DATA_DIR / "orders.csv", orders)
    
    print("\n[2/4] 生成状态CSV...")
    statuses = generate_status_csv()
    write_csv(SAMPLE_DATA_DIR / "status.csv", statuses)
    
    print("\n[3/4] 生成示例STL文件...")
    sample_models = ["MDL001", "MDL002", "MDL003"]
    for model_id in sample_models:
        generate_sample_stl(SAMPLE_DATA_DIR / "stl" / f"{model_id}_upper.stl", model_id, "upper")
        if model_id != "MDL002":
            generate_sample_stl(SAMPLE_DATA_DIR / "stl" / f"{model_id}_lower.stl", model_id, "lower")
    
    print("\n[4/4] 生成示例照片文件...")
    photo_types = ["咬合关系", "模型正面", "模型侧面", "模型咬合面"]
    for model_id in sample_models:
        for photo_type in photo_types:
            if model_id == "MDL002" and photo_type == "咬合关系":
                continue
            generate_sample_photo(
                SAMPLE_DATA_DIR / "photos" / f"{model_id}_{photo_type}.jpg",
                model_id,
                photo_type
            )
    
    print("\n" + "=" * 50)
    print("示例数据生成完成！")
    print("=" * 50)
    print(f"\n文件位置: {SAMPLE_DATA_DIR}")
    print("\n测试场景说明：")
    print("1. MDL002 缺少 咬合关系 照片 → 测试照片缺失检查")
    print("2. MDL002 缺少 lower (下颌) STL文件 → 测试STL缺失检查")
    print("3. ORD2024002 待返工状态，有1次返工记录 → 测试返工状态检查")
    print("4. ORD2024004 返工中状态，有2次返工记录 → 测试多次返工检查")
    print("5. ORD2024006 超期状态，有3次返工记录 → 测试超期和返工次数限制检查")
    print("6. ORD2024005、ORD2024008 加急订单 → 测试加急订单提醒")


if __name__ == "__main__":
    main()
