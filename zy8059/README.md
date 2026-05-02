# SQLite Guard

SQLite 数据库备份和恢复演练工具，用于小团队在发布前进行备份演练。

## 功能特点

- 检查 WAL/SHM 文件状态
- 生成一致性快照（支持自动 checkpoint）
- 回放模拟写入
- 临时目录恢复校验
- 生成备份计划、恢复检查报告和清单文件

## 安装依赖

```bash
pip install pyyaml
```

## 使用方法

### 准备示例数据

```bash
cd examples
python init_db.py
```

### 运行备份演练

```bash
python -m sqlite_guard run --db examples/business.db --config examples/backup_config.yaml --writes examples/simulated_writes.jsonl --output-dir ./output
```

## 输出文件

- `output/backup_plan.md` - 备份计划报告
- `output/restore_check.csv` - 恢复校验结果
- `output/manifest.json` - 完整清单文件
- `backups/snapshot_YYYYMMDD_HHMMSS/` - 数据库快照目录

## 模块说明

- `config.py` - 配置解析
- `snapshot.py` - SQLite 快照和 WAL/SHM 处理
- `replay.py` - 写入回放
- `verify.py` - 恢复校验
- `report.py` - 报告导出
- `__main__.py` - CLI 入口
