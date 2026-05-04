"""配置管理模块"""

import os
from pathlib import Path
from typing import Optional


class Config:
    """应用配置类"""
    
    def __init__(self):
        self._db_path: Optional[Path] = None
        self._data_dir: Optional[Path] = None
        self._export_dir: Optional[Path] = None
        
    @property
    def db_path(self) -> Path:
        """数据库文件路径"""
        if self._db_path is None:
            self._db_path = Path(os.getenv(
                "NARRTOOL_DB_PATH",
                self.data_dir / "narrtool.db"
            ))
        return self._db_path
    
    @db_path.setter
    def db_path(self, value: str | Path):
        self._db_path = Path(value)
    
    @property
    def data_dir(self) -> Path:
        """数据目录"""
        if self._data_dir is None:
            self._data_dir = Path(os.getenv(
                "NARRTOOL_DATA_DIR",
                Path.cwd() / "data"
            ))
        self._data_dir.mkdir(parents=True, exist_ok=True)
        return self._data_dir
    
    @data_dir.setter
    def data_dir(self, value: str | Path):
        self._data_dir = Path(value)
    
    @property
    def export_dir(self) -> Path:
        """导出目录"""
        if self._export_dir is None:
            self._export_dir = Path(os.getenv(
                "NARRTOOL_EXPORT_DIR",
                self.data_dir / "exports"
            ))
        self._export_dir.mkdir(parents=True, exist_ok=True)
        return self._export_dir
    
    @export_dir.setter
    def export_dir(self, value: str | Path):
        self._export_dir = Path(value)
    
    @property
    def db_url(self) -> str:
        """SQLAlchemy 数据库连接 URL"""
        return f"sqlite:///{self.db_path.absolute()}"


config = Config()
