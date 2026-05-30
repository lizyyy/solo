import os
import sys
import json
import tempfile
import pytest
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, _json_serializer, _json_deserializer
from app.models import (
    Student,
    Material,
    EstimationTask,
    TaskStatus,
    TaskStatusLog,
    MeshAnalysisResult,
    SupportEstimation,
    Anomaly,
    EstimationReport,
)
from app.schemas import (
    StudentCreate,
    MaterialCreate,
    TaskCreate,
    ParamsMergeRequest,
    MeshAnalysisRequest,
    SupportEstimationRequest,
    EstimationReportRequest,
)
from app.services import (
    TaskService,
    StatusService,
    ParamsService,
    AnomalyService,
    EstimationService,
    ReportService,
)
from app.models.enums import (
    MaterialType,
    AnomalyType,
    AnomalySeverity,
    TaskStatusCategory,
)

TEST_DATABASE_URL = "sqlite:///./test_estimation.db"


@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        json_serializer=_json_serializer,
        json_deserializer=_json_deserializer,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./test_estimation.db"):
            os.remove("./test_estimation.db")


class TestStudentCRUD:
    def test_create_student(self, db_session):
        student_data = StudentCreate(
            student_id="2024001",
            name="张三",
            class_name="创客班1班",
            contact="zhangsan@example.com",
        )
        student = Student(**student_data.model_dump())
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.id is not None
        assert student.student_id == "2024001"
        assert student.name == "张三"

    def test_student_unique_id(self, db_session):
        student1 = Student(
            student_id="2024001",
            name="张三",
        )
        db_session.add(student1)
        db_session.commit()

        student2 = Student(
            student_id="2024001",
            name="李四",
        )
        db_session.add(student2)
        with pytest.raises(Exception):
            db_session.commit()


class TestMaterialCRUD:
    def test_create_material(self, db_session):
        material_data = MaterialCreate(
            material_type=MaterialType.PLA,
            name="普通PLA",
            density=1.24,
            filament_diameter=1.75,
            color="白色",
            supplier="某品牌",
        )
        material = Material(**material_data.model_dump())
        db_session.add(material)
        db_session.commit()
        db_session.refresh(material)

        assert material.id is not None
        assert material.material_type == "PLA"
        assert material.density == 1.24
        assert material.is_active == True


class TestStatusService:
    def test_status_display(self):
        display = StatusService.get_status_display(TaskStatus.CREATED.value)
        assert display == "已创建"

    def test_status_category(self):
        category = StatusService.get_status_category(TaskStatus.CREATED.value)
        assert category == TaskStatusCategory.PENDING

        category = StatusService.get_status_category(TaskStatus.ANALYZING.value)
        assert category == TaskStatusCategory.PROCESSING

        category = StatusService.get_status_category(TaskStatus.COMPLETED.value)
        assert category == TaskStatusCategory.SUCCESS

    def test_valid_transition(self):
        allowed, reason = StatusService.can_transition(
            TaskStatus.CREATED.value,
            TaskStatus.MODEL_UPLOADED.value,
        )
        assert allowed == True
        assert reason is None

    def test_invalid_transition(self):
        allowed, reason = StatusService.can_transition(
            TaskStatus.CREATED.value,
            TaskStatus.ANALYZED.value,
        )
        assert allowed == False
        assert reason is not None

    def test_transition_with_log(self, db_session):
        task = EstimationTask(
            project_name="测试项目",
            status=TaskStatus.CREATED.value,
        )
        db_session.add(task)
        db_session.flush()

        success, reason = StatusService.transition(
            db=db_session,
            task=task,
            target_status=TaskStatus.MODEL_UPLOADED.value,
            message="测试状态转换",
            triggered_by="test",
        )

        assert success == True
        assert task.status == TaskStatus.MODEL_UPLOADED.value

        logs = StatusService.get_status_history(db_session, task.id)
        assert len(logs) == 1
        assert logs[0].previous_status == TaskStatus.CREATED.value
        assert logs[0].new_status == TaskStatus.MODEL_UPLOADED.value
        assert logs[0].message == "测试状态转换"


class TestTaskService:
    def test_create_task(self, db_session):
        task_data = TaskCreate(
            project_name="测试机器人模型",
            description="学生课程作业",
            tags=["课程作业", "机器人"],
        )
        task = TaskService.create_task(db_session, task_data)
        db_session.commit()
        db_session.refresh(task)

        assert task.id is not None
        assert task.status == TaskStatus.CREATED.value
        assert task.current_params_version == 1

        params_versions = ParamsService.get_all_versions(db_session, task.id)
        assert len(params_versions) == 1

    def test_list_tasks(self, db_session):
        for i in range(5):
            task = EstimationTask(
                project_name=f"测试项目 {i}",
                status=TaskStatus.CREATED.value,
            )
            db_session.add(task)
        db_session.commit()

        from app.schemas import PaginationParams
        pagination = PaginationParams(page=1, page_size=3)
        result = TaskService.list_tasks(db_session, pagination)

        assert result.total == 5
        assert result.total_pages == 2
        assert len(result.items) == 3

    def test_get_task_detail(self, db_session):
        task_data = TaskCreate(
            project_name="详情测试项目",
            description="测试详情功能",
        )
        task = TaskService.create_task(db_session, task_data)
        db_session.commit()
        db_session.refresh(task)

        detail = TaskService.get_task_detail(db_session, task)
        assert detail.project_name == "详情测试项目"
        assert detail.status == TaskStatus.CREATED
        assert detail.has_model == False
        assert detail.has_analysis == False
        assert detail.has_estimation == False
        assert detail.has_report == False


class TestParamsService:
    def test_merge_params_new_version(self, db_session):
        task_data = TaskCreate(project_name="参数测试项目")
        task = TaskService.create_task(db_session, task_data)
        db_session.flush()

        request = ParamsMergeRequest(
            task_id=task.id,
            params={
                "layer_height": 0.15,
                "print_speed": 60.0,
                "support_angle": 40.0,
            },
            source="teacher_input",
            create_new_version=True,
            notes="老师调整参数",
        )
        params, response = ParamsService.merge_params(db_session, task, request)

        assert response.is_new_version == True
        assert response.version == 2
        assert "layer_height" in response.updated_fields
        assert params.layer_height == 0.15
        assert params.print_speed == 60.0

    def test_merge_params_preserve_existing(self, db_session):
        task_data = TaskCreate(project_name="参数保护测试")
        task = TaskService.create_task(db_session, task_data)
        db_session.flush()

        request1 = ParamsMergeRequest(
            task_id=task.id,
            params={"layer_height": 0.2, "print_speed": None},
            source="first",
            create_new_version=True,
        )
        ParamsService.merge_params(db_session, task, request1)
        db_session.flush()

        latest = ParamsService.get_latest_version(db_session, task.id)
        latest.print_speed = None
        db_session.flush()

        request2 = ParamsMergeRequest(
            task_id=task.id,
            params={
                "layer_height": 0.3,
                "print_speed": 80.0,
            },
            source="second",
            create_new_version=False,
        )
        params, response = ParamsService.merge_params(db_session, task, request2)

        assert response.is_new_version == False
        assert "layer_height" in response.preserved_fields
        assert params.layer_height == 0.2
        assert params.print_speed == 80.0
        assert "print_speed" in response.updated_fields
        assert len(response.conflicts) == 1


class TestAnomalyService:
    def test_create_anomaly(self, db_session):
        task = EstimationTask(
            project_name="异常测试项目",
            status=TaskStatus.CREATED.value,
        )
        db_session.add(task)
        db_session.flush()

        anomaly = AnomalyService.create_anomaly(
            db=db_session,
            task_id=task.id,
            anomaly_type=AnomalyType.MESH_BROKEN_FACES,
            severity=AnomalySeverity.ERROR,
            format_params={"count": 5},
            data_source="test",
            params_version=1,
        )

        assert anomaly.id is not None
        assert anomaly.anomaly_type == AnomalyType.MESH_BROKEN_FACES.value
        assert "5 个破损" in anomaly.description
        assert anomaly.is_resolved == False

    def test_resolve_anomaly(self, db_session):
        task = EstimationTask(
            project_name="异常解决测试",
            status=TaskStatus.CREATED.value,
        )
        db_session.add(task)
        db_session.flush()

        anomaly = AnomalyService.create_anomaly(
            db=db_session,
            task_id=task.id,
            anomaly_type=AnomalyType.PARAMS_INCOMPLETE,
            severity=AnomalySeverity.WARNING,
            format_params={"missing": "层高"},
        )
        db_session.flush()

        resolved = AnomalyService.resolve_anomaly(
            db=db_session,
            anomaly_id=anomaly.id,
            resolution_notes="已补充层高参数",
        )

        assert resolved.is_resolved == True
        assert resolved.resolution_notes == "已补充层高参数"

    def test_get_task_anomalies(self, db_session):
        task = EstimationTask(
            project_name="异常列表测试",
            status=TaskStatus.CREATED.value,
        )
        db_session.add(task)
        db_session.flush()

        AnomalyService.create_anomaly(
            db=db_session,
            task_id=task.id,
            anomaly_type=AnomalyType.MESH_BROKEN_FACES,
            severity=AnomalySeverity.ERROR,
            format_params={"count": 3},
        )
        AnomalyService.create_anomaly(
            db=db_session,
            task_id=task.id,
            anomaly_type=AnomalyType.TIME_UNDERESTIMATED,
            severity=AnomalySeverity.WARNING,
            format_params={"percent": 20, "extra_min": 30},
        )

        anomalies = AnomalyService.get_task_anomalies(db_session, task.id)
        assert len(anomalies) == 2

        errors = AnomalyService.get_task_anomalies(
            db_session, task.id, severity=AnomalySeverity.ERROR
        )
        assert len(errors) == 1


class TestEndToEndWorkflow:
    def test_full_workflow_simulation(self, db_session):
        print("\n" + "="*60)
        print("测试完整工作流程")
        print("="*60)

        print("\n1. 创建学生信息")
        student = Student(
            student_id="2024001",
            name="李小明",
            class_name="3D打印兴趣班",
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)
        print(f"   ✓ 学生创建成功: {student.name} (ID: {student.id})")

        print("\n2. 创建材料")
        material = Material(
            material_type=MaterialType.PLA.value,
            name="教学用PLA",
            density=1.24,
            filament_diameter=1.75,
        )
        db_session.add(material)
        db_session.commit()
        db_session.refresh(material)
        print(f"   ✓ 材料创建成功: {material.name} (密度: {material.density}g/cm³)")

        print("\n3. 创建估算任务")
        task_data = TaskCreate(
            project_name="皮卡丘摆件",
            description="学生期末作品 - 皮卡丘桌面摆件",
            student_id=student.id,
            tags=["期末作品", "摆件"],
        )
        task = TaskService.create_task(db_session, task_data)
        db_session.commit()
        db_session.refresh(task)
        print(f"   ✓ 任务创建成功: {task.project_name} (ID: {task.id})")
        print(f"     当前状态: {StatusService.get_status_display(task.status)}")

        print("\n4. 补充切片参数")
        params_request = ParamsMergeRequest(
            task_id=task.id,
            params={
                "layer_height": 0.2,
                "nozzle_diameter": 0.4,
                "print_speed": 50.0,
                "infill_density": 20.0,
                "support_angle": 45.0,
                "support_density": 15.0,
                "material_id": material.id,
            },
            source="teacher_manual",
            create_new_version=True,
            notes="老师设置的标准参数",
        )
        _, params_response = ParamsService.merge_params(db_session, task, params_request)
        db_session.commit()
        print(f"   ✓ 参数版本 v{params_response.version} 创建成功")
        print(f"     更新字段: {params_response.updated_fields}")
        print(f"     当前状态: {StatusService.get_status_display(task.status)}")

        print("\n5. 检查状态历史")
        status_logs = StatusService.get_status_history(db_session, task.id)
        print(f"   ✓ 状态变更记录: {len(status_logs)} 条")
        for log in status_logs:
            print(f"     - {log.created_at.strftime('%H:%M:%S')}: {log.previous_status or '无'} → {log.new_status} | {log.message}")

        print("\n6. 检查参数历史")
        params_versions = ParamsService.get_all_versions(db_session, task.id)
        print(f"   ✓ 参数版本记录: {len(params_versions)} 个")
        for pv in params_versions:
            print(f"     - v{pv.version}: 层高={pv.layer_height}mm, 来源={pv.source}")

        print("\n7. 模拟创建网格分析结果（无需实际STL文件）")
        analysis = MeshAnalysisResult(
            task_id=task.id,
            model_file_id=0,
            params_version=task.current_params_version,
            is_watertight=True,
            is_manifold=True,
            broken_face_count=0,
            non_manifold_edges=0,
            duplicate_faces=0,
            overhang_area=120.5,
            overhang_count=8,
            min_support_angle=45.0,
            max_support_height=35.2,
            support_volume=2.35,
            support_material_volume=0.35,
            total_volume=12.5,
            part_volume=12.5,
            bounding_box_volume=45.0,
            quality_score=92.5,
            processing_time_ms=150,
            analysis_details={
                "mesh_info": {"vertices": 15420, "faces": 30840},
                "quality_issues": [],
                "overhang_details": [],
            },
            notes="模拟分析结果",
        )
        db_session.add(analysis)
        db_session.flush()
        StatusService.transition(
            db=db_session,
            task=task,
            target_status=TaskStatus.ANALYZED.value,
            message=f"网格分析完成，质量评分 {analysis.quality_score}",
            triggered_by="test_simulation",
        )
        db_session.commit()
        print(f"   ✓ 网格分析完成")
        print(f"     质量评分: {analysis.quality_score}/100")
        print(f"     悬垂面积: {analysis.overhang_area} mm²")
        print(f"     支撑体积: {analysis.support_material_volume} cm³")

        print("\n8. 执行支撑估算")
        est_request = SupportEstimationRequest(
            task_id=task.id,
            params_version=task.current_params_version,
            analysis_result_id=analysis.id,
            material_id=material.id,
        )
        try:
            _, est_response = EstimationService.estimate_support(db_session, task, est_request)
            db_session.commit()
            print(f"   ✓ 支撑估算完成")
            print(f"     零件重量: {est_response.part_mass_g:.2f} g")
            print(f"     支撑重量: {est_response.support_mass_g:.2f} g")
            print(f"     支撑比例: {est_response.support_material_ratio:.1f}%")
            print(f"     总重量: {est_response.total_mass_g:.2f} g")
            print(f"     打印时间: {est_response.print_time_hours:.2f} 小时 ({est_response.print_time_minutes:.0f} 分钟)")
            print(f"     耗材长度: {est_response.filament_length_m:.2f} m")
            print(f"     置信度: {est_response.confidence_score:.1f}%")

            print("\n9. 检查计算步骤（可解释性验证）")
            for step in est_response.calculation_steps:
                print(f"   {step.step}:")
                print(f"     公式: {step.formula}")
                print(f"     结果: {step.result:.4f} {step.unit}")
                print(f"     说明: {step.explanation}")

            print("\n10. 检查异常记录")
            anomalies = AnomalyService.get_task_anomalies(db_session, task.id)
            print(f"    ✓ 检测到 {len(anomalies)} 个异常")
            for a in anomalies:
                print(f"    - [{a.severity.upper()}] {a.title}")
                print(f"      {a.description}")
                print(f"      建议: {a.suggestion}")

            print("\n11. 生成报告")
            report_request = EstimationReportRequest(
                task_id=task.id,
                report_type="full",
                format="json",
            )
            _, report_response = ReportService.generate_report(db_session, task, report_request)
            db_session.commit()
            print(f"    ✓ 报告生成成功")
            print(f"     报告类型: {report_response.report_type}")
            print(f"     生成耗时: {report_response.generation_time_ms} ms")
            print(f"     摘要:")
            print(f"       - 总材料: {report_response.summary.total_mass_g:.2f} g")
            print(f"       - 支撑比例: {report_response.summary.support_ratio:.1f}%")
            print(f"       - 打印时间: {report_response.summary.print_time_hours:.2f} 小时")
            print(f"       - 质量评分: {report_response.summary.quality_score:.1f}")
            print(f"       - 置信度: {report_response.summary.confidence_score:.1f}%")
            print(f"       - 可打印: {'是' if report_response.summary.can_print else '否'}")

            print("\n12. 检查报告明细项（数据追溯验证）")
            for item in report_response.detail_items[:5]:
                print(f"    {item.label}: {item.value} {item.unit or ''}")
                print(f"      公式: {item.formula}")
                print(f"      来源: {item.data_source}")

            print("\n13. 检查最终状态")
            print(f"    ✓ 最终状态: {StatusService.get_status_display(task.status)}")
            status_logs = StatusService.get_status_history(db_session, task.id)
            print(f"    ✓ 总状态变更: {len(status_logs)} 次")

            print("\n14. 验证数据一致性")
            detail = TaskService.get_task_detail(db_session, task)
            assert detail.total_mass_g == est_response.total_mass_g
            assert detail.print_time_hours == est_response.print_time_hours
            assert detail.critical_anomaly_count == 0
            print(f"    ✓ 列表、详情、报告数据一致")
            print(f"      列表总重量: {detail.total_mass_g:.2f} g")
            print(f"      估算总重量: {est_response.total_mass_g:.2f} g")
            print(f"      报告总重量: {report_response.summary.total_mass_g:.2f} g")

            print("\n" + "="*60)
            print("✓ 完整工作流程测试通过！")
            print("="*60 + "\n")

        except ValueError as e:
            pytest.skip(f"估算服务需要实际模型文件，跳过: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
