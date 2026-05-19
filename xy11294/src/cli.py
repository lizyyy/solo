import click
import json
from datetime import datetime
from sqlalchemy.orm import Session

from src.database import SessionLocal, init_db
from src.services import EquipmentService, OperationService
from src.batch_service import BatchOperationService, ReportService
from src.models import OperationType, RoleType
from src.schemas import (
    ImportOperation,
    OccupyOperation,
    TransferOperation,
    ReturnOperation,
    LossOperation,
    QueryFilter
)


def get_db_session():
    db = SessionLocal()
    try:
        return db
    finally:
        pass


@click.group()
def cli():
    """会展设备租赁管理系统 CLI"""
    init_db()


@cli.group()
def equipment():
    """设备管理命令"""
    pass


@equipment.command(name="create")
@click.argument("code")
@click.argument("name")
@click.argument("type", type=click.Choice(["truss", "light", "screen"]))
@click.argument("total_quantity", type=int)
@click.argument("unit")
@click.option("--description", default="", help="设备描述")
def create_equipment(code, name, type, total_quantity, unit, description):
    """创建设备"""
    db = get_db_session()
    try:
        existing = EquipmentService.get_by_code(db, code)
        if existing:
            click.echo(f"错误: 设备编号 {code} 已存在")
            return

        equipment = EquipmentService.create(
            db, code, name, type, total_quantity, unit, description
        )
        click.echo(f"成功创建设备: {equipment.code} - {equipment.name}")
        click.echo(f"  类型: {equipment.type.value}")
        click.echo(f"  总数量: {equipment.total_quantity} {equipment.unit}")
    finally:
        db.close()


@equipment.command(name="list")
def list_equipment():
    """列出所有设备"""
    db = get_db_session()
    try:
        equipments = EquipmentService.list_all(db)
        if not equipments:
            click.echo("暂无设备")
            return

        click.echo(f"{'编号':<15} {'名称':<20} {'类型':<10} {'总数量':<10} {'可用数量':<10} {'单位':<10}")
        click.echo("-" * 80)
        for eq in equipments:
            click.echo(f"{eq.code:<15} {eq.name:<20} {eq.type.value:<10} {eq.total_quantity:<10} {eq.available_quantity:<10} {eq.unit:<10}")
    finally:
        db.close()


@cli.group()
def operation():
    """操作命令"""
    pass


@operation.command(name="import")
@click.argument("request_id")
@click.argument("equipment_code")
@click.argument("quantity", type=int)
@click.argument("operator")
@click.argument("role", type=click.Choice(["manager", "operator", "auditor"]))
@click.option("--remark", default="", help="备注")
def import_equipment(request_id, equipment_code, quantity, operator, role, remark):
    """导入设备"""
    db = get_db_session()
    try:
        data = ImportOperation(
            request_id=request_id,
            equipment_code=equipment_code,
            quantity=quantity,
            operator=operator,
            role=RoleType(role),
            remark=remark
        )
        result = OperationService.handle_import(db, data)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="occupy")
@click.argument("request_id")
@click.argument("equipment_code")
@click.argument("quantity", type=int)
@click.argument("operator")
@click.argument("role", type=click.Choice(["manager", "operator", "auditor"]))
@click.argument("booth")
@click.option("--remark", default="", help="备注")
def occupy_equipment(request_id, equipment_code, quantity, operator, role, booth, remark):
    """占用/借用设备到指定展位"""
    db = get_db_session()
    try:
        data = OccupyOperation(
            request_id=request_id,
            equipment_code=equipment_code,
            quantity=quantity,
            operator=operator,
            role=RoleType(role),
            booth=booth,
            remark=remark
        )
        result = OperationService.handle_occupy(db, data)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="transfer")
@click.argument("request_id")
@click.argument("equipment_code")
@click.argument("quantity", type=int)
@click.argument("operator")
@click.argument("role", type=click.Choice(["manager", "operator", "auditor"]))
@click.argument("from_booth")
@click.argument("to_booth")
@click.option("--remark", default="", help="备注")
def transfer_equipment(request_id, equipment_code, quantity, operator, role, from_booth, to_booth, remark):
    """在展位间调拨设备"""
    db = get_db_session()
    try:
        data = TransferOperation(
            request_id=request_id,
            equipment_code=equipment_code,
            quantity=quantity,
            operator=operator,
            role=RoleType(role),
            from_booth=from_booth,
            to_booth=to_booth,
            remark=remark
        )
        result = OperationService.handle_transfer(db, data)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="return")
@click.argument("request_id")
@click.argument("equipment_code")
@click.argument("quantity", type=int)
@click.argument("operator")
@click.argument("role", type=click.Choice(["manager", "operator", "auditor"]))
@click.argument("booth")
@click.option("--remark", default="", help="备注")
def return_equipment(request_id, equipment_code, quantity, operator, role, booth, remark):
    """从展位归还设备"""
    db = get_db_session()
    try:
        data = ReturnOperation(
            request_id=request_id,
            equipment_code=equipment_code,
            quantity=quantity,
            operator=operator,
            role=RoleType(role),
            booth=booth,
            remark=remark
        )
        result = OperationService.handle_return(db, data)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="loss")
@click.argument("request_id")
@click.argument("equipment_code")
@click.argument("quantity", type=int)
@click.argument("operator")
@click.argument("role", type=click.Choice(["manager", "operator", "auditor"]))
@click.option("--booth", default="", help="展位号")
@click.option("--loss_reason", default="", help="损耗原因")
def loss_equipment(request_id, equipment_code, quantity, operator, role, booth, loss_reason):
    """记录设备损耗"""
    db = get_db_session()
    try:
        data = LossOperation(
            request_id=request_id,
            equipment_code=equipment_code,
            quantity=quantity,
            operator=operator,
            role=RoleType(role),
            booth=booth if booth else None,
            loss_reason=loss_reason
        )
        result = OperationService.handle_loss(db, data)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="batch")
@click.argument("json_file", type=click.File("r"))
def batch_operation(json_file):
    """批量操作 (从JSON文件读取)"""
    db = get_db_session()
    try:
        operations = json.load(json_file)
        result = BatchOperationService.process_batch(db, operations)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        db.close()


@operation.command(name="query")
@click.option("--operator", help="按操作人筛选")
@click.option("--booth", help="按展位筛选")
@click.option("--status", type=click.Choice(["pending", "success", "failed"]), help="按状态筛选")
@click.option("--operation-type", type=click.Choice(["import", "occupy", "transfer", "return", "loss"]), help="按操作类型筛选")
def query_operations(operator, booth, status, operation_type):
    """查询操作记录"""
    db = get_db_session()
    try:
        filter_params = QueryFilter(
            operator=operator,
            booth=booth,
            status=status if status else None,
            operation_type=operation_type if operation_type else None
        )
        records = OperationService.query_records(db, filter_params)

        if not records:
            click.echo("暂无记录")
            return

        click.echo(f"{'ID':<5} {'请求ID':<15} {'类型':<10} {'数量':<6} {'操作人':<10} {'状态':<10} {'时间':<20}")
        click.echo("-" * 80)
        for record in records:
            click.echo(
                f"{record.id:<5} {record.request_id:<15} {record.operation_type.value:<10} "
                f"{record.quantity:<6} {record.operator:<10} {record.status.value:<10} "
                f"{record.operated_at.strftime('%Y-%m-%d %H:%M'):<20}"
            )
    finally:
        db.close()


@cli.group()
def report():
    """报告命令"""
    pass


@report.command(name="stock")
def stock_report():
    """显示当前库存状态"""
    db = get_db_session()
    try:
        stock = ReportService.get_current_stock(db)
        if not stock:
            click.echo("暂无库存数据")
            return

        click.echo(f"{'编号':<15} {'名称':<20} {'类型':<10} {'总数量':<10} {'可用数量':<10} {'单位':<10}")
        click.echo("-" * 80)
        for item in stock:
            click.echo(
                f"{item['code']:<15} {item['name']:<20} {item['type']:<10} "
                f"{item['total_quantity']:<10} {item['available_quantity']:<10} {item['unit']:<10}"
            )
    finally:
        db.close()


@report.command(name="export")
@click.argument("output_file")
@click.option("--format", type=click.Choice(["xlsx", "csv"]), default="xlsx", help="导出格式")
@click.option("--operator", help="按操作人筛选")
def export_report(output_file, format, operator):
    """导出操作记录报告"""
    db = get_db_session()
    try:
        filter_params = QueryFilter(operator=operator)
        output = ReportService.export_records(db, filter_params, format)

        with open(output_file, "wb") as f:
            f.write(output.getvalue())

        click.echo(f"报告已导出到: {output_file}")
    finally:
        db.close()


@report.command(name="summary")
def summary():
    """显示统计摘要"""
    db = get_db_session()
    try:
        summary = OperationService.get_record_summary(db)
        click.echo(json.dumps(summary, ensure_ascii=False, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    cli()
