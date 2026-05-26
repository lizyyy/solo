#!/usr/bin/env python3
"""数据库初始化脚本 - 创建所有表"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db


def init_db():
    with app.app_context():
        db.create_all()
        print("数据库表创建成功!")

        from models import Batch, RawMaterial, QualityCheckRecord, ProcessLog, WriteBackTask
        tables = [Batch, RawMaterial, QualityCheckRecord, ProcessLog, WriteBackTask]
        for table in tables:
            count = db.session.query(table).count()
            print(f"  {table.__tablename__}: {count} 条记录")


if __name__ == '__main__':
    init_db()
