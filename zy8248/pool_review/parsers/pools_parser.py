"""泳池信息解析器"""
from pathlib import Path
from typing import Dict, List, Optional
import csv
from datetime import time
import logging

from .base import BaseParser
from ..models import Pool, PoolOperationHours

logger = logging.getLogger(__name__)


class PoolsParser(BaseParser):
    """泳池信息CSV解析器"""
    
    REQUIRED_FIELDS = ['pool_id', 'pool_name', 'volume_cubic_meters', 
                       'target_free_chlorine_min', 'target_free_chlorine_max',
                       'target_ph_min', 'target_ph_max', 'target_orp_min', 'target_orp_max']
    
    def __init__(self, file_path: Path):
        super().__init__(file_path)
        self.pools: Dict[str, Pool] = {}
    
    def parse(self) -> Dict[str, Pool]:
        """解析pools.csv文件"""
        logger.info(f"解析泳池配置文件: {self.file_path}")
        
        if not self.file_path.exists():
            self.add_error(f"文件不存在: {self.file_path}")
            return {}
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        pool = self._parse_row(row, row_num)
                        if pool:
                            self.pools[pool.pool_id] = pool
                    except Exception as e:
                        self.add_error(f"第{row_num}行解析失败: {str(e)}")
        
        except Exception as e:
            self.add_error(f"文件读取失败: {str(e)}")
        
        return self.pools
    
    def _parse_row(self, row: Dict, row_num: int) -> Optional[Pool]:
        """解析单行数据"""
        pool_id = row.get('pool_id', '').strip()
        if not pool_id:
            self.add_warning(f"第{row_num}行缺少pool_id，跳过")
            return None
        
        pool_name = row.get('pool_name', '').strip() or f"Pool {pool_id}"
        
        try:
            volume = float(row.get('volume_cubic_meters', 0))
            if volume <= 0:
                self.add_warning(f"第{row_num}行池容无效: {volume}")
                volume = 100.0
        except (ValueError, TypeError):
            self.add_warning(f"第{row_num}行池容格式无效，使用默认值100")
            volume = 100.0
        
        try:
            fc_min = float(row.get('target_free_chlorine_min', 0.3))
            fc_max = float(row.get('target_free_chlorine_max', 1.0))
            ph_min = float(row.get('target_ph_min', 7.2))
            ph_max = float(row.get('target_ph_max', 7.6))
            orp_min = float(row.get('target_orp_min', 650))
            orp_max = float(row.get('target_orp_max', 850))
        except (ValueError, TypeError) as e:
            self.add_warning(f"第{row_num}行目标值解析失败: {str(e)}")
            fc_min, fc_max = 0.3, 1.0
            ph_min, ph_max = 7.2, 7.6
            orp_min, orp_max = 650, 850
        
        operation_hours = self._parse_operation_hours(row, row_num)
        
        return Pool(
            pool_id=pool_id,
            pool_name=pool_name,
            volume_cubic_meters=volume,
            target_free_chlorine=(fc_min, fc_max),
            target_ph=(ph_min, ph_max),
            target_orp=(orp_min, orp_max),
            operation_hours=operation_hours
        )
    
    def _parse_operation_hours(self, row: Dict, row_num: int) -> Optional[PoolOperationHours]:
        """解析运营时间"""
        open_time_str = row.get('daily_open_time', '').strip()
        close_time_str = row.get('daily_close_time', '').strip()
        
        if not open_time_str or not close_time_str:
            return None
        
        try:
            open_hour, open_min = map(int, open_time_str.split(':'))
            close_hour, close_min = map(int, close_time_str.split(':'))
            
            return PoolOperationHours(
                daily_open_time=time(open_hour, open_min),
                daily_close_time=time(close_hour, close_min)
            )
        except (ValueError, AttributeError) as e:
            self.add_warning(f"第{row_num}行运营时间解析失败: {str(e)}")
            return None
    
    def validate(self) -> bool:
        """验证泳池数据"""
        if not self.pools:
            self.add_error("没有有效的泳池数据")
            return False
        
        for pool_id, pool in self.pools.items():
            if not pool.pool_name:
                self.add_warning(f"泳池 {pool_id} 没有名称")
            
            if pool.volume_cubic_meters <= 0:
                self.add_warning(f"泳池 {pool_id} 池容无效")
        
        return not self.has_errors()
    
    def get_pools(self) -> Dict[str, Pool]:
        """获取解析后的泳池数据"""
        return self.pools.copy()
