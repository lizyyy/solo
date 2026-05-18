#!/usr/bin/env python3
"""
材料包备料管理系统自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import schemas
import crud
from database import Base

DATABASE_URL = "sqlite:///./test_material_kit.db"


class SelfCheckTester:
    def __init__(self):
        self.engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.SessionLocal()
        self.results = []
        self.passed = 0
        self.failed = 0

    def setup(self):
        print("=" * 60)
        print("初始化测试数据库...")
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        print("数据库初始化完成")
        print("=" * 60)

    def test_case(self, name, func):
        print(f"\n{'='*60}")
        print(f"测试: {name}")
        print(f"{'='*60}")
        try:
            result = func()
            if result:
                print(f"✓ 通过: {name}")
                self.passed += 1
                self.results.append((name, True, ""))
                return True
            else:
                print(f"✗ 失败: {name}")
                self.failed += 1
                self.results.append((name, False, "返回False"))
                return False
        except Exception as e:
            print(f"✗ 失败: {name} - {str(e)}")
            self.failed += 1
            self.results.append((name, False, str(e)))
            return False

    def test_1_import_basic_data(self):
        """测试1: 导入基础数据（课程、学员、材料包）"""
        print("1. 创建课程...")
        course1 = schemas.CourseCreate(
            name="手工陶艺入门班",
            description="零基础陶艺课程",
            course_date=datetime(2024, 6, 15, 14, 0),
            max_students=20
        )
        self.course1 = crud.create_course(self.db, course1)
        assert self.course1.id is not None

        course2 = schemas.CourseCreate(
            name="油画技法进阶班",
            description="进阶油画技巧训练",
            course_date=datetime(2024, 6, 20, 10, 0),
            max_students=15
        )
        self.course2 = crud.create_course(self.db, course2)
        assert self.course2.id is not None
        print(f"   - 创建2个课程: {self.course1.name}, {self.course2.name}")

        print("2. 创建学员...")
        students = [
            {"name": "张三", "phone": "13800138001", "email": "zhangsan@test.com"},
            {"name": "李四", "phone": "13800138002", "email": "lisi@test.com"},
            {"name": "王五", "phone": "13800138003", "email": "wangwu@test.com"},
            {"name": "赵六", "phone": "13800138004", "email": "zhaoliu@test.com"},
        ]
        self.students = []
        for s in students:
            student = crud.create_student(self.db, schemas.StudentCreate(**s))
            self.students.append(student)
            assert student.id is not None
        print(f"   - 创建{len(self.students)}个学员")

        print("3. 创建材料包...")
        materials = [
            {"name": "陶艺基础套装", "description": "陶土+工具组合", "unit": "套", "total_quantity": 30, "warning_threshold": 5},
            {"name": "釉料套装", "description": "5色基础釉料", "unit": "套", "total_quantity": 25, "warning_threshold": 5},
            {"name": "油画颜料套装", "description": "12色专业颜料", "unit": "套", "total_quantity": 20, "warning_threshold": 3},
            {"name": "画笔套装", "description": "10支专业画笔", "unit": "套", "total_quantity": 18, "warning_threshold": 3},
        ]
        self.materials = []
        for m in materials:
            material = crud.create_material_kit(self.db, schemas.MaterialKitCreate(**m))
            self.materials.append(material)
            assert material.id is not None
            assert material.available_quantity == m["total_quantity"]
        print(f"   - 创建{len(self.materials)}个材料包")

        print("4. 配置课程材料...")
        course_materials = [
            (self.course1.id, self.materials[0].id, 1),
            (self.course1.id, self.materials[1].id, 1),
            (self.course2.id, self.materials[2].id, 1),
            (self.course2.id, self.materials[3].id, 1),
        ]
        for course_id, material_id, qty in course_materials:
            cmk = crud.create_course_material_kit(
                self.db,
                schemas.CourseMaterialKitCreate(
                    course_id=course_id,
                    material_kit_id=material_id,
                    quantity_per_student=qty
                )
            )
            assert cmk.id is not None
        print(f"   - 配置{len(course_materials)}个课程材料关联")

        return True

    def test_2_registration_and_lock(self):
        """测试2: 报名与锁料"""
        print("1. 学员报名...")
        for i, student in enumerate(self.students):
            course = self.course1 if i < 3 else self.course2
            reg_data = schemas.RegistrationCreate(
                course_id=course.id,
                student_id=student.id,
                notes=f"第{i+1}个报名"
            )
            result = crud.create_registration(self.db, reg_data)
            assert result["registration"].status == "registered"
            print(f"   - {student.name} 报名 {course.name}")

        print("2. 验证材料锁定...")
        for material in self.materials[:2]:
            self.db.refresh(material)
            expected_reserved = 3
            assert material.reserved_quantity == expected_reserved, f"{material.name} reserved={material.reserved_quantity}, expected={expected_reserved}"
            print(f"   - {material.name}: 总库存={material.total_quantity}, 已锁定={material.reserved_quantity}, 可用={material.available_quantity}")

        return True

    def test_3_filter_and_query(self):
        """测试3: 筛选与查询功能"""
        print("1. 按状态筛选报名...")
        registrations = crud.get_course_registrations(self.db, self.course1.id, status="registered")
        assert len(registrations) == 3
        print(f"   - 课程1已报名人数: {len(registrations)}")

        print("2. 筛选有预警的材料包...")
        warning_materials = crud.get_material_kits(self.db, has_warning=True)
        print(f"   - 当前有预警的材料包数量: {len(warning_materials)}")

        print("3. 查看库存变更记录...")
        stock_records = self.db.query(models.StockRecord).filter(
            models.StockRecord.change_type == "reserve"
        ).all()
        assert len(stock_records) > 0
        print(f"   - 锁料记录数量: {len(stock_records)}")
        for record in stock_records[:2]:
            print(f"     * {record.notes} - 数量变更: {record.change_quantity}")

        return True

    def test_4_drop_and_release(self):
        """测试4: 退课与材料释放"""
        print("1. 学员退课...")
        registration = self.db.query(models.Registration).filter(
            models.Registration.student_id == self.students[0].id
        ).first()
        assert registration is not None

        drop_result = crud.drop_course(
            self.db,
            schemas.DropRecordCreate(
                registration_id=registration.id,
                drop_type="normal",
                reason="时间冲突",
                needs_review=False
            )
        )
        assert drop_result["registration"].status == "dropped"
        assert drop_result["drop_record"].id is not None
        print(f"   - {self.students[0].name} 退课成功")

        print("2. 验证材料释放...")
        for material in self.materials[:2]:
            self.db.refresh(material)
            expected_reserved = 2
            assert material.reserved_quantity == expected_reserved, f"{material.name} reserved={material.reserved_quantity}, expected={expected_reserved}"
            print(f"   - {material.name}: 总库存={material.total_quantity}, 已锁定={material.reserved_quantity}, 可用={material.available_quantity}")

        print("3. 退课记录查询...")
        drop_records = crud.get_drop_records(self.db, course_id=self.course1.id)
        assert len(drop_records) == 1
        print(f"   - 课程1退课记录数: {len(drop_records)}")

        return True

    def test_5_transfer_course(self):
        """测试5: 换课功能"""
        print("1. 学员换课...")
        old_registration = self.db.query(models.Registration).filter(
            models.Registration.student_id == self.students[1].id,
            models.Registration.status == "registered"
        ).first()
        assert old_registration is not None

        transfer_result = crud.transfer_course(
            self.db,
            schemas.TransferCourseRequest(
                registration_id=old_registration.id,
                target_course_id=self.course2.id,
                reason="对油画更感兴趣"
            )
        )
        assert transfer_result["old_registration"].status == "transferred"
        assert transfer_result["new_registration"].status == "registered"
        print(f"   - {self.students[1].name} 从 {self.course1.name} 换到 {self.course2.name}")

        print("2. 验证材料转移...")
        self.db.refresh(self.materials[0])
        self.db.refresh(self.materials[2])
        print(f"   - 陶艺套装锁定数量: {self.materials[0].reserved_quantity} (应为1)")
        print(f"   - 油画颜料锁定数量: {self.materials[2].reserved_quantity} (应为2)")

        return True

    def test_6_error_handling(self):
        """测试6: 错误处理机制"""
        print("1. 测试重复报名...")
        try:
            crud.create_registration(
                self.db,
                schemas.RegistrationCreate(
                    course_id=self.course2.id,
                    student_id=self.students[1].id
                )
            )
            assert False, "应该抛出异常"
        except crud.BusinessException as e:
            assert e.error_code == "ALREADY_REGISTERED"
            print(f"   - 错误类型: {e.error_type}, 错误码: {e.error_code}")
            print(f"   - 错误信息: {e.message}")

        print("2. 测试状态不允许退课...")
        dropped_reg = self.db.query(models.Registration).filter(
            models.Registration.status == "dropped"
        ).first()
        try:
            crud.drop_course(
                self.db,
                schemas.DropRecordCreate(
                    registration_id=dropped_reg.id,
                    drop_type="normal"
                )
            )
            assert False, "应该抛出异常"
        except crud.BusinessException as e:
            assert e.error_code == "INVALID_STATUS"
            print(f"   - 错误类型: {e.error_type}, 错误码: {e.error_code}")

        print("3. 测试重复复核...")
        drop_record = self.db.query(models.DropRecord).first()
        crud.review_drop_record(self.db, drop_record.id, "管理员A")
        try:
            crud.review_drop_record(self.db, drop_record.id, "管理员B")
            assert False, "应该抛出异常"
        except crud.BusinessException as e:
            assert e.error_code == "ALREADY_REVIEWED"
            print(f"   - 错误类型: {e.error_type}, 错误码: {e.error_code}")

        return True

    def test_7_shortage_warning(self):
        """测试7: 缺料预警"""
        print("1. 减少库存制造缺料情况...")
        crud.update_material_kit(
            self.db,
            self.materials[2].id,
            schemas.MaterialKitUpdate(total_quantity=1)
        )

        print("2. 尝试报名触发缺料预警...")
        new_student = crud.create_student(
            self.db,
            schemas.StudentCreate(name="测试学员", phone="13900139001")
        )
        result = crud.create_registration(
            self.db,
            schemas.RegistrationCreate(
                course_id=self.course2.id,
                student_id=new_student.id
            )
        )
        print(f"   - 需要人工复核: {result['needs_review']}")
        if result["warnings"]:
            for warning in result["warnings"]:
                print(f"   - 预警: {warning['material_name']} - {warning['level']}")

        print("3. 生成备料报告...")
        report_result = crud.generate_preparation_report(
            self.db,
            schemas.PreparationReportCreate(
                course_id=self.course2.id,
                generated_by="系统管理员"
            )
        )
        print(f"   - 报告是否有预警: {report_result['report'].has_warnings}")
        print(f"   - 净报名人数: {report_result['report'].net_registered}")
        print(f"   - 退课人数: {report_result['report'].total_dropped}")
        if report_result["material_warnings"]:
            for warning in report_result["material_warnings"]:
                print(f"   - 缺料预警: {warning['material_name']} - 缺少{warning['shortage']}{warning.get('unit','')}")

        return True

    def test_8_report_export(self):
        """测试8: 报告导出"""
        print("1. 获取备料报告列表...")
        reports = crud.get_preparation_reports(self.db, has_warnings=True)
        assert len(reports) > 0
        print(f"   - 有预警的报告数量: {len(reports)}")

        print("2. 导出报告数据...")
        report = reports[0]
        import json
        materials_summary = json.loads(report.materials_summary)
        warning_details = json.loads(report.warning_details) if report.warning_details else []

        export_data = {
            "report_id": report.id,
            "course_id": report.course_id,
            "generated_at": report.created_at.isoformat(),
            "generated_by": report.generated_by,
            "summary": {
                "total_registered": report.total_registered,
                "total_dropped": report.total_dropped,
                "net_registered": report.net_registered
            },
            "materials": materials_summary,
            "warnings": warning_details
        }
        print(f"   - 报告ID: {export_data['report_id']}")
        print(f"   - 生成者: {export_data['generated_by']}")
        print(f"   - 材料清单数量: {len(export_data['materials'])}")
        print(f"   - 预警数量: {len(export_data['warnings'])}")

        return True

    def print_summary(self):
        print("\n" + "=" * 60)
        print("自检结果汇总")
        print("=" * 60)
        print(f"总测试数: {self.passed + self.failed}")
        print(f"通过: {self.passed}")
        print(f"失败: {self.failed}")
        print(f"通过率: {self.passed/(self.passed+self.failed)*100:.1f}%")
        print("\n详细结果:")
        for name, passed, msg in self.results:
            status = "✓" if passed else "✗"
            print(f"{status} {name}")
            if not passed and msg:
                print(f"   错误: {msg}")
        print("=" * 60)

    def cleanup(self):
        self.db.close()
        if os.path.exists("./test_material_kit.db"):
            os.remove("./test_material_kit.db")

    def run_all(self):
        self.setup()
        
        self.test_case("导入基础数据", self.test_1_import_basic_data)
        self.test_case("报名与锁料", self.test_2_registration_and_lock)
        self.test_case("筛选与查询", self.test_3_filter_and_query)
        self.test_case("退课与材料释放", self.test_4_drop_and_release)
        self.test_case("换课功能", self.test_5_transfer_course)
        self.test_case("错误处理机制", self.test_6_error_handling)
        self.test_case("缺料预警", self.test_7_shortage_warning)
        self.test_case("报告导出", self.test_8_report_export)
        
        self.print_summary()
        self.cleanup()
        
        return self.failed == 0


if __name__ == "__main__":
    tester = SelfCheckTester()
    success = tester.run_all()
    sys.exit(0 if success else 1)
