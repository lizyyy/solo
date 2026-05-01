"""Markdown文件解析器"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Optional


@dataclass
class LinkReference:
    """链接引用信息"""
    text: str
    url: str
    anchor: Optional[str]
    line_number: int
    raw_text: str


@dataclass
class ImageReference:
    """图片引用信息"""
    alt_text: str
    url: str
    line_number: int
    raw_text: str


@dataclass
class HeadingInfo:
    """标题信息"""
    level: int
    text: str
    anchor: str
    line_number: int


class MarkdownParser:
    """Markdown解析器"""
    
    LINK_PATTERN = re.compile(
        r'\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)',
        re.MULTILINE
    )
    
    IMAGE_PATTERN = re.compile(
        r'!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)',
        re.MULTILINE
    )
    
    HEADING_PATTERN = re.compile(
        r'^(#{1,6})\s+(.+)$',
        re.MULTILINE
    )
    
    INLINE_CODE_BLOCK_PATTERN = re.compile(r'`[^`]*`')
    CODE_BLOCK_PATTERN = re.compile(r'```[\s\S]*?```', re.MULTILINE)
    
    def __init__(self, file_path: str, root_dir: str):
        self.file_path = file_path
        self.root_dir = root_dir
        self.content = ""
        self.lines = []
    
    def parse(self) -> Tuple[List[LinkReference], List[ImageReference], List[HeadingInfo]]:
        """解析Markdown文件"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.content = f.read()
        
        self.lines = self.content.split('\n')
        
        # 临时移除代码块以避免误解析其中的链接
        cleaned_content = self._remove_code_blocks(self.content)
        
        links = self._parse_links(cleaned_content)
        images = self._parse_images(cleaned_content)
        headings = self._parse_headings(cleaned_content)
        
        return links, images, headings
    
    def _remove_code_blocks(self, content: str) -> str:
        """临时移除代码块中的内容"""
        # 移除多行代码块
        content = self.CODE_BLOCK_PATTERN.sub('', content)
        # 移除行内代码
        content = self.INLINE_CODE_BLOCK_PATTERN.sub('', content)
        return content
    
    def _find_line_number(self, pattern: str, match_text: str, start_search: int = 0) -> int:
        """查找匹配项所在的行号"""
        # 简化方法：找到匹配文本在原始内容中的位置，然后计算行号
        match_index = self.content.find(match_text, start_search)
        if match_index == -1:
            return 0
        # 计算换行符数量
        line_count = self.content[:match_index].count('\n') + 1
        return line_count
    
    def _parse_links(self, cleaned_content: str) -> List[LinkReference]:
        """解析所有链接"""
        links = []
        for match in self.LINK_PATTERN.finditer(cleaned_content):
            text = match.group(1)
            url = match.group(2)
            raw_text = match.group(0)
            anchor = None
            line_number = self._find_line_number(text, raw_text)
            
            # 分离URL和锚点
            if '#' in url and not url.startswith('#'):
                parts = url.split('#', 1)
                url = parts[0]
                anchor = parts[1]
            elif url.startswith('#'):
                # 纯锚点链接
                anchor = url[1:]
                url = ""
            
            # 过滤掉外部链接
            if self._is_external_url(url):
                continue
            
            links.append(LinkReference(
                text=text,
                url=url,
                anchor=anchor,
                line_number=line_number,
                raw_text=raw_text
            ))
        
        return links
    
    def _parse_images(self, cleaned_content: str) -> List[ImageReference]:
        """解析所有图片"""
        images = []
        for match in self.IMAGE_PATTERN.finditer(cleaned_content):
            alt_text = match.group(1)
            url = match.group(2)
            raw_text = match.group(0)
            line_number = self._find_line_number(alt_text, raw_text)
            
            # 过滤掉外部链接
            if self._is_external_url(url):
                continue
            
            images.append(ImageReference(
                alt_text=alt_text,
                url=url,
                line_number=line_number,
                raw_text=raw_text
            ))
        
        return images
    
    def _parse_headings(self, cleaned_content: str) -> List[HeadingInfo]:
        """解析所有标题"""
        headings = []
        for match in self.HEADING_PATTERN.finditer(cleaned_content):
            level = len(match.group(1))
            text = match.group(2).strip()
            line_number = self._find_line_number(text, match.group(0))
            anchor = self._generate_anchor(text)
            
            headings.append(HeadingInfo(
                level=level,
                text=text,
                anchor=anchor,
                line_number=line_number
            ))
        
        return headings
    
    def _generate_anchor(self, heading_text: str) -> str:
        """根据标题文本生成锚点ID
        
        遵循GitHub风格的锚点生成规则：
        1. 转为小写
        2. 移除特殊字符
        3. 空格替换为连字符
        """
        # 移除HTML标签
        text = re.sub(r'<[^>]+>', '', heading_text)
        # 转小写
        text = text.lower()
        # 移除Markdown格式（粗体、斜体等）
        text = re.sub(r'[*_`]', '', text)
        # 只保留字母、数字、连字符和空格
        text = re.sub(r'[^\w\s-]', '', text)
        # 空格替换为连字符
        text = re.sub(r'\s+', '-', text)
        # 去除首尾连字符
        text = text.strip('-')
        
        return text
    
    def _is_external_url(self, url: str) -> bool:
        """检查是否为外部URL"""
        if not url:
            return False
        external_patterns = [
            'http://',
            'https://',
            'ftp://',
            'ftps://',
            'mailto:',
            'tel:',
        ]
        return any(url.lower().startswith(pattern) for pattern in external_patterns)
    
    def resolve_relative_path(self, relative_path: str) -> str:
        """将相对路径解析为绝对路径"""
        if not relative_path:
            return ""
        
        file_dir = Path(self.file_path).parent
        resolved = file_dir / relative_path
        
        # 规范化路径
        return str(resolved.resolve())


def parse_markdown_links(file_path: str, root_dir: str) -> List[LinkReference]:
    """便捷函数：解析Markdown文件中的链接"""
    parser = MarkdownParser(file_path, root_dir)
    links, _, _ = parser.parse()
    return links


def parse_markdown_images(file_path: str, root_dir: str) -> List[ImageReference]:
    """便捷函数：解析Markdown文件中的图片"""
    parser = MarkdownParser(file_path, root_dir)
    _, images, _ = parser.parse()
    return images


def parse_markdown_headings(file_path: str, root_dir: str) -> List[HeadingInfo]:
    """便捷函数：解析Markdown文件中的标题"""
    parser = MarkdownParser(file_path, root_dir)
    _, _, headings = parser.parse()
    return headings
