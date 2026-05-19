#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, QuarantinedTest, init_db
from schemas import ErrorCodes, TestStatus
from services import TestMetadataParser, ExpiryCalculator, ResultMerger, QuarantineService

print("=" * 60)
print("验证测试隔离名单 API 错误修复")
print("=" * 60)

SQLALCHEMY_DATABASE_URL = "sqlite:///./verify_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = TestingSessionLocal()

print("\n✓ 测试元数据解析功能:")
result = TestMetadataParser.parse_test_name("tests/test_auth.py::TestAuth::test_login")
print(f"  - module: {result['module']}")
print(f"  - class: {result['class']}")
print(f"  - test_name: {result['test_name']}")

print("\n✓ 测试原因分类:")
print(f"  - flaky: {TestMetadataParser.categorize_reason('不稳定')}")
print(f"  - timeout: {TestMetadataParser.categorize_reason('测试超时')}")
print(f"  - other: {TestMetadataParser.categorize_reason('其他原因')}")

print("\n✓ 测试四种关键错误码:")
print(f"  - MISSING_FIELD: {ErrorCodes.MISSING_FIELD}")
print(f"  - INVALID_STATUS: {ErrorCodes.INVALID_STATUS}")
print(f"  - REQUIRES_MANUAL_REVIEW: {ErrorCodes.REQUIRES_MANUAL_REVIEW}")
print(f"  - ALREADY_PROCESSED: {ErrorCodes.ALREADY_PROCESSED}")

print("\n✓ 创建测试记录:")
from schemas import QuarantinedTestCreate
test_data = QuarantinedTestCreate(
    test_name="test_flaky",
    test_path="tests/test_flaky.py::test_flaky",
    quarantine_reason="测试不稳定",
    owner="张三",
    quarantine_date=datetime.utcnow(),
    expiry_date=datetime.utcnow() + timedelta(days=7)
)
test = QuarantineService.create_test(db, test_data)
print(f"  - 测试 ID: {test.id}, 状态: {test.status}")

print("\n✓ 连续通过 3 次进入 READY_FOR_CLEANUP 状态:")
from schemas import TestResultUpdate, ResultStatus
for i in range(3):
    ResultMerger.update_test_result(db, test.id, TestResultUpdate(
        result=ResultStatus.PASS,
        run_date=datetime.utcnow()
    ))

db.refresh(test)
print(f"  - 连续通过次数: {test.consecutive_passes}")
print(f"  - 状态: {test.status}")
assert test.status == TestStatus.READY_FOR_CLEANUP.value, "状态应该为 ready_for_cleanup"
print("  ✓ 状态正确: READY_FOR_CLEANUP")

print("\n✓ 测试再次失败后进入 REQUIRES_MANUAL_REVIEW 状态:")
ResultMerger.update_test_result(db, test.id, TestResultUpdate(
    result=ResultStatus.FAIL,
    run_date=datetime.utcnow()
))
db.refresh(test)
print(f"  - 状态: {test.status}")
assert test.status == TestStatus.REQUIRES_MANUAL_REVIEW.value, "状态应该为 requires_manual_review"
print("  ✓ 状态正确: REQUIRES_MANUAL_REVIEW")

print("\n✓ 尝试清理 REQUIRES_MANUAL_REVIEW 状态的测试:")
try:
    QuarantineService.mark_cleaned(db, test.id)
    print("  ✗ 应该抛出异常")
except ValueError as e:
    print(f"  ✓ 抛出异常: {str(e)}")
    assert str(e) == ErrorCodes.REQUIRES_MANUAL_REVIEW, "错误码应该为 REQUIRES_MANUAL_REVIEW"
    print("  ✓ 错误码正确")

print("\n✓ 测试 ALREADY_PROCESSED 错误码:")
test_data2 = QuarantinedTestCreate(
    test_name="test_cleaned",
    test_path="tests/test_cleaned.py::test_cleaned",
    quarantine_reason="不稳定",
    owner="李四",
    quarantine_date=datetime.utcnow(),
    expiry_date=datetime.utcnow() + timedelta(days=7)
)
test2 = QuarantineService.create_test(db, test_data2)
for _ in range(3):
    ResultMerger.update_test_result(db, test2.id, TestResultUpdate(
        result=ResultStatus.PASS,
        run_date=datetime.utcnow()
    ))
QuarantineService.mark_cleaned(db, test2.id)
try:
    QuarantineService.mark_cleaned(db, test2.id)
    print("  ✗ 应该抛出异常")
except ValueError as e:
    print(f"  ✓ 抛出异常: {str(e)}")
    assert str(e) == ErrorCodes.ALREADY_PROCESSED, "错误码应该为 ALREADY_PROCESSED"
    print("  ✓ 错误码正确")

print("\n✓ 测试 INVALID_STATUS 错误码:")
test_data3 = QuarantinedTestCreate(
    test_name="test_active",
    test_path="tests/test_active.py::test_active",
    quarantine_reason="不稳定",
    owner="王五",
    quarantine_date=datetime.utcnow(),
    expiry_date=datetime.utcnow() + timedelta(days=7)
)
test3 = QuarantineService.create_test(db, test_data3)
try:
    QuarantineService.mark_cleaned(db, test3.id)
    print("  ✗ 应该抛出异常")
except ValueError as e:
    print(f"  ✓ 抛出异常: {str(e)}")
    assert str(e) == ErrorCodes.INVALID_STATUS, "错误码应该为 INVALID_STATUS"
    print("  ✓ 错误码正确")

print("\n" + "=" * 60)
print("✅ 所有验证通过！")
print("=" * 60)

db.close()
if os.path.exists("./verify_test.db"):
    os.remove("./verify_test.db")
