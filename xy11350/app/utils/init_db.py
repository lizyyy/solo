from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.config.database import engine, Base
from app.models.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_db():
    Base.metadata.create_all(bind=engine)
    
    db = Session(bind=engine)
    
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@example.com",
                hashed_password=pwd_context.hash("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin)
        
        quality_user = db.query(User).filter(User.username == "quality").first()
        if not quality_user:
            quality_user = User(
                username="quality",
                email="quality@example.com",
                hashed_password=pwd_context.hash("quality123"),
                role="quality_control",
                is_active=True
            )
            db.add(quality_user)
        
        operator = db.query(User).filter(User.username == "operator").first()
        if not operator:
            operator = User(
                username="operator",
                email="operator@example.com",
                hashed_password=pwd_context.hash("operator123"),
                role="operator",
                is_active=True
            )
            db.add(operator)
        
        db.commit()
        print("数据库初始化完成！")
        print("默认用户已创建:")
        print("  - admin / admin123 (管理员)")
        print("  - quality / quality123 (品控人员)")
        print("  - operator / operator123 (操作员)")
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
