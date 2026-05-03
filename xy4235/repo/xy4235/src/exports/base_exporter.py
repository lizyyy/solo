from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, List
from datetime import datetime
from pathlib import Path


@dataclass
class ExportResult:
    """
    导出结果
    """
    success: bool = True
    file_path: str = ""
    file_size: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    export_time: datetime = None
    
    def __post_init__(self):
        if self.export_time is None:
            self.export_time = datetime.now()
    
    def add_error(self, error: str):
        """
        添加错误
        """
        self.errors.append(error)
        self.success = False
    
    def add_warning(self, warning: str):
        """
        添加警告
        """
        self.warnings.append(warning)


class BaseExporter(ABC):
    """
    基础导出器抽象类
    """
    
    def __init__(self):
        self.result = ExportResult()
    
    @abstractmethod
    def export(self, case, output_path: str = None) -> ExportResult:
        """
        导出数据
        """
        pass
    
    def _ensure_output_dir(self, output_path: str) -> Path:
        """
        确保输出目录存在
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path
    
    def _get_file_size(self, file_path: str) -> int:
        """
        获取文件大小
        """
        try:
            return Path(file_path).stat().st_size
        except:
            return 0
    
    def _generate_default_filename(self, case, extension: str) -> str:
        """
        生成默认文件名
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if case and case.case_id:
            return f"{case.case_id}_{timestamp}.{extension}"
        
        return f"export_{timestamp}.{extension}"
