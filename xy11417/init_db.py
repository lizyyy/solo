from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.core.config import UserRole
from app.models import User

def init_database():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")
    
    db = SessionLocal()
    try:
        users_to_create = [
            {
                "username": "admin",
                "password": "admin123",
                "email": "admin@example.com",
                "full_name": "系统管理员",
                "role": UserRole.MANAGER,
                "department": "信息技术部"
            },
            {
                "username": "reviewer",
                "password": "reviewer123",
                "email": "reviewer@example.com",
                "full_name": "复核员张三",
                "role": UserRole.REVIEWER,
                "department": "物业服务部"
            },
            {
                "username": "data_entry",
                "password": "data123",
                "email": "data_entry@example.com",
                "full_name": "录入员李四",
                "role": UserRole.DATA_ENTRY,
                "department": "客户服务部"
            },
            {
                "username": "readonly",
                "password": "read123",
                "email": "readonly@example.com",
                "full_name": "查看员王五",
                "role": UserRole.READ_ONLY,
                "department": "质量监督部"
            }
        ]
        
        for user_data in users_to_create:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing:
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"].value,
                    department=user_data["department"],
                    is_active=True
                )
                db.add(user)
                print(f"Created user: {user_data['username']} with role: {user_data['role'].value}")
            else:
                print(f"User {user_data['username']} already exists, skipping")
        
        db.commit()
        print("Initial users created successfully")
        
    except Exception as e:
        db.rollback()
        print(f"Error creating users: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
