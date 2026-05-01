import json
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime

import click

from .models import (
    CalibrationState,
    UnitSystem,
    PointOverride,
    OverrideType,
    Speaker,
    MeasurementPoint,
    Point3D,
    ClimateData,
)
from .parsers.csv_parser import (
    parse_csv,
    parse_speakers_csv,
    parse_points_csv,
    parse_climate_csv,
    parse_impulse_response_csv,
    CSVParseError,
)
from .validation.rules import run_all_validations
from .solver.delay_solver import solve_delays, SolverConfig
from .reports.generator import (
    write_markdown_report,
    write_delay_table_csv,
    write_audit_package_json,
)


DEFAULT_CONFIG_FILENAME = "calibration.json"


def load_state(config_path: Path) -> CalibrationState:
    if not config_path.exists():
        raise click.ClickException(f"配置文件不存在: {config_path}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        state = CalibrationState(
            config_version=data.get("config_version", "1.0"),
            unit_system=UnitSystem(data.get("unit_system", "meters")),
        )

        for spk_id, spk_data in data.get("speakers", {}).items():
            state.speakers[spk_id] = Speaker(
                id=spk_data["id"],
                name=spk_data["name"],
                position=Point3D(
                    x=spk_data["position"][0],
                    y=spk_data["position"][1],
                    z=spk_data["position"][2],
                ),
                group=spk_data.get("group"),
                channel=spk_data.get("channel"),
            )

        for pt_id, pt_data in data.get("points", {}).items():
            state.points[pt_id] = MeasurementPoint(
                id=pt_data["id"],
                name=pt_data["name"],
                position=Point3D(
                    x=pt_data["position"][0],
                    y=pt_data["position"][1],
                    z=pt_data["position"][2],
                ),
                note=pt_data.get("note"),
            )

        climate_data = data.get("climate_data")
        if climate_data:
            state.climate_data = ClimateData(
                timestamp=datetime.fromisoformat(climate_data["timestamp"]),
                temperature_c=climate_data["temperature_c"],
                humidity_pct=climate_data["humidity_pct"],
                pressure_kpa=climate_data.get("pressure_kpa"),
                note=climate_data.get("note"),
            )

        for ov_data in data.get("overrides", []):
            override_type = (
                OverrideType.LOCK
                if ov_data["override_type"] == "lock"
                else OverrideType.EXCLUDE
            )
            state.overrides.append(PointOverride(
                point_id=ov_data["point_id"],
                speaker_id=ov_data.get("speaker_id"),
                override_type=override_type,
                reason=ov_data.get("reason"),
            ))

        return state

    except json.JSONDecodeError as e:
        raise click.ClickException(f"配置文件格式错误: {e}")
    except KeyError as e:
        raise click.ClickException(f"配置文件缺少必要字段: {e}")


def save_state(state: CalibrationState, config_path: Path) -> None:
    state.updated_at = datetime.now()

    data = {
        "config_version": state.config_version,
        "unit_system": state.unit_system.value,
        "created_at": state.created_at.isoformat(),
        "updated_at": state.updated_at.isoformat(),
        "speakers": {},
        "points": {},
        "overrides": [],
    }

    for spk_id, speaker in state.speakers.items():
        data["speakers"][spk_id] = {
            "id": speaker.id,
            "name": speaker.name,
            "position": speaker.position.to_list(),
            "group": speaker.group,
            "channel": speaker.channel,
        }

    for pt_id, point in state.points.items():
        data["points"][pt_id] = {
            "id": point.id,
            "name": point.name,
            "position": point.position.to_list(),
            "note": point.note,
        }

    if state.climate_data:
        data["climate_data"] = {
            "timestamp": state.climate_data.timestamp.isoformat(),
            "temperature_c": state.climate_data.temperature_c,
            "humidity_pct": state.climate_data.humidity_pct,
            "pressure_kpa": state.climate_data.pressure_kpa,
            "note": state.climate_data.note,
        }

    for override in state.overrides:
        data["overrides"].append({
            "point_id": override.point_id,
            "speaker_id": override.speaker_id,
            "override_type": override.override_type.value,
            "reason": override.reason,
        })

    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@click.group()
@click.version_option(version="0.1.0", prog_name="sound-calib")
def main() -> None:
    pass


@main.command()
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--unit", "-u", type=click.Choice(["meters", "centimeters", "feet"]),
              default="meters", help="坐标单位制")
@click.option("--force", "-f", is_flag=True, help="强制覆盖已存在的配置")
def init(config: str, unit: str, force: bool) -> None:
    config_path = Path(config)

    if config_path.exists() and not force:
        raise click.ClickException(
            f"配置文件已存在: {config_path}。使用 --force 选项覆盖。"
        )

    state = CalibrationState(
        unit_system=UnitSystem(unit),
    )

    save_state(state, config_path)
    click.echo(f"✓ 已初始化配置文件: {config_path}")
    click.echo(f"  单位制: {unit}")


@main.group()
def import_data() -> None:
    pass


@import_data.command("speakers")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.argument("csv_path", type=click.Path(exists=True, path_type=Path))
def import_speakers(config: str, csv_path: Path) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    try:
        speakers = parse_speakers_csv(csv_path)
    except CSVParseError as e:
        raise click.ClickException(str(e))

    for speaker in speakers:
        state.speakers[speaker.id] = speaker

    save_state(state, config_path)
    click.echo(f"✓ 已导入 {len(speakers)} 个音箱配置")
    for speaker in speakers:
        click.echo(f"  - {speaker.id}: {speaker.name} @ ({speaker.position.x}, {speaker.position.y}, {speaker.position.z})")


@import_data.command("points")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.argument("csv_path", type=click.Path(exists=True, path_type=Path))
def import_points(config: str, csv_path: Path) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    try:
        points = parse_points_csv(csv_path)
    except CSVParseError as e:
        raise click.ClickException(str(e))

    for point in points:
        state.points[point.id] = point

    save_state(state, config_path)
    click.echo(f"✓ 已导入 {len(points)} 个测点配置")
    for point in points:
        click.echo(f"  - {point.id}: {point.name} @ ({point.position.x}, {point.position.y}, {point.position.z})")


@import_data.command("climate")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.argument("csv_path", type=click.Path(exists=True, path_type=Path))
def import_climate(config: str, csv_path: Path) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    try:
        climate_list = parse_climate_csv(csv_path)
    except CSVParseError as e:
        raise click.ClickException(str(e))

    if not climate_list:
        raise click.ClickException("未找到有效的温湿度数据")

    state.climate_data = climate_list[0]

    save_state(state, config_path)
    c = state.climate_data
    click.echo(f"✓ 已导入温湿度数据")
    click.echo(f"  温度: {c.temperature_c}°C")
    click.echo(f"  湿度: {c.humidity_pct}%")
    if c.pressure_kpa:
        click.echo(f"  气压: {c.pressure_kpa} kPa")


@import_data.command("ir")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--speaker", "-s", help="指定音箱ID (不指定则从文件名推断)")
@click.option("--point", "-p", help="指定测点ID (不指定则从文件名推断)")
@click.argument("csv_path", type=click.Path(exists=True, path_type=Path))
def import_ir(config: str, speaker: Optional[str], point: Optional[str], csv_path: Path) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    try:
        ir = parse_impulse_response_csv(
            csv_path,
            speaker_id=speaker,
            point_id=point,
        )
    except CSVParseError as e:
        raise click.ClickException(str(e))

    if ir.speaker_id not in state.impulse_responses:
        state.impulse_responses[ir.speaker_id] = {}

    state.impulse_responses[ir.speaker_id][ir.point_id] = ir

    save_state(state, config_path)
    click.echo(f"✓ 已导入脉冲响应数据")
    click.echo(f"  音箱: {ir.speaker_id}")
    click.echo(f"  测点: {ir.point_id}")
    click.echo(f"  采样率: {ir.sample_rate} Hz")
    click.echo(f"  采样数: {len(ir.amplitude)}")
    click.echo(f"  时长: {ir.duration:.4f} s")


@import_data.command("ir-dir")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.argument("dir_path", type=click.Path(exists=True, file_okay=False, path_type=Path))
def import_ir_dir(config: str, dir_path: Path) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    csv_files = list(dir_path.glob("*.csv"))
    if not csv_files:
        raise click.ClickException(f"目录中未找到 CSV 文件: {dir_path}")

    imported = 0
    for csv_file in csv_files:
        try:
            ir = parse_impulse_response_csv(csv_file)
        except CSVParseError as e:
            click.echo(f"⚠  跳过 {csv_file.name}: {e}", err=True)
            continue

        if ir.speaker_id not in state.impulse_responses:
            state.impulse_responses[ir.speaker_id] = {}

        state.impulse_responses[ir.speaker_id][ir.point_id] = ir
        imported += 1
        click.echo(f"  导入: {csv_file.name} -> {ir.speaker_id}/{ir.point_id}")

    save_state(state, config_path)
    click.echo(f"✓ 共导入 {imported} 个脉冲响应文件")


@main.command()
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def check(config: str, verbose: bool) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    result = run_all_validations(state)

    state.last_validation = result
    save_state(state, config_path)

    if result.valid:
        click.echo("✓ 数据校验通过")
    else:
        click.echo("✗ 数据校验发现错误")
        sys.exit(1)

    if result.errors:
        click.echo("\n错误:")
        for err in result.errors:
            click.echo(f"  [{err.category}] {err.message}")
            if verbose and err.details:
                click.echo(f"      详情: {err.details}")

    if result.warnings:
        click.echo("\n警告:")
        for warn in result.warnings:
            click.echo(f"  [{warn.category}] {warn.message}")
            if verbose and warn.details:
                click.echo(f"      详情: {warn.details}")

    click.echo(f"\n统计: {len(result.errors)} 个错误, {len(result.warnings)} 个警告")


@main.command()
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--reference", "-r", help="指定参考音箱ID (不指定则自动选择)")
@click.option("--speed-of-sound", "-s", type=float, help="手动指定声速 (m/s)，覆盖自动估算")
@click.option("--no-geometric-hint", is_flag=True, help="不使用几何距离作为峰值检测辅助")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def solve(config: str, reference: Optional[str], speed_of_sound: Optional[float],
          no_geometric_hint: bool, verbose: bool) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    solver_config = SolverConfig(
        reference_speaker_id=reference,
        speed_of_sound_override=speed_of_sound,
        use_geometric_hint=not no_geometric_hint,
    )

    result = solve_delays(state, solver_config)

    state.last_solve = result
    save_state(state, config_path)

    click.echo("✓ 延时求解完成")
    click.echo(f"\n参考音箱: {result.reference_speaker_id}")
    click.echo(f"估算声速: {result.estimated_speed_of_sound:.2f} m/s "
               f"(置信度: {result.speed_of_sound_confidence:.2%})")

    click.echo("\n各音箱延时设置:")
    click.echo("-" * 80)
    for spk_id, dr in result.speaker_delays.items():
        is_ref = spk_id == result.reference_speaker_id
        risk_icon = "🟢" if dr.phase_risk_level == "low" else (
            "🟡" if dr.phase_risk_level == "medium" else "🔴"
        )

        click.echo(f"\n音箱: {spk_id} {'[参考]' if is_ref else ''}")
        click.echo(f"  建议延时: {dr.delay_ms:.3f} ms")
        click.echo(f"  相位风险: {risk_icon} {dr.phase_risk_score:.2%} ({dr.phase_risk_level})")
        click.echo(f"  置信度: {dr.confidence:.2%}")

        if verbose:
            click.echo(f"  使用测点: {', '.join(dr.used_points) or '无'}")
            click.echo(f"  排除测点: {', '.join(dr.excluded_points) or '无'}")
            if dr.locked_points:
                click.echo(f"  锁定测点: {', '.join(dr.locked_points) or '无'}")

    high_risk = [
        (spk_id, dr) for spk_id, dr in result.speaker_delays.items()
        if dr.phase_risk_level == "high"
    ]
    if high_risk:
        click.echo(f"\n⚠  高相位风险音箱 ({len(high_risk)} 个):")
        for spk_id, dr in high_risk:
            click.echo(f"  - {spk_id}: 延时差 {abs(dr.delta_ms):.3f}ms")


@main.group()
def override() -> None:
    pass


@override.command("lock")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--speaker", "-s", help="指定音箱ID (不指定则应用于所有音箱)")
@click.option("--reason", "-r", help="锁定原因说明")
@click.argument("point_id")
def lock_point(config: str, speaker: Optional[str], reason: Optional[str], point_id: str) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    state.overrides = [
        ov for ov in state.overrides
        if not (ov.point_id == point_id and ov.speaker_id == speaker)
    ]

    state.overrides.append(PointOverride(
        point_id=point_id,
        speaker_id=speaker,
        override_type=OverrideType.LOCK,
        reason=reason,
    ))

    save_state(state, config_path)
    spk_text = f" (音箱: {speaker})" if speaker else " (所有音箱)"
    click.echo(f"✓ 已锁定测点: {point_id}{spk_text}")


@override.command("exclude")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--speaker", "-s", help="指定音箱ID (不指定则应用于所有音箱)")
@click.option("--reason", "-r", help="排除原因说明")
@click.argument("point_id")
def exclude_point(config: str, speaker: Optional[str], reason: Optional[str], point_id: str) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    state.overrides = [
        ov for ov in state.overrides
        if not (ov.point_id == point_id and ov.speaker_id == speaker)
    ]

    state.overrides.append(PointOverride(
        point_id=point_id,
        speaker_id=speaker,
        override_type=OverrideType.EXCLUDE,
        reason=reason,
    ))

    save_state(state, config_path)
    spk_text = f" (音箱: {speaker})" if speaker else " (所有音箱)"
    click.echo(f"✓ 已排除测点: {point_id}{spk_text}")


@override.command("list")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
def list_overrides(config: str) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    if not state.overrides:
        click.echo("当前没有人工覆盖配置")
        return

    click.echo("人工覆盖配置列表:")
    click.echo("-" * 60)
    for i, ov in enumerate(state.overrides, 1):
        spk_text = f" (音箱: {ov.speaker_id})" if ov.speaker_id else " (所有音箱)"
        type_text = "锁定" if ov.override_type == OverrideType.LOCK else "排除"
        click.echo(f"{i}. [{type_text}] {ov.point_id}{spk_text}")
        if ov.reason:
            click.echo(f"   原因: {ov.reason}")


@override.command("clear")
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--force", "-f", is_flag=True, help="确认清除")
def clear_overrides(config: str, force: bool) -> None:
    if not force:
        click.confirm("确定要清除所有人工覆盖配置吗?", abort=True)

    config_path = Path(config)
    state = load_state(config_path)
    state.overrides = []
    save_state(state, config_path)
    click.echo("✓ 已清除所有人工覆盖配置")


@main.command()
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
@click.option("--output", "-o", default="calibration_report", help="输出文件名前缀")
@click.option("--format", "-f", "formats", multiple=True,
              type=click.Choice(["md", "csv", "json", "all"]),
              default=["all"],
              help="输出格式 (可多选)")
def report(config: str, output: str, formats: List[str]) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    output_path = Path(output)

    generate_all = "all" in formats
    generate_md = generate_all or "md" in formats
    generate_csv = generate_all or "csv" in formats
    generate_json = generate_all or "json" in formats

    if state.last_solve is None:
        click.echo("⚠  未找到求解结果，请先运行 solve 命令", err=True)

    if state.last_validation is None:
        click.echo("⚠  未找到校验结果，建议先运行 check 命令", err=True)

    if generate_md:
        md_path = output_path.with_suffix(".md")
        write_markdown_report(
            md_path,
            state,
            state.last_solve,
            state.last_validation,
        )
        click.echo(f"✓ 已生成 Markdown 报告: {md_path}")

    if generate_csv and state.last_solve:
        csv_path = output_path.with_suffix(".csv")
        write_delay_table_csv(
            csv_path,
            state.last_solve,
            state.speakers,
        )
        click.echo(f"✓ 已生成延时表 CSV: {csv_path}")

    if generate_json:
        json_path = output_path.with_suffix(".json")
        write_audit_package_json(
            json_path,
            state,
            state.last_solve,
            state.last_validation,
        )
        click.echo(f"✓ 已生成审计包 JSON: {json_path}")


@main.command()
@click.option("--config", "-c", default=DEFAULT_CONFIG_FILENAME, help="配置文件路径")
def status(config: str) -> None:
    config_path = Path(config)
    state = load_state(config_path)

    click.echo("声场延时校准状态")
    click.echo("=" * 60)
    click.echo(f"\n配置版本: {state.config_version}")
    click.echo(f"单位制: {state.unit_system.value}")
    click.echo(f"创建时间: {state.created_at}")
    click.echo(f"更新时间: {state.updated_at}")

    click.echo(f"\n音箱: {len(state.speakers)} 个")
    for spk_id, spk in state.speakers.items():
        click.echo(f"  - {spk_id}: {spk.name}")

    click.echo(f"\n测点: {len(state.points)} 个")
    for pt_id, pt in state.points.items():
        click.echo(f"  - {pt_id}: {pt.name}")

    click.echo(f"\n脉冲响应数据: {sum(len(p) for p in state.impulse_responses.values())} 组")
    for spk_id, points in state.impulse_responses.items():
        click.echo(f"  - 音箱 {spk_id}: {len(points)} 个测点")

    if state.climate_data:
        c = state.climate_data
        click.echo(f"\n环境参数:")
        click.echo(f"  温度: {c.temperature_c}°C")
        click.echo(f"  湿度: {c.humidity_pct}%")

    click.echo(f"\n人工覆盖: {len(state.overrides)} 个")

    if state.last_validation:
        v = state.last_validation
        click.echo(f"\n最后校验: {'通过' if v.valid else '失败'} "
                   f"({len(v.errors)} 错误, {len(v.warnings)} 警告)")

    if state.last_solve:
        s = state.last_solve
        click.echo(f"\n最后求解:")
        click.echo(f"  参考音箱: {s.reference_speaker_id}")
        click.echo(f"  声速: {s.estimated_speed_of_sound:.2f} m/s")
        click.echo(f"  延时结果: {len(s.speaker_delays)} 个音箱")


if __name__ == "__main__":
    main()
