#!/usr/bin/env python3
"""
排污许可超标预警 API - 完整流程演示脚本
从空数据库开始，演示完整业务流程
"""

import json
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, engine
from app import models, schemas, services

BASE_URL = "http://127.0.0.1:8000"


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    db_path = Path(__file__).parent / "discharge_warning.db"
    if db_path.exists():
        print(f"⚠️  检测到现有数据库: {db_path}")
        print("   演示需要从空环境开始，正在删除旧数据库...")
        db_path.unlink()
    
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print_section("步骤 1: 创建企业信息")
        company_data = {
            "company_code": "COMP_001",
            "company_name": "蓝天化工有限公司",
            "industry_type": "化工",
            "region": "华东区"
        }
        company = models.Company(**company_data)
        db.add(company)
        db.commit()
        db.refresh(company)
        print(f"✅ 创建企业: {company.company_name} (ID: {company.id})")
        
        print_section("步骤 2: 导入排污许可证及许可指标")
        permit_data = schemas.PermitCreate(
            permit_no="PWXK_2024_001",
            company_code="COMP_001",
            valid_from=date(2024, 1, 1),
            valid_to=date(2026, 12, 31),
            status="active",
            indicators=[
                schemas.PermitIndicatorCreate(
                    indicator_name="化学需氧量(COD)",
                    indicator_code="COD",
                    discharge_point="排水口1号",
                    unit="mg/L",
                    limit_value=50.0,
                    frequency="日"
                ),
                schemas.PermitIndicatorCreate(
                    indicator_name="氨氮(NH3-N)",
                    indicator_code="NH3N",
                    discharge_point="排水口1号",
                    unit="mg/L",
                    limit_value=5.0,
                    frequency="日"
                ),
                schemas.PermitIndicatorCreate(
                    indicator_name="总磷(TP)",
                    indicator_code="TP",
                    discharge_point="排水口2号",
                    unit="mg/L",
                    limit_value=0.5,
                    frequency="周"
                )
            ]
        )
        
        permit = services.create_permit(db, permit_data)
        print(f"✅ 导入许可证: {permit.permit_no}")
        print(f"   许可指标数量: {len(permit.indicators)}")
        for ind in permit.indicators:
            print(f"   - {ind.indicator_name}: 限值 {ind.limit_value}{ind.unit} ({ind.discharge_point})")
        
        print_section("步骤 3: 导入检测报告（触发超标判定）")
        sample_time1 = datetime(2024, 5, 10, 9, 30, 0)
        sample_time2 = datetime(2024, 5, 10, 14, 0, 0)
        
        report_data = schemas.InspectionReportCreate(
            report_no="JC_20240510_001",
            company_code="COMP_001",
            inspection_date=date(2024, 5, 10),
            inspection_agency="市环境监测中心",
            report_type="日常监测",
            data_items=[
                schemas.InspectionDataCreate(
                    indicator_code="COD",
                    discharge_point="排水口1号",
                    sample_time=sample_time1,
                    measured_value=45.0,
                    sample_method="重铬酸钾法"
                ),
                schemas.InspectionDataCreate(
                    indicator_code="COD",
                    discharge_point="排水口1号",
                    sample_time=sample_time2,
                    measured_value=120.0,
                    sample_method="重铬酸钾法"
                ),
                schemas.InspectionDataCreate(
                    indicator_code="NH3N",
                    discharge_point="排水口1号",
                    sample_time=sample_time1,
                    measured_value=3.2,
                    sample_method="纳氏试剂分光光度法"
                ),
                schemas.InspectionDataCreate(
                    indicator_code="NH3N",
                    discharge_point="排水口1号",
                    sample_time=sample_time2,
                    measured_value=15.0,
                    sample_method="纳氏试剂分光光度法"
                ),
                schemas.InspectionDataCreate(
                    indicator_code="TP",
                    discharge_point="排水口2号",
                    sample_time=sample_time1,
                    measured_value=0.8,
                    sample_method="钼锑抗分光光度法"
                )
            ]
        )
        
        result = services.import_inspection_report(db, report_data)
        print(f"✅ 导入报告: {result.report_no}")
        print(f"   总检测项目: {result.total_items}")
        print(f"   匹配指标: {result.matched_indicators}")
        print(f"   发现超标: {result.exceedance_count}")
        print(f"   自动创建整改任务: {result.new_tasks_created}")
        
        if not result.success:
            print(f"❌ 错误: {result.error_message}")
            return
        
        print_section("步骤 4: 查看超标记录列表")
        exceedances = services.get_exceedance_list(db, company_id=company.id)
        print(f"共发现 {len(exceedances)} 条超标记录:")
        for exc in exceedances:
            ratio_pct = round(exc.exceedance_ratio * 100, 1)
            severity_label = {
                "general": "一般",
                "serious": "严重",
                "critical": "危急"
            }.get(exc.severity, exc.severity)
            print(f"  [{exc.id}] {exc.indicator.indicator_name}: {exc.measured_value}{exc.indicator.unit} "
                  f"(限值 {exc.limit_value}{exc.indicator.unit}, 超标 {ratio_pct}%) [{severity_label}]")
        
        if exceedances:
            print_section("步骤 5: 单条超标记录完整追溯")
            first_exc = exceedances[0]
            trace = services.get_exceedance_with_trace(db, first_exc.id)
            print(f"企业: {trace['company']['name']} ({trace['company']['code']})")
            print(f"许可证: {trace['permit']['no']} (有效期 {trace['permit']['valid_from']} ~ {trace['permit']['valid_to']})")
            print(f"指标: {trace['indicator']['name']} ({trace['indicator']['code']})")
            print(f"检测报告: {trace['inspection']['report_no']} ({trace['inspection']['inspection_date']})")
            print(f"检测时间: {trace['inspection']['sample_time']}")
            print(f"检测值/限值: {trace['inspection']['measured_value']} / {trace['indicator']['limit_value']} {trace['indicator']['unit']}")
            if trace['rectification_task']:
                task = trace['rectification_task']
                print(f"\n整改任务: {task['task_no']}")
                print(f"  描述: {task['description']}")
                print(f"  期限: {task['deadline']}")
                print(f"  状态: {task['status']}")
        
        print_section("步骤 6: 更新整改任务状态")
        from sqlalchemy.orm import joinedload
        tasks = db.query(models.RectificationTask).options(
            joinedload(models.RectificationTask.exceedance)
        ).all()
        
        if tasks:
            task = tasks[0]
            updated = services.update_rectification_task(
                db, task.id,
                schemas.RectificationTaskUpdate(
                    status="completed",
                    completed_at=datetime.now()
                )
            )
            print(f"✅ 任务 {task.task_no} 状态更新为: completed")
            print(f"   关联超标记录状态同步更新")
        
        print_section("步骤 7: 创建复查回执")
        if tasks:
            receipt_data = schemas.ReviewReceiptCreate(
                task_id=tasks[0].id,
                review_date=date.today(),
                reviewer="张督察",
                result="pass",
                comment="整改措施落实到位，复查检测达标"
            )
            receipt = services.create_review_receipt(db, receipt_data)
            print(f"✅ 复查回执: {receipt.receipt_no}")
            print(f"   结果: 通过 -> 超标记录自动结案")
        
        print_section("步骤 8: 生成监管报告")
        supervision = services.generate_supervision_report(
            db, company.id,
            period_start=date(2024, 1, 1),
            period_end=date(2024, 12, 31)
        )
        print(f"✅ 监管报告: {supervision.report_no}")
        print(f"   统计周期: {supervision.period_start} ~ {supervision.period_end}")
        print(f"   总超标数: {supervision.total_exceedances}")
        print(f"   待处理: {supervision.pending_tasks}")
        print(f"   已完成: {supervision.completed_tasks}")
        print(f"   已超期: {supervision.overdue_tasks}")
        print(f"\n   明细:")
        for item in supervision.items:
            print(f"     - {item.indicator_name} @ {item.discharge_point}: "
                  f"{item.measured_value}/{item.limit_value} [{item.rectification_status}]")
        
        print_section("步骤 9: 业务复核导出 (Excel)")
        export_data = services.export_exceedance_analysis(db, company_id=company.id)
        print(f"可导出 {len(export_data)} 条超标分析记录")
        for i, row in enumerate(export_data[:3], 1):
            print(f"\n  [{i}] {row['企业名称']} - {row['指标名称']}")
            print(f"      限值: {row['限值']}{row['单位']}, 检测值: {row['检测值']}")
            print(f"      超标比例: {row['超标比例']} [{row['严重程度']}]")
            print(f"      整改状态: {row['整改状态']}, 复查: {row['复查结果'] or '-'}")
        
        print_section("演示流程完成")
        print("")
        print("📊 数据摘要:")
        print(f"   企业数: {db.query(models.Company).count()}")
        print(f"   许可证数: {db.query(models.Permit).count()}")
        print(f"   许可指标数: {db.query(models.PermitIndicator).count()}")
        print(f"   检测报告数: {db.query(models.InspectionReport).count()}")
        print(f"   检测数据数: {db.query(models.InspectionData).count()}")
        print(f"   超标记录数: {db.query(models.ExceedanceRecord).count()}")
        print(f"   整改任务数: {db.query(models.RectificationTask).count()}")
        print(f"   复查回执数: {db.query(models.ReviewReceipt).count()}")
        print(f"   监管报告数: {db.query(models.SupervisionReport).count()}")
        print("")
        print("💡 下一步: 启动 API 服务，使用 /docs 交互式文档测试接口")
        print("   命令: ./run.sh")
        print("   或者: python -m uvicorn app.main:app --reload --port 8000")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
