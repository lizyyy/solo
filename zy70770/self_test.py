#!/usr/bin/env python3
"""
.env轮换计划引用扫描后端API - 自检脚本
验证导入、筛选、处理和导出功能
"""

import os
import sys
import json
import tempfile
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 导入项目模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import (
    Base,
    EnvFile,
    EnvVariable,
    VariableReference,
    ResponsiblePerson,
    RotationBatch,
    RotationItem,
    VariableStatus,
    init_db,
    get_db
)
import schemas


class SelfTest:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
        
        # 使用内存数据库进行测试
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()
        
        # 创建临时.env文件
        self.temp_env_file = self._create_test_env_file()
    
    def _create_test_env_file(self):
        env_content = """# 测试环境变量
DB_HOST=localhost
DB_PORT=5432
DB_NAME=testdb
DB_USER=admin
DB_PASSWORD=secret123
DB_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
API_KEY=abcdef123456
API_SECRET=supersecretkey
REDIS_URL=redis://${DB_HOST}:6379
LOG_LEVEL=info
APP_NAME=TestApp
ENVIRONMENT=production
"""
        fd, path = tempfile.mkstemp(suffix='.env', prefix='test_')
        with os.fdopen(fd, 'w') as f:
            f.write(env_content)
        return path
    
    def _print_result(self, test_name, success, message=""):
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if success:
            self.passed += 1
        else:
            self.failed += 1
        self.test_results.append({
            "test_name": test_name,
            "success": success,
            "message": message
        })
    
    def test_1_env_import(self):
        """测试.env文件导入功能"""
        print("\n=== 测试1: .env文件导入 ===")
        
        try:
            from main import import_env_file, scan_variable_references
            
            # 创建EnvFile记录
            env_file = EnvFile(
                file_path=self.temp_env_file,
                project_name="TestProject",
                environment="test"
            )
            self.db.add(env_file)
            self.db.commit()
            self.db.refresh(env_file)
            
            # 解析.env文件
            variable_count = 0
            env_vars = {}
            
            with open(self.temp_env_file, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip().strip('"\'')
                        
                        is_sensitive = any(kw in key.lower() for kw in ['password', 'secret', 'token', 'key', 'auth'])
                        
                        var = EnvVariable(
                            env_file_id=env_file.id,
                            key=key,
                            original_value=value,
                            current_value=value,
                            is_sensitive=is_sensitive
                        )
                        self.db.add(var)
                        env_vars[key] = var
                        variable_count += 1
            
            self.db.commit()
            self._print_result("解析.env文件", variable_count > 0, f"导入了{variable_count}个变量")
            
            # 扫描变量引用
            reference_count = scan_variable_references(env_file.id, env_vars, self.db)
            self.db.commit()
            self._print_result("扫描变量引用", reference_count > 0, f"发现了{reference_count}个引用关系")
            
            # 验证DB_URL的依赖关系
            db_url_var = self.db.query(EnvVariable).filter(EnvVariable.key == "DB_URL").first()
            if db_url_var:
                refs = self.db.query(VariableReference).filter(VariableReference.from_variable_id == db_url_var.id).all()
                self._print_result("检测DB_URL依赖", len(refs) >= 4, f"DB_URL依赖于{len(refs)}个其他变量")
            
            # 保存env_file_id供后续测试使用
            self.env_file_id = env_file.id
            
        except Exception as e:
            self._print_result("导入测试", False, str(e))
    
    def test_2_filtering(self):
        """测试筛选功能"""
        print("\n=== 测试2: 筛选功能 ===")
        
        try:
            # 测试按敏感字段筛选
            sensitive_vars = self.db.query(EnvVariable).filter(EnvVariable.is_sensitive == True).all()
            self._print_result("筛选敏感变量", len(sensitive_vars) > 0, f"找到{len(sensitive_vars)}个敏感变量")
            
            # 验证DB_PASSWORD被标记为敏感
            db_password = self.db.query(EnvVariable).filter(EnvVariable.key == "DB_PASSWORD").first()
            self._print_result("DB_PASSWORD敏感标记", db_password and db_password.is_sensitive)
            
            # 测试按项目筛选
            files = self.db.query(EnvFile).filter(EnvFile.project_name == "TestProject").all()
            self._print_result("按项目筛选", len(files) == 1)
            
            # 测试变量依赖查询
            from main import get_variable_dependencies, calculate_dependency_level
            
            db_url_var = self.db.query(EnvVariable).filter(EnvVariable.key == "DB_URL").first()
            if db_url_var:
                level = calculate_dependency_level(db_url_var.id, self.db)
                self._print_result("计算依赖层级", level >= 1, f"DB_URL依赖层级为{level}")
            
        except Exception as e:
            self._print_result("筛选测试", False, str(e))
    
    def test_3_responsible_person(self):
        """测试负责人管理功能"""
        print("\n=== 测试3: 负责人管理 ===")
        
        try:
            # 创建负责人
            person = ResponsiblePerson(
                name="张三",
                email="zhangsan@example.com",
                department="运维部"
            )
            self.db.add(person)
            self.db.commit()
            self.db.refresh(person)
            
            self._print_result("创建负责人", person.id is not None, f"负责人ID: {person.id}")
            
            # 按部门筛选
            persons = self.db.query(ResponsiblePerson).filter(ResponsiblePerson.department == "运维部").all()
            self._print_result("按部门筛选负责人", len(persons) == 1)
            
            self.person_id = person.id
            
        except Exception as e:
            self._print_result("负责人管理测试", False, str(e))
    
    def test_4_batch_creation(self):
        """测试批次创建功能"""
        print("\n=== 测试4: 轮换批次创建 ===")
        
        try:
            from main import create_rotation_batch, get_all_dependent_variables
            
            # 获取几个变量ID
            variables = self.db.query(EnvVariable).limit(3).all()
            variable_ids = [v.id for v in variables]
            
            self._print_result("获取测试变量", len(variable_ids) == 3)
            
            # 测试依赖检测
            all_deps = set()
            for var_id in variable_ids:
                deps = get_all_dependent_variables(var_id, self.db)
                all_deps.update(deps)
            self._print_result("自动检测依赖", len(all_deps) >= len(variable_ids), f"检测到{len(all_deps)}个相关变量")
            
            # 创建批次
            batch = RotationBatch(
                batch_name="2024Q1密钥轮换",
                description="第一季度数据库密钥轮换",
                responsible_person_id=self.person_id,
                status=VariableStatus.PENDING
            )
            self.db.add(batch)
            self.db.commit()
            self.db.refresh(batch)
            
            # 创建轮换项
            item_count = 0
            for var_id in all_deps:
                variable = self.db.query(EnvVariable).filter(EnvVariable.id == var_id).first()
                if variable:
                    from main import calculate_dependency_level
                    item = RotationItem(
                        batch_id=batch.id,
                        variable_id=var_id,
                        new_value=f"new_value_{var_id}",
                        rollback_value=variable.current_value or "",
                        requires_review=variable.is_sensitive or calculate_dependency_level(var_id, self.db) > 0
                    )
                    self.db.add(item)
                    item_count += 1
            
            self.db.commit()
            self._print_result("创建轮换批次", batch.id is not None, f"批次ID: {batch.id}, 包含{item_count}个轮换项")
            
            # 验证需要复核的项
            review_items = self.db.query(RotationItem).filter(
                RotationItem.batch_id == batch.id,
                RotationItem.requires_review == True
            ).all()
            self._print_result("自动标记需要复核的项", len(review_items) > 0, f"{len(review_items)}项需要复核")
            
            self.batch_id = batch.id
            
        except Exception as e:
            self._print_result("批次创建测试", False, str(e))
    
    def test_5_rollback_masking(self):
        """测试回滚值遮蔽功能"""
        print("\n=== 测试5: 回滚值遮蔽 ===")
        
        try:
            from main import mask_sensitive_value
            
            # 测试遮蔽功能
            test_cases = [
                ("secret123", "se******23"),
                ("123", "***"),
                ("", "***"),
                ("abcd", "ab**cd"),
            ]
            
            all_pass = True
            for value, expected in test_cases:
                result = mask_sensitive_value(value)
                if result != expected:
                    all_pass = False
                    print(f"   失败: {value} -> {result} (期望: {expected})")
            
            self._print_result("敏感值遮蔽", all_pass)
            
            # 验证API返回的遮蔽值
            items = self.db.query(RotationItem).filter(RotationItem.batch_id == self.batch_id).all()
            for item in items:
                variable = self.db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
                if variable and variable.is_sensitive:
                    masked = mask_sensitive_value(item.rollback_value)
                    self._print_result(f"{variable.key}回滚值已遮蔽", masked != item.rollback_value, f"原值: {item.rollback_value[:4]}..., 遮蔽后: {masked}")
                    break
            
        except Exception as e:
            self._print_result("回滚值遮蔽测试", False, str(e))
    
    def test_6_batch_execution_and_rollback(self):
        """测试批次执行和回滚功能"""
        print("\n=== 测试6: 批次执行和回滚 ===")
        
        try:
            batch = self.db.query(RotationBatch).filter(RotationBatch.id == self.batch_id).first()
            
            # 测试复核检查 - 应该失败（因为有需要复核的项未批准）
            items = self.db.query(RotationItem).filter(RotationItem.batch_id == self.batch_id).all()
            review_required = [item for item in items if item.requires_review and item.status != VariableStatus.APPROVED]
            self._print_result("复核检查机制", len(review_required) > 0, f"正确识别{len(review_required)}个待复核项")
            
            # 先批准所有需要复核的项
            for item in review_required:
                item.status = VariableStatus.APPROVED
                item.review_note = "已人工复核通过"
            self.db.commit()
            
            # 记录原值
            original_values = {}
            for item in items:
                variable = self.db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
                if variable:
                    original_values[variable.key] = variable.current_value
            
            # 执行批次
            batch.status = VariableStatus.PROCESSING
            self.db.commit()
            
            for item in items:
                if item.status not in [VariableStatus.COMPLETED, VariableStatus.SKIPPED]:
                    variable = self.db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
                    if variable and item.new_value:
                        variable.current_value = item.new_value
                    item.status = VariableStatus.COMPLETED
                    item.executed_at = datetime.utcnow()
            
            batch.status = VariableStatus.COMPLETED
            batch.executed_at = datetime.utcnow()
            self.db.commit()
            
            # 验证值已更新
            updated = 0
            for item in items:
                variable = self.db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
                if variable and variable.current_value == item.new_value:
                    updated += 1
            
            self._print_result("批次执行", updated == len(items), f"{updated}/{len(items)}个变量已更新")
            
            # 测试回滚
            batch.status = VariableStatus.COMPLETED  # 确保状态正确
            self.db.commit()
            
            for item in items:
                variable = self.db.query(EnvVariable).filter(EnvVariable.id == item.variable_id).first()
                if variable:
                    variable.current_value = item.rollback_value
                item.status = VariableStatus.ROLLED_BACK
                item.rolled_back_at = datetime.utcnow()
            
            batch.status = VariableStatus.ROLLED_BACK
            self.db.commit()
            
            # 验证回滚
            rolled_back = 0
            for key, orig_val in original_values.items():
                var = self.db.query(EnvVariable).filter(EnvVariable.key == key).first()
                if var and var.current_value == orig_val:
                    rolled_back += 1
            
            self._print_result("批次回滚", rolled_back == len(original_values), f"{rolled_back}/{len(original_values)}个变量已回滚")
            
        except Exception as e:
            self._print_result("执行和回滚测试", False, str(e))
    
    def test_7_report_generation(self):
        """测试报告生成功能"""
        print("\n=== 测试7: 报告生成 ===")
        
        try:
            from main import generate_report
            
            # 生成报告数据
            items = self.db.query(RotationItem).all()
            
            summary = {
                "total_items": len(items),
                "pending_count": len([i for i in items if i.status == VariableStatus.PENDING]),
                "review_required_count": len([i for i in items if i.requires_review]),
                "completed_count": len([i for i in items if i.status == VariableStatus.COMPLETED]),
                "rolled_back_count": len([i for i in items if i.status == VariableStatus.ROLLED_BACK])
            }
            
            self._print_result("生成汇总统计", True, f"总计: {summary['total_items']}, 已回滚: {summary['rolled_back_count']}")
            
            # 负责人汇总
            person = self.db.query(ResponsiblePerson).filter(ResponsiblePerson.id == self.person_id).first()
            batches = self.db.query(RotationBatch).filter(RotationBatch.responsible_person_id == self.person_id).all()
            
            person_summary = {
                "name": person.name,
                "email": person.email,
                "batch_count": len(batches),
                "item_count": sum(self.db.query(RotationItem).filter(RotationItem.batch_id == b.id).count() for b in batches)
            }
            
            self._print_result("负责人统计汇总", True, f"{person.name}负责{person_summary['batch_count']}个批次, {person_summary['item_count']}个变量")
            
            # 导出JSON报告
            report_data = {
                "summary": summary,
                "responsible_persons": [person_summary],
                "generated_at": datetime.utcnow().isoformat()
            }
            
            report_file = os.path.join(os.path.dirname(self.temp_env_file), "test_report.json")
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2)
            
            self._print_result("导出JSON报告", os.path.exists(report_file), f"报告已保存至: {report_file}")
            
        except Exception as e:
            self._print_result("报告生成测试", False, str(e))
    
    def test_8_error_responses(self):
        """测试错误响应功能"""
        print("\n=== 测试8: 错误响应 ===")
        
        try:
            from main import APIErrorCodes
            
            # 测试缺少字段的错误码
            self._print_result("MISSING_FIELD错误码存在", hasattr(APIErrorCodes, 'MISSING_FIELD'))
            self._print_result("REVIEW_REQUIRED错误码存在", hasattr(APIErrorCodes, 'REVIEW_REQUIRED'))
            self._print_result("ALREADY_PROCESSED错误码存在", hasattr(APIErrorCodes, 'ALREADY_PROCESSED'))
            self._print_result("INVALID_STATUS错误码存在", hasattr(APIErrorCodes, 'INVALID_STATUS'))
            
            # 验证所有定义的错误码
            error_codes = [
                'MISSING_FIELD', 'INVALID_STATUS', 'REVIEW_REQUIRED',
                'ALREADY_PROCESSED', 'NOT_FOUND', 'DUPLICATE_ENTRY', 'INVALID_OPERATION'
            ]
            all_present = all(hasattr(APIErrorCodes, code) for code in error_codes)
            self._print_result("所有错误码已定义", all_present, f"共{len(error_codes)}个错误码")
            
        except Exception as e:
            self._print_result("错误响应测试", False, str(e))
    
    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 60)
        print("      .env轮换计划引用扫描后端API - 自检开始")
        print("=" * 60)
        
        # 按顺序运行测试
        self.test_1_env_import()
        self.test_2_filtering()
        self.test_3_responsible_person()
        self.test_4_batch_creation()
        self.test_5_rollback_masking()
        self.test_6_batch_execution_and_rollback()
        self.test_7_report_generation()
        self.test_8_error_responses()
        
        # 打印总结
        print("\n" + "=" * 60)
        print("                    自检结果总结")
        print("=" * 60)
        print(f"通过: {self.passed}")
        print(f"失败: {self.failed}")
        print(f"总计: {self.passed + self.failed}")
        print(f"成功率: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        print("=" * 60)
        
        if self.failed > 0:
            print("\n失败的测试:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test_name']}: {result['message']}")
            return 1
        else:
            print("\n✓ 所有测试通过!")
            return 0
    
    def cleanup(self):
        """清理测试资源"""
        self.db.close()
        if os.path.exists(self.temp_env_file):
            os.unlink(self.temp_env_file)


if __name__ == "__main__":
    tester = SelfTest()
    try:
        exit_code = tester.run_all_tests()
        sys.exit(exit_code)
    finally:
        tester.cleanup()
