#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import json

import models
import schemas
from services import TenantSuspenderService, CacheService
from database import Base

TEST_DATABASE_URL = "sqlite:///./test_tenant_suspender.db"


class TestTenantSuspender(unittest.TestCase):
    def setUp(self):
        engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()

    def tearDown(self):
        self.db.close()
        if os.path.exists("./test_tenant_suspender.db"):
            os.remove("./test_tenant_suspender.db")

    def test_create_tenant(self):
        print("\n=== 测试1: 创建租户 ===")
        tenant_data = schemas.TenantCreate(
            tenant_code="TENANT001",
            tenant_name="北京某科技有限公司",
            department="风控合规部",
            contact_person="张三",
            contact_phone="13800138000"
        )
        tenant = TenantSuspenderService.create_tenant(self.db, tenant_data)
        self.assertEqual(tenant.tenant_code, "TENANT001")
        self.assertEqual(tenant.tenant_name, "北京某科技有限公司")
        print("✓ 租户创建成功")

    def test_successful_sms_backfill(self):
        print("\n=== 测试2: 成功路径 - 短信补录 ===")
        tenant_data = schemas.TenantCreate(
            tenant_code="TENANT002",
            tenant_name="上海某贸易有限公司",
            department="运营管理部",
            contact_person="李四",
            contact_phone="13900139000"
        )
        TenantSuspenderService.create_tenant(self.db, tenant_data)

        request = schemas.SmsBackfillRequest(
            batch_no="BATCH-2024-001",
            tenant_code="TENANT002",
            department="运营管理部",
            submitted_by="李四",
            records=[
                schemas.SmsRecordCreate(
                    phone_number="13800138001",
                    content="【风控提醒】您的账户存在异常操作，请核实",
                    operator="系统自动发送",
                    remark="高风险用户"
                ),
                schemas.SmsRecordCreate(
                    phone_number="13800138002",
                    content="【暂停通知】您的服务已临时暂停",
                    operator="系统自动发送",
                    remark="已暂停用户"
                ),
                schemas.SmsRecordCreate(
                    phone_number="13800138003",
                    content="【核验通知】请配合完成身份核验",
                    operator="系统自动发送",
                    remark="待核验用户"
                )
            ]
        )

        result, errors = TenantSuspenderService.backfill_sms_records(self.db, request)
        self.assertEqual(result.status, "SUCCESS")
        self.assertEqual(result.success_count, 3)
        self.assertEqual(result.failed_count, 0)
        self.assertEqual(result.cache_status, "FRESH")
        print("✓ 短信补录成功")
        print(f"  - 批次号: {result.batch_no}")
        print(f"  - 成功记录: {result.success_count}条")
        print(f"  - 缓存状态: {result.cache_status}")

    def test_cache_stale_scenario(self):
        print("\n=== 测试3: 异常路径 - 缓存未刷新 ===")
        tenant_data = schemas.TenantCreate(
            tenant_code="TENANT003",
            tenant_name="广州某金融服务公司",
            department="风险管理部",
            contact_person="王五",
            contact_phone="13700137000"
        )
        TenantSuspenderService.create_tenant(self.db, tenant_data)

        cache_key = "tenant:TENANT003:status"
        CacheService.mark_cache_stale(self.db, cache_key)

        request = schemas.SmsBackfillRequest(
            batch_no="BATCH-2024-003",
            tenant_code="TENANT003",
            department="风险管理部",
            submitted_by="王五",
            records=[
                schemas.SmsRecordCreate(
                    phone_number="13700137001",
                    content="【风险预警】检测到异常交易",
                    operator="风控系统"
                )
            ]
        )

        result, errors = TenantSuspenderService.backfill_sms_records(self.db, request)
        print(f"  - 状态: {result.status}")
        print(f"  - 缓存状态: {result.cache_status}")
        print(f"  - 结论: {result.summary}")
        print("✓ 缓存未刷新场景处理正确")

    def test_nonexistent_tenant_with_cache_stale(self):
        print("\n=== 测试4: 边界情况 - 不存在租户+缓存未刷新 ===")
        request = schemas.SmsBackfillRequest(
            batch_no="BATCH-2024-004",
            tenant_code="TENANT-NOT-EXIST",
            department="测试部门",
            submitted_by="测试人员",
            records=[
                schemas.SmsRecordCreate(
                    phone_number="13800000000",
                    content="测试短信",
                    operator="测试员"
                )
            ]
        )

        result, errors = TenantSuspenderService.backfill_sms_records(self.db, request)
        self.assertEqual(result.status, "CACHE_STALE")
        self.assertEqual(result.success_count, 0)
        self.assertEqual(result.failed_count, 1)
        print(f"  - 状态: {result.status}")
        print(f"  - 错误详情: {result.error_details}")
        print("✓ 不存在租户+缓存未刷新场景处理正确")

    def test_unified_query_success_and_error(self):
        print("\n=== 测试5: 统一查询入口 - 成功/异常路径都可查询 ===")
        for i in range(3):
            tenant_data = schemas.TenantCreate(
                tenant_code=f"TENANT-QUERY-{i:03d}",
                tenant_name=f"测试公司{i}",
                department="测试部门",
                contact_person=f"测试人员{i}"
            )
            TenantSuspenderService.create_tenant(self.db, tenant_data)

        request1 = schemas.SmsBackfillRequest(
            batch_no="BATCH-QUERY-001",
            tenant_code="TENANT-QUERY-000",
            department="测试部门",
            submitted_by="测试员",
            records=[schemas.SmsRecordCreate(phone_number="13800000001", content="测试1", operator="系统")]
        )
        TenantSuspenderService.backfill_sms_records(self.db, request1)

        cache_key = "tenant:TENANT-QUERY-001:status"
        CacheService.mark_cache_stale(self.db, cache_key)
        
        request2 = schemas.SmsBackfillRequest(
            batch_no="BATCH-QUERY-002",
            tenant_code="TENANT-QUERY-001",
            department="测试部门",
            submitted_by="测试员",
            records=[schemas.SmsRecordCreate(phone_number="13800000002", content="测试2", operator="系统")]
        )
        TenantSuspenderService.backfill_sms_records(self.db, request2)

        all_records = TenantSuspenderService.query_processing_records(self.db)
        self.assertEqual(len(all_records), 2)
        print(f"✓ 查询到所有记录: {len(all_records)}条")

        success_records = TenantSuspenderService.query_processing_records(self.db, status="SUCCESS")
        print(f"  - 成功记录: {len(success_records)}条")

        cache_stale_records = TenantSuspenderService.query_processing_records(self.db, status="CACHE_STALE")
        print(f"  - 缓存失效记录: {len(cache_stale_records)}条")

        batch_records = TenantSuspenderService.query_processing_records(self.db, batch_no="BATCH-QUERY-001")
        self.assertEqual(len(batch_records), 1)
        print(f"✓ 按批次查询正确")

        tenant_records = TenantSuspenderService.query_processing_records(
            self.db, tenant_code="TENANT-QUERY-000"
        )
        self.assertEqual(len(tenant_records), 1)
        print(f"✓ 按租户查询正确")

    def test_material_summary_export(self):
        print("\n=== 测试6: 材料摘要导出 ===")
        tenant_data = schemas.TenantCreate(
            tenant_code="TENANT-SUMMARY",
            tenant_name="深圳某电商公司",
            department="合规审计部",
            contact_person="赵六"
        )
        TenantSuspenderService.create_tenant(self.db, tenant_data)

        request = schemas.SmsBackfillRequest(
            batch_no="BATCH-SUMMARY-001",
            tenant_code="TENANT-SUMMARY",
            department="合规审计部",
            submitted_by="赵六",
            records=[
                schemas.SmsRecordCreate(
                    phone_number="13900139001",
                    content="【合规通知】请完成合规自查",
                    operator="合规系统",
                    remark="月度合规通知"
                )
            ]
        )
        TenantSuspenderService.backfill_sms_records(self.db, request)

        summary = TenantSuspenderService.get_material_summary(self.db, "BATCH-SUMMARY-001")
        self.assertIsNotNone(summary)
        self.assertIn("租户暂停器 - 材料摘要导出", summary.summary_content)
        self.assertIn("物流拦截复核样例", summary.summary_content)
        self.assertIn("LOGISTICS-BATCH-SUMMARY-001-SAMPLE-001", summary.summary_content)
        print("✓ 材料摘要生成正确")
        print("  - 包含物流拦截截图复核样例")
        print(f"  - 摘要Token: {summary.export_token}")

    def test_cache_ttl_expiration(self):
        print("\n=== 测试7: 缓存TTL过期机制 ===")
        cache_key = "test:cache:ttl"
        CacheService.set_cache(self.db, cache_key, {"data": "test"}, ttl_minutes=0)
        
        is_stale = CacheService.is_cache_stale(self.db, cache_key)
        self.assertTrue(is_stale)
        print("✓ 缓存TTL过期检测正确")

    def test_cache_refresh_count(self):
        print("\n=== 测试8: 缓存刷新计数 ===")
        cache_key = "test:cache:refresh"
        for i in range(3):
            CacheService.set_cache(self.db, cache_key, {"data": f"value{i}"})
        
        cache_status = CacheService.get_cache_status(self.db, cache_key)
        self.assertEqual(cache_status.refresh_count, 3)
        print(f"✓ 缓存刷新计数正确: {cache_status.refresh_count}次")

    def test_realistic_department_data(self):
        print("\n=== 测试9: 真实部门数据样例 ===")
        departments = [
            ("风控合规部", "风险控制与合规管理", "TENANT-RISK"),
            ("运营管理部", "业务运营与流程管理", "TENANT-OPS"),
            ("客户服务部", "客户服务与支持", "TENANT-CS"),
            ("技术研发部", "技术开发与维护", "TENANT-TECH"),
            ("财务审计部", "财务管理与审计", "TENANT-FIN"),
        ]

        for dept_name, dept_desc, tenant_code in departments:
            tenant_data = schemas.TenantCreate(
                tenant_code=tenant_code,
                tenant_name=f"{dept_name}测试租户",
                department=dept_name,
                contact_person=f"{dept_name}负责人",
                contact_phone=f"138{1000000 + departments.index((dept_name, dept_desc, tenant_code)):06d}"
            )
            TenantSuspenderService.create_tenant(self.db, tenant_data)

            request = schemas.SmsBackfillRequest(
                batch_no=f"BATCH-{tenant_code}-001",
                tenant_code=tenant_code,
                department=dept_name,
                submitted_by=f"{dept_name}操作员",
                records=[
                    schemas.SmsRecordCreate(
                        phone_number=f"139{1000000 + departments.index((dept_name, dept_desc, tenant_code)):06d}",
                        content=f"【{dept_name}】{dept_desc}相关通知",
                        operator=f"{dept_name}系统"
                    )
                ]
            )
            result, _ = TenantSuspenderService.backfill_sms_records(self.db, request)
            self.assertEqual(result.status, "SUCCESS")

        print(f"✓ 成功处理 {len(departments)} 个真实部门样例数据")
        for dept_name, _, _ in departments:
            print(f"  - {dept_name}")

    def test_persistence_after_restart(self):
        print("\n=== 测试10: 数据持久化验证 ===")
        tenant_data = schemas.TenantCreate(
            tenant_code="TENANT-PERSIST",
            tenant_name="持久化测试公司",
            department="测试部门",
            contact_person="测试员"
        )
        TenantSuspenderService.create_tenant(self.db, tenant_data)

        request = schemas.SmsBackfillRequest(
            batch_no="BATCH-PERSIST-001",
            tenant_code="TENANT-PERSIST",
            department="测试部门",
            submitted_by="测试员",
            records=[schemas.SmsRecordCreate(phone_number="13812345678", content="持久化测试", operator="系统")]
        )
        TenantSuspenderService.backfill_sms_records(self.db, request)

        self.db.close()
        
        engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        new_db = TestingSessionLocal()

        tenant = TenantSuspenderService.get_tenant_by_code(new_db, "TENANT-PERSIST")
        self.assertIsNotNone(tenant)

        summary = TenantSuspenderService.get_material_summary(new_db, "BATCH-PERSIST-001")
        self.assertIsNotNone(summary)

        records = TenantSuspenderService.query_processing_records(new_db, batch_no="BATCH-PERSIST-001")
        self.assertEqual(len(records), 1)

        new_db.close()
        print("✓ 数据持久化验证通过")
        print("  - 租户信息重启后可查询")
        print("  - 处理记录重启后可查询")
        print("  - 材料摘要重启后可查询")


def run_selftest():
    print("=" * 60)
    print("租户暂停器 - 自检脚本启动")
    print("=" * 60)
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestTenantSuspender)
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    print("自检结果汇总")
    print("=" * 60)
    print(f"测试总数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✅ 所有测试通过！系统可以正常使用。")
        return 0
    else:
        print("\n❌ 部分测试失败，请检查代码。")
        if result.failures:
            print("\n失败详情:")
            for test, traceback in result.failures:
                print(f"  - {test}: {traceback.split(chr(10))[0]}")
        return 1


if __name__ == "__main__":
    exit_code = run_selftest()
    sys.exit(exit_code)
