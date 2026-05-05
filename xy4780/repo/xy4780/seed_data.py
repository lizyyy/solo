from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import Base, User
from app.config import UserRole, settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_users():
    db = SessionLocal()
    try:
        existing_users = db.query(User).all()
        if existing_users:
            print("用户数据已存在，跳过种子数据插入")
            return

        users = [
            User(
                username="researcher1",
                name="张三",
                role=UserRole.RESEARCHER,
                department="心内科"
            ),
            User(
                username="researcher2",
                name="李四",
                role=UserRole.RESEARCHER,
                department="神经内科"
            ),
            User(
                username="ethics1",
                name="王伦理",
                role=UserRole.ETHICS_COMMITTEE,
                department="伦理委员会"
            ),
            User(
                username="ethics2",
                name="赵审核",
                role=UserRole.ETHICS_COMMITTEE,
                department="伦理委员会"
            ),
            User(
                username="dataman1",
                name="钱数据",
                role=UserRole.DATA_MANAGER,
                department="数据中心"
            ),
            User(
                username="dataman2",
                name="孙管理",
                role=UserRole.DATA_MANAGER,
                department="数据中心"
            ),
            User(
                username="admin1",
                name="周主任",
                role=UserRole.ADMIN,
                department="科研办"
            ),
        ]

        for user in users:
            db.add(user)

        db.commit()
        print(f"成功插入 {len(users)} 条用户种子数据:")
        for user in db.query(User).all():
            print(f"  - ID: {user.id}, 用户名: {user.username}, 姓名: {user.name}, 角色: {user.role.value}")

    except Exception as e:
        print(f"插入种子数据失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_users()
