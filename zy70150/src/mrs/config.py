from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="MRS_",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Message Replay Service"
    app_version: str = "1.0.0"

    database_url: str = Field(
        default="sqlite:///./mrs.db",
        description="数据库连接URL，支持SQLite、PostgreSQL、MySQL",
    )

    data_dir: Path = Field(
        default=Path("./data"),
        description="数据存储目录",
    )

    log_level: str = Field(
        default="INFO",
        description="日志级别: DEBUG, INFO, WARNING, ERROR, CRITICAL",
    )

    default_rate_limit_per_second: int = Field(
        default=10,
        ge=1,
        description="默认每秒重放速率限制",
    )

    default_rate_limit_per_minute: int = Field(
        default=300,
        ge=1,
        description="默认每分钟重放速率限制",
    )

    default_rate_limit_per_hour: int = Field(
        default=10000,
        ge=1,
        description="默认每小时重放速率限制",
    )

    enable_approval: bool = Field(
        default=True,
        description="是否启用审批流程",
    )

    max_retry_count: int = Field(
        default=3,
        ge=0,
        description="单个消息最大重试次数",
    )

    retry_interval_seconds: int = Field(
        default=60,
        ge=1,
        description="重试间隔秒数",
    )

    dry_run: bool = Field(
        default=False,
        description="是否为试运行模式，不会实际重放消息",
    )

    broker_type: str = Field(
        default="mock",
        description="消息中间件类型: mock, kafka, rabbitmq",
    )

    kafka_brokers: Optional[str] = Field(
        default=None,
        description="Kafka broker地址列表，用逗号分隔",
    )

    rabbitmq_url: Optional[str] = Field(
        default=None,
        description="RabbitMQ连接URL",
    )


settings = Settings()
