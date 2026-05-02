import argparse
import sys
from pathlib import Path
from .config import parse_config
from .snapshot import check_wal_state, create_snapshot
from .replay import replay_writes
from .verify import verify_restore
from .report import export_backup_plan, export_restore_check, export_manifest


def main():
    parser = argparse.ArgumentParser(description='SQLite 数据库备份和恢复演练工具')
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    run_parser = subparsers.add_parser('run', help='运行完整的备份演练流程')
    run_parser.add_argument('--db', required=True, help='业务数据库文件路径')
    run_parser.add_argument('--config', required=True, help='备份策略YAML配置文件')
    run_parser.add_argument('--writes', required=True, help='模拟写入JSONL文件')
    run_parser.add_argument('--output-dir', default='./output', help='输出目录')
    
    args = parser.parse_args()
    
    if args.command == 'run':
        run_backup_drill(
            db_path=Path(args.db),
            config_path=Path(args.config),
            writes_path=Path(args.writes),
            output_dir=Path(args.output_dir)
        )


def run_backup_drill(db_path: Path, config_path: Path, writes_path: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=== 开始备份演练 ===")
    
    print("1. 解析配置...")
    config = parse_config(config_path)
    
    print("2. 检查WAL状态...")
    wal_state = check_wal_state(db_path)
    print(f"   WAL存在: {wal_state['wal_exists']}, 大小: {wal_state.get('wal_size', 0)} 字节")
    
    print("3. 创建一致性快照...")
    snapshot = create_snapshot(db_path, config.target_dir, config.auto_checkpoint)
    print(f"   快照已创建: {snapshot['snapshot_dir']}")
    
    print("4. 回放模拟写入...")
    replay_results = replay_writes(db_path, writes_path)
    success_count = sum(1 for r in replay_results if r['status'] == 'success')
    print(f"   回放完成: {success_count}/{len(replay_results)} 条成功")
    
    print("5. 恢复校验...")
    verify_result = verify_restore(Path(snapshot['snapshot_dir']), snapshot['db_name'])
    print(f"   恢复校验: {'成功' if verify_result['success'] else '失败'}")
    
    print("6. 生成报告...")
    export_backup_plan(output_dir, {
        'target_dir': str(config.target_dir),
        'compression': config.compression,
        'max_backups': config.max_backups,
        'auto_checkpoint': config.auto_checkpoint
    }, wal_state, snapshot)
    
    export_restore_check(output_dir, verify_result)
    
    export_manifest(output_dir, {
        'backup': snapshot,
        'wal_state': wal_state,
        'verify': verify_result,
        'replay_count': len(replay_results),
        'replay_success': success_count
    })
    
    print(f"=== 演练完成 ===")
    print(f"报告已输出到: {output_dir}")


if __name__ == '__main__':
    main()
