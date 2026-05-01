"""
文件名解析模块
从文件名中提取时间、门店编码和点位信息
"""
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Pattern

from .config import PhotoMetadata, StoreRule


class FilenameParser:
    """文件名解析器"""
    
    # 时间模式
    TIME_PATTERNS = [
        # 完整时间: 20230501_143000 或 2023-05-01 14:30:00
        r'(20\d{2})[-_./]?(0[1-9]|1[0-2])[-_./]?(0[1-9]|[12]\d|3[01])[-_./T\s]?([01]\d|2[0-3])[-_./:]?([0-5]\d)[-_./:]?([0-5]\d)',
        # 仅日期: 20230501 或 2023-05-01
        r'(20\d{2})[-_./]?(0[1-9]|1[0-2])[-_./]?(0[1-9]|[12]\d|3[01])',
        # 短格式日期: 230501 (年最后两位)
        r'(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])',
    ]
    
    # 门店编码模式（可以根据实际需求调整）
    STORE_CODE_PATTERNS = [
        # 两位字母+数字: SH001, BJ023, GZ1234
        r'\b([A-Z]{2})(\d{3,4})\b',
        # 城市代码+数字: 021-001, 010-0023
        r'\b(\d{3})[-_](\d{3,4})\b',
        # 纯数字门店编码: 1001, 20034
        r'\b(\d{4,6})\b',
    ]
    
    def __init__(self, store_rules: List[StoreRule] = None):
        self.store_rules = store_rules or []
        self.store_code_map = {rule.store_code.upper(): rule for rule in self.store_rules}
        # 也可以通过门店名称的关键词映射
        self.store_name_map = {}
        for rule in self.store_rules:
            # 提取门店名称中的关键词
            name_keywords = self._extract_keywords(rule.store_name)
            for keyword in name_keywords:
                if keyword not in self.store_name_map:
                    self.store_name_map[keyword] = []
                self.store_name_map[keyword].append(rule.store_code)
    
    def parse_filename(self, photo_path: Path, metadata: PhotoMetadata) -> PhotoMetadata:
        """解析文件名，提取时间、门店编码和点位信息"""
        filename = photo_path.stem  # 不带扩展名
        
        # 提取时间
        metadata.filename_time = self._extract_time_from_filename(filename)
        
        # 确定最终时间（优先EXIF，其次文件名）
        if metadata.exif_time:
            metadata.determined_time = metadata.exif_time
        elif metadata.filename_time:
            metadata.determined_time = metadata.filename_time
        
        # 提取门店编码
        metadata.store_code_from_filename = self._extract_store_from_filename(filename)
        
        # 确定最终门店编码
        if metadata.store_code_from_exif:
            metadata.determined_store_code = metadata.store_code_from_exif
        elif metadata.store_code_from_filename:
            metadata.determined_store_code = metadata.store_code_from_filename
        
        # 提取点位信息
        metadata.checkpoint_from_filename = self._extract_checkpoint_from_filename(
            filename, 
            metadata.determined_store_code
        )
        metadata.determined_checkpoint = metadata.checkpoint_from_filename
        
        return metadata
    
    def _extract_time_from_filename(self, filename: str) -> Optional[str]:
        """从文件名中提取时间"""
        for pattern in self.TIME_PATTERNS:
            match = re.search(pattern, filename)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) >= 6:
                        # 完整时间
                        year = self._normalize_year(groups[0])
                        month = groups[1]
                        day = groups[2]
                        hour = groups[3]
                        minute = groups[4]
                        second = groups[5]
                        dt = datetime(int(year), int(month), int(day), 
                                     int(hour), int(minute), int(second))
                        return dt.strftime("%Y-%m-%d %H:%M:%S")
                    elif len(groups) >= 3:
                        # 仅日期
                        year = self._normalize_year(groups[0])
                        month = groups[1]
                        day = groups[2]
                        dt = datetime(int(year), int(month), int(day), 0, 0, 0)
                        return dt.strftime("%Y-%m-%d %H:%M:%S")
                except (ValueError, IndexError):
                    continue
        return None
    
    def _normalize_year(self, year_str: str) -> str:
        """标准化年份（处理两位年份）"""
        if len(year_str) == 2:
            # 假设是20xx年
            return f"20{year_str}"
        return year_str
    
    def _extract_store_from_filename(self, filename: str) -> Optional[str]:
        """从文件名中提取门店编码"""
        # 首先尝试精确匹配已知的门店编码
        for store_code in self.store_code_map.keys():
            if store_code.upper() in filename.upper():
                return store_code.upper()
        
        # 然后尝试模式匹配
        for pattern in self.STORE_CODE_PATTERNS:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                # 组合匹配到的部分
                matched_code = ''.join(match.groups()).upper()
                # 检查是否在已知门店列表中
                if matched_code in self.store_code_map:
                    return matched_code
                # 如果未知，也返回（后续会标记为问题）
                return matched_code
        
        # 最后尝试通过门店名称关键词匹配
        keywords = self._extract_keywords(filename)
        for keyword in keywords:
            if keyword in self.store_name_map:
                # 返回第一个匹配的门店编码
                return self.store_name_map[keyword][0]
        
        return None
    
    def _extract_checkpoint_from_filename(self, filename: str, 
                                          store_code: Optional[str]) -> Optional[str]:
        """从文件名中提取点位信息"""
        if not store_code or store_code not in self.store_code_map:
            # 如果没有门店信息，尝试通用匹配
            return self._generic_checkpoint_match(filename)
        
        store_rule = self.store_code_map[store_code]
        
        # 遍历该门店的所有点位，尝试匹配
        for checkpoint in store_rule.checkpoints:
            pattern = store_rule.get_checkpoint_pattern(checkpoint)
            if pattern.search(filename):
                return checkpoint
        
        # 尝试通用匹配
        return self._generic_checkpoint_match(filename)
    
    def _generic_checkpoint_match(self, filename: str) -> Optional[str]:
        """通用点位匹配（当没有门店信息时使用）"""
        # 常见点位关键词
        common_checkpoints = {
            '入口': ['入口', '门口', 'entrance', 'door'],
            '收银台': ['收银', '收银台', 'cashier', 'checkout'],
            '货架': ['货架', '架', 'shelf'],
            '仓库': ['仓库', '库房', 'warehouse', 'storage'],
            '卫生间': ['卫生间', '厕所', '洗手间', 'toilet', 'restroom'],
            '消防': ['消防', 'fire', 'safety'],
            '前台': ['前台', 'front'],
            '后厨': ['后厨', '厨房', 'kitchen'],
        }
        
        filename_lower = filename.lower()
        for checkpoint, keywords in common_checkpoints.items():
            for keyword in keywords:
                if keyword.lower() in filename_lower:
                    return checkpoint
        
        return None
    
    def _extract_keywords(self, text: str) -> List[str]:
        """从文本中提取关键词"""
        # 移除非字母数字字符
        text = re.sub(r'[^\w\u4e00-\u9fff]+', ' ', text)
        # 分割成单词
        words = text.split()
        # 过滤掉太短的词
        keywords = [w for w in words if len(w) >= 2]
        return keywords
