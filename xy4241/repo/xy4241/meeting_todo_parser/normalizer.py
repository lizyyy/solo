"""
归一化模块 - 负责将原始解析数据转换为统一的标准化格式
"""

import re
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import logging

from .parser import RawTodoItem

logger = logging.getLogger(__name__)


@dataclass
class NormalizedTodoItem:
    """归一化后的待办事项数据结构"""
    id: str
    content: str
    source_file: str
    line_number: int
    is_completed: bool
    raw_content: str
    
    # 归一化后的元数据
    assignee: Optional[str] = None
    assignee_normalized: Optional[str] = None  # 归一化后的负责人名称
    deadline: Optional[date] = None
    deadline_str: Optional[str] = None  # 原始日期字符串
    blocking_items: List[str] = field(default_factory=list)
    blocking_normalized: List[str] = field(default_factory=list)  # 归一化后的阻塞项
    
    # 状态标记
    has_assignee: bool = False
    has_deadline: bool = False
    has_blocking: bool = False
    
    # 额外元数据
    metadata: Dict[str, Any] = field(default_factory=dict)


class DateNormalizer:
    """日期归一化器"""
    
    CN_WEEKDAYS = {
        '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6,
        '天': 6  # 周天 = 周日
    }
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.date_config = config.get("date", {})
        self.output_format = self.date_config.get("output_format", "%Y-%m-%d")
        self.current_year = self.date_config.get("current_year", datetime.now().year)
        self.week_start_monday = self.date_config.get("week_start_monday", True)
    
    def normalize(self, date_str: str, reference_date: Optional[date] = None) -> Optional[date]:
        """
        将各种格式的日期字符串归一化为 date 对象
        
        Args:
            date_str: 原始日期字符串
            reference_date: 参考日期（用于相对日期计算），默认为今天
            
        Returns:
            归一化后的 date 对象，如果解析失败则返回 None
        """
        if not date_str:
            return None
        
        reference_date = reference_date or date.today()
        date_str = date_str.strip()
        
        # 尝试各种解析方式
        parsers = [
            self._parse_iso_format,
            self._parse_chinese_format,
            self._parse_relative_format,
        ]
        
        for parser in parsers:
            try:
                result = parser(date_str, reference_date)
                if result:
                    logger.debug(f"日期解析成功: '{date_str}' -> {result}")
                    return result
            except Exception as e:
                logger.debug(f"解析器 {parser.__name__} 失败: {str(e)}")
                continue
        
        logger.warning(f"无法解析日期: '{date_str}'")
        return None
    
    def _parse_iso_format(self, date_str: str, reference_date: date) -> Optional[date]:
        """解析 ISO 格式日期: 2024-01-15, 2024/01/15"""
        # 尝试 2024-01-15 格式
        match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', date_str)
        if match:
            year, month, day = map(int, match.groups())
            return date(year, month, day)
        
        # 尝试 2024/01/15 格式
        match = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', date_str)
        if match:
            year, month, day = map(int, match.groups())
            return date(year, month, day)
        
        return None
    
    def _parse_chinese_format(self, date_str: str, reference_date: date) -> Optional[date]:
        """解析中文格式日期: 2024年1月15日, 1月15日"""
        # 尝试 2024年1月15日 格式
        match = re.match(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$', date_str)
        if match:
            year, month, day = map(int, match.groups())
            return date(year, month, day)
        
        # 尝试 1月15日 格式（使用配置中的年份）
        # 注意：会议纪要中的日期应该使用配置中的 current_year，不自动推断年份
        match = re.match(r'^(\d{1,2})月(\d{1,2})日$', date_str)
        if match:
            month, day = map(int, match.groups())
            # 直接使用配置中的年份，不自动推断
            return date(self.current_year, month, day)
        
        return None
    
    def _parse_relative_format(self, date_str: str, reference_date: date) -> Optional[date]:
        """解析相对日期: 明天, 下周一一, 本周五"""
        # 明天
        if date_str == '明天':
            return reference_date + timedelta(days=1)
        
        # 后天
        if date_str == '后天':
            return reference_date + timedelta(days=2)
        
        # 本周X
        match = re.match(r'^本周([一二三四五六日天])$', date_str)
        if match:
            weekday_char = match.group(1)
            target_weekday = self.CN_WEEKDAYS[weekday_char]
            current_weekday = reference_date.weekday()
            
            # 计算差值
            delta = target_weekday - current_weekday
            if delta < 0:
                # 本周的这一天已经过去，使用下一周
                delta += 7
            
            return reference_date + timedelta(days=delta)
        
        # 下周X
        match = re.match(r'^下周([一二三四五六日天])$', date_str)
        if match:
            weekday_char = match.group(1)
            target_weekday = self.CN_WEEKDAYS[weekday_char]
            current_weekday = reference_date.weekday()
            
            # 计算到下一周同一天的天数
            # 先到本周日，再加1到周一，再加目标周几
            days_to_sunday = 6 - current_weekday
            days_to_target = days_to_sunday + 1 + target_weekday
            
            return reference_date + timedelta(days=days_to_target)
        
        return None
    
    def format_date(self, d: Optional[date]) -> str:
        """将 date 对象格式化为字符串"""
        if d is None:
            return ""
        return d.strftime(self.output_format)


class AssigneeNormalizer:
    """负责人名称归一化器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        # 可以在这里添加负责人别名映射配置
        self.aliases: Dict[str, str] = config.get("assignee_aliases", {})
    
    def normalize(self, assignee: Optional[str]) -> Optional[str]:
        """
        归一化负责人名称
        
        处理：
        - 去除前后空格
        - 统一大小写（如果是英文）
        - 别名映射
        """
        if not assignee:
            return None
        
        # 去除空格
        normalized = assignee.strip()
        
        # 检查别名映射
        if normalized in self.aliases:
            normalized = self.aliases[normalized]
        
        # 英文名称统一小写
        if re.match(r'^[a-zA-Z\s]+$', normalized):
            normalized = normalized.lower()
        
        return normalized


class TodoNormalizer:
    """待办事项归一化器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.date_normalizer = DateNormalizer(config)
        self.assignee_normalizer = AssigneeNormalizer(config)
    
    def normalize(self, raw_items: List[RawTodoItem]) -> List[NormalizedTodoItem]:
        """
        将原始待办事项列表归一化
        
        Args:
            raw_items: 原始待办事项列表
            
        Returns:
            归一化后的待办事项列表
        """
        normalized_items = []
        
        for idx, raw_item in enumerate(raw_items):
            try:
                normalized = self._normalize_item(raw_item, idx)
                normalized_items.append(normalized)
            except Exception as e:
                logger.error(f"归一化待办项失败: {raw_item.content[:50]}... 错误: {str(e)}")
                # 继续处理其他项
        
        logger.info(f"成功归一化 {len(normalized_items)} 个待办项")
        return normalized_items
    
    def _normalize_item(self, raw_item: RawTodoItem, index: int) -> NormalizedTodoItem:
        """归一化单个待办项"""
        # 归一化负责人
        assignee_normalized = None
        if raw_item.assignee:
            assignee_normalized = self.assignee_normalizer.normalize(raw_item.assignee)
        
        # 归一化日期
        deadline = None
        if raw_item.deadline_str:
            deadline = self.date_normalizer.normalize(raw_item.deadline_str)
        
        # 归一化阻塞项
        blocking_normalized = [
            self._normalize_blocking(item) for item in raw_item.blocking_items
        ]
        
        # 生成唯一ID
        item_id = self._generate_id(raw_item, index)
        
        return NormalizedTodoItem(
            id=item_id,
            content=raw_item.content,
            source_file=raw_item.source_file,
            line_number=raw_item.line_number,
            is_completed=raw_item.is_completed,
            raw_content=raw_item.raw_content,
            assignee=raw_item.assignee,
            assignee_normalized=assignee_normalized,
            deadline=deadline,
            deadline_str=raw_item.deadline_str,
            blocking_items=raw_item.blocking_items,
            blocking_normalized=blocking_normalized,
            has_assignee=assignee_normalized is not None,
            has_deadline=deadline is not None,
            has_blocking=len(blocking_normalized) > 0,
            metadata={
                **raw_item.metadata,
                "normalization_index": index
            }
        )
    
    def _normalize_blocking(self, blocking_item: str) -> str:
        """归一化阻塞项描述"""
        # 简单的归一化：去除多余空格
        return ' '.join(blocking_item.split())
    
    def _generate_id(self, raw_item: RawTodoItem, index: int) -> str:
        """生成待办项的唯一ID"""
        import hashlib
        
        # 使用源文件、行号和内容的哈希作为ID
        content_hash = hashlib.md5(
            f"{raw_item.source_file}:{raw_item.line_number}:{raw_item.content}".encode()
        ).hexdigest()[:8]
        
        return f"todo-{index:04d}-{content_hash}"
