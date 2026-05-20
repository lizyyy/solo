from app.database import SessionLocal, engine, Base
from app.models import User, SampleTask


def init_db():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    existing_user = db.query(User).filter(User.username == "admin").first()
    if not existing_user:
        user = User(
            username="admin",
            full_name="样品管理员",
            email="admin@example.com",
            hashed_password="fake_hash_for_testing"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ 创建测试用户: admin (ID: {user.id})")
    else:
        print(f"ℹ️ 用户已存在: admin (ID: {existing_user.id})")
    
    task_count = db.query(SampleTask).count()
    print(f"ℹ️ 当前任务数量: {task_count}")
    
    db.close()
    print("✅ 数据库初始化完成")


if __name__ == "__main__":
    init_db()
