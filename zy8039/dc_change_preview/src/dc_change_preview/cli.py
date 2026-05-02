import sys
from pathlib import Path
from typing import Optional, Dict, List

import click

from .readers import CSVReader, JSONReader, YAMLReader
from .simulator import Simulator
from .reporter import Reporter
from .models import Rack, Device, PDU, PDUCircuit, SwitchPort


class DataCenterState:
    def __init__(self):
        self.racks: List[Rack] = []
        self.pdus: List[PDU] = []
        self.switch_ports: List[SwitchPort] = []
        self.devices_map: Dict[str, Device] = {}

    def add_device(self, device: Device):
        self.devices_map[device.device_id] = device
        rack = self._get_or_create_rack(device.rack_id)
        if device not in rack.devices:
            rack.devices.append(device)

    def _get_or_create_rack(self, rack_id: str) -> Rack:
        for rack in self.racks:
            if rack.rack_id == rack_id:
                return rack
        rack = Rack(rack_id=rack_id, name=rack_id)
        self.racks.append(rack)
        return rack

    def get_device(self, device_id: str) -> Optional[Device]:
        return self.devices_map.get(device_id)


def load_data(
    assets_csv: Optional[str],
    pdu_json: Optional[str],
    ports_csv: Optional[str],
    change_yaml: Optional[str],
    data_dir: Optional[str],
) -> tuple[DataCenterState, list]:
    state = DataCenterState()

    if data_dir:
        data_path = Path(data_dir)
        if not assets_csv:
            assets_csv = str(data_path / "rack_assets.csv")
        if not pdu_json:
            pdu_json = str(data_path / "pdu_circuits.json")
        if not ports_csv:
            ports_csv = str(data_path / "switch_ports.csv")
        if not change_yaml:
            change_yaml = str(data_path / "change_plan.yaml")

    if assets_csv and Path(assets_csv).exists():
        for device in CSVReader.read_rack_assets(assets_csv):
            state.add_device(device)

    if pdu_json and Path(pdu_json).exists():
        state.pdus = JSONReader.read_pdu_circuits(pdu_json)

    if ports_csv and Path(ports_csv).exists():
        state.switch_ports = list(CSVReader.read_switch_ports(ports_csv))

    change_plan = None
    if change_yaml and Path(change_yaml).exists():
        change_plan = YAMLReader.read_change_plan(change_yaml)

    return state, change_plan


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """数据中心变更预演 CLI 工具

    在正式变更前模拟上架/迁移/下架步骤，校验冲突和风险。
    """
    pass


@cli.command()
@click.option(
    "--assets",
    "-a",
    "assets_csv",
    help="机柜资产 CSV 文件路径",
)
@click.option(
    "--pdu",
    "-p",
    "pdu_json",
    help="PDU 回路 JSON 文件路径",
)
@click.option(
    "--ports",
    "ports_csv",
    help="交换机端口 CSV 文件路径",
)
@click.option(
    "--plan",
    "change_yaml",
    help="变更计划 YAML 文件路径",
)
@click.option(
    "--data-dir",
    "-d",
    help="数据文件所在目录（会查找默认文件名）",
)
@click.option(
    "--output",
    "-o",
    "output_dir",
    default="out",
    help="输出目录（默认: out）",
)
def preview(
    assets_csv: Optional[str],
    pdu_json: Optional[str],
    ports_csv: Optional[str],
    change_yaml: Optional[str],
    data_dir: Optional[str],
    output_dir: str,
):
    """预演变更计划并生成报告"""

    click.echo("📁 加载数据文件...")

    state, change_plan = load_data(
        assets_csv, pdu_json, ports_csv, change_yaml, data_dir
    )

    if not change_plan:
        click.echo("❌ 未找到变更计划文件", err=True)
        sys.exit(1)

    click.echo(f"   加载了 {len(state.devices_map)} 个设备")
    click.echo(f"   加载了 {len(state.pdus)} 个 PDU")
    click.echo(f"   加载了 {len(state.switch_ports)} 个端口")
    click.echo(f"   变更计划包含 {len(change_plan.steps)} 个步骤")

    click.echo("\n🔍 运行模拟和校验...")

    simulator = Simulator(state.racks, state.pdus, state.switch_ports)
    result = simulator.simulate(change_plan)

    rollback_suggestions = simulator.generate_rollback_suggestions(change_plan, result.executed_steps)

    critical_count = len([i for i in result.issues if i.severity == "critical"])
    warning_count = len([i for i in result.issues if i.severity == "warning"])

    click.echo(f"   发现 {critical_count} 个关键问题，{warning_count} 个警告")
    click.echo(f"   可执行步骤: {len(result.executed_steps)}/{len(change_plan.steps)}")

    click.echo(f"\n📝 生成报告到 {output_dir}/ ...")

    reporter = Reporter(output_dir)
    reporter.generate_risk_csv(result.issues)
    reporter.generate_executable_steps_md(change_plan, result)
    reporter.generate_rollback_md(rollback_suggestions)
    reporter.generate_summary_json(change_plan, result, rollback_suggestions)

    click.echo("   ✅ risk_report.csv")
    click.echo("   ✅ executable_steps.md")
    click.echo("   ✅ rollback_suggestions.md")
    click.echo("   ✅ summary.json")

    if critical_count > 0:
        click.echo("\n⚠️  存在关键问题，建议修复后再执行变更")
        sys.exit(1)
    else:
        click.echo("\n✅ 预演通过，可以执行变更")


@cli.command()
@click.option(
    "--assets",
    "-a",
    "assets_csv",
    help="机柜资产 CSV 文件路径",
)
@click.option(
    "--pdu",
    "-p",
    "pdu_json",
    help="PDU 回路 JSON 文件路径",
)
@click.option(
    "--ports",
    "ports_csv",
    help="交换机端口 CSV 文件路径",
)
@click.option(
    "--data-dir",
    "-d",
    help="数据文件所在目录",
)
def validate(
    assets_csv: Optional[str],
    pdu_json: Optional[str],
    ports_csv: Optional[str],
    data_dir: Optional[str],
):
    """验证输入文件格式"""

    click.echo("🔍 验证输入文件...")

    errors = []
    warnings = []

    if data_dir:
        data_path = Path(data_dir)
        if not assets_csv:
            assets_csv = str(data_path / "rack_assets.csv")
        if not pdu_json:
            pdu_json = str(data_path / "pdu_circuits.json")
        if not ports_csv:
            ports_csv = str(data_path / "switch_ports.csv")

    if assets_csv:
        assets_path = Path(assets_csv)
        if not assets_path.exists():
            errors.append(f"资产文件不存在: {assets_csv}")
        else:
            try:
                devices = list(CSVReader.read_rack_assets(assets_csv))
                click.echo(f"   ✅ 资产文件 OK ({len(devices)} 个设备)")
            except Exception as e:
                errors.append(f"资产文件解析错误: {e}")
    else:
        warnings.append("未指定资产文件")

    if pdu_json:
        pdu_path = Path(pdu_json)
        if not pdu_path.exists():
            errors.append(f"PDU 文件不存在: {pdu_json}")
        else:
            try:
                pdus = JSONReader.read_pdu_circuits(pdu_json)
                click.echo(f"   ✅ PDU 文件 OK ({len(pdus)} 个 PDU)")
            except Exception as e:
                errors.append(f"PDU 文件解析错误: {e}")
    else:
        warnings.append("未指定 PDU 文件")

    if ports_csv:
        ports_path = Path(ports_csv)
        if not ports_path.exists():
            errors.append(f"端口文件不存在: {ports_csv}")
        else:
            try:
                ports = list(CSVReader.read_switch_ports(ports_csv))
                click.echo(f"   ✅ 端口文件 OK ({len(ports)} 个端口)")
            except Exception as e:
                errors.append(f"端口文件解析错误: {e}")
    else:
        warnings.append("未指定端口文件")

    for w in warnings:
        click.echo(f"   ⚠️  {w}")

    if errors:
        click.echo("\n❌ 验证失败:")
        for e in errors:
            click.echo(f"   - {e}")
        sys.exit(1)
    else:
        click.echo("\n✅ 所有文件验证通过")


def main():
    cli()


if __name__ == "__main__":
    main()
