#!/usr/bin/env python3
from app.database import SessionLocal, engine, Base
from app.models import User, UserRole
from app.auth import get_password_hash

Base.metadata.create_all(bind=engine)

db = SessionLocal()

default_users = [
    {
        "username": "admin",
        "password": "admin123",
        "role": UserRole.SUPERVISOR,
        "full_name": "系统管理员"
    },
    {
        "username": "entry",
        "password": "entry123",
        "role": UserRole.DATA_ENTRY,
        "full_name": "数据录入员"
    },
    {
        "username": "reviewer",
        "password": "review123",
        "role": UserRole.REVIEWER,
        "full_name": "复核员"
    },
    {
        "username": "viewer",
        "password": "view123",
        "role": UserRole.READ_ONLY,
        "full_name": "只读用户"
    }
]

for user_data in default_users:
    existing = db.query(User).filter(User.username == user_data["username"]).first()
    if not existing:
        hashed_pw = get_password_hash(user_data["password"])
        db_user = User(
            username=user_data["username"],
            hashed_password=hashed_pw,
            role=user_data["role"],
            full_name=user_data["full_name"]
        )
        db.add(db_user)
        print(f"创建用户: {user_data['username']} ({user_data['role'].value})")
    else:
        print(f"用户已存在: {user_data['username']}")

db.commit()
db.close()

print("\n数据库初始化完成！")
print("\n默认账号:")
print("  主管(admin):      admin / admin123")
print("  录入员(entry):    entry / entry123")
print("  复核员(reviewer): reviewer / review123")
print("  只读(viewer):     viewer / view123")
