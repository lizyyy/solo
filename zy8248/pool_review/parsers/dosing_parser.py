"""投药日志解析器"""
from pathlib import Path
from typing import Dict, List, Optional
import json
from datetime import datetime
import logging
from collections import defaultdict

from .base import BaseParser
from ..models import DosingRecord, DosingLog

logger = logging.getLogger(__name__)


class DosingParser(BaseParser):
    """投药日志JSONL解析器"""
    
    CHEMICAL_TYPES = {'chlorine', 'ph_minus', 'ph_plus', 'flocculant', 'algaecide'}
    
    def __init__(self, file_path: Path, pools: Dict[str, 'Pool'] = None):
        super().__init__(file_path)
        self.pools = pools or {}
        self.dosing_logs: Dict[str, DosingLog] = {}
    
    def parse(self) -> Dict[str, DosingLog]:
        """解析dosing_log.jsonl文件"""
        logger.info(f"解析投药日志文件: {self.file_path}")
        
        if not self.file_path.exists():
            self.add_error(f"文件不存在: {self.file_path}")
            return {}
        
        records_by_pool = defaultdict(list)
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        record = self._parse_line(line, line_num)
                        if record:
                            records_by_pool[record.pool_id].append(record)
                    except Exception as e:
                        self.add_warning(f"第{line_num}行解析失败: {str(e)}")
            
            for pool_id, records in records_by_pool.items():
                records = sorted(records, key=lambda x: x.timestamp)
                self.dosing_logs[pool_id] = DosingLog(
                    pool_id=pool_id,
                    records=records
                )
        
        except Exception as e:
            self.add_error(f"文件读取失败: {str(e)}")
        
        return self.dosing_logs
    
    def _parse_line(self, line: str, line_num: int) -> Optional[DosingRecord]:
        """解析单行JSON"""
        data = json.loads(line)
        
        pool_id = data.get('pool_id', '').strip()
        if not pool_id:
            self.add_warning(f"第{line_num}行缺少pool_id")
            return None
        
        try:
            timestamp_str = data.get('timestamp', '')
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            if timestamp.tzinfo is not None:
                timestamp = timestamp.replace(tzinfo=None)
        except (ValueError, TypeError) as e:
            self.add_warning(f"第{line_num}行时间戳解析失败: {str(e)}")
            return None
        
        chemical_type = data.get('chemical_type', '').strip().lower()
        if chemical_type not in self.CHEMICAL_TYPES:
            self.add_warning(f"第{line_num}行未知化学品类型: {chemical_type}")
        
        try:
            amount_kg = float(data.get('amount_kg', 0))
        except (ValueError, TypeError) as e:
            self.add_warning(f"第{line_num}行投药量解析失败: {str(e)}")
            amount_kg = 0.0
        
        return DosingRecord(
            pool_id=pool_id,
            timestamp=timestamp,
            chemical_type=chemical_type,
            amount_kg=amount_kg,
            operator=data.get('operator', ''),
            notes=data.get('notes', '')
        )
    
    def validate(self) -> bool:
        """验证投药日志"""
        if not self.dosing_logs:
            self.add_warning("没有投药日志数据")
        
        for pool_id, log in self.dosing_logs.items():
            if self.pools and pool_id not in self.pools:
                self.add_warning(f"投药日志中的泳池 {pool_id} 不在泳池配置中")
            
            if not log.records:
                continue
            
            for record in log.records:
                if record.amount_kg < 0:
                    self.add_warning(
                        f"泳池 {pool_id} 投药量为负值: "
                        f"{record.chemical_type} {record.amount_kg}kg "
                        f"在 {record.timestamp}"
                    )
        
        return not self.has_errors()
    
    def get_dosing_logs(self) -> Dict[str, DosingLog]:
        """获取解析后的投药日志"""
        return self.dosing_logs.copy()
