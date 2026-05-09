import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class PartitionConfig:
    type: str
    column: str
    interval: Optional[str] = None
    values: Optional[List[Any]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@dataclass
class ArchiveConfig:
    source_table: str
    target_table: str
    partition: PartitionConfig
    archive_condition: Optional[str] = None
    batch_size: int = 1000
    primary_key: str = 'id'
    validate_columns: List[str] = field(default_factory=list)
    exclude_columns: List[str] = field(default_factory=list)


@dataclass
class DatabaseConfig:
    connection_string: str
    schema: Optional[str] = None


@dataclass
class ReportConfig:
    output_dir: str = './archive_reports'
    format: str = 'json'
    include_sql: bool = True
    include_sample_data: bool = True
    sample_limit: int = 10


@dataclass
class AppConfig:
    database: DatabaseConfig
    archive: ArchiveConfig
    report: ReportConfig = field(default_factory=ReportConfig)
    
    @classmethod
    def from_yaml(cls, config_path: str) -> 'AppConfig':
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = yaml.safe_load(f)
        
        return cls(
            database=DatabaseConfig(**config_data['database']),
            archive=ArchiveConfig(
                partition=PartitionConfig(**config_data['archive']['partition']),
                **{k: v for k, v in config_data['archive'].items() if k != 'partition'}
            ),
            report=ReportConfig(**config_data.get('report', {}))
        )
