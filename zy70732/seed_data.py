from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, TrialStatus, SourceType, FeaturePackage
from services import TrialService

DATABASE_URL = "sqlite:///./trial_management.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_test_data():
    db = SessionLocal()
    service = TrialService(db)

    print("开始造数...")

    tenants = [
        ("tenant_001", "华为技术有限公司"),
        ("tenant_002", "阿里巴巴集团"),
        ("tenant_003", "腾讯科技"),
        ("tenant_004", "字节跳动"),
        ("tenant_005", "美团点评")
    ]

    trials_data = [
        {
            "tenant_id": "tenant_001",
            "feature_package": FeaturePackage.AI_ANALYTICS,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE,
            "source_id": "PRESALE_2024_001",
            "created_by": "sales_zhang",
            "tenant_name": "华为技术有限公司"
        },
        {
            "tenant_id": "tenant_001",
            "feature_package": FeaturePackage.DATA_EXPORT,
            "trial_days": 15,
            "source": SourceType.CUSTOMER_SUCCESS,
            "source_id": "CS_2024_002",
            "created_by": "csm_li",
            "tenant_name": "华为技术有限公司"
        },
        {
            "tenant_id": "tenant_002",
            "feature_package": FeaturePackage.ADVANCED_REPORT,
            "trial_days": 60,
            "source": SourceType.MARKETING_CAMPAIGN,
            "source_id": "MARKET_2024_003",
            "created_by": "marketing_wang",
            "tenant_name": "阿里巴巴集团"
        },
        {
            "tenant_id": "tenant_003",
            "feature_package": FeaturePackage.API_ACCESS,
            "trial_days": 7,
            "source": SourceType.SELF_REGISTER,
            "source_id": "SELF_2024_004",
            "created_by": "system",
            "tenant_name": "腾讯科技"
        },
        {
            "tenant_id": "tenant_004",
            "feature_package": FeaturePackage.TEAM_COLLAB,
            "trial_days": 14,
            "source": SourceType.SALES_PRESALE,
            "source_id": "PRESALE_2024_005",
            "created_by": "sales_zhao",
            "tenant_name": "字节跳动"
        }
    ]

    created_trials = []
    for data in trials_data:
        trial, is_new = service.create_trial(**data)
        created_trials.append(trial)
        status = "新建" if is_new else "已存在"
        print(f"试用记录: {trial.tenant_id} - {trial.feature_package} [{status}]")

    if created_trials:
        trial = created_trials[0]
        print(f"\n推进试用状态: {trial.id}")
        trial = service.advance_status(trial.id, "system_auto")
        print(f"新状态: {trial.status}")

        trial = service.advance_status(trial.id, "system_auto")
        print(f"新状态: {trial.status}")

        print(f"\n为试用 {trial.id} 生成快照...")
        snapshot = service.create_snapshot(trial.id, "seed_script")
        print(f"快照ID: {snapshot.id}")

        print(f"\n人工修正试用 {trial.id} 状态...")
        trial = service.correct_status(trial.id, TrialStatus.ACTIVE.value, "客户特殊申请", "admin_li")
        print(f"修正后状态: {trial.status}")

    db.commit()
    print("\n造数完成!")
    db.close()


if __name__ == "__main__":
    seed_test_data()
