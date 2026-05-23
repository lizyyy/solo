#!/usr/bin/env python3
"""
初始化数据库脚本
创建默认用户和样例数据
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import UserRole
from app.services.auth_service import AuthService


def init_database():
    print("正在创建数据库表...")
    Base.metadata.create_all(bind=engine)
    print("数据库表创建完成")

    db = SessionLocal()
    auth_service = AuthService(db)

    print("\n正在创建默认用户...")

    default_users = [
        {
            "username": "admin",
            "password": "admin123",
            "full_name": "系统管理员",
            "role": UserRole.ADMIN
        },
        {
            "username": "operator",
            "password": "operator123",
            "full_name": "操作员",
            "role": UserRole.OPERATOR
        },
        {
            "username": "auditor",
            "password": "auditor123",
            "full_name": "审核员",
            "role": UserRole.AUDITOR
        },
        {
            "username": "security",
            "password": "security123",
            "full_name": "安保主管",
            "role": UserRole.SECURITY_SUPERVISOR
        }
    ]

    for user_data in default_users:
        try:
            existing = auth_service.get_user(user_data["username"])
            if existing:
                print(f"  用户 {user_data['username']} 已存在，跳过")
                continue

            auth_service.create_user(
                username=user_data["username"],
                password=user_data["password"],
                full_name=user_data["full_name"],
                role=user_data["role"]
            )
            print(f"  用户 {user_data['username']} 创建成功")
        except Exception as e:
            print(f"  创建用户 {user_data['username']} 失败: {e}")

    db.close()
    print("\n初始化完成！")
    print("\n默认账号:")
    print("  admin / admin123    (系统管理员)")
    print("  operator / operator123  (操作员)")
    print("  auditor / auditor123    (审核员)")
    print("  security / security123  (安保主管)")


if __name__ == "__main__":
    init_database()
