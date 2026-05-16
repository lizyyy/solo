#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
租户配额回收服务自检脚本
验证边界情况和核心功能是否正常工作
"""

import sys
import asyncio
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.database import SessionLocal, init_db
from app import models, schemas, crud
from app.services import QuotaRecycleService, MaterialDownloader
from app.models import FailureType


class SelfTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def test(self, name, func):
        try:
            func()
            self.passed += 1
            self.results.append(f"✓ PASS: {name}")
            print(f"✓ PASS: {name}")
        except AssertionError as e:
            self.failed += 1
            self.results.append(f"✗ FAIL: {name} - {str(e)}")
            print(f"✗ FAIL: {name} - {str(e)}")
        except Exception as e:
            self.failed += 1
            self.results.append(f"✗ ERROR: {name} - {str(e)}")
            print(f"✗ ERROR: {name} - {str(e)}")
    
    def summary(self):
        print("\n" + "="*60)
        print(f"自检结果: 通过 {self.passed}, 失败 {self.failed}")
        print("="*60)
        for result in self.results:
            print(result)
        
        if self.failed > 0:
            sys.exit(1)


def test_database_operations():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-BATCH-001",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/test.json",
            total_target_quota=10000.0
        ))
        assert task.id is not None
        assert task.batch_no == "TEST-BATCH-001"
        
        fetched = crud.get_task(db, task.id)
        assert fetched is not None
        assert fetched.batch_no == "TEST-BATCH-001"
        
        tasks = crud.get_tasks(db, operator="tester")
        assert len(tasks) >= 1
    finally:
        db.close()


def test_download_link_expired_detection():
    downloader = MaterialDownloader()
    
    async def run_test():
        test_cases = [
            ("https://expired-example.com/data.json", True, "下载链接已失效"),
            ("https://invalid-url.com/file.json", True, "下载链接已失效"),
            ("https://site.com/404-not-found", True, "资源不存在"),
            ("https://example.com/valid.json", False, None),
        ]
        
        for url, should_fail, expected_msg in test_cases:
            success, message, _ = await downloader.verify_and_download(url)
            if should_fail:
                assert not success, f"URL {url} 应该被检测为失效"
                if expected_msg:
                    assert expected_msg in message, f"期望消息包含 '{expected_msg}'"
    
    asyncio.run(run_test())


def test_failure_type_mapping():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-FAILURE-MAPPING",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://expired-example.com/material.json",
            total_target_quota=5000.0
        ))
        
        service = QuotaRecycleService(db)
        asyncio.run(service.execute_recycle_task(task.id))
        
        task = crud.get_task(db, task.id)
        assert task.failed_count >= 1
        
        failed_items = crud.get_failed_items(db, task_id=task.id)
        assert len(failed_items) >= 1
        
        has_expired = any(
            item.failure_type == FailureType.DOWNLOAD_LINK_EXPIRED
            for item in failed_items
        )
        assert has_expired, "应该有 DOWNLOAD_LINK_EXPIRED 类型的失败"
    finally:
        db.close()


def test_failed_item_persistence():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-PERSISTENCE",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/test.json",
            total_target_quota=5000.0
        ))
        
        failed_item = crud.create_failed_item(db, schemas.FailedItemCreate(
            task_id=task.id,
            failure_type=FailureType.QUOTA_CALCULATION_ERROR,
            tenant_id="TENANT-TEST-001",
            tenant_name="测试租户",
            error_message="配额计算错误测试",
            raw_data='{"test": "data"}'
        ))
        
        assert failed_item.id is not None
        
        fetched = crud.get_failed_items(
            db, tenant_id="TENANT-TEST-001"
        )
        assert len(fetched) >= 1
        assert fetched[0].error_message == "配额计算错误测试"
    finally:
        db.close()


def test_filter_by_failure_type():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-FILTER",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/filter.json",
            total_target_quota=5000.0
        ))
        
        types_to_test = [
            FailureType.DOWNLOAD_LINK_EXPIRED,
            FailureType.QUOTA_CALCULATION_ERROR,
            FailureType.PERMISSION_DENIED,
        ]
        
        for i, f_type in enumerate(types_to_test):
            crud.create_failed_item(db, schemas.FailedItemCreate(
                task_id=task.id,
                failure_type=f_type,
                tenant_id=f"TENANT-FILTER-{i}",
                error_message=f"测试 {f_type.value}"
            ))
        
        for f_type in types_to_test:
            items = crud.get_failed_items(db, failure_type=f_type)
            assert len(items) >= 1
            assert all(item.failure_type == f_type for item in items)
    finally:
        db.close()


def test_recycle_detail_query():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-DETAIL",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/detail.json",
            total_target_quota=5000.0
        ))
        
        detail = crud.create_recycle_detail(db, schemas.RecycleDetailCreate(
            task_id=task.id,
            tenant_id="TENANT-DETAIL-001",
            tenant_name="明细测试租户",
            original_quota=10000.0,
            recycled_quota=7500.0,
            remaining_quota=2500.0,
            reason="测试原因",
            evidence_url="https://example.com/evidence"
        ))
        
        assert detail.id is not None
        
        by_task = crud.get_recycle_details_by_task(db, task.id)
        assert len(by_task) >= 1
        
        by_tenant = crud.get_recycle_details_by_tenant(db, "TENANT-DETAIL-001")
        assert len(by_tenant) >= 1
        assert by_tenant[0].recycled_quota == 7500.0
    finally:
        db.close()


def test_lakehouse_partition_confirmation():
    db = SessionLocal()
    try:
        partition = crud.create_lakehouse_partition(db, schemas.LakehousePartitionCreate(
            partition_path="/data/test/date=2024-01-01",
            partition_date="2024-01-01",
            record_count=1000,
            data_size_mb=128.5
        ))
        
        assert partition.manually_confirmed == False
        
        confirmed = crud.confirm_lakehouse_partition(
            db, partition.id, "test_confirm_user", "人工确认测试"
        )
        
        assert confirmed.manually_confirmed == True
        assert confirmed.confirmed_by == "test_confirm_user"
        assert confirmed.confirmed_at is not None
        
        unconfirmed = crud.get_lakehouse_partitions(db, manually_confirmed=False)
        assert all(not p.manually_confirmed for p in unconfirmed)
    finally:
        db.close()


def test_task_statistics_update():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-STATS",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/stats.json",
            total_target_quota=50000.0
        ))
        
        crud.update_task_stats(db, task.id, success_count=5, failed_count=2, actual_recycled=35000.0)
        
        updated = crud.get_task(db, task.id)
        assert updated.success_count == 5
        assert updated.failed_count == 2
        assert updated.actual_recycled_quota == 35000.0
        assert updated.status == models.TaskStatus.PARTIAL_FAILED
    finally:
        db.close()


def test_failure_resolution():
    db = SessionLocal()
    try:
        task = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
            batch_no="TEST-RESOLVE",
            operator="tester",
            risk_type=models.RiskType.GRAY_LOGISTICS,
            material_url="https://example.com/resolve.json",
            total_target_quota=5000.0
        ))
        
        item = crud.create_failed_item(db, schemas.FailedItemCreate(
            task_id=task.id,
            failure_type=FailureType.DOWNLOAD_LINK_EXPIRED,
            tenant_id="TENANT-RESOLVE",
            error_message="待解决的失败项"
        ))
        
        assert item.resolved == False
        
        resolved = crud.resolve_failed_item(
            db, item.id, "resolver_user", "已重新获取有效材料"
        )
        
        assert resolved.resolved == True
        assert resolved.resolved_by == "resolver_user"
        assert resolved.resolution_note == "已重新获取有效材料"
    finally:
        db.close()


def main():
    print("="*60)
    print("租户配额回收服务 - 自检脚本")
    print("="*60)
    print()
    
    init_db()
    
    tester = SelfTest()
    
    print("正在运行数据库操作测试...")
    tester.test("数据库CRUD操作", test_database_operations)
    
    print("正在运行下载链接失效检测测试...")
    tester.test("下载链接失效检测", test_download_link_expired_detection)
    
    print("正在运行失败类型映射测试...")
    tester.test("失败类型自动映射", test_failure_type_mapping)
    
    print("正在运行失败项持久化测试...")
    tester.test("失败项持久化存储", test_failed_item_persistence)
    
    print("正在运行按失败类型过滤测试...")
    tester.test("按失败类型查询过滤", test_filter_by_failure_type)
    
    print("正在运行回收明细查询测试...")
    tester.test("回收额度明细查询", test_recycle_detail_query)
    
    print("正在运行湖仓分区确认测试...")
    tester.test("湖仓分区人工确认", test_lakehouse_partition_confirmation)
    
    print("正在运行任务统计更新测试...")
    tester.test("任务统计状态更新", test_task_statistics_update)
    
    print("正在运行失败项解决测试...")
    tester.test("失败项标记解决", test_failure_resolution)
    
    tester.summary()


if __name__ == "__main__":
    main()
