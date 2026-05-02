import json
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List


def export_backup_plan(output_dir: Path, config: Dict[str, Any], wal_state: Dict[str, Any], snapshot: Dict[str, Any]) -> None:
    plan_path = output_dir / 'backup_plan.md'
    
    content = f"""# SQLite 数据库备份计划

生成时间: {datetime.now().isoformat()}

## 配置信息
- 目标目录: {config.get('target_dir')}
- 压缩: {config.get('compression')}
- 最大备份数: {config.get('max_backups')}
- 自动Checkpoint: {config.get('auto_checkpoint')}

## WAL 状态检查
- 数据库文件存在: {wal_state.get('db_exists')}
- WAL 文件存在: {wal_state.get('wal_exists')}
- WAL 大小: {wal_state.get('wal_size', 0)} 字节
- SHM 文件存在: {wal_state.get('shm_exists')}

## 快照信息
- 快照ID: {snapshot.get('timestamp')}
- 数据库名: {snapshot.get('db_name')}
- 数据库大小: {snapshot.get('db_size')} 字节
- 快照目录: {snapshot.get('snapshot_dir')}
"""
    
    with open(plan_path, 'w', encoding='utf-8') as f:
        f.write(content)


def export_restore_check(output_dir: Path, verify_result: Dict[str, Any]) -> None:
    csv_path = output_dir / 'restore_check.csv'
    
    stats = verify_result.get('stats', {})
    tables = stats.get('tables', [])
    
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['表名', '行数'])
        for table in tables:
            writer.writerow([table['name'], table['rows']])
        
        writer.writerow([])
        writer.writerow(['完整性检查', stats.get('integrity_check', 'N/A')])
        writer.writerow(['总验证行数', stats.get('total_rows', 0)])


def export_manifest(output_dir: Path, data: Dict[str, Any]) -> None:
    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
