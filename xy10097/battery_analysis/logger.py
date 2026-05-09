"""日志和错误追踪模块。"""

import logging
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum


class ErrorType(Enum):
    """错误类型枚举。"""
    MISSING_VALUE = "缺失值"
    DUPLICATE = "重复数据"
    UNIT_INCONSISTENCY = "单位不一致"
    OUTLIER = "异常值"
    INSUFFICIENT_CYCLES = "循环次数不足"
    INVALID_CAPACITY = "无效容量值"
    CAPACITY_DROP_ABNORMAL = "容量骤降异常"
    PARSE_ERROR = "解析错误"
    CALCULATION_ERROR = "计算错误"
    FORMAT_ERROR = "格式错误"


@dataclass
class FailedSample:
    """失败样本记录。"""
    battery_id: str
    error_type: str
    error_message: str
    timestamp: str
    cycle_number: Optional[int] = None
    value: Optional[Any] = None
    details: Optional[Dict[str, Any]] = None


@dataclass
class AnalysisLog:
    """分析日志记录。"""
    timestamp: str
    step: str
    status: str
    message: str
    details: Optional[Dict[str, Any]] = None


class AnalysisLogger:
    """分析日志器。"""
    
    def __init__(self, log_to_file: bool = True, log_file: Optional[str] = None, log_level: str = "INFO"):
        self.log_to_file = log_to_file
        self.log_file = log_file or f"battery_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        self.failed_samples: List[FailedSample] = []
        self.analysis_logs: List[AnalysisLog] = []
        
        self._setup_logger(log_level)
    
    def _setup_logger(self, log_level: str) -> None:
        """设置标准日志记录器。"""
        level_map = {
            "DEBUG": logging.DEBUG,
            "INFO": logging.INFO,
            "WARNING": logging.WARNING,
            "ERROR": logging.ERROR,
        }
        
        self.logger = logging.getLogger("battery_analysis")
        self.logger.setLevel(level_map.get(log_level, logging.INFO))
        
        if not self.logger.handlers:
            formatter = logging.Formatter(
                '%(asctime)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)
            
            if self.log_to_file:
                file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
                file_handler.setFormatter(formatter)
                self.logger.addHandler(file_handler)
    
    def log(self, step: str, message: str, status: str = "INFO", details: Optional[Dict] = None) -> None:
        """记录分析日志。"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = AnalysisLog(
            timestamp=timestamp,
            step=step,
            status=status,
            message=message,
            details=details
        )
        self.analysis_logs.append(log_entry)
        
        level = getattr(logging, status, logging.INFO)
        self.logger.log(level, f"[{step}] {message}")
        if details:
            self.logger.log(level, f"  详情: {json.dumps(details, ensure_ascii=False, default=str)}")
    
    def log_sample_failure(self, battery_id: str, error_type: ErrorType, 
                           error_message: str, cycle_number: Optional[int] = None,
                           value: Optional[Any] = None, details: Optional[Dict] = None) -> None:
        """记录失败样本。"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        failed_sample = FailedSample(
            battery_id=battery_id,
            error_type=error_type.value,
            error_message=error_message,
            timestamp=timestamp,
            cycle_number=cycle_number,
            value=value,
            details=details
        )
        self.failed_samples.append(failed_sample)
        
        self.logger.warning(
            f"样本失败: {battery_id} | 类型: {error_type.value} | 原因: {error_message}"
        )
        if cycle_number is not None:
            self.logger.warning(f"  循环次数: {cycle_number}")
        if value is not None:
            self.logger.warning(f"  异常值: {value}")
    
    def info(self, step: str, message: str, details: Optional[Dict] = None) -> None:
        self.log(step, message, "INFO", details)
    
    def warning(self, step: str, message: str, details: Optional[Dict] = None) -> None:
        self.log(step, message, "WARNING", details)
    
    def error(self, step: str, message: str, details: Optional[Dict] = None) -> None:
        self.log(step, message, "ERROR", details)
    
    def debug(self, step: str, message: str, details: Optional[Dict] = None) -> None:
        self.log(step, message, "DEBUG", details)
    
    def get_failed_samples_summary(self) -> Dict:
        """获取失败样本汇总。"""
        if not self.failed_samples:
            return {"count": 0, "by_type": {}, "samples": []}
        
        by_type = {}
        for sample in self.failed_samples:
            if sample.error_type not in by_type:
                by_type[sample.error_type] = []
            by_type[sample.error_type].append(sample.battery_id)
        
        return {
            "count": len(self.failed_samples),
            "by_type": {k: len(v) for k, v in by_type.items()},
            "samples": [asdict(s) for s in self.failed_samples]
        }
    
    def export_failed_samples(self, output_path: str, format: str = "json") -> bool:
        """导出失败样本记录。"""
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            if format.lower() == "json":
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(
                        self.get_failed_samples_summary(),
                        f,
                        ensure_ascii=False,
                        indent=2,
                        default=str
                    )
            elif format.lower() == "csv":
                import csv
                with open(path, "w", encoding="utf-8-sig", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        "电池编号", "错误类型", "错误信息", "时间戳", 
                        "循环次数", "异常值", "详情"
                    ])
                    for sample in self.failed_samples:
                        writer.writerow([
                            sample.battery_id,
                            sample.error_type,
                            sample.error_message,
                            sample.timestamp,
                            sample.cycle_number or "",
                            sample.value or "",
                            json.dumps(sample.details, ensure_ascii=False, default=str) if sample.details else ""
                        ])
            
            self.info("导出", f"失败样本记录已导出到: {output_path}")
            return True
        except Exception as e:
            self.error("导出", f"导出失败样本记录失败: {str(e)}")
            return False
    
    def get_execution_summary(self) -> Dict:
        """获取执行摘要。"""
        return {
            "total_logs": len(self.analysis_logs),
            "failed_samples": len(self.failed_samples),
            "logs": [asdict(log) for log in self.analysis_logs]
        }
