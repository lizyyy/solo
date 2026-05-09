from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import re
from .config import PartitionConfig


@dataclass
class PartitionInfo:
    name: str
    condition: str
    parameters: Dict[str, Any]
    row_count: Optional[int] = None
    status: str = "pending"


@dataclass
class StrategyValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class BasePartitionStrategy(ABC):
    def __init__(self, config: PartitionConfig):
        self.config = config
    
    @abstractmethod
    def validate(self) -> StrategyValidationResult:
        pass
    
    @abstractmethod
    def generate_partitions(self) -> List[PartitionInfo]:
        pass
    
    @abstractmethod
    def generate_select_sql(self, partition: PartitionInfo) -> str:
        pass
    
    @abstractmethod
    def generate_delete_sql(self, partition: PartitionInfo) -> str:
        pass


class ListPartitionStrategy(BasePartitionStrategy):
    def validate(self) -> StrategyValidationResult:
        result = StrategyValidationResult(valid=True)
        
        if self.config.values is None or len(self.config.values) == 0:
            result.valid = False
            result.errors.append("List partition strategy requires 'values' to be specified")
        
        if not self.config.column:
            result.valid = False
            result.errors.append("Partition column is required")
        
        return result
    
    def generate_partitions(self) -> List[PartitionInfo]:
        partitions = []
        for value in self.config.values:
            partitions.append(PartitionInfo(
                name=f"partition_{value}",
                condition=f"{self.config.column} = :value",
                parameters={'value': value}
            ))
        return partitions
    
    def generate_select_sql(self, partition: PartitionInfo) -> str:
        return f"SELECT * FROM {{source_table}} WHERE {partition.condition}"
    
    def generate_delete_sql(self, partition: PartitionInfo) -> str:
        return f"DELETE FROM {{source_table}} WHERE {partition.condition}"


class RangePartitionStrategy(BasePartitionStrategy):
    def validate(self) -> StrategyValidationResult:
        result = StrategyValidationResult(valid=True)
        
        if not self.config.column:
            result.valid = False
            result.errors.append("Partition column is required")
        
        if self.config.start_date is None and self.config.end_date is None:
            result.valid = False
            result.errors.append("Range partition strategy requires 'start_date' and/or 'end_date'")
        
        if self.config.interval is None:
            result.valid = False
            result.errors.append("Range partition strategy requires 'interval'")
        
        return result
    
    def _parse_date(self, date_str: str) -> datetime:
        for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"Unable to parse date: {date_str}")
    
    def _get_interval_timedelta(self, interval: str) -> timedelta:
        match = re.match(r'(\d+)([dwmqy])', interval)
        if not match:
            raise ValueError(f"Invalid interval format: {interval}. Expected format like '1d', '7d', '1m', '1w'")
        
        value = int(match.group(1))
        unit = match.group(2)
        
        if unit == 'd':
            return timedelta(days=value)
        elif unit == 'w':
            return timedelta(weeks=value)
        elif unit == 'm':
            return timedelta(days=value * 30)
        elif unit == 'q':
            return timedelta(days=value * 90)
        elif unit == 'y':
            return timedelta(days=value * 365)
        else:
            raise ValueError(f"Unsupported interval unit: {unit}")
    
    def generate_partitions(self) -> List[PartitionInfo]:
        partitions = []
        start_date = self._parse_date(self.config.start_date) if self.config.start_date else datetime.now()
        end_date = self._parse_date(self.config.end_date) if self.config.end_date else datetime.now()
        interval = self._get_interval_timedelta(self.config.interval)
        
        current_date = start_date
        partition_num = 1
        
        while current_date < end_date:
            next_date = current_date + interval
            if next_date > end_date:
                next_date = end_date
            
            partition_name = f"partition_{current_date.strftime('%Y%m%d')}_{next_date.strftime('%Y%m%d')}"
            partitions.append(PartitionInfo(
                name=partition_name,
                condition=f"{self.config.column} >= :start_date AND {self.config.column} < :end_date",
                parameters={
                    'start_date': current_date,
                    'end_date': next_date
                }
            ))
            
            current_date = next_date
            partition_num += 1
        
        return partitions
    
    def generate_select_sql(self, partition: PartitionInfo) -> str:
        return f"SELECT * FROM {{source_table}} WHERE {partition.condition}"
    
    def generate_delete_sql(self, partition: PartitionInfo) -> str:
        return f"DELETE FROM {{source_table}} WHERE {partition.condition}"


class HashPartitionStrategy(BasePartitionStrategy):
    def validate(self) -> StrategyValidationResult:
        result = StrategyValidationResult(valid=True)
        
        if not self.config.column:
            result.valid = False
            result.errors.append("Partition column is required")
        
        if self.config.values is None or len(self.config.values) == 0:
            result.valid = False
            result.errors.append("Hash partition strategy requires 'values' to be specified (hash buckets)")
        
        return result
    
    def generate_partitions(self) -> List[PartitionInfo]:
        partitions = []
        num_buckets = len(self.config.values)
        
        for i in range(num_buckets):
            partitions.append(PartitionInfo(
                name=f"partition_{i}",
                condition=f"MOD(ABS(CAST({self.config.column} AS BIGINT)), :num_buckets) = :bucket",
                parameters={
                    'num_buckets': num_buckets,
                    'bucket': i
                }
            ))
        
        return partitions
    
    def generate_select_sql(self, partition: PartitionInfo) -> str:
        return f"SELECT * FROM {{source_table}} WHERE {partition.condition}"
    
    def generate_delete_sql(self, partition: PartitionInfo) -> str:
        return f"DELETE FROM {{source_table}} WHERE {partition.condition}"


class PartitionStrategyFactory:
    @staticmethod
    def get_strategy(config: PartitionConfig) -> BasePartitionStrategy:
        strategy_map = {
            'list': ListPartitionStrategy,
            'range': RangePartitionStrategy,
            'hash': HashPartitionStrategy,
        }
        
        strategy_class = strategy_map.get(config.type.lower())
        if strategy_class is None:
            raise ValueError(f"Unsupported partition type: {config.type}")
        
        return strategy_class(config)
