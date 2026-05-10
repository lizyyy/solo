import json
import time
import unittest
from datetime import datetime, timedelta

from webhook_signer.core import (
    WebhookSignatureManager,
    KeyStatus,
    SignatureStatus
)


class TestWebhookSignatureManager(unittest.TestCase):

    def setUp(self):
        self.manager = WebhookSignatureManager(
            replay_window_seconds=300,
            rotation_grace_seconds=3600
        )

    def test_basic_sign_and_verify(self):
        print("\n" + "=" * 60)
        print("📋 测试1: 基础签名与验证（主流程）")
        print("=" * 60)

        key_id = self.manager.add_key("test_secret_123", key_id="key_v1")
        print(f"✅ 添加密钥: {key_id}")

        payload = '{"event": "payment_success", "amount": 100.50}'
        signed = self.manager.sign(payload)
        print(f"✅ 生成签名成功")
        print(f"   时间戳: {signed['timestamp']}")
        print(f"   随机数: {signed['nonce']}")

        result = self.manager.verify(
            signature=signed['signature'],
            payload=payload,
            timestamp=signed['timestamp'],
            nonce=signed['nonce']
        )

        self.assertTrue(result.success, f"签名验证应该成功: {result.message}")
        self.assertEqual(result.status, SignatureStatus.VALID)
        self.assertEqual(result.key_id, "key_v1")
        print(f"✅ 验证结果: {result.message}")

        keys = self.manager.list_keys()
        self.assertEqual(len(keys), 1)
        print(f"✅ 密钥列表: {len(keys)} 个密钥")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.valid_signatures, 1)
        print(f"✅ 开发者报告: 有效签名 {report.valid_signatures} 个")

    def test_key_rotation_with_grace_period(self):
        print("\n" + "=" * 60)
        print("📋 测试2: 密钥轮换 - 过渡期新旧密钥并存")
        print("=" * 60)

        old_key_id = self.manager.add_key("old_secret", key_id="key_old")
        print(f"✅ 添加旧密钥: {old_key_id}")

        payload = '{"event": "order_created"}'
        signed_old = self.manager.sign(payload)
        print(f"✅ 用旧密钥签名成功")

        new_key_id = self.manager.rotate_key(old_key_id, "new_secret")
        print(f"✅ 密钥轮换: {old_key_id} -> {new_key_id}")

        keys = self.manager.list_keys()
        self.assertEqual(len(keys), 2)
        old_key = next(k for k in keys if k['key_id'] == old_key_id)
        new_key = next(k for k in keys if k['key_id'] == new_key_id)
        self.assertEqual(old_key['status'], "rotating")
        self.assertEqual(new_key['status'], "active")
        print(f"✅ 旧密钥状态: {old_key['status']}")
        print(f"✅ 新密钥状态: {new_key['status']}")

        result_old = self.manager.verify(
            signature=signed_old['signature'],
            payload=payload,
            timestamp=signed_old['timestamp'],
            nonce=signed_old['nonce']
        )
        self.assertTrue(result_old.success, "过渡期内旧密钥应该仍有效")
        self.assertEqual(result_old.key_id, old_key_id)
        self.assertEqual(result_old.details['key_status'], "rotating")
        print(f"✅ 旧签名验证成功（过渡期）")

        signed_new = self.manager.sign(payload)
        result_new = self.manager.verify(
            signature=signed_new['signature'],
            payload=payload,
            timestamp=signed_new['timestamp'],
            nonce=signed_new['nonce']
        )
        self.assertTrue(result_new.success)
        self.assertEqual(result_new.key_id, new_key_id)
        print(f"✅ 新签名验证成功")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.rotated_key_usage, 1)
        print(f"✅ 报告统计: 轮换密钥使用 {report.rotated_key_usage} 次")

    def test_invalid_signature(self):
        print("\n" + "=" * 60)
        print("📋 测试3: 无效签名检测")
        print("=" * 60)

        self.manager.add_key("correct_secret", key_id="key1")

        result = self.manager.verify(
            signature="wrong_signature_123456",
            payload='{"test": "data"}',
            timestamp=str(int(time.time())),
            nonce="random_nonce_abc"
        )

        self.assertFalse(result.success)
        self.assertEqual(result.status, SignatureStatus.INVALID)
        print(f"✅ 无效签名正确拒绝: {result.message}")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.invalid_signatures, 1)
        print(f"✅ 报告统计: 无效签名 {report.invalid_signatures} 次")

    def test_replay_attack_detection(self):
        print("\n" + "=" * 60)
        print("📋 测试4: 重放攻击检测")
        print("=" * 60)

        self.manager.add_key("secret", key_id="key1")
        payload = '{"event": "transfer"}'
        signed = self.manager.sign(payload)

        result1 = self.manager.verify(
            signature=signed['signature'],
            payload=payload,
            timestamp=signed['timestamp'],
            nonce=signed['nonce']
        )
        self.assertTrue(result1.success)
        print(f"✅ 首次请求: 成功")

        result2 = self.manager.verify(
            signature=signed['signature'],
            payload=payload,
            timestamp=signed['timestamp'],
            nonce=signed['nonce']
        )
        self.assertFalse(result2.success)
        self.assertEqual(result2.status, SignatureStatus.REPLAYED)
        print(f"✅ 重放攻击: 正确检测并拒绝 - {result2.message}")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.replay_attacks, 1)
        print(f"✅ 报告统计: 重放攻击 {report.replay_attacks} 次")

    def test_expired_request(self):
        print("\n" + "=" * 60)
        print("📋 测试5: 过期请求检测")
        print("=" * 60)

        self.manager.add_key("secret", key_id="key1")

        old_timestamp = str(int(time.time()) - 600)
        nonce = "test_expired_nonce"

        import hmac
        import hashlib
        message = f"{old_timestamp}.{nonce}.{{}}"
        signature = hmac.new(
            "secret".encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result = self.manager.verify(
            signature=signature,
            payload="{}",
            timestamp=old_timestamp,
            nonce=nonce
        )

        self.assertFalse(result.success)
        self.assertEqual(result.status, SignatureStatus.EXPIRED)
        print(f"✅ 过期请求: 正确拒绝 - {result.message}")

    def test_idempotency_same_request(self):
        print("\n" + "=" * 60)
        print("📋 测试6: 幂等性 - 相同请求重复提交")
        print("=" * 60)

        self.manager.add_key("secret", key_id="key1")
        idempotency_key = "order_12345_abc"
        payload = '{"amount": 99.99, "quantity": 2, "slots": 1}'

        signed = self.manager.sign(payload)

        result1 = self.manager.verify(
            signature=signed['signature'],
            payload=payload,
            timestamp=signed['timestamp'],
            nonce=signed['nonce'],
            idempotency_key=idempotency_key
        )
        self.assertTrue(result1.success)
        print(f"✅ 首次请求: 成功处理")

        result2 = self.manager.verify(
            signature=signed['signature'],
            payload=payload,
            timestamp=signed['timestamp'],
            nonce="different_nonce_but_same_idempotency",
            idempotency_key=idempotency_key
        )
        self.assertTrue(result2.success)
        self.assertIn("cached_result", result2.details)
        print(f"✅ 重复请求: 返回缓存结果 - {result2.message}")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.valid_signatures, 1)
        print(f"✅ 报告统计: 实际有效签名仅计数 {report.valid_signatures} 次（幂等重复不计）")

    def test_idempotency_conflict_amount_mismatch(self):
        print("\n" + "=" * 60)
        print("📋 测试7: 幂等冲突 - 金额/数量/名额口径不一致")
        print("=" * 60)

        self.manager.add_key("secret", key_id="key1")
        idempotency_key = "order_999_conflict"

        payload1 = '{"amount": 100.00, "quantity": 1, "slots": 1}'
        signed1 = self.manager.sign(payload1)

        result1 = self.manager.verify(
            signature=signed1['signature'],
            payload=payload1,
            timestamp=signed1['timestamp'],
            nonce=signed1['nonce'],
            idempotency_key=idempotency_key
        )
        self.assertTrue(result1.success)
        print(f"✅ 首次请求: amount=100.00, quantity=1, slots=1")

        payload2 = '{"amount": 200.00, "quantity": 1, "slots": 1}'
        signed2 = self.manager.sign(payload2)

        result2 = self.manager.verify(
            signature=signed2['signature'],
            payload=payload2,
            timestamp=signed2['timestamp'],
            nonce=signed2['nonce'],
            idempotency_key=idempotency_key
        )

        self.assertFalse(result2.success)
        self.assertEqual(result2.status, SignatureStatus.IDEMPOTENT_CONFLICT)
        self.assertIn("幂等冲突", result2.message)
        print(f"✅ 金额冲突: 正确拒绝 - {result2.message}")

        report = self.manager.generate_developer_report()
        self.assertEqual(report.idempotent_conflicts, 1)
        print(f"✅ 报告统计: 幂等冲突 {report.idempotent_conflicts} 次")

    def test_multiple_keys_verification(self):
        print("\n" + "=" * 60)
        print("📋 测试8: 多密钥并行验证（轮换场景核心）")
        print("=" * 60)

        key1_id = self.manager.add_key("secret_v1", key_id="key_v1")
        key2_id = self.manager.add_key("secret_v2", key_id="key_v2")

        print(f"✅ 添加两个活跃密钥: {key1_id}, {key2_id}")

        payload = '{"event": "subscription"}'

        import hmac
        import hashlib
        timestamp = str(int(time.time()))

        nonce1 = "nonce_for_v1"
        message1 = f"{timestamp}.{nonce1}.{payload}"
        sig1 = hmac.new(
            "secret_v1".encode('utf-8'),
            message1.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result1 = self.manager.verify(sig1, payload, timestamp, nonce1)
        self.assertTrue(result1.success)
        self.assertEqual(result1.key_id, "key_v1")
        print(f"✅ V1 签名: 由 key_v1 验证成功")

        nonce2 = "nonce_for_v2"
        message2 = f"{timestamp}.{nonce2}.{payload}"
        sig2 = hmac.new(
            "secret_v2".encode('utf-8'),
            message2.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result2 = self.manager.verify(sig2, payload, timestamp, nonce2)
        self.assertTrue(result2.success)
        self.assertEqual(result2.key_id, "key_v2")
        print(f"✅ V2 签名: 由 key_v2 验证成功")

        self.manager.deprecate_key("key_v1")
        print(f"✅ 废弃 key_v1")

        nonce3 = "nonce_for_v1_after_deprecate"
        message3 = f"{timestamp}.{nonce3}.{payload}"
        sig3 = hmac.new(
            "secret_v1".encode('utf-8'),
            message3.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result3 = self.manager.verify(sig3, payload, timestamp, nonce3)
        self.assertTrue(result3.success)
        self.assertEqual(result3.details['key_status'], "deprecated")
        print(f"✅ 废弃密钥仍可验证（用于向后兼容）")

        self.manager.revoke_key("key_v1")
        print(f"✅ 吊销 key_v1")

        nonce4 = "nonce_for_v1_after_revoke"
        message4 = f"{timestamp}.{nonce4}.{payload}"
        sig4 = hmac.new(
            "secret_v1".encode('utf-8'),
            message4.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result4 = self.manager.verify(sig4, payload, timestamp, nonce4)
        self.assertFalse(result4.success)
        print(f"✅ 吊销密钥无法验证: {result4.message}")

    def test_complete_workflow_scenario(self):
        print("\n" + "=" * 60)
        print("📋 测试9: 完整业务场景演练")
        print("=" * 60)

        print("\n[阶段1: 初始设置]")
        manager = WebhookSignatureManager(replay_window_seconds=300, rotation_grace_seconds=10)
        key_id = manager.add_key("prod_secret_2024", key_id="key_2024")
        print(f"✅ 生产密钥: {key_id}")

        print("\n[阶段2: 正常业务 - 支付回调]")
        payment_payload = '{"order_id": "PAY001", "amount": 299.00, "status": "success"}'
        signed = manager.sign(payment_payload)
        print(f"✅ 支付回调签名生成")

        result = manager.verify(
            signature=signed['signature'],
            payload=payment_payload,
            timestamp=signed['timestamp'],
            nonce=signed['nonce'],
            idempotency_key="PAY001_idemp_abc"
        )
        self.assertTrue(result.success)
        print(f"✅ 支付回调验证成功")

        print("\n[阶段3: 密钥安全轮换]")
        new_key_id = manager.rotate_key(key_id, "prod_secret_2024_v2")
        print(f"✅ 开始密钥轮换: {key_id} -> {new_key_id}")

        print("\n[阶段4: 过渡期 - 新旧回调并存]")
        old_callback_payload = '{"order_id": "PAY002", "amount": 150.00}'
        import hmac
        import hashlib
        timestamp_old = str(int(time.time()))
        nonce_old = "old_callback_nonce"
        message_old = f"{timestamp_old}.{nonce_old}.{old_callback_payload}"
        sig_old = hmac.new(
            "prod_secret_2024".encode('utf-8'),
            message_old.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        result_old = manager.verify(sig_old, old_callback_payload, timestamp_old, nonce_old)
        self.assertTrue(result_old.success)
        self.assertEqual(result_old.details['key_status'], "rotating")
        print(f"✅ 旧密钥回调: 过渡期内仍有效")

        new_callback_payload = '{"order_id": "PAY003", "amount": 499.00}'
        signed_new = manager.sign(new_callback_payload)
        result_new = manager.verify(
            signature=signed_new['signature'],
            payload=new_callback_payload,
            timestamp=signed_new['timestamp'],
            nonce=signed_new['nonce']
        )
        self.assertTrue(result_new.success)
        self.assertEqual(result_new.key_id, new_key_id)
        print(f"✅ 新密钥回调: 使用新密钥验证")

        print("\n[阶段5: 安全检测 - 重放尝试]")
        result_replay = manager.verify(sig_old, old_callback_payload, timestamp_old, nonce_old)
        self.assertFalse(result_replay.success)
        self.assertEqual(result_replay.status, SignatureStatus.REPLAYED)
        print(f"✅ 重放攻击: 已拦截")

        print("\n[阶段6: 幂等校验 - 金额口径]")
        retry_payload = '{"order_id": "PAY001", "amount": 299.00, "status": "success"}'
        signed_retry = manager.sign(retry_payload)
        result_retry = manager.verify(
            signature=signed_retry['signature'],
            payload=retry_payload,
            timestamp=signed_retry['timestamp'],
            nonce=signed_retry['nonce'],
            idempotency_key="PAY001_idemp_abc"
        )
        self.assertTrue(result_retry.success)
        self.assertIn("cached_result", result_retry.details)
        print(f"✅ 幂等重试: 返回缓存结果，金额口径一致")

        wrong_payload = '{"order_id": "PAY001", "amount": 598.00, "status": "success"}'
        signed_wrong = manager.sign(wrong_payload)
        result_wrong = manager.verify(
            signature=signed_wrong['signature'],
            payload=wrong_payload,
            timestamp=signed_wrong['timestamp'],
            nonce=signed_wrong['nonce'],
            idempotency_key="PAY001_idemp_abc"
        )
        self.assertFalse(result_wrong.success)
        self.assertEqual(result_wrong.status, SignatureStatus.IDEMPOTENT_CONFLICT)
        print(f"✅ 金额冲突: 已拒绝，口径必须一致")

        print("\n[阶段7: 生成开发者报告]")
        report = manager.generate_developer_report()
        print(f"📊 总请求数: {report.total_requests}")
        print(f"📊 有效签名: {report.valid_signatures}")
        print(f"📊 重放攻击: {report.replay_attacks}")
        print(f"📊 幂等冲突: {report.idempotent_conflicts}")
        print(f"📊 轮换密钥使用: {report.rotated_key_usage}")
        self.assertGreaterEqual(report.total_requests, 6)
        self.assertGreaterEqual(report.valid_signatures, 3)

        print("\n" + "=" * 60)
        print("✅ 完整业务场景演练通过！")
        print("=" * 60)


def run_tests():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestWebhookSignatureManager)

    print("\n" + "=" * 60)
    print("🔬 Webhook 签名轮换 API - 测试套件")
    print("=" * 60)

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")

    if result.wasSuccessful():
        print("\n🎉 所有测试通过！")
    else:
        print("\n❌ 部分测试失败")

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
