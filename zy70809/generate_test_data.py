#!/usr/bin/env python3
import pandas as pd
from datetime import datetime, timedelta

def generate_test_data():
    today = datetime.now().date()
    
    equipment_data = {
        "设备编号": ["MHQ001", "MHQ002", "MHQ003", "MHQ004", "MHQ005", "MHQ006"],
        "设备名称": ["灭火器-A区", "喷淋系统-1楼", "报警主机-主楼", "灭火器-B区", "喷淋系统-2楼", "灭火器-C区"],
        "设备类型": ["灭火器", "喷淋", "报警主机", "灭火器", "喷淋", "灭火器"],
        "位置": ["A区1楼", "1楼走廊", "主楼控制室", "B区2楼", "2楼走廊", "C区3楼"],
        "上次维保日期": [
            today - timedelta(days=90),
            today - timedelta(days=60),
            today - timedelta(days=30),
            today - timedelta(days=120),
            today - timedelta(days=10),
            today - timedelta(days=45)
        ],
        "下次维保日期": [
            today - timedelta(days=5),   # 已过期
            today + timedelta(days=30),
            today + timedelta(days=60),
            today - timedelta(days=15),  # 已过期
            today + timedelta(days=15),
            today + timedelta(days=45)
        ],
        "维保公司": ["安维保A", "保B", "维保C", "维保A", "维保B", "维保C"]
    }
    
    photo_data = {
        "设备编号": ["MHQ001", "MHQ002", "MHQ003", "MHQ003"],
        "照片名称": ["灭火器A区照片1.jpg", "喷淋1楼照片1.jpg", "报警主机照片1.jpg", "报警主机照片2.jpg"],
        "照片路径": ["/photos/mhq001_1.jpg", "/photos/mhq002_1.jpg", "/photos/mhq003_1.jpg", "/photos/mhq003_2.jpg"],
        "上传日期": [today - timedelta(days=5), today - timedelta(days=3), today - timedelta(days=1), today - timedelta(days=1)],
        "巡检人": ["张三", "李四", "王五", "王五"]
    }
    
    contract_data = {
        "合同编号": ["HT2024001", "HT2024002", "HT2024003", "HT2024004"],
        "设备编号": ["MHQ001", "MHQ002", "MHQ003", "MHQ003"],
        "乙方": ["维保A公司", "维保B公司", "维保C公司", "维保A公司"],
        "开始日期": [today - timedelta(days=180), today - timedelta(days=150), today - timedelta(days=120), today - timedelta(days=90)],
        "结束日期": [today + timedelta(days=180), today + timedelta(days=210), today + timedelta(days=240), today + timedelta(days=270)],
        "合同金额": ["5000", "8000", "12000", "6000"]
    }
    
    df_equipment = pd.DataFrame(equipment_data)
    df_equipment.to_excel("test_equipment.xlsx", index=False)
    print("已生成 test_equipment.xlsx")
    
    df_photo = pd.DataFrame(photo_data)
    df_photo.to_excel("test_photos.xlsx", index=False)
    print("已生成 test_photos.xlsx")
    
    df_contract = pd.DataFrame(contract_data)
    df_contract.to_excel("test_contracts.xlsx", index=False)
    print("已生成 test_contracts.xlsx")
    
    print("\n预期校验结果预测:")
    print("- MHQ001: 维保过期 (失败)")
    print("- MHQ002: 正常，但缺少照片 (失败)")
    print("- MHQ003: 多合同冲突 (待确认)")
    print("- MHQ004: 维保过期 + 缺少照片 (失败)")
    print("- MHQ005: 正常，但缺少照片 (失败)")
    print("- MHQ006: 正常，但缺少照片 (失败)")

if __name__ == "__main__":
    generate_test_data()
