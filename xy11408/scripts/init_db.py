#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, engine, SessionLocal
from app.models import *
from app.services import UserService


def init_database():
    print("=" * 60)
    print("初始化数据库...")
    print("=" * 60)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✓ 数据库表创建完成")

    db = SessionLocal()
    try:
        UserService.init_default_users(db)
        print("✓ 默认用户创建完成")
        print("\n默认用户列表:")
        print("  - 录入员: luruyuan / luru123 (陆茹媛)")
        print("  - 复核员: fuyipei / fuyi123 (傅贻沛)")
        print("  - 主管: guanpeixun / guan123 (管培迅)")
        print("  - 只读: chaijiehao / chai123 (柴杰昊)")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("数据库初始化完成!")
    print("=" * 60)


if __name__ == "__main__":
    init_database()
