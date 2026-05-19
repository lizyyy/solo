#!/usr/bin/env python3
"""
数据库初始化脚本
"""
from app.core.database import init_db, get_db
from app.models import Elderly, Menu
from datetime import date, timedelta


def create_sample_data():
    """创建示例数据"""
    db = next(get_db())
    
    print("正在创建示例数据...")
    
    elderly_list = [
        {
            "name": "张爷爷",
            "gender": "男",
            "age": 78,
            "phone": "13800138001",
            "dietary_restrictions": ["低盐"],
            "chronic_diseases": ["高血压"],
            "delivery_route": "A区",
            "delivery_sequence": 1,
            "room_number": "A-101"
        },
        {
            "name": "李奶奶",
            "gender": "女",
            "age": 72,
            "phone": "13800138002",
            "dietary_restrictions": ["低糖", "无糖"],
            "chronic_diseases": ["糖尿病"],
            "delivery_route": "A区",
            "delivery_sequence": 2,
            "room_number": "A-102"
        },
        {
            "name": "王爷爷",
            "gender": "男",
            "age": 80,
            "phone": "13800138003",
            "dietary_restrictions": ["软食"],
            "chronic_diseases": [],
            "delivery_route": "B区",
            "delivery_sequence": 1,
            "room_number": "B-201"
        },
        {
            "name": "赵奶奶",
            "gender": "女",
            "age": 75,
            "phone": "13800138004",
            "dietary_restrictions": ["海鲜禁忌"],
            "chronic_diseases": [],
            "delivery_route": "B区",
            "delivery_sequence": 2,
            "room_number": "B-202"
        }
    ]
    
    for data in elderly_list:
        elderly = Elderly(**data)
        db.add(elderly)
    
    tomorrow = date.today() + timedelta(days=1)
    menu = Menu(
        menu_date=tomorrow,
        breakfast=["小米粥", "馒头", "煮鸡蛋", "咸菜"],
        lunch=["米饭", "红烧肉", "炒青菜", "番茄蛋汤"],
        dinner=["面条", "包子", "凉拌黄瓜"]
    )
    db.add(menu)
    
    db.commit()
    
    print(f"已创建 {len(elderly_list)} 位老人信息")
    print(f"已创建 {tomorrow} 的菜单")
    print("数据库初始化完成！")


if __name__ == "__main__":
    init_db()
    create_sample_data()
