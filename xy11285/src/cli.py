import typer
import json
from datetime import datetime
from typing import Optional

from src.database import SessionLocal, init_db
from src.models import PrescriptionStatus, BatchOperationStatus
from src.services import PrescriptionService, BatchOperationService, InitialDataService
from src.import_export import ImportService, ExportService

app = typer.Typer(help="宠物医院药房管理系统命令行工具")


@app.command()
def init_db():
    """初始化数据库"""
    init_db()
    typer.echo("数据库初始化完成")


@app.command()
def init_sample_data():
    """初始化示例数据"""
    db = SessionLocal()
    service = InitialDataService(db)
    service.create_sample_data()
    db.close()
    typer.echo("示例数据创建完成")


@app.command()
def create_prescription(
    pet_id: int,
    doctor_id: int,
    medicine_ids: str,
    created_by: str,
    diagnosis: str = "",
    notes: str = ""
):
    """
    创建处方
    medicine_ids: 药品ID列表，逗号分隔，如 "1,2,3"
    """
    db = SessionLocal()
    service = PrescriptionService(db)

    items_data = [{"medicine_id": int(mid.strip())} for mid in medicine_ids.split(",")]

    try:
        prescription = service.create_prescription(
            pet_id=pet_id,
            doctor_id=doctor_id,
            items_data=items_data,
            created_by=created_by,
            diagnosis=diagnosis,
            notes=notes
        )
        typer.echo(f"处方创建成功: {prescription.prescription_no}")
    except Exception as e:
        typer.echo(f"创建失败: {str(e)}", err=True)
    finally:
        db.close()


@app.command()
def submit_review(prescription_id: int, operator: str):
    """提交审核"""
    db = SessionLocal()
    service = PrescriptionService(db)
    try:
        prescription = service.submit_for_review(prescription_id, operator)
        typer.echo(f"处方 {prescription_id} 已提交审核，当前状态: {prescription.status}")
    except Exception as e:
        typer.echo(f"操作失败: {str(e)}", err=True)
    finally:
        db.close()


@app.command()
def approve(prescription_id: int, operator: str, notes: str = ""):
    """审核通过"""
    db = SessionLocal()
    service = PrescriptionService(db)
    try:
        prescription = service.approve(prescription_id, operator, notes)
        typer.echo(f"处方 {prescription_id} 审核通过，当前状态: {prescription.status}")
    except Exception as e:
        typer.echo(f"操作失败: {str(e)}", err=True)
    finally:
        db.close()


@app.command()
def reject(prescription_id: int, operator: str, reason: str):
    """驳回处方"""
    db = SessionLocal()
    service = PrescriptionService(db)
    try:
        prescription = service.reject(prescription_id, operator, reason)
        typer.echo(f"处方 {prescription_id} 已驳回，当前状态: {prescription.status}")
    except Exception as e:
        typer.echo(f"操作失败: {str(e)}", err=True)
    finally:
        db.close()


@app.command()
def dispense(prescription_id: int, operator: str):
    """发药"""
    db = SessionLocal()
    service = PrescriptionService(db)
    try:
        prescription = service.dispense(prescription_id, operator)
        typer.echo(f"处方 {prescription_id} 已发药，当前状态: {prescription.status}")
    except Exception as e:
        typer.echo(f"操作失败: {str(e)}", err=True)
    finally:
        db.close()


@app.command()
def list_prescriptions(
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    reviewed_by: Optional[str] = None
):
    """查询处方列表"""
    db = SessionLocal()
    service = PrescriptionService(db)

    kwargs = {}
    if status:
        kwargs["status"] = PrescriptionStatus(status)
    if created_by:
        kwargs["created_by"] = created_by
    if reviewed_by:
        kwargs["reviewed_by"] = reviewed_by

    prescriptions = service.query_prescriptions(**kwargs)

    typer.echo(f"{'ID':<6} {'编号':<20} {'宠物':<12} {'医生':<10} {'状态':<15} {'创建人':<10} {'药品数':<6}")
    typer.echo("-" * 90)
    for p in prescriptions:
        typer.echo(
            f"{p.id:<6} {p.prescription_no:<20} "
            f"{(p.pet.name if p.pet else ''):<12} "
            f"{(p.doctor.name if p.doctor else ''):<10} "
            f"{p.status.value:<15} {p.created_by:<10} {len(p.items):<6}"
        )

    typer.echo(f"\n共 {len(prescriptions)} 条记录")
    db.close()


@app.command()
def get_prescription(prescription_id: int):
    """获取处方详情"""
    db = SessionLocal()
    service = PrescriptionService(db)
    prescription = service.prescription_repo.get_by_id(prescription_id)

    if not prescription:
        typer.echo("处方不存在", err=True)
        return

    typer.echo(f"处方编号: {prescription.prescription_no}")
    typer.echo(f"宠物名称: {prescription.pet.name if prescription.pet else ''}")
    typer.echo(f"宠物体重: {prescription.pet.weight if prescription.pet else 0} {prescription.pet.weight_unit if prescription.pet else ''}")
    typer.echo(f"医生: {prescription.doctor.name if prescription.doctor else ''}")
    typer.echo(f"状态: {prescription.status}")
    typer.echo(f"诊断: {prescription.diagnosis}")
    typer.echo(f"\n药品明细:")
    for item in prescription.items:
        typer.echo(
            f"  - {item.medicine.name if item.medicine else ''}: "
            f"{item.calculated_dosage} {item.unit} "
            f"({item.dosage_notes})"
        )
    db.close()


@app.command()
def import_prescriptions(file_path: str, created_by: str = "cli_import"):
    """批量导入处方"""
    db = SessionLocal()

    with open(file_path, 'rb') as f:
        content = f.read()

    if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        rows = ImportService.read_excel(content)
    elif file_path.endswith('.csv'):
        rows = ImportService.read_csv(content)
    else:
        typer.echo("不支持的文件格式", err=True)
        return

    prescription_data = ImportService.parse_prescription_data(rows)

    batch_service = BatchOperationService(db)
    operation = batch_service.create_operation(
        operation_type="import_prescription",
        created_by=created_by,
        items_data=prescription_data
    )

    result = batch_service.process_operation(operation.operation_id)

    typer.echo(f"批量导入完成:")
    typer.echo(f"  操作ID: {result['operation_id']}")
    typer.echo(f"  状态: {result['status']}")
    typer.echo(f"  总数: {result['total_count']}")
    typer.echo(f"  成功: {result['success_count']}")
    typer.echo(f"  失败: {result['failed_count']}")

    if result.get('errors'):
        typer.echo("\n错误详情:")
        for error in result['errors']:
            typer.echo(f"  行 {error['row']}: {error['error_type']} - {error['error_message']}")

    db.close()


@app.command()
def retry_batch(operation_id: str):
    """重试批量操作失败项"""
    db = SessionLocal()
    batch_service = BatchOperationService(db)
    result = batch_service.retry_failed_items(operation_id)

    typer.echo(f"重试结果:")
    typer.echo(f"  操作ID: {result['operation_id']}")
    typer.echo(f"  状态: {result['status']}")
    typer.echo(f"  成功: {result['success_count']}")
    typer.echo(f"  失败: {result['failed_count']}")
    db.close()


@app.command()
def list_batch_operations(
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    error_type: Optional[str] = None
):
    """查询批量操作"""
    db = SessionLocal()
    batch_service = BatchOperationService(db)

    kwargs = {}
    if status:
        kwargs["status"] = BatchOperationStatus(status)
    if created_by:
        kwargs["created_by"] = created_by

    operations, items = batch_service.query_operations(**kwargs)

    typer.echo(f"{'操作ID':<30} {'类型':<20} {'状态':<20} {'总数':<6} {'成功':<6} {'失败':<6}")
    typer.echo("-" * 90)
    for op in operations:
        typer.echo(
            f"{op.operation_id:<30} {op.operation_type:<20} "
            f"{op.status.value:<20} {op.total_count:<6} {op.success_count:<6} {op.failed_count:<6}"
        )

    typer.echo(f"\n共 {len(operations)} 条操作记录")
    db.close()


@app.command()
def export_prescriptions(output_file: str, status: Optional[str] = None):
    """导出处方"""
    db = SessionLocal()
    service = PrescriptionService(db)

    kwargs = {}
    if status:
        kwargs["status"] = PrescriptionStatus(status)

    prescriptions = service.query_prescriptions(**kwargs)

    if output_file.endswith('.xlsx') or output_file.endswith('.xls'):
        content = ExportService.export_prescriptions_to_excel(prescriptions)
    elif output_file.endswith('.csv'):
        content = ExportService.export_prescriptions_to_csv(prescriptions)
    else:
        typer.echo("不支持的文件格式", err=True)
        return

    with open(output_file, 'wb') as f:
        f.write(content)

    typer.echo(f"已导出 {len(prescriptions)} 条处方记录到 {output_file}")
    db.close()


@app.command()
def start_api(host: str = "0.0.0.0", port: int = 8000, reload: bool = True):
    """启动API服务"""
    import uvicorn
    typer.echo(f"启动API服务: http://{host}:{port}")
    typer.echo(f"API文档: http://{host}:{port}/docs")
    uvicorn.run("src.api:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    app()
