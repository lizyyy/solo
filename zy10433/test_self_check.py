import pytest
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os

import database
import services
import schemas


@pytest.fixture(scope="function")
def db_session():
    db_path = "test_api_change_subscription.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    
    database.SQLALCHEMY_DATABASE_URL = f"sqlite:///./{db_path}"
    database.engine = database.create_engine(
        database.SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    database.SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)
    
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()
        if os.path.exists(db_path):
            os.remove(db_path)


def setup_test_data(db: Session):
    ct = services.create_change_type(db, schemas.ChangeTypeCreate(
        code="TEST_BREAKING",
        name="测试破坏性变更",
        severity="high"
    ))
    
    subscriber = services.create_subscriber(db, schemas.SubscriberCreate(
        name="测试团队",
        email="test@example.com",
        description="测试用"
    ))
    
    api_path = services.create_api_path(db, schemas.ApiPathCreate(
        path="/api/v1/test",
        method="POST",
        service="test",
        description="测试接口"
    ))
    
    subscription = services.create_subscription(db, schemas.SubscriptionCreate(
        subscriber_id=subscriber.id,
        api_path_id=api_path.id,
        change_type_id=ct.id
    ))
    
    return ct, subscriber, api_path, subscription


class TestNormalFlow:
    def test_create_subscriber(self, db_session: Session):
        subscriber = services.create_subscriber(db_session, schemas.SubscriberCreate(
            name="正常流程测试",
            email="normal@example.com",
            description="测试描述"
        ))
        assert subscriber.id is not None
        assert subscriber.name == "正常流程测试"
        assert subscriber.is_active is True
    
    def test_create_subscription(self, db_session: Session):
        ct, subscriber, api_path, _ = setup_test_data(db_session)
        
        subscription = services.create_subscription(db_session, schemas.SubscriptionCreate(
            subscriber_id=subscriber.id,
            api_path_id=api_path.id,
            change_type_id=ct.id
        ))
        
        assert subscription.id is not None
        assert subscription.subscriber_id == subscriber.id
        assert subscription.api_path_id == api_path.id
    
    def test_process_api_change(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试API变更",
            description="这是一个测试变更",
            change_date=datetime.utcnow(),
            effective_date=datetime.utcnow() + timedelta(days=30),
            raw_input="test_data"
        ))
        
        notification_count, duplicate_count = services.process_api_change(db_session, api_change.id)
        
        assert notification_count == 1
        assert duplicate_count == 0
        
        notifications = services.get_notifications(db_session, subscriber_id=subscriber.id)
        assert len(notifications) == 1
        assert notifications[0].status == "pending"
        assert notifications[0].is_duplicate is False
    
    def test_confirm_notification(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试确认",
            change_date=datetime.utcnow()
        ))
        services.process_api_change(db_session, api_change.id)
        
        notifications = services.get_notifications(db_session, subscriber_id=subscriber.id)
        assert len(notifications) == 1
        
        confirmed = services.confirm_notification(db_session, notifications[0].id, "已收到，确认处理")
        assert confirmed.status == "confirmed"
        assert confirmed.confirmed_at is not None
        assert confirmed.confirmation_note == "已收到，确认处理"
    
    def test_generate_report(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试报告",
            change_date=datetime.utcnow()
        ))
        services.process_api_change(db_session, api_change.id)
        
        report = services.generate_subscription_report(db_session)
        assert report.total_items == 1
        assert report.pending_count == 1
        assert report.confirmed_count == 0
        assert len(report.items) == 1


class TestDuplicateRequest:
    def test_duplicate_subscription(self, db_session: Session):
        ct, subscriber, api_path, _ = setup_test_data(db_session)
        
        sub1 = services.create_subscription(db_session, schemas.SubscriptionCreate(
            subscriber_id=subscriber.id,
            api_path_id=api_path.id,
            change_type_id=ct.id
        ))
        
        sub2 = services.create_subscription(db_session, schemas.SubscriptionCreate(
            subscriber_id=subscriber.id,
            api_path_id=api_path.id,
            change_type_id=ct.id
        ))
        
        assert sub1.id == sub2.id
    
    def test_duplicate_notification(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试重复通知",
            change_date=datetime.utcnow()
        ))
        
        notification_count1, duplicate_count1 = services.process_api_change(db_session, api_change.id)
        assert notification_count1 == 1
        assert duplicate_count1 == 0
        
        notification_count2, duplicate_count2 = services.process_api_change(db_session, api_change.id)
        assert notification_count2 == 0
        assert duplicate_count2 == 0
        
        notifications = services.get_notifications(db_session, subscriber_id=subscriber.id)
        assert len(notifications) == 1


class TestDirtyData:
    def test_invalid_subscriber_id(self, db_session: Session):
        result = services.get_subscriber(db_session, 99999)
        assert result is None
    
    def test_invalid_api_path_id(self, db_session: Session):
        result = services.get_api_path(db_session, 99999)
        assert result is None
    
    def test_process_nonexistent_change(self, db_session: Session):
        notification_count, duplicate_count = services.process_api_change(db_session, 99999)
        assert notification_count == 0
        assert duplicate_count == 0
    
    def test_confirm_nonexistent_notification(self, db_session: Session):
        result = services.confirm_notification(db_session, 99999, "测试")
        assert result is None


class TestManualCorrection:
    def test_mark_manual_correction(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="需要人工修正",
            change_date=datetime.utcnow()
        ))
        
        corrected = services.mark_manual_correction(
            db_session, api_change.id, "数据解析错误，需要人工修正"
        )
        
        assert corrected.need_manual_correction is True
        assert corrected.correction_note == "数据解析错误，需要人工修正"
        assert corrected.is_processed is False
    
    def test_manual_correction_done(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="人工修正完成",
            change_date=datetime.utcnow()
        ))
        
        services.mark_manual_correction(db_session, api_change.id, "需要修正")
        
        done = services.manual_correction_done(
            db_session, api_change.id, "已完成人工修正，数据已正确处理"
        )
        
        assert done.need_manual_correction is False
        assert done.processing_result == "已完成人工修正，数据已正确处理"
    
    def test_recalculate_after_correction(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="修正后重新计算",
            change_date=datetime.utcnow()
        ))
        
        services.mark_manual_correction(db_session, api_change.id, "需要修正")
        services.manual_correction_done(db_session, api_change.id, "修正完成")
        
        api_change.is_processed = False
        db_session.commit()
        
        notification_count, duplicate_count = services.process_api_change(db_session, api_change.id)
        assert notification_count == 1
        
        notifications = services.get_notifications(db_session, subscriber_id=subscriber.id)
        assert len(notifications) == 1


class TestTimeoutAndRetry:
    def test_check_timeout(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试超时",
            change_date=datetime.utcnow()
        ))
        services.process_api_change(db_session, api_change.id)
        
        notifications = services.get_notifications(db_session)
        for notification in notifications:
            notification.confirm_deadline = datetime.utcnow() - timedelta(days=1)
        db_session.commit()
        
        expired_count = services.check_confirmation_timeout(db_session)
        assert expired_count == 1
        
        notifications = services.get_notifications(db_session, status="expired")
        assert len(notifications) == 1
    
    def test_retry_batch(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试批次重试",
            change_date=datetime.utcnow()
        ))
        services.process_api_change(db_session, api_change.id)
        
        batches = services.get_batches(db_session, api_change_id=api_change.id)
        assert len(batches) == 1
        
        retry_count = services.retry_batch(db_session, batches[0].id)
        assert retry_count == 1
        
        notifications = services.get_notifications(db_session)
        assert len(notifications) == 1
        assert notifications[0].status == "pending"
    
    def test_max_retry_limit(self, db_session: Session):
        ct, subscriber, api_path, subscription = setup_test_data(db_session)
        
        api_change = services.create_api_change(db_session, schemas.ApiChangeCreate(
            api_path_id=api_path.id,
            change_type_id=ct.id,
            title="测试最大重试次数",
            change_date=datetime.utcnow()
        ))
        services.process_api_change(db_session, api_change.id)
        
        batches = services.get_batches(db_session, api_change_id=api_change.id)
        batch_id = batches[0].id
        
        for i in range(3):
            result = services.retry_batch(db_session, batch_id)
            assert result is not None
        
        result = services.retry_batch(db_session, batch_id)
        assert result is None


def run_all_tests():
    print("=" * 60)
    print("运行API变更订阅服务自检脚本")
    print("=" * 60)
    
    test_categories = [
        ("正常流程测试", TestNormalFlow),
        ("重复请求测试", TestDuplicateRequest),
        ("脏数据测试", TestDirtyData),
        ("人工修正测试", TestManualCorrection),
        ("超时和重试测试", TestTimeoutAndRetry),
    ]
    
    passed = 0
    failed = 0
    
    for category_name, test_class in test_categories:
        print(f"\n{category_name}")
        print("-" * 40)
        
        db_path = "test_api_change_subscription.db"
        if os.path.exists(db_path):
            os.remove(db_path)
        
        database.SQLALCHEMY_DATABASE_URL = f"sqlite:///./{db_path}"
        database.engine = database.create_engine(
            database.SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
        )
        database.SessionLocal = database.sessionmaker(autocommit=False, autoflush=False, bind=database.engine)
        database.Base.metadata.create_all(bind=database.engine)
        
        db = database.SessionLocal()
        
        test_methods = [m for m in dir(test_class) if m.startswith("test_")]
        
        for method_name in test_methods:
            try:
                db2 = database.SessionLocal()
                test_instance = test_class()
                getattr(test_instance, method_name)(db2)
                db2.close()
                print(f"  ✓ {method_name}")
                passed += 1
            except Exception as e:
                print(f"  ✗ {method_name}: {str(e)}")
                failed += 1
        
        db.close()
        if os.path.exists(db_path):
            os.remove(db_path)
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed}, 失败 {failed}")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
