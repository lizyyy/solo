#!/usr/bin/env python3
import click
import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import hashlib


@dataclass
class DeviceFirmwareInfo:
    device_id: str
    device_type: str
    current_version: str
    target_version: str
    status: str
    upgrade_mode: str
    last_online: Optional[str]
    is_offline: bool
    version_abnormal: bool
    upgrade_path: Optional[str]
    checksum: Optional[str]
    error_message: Optional[str]


@dataclass
class ProcessingResult:
    input_file: str
    output_file: str
    success: bool
    devices_processed: int
    devices_offline: int
    version_abnormal: int
    errors: List[str]
    skipped_existing: bool = False


class FirmwareVersionValidator:
    @staticmethod
    def is_valid_semver(version: str) -> bool:
        pattern = r'^v?\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$'
        return bool(re.match(pattern, version))

    @staticmethod
    def compare_versions(v1: str, v2: str) -> int:
        def normalize(v):
            v = v.lstrip('v')
            parts = v.split('-')[0].split('.')
            return [int(p) for p in parts]
        try:
            nv1, nv2 = normalize(v1), normalize(v2)
            for a, b in zip(nv1, nv2):
                if a > b:
                    return 1
                elif a < b:
                    return -1
            return 0
        except Exception:
            return -1


class LockFirmwareProcessor:
    def __init__(self, dry_run: bool = False, overwrite: bool = False):
        self.dry_run = dry_run
        self.overwrite = overwrite
        self.validator = FirmwareVersionValidator()

    def parse_device_record(self, record: Dict[str, Any]) -> DeviceFirmwareInfo:
        device_id = str(record.get('device_id', ''))
        device_type = record.get('device_type', 'smart_lock')
        current_version = str(record.get('current_version', ''))
        target_version = str(record.get('target_version', ''))
        status = record.get('status', 'pending')
        upgrade_mode = record.get('upgrade_mode', 'ota')
        last_online_raw = record.get('last_online')
        if isinstance(last_online_raw, datetime):
            last_online = last_online_raw.isoformat() + 'Z'
        elif last_online_raw is not None:
            last_online = str(last_online_raw)
        else:
            last_online = None
        checksum = record.get('checksum')
        error_message = None

        is_offline = False
        last_online_dt = None
        if isinstance(last_online_raw, datetime):
            last_online_dt = last_online_raw
        elif last_online:
            try:
                last_online_dt = datetime.fromisoformat(last_online.replace('Z', '+00:00'))
            except Exception:
                pass
        
        if last_online_dt:
            offline_threshold = datetime.now(last_online_dt.tzinfo) if last_online_dt.tzinfo else datetime.now()
            delta = (offline_threshold - last_online_dt).total_seconds()
            is_offline = delta > 7 * 24 * 3600
        elif last_online:
            is_offline = True
            error_message = f"无效的时间格式: {last_online}"
        else:
            is_offline = True

        version_abnormal = False
        if not self.validator.is_valid_semver(current_version):
            version_abnormal = True
            error_message = f"当前版本格式异常: {current_version}"
        elif not self.validator.is_valid_semver(target_version):
            version_abnormal = True
            error_message = f"目标版本格式异常: {target_version}"
        elif self.validator.compare_versions(target_version, current_version) <= 0:
            version_abnormal = True
            error_message = f"目标版本不高于当前版本: {target_version} <= {current_version}"

        upgrade_path = None
        if not is_offline and not version_abnormal:
            upgrade_path = f"firmware/{device_type}/{target_version}/{device_id}.bin"

        return DeviceFirmwareInfo(
            device_id=device_id,
            device_type=device_type,
            current_version=current_version,
            target_version=target_version,
            status=status,
            upgrade_mode=upgrade_mode,
            last_online=last_online,
            is_offline=is_offline,
            version_abnormal=version_abnormal,
            upgrade_path=upgrade_path,
            checksum=checksum,
            error_message=error_message
        )

    def process_file(self, input_path: Path, output_path: Path) -> ProcessingResult:
        errors = []
        devices: List[DeviceFirmwareInfo] = []
        skipped_existing = False

        if output_path.exists() and not self.overwrite:
            skipped_existing = True
            return ProcessingResult(
                input_file=str(input_path),
                output_file=str(output_path),
                success=True,
                devices_processed=0,
                devices_offline=0,
                version_abnormal=0,
                errors=[],
                skipped_existing=True
            )

        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                if input_path.suffix == '.json':
                    data = json.load(f)
                elif input_path.suffix in ['.yaml', '.yml']:
                    import yaml
                    data = yaml.safe_load(f)
                else:
                    raise ValueError(f"不支持的文件格式: {input_path.suffix}")

            if isinstance(data, dict):
                records = data.get('devices', [])
            else:
                records = data

            for record in records:
                try:
                    device_info = self.parse_device_record(record)
                    devices.append(device_info)
                except Exception as e:
                    errors.append(f"设备记录解析失败: {str(e)}")

        except Exception as e:
            errors.append(f"文件读取失败: {str(e)}")
            return ProcessingResult(
                input_file=str(input_path),
                output_file=str(output_path),
                success=False,
                devices_processed=0,
                devices_offline=0,
                version_abnormal=0,
                errors=errors
            )

        devices_offline = sum(1 for d in devices if d.is_offline)
        version_abnormal = sum(1 for d in devices if d.version_abnormal)

        devices.sort(key=lambda d: (
            d.device_type,
            0 if d.is_offline else 1,
            0 if d.version_abnormal else 1,
            d.target_version,
            d.device_id
        ))

        output_data = {
            'processing_time': datetime.now().isoformat(),
            'summary': {
                'total_devices': len(devices),
                'offline_devices': devices_offline,
                'version_abnormal_devices': version_abnormal,
                'ready_for_upgrade': len(devices) - devices_offline - version_abnormal
            },
            'offline_devices': [asdict(d) for d in devices if d.is_offline],
            'version_abnormal_devices': [asdict(d) for d in devices if d.version_abnormal and not d.is_offline],
            'ready_devices': [asdict(d) for d in devices if not d.is_offline and not d.version_abnormal]
        }

        if not self.dry_run:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2, sort_keys=True)

        return ProcessingResult(
            input_file=str(input_path),
            output_file=str(output_path),
            success=True,
            devices_processed=len(devices),
            devices_offline=devices_offline,
            version_abnormal=version_abnormal,
            errors=errors,
            skipped_existing=skipped_existing
        )


@click.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True, path_type=Path),
              help='输入目录或文件路径')
@click.option('--output', '-o', required=True, type=click.Path(path_type=Path),
              help='输出目录路径')
@click.option('--dry-run', '-n', is_flag=True, default=False,
              help='试运行模式，不写入输出文件')
@click.option('--overwrite', '-f', is_flag=True, default=False,
              help='覆盖已存在的输出文件')
def main(input: Path, output: Path, dry_run: bool, overwrite: bool):
    processor = LockFirmwareProcessor(dry_run=dry_run, overwrite=overwrite)
    all_results: List[ProcessingResult] = []

    click.echo(f"智能门锁售后固件升级 CLI 工具")
    click.echo(f"输入路径: {input}")
    click.echo(f"输出路径: {output}")
    click.echo(f"试运行: {'是' if dry_run else '否'}")
    click.echo(f"覆盖模式: {'是' if overwrite else '否'}")
    click.echo("-" * 60)

    if input.is_file():
        files = [input]
    else:
        files = list(input.glob('*.json')) + list(input.glob('*.yaml')) + list(input.glob('*.yml'))

    if not files:
        click.echo(click.style("未找到任何 JSON 或 YAML 文件", fg='yellow'))
        return

    for file_path in files:
        relative_path = file_path.relative_to(input) if input.is_dir() else file_path.name
        output_file = output / relative_path
        output_file = output_file.with_suffix('.json')

        click.echo(f"处理: {file_path.name} ... ", nl=False)
        result = processor.process_file(file_path, output_file)
        all_results.append(result)

        if result.skipped_existing:
            click.echo(click.style("跳过 (已存在)", fg='yellow'))
        elif result.success and not result.errors:
            click.echo(click.style("成功", fg='green'))
            click.echo(f"  - 处理设备: {result.devices_processed}")
            click.echo(f"  - 离线设备: {result.devices_offline}")
            click.echo(f"  - 版本异常: {result.version_abnormal}")
        elif result.success:
            click.echo(click.style("部分成功", fg='yellow'))
            for err in result.errors:
                click.echo(f"  - {err}")
        else:
            click.echo(click.style("失败", fg='red'))
            for err in result.errors:
                click.echo(f"  - {err}")

    click.echo("-" * 60)
    click.echo("处理汇总:")

    total_processed = sum(r.devices_processed for r in all_results)
    total_offline = sum(r.devices_offline for r in all_results)
    total_version_abnormal = sum(r.version_abnormal for r in all_results)
    total_files = len(all_results)
    failed_files = sum(1 for r in all_results if not r.success)
    all_errors = [f"{r.input_file}: {err}" for r in all_results for err in r.errors]

    click.echo(f"处理文件数: {total_files}")
    click.echo(f"失败文件数: {failed_files}")
    click.echo(f"总处理设备: {total_processed}")
    click.echo(f"离线设备总数: {total_offline}")
    click.echo(f"版本异常总数: {total_version_abnormal}")

    if all_errors:
        click.echo("")
        click.echo(click.style("错误汇总:", fg='red'))
        for i, err in enumerate(all_errors, 1):
            click.echo(f"  {i}. {err}")

    if failed_files > 0:
        click.echo("")
        click.echo(click.style(f"警告: {failed_files} 个文件处理失败，但其他文件已完成处理", fg='yellow'))
        raise click.ClickException("部分文件处理失败")


if __name__ == '__main__':
    main()
