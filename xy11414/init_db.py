from sqlalchemy.orm import Session
from datetime import datetime

from app.database import SessionLocal, engine, Base
from app.models import User, UserRole, SensitiveFieldConfig
from app.auth import get_password_hash


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                full_name="系统管理员",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.SUPERVISOR,
                franchise_id="HQ001"
            )
            db.add(admin)

        reviewer = db.query(User).filter(User.username == "reviewer").first()
        if not reviewer:
            reviewer = User(
                username="reviewer",
                full_name="复核员小张",
                hashed_password=get_password_hash("reviewer123"),
                role=UserRole.REVIEWER,
                franchise_id="F001"
            )
            db.add(reviewer)

        entry = db.query(User).filter(User.username == "entry").first()
        if not entry:
            entry = User(
                username="entry",
                full_name="录入员小李",
                hashed_password=get_password_hash("entry123"),
                role=UserRole.DATA_ENTRY,
                franchise_id="F001"
            )
            db.add(entry)

        readonly = db.query(User).filter(User.username == "readonly").first()
        if not readonly:
            readonly = User(
                username="readonly",
                full_name="加盟商老板",
                hashed_password=get_password_hash("readonly123"),
                role=UserRole.READ_ONLY,
                franchise_id="F001"
            )
            db.add(readonly)

        sensitive_fields = [
            {"field_name": "headquarter_price", "is_export_masked": True},
            {"field_name": "raw_data", "is_export_masked": True},
            {"field_name": "processing_notes", "is_export_masked": True},
        ]

        for sf in sensitive_fields:
            existing = db.query(SensitiveFieldConfig).filter(
                SensitiveFieldConfig.field_name == sf["field_name"]
            ).first()
            if not existing:
                db.add(SensitiveFieldConfig(**sf))

        db.commit()
        print("数据库初始化完成!")
        print("测试账号:")
        print("  主管: admin / admin123")
        print("  复核: reviewer / reviewer123")
        print("  录入: entry / entry123")
        print("  只读: readonly / readonly123")

    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
