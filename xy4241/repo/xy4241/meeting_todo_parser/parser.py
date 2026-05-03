"""
解析模块 - 负责从会议纪要中提取待办事项及其元数据
"""

import re
import os
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class RawTodoItem:
    """原始待办事项数据结构"""
    content: str
    source_file: str
    line_number: int
    is_completed: bool = False
    raw_content: str = ""
    assignee: Optional[str] = None
    deadline_str: Optional[str] = None
    blocking_items: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class TodoParser:
    """待办事项解析器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.parsing_config = config.get("parsing", {})
        self.date_config = config.get("date", {})
        
        # 编译正则表达式模式
        self._compile_patterns()
    
    def _compile_patterns(self):
        """预编译所有正则表达式模式"""
        # 待办标记模式
        todo_markers = self.parsing_config.get("todo_markers", [])
        self.todo_patterns = [re.escape(marker) for marker in todo_markers]
        
        # 构建匹配待办行的组合模式
        todo_or_pattern = "|".join(self.todo_patterns)
        self.todo_line_pattern = re.compile(
            rf"^\s*({todo_or_pattern})\s*(.*?)\s*$",
            re.IGNORECASE | re.MULTILINE
        )
        
        # 负责人模式
        assignee_patterns = self.parsing_config.get("assignee_patterns", [])
        self.assignee_patterns = [re.compile(p, re.IGNORECASE) for p in assignee_patterns]
        
        # 日期模式
        date_patterns = self.parsing_config.get("date_patterns", [])
        self.date_patterns = [re.compile(p, re.IGNORECASE) for p in date_patterns]
        
        # 阻塞项模式
        blocking_patterns = self.parsing_config.get("blocking_patterns", [])
        self.blocking_patterns = [re.compile(p, re.IGNORECASE) for p in blocking_patterns]
        
        # 截止日期关键字
        self.deadline_keywords = self.parsing_config.get("deadline_keywords", [])
    
    def parse_file(self, file_path: str) -> List[RawTodoItem]:
        """
        解析单个文件中的所有待办事项
        
        Args:
            file_path: 文件的完整路径
            
        Returns:
            原始待办事项列表
        """
        logger.debug(f"开始解析文件: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            logger.warning(f"文件编码不是UTF-8，尝试使用GBK: {file_path}")
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
            except Exception as e:
                logger.error(f"无法读取文件 {file_path}: {str(e)}")
                raise
        
        return self.parse_content(content, file_path)
    
    def parse_content(self, content: str, source_file: str = "") -> List[RawTodoItem]:
        """
        解析文本内容中的所有待办事项
        
        Args:
            content: 文本内容
            source_file: 来源文件名（用于错误报告）
            
        Returns:
            原始待办事项列表
        """
        items = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, start=1):
            # 检查是否是待办行
            todo_match = self.todo_line_pattern.match(line)
            if todo_match:
                marker = todo_match.group(1)
                todo_content = todo_match.group(2).strip()
                
                if not todo_content:
                    logger.debug(f"跳过空待办项: {source_file}:{line_num}")
                    continue
                
                # 检查是否已完成
                is_completed = self._is_completed(marker)
                
                # 解析元数据
                assignee = self._extract_assignee(todo_content)
                deadline_str = self._extract_deadline(todo_content)
                blocking_items = self._extract_blocking(todo_content)
                
                # 清理内容（移除已解析的元数据标记）
                cleaned_content = self._clean_content(todo_content)
                
                item = RawTodoItem(
                    content=cleaned_content,
                    source_file=source_file,
                    line_number=line_num,
                    is_completed=is_completed,
                    raw_content=todo_content,
                    assignee=assignee,
                    deadline_str=deadline_str,
                    blocking_items=blocking_items,
                    metadata={
                        "original_marker": marker,
                        "source_line": line
                    }
                )
                
                items.append(item)
                logger.debug(f"解析到待办项: {item.content[:50]}...")
        
        logger.info(f"从 {source_file} 解析到 {len(items)} 个待办项")
        return items
    
    def _is_completed(self, marker: str) -> bool:
        """检查待办标记是否表示已完成"""
        completed_markers = ["[x]", "[X]", "[✓]"]
        return any(cm in marker for cm in completed_markers)
    
    def _extract_assignee(self, content: str) -> Optional[str]:
        """从内容中提取负责人"""
        for pattern in self.assignee_patterns:
            match = pattern.search(content)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_deadline(self, content: str) -> Optional[str]:
        """从内容中提取截止日期字符串"""
        # 首先检查是否有关键字（如"截止"）来确定这是截止日期
        has_deadline_keyword = any(
            keyword in content for keyword in self.deadline_keywords
        )
        
        # 提取日期
        for pattern in self.date_patterns:
            match = pattern.search(content)
            if match:
                # 只有当有关键字或者没有其他日期歧义时才返回
                if has_deadline_keyword:
                    return match.group(1).strip()
                # 如果没有关键字但找到了日期，检查是否在上下文中是截止日期
                # 这里简化处理：如果找到了日期且没有明确的非截止标记，也返回
                return match.group(1).strip()
        return None
    
    def _extract_blocking(self, content: str) -> List[str]:
        """从内容中提取阻塞项"""
        blocking_items = []
        
        for pattern in self.blocking_patterns:
            for match in pattern.finditer(content):
                item = match.group(1).strip()
                if item and item not in blocking_items:
                    blocking_items.append(item)
        
        return blocking_items
    
    def _clean_content(self, content: str) -> str:
        """从内容中移除已解析的元数据标记"""
        cleaned = content
        
        # 移除截止日期关键字（按长度降序，确保长关键字先被匹配）
        # 例如："截止日期" 应该在 "截止" 之前被替换
        sorted_keywords = sorted(
            self.deadline_keywords,
            key=lambda k: len(k),
            reverse=True
        )
        for keyword in sorted_keywords:
            # 使用正则匹配，支持中文冒号和可选的空格
            cleaned = re.sub(
                rf'{re.escape(keyword)}[:：]?\s*',
                ' ',
                cleaned,
                flags=re.IGNORECASE
            )
        
        # 移除负责人标记
        for pattern in self.assignee_patterns:
            cleaned = pattern.sub("", cleaned)
        
        # 移除日期标记
        for pattern in self.date_patterns:
            cleaned = pattern.sub("", cleaned)
        
        # 移除阻塞项标记
        for pattern in self.blocking_patterns:
            cleaned = pattern.sub("", cleaned)
        
        # 移除多余的空格和标点
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = cleaned.strip()
        
        # 移除末尾的多余标点
        cleaned = cleaned.rstrip('，。；：,.;:')
        
        return cleaned


class FileScanner:
    """文件扫描器 - 扫描目录下的所有会议纪要文件"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.input_dir = config.get("input_dir", "./meetings")
        self.supported_extensions = tuple(
            config.get("supported_extensions", [".md", ".txt"])
        )
    
    def scan(self, custom_dir: Optional[str] = None) -> List[str]:
        """
        扫描目录下的所有支持文件
        
        Args:
            custom_dir: 可选的自定义目录，覆盖配置中的目录
            
        Returns:
            文件路径列表
        """
        target_dir = custom_dir or self.input_dir
        
        if not os.path.exists(target_dir):
            raise FileNotFoundError(f"输入目录不存在: {target_dir}")
        
        if not os.path.isdir(target_dir):
            raise NotADirectoryError(f"路径不是目录: {target_dir}")
        
        files = []
        
        for root, dirs, filenames in os.walk(target_dir):
            for filename in filenames:
                if filename.endswith(self.supported_extensions):
                    # 排除隐藏文件
                    if not filename.startswith('.'):
                        full_path = os.path.join(root, filename)
                        files.append(full_path)
        
        logger.info(f"扫描到 {len(files)} 个文件在目录: {target_dir}")
        return files
