import yaml
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, Any


@dataclass
class BackupConfig:
    target_dir: Path
    compression: bool = False
    max_backups: int = 5
    auto_checkpoint: bool = True
    verify_on_restore: bool = True


def parse_config(config_path: Path) -> BackupConfig:
    with open(config_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    target_dir = Path(data.get('target_dir', './backups'))
    target_dir.mkdir(parents=True, exist_ok=True)
    
    return BackupConfig(
        target_dir=target_dir,
        compression=data.get('compression', False),
        max_backups=data.get('max_backups', 5),
        auto_checkpoint=data.get('auto_checkpoint', True),
        verify_on_restore=data.get('verify_on_restore', True)
    )
