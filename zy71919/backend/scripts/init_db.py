#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, engine
from app.models import models


def init_database():
    print("正在创建数据库表...")

    Base.metadata.create_all(bind=engine)

    print("数据库表创建完成!")
    print("已创建以下表:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - {table_name}")


if __name__ == "__main__":
    init_database()
