#!/usr/bin/env python3
import sys
import os
import tempfile
import json
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from license_tracker.lockfile_parser import LockfileParser, ParsedDependency
from license_tracker.services import LicenseMerger, ExceptionService, PathTracker
from license_tracker.database import SessionLocal, Base, engine, ExceptionStatus
from license_tracker.schemas import LicenseExceptionCreate, LicenseExceptionUpdate


class TestResult:
    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def __str__(self):
        status = "PASS" if self.passed else "FAIL"
        return f"[{status}] {self.name}: {self.message}"


class SelfTest:
    def __init__(self):
        self.results = []
        self.temp_dir = tempfile.mkdtemp()
        self.db = SessionLocal()

    def run(self):
        print("=" * 60)
        print("许可证例外追踪系统 - 自检脚本")
        print("=" * 60)
        print()

        Base.metadata.create_all(bind=engine)

        self.test_license_normalization()
        self.test_lockfile_parsing()
        self.test_exception_crud()
        self.test_exception_status_transitions()
        self.test_error_cases()
        self.test_expiry_check()
        self.test_path_tracking()

        print()
        print("=" * 60)
        print("测试结果汇总")
        print("=" * 60)

        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)

        for result in self.results:
            print(result)

        print()
        print(f"总计: {passed}/{total} 测试通过")

        if passed == total:
            print("所有测试通过！系统运行正常。")
            return 0
        else:
            print(f"有 {total - passed} 个测试失败。")
            return 1

    def add_result(self, name: str, passed: bool, message: str = ""):
        self.results.append(TestResult(name, passed, message))

    def test_license_normalization(self):
        print("测试1: 许可证归并功能...")

        test_cases = [
            ("Apache 2.0", "Apache-2.0"),
            ("Apache License 2.0", "Apache-2.0"),
            ("MIT License", "MIT"),
            ("GPLv3", "GPL-3.0"),
            (None, None),
        ]

        all_passed = True
        for input_val, expected in test_cases:
            result = LicenseMerger.normalize_license(input_val)
            if result != expected:
                all_passed = False
                print(f"  归一化失败: {input_val} -> {result} (期望: {expected})")

        self.add_result("许可证归一化", all_passed)
        print(f"  -> {'通过' if all_passed else '失败'}")

    def test_lockfile_parsing(self):
        print("测试2: Lockfile解析功能...")

        req_file = os.path.join(self.temp_dir, "requirements.txt")
        with open(req_file, 'w') as f:
            f.write("requests==2.31.0\n")
            f.write("fastapi>=0.100.0\n")
            f.write("# This is a comment\n")
            f.write("uvicorn[standard]\n")

        try:
            deps, warnings = LockfileParser.parse(req_file)
            dep_names = {d.name for d in deps}
            expected = {"requests", "fastapi", "uvicorn"}

            passed = expected.issubset(dep_names)
            self.add_result(
                "requirements.txt解析",
                passed,
                f"解析到 {len(deps)} 个依赖: {[d.name for d in deps]}"
            )
            print(f"  -> {'通过' if passed else '失败'}")
        except Exception as e:
            self.add_result("requirements.txt解析", False, str(e))
            print(f"  -> 失败: {e}")

    def test_exception_crud(self):
        print("测试3: 例外规则CRUD...")

        try:
            exception_data = LicenseExceptionCreate(
                dependency_name="test-package",
                license_name="GPL-3.0",
                reason="项目历史遗留依赖，暂无替代方案",
                requested_by="developer@example.com",
                expires_at=datetime.utcnow() + timedelta(days=90),
                requires_manual_review=False
            )

            exc = ExceptionService.create_exception(self.db, exception_data)
            assert exc.id is not None, "创建失败，ID为空"

            fetched = self.db.query(type(exc)).filter(type(exc).id == exc.id).first()
            assert fetched.dependency_name == "test-package", "数据不一致"

            self.add_result("例外规则CRUD", True, f"创建ID: {exc.id}")
            print(f"  -> 通过 (创建ID: {exc.id})")
        except Exception as e:
            self.add_result("例外规则CRUD", False, str(e))
            print(f"  -> 失败: {e}")

    def test_exception_status_transitions(self):
        print("测试4: 例外状态流转...")

        try:
            exception_data = LicenseExceptionCreate(
                dependency_name="transition-test",
                license_name="MIT",
                reason="测试状态流转",
                requested_by="tester@example.com",
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            exc = ExceptionService.create_exception(self.db, exception_data)

            update = LicenseExceptionUpdate(
                status=ExceptionStatus.APPROVED,
                approved_by="reviewer@example.com",
                review_notes="批准例外"
            )
            updated = ExceptionService.update_exception_status(
                self.db, exc.id, update, "reviewer@example.com"
            )

            assert updated.status == ExceptionStatus.APPROVED, "状态更新失败"

            self.addResult("例外状态流转", True, f"当前状态: {updated.status}")
            print(f"  -> 通过 (当前状态: {updated.status})")
        except Exception as e:
            self.add_result("例外状态流转", False, str(e))
            print(f"  -> 失败: {e}")

    def addResult(self, name: str, passed: bool, message: str):
        self.results.append(TestResult(name, passed, message))

    def test_error_cases(self):
        print("测试5: 错误处理...")

        error_tests = [
            ("缺少必填字段", self._test_missing_field),
            ("无效状态流转", self._test_invalid_transition),
        ]

        for name, test_func in error_tests:
            try:
                test_func()
                self.add_result(f"错误处理 - {name}", True)
                print(f"  {name}: 通过")
            except AssertionError as e:
                self.add_result(f"错误处理 - {name}", False, str(e))
                print(f"  {name}: 失败 - {e}")
            except Exception as e:
                self.add_result(f"错误处理 - {name}", False, f"Unexpected: {e}")
                print(f"  {name}: 失败 - {e}")

    def _test_missing_field(self):
        from license_tracker.schemas import MissingField

        try:
            exception_data = LicenseExceptionCreate(
                dependency_name="error-test",
                license_name="MIT",
                reason="",
                requested_by="tester@example.com",
                expires_at=datetime.utcnow() + timedelta(days=30),
            )
            ExceptionService.create_exception(self.db, exception_data)
            assert False, "应该抛出MissingField异常"
        except MissingField:
            pass

    def _test_invalid_transition(self):
        from license_tracker.schemas import InvalidStatusTransition

        exception_data = LicenseExceptionCreate(
            dependency_name="invalid-transition",
            license_name="MIT",
            reason="测试无效流转",
            requested_by="tester@example.com",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        exc = ExceptionService.create_exception(self.db, exception_data)

        update = LicenseExceptionUpdate(
            status=ExceptionStatus.EXPIRED,
        )

        try:
            ExceptionService.update_exception_status(
                self.db, exc.id, update, "tester"
            )
            assert False, "应该抛出InvalidStatusTransition异常"
        except InvalidStatusTransition:
            pass

    def test_expiry_check(self):
        print("测试6: 到期提醒功能...")

        try:
            exception_data = LicenseExceptionCreate(
                dependency_name="expiring-soon",
                license_name="GPL-2.0",
                reason="即将到期测试",
                requested_by="tester@example.com",
                expires_at=datetime.utcnow() + timedelta(days=15),
            )
            exc = ExceptionService.create_exception(self.db, exception_data)

            update = LicenseExceptionUpdate(status=ExceptionStatus.APPROVED)
            ExceptionService.update_exception_status(
                self.db, exc.id, update, "reviewer"
            )

            expiring = ExceptionService.get_expiring_exceptions(self.db, days=30)
            has_expiring = any(e.id == exc.id for e in expiring)

            self.add_result(
                "到期提醒功能",
                has_expiring,
                f"找到 {len(expiring)} 个即将到期的例外"
            )
            print(f"  -> {'通过' if has_expiring else '失败'} (找到 {len(expiring)} 个)")
        except Exception as e:
            self.add_result("到期提醒功能", False, str(e))
            print(f"  -> 失败: {e}")

    def test_path_tracking(self):
        print("测试7: 路径追踪功能...")

        test_project = os.path.join(self.temp_dir, "test_project")
        os.makedirs(test_project, exist_ok=True)

        test_file = os.path.join(test_project, "test_import.py")
        with open(test_file, 'w') as f:
            f.write("import requests\n")
            f.write("from fastapi import FastAPI\n")
            f.write("print('test')\n")

        try:
            paths = PathTracker.track_imports(test_project, "requests")

            passed = len(paths) > 0
            self.add_result(
                "路径追踪功能",
                passed,
                f"找到 {len(paths)} 个导入路径"
            )
            print(f"  -> {'通过' if passed else '失败'} (找到 {len(paths)} 个)")
        except Exception as e:
            self.add_result("路径追踪功能", False, str(e))
            print(f"  -> 失败: {e}")

    def __del__(self):
        try:
            self.db.close()
        except:
            pass


if __name__ == "__main__":
    tester = SelfTest()
    sys.exit(tester.run())
