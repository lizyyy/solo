#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.models import User, UserRole
from app.core.security import get_password_hash


def init_database():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="系统管理员",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("创建管理员用户: admin / admin123")
        else:
            print("管理员用户已存在")
        
        qc_user = db.query(User).filter(User.username == "qc_operator").first()
        if not qc_user:
            qc_user = User(
                username="qc_operator",
                hashed_password=get_password_hash("qc123456"),
                full_name="品控操作员",
                role=UserRole.QC_OPERATOR,
                is_active=True
            )
            db.add(qc_user)
            db.commit()
            print("创建品控操作员用户: qc_operator / qc123456")
        else:
            print("品控操作员用户已存在")
            
    except Exception as e:
        print(f"初始化数据库失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
