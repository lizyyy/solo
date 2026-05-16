import os
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass
from .models import TeamMapping


@dataclass
class CliConfig:
    input_file: Path
    output_dir: Path
    team_mapping_file: Optional[Path] = None
    sensitive_fields: List[str] = None
    mask_sensitive: bool = True
    show_noop: bool = False
    format: str = "all"
    force: bool = False
    verbosity: int = 0

    def __post_init__(self):
        if self.sensitive_fields is None:
            self.sensitive_fields = [
                "password", "secret", "token", "key", "private_key",
                "api_key", "access_key", "credentials", "certificate"
            ]

    @classmethod
    def validate_input(cls, input_file: Path) -> None:
        if not input_file.exists():
            raise FileNotFoundError(f"输入文件不存在: {input_file}")
        if not input_file.is_file():
            raise ValueError(f"输入不是文件: {input_file}")
        if input_file.stat().st_size == 0:
            raise ValueError(f"输入文件为空: {input_file}")

    @classmethod
    def validate_output_dir(cls, output_dir: Path, force: bool = False) -> None:
        if output_dir.exists():
            if not output_dir.is_dir():
                raise ValueError(f"输出路径不是目录: {output_dir}")
            if not force:
                existing_files = list(output_dir.glob("drift_summary_*"))
                if existing_files:
                    raise ValueError(
                        f"输出目录已包含摘要文件: {output_dir}\n"
                        f"使用 --force 覆盖或指定其他目录"
                    )
        else:
            output_dir.mkdir(parents=True, exist_ok=True)

    def get_output_path(self, suffix: str, extension: str) -> Path:
        timestamp = self.output_dir.stat().st_ctime if self.output_dir.exists() else 0
        base_name = f"drift_summary_{int(timestamp)}_{suffix}.{extension}"
        return self.output_dir / base_name


def load_team_mapping(mapping_file: Path) -> List[TeamMapping]:
    import json
    if not mapping_file.exists():
        return []
    with open(mapping_file, 'r') as f:
        data = json.load(f)
    return [TeamMapping(**item) for item in data]


def get_default_output_dir() -> Path:
    return Path.cwd() / "drift_summaries"
