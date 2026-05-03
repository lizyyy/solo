#!/usr/bin/env python3
import click
import json
import csv
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
import uuid

from .parser_validator import (
    Parser, Validator, DeviceInfo, FirmwareManifest, UpgradeWindow,
    TelemetryEntry, ParserError, ValidationError
)
from .strategy_engine import (
    StrategyEngine, StrategyConfig, BatchPlan, BatchPriority
)
from .state_storage import (
    StateStorage, RollbackState, UpgradeRecord, StateStorageError
)
from .telemetry_replay import TelemetryReplay, TelemetryReplayError
from .exporter import Exporter, ExportError


WORK_DIR = Path.cwd()
STORAGE_DIR = WORK_DIR / ".firmware_ga"
OUTPUT_DIR = WORK_DIR / "output"


@click.group()
@click.version_option(version="0.1.0")
def main():
    """固件灰度放行员 - 离线巡检平板固件升级管理工具"""
    pass


@main.command()
@click.option('--output-dir', '-o', default='.', help='示例文件输出目录')
def init(output_dir):
    """生成示例配置文件和数据文件"""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    device_list = [
        {
            "device_id": "PAD-001",
            "hardware_batch": "BATCH-2024-A",
            "current_firmware": "v2.1.0",
            "battery_level": 85.5,
            "last_checkin": (datetime.now() - timedelta(hours=2)).isoformat(),
            "status": "idle",
            "hardware_model": "PadPro-10",
            "serial_number": "SN-2024-A001"
        },
        {
            "device_id": "PAD-002",
            "hardware_batch": "BATCH-2024-A",
            "current_firmware": "v2.1.0",
            "battery_level": 92.0,
            "last_checkin": (datetime.now() - timedelta(hours=1)).isoformat(),
            "status": "idle",
            "hardware_model": "PadPro-10",
            "serial_number": "SN-2024-A002"
        },
        {
            "device_id": "PAD-003",
            "hardware_batch": "BATCH-2024-B",
            "current_firmware": "v2.0.5",
            "battery_level": 45.0,
            "last_checkin": (datetime.now() - timedelta(hours=3)).isoformat(),
            "status": "idle",
            "hardware_model": "PadPro-12",
            "serial_number": "SN-2024-B001"
        },
        {
            "device_id": "PAD-004",
            "hardware_batch": "BATCH-2024-B",
            "current_firmware": "v2.0.5",
            "battery_level": 15.0,
            "last_checkin": (datetime.now() - timedelta(hours=5)).isoformat(),
            "status": "charging",
            "hardware_model": "PadPro-12",
            "serial_number": "SN-2024-B002"
        },
        {
            "device_id": "PAD-005",
            "hardware_batch": "BATCH-2024-C",
            "current_firmware": "v2.1.0",
            "battery_level": 78.0,
            "last_checkin": (datetime.now() - timedelta(minutes=30)).isoformat(),
            "status": "idle",
            "hardware_model": "PadPro-10",
            "serial_number": "SN-2024-C001"
        }
    ]
    
    device_csv_path = out_path / "devices.csv"
    with open(device_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=device_list[0].keys())
        writer.writeheader()
        writer.writerows(device_list)
    
    firmware_manifest = {
        "version": "v2.2.0",
        "hardware_compatible": ["BATCH-2024-A", "BATCH-2024-B", "BATCH-2024-C"],
        "signature_hash": "SHA256:abc123def4567890fedcba9876543210fedcba9876543210fedcba98765432",
        "file_path": "/firmware/padpro_v2.2.0_update.img",
        "checksum_sha256": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef",
        "release_notes": "修复蓝牙连接问题，优化电池管理，新增巡检数据加密功能",
        "rollback_version": "v2.1.0"
    }
    
    firmware_path = out_path / "firmware_manifest.json"
    with open(firmware_path, 'w', encoding='utf-8') as f:
        json.dump(firmware_manifest, f, indent=2, ensure_ascii=False)
    
    upgrade_windows = {
        "windows": [
            {
                "window_id": "WINDOW-MORNING",
                "start_time": (datetime.now().replace(hour=8, minute=0, second=0)).isoformat(),
                "end_time": (datetime.now().replace(hour=12, minute=0, second=0)).isoformat(),
                "allowed_hardware_batches": ["BATCH-2024-A"],
                "max_devices": 50,
                "priority": 1
            },
            {
                "window_id": "WINDOW-AFTERNOON",
                "start_time": (datetime.now().replace(hour=14, minute=0, second=0)).isoformat(),
                "end_time": (datetime.now().replace(hour=18, minute=0, second=0)).isoformat(),
                "allowed_hardware_batches": ["BATCH-2024-B", "BATCH-2024-C"],
                "max_devices": 100,
                "priority": 2
            },
            {
                "window_id": "WINDOW-NIGHT",
                "start_time": (datetime.now().replace(hour=22, minute=0, second=0)).isoformat(),
                "end_time": (datetime.now().replace(hour=6, minute=0, second=0) + timedelta(days=1)).isoformat(),
                "allowed_hardware_batches": ["*"],
                "max_devices": 200,
                "priority": 3
            }
        ]
    }
    
    windows_path = out_path / "upgrade_windows.yaml"
    with open(windows_path, 'w', encoding='utf-8') as f:
        yaml.dump(upgrade_windows, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    telemetry_logs = [
        {
            "device_id": "PAD-001",
            "timestamp": (datetime.now() - timedelta(days=2)).isoformat(),
            "event_type": "telemetry_report",
            "firmware_version": "v2.1.0",
            "details": {"battery_level": 90, "crash_count": 0, "network_status": "wifi"}
        },
        {
            "device_id": "PAD-002",
            "timestamp": (datetime.now() - timedelta(days=1, hours=12)).isoformat(),
            "event_type": "upgrade_start",
            "firmware_version": "v2.1.0",
            "details": {"target_version": "v2.1.5"}
        },
        {
            "device_id": "PAD-002",
            "timestamp": (datetime.now() - timedelta(days=1, hours=11, minutes=55)).isoformat(),
            "event_type": "upgrade_success",
            "firmware_version": "v2.1.5",
            "details": {"duration_seconds": 300}
        },
        {
            "device_id": "PAD-003",
            "timestamp": (datetime.now() - timedelta(hours=6)).isoformat(),
            "event_type": "upgrade_start",
            "firmware_version": "v2.0.5",
            "details": {"target_version": "v2.1.0"}
        },
        {
            "device_id": "PAD-003",
            "timestamp": (datetime.now() - timedelta(hours=5, minutes=45)).isoformat(),
            "event_type": "upgrade_failed",
            "firmware_version": "v2.0.5",
            "details": {"error_code": "E_DOWNLOAD_FAIL", "error_message": "网络连接中断"}
        },
        {
            "device_id": "PAD-005",
            "timestamp": (datetime.now() - timedelta(minutes=45)).isoformat(),
            "event_type": "telemetry_report",
            "firmware_version": "v2.1.0",
            "details": {"battery_level": 78, "crash_count": 0, "network_status": "4g"}
        }
    ]
    
    telemetry_path = out_path / "telemetry.jsonl"
    with open(telemetry_path, 'w', encoding='utf-8') as f:
        for entry in telemetry_logs:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    config_example = {
        "strategy": {
            "canary_percentage": 5.0,
            "phase_1_percentage": 15.0,
            "phase_2_percentage": 30.0,
            "phase_3_percentage": 50.0,
            "canary_max_failures": 0,
            "phase_max_failures_ratio": 0.05,
            "delay_between_batches_hours": 24.0,
            "group_by_hardware_batch": True,
            "prioritize_low_battery": False,
            "prioritize_recent_checkin": True,
            "minimum_batch_size": 1,
            "maximum_batch_size": 100
        },
        "validation": {
            "min_battery_threshold": 20.0
        },
        "storage": {
            "use_sqlite": True,
            "backup_on_import": True
        }
    }
    
    config_path = out_path / "firmware_ga_config.json"
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_example, f, indent=2, ensure_ascii=False)
    
    click.echo(f"✅ 示例文件已生成到: {out_path.absolute()}")
    click.echo("")
    click.echo("生成的文件:")
    click.echo(f"  📄 {device_csv_path.name} - 设备清单 (5台设备示例)")
    click.echo(f"  📄 {firmware_path.name} - 固件清单 (v2.2.0)")
    click.echo(f"  📄 {windows_path.name} - 升级窗口配置 (3个时段)")
    click.echo(f"  📄 {telemetry_path.name} - 遥测日志示例")
    click.echo(f"  📄 {config_path.name} - 策略配置示例")
    click.echo("")
    click.echo("下一步:")
    click.echo("  1. 运行 'firmware-ga import' 导入这些示例文件")
    click.echo("  2. 运行 'firmware-ga check' 进行校验")
    click.echo("  3. 运行 'firmware-ga plan' 生成分批策略")


@main.command()
@click.option('--devices', '-d', type=click.Path(exists=True), help='设备清单CSV')
@click.option('--firmware', '-f', type=click.Path(exists=True), help='固件清单JSON')
@click.option('--windows', '-w', type=click.Path(exists=True), help='升级窗口YAML')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
@click.option('--all', '-a', is_flag=True, help='导入默认目录下所有文件')
def import_data(devices, firmware, windows, telemetry, all):
    """导入设备清单、固件清单、升级窗口和遥测日志"""
    storage = StateStorage(STORAGE_DIR)
    
    imported = {}
    
    if devices:
        try:
            devices_path = Path(devices)
            device_list = Parser.parse_device_list(devices_path)
            storage.record_import(
                "devices", devices_path, len(device_list),
                {"hardware_batches": list(set(d.hardware_batch for d in device_list))}
            )
            imported["devices"] = len(device_list)
            click.echo(f"✅ 导入设备清单: {len(device_list)} 台设备")
        except ParserError as e:
            click.echo(f"❌ 设备清单导入失败: {e}")
    
    if firmware:
        try:
            firmware_path = Path(firmware)
            manifest = Parser.parse_firmware_manifest(firmware_path)
            storage.record_import(
                "firmware", firmware_path, 1,
                {"version": manifest.version, "compatible_batches": manifest.hardware_compatible}
            )
            imported["firmware"] = manifest.version
            click.echo(f"✅ 导入固件清单: 版本 {manifest.version}")
        except ParserError as e:
            click.echo(f"❌ 固件清单导入失败: {e}")
    
    if windows:
        try:
            windows_path = Path(windows)
            window_list = Parser.parse_upgrade_windows(windows_path)
            storage.record_import(
                "windows", windows_path, len(window_list),
                {"windows": [w.window_id for w in window_list]}
            )
            imported["windows"] = len(window_list)
            click.echo(f"✅ 导入升级窗口: {len(window_list)} 个窗口")
        except ParserError as e:
            click.echo(f"❌ 升级窗口导入失败: {e}")
    
    if telemetry:
        try:
            telemetry_path = Path(telemetry)
            entries = Parser.parse_telemetry_logs(telemetry_path)
            storage.record_import(
                "telemetry", telemetry_path, len(entries),
                {"device_count": len(set(e.device_id for e in entries))}
            )
            imported["telemetry"] = len(entries)
            click.echo(f"✅ 导入遥测日志: {len(entries)} 条记录")
        except ParserError as e:
            click.echo(f"❌ 遥测日志导入失败: {e}")
    
    if all:
        default_files = {
            "devices.csv": "devices",
            "firmware_manifest.json": "firmware",
            "upgrade_windows.yaml": "windows",
            "telemetry.jsonl": "telemetry"
        }
        
        for filename, import_type in default_files.items():
            filepath = WORK_DIR / filename
            if filepath.exists():
                try:
                    if import_type == "devices":
                        data = Parser.parse_device_list(filepath)
                        count = len(data)
                        meta = {"hardware_batches": list(set(d.hardware_batch for d in data))}
                    elif import_type == "firmware":
                        data = Parser.parse_firmware_manifest(filepath)
                        count = 1
                        meta = {"version": data.version, "compatible_batches": data.hardware_compatible}
                    elif import_type == "windows":
                        data = Parser.parse_upgrade_windows(filepath)
                        count = len(data)
                        meta = {"windows": [w.window_id for w in data]}
                    elif import_type == "telemetry":
                        data = Parser.parse_telemetry_logs(filepath)
                        count = len(data)
                        meta = {"device_count": len(set(e.device_id for e in data))}
                    
                    storage.record_import(import_type, filepath, count, meta)
                    imported[import_type] = count
                    click.echo(f"✅ 导入 {filename}: {count} 条记录")
                except ParserError as e:
                    click.echo(f"❌ {filename} 导入失败: {e}")
    
    if not imported:
        click.echo("⚠️ 未指定任何导入文件")
        click.echo("使用方法:")
        click.echo("  firmware-ga import --devices devices.csv --firmware firmware.json")
        click.echo("  或使用 -a 导入默认目录下的所有文件")
    else:
        click.echo("")
        click.echo(f"📁 数据存储位置: {STORAGE_DIR.absolute()}")


@main.command()
@click.option('--devices', '-d', type=click.Path(exists=True), required=True, help='设备清单CSV')
@click.option('--firmware', '-f', type=click.Path(exists=True), required=True, help='固件清单JSON')
@click.option('--windows', '-w', type=click.Path(exists=True), help='升级窗口YAML')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
@click.option('--firmware-file', type=click.Path(exists=True), help='实际固件文件路径(用于校验签名)')
@click.option('--output', '-o', type=click.Path(), help='校验结果输出目录')
@click.option('--verbose', '-v', is_flag=True, help='显示详细校验信息')
def check(devices, firmware, windows, telemetry, firmware_file, output, verbose):
    """校验硬件兼容、签名哈希、低电量、窗口冲突和重复升级"""
    try:
        device_list = Parser.parse_device_list(Path(devices))
        manifest = Parser.parse_firmware_manifest(Path(firmware))
        
        window_list = []
        if windows:
            window_list = Parser.parse_upgrade_windows(Path(windows))
        
        telemetry_entries = []
        if telemetry:
            telemetry_entries = Parser.parse_telemetry_logs(Path(telemetry))
        
        actual_firmware_path = Path(firmware_file) if firmware_file else None
        
        click.echo(f"📋 开始校验 {len(device_list)} 台设备...")
        click.echo(f"   目标固件版本: {manifest.version}")
        click.echo("")
        
        all_results = []
        passed_count = 0
        failed_count = 0
        
        default_window = None
        if window_list:
            default_window = window_list[0]
        else:
            default_window = UpgradeWindow(
                window_id="default",
                start_time=datetime.now(),
                end_time=datetime.now() + timedelta(hours=24),
                allowed_hardware_batches=["*"],
                max_devices=1000
            )
        
        for device in device_list:
            result = Validator.validate_all(
                device=device,
                firmware=manifest,
                window=default_window,
                telemetry_entries=telemetry_entries,
                actual_firmware_path=actual_firmware_path
            )
            
            all_results.append(result)
            
            if result["passed"]:
                passed_count += 1
                if verbose:
                    click.echo(f"✅ {device.device_id}: 通过")
            else:
                failed_count += 1
                failed_checks = [v for v in result["validations"] if not v["passed"]]
                if verbose:
                    click.echo(f"❌ {device.device_id}: 失败")
                    for check in failed_checks:
                        click.echo(f"   - {check['check']}: {check['message']}")
        
        click.echo("")
        click.echo("=" * 50)
        click.echo("📊 校验结果汇总")
        click.echo("=" * 50)
        click.echo(f"   总计设备: {len(device_list)}")
        click.echo(f"   ✅ 通过: {passed_count}")
        click.echo(f"   ❌ 失败: {failed_count}")
        
        if window_list:
            conflicts = Validator.validate_window_conflicts(window_list)
            if conflicts:
                click.echo("")
                click.echo("⚠️ 检测到升级窗口冲突:")
                for w1, w2, msg in conflicts:
                    click.echo(f"   - {msg}")
        
        if output:
            output_path = Path(output)
            output_path.mkdir(parents=True, exist_ok=True)
            exporter = Exporter(output_path)
            
            export_result = exporter.export_validation_summary(all_results)
            
            click.echo("")
            click.echo(f"📄 校验报告已导出:")
            for format_name, path in export_result.items():
                click.echo(f"   - {format_name}: {path.absolute()}")
        
        return all_results
        
    except ParserError as e:
        click.echo(f"❌ 解析错误: {e}")
        return []
    except Exception as e:
        click.echo(f"❌ 校验过程出错: {e}")
        return []


@main.command()
@click.option('--devices', '-d', type=click.Path(exists=True), required=True, help='设备清单CSV')
@click.option('--firmware', '-f', type=click.Path(exists=True), required=True, help='固件清单JSON')
@click.option('--windows', '-w', type=click.Path(exists=True), help='升级窗口YAML')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
@click.option('--config', '-c', type=click.Path(exists=True), help='策略配置JSON')
@click.option('--output', '-o', type=click.Path(), help='分批计划输出目录')
@click.option('--group-by-batch/--no-group-by-batch', default=True, help='按硬件批次分组')
def plan(devices, firmware, windows, telemetry, config, output, group_by_batch):
    """生成分批策略"""
    try:
        device_list = Parser.parse_device_list(Path(devices))
        manifest = Parser.parse_firmware_manifest(Path(firmware))
        
        window_list = []
        if windows:
            window_list = Parser.parse_upgrade_windows(Path(windows))
        
        telemetry_entries = []
        if telemetry:
            telemetry_entries = Parser.parse_telemetry_logs(Path(telemetry))
        
        strategy_config = StrategyConfig()
        if config:
            try:
                with open(config, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                    if 'strategy' in config_data:
                        for key, value in config_data['strategy'].items():
                            if hasattr(strategy_config, key):
                                setattr(strategy_config, key, value)
            except Exception as e:
                click.echo(f"⚠️ 策略配置加载失败，使用默认配置: {e}")
        
        strategy_config.group_by_hardware_batch = group_by_batch
        
        engine = StrategyEngine(strategy_config)
        
        click.echo("📋 生成升级分批策略...")
        click.echo(f"   设备总数: {len(device_list)}")
        click.echo(f"   目标固件: {manifest.version}")
        click.echo("")
        
        batches, stats = engine.generate_batching_plan(
            devices=device_list,
            firmware=manifest,
            windows=window_list,
            telemetry_entries=telemetry_entries
        )
        
        click.echo("=" * 60)
        click.echo("📊 分批策略汇总")
        click.echo("=" * 60)
        click.echo(f"   符合条件设备: {stats['eligible_devices']}")
        click.echo(f"   排除设备: {len(stats['excluded_devices'])}")
        click.echo(f"   分批次数: {len(batches)}")
        click.echo("")
        
        click.echo("批次详情:")
        click.echo("-" * 60)
        for i, batch in enumerate(batches, 1):
            priority_name = {
                BatchPriority.CANARY: "金丝雀(Canary)",
                BatchPriority.PHASE_1: "第一阶段",
                BatchPriority.PHASE_2: "第二阶段",
                BatchPriority.PHASE_3: "第三阶段",
                BatchPriority.FULL: "全量"
            }.get(batch.batch_priority, batch.batch_priority.value)
            
            click.echo(f"📦 批次 {i}: {batch.batch_id}")
            click.echo(f"   优先级: {priority_name}")
            click.echo(f"   设备数量: {batch.batch_size}")
            click.echo(f"   升级窗口: {batch.window_id}")
            click.echo(f"   延迟: {batch.delay_hours} 小时")
            click.echo(f"   最大允许失败: {batch.max_failures}")
            if len(batch.devices) <= 10:
                click.echo(f"   设备: {', '.join(batch.devices)}")
            else:
                click.echo(f"   设备: {batch.devices[0]}... (共{len(batch.devices)}台)")
            click.echo("")
        
        if output:
            output_path = Path(output)
            output_path.mkdir(parents=True, exist_ok=True)
            exporter = Exporter(output_path)
            
            batch_data = [
                {
                    "batch_id": b.batch_id,
                    "priority": b.batch_priority.value,
                    "device_count": len(b.devices),
                    "devices": b.devices,
                    "window_id": b.window_id,
                    "delay_hours": b.delay_hours,
                    "max_failures": b.max_failures,
                    "firmware_version": b.firmware_version
                }
                for b in batches
            ]
            
            report_data = {
                "summary": stats,
                "batch_plan": batch_data,
                "generated_at": datetime.now().isoformat()
            }
            
            json_path = exporter.export_to_json(report_data, "batch_plan.json")
            click.echo(f"📄 JSON计划已导出: {json_path.absolute()}")
            
            flat_batches = []
            for b in batches:
                for device_id in b.devices:
                    flat_batches.append({
                        "batch_id": b.batch_id,
                        "priority": b.batch_priority.value,
                        "device_id": device_id,
                        "window_id": b.window_id,
                        "delay_hours": b.delay_hours,
                        "firmware_version": b.firmware_version
                    })
            
            if flat_batches:
                csv_path = exporter.export_to_csv(flat_batches, "batch_devices.csv")
                click.echo(f"📄 CSV计划已导出: {csv_path.absolute()}")
        
        return batches
        
    except ParserError as e:
        click.echo(f"❌ 解析错误: {e}")
        return []
    except Exception as e:
        click.echo(f"❌ 策略生成出错: {e}")
        return []


@main.command()
@click.option('--device-id', '-d', multiple=True, help='指定设备ID (可多次指定)')
@click.option('--all-failed', is_flag=True, help='回滚所有升级失败的设备')
@click.option('--devices-csv', type=click.Path(exists=True), help='设备清单CSV')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
@click.option('--firmware', '-f', type=click.Path(exists=True), help='固件清单JSON')
@click.option('--reason', '-r', default="手动触发", help='回滚原因')
@click.option('--output', '-o', type=click.Path(), help='回滚记录输出目录')
def rollback(device_id, all_failed, devices_csv, telemetry, firmware, reason, output):
    """保存回滚状态"""
    storage = StateStorage(STORAGE_DIR)
    
    devices_to_rollback = []
    
    if device_id:
        devices_to_rollback = list(device_id)
    
    telemetry_entries = []
    if telemetry:
        telemetry_entries = Parser.parse_telemetry_logs(Path(telemetry))
    
    if all_failed and telemetry_entries:
        replay = TelemetryReplay(telemetry_entries)
        failed_devices = replay.get_devices_by_state("upgrade_failed")
        devices_to_rollback.extend(failed_devices)
        click.echo(f"📋 检测到 {len(failed_devices)} 台升级失败的设备")
    
    if not devices_to_rollback:
        click.echo("⚠️ 未指定任何回滚设备")
        click.echo("使用方法:")
        click.echo("  firmware-ga rollback --device-id PAD-001 --device-id PAD-002")
        click.echo("  firmware-ga rollback --all-failed --telemetry telemetry.jsonl")
        return
    
    manifest = None
    if firmware:
        manifest = Parser.parse_firmware_manifest(Path(firmware))
    
    device_map = {}
    if devices_csv:
        device_list = Parser.parse_device_list(Path(devices_csv))
        device_map = {d.device_id: d for d in device_list}
    
    click.echo(f"📋 准备回滚 {len(devices_to_rollback)} 台设备...")
    click.echo("")
    
    rollback_records = []
    
    for dev_id in devices_to_rollback:
        device = device_map.get(dev_id)
        from_version = device.current_firmware if device else "unknown"
        to_version = manifest.rollback_version if manifest else from_version
        
        rollback_id = f"RB-{datetime.now().strftime('%Y%m%d%H%M%S')}-{dev_id}"
        
        rollback_state = RollbackState(
            device_id=dev_id,
            rollback_time=datetime.now(),
            from_version=from_version,
            to_version=to_version,
            reason=reason,
            rollback_id=rollback_id,
            details={"manual_trigger": True}
        )
        
        storage.record_rollback(rollback_state)
        rollback_records.append(rollback_state)
        
        click.echo(f"✅ {dev_id}: 回滚记录已保存")
        click.echo(f"   回滚ID: {rollback_id}")
        click.echo(f"   从版本: {from_version} -> {to_version}")
        click.echo("")
    
    click.echo("=" * 50)
    click.echo("📊 回滚记录汇总")
    click.echo("=" * 50)
    click.echo(f"   已记录回滚: {len(rollback_records)} 台设备")
    click.echo(f"   存储位置: {STORAGE_DIR.absolute()}")
    
    if output and rollback_records:
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        exporter = Exporter(output_path)
        
        records_data = []
        for r in rollback_records:
            records_data.append({
                "rollback_id": r.rollback_id,
                "device_id": r.device_id,
                "rollback_time": r.rollback_time.isoformat(),
                "from_version": r.from_version,
                "to_version": r.to_version,
                "reason": r.reason,
                "telemetry_sync_status": r.telemetry_sync_status
            })
        
        json_path = exporter.export_to_json(records_data, "rollback_records.json")
        click.echo("")
        click.echo(f"📄 回滚记录已导出: {json_path.absolute()}")


@main.command()
@click.option('--devices', '-d', type=click.Path(exists=True), help='设备清单CSV')
@click.option('--firmware', '-f', type=click.Path(exists=True), help='固件清单JSON')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
@click.option('--format', '-F', type=click.Choice(['markdown', 'csv', 'json', 'all']), default='all', help='输出格式')
@click.option('--output', '-o', type=click.Path(), required=True, help='报告输出目录')
@click.option('--include-history/--no-history', default=True, help='包含历史记录')
def report(devices, firmware, telemetry, format, output, include_history):
    """导出 Markdown/CSV/JSON 审计包"""
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    exporter = Exporter(output_path)
    storage = StateStorage(STORAGE_DIR)
    
    click.echo("📋 生成审计报告...")
    
    report_data = {
        "generated_at": datetime.now().isoformat(),
        "summary": {},
        "statistics": {},
        "validation_results": [],
        "batch_plan": [],
        "rollback_records": [],
        "telemetry_stats": {},
        "discrepancies": []
    }
    
    upgrade_stats = storage.get_statistics()
    report_data["statistics"] = upgrade_stats
    
    if include_history:
        rollback_records = storage.get_all_rollback_states()
        report_data["rollback_records"] = rollback_records
    
    telemetry_entries = []
    if telemetry:
        try:
            telemetry_entries = Parser.parse_telemetry_logs(Path(telemetry))
            replay = TelemetryReplay(telemetry_entries)
            telemetry_stats = replay.get_upgrade_statistics()
            report_data["telemetry_stats"] = telemetry_stats
            
            if include_history and rollback_records:
                discrepancies = replay.find_rollback_discrepancies(rollback_records)
                report_data["discrepancies"] = discrepancies
        except ParserError as e:
            click.echo(f"⚠️ 遥测日志解析失败: {e}")
    
    if devices and firmware:
        try:
            device_list = Parser.parse_device_list(Path(devices))
            manifest = Parser.parse_firmware_manifest(Path(firmware))
            
            default_window = UpgradeWindow(
                window_id="report_check",
                start_time=datetime.now(),
                end_time=datetime.now() + timedelta(hours=24),
                allowed_hardware_batches=["*"],
                max_devices=1000
            )
            
            all_results = []
            for device in device_list:
                result = Validator.validate_all(
                    device=device,
                    firmware=manifest,
                    window=default_window,
                    telemetry_entries=telemetry_entries
                )
                all_results.append(result)
            
            report_data["validation_results"] = all_results
            
            passed = sum(1 for r in all_results if r.get('passed'))
            failed = len(all_results) - passed
            
            report_data["summary"] = {
                "total_devices": len(device_list),
                "validation_passed": passed,
                "validation_failed": failed,
                "target_firmware": manifest.version,
                "telemetry_entries": len(telemetry_entries)
            }
            
        except ParserError as e:
            click.echo(f"⚠️ 设备/固件解析失败: {e}")
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("📊 审计报告汇总")
    click.echo("=" * 50)
    
    if report_data["summary"]:
        for key, value in report_data["summary"].items():
            click.echo(f"   {key}: {value}")
    
    if report_data["discrepancies"]:
        click.echo("")
        click.echo(f"⚠️ 检测到 {len(report_data['discrepancies'])} 个数据不一致")
    
    click.echo("")
    click.echo("📄 导出报告:")
    
    export_formats = []
    if format == 'all':
        export_formats = ['json', 'csv', 'markdown']
    else:
        export_formats = [format]
    
    exported = {}
    
    for fmt in export_formats:
        if fmt == 'json':
            json_path = exporter.export_to_json(report_data, "audit_report.json")
            exported['json'] = json_path
            click.echo(f"   ✅ JSON: {json_path.absolute()}")
        
        if fmt == 'csv':
            if report_data["validation_results"]:
                csv_path = exporter.export_to_csv(
                    report_data["validation_results"],
                    "validation_results.csv"
                )
                exported['csv_validation'] = csv_path
                click.echo(f"   ✅ CSV (校验): {csv_path.absolute()}")
            
            if report_data["rollback_records"]:
                csv_rollback_path = exporter.export_to_csv(
                    report_data["rollback_records"],
                    "rollback_records.csv"
                )
                exported['csv_rollback'] = csv_rollback_path
                click.echo(f"   ✅ CSV (回滚): {csv_rollback_path.absolute()}")
        
        if fmt == 'markdown':
            md_path = exporter.export_to_markdown(
                report_data,
                "audit_report.md",
                title="固件灰度升级审计报告"
            )
            exported['markdown'] = md_path
            click.echo(f"   ✅ Markdown: {md_path.absolute()}")
    
    click.echo("")
    click.echo(f"📁 所有报告已导出到: {output_path.absolute()}")
    
    return exported


@main.command()
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def status(verbose):
    """显示当前状态和统计信息"""
    storage = StateStorage(STORAGE_DIR)
    
    click.echo("=" * 60)
    click.echo("📊 固件灰度放行员 - 状态概览")
    click.echo("=" * 60)
    click.echo("")
    
    stats = storage.get_statistics()
    
    click.echo("📈 升级记录统计:")
    upgrade = stats.get("upgrade_records", {})
    click.echo(f"   总计: {upgrade.get('total', 0)}")
    click.echo(f"   ✅ 成功: {upgrade.get('success_count', 0)}")
    click.echo(f"   ❌ 失败: {upgrade.get('failed_count', 0)}")
    click.echo(f"   🔄 进行中: {upgrade.get('in_progress_count', 0)}")
    click.echo(f"   ↩️ 已回滚: {upgrade.get('rollback_count', 0)}")
    click.echo("")
    
    click.echo("🔙 回滚记录统计:")
    rollback = stats.get("rollback_states", {})
    click.echo(f"   总计: {rollback.get('total', 0)}")
    click.echo(f"   ✅ 成功: {rollback.get('success_count', 0)}")
    click.echo(f"   🔄 遥测已同步: {rollback.get('synced_count', 0)}")
    click.echo("")
    
    import_history = storage.get_import_history()
    if import_history:
        click.echo("📥 最近导入记录:")
        for record in import_history[:5]:
            click.echo(f"   - {record['import_type']}: {record['record_count']} 条记录 ({record['import_time']})")
    
    click.echo("")
    click.echo(f"📁 数据存储位置: {stats.get('storage_path', STORAGE_DIR)}")


@main.command()
@click.argument('device_id')
@click.option('--telemetry', '-t', type=click.Path(exists=True), help='遥测日志JSONL')
def timeline(device_id, telemetry):
    """查看设备升级时间线"""
    if not telemetry:
        click.echo("❌ 请提供遥测日志文件")
        return
    
    try:
        telemetry_entries = Parser.parse_telemetry_logs(Path(telemetry))
        replay = TelemetryReplay(telemetry_entries)
        
        timeline = replay.get_device_timeline(device_id)
        if not timeline:
            click.echo(f"❌ 未找到设备 {device_id} 的遥测数据")
            return
        
        click.echo("=" * 60)
        click.echo(f"📊 设备 {device_id} 升级时间线")
        click.echo("=" * 60)
        click.echo(f"   当前状态: {timeline.current_state}")
        click.echo("")
        
        click.echo("📋 事件历史:")
        click.echo("-" * 60)
        
        for event in timeline.events:
            event_icon = {
                'upgrade_start': '🚀',
                'upgrade_success': '✅',
                'upgrade_failed': '❌',
                'upgrade_rollback': '↩️',
                'telemetry_report': '📡'
            }.get(event.event_type, '📄')
            
            click.echo(f"{event_icon} {event.timestamp}")
            click.echo(f"   事件类型: {event.event_type}")
            click.echo(f"   固件版本: {event.firmware_version}")
            if event.details:
                click.echo(f"   详情: {json.dumps(event.details, ensure_ascii=False)}")
            click.echo("")
        
        if timeline.upgrade_path:
            click.echo("🛤️ 升级路径:")
            for i, (from_ver, to_ver, time) in enumerate(timeline.upgrade_path, 1):
                click.echo(f"   {i}. {from_ver} -> {to_ver} ({time})")
        
    except ParserError as e:
        click.echo(f"❌ 解析错误: {e}")


if __name__ == '__main__':
    main()
