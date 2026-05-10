#!/usr/bin/env python3
"""初始化示例数据"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from theater_conflict_cli.data_store import add_item, save_data

print("初始化基础数据（重置所有数据）...")

save_data("bookings", [])
print("✓ 已清空预约数据")

save_data("reschedule_history", [])
print("✓ 已清空改期历史")

save_data("key_records", [])
print("✓ 已清空钥匙记录")

save_data("rooms", [
    {"id": "r001", "name": "一号排练厅", "capacity": 50, "features": ["舞台", "音响系统"]},
    {"id": "r002", "name": "二号排练厅", "capacity": 30, "features": ["小舞台", "钢琴"]},
    {"id": "r003", "name": "三号排练厅", "capacity": 20, "features": ["镜子墙", "芭蕾把杆"]},
])
print("✓ 已创建 3 个排练厅")

save_data("equipment", [
    {"id": "e001", "name": "灯光设备包", "description": "专业舞台灯光系统", "available": True},
    {"id": "e002", "name": "音响设备包", "description": "无线麦+调音台", "available": True},
    {"id": "e003", "name": "多媒体设备包", "description": "投影+视频系统", "available": True},
])
print("✓ 已创建 3 个设备包")

save_data("contacts", [
    {"id": "c001", "name": "周导演", "crew_name": "《雷雨》剧组", "phone": "13800000001", "email": "zhou@theater.com"},
    {"id": "c002", "name": "李制片", "crew_name": "《茶馆》剧组", "phone": "13800000002", "email": "li@theater.com"},
    {"id": "c003", "name": "王副导", "crew_name": "《暗恋桃花源》剧组", "phone": "13800000003", "email": "wang@theater.com"},
    {"id": "c004", "name": "张场记", "crew_name": "《日出》剧组", "phone": "13800000004", "email": "zhang@theater.com"},
])
print("✓ 已创建 4 个剧组联系人")

print("\n初始化完成！")
print("\n下一步:")
print("  python3 theater-cli import demo_data.json  # 导入示例预约")
print("  python3 theater-cli check                   # 检查冲突")
