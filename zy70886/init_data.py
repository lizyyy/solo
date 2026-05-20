import os
import sys
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.services import ImportService

def init_database():
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成")

def import_sample_data():
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        service = ImportService(db)

        app_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'applications.csv')
        count, errors = service.import_contract_applications_from_csv(app_path)
        print(f"导入合同申请: {count} 条, 错误: {len(errors)}")

        stamp_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'stamps.json')
        count, errors = service.import_stamp_records_from_json(stamp_path)
        print(f"导入盖章记录: {count} 条, 错误: {len(errors)}")

        approval_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'approvals.json')
        count, errors = service.import_approval_records_from_json(approval_path)
        print(f"导入审批记录: {count} 条, 错误: {len(errors)}")

        express_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'express.csv')
        count, errors = service.import_express_records_from_csv(express_path)
        print(f"导入快递记录: {count} 条, 错误: {len(errors)}")

        print("示例数据导入完成")
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
    import_sample_data()
