import click
import json
import sys
from datetime import datetime
from typing import Optional, List

from .models import Machine, PaymentRecord, StartEvent, RefundApplication
from .engine import TroubleshootingEngine
from .reporter import ResultReporter


class DataLoader:
    @staticmethod
    def load_json(filepath: str) -> dict:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            click.echo(f"错误: 文件不存在 - {filepath}", err=True)
            sys.exit(1)
        except json.JSONDecodeError as e:
            click.echo(f"错误: JSON格式无效 - {e}", err=True)
            sys.exit(1)

    @staticmethod
    def parse_machines(data: List[dict]) -> List[Machine]:
        machines = []
        for item in data:
            try:
                machines.append(Machine(**item))
            except Exception as e:
                click.echo(f"警告: 跳过无效的机器数据 - {e}", err=True)
        return machines

    @staticmethod
    def parse_payments(data: List[dict]) -> List[PaymentRecord]:
        payments = []
        for item in data:
            try:
                if 'pay_time' in item and item['pay_time']:
                    item['pay_time'] = datetime.fromisoformat(item['pay_time'])
                payments.append(PaymentRecord(**item))
            except Exception as e:
                click.echo(f"警告: 跳过无效的支付数据 - {e}", err=True)
        return payments

    @staticmethod
    def parse_events(data: List[dict]) -> List[StartEvent]:
        events = []
        for item in data:
            try:
                if 'start_time' in item and item['start_time']:
                    item['start_time'] = datetime.fromisoformat(item['start_time'])
                if 'end_time' in item and item['end_time']:
                    item['end_time'] = datetime.fromisoformat(item['end_time'])
                events.append(StartEvent(**item))
            except Exception as e:
                click.echo(f"警告: 跳过无效的事件数据 - {e}", err=True)
        return events

    @staticmethod
    def parse_refunds(data: List[dict]) -> List[RefundApplication]:
        refunds = []
        for item in data:
            try:
                if 'apply_time' in item and item['apply_time']:
                    item['apply_time'] = datetime.fromisoformat(item['apply_time'])
                refunds.append(RefundApplication(**item))
            except Exception as e:
                click.echo(f"警告: 跳过无效的退款数据 - {e}", err=True)
        return refunds


@click.group()
@click.version_option(version="0.1.0", prog_name="washer-ts")
def cli():
    """洗衣机启动失败支付核验退款排查工具"""
    pass


@cli.command()
@click.argument('machine_id')
@click.option('--payment-id', '-p', help='支付流水号')
@click.option('--refund-id', '-r', help='退款申请号')
@click.option('--machines-file', '-m', type=click.Path(exists=True), help='机器数据JSON文件')
@click.option('--payments-file', '-P', type=click.Path(exists=True), help='支付数据JSON文件')
@click.option('--events-file', '-e', type=click.Path(exists=True), help='启动事件JSON文件')
@click.option('--refunds-file', '-R', type=click.Path(exists=True), help='退款申请JSON文件')
@click.option('--output', '-o', type=click.Path(), help='输出结果到文件')
@click.option('--format', '-f', 'output_format', type=click.Choice(['text', 'json', 'both']), default='text', help='输出格式')
@click.option('--no-color', is_flag=True, help='禁用彩色输出')
@click.option('--verify', is_flag=True, help='验证报告一致性')
def troubleshoot(
    machine_id: str,
    payment_id: Optional[str],
    refund_id: Optional[str],
    machines_file: Optional[str],
    payments_file: Optional[str],
    events_file: Optional[str],
    refunds_file: Optional[str],
    output: Optional[str],
    output_format: str,
    no_color: bool,
    verify: bool
):
    """执行排查流程

    MACHINE_ID: 要排查的机器编号（必填）
    """
    click.echo(f"正在排查机器: {machine_id}...")

    machines: List[Machine] = []
    payments: List[PaymentRecord] = []
    events: List[StartEvent] = []
    refunds: List[RefundApplication] = []

    if machines_file:
        data = DataLoader.load_json(machines_file)
        machines = DataLoader.parse_machines(data)
        click.echo(f"  加载机器数据: {len(machines)} 条记录")

    if payments_file:
        data = DataLoader.load_json(payments_file)
        payments = DataLoader.parse_payments(data)
        click.echo(f"  加载支付数据: {len(payments)} 条记录")

    if events_file:
        data = DataLoader.load_json(events_file)
        events = DataLoader.parse_events(data)
        click.echo(f"  加载事件数据: {len(events)} 条记录")

    if refunds_file:
        data = DataLoader.load_json(refunds_file)
        refunds = DataLoader.parse_refunds(data)
        click.echo(f"  加载退款数据: {len(refunds)} 条记录")

    engine = TroubleshootingEngine()
    result = engine.troubleshoot(
        machine_id=machine_id,
        payment_id=payment_id,
        refund_id=refund_id,
        machines=machines,
        payments=payments,
        events=events,
        refunds=refunds
    )

    click.echo("  排查完成，生成报告...\n")

    if output_format in ['text', 'both']:
        text_report = ResultReporter.generate_human_report(result, use_color=not no_color)
        click.echo(text_report)

    if output_format in ['json', 'both']:
        json_report = ResultReporter.generate_machine_report(result)
        if output_format == 'json':
            click.echo(json_report)
        elif output == 'both':
            click.echo("\nJSON 输出:")
            click.echo(json_report)

    if output:
        if output.endswith('.json'):
            ResultReporter.export_json(result, output)
            click.echo(f"JSON报告已保存到: {output}")
        else:
            ResultReporter.export_text(result, output)
            click.echo(f"文本报告已保存到: {output}")

    if verify:
        is_consistent = ResultReporter.verify_consistency(result)
        if is_consistent:
            click.echo("✓ 人读报告与机器输出一致性验证通过")
        else:
            click.echo("✗ 人读报告与机器输出一致性验证失败", err=True)
            sys.exit(1)


@cli.command()
@click.option('--output-dir', '-o', type=click.Path(), default='examples', help='样例数据输出目录')
def generate_examples(output_dir: str):
    """生成样例测试数据"""
    import os
    os.makedirs(output_dir, exist_ok=True)

    click.echo(f"正在生成样例数据到: {output_dir}")

    from datetime import datetime, timedelta
    now = datetime.now()

    machines = [
        {
            "machine_id": "WASH-001",
            "location": "1号楼1层",
            "status": "fault",
            "last_fault_code": "E001"
        },
        {
            "machine_id": "WASH-002",
            "location": "1号楼1层",
            "status": "idle"
        },
        {
            "machine_id": "WASH-003",
            "location": "2号楼大堂",
            "status": "running"
        },
    ]

    payments = [
        {
            "payment_id": "PAY-20240515-001",
            "machine_id": "WASH-001",
            "user_id": "USER-1001",
            "amount": 25.0,
            "status": "success",
            "pay_time": (now - timedelta(hours=2)).isoformat(),
            "transaction_id": "TXN-abc123"
        },
        {
            "payment_id": "PAY-20240515-002",
            "machine_id": "WASH-001",
            "user_id": "USER-1002",
            "amount": 25.0,
            "status": "success",
            "pay_time": (now - timedelta(hours=1)).isoformat()
        },
        {
            "payment_id": "PAY-DIRTY-001",
            "machine_id": "WASH-999",
            "user_id": "USER-999",
            "amount": -10.0,
            "status": "failed"
        },
    ]

    events = [
        {
            "event_id": "EVT-001",
            "machine_id": "WASH-001",
            "payment_id": "PAY-20240515-001",
            "user_id": "USER-1001",
            "status": "failed",
            "fault_code": "E001",
            "start_time": (now - timedelta(hours=2, minutes=5)).isoformat(),
            "error_message": "电机无法启动，电流异常"
        },
        {
            "event_id": "EVT-002",
            "machine_id": "WASH-001",
            "payment_id": "PAY-20240515-001",
            "user_id": "USER-1001",
            "status": "failed",
            "fault_code": "E001",
            "start_time": (now - timedelta(hours=2, minutes=3)).isoformat(),
            "error_message": "重试仍然失败"
        },
        {
            "event_id": "EVT-003",
            "machine_id": "WASH-002",
            "status": "success",
            "start_time": (now - timedelta(hours=1)).isoformat(),
            "end_time": now.isoformat()
        },
    ]

    refunds = [
        {
            "refund_id": "REF-001",
            "payment_id": "PAY-20240515-001",
            "machine_id": "WASH-001",
            "user_id": "USER-1001",
            "refund_amount": 25.0,
            "reason": "机器无法启动",
            "status": "pending",
            "fault_code": "E001",
            "apply_time": (now - timedelta(hours=1)).isoformat()
        },
        {
            "refund_id": "REF-002",
            "payment_id": "PAY-20240515-001",
            "machine_id": "WASH-001",
            "user_id": "USER-1001",
            "refund_amount": 25.0,
            "reason": "重复申请退款",
            "status": "completed",
            "fault_code": "E001",
            "apply_time": (now - timedelta(hours=3)).isoformat()
        },
    ]

    def save_json(data, filename):
        path = os.path.join(output_dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        click.echo(f"  ✓ 已生成: {filename}")

    save_json(machines, 'machines.json')
    save_json(payments, 'payments.json')
    save_json(events, 'events.json')
    save_json(refunds, 'refunds.json')

    click.echo(f"\n样例数据生成完成，共 {len(machines) + len(payments) + len(events) + len(refunds)} 条记录")
    click.echo("\n使用示例:")
    click.echo("  washer-ts troubleshoot WASH-001 -p PAY-20240515-001 -r REF-001")
    click.echo("      -m examples/machines.json -P examples/payments.json -e examples/events.json -R examples/refunds.json")


@cli.command()
@click.argument('test_type', type=click.Choice(['normal', 'dirty', 'conflict', 'empty', 'all']))
def run_test(test_type: str):
    """运行测试用例

    TEST_TYPE: 测试类型 - normal/正常, dirty/脏数据, conflict/冲突, empty/空结果, all/全部
    """
    from datetime import datetime, timedelta
    now = datetime.now()

    def run_case(name, desc, machine_id, payment_id, refund_id, machines_data, payments_data, events_data, refunds_data):
        click.echo(f"\n{'='*60}")
        click.echo(f"测试用例: {name}")
        click.echo(f"描述: {desc}")
        click.echo(f"{'='*60}")

        engine = TroubleshootingEngine()
        result = engine.troubleshoot(
            machine_id=machine_id,
            payment_id=payment_id,
            refund_id=refund_id,
            machines=DataLoader.parse_machines(machines_data),
            payments=DataLoader.parse_payments(payments_data),
            events=DataLoader.parse_events(events_data),
            refunds=DataLoader.parse_refunds(refunds_data)
        )

        click.echo(ResultReporter.generate_human_report(result, use_color=True))

        is_consistent = ResultReporter.verify_consistency(result)
        click.echo(f"一致性验证: {'✓ 通过' if is_consistent else '✗ 失败'}")

        return result

    if test_type in ['normal', 'all']:
        run_case(
            "正常退款",
            "支付成功、机器故障、启动失败、退款申请",
            "WASH-001",
            "PAY-001",
            "REF-001",
            [{"machine_id": "WASH-001", "location": "1号楼", "status": "fault", "last_fault_code": "E001"}],
            [{"payment_id": "PAY-001", "machine_id": "WASH-001", "user_id": "U1", "amount": 25.0, "status": "success", "pay_time": now.isoformat()}],
            [{"event_id": "EVT-001", "machine_id": "WASH-001", "payment_id": "PAY-001", "status": "failed", "fault_code": "E001", "start_time": now.isoformat()}],
            [{"refund_id": "REF-001", "payment_id": "PAY-001", "machine_id": "WASH-001", "user_id": "U1", "refund_amount": 25.0, "reason": "启动失败", "status": "pending", "apply_time": now.isoformat()}]
        )

    if test_type in ['dirty', 'all']:
        run_case(
            "脏数据处理",
            "无效支付金额、缺失字段的容错处理",
            "WASH-001",
            "PAY-DIRTY",
            None,
            [{"machine_id": "WASH-001", "location": "1号楼", "status": "idle"}],
            [{"payment_id": "PAY-DIRTY", "machine_id": "WASH-001", "user_id": "U1", "amount": -5.0, "status": "failed"}],
            [{"event_id": "EVT-DIRTY", "machine_id": "WASH-001", "status": "success", "start_time": now.isoformat()}],
            []
        )

    if test_type in ['conflict', 'all']:
        run_case(
            "边界冲突",
            "重复退款申请、金额冲突的幂等性检查",
            "WASH-001",
            "PAY-CONFLICT",
            "REF-NEW",
            [{"machine_id": "WASH-001", "location": "1号楼", "status": "fault"}],
            [{"payment_id": "PAY-CONFLICT", "machine_id": "WASH-001", "user_id": "U1", "amount": 25.0, "status": "success", "pay_time": now.isoformat()}],
            [{"event_id": "EVT-C", "machine_id": "WASH-001", "payment_id": "PAY-CONFLICT", "status": "failed", "fault_code": "E002", "start_time": now.isoformat()}],
            [
                {"refund_id": "REF-COMPLETED", "payment_id": "PAY-CONFLICT", "machine_id": "WASH-001", "user_id": "U1", "refund_amount": 25.0, "reason": "已退款", "status": "completed", "apply_time": (now - timedelta(hours=1)).isoformat()},
                {"refund_id": "REF-NEW", "payment_id": "PAY-CONFLICT", "machine_id": "WASH-001", "user_id": "U1", "refund_amount": 25.0, "reason": "重复申请", "status": "pending", "apply_time": now.isoformat()}
            ]
        )

    if test_type in ['empty', 'all']:
        run_case(
            "空结果场景",
            "无数据、无匹配的情况处理",
            "WASH-999",
            None,
            None,
            [],
            [],
            [],
            []
        )

    click.echo(f"\n{'='*60}")
    click.echo("所有测试用例执行完成")
    click.echo(f"{'='*60}\n")


@cli.command()
def verify_example():
    """验证样例数据并执行完整排查流程"""
    import os
    example_dir = 'examples'

    if not os.path.exists(os.path.join(example_dir, 'machines.json')):
        click.echo("样例数据不存在，正在生成...")
        os.system(f"{sys.executable} -m washer_ts.cli generate-examples")

    click.echo("\n执行样例数据一致性验证...")

    cmd = (
        f"{sys.executable} -m washer_ts.cli troubleshoot WASH-001 "
        f"-p PAY-20240515-001 -r REF-001 "
        f"-m {example_dir}/machines.json -P {example_dir}/payments.json "
        f"-e {example_dir}/events.json -R {example_dir}/refunds.json "
        f"--verify"
    )

    os.system(cmd)


def main():
    cli()


if __name__ == '__main__':
    main()
