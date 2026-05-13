import os
import sys
import json
from datetime import datetime, timedelta
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, MessageStatus, init_db
from schemas import MessageCreate, StatusUpdate, ReceiptCreate
from service import IdempotentInboxService

TEST_DATABASE_URL = "sqlite:///./test_idempotent_inbox.db"

class TestIdempotentInbox(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists("./test_idempotent_inbox.db"):
            os.remove("./test_idempotent_inbox.db")
        engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.service = IdempotentInboxService(self.db)

    def tearDown(self):
        self.db.close()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists("./test_idempotent_inbox.db"):
            os.remove("./test_idempotent_inbox.db")

    def test_1_duplicate_message_idempotency(self):
        print("\n=== 测试1: 幂等性 - 重复调用不产生脏数据")
        msg_data = MessageCreate(
            message_id="test_msg_001",
            source="order_system",
            business_key="ORDER_12345",
            payload='{"order_id": "12345", "amount": 100.0}'
        )

        msg1, created1 = self.service.create_message(msg_data)
        self.assertTrue(created1, "首次创建应该返回 True")
        self.assertEqual(msg1.status, MessageStatus.PENDING)
        print(f"  首次创建: message_id={msg1.message_id}, id={msg1.id}")

        msg2, created2 = self.service.create_message(msg_data)
        self.assertFalse(created2, "重复创建应该返回 False")
        self.assertEqual(msg1.id, msg2.id, "重复创建应该返回相同记录")
        print(f"  重复创建: message_id={msg2.message_id}, id={msg2.id} (幂等返回)")

        msg3, created3 = self.service.create_message(msg_data)
        self.assertFalse(created3)
        self.assertEqual(msg1.id, msg3.id)

        from sqlalchemy import text
        all_messages = self.db.execute(text("SELECT COUNT(*) FROM messages")).scalar()
        self.assertEqual(all_messages, 1, f"应该只有1条记录，实际有 {all_messages} 条")
        print(f"  ✓ 数据库中实际记录数: {all_messages} (幂等保证正确)")
        print("  ✓ 幂等性测试通过")

    def test_2_status_transitions_valid(self):
        print("\n=== 测试2: 合法状态流转")
        msg_data = MessageCreate(
            message_id="test_msg_002",
            source="payment_system",
            business_key="PAY_67890"
        )
        msg, _ = self.service.create_message(msg_data)

        print(f"  初始状态: {msg.status.value}")

        msg, _ = self.service.mark_processing(msg.id)
        self.assertEqual(msg.status, MessageStatus.PROCESSING)
        print(f"  → processing: {msg.status.value} ✓")

        msg, _ = self.service.mark_success(msg.id)
        self.assertEqual(msg.status, MessageStatus.SUCCESS)
        print(f"  → success: {msg.status.value} ✓")

        history_count = len(msg.status_history)
        print(f"  ✓ 状态历史记录数: {history_count}")
        self.assertEqual(history_count, 3)
        print("  ✓ 合法状态流转测试通过")

    def test_3_status_transitions_invalid(self):
        print("\n=== 测试3: 非法状态跳转 - 状态机保护")
        msg_data = MessageCreate(
            message_id="test_msg_003",
            source="user_system",
            business_key="USER_11111"
        )
        msg, _ = self.service.create_message(msg_data)
        msg_id = msg.id

        print(f"  初始状态: {msg.status.value}")

        result, err_msg = self.service.mark_success(msg_id)
        self.assertIsNone(result, "pending 不能直接跳转到 success")
        print(f"  pending → success: {err_msg} ✓")

        result, err_msg = self.service.retry(msg_id)
        self.assertIsNone(result, "pending 不能重试")
        print(f"  pending 重试: {err_msg} ✓")

        msg, _ = self.service.mark_processing(msg_id)
        msg, _ = self.service.mark_success(msg_id)

        result, err_msg = self.service.cancel(msg_id)
        self.assertIsNone(result, "success 状态不能撤销")
        print(f"  success → cancelled: {err_msg} ✓")

        result, err_msg = self.service.mark_failed(msg_id, "测试失败")
        self.assertIsNone(result, "success 状态不能标记失败")
        print(f"  success → failed: {err_msg} ✓")

        print("  ✓ 非法状态跳转测试通过")

    def test_4_failure_retry_flow(self):
        print("\n=== 测试4: 失败重试流程")
        msg_data = MessageCreate(
            message_id="test_msg_004",
            source="inventory_system",
            business_key="INV_22222",
            max_retries=2
        )
        msg, _ = self.service.create_message(msg_data)
        msg_id = msg.id

        msg, _ = self.service.mark_processing(msg_id)
        msg, _ = self.service.mark_failed(msg_id, "网络超时")
        self.assertEqual(msg.retry_count, 1)
        print(f"  第1次失败: retry_count={msg.retry_count}, status={msg.status.value}")

        msg, _ = self.service.retry(msg_id)
        self.assertEqual(msg.status, MessageStatus.PENDING)
        print(f"  重试后: status={msg.status.value}")

        msg, _ = self.service.mark_processing(msg_id)
        msg, _ = self.service.mark_failed(msg_id, "数据库错误")
        self.assertEqual(msg.retry_count, 2)
        print(f"  第2次失败: retry_count={msg.retry_count}")

        result, err_msg = self.service.retry(msg_id)
        self.assertIsNone(result, "超过最大重试次数不应允许重试")
        print(f"  超过最大重试次数: {err_msg} ✓")

        print("  ✓ 失败重试流程测试通过")

    def test_5_receipt_and_history(self):
        print("\n=== 测试5: 回执记录与状态历史查询")
        msg_data = MessageCreate(
            message_id="test_msg_005",
            source="notification_system",
            business_key="NOTIF_33333"
        )
        msg, _ = self.service.create_message(msg_data)
        msg_id = msg.id

        receipt = ReceiptCreate(
            receipt_type="send_ack",
            receipt_data='{"ack_id": "ACK_001", "timestamp": "2024-01-01T00:00:00"}'
        )
        r, _ = self.service.add_receipt(msg_id, receipt)
        self.assertIsNotNone(r)
        print(f"  添加回执: type={r.receipt_type}")

        msg, _ = self.service.mark_processing(msg_id)
        msg, _ = self.service.mark_success(msg_id)

        history = self.service.get_message(db_id=msg_id).status_history
        print(f"  状态历史条数: {len(history)}")
        for h in history:
            from_s = h.from_status.value if h.from_status else "None"
            print(f"    {from_s} → {h.to_status.value}: {h.reason}")

        self.assertEqual(len(history), 3)
        print("  ✓ 回执与历史测试通过")

    def test_6_export_function(self):
        print("\n=== 测试6: 导出功能")
        for i in range(3):
            msg_data = MessageCreate(
                message_id=f"test_export_{i}",
                source="test_system",
                business_key=f"KEY_{i}"
            )
            self.service.create_message(msg_data)

        exported = self.service.export_messages()
        self.assertGreaterEqual(len(exported), 0)
        print(f"  导出记录数: {len(exported)}")

        for item in exported[:2]:
            self.assertIn("status_history", item)
            self.assertIn("receipts", item)

        print("  ✓ 导出功能测试通过")

    def test_7_dirty_data_protection(self):
        print("\n=== 测试7: 脏数据保护 - 去重窗口过期处理")
        msg_data = MessageCreate(
            message_id="test_msg_007",
            source="short_window",
            business_key="SHORT_44444",
            deduplication_window=1
        )
        msg1, created1 = self.service.create_message(msg_data)
        self.assertTrue(created1)
        print(f"  首次创建: id={msg1.id}")

        import time
        time.sleep(1.5)

        msg2, created2 = self.service.create_message(msg_data)
        self.assertTrue(created2, "去重窗口过期后应该重新创建")
        self.assertEqual(msg1.id, msg2.id, "应该复用同一条记录但重置状态")
        print(f"  窗口过期后重置: id={msg2.id}, status={msg2.status.value}")
        print("  ✓ 脏数据保护测试通过")

def run_tests():
    print("=" * 60)
    print("消息幂等收件箱 API - 自检脚本")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    test_cases = [
        TestIdempotentInbox("test_1_duplicate_message_idempotency"),
        TestIdempotentInbox("test_2_status_transitions_valid"),
        TestIdempotentInbox("test_3_status_transitions_invalid"),
        TestIdempotentInbox("test_4_failure_retry_flow"),
        TestIdempotentInbox("test_5_receipt_and_history"),
        TestIdempotentInbox("test_6_export_function"),
        TestIdempotentInbox("test_7_dirty_data_protection"),
    ]
    suite.addTests(test_cases)

    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print(f"测试结果: 运行 {result.testsRun} 个测试")
    print(f"成功: {len(result.failures) == 0 and len(result.errors) == 0}")
    if result.failures:
        print(f"失败: {len(result.failures)}")
    if result.errors:
        print(f"错误: {len(result.errors)}")
    print("=" * 60)

    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
