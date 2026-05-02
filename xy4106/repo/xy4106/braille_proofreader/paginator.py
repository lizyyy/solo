from typing import Dict, List, Any, Optional
import math


class Paginator:
    """盲文分页器 - 处理行宽控制和页码管理"""
    
    DEFAULT_LINE_WIDTH = 32
    DEFAULT_LINES_PER_PAGE = 24
    DEFAULT_INDENT = 2
    
    def __init__(self, line_width: int = DEFAULT_LINE_WIDTH, 
                 lines_per_page: int = DEFAULT_LINES_PER_PAGE,
                 indent: int = DEFAULT_INDENT):
        """
        Args:
            line_width: 每行盲文方数（默认32方）
            lines_per_page: 每页行数（默认24行）
            indent: 段落首行缩进（默认2方）
        """
        self.line_width = line_width
        self.lines_per_page = lines_per_page
        self.indent = indent
        self._braille_cache = {}
    
    def paginate(self, content: List[Dict[str, Any]], 
                 title: str = '') -> List[Dict[str, Any]]:
        """将内容分页
        
        Args:
            content: 内容列表，每个元素包含 type、原文、盲文等字段
            title: 课文标题
            
        Returns:
            页面列表
        """
        pages = []
        current_page_lines = []
        current_line = 0
        page_number = 1
        
        for item in content:
            item_type = item.get('type', '段落')
            braille = item.get('盲文', '')
            original = item.get('原文', '')
            
            if item_type == '标题':
                title_lines = self._layout_title(braille, original)
                for line in title_lines:
                    if current_line >= self.lines_per_page:
                        pages.append(self._build_page(current_page_lines, page_number, title))
                        page_number += 1
                        current_page_lines = []
                        current_line = 0
                    
                    current_page_lines.append(line)
                    current_line += 1
            
            elif item_type == '段落':
                paragraph_lines = self._layout_paragraph(braille, original, item)
                for line in paragraph_lines:
                    if current_line >= self.lines_per_page:
                        pages.append(self._build_page(current_page_lines, page_number, title))
                        page_number += 1
                        current_page_lines = []
                        current_line = 0
                    
                    current_page_lines.append(line)
                    current_line += 1
            
            elif item_type == '图注':
                figure_lines = self._layout_figure_note(braille, item)
                for line in figure_lines:
                    if current_line >= self.lines_per_page:
                        pages.append(self._build_page(current_page_lines, page_number, title))
                        page_number += 1
                        current_page_lines = []
                        current_line = 0
                    
                    current_page_lines.append(line)
                    current_line += 1
        
        if current_page_lines:
            pages.append(self._build_page(current_page_lines, page_number, title))
        
        return pages
    
    def _layout_title(self, braille: str, original: str) -> List[Dict[str, Any]]:
        """排版标题 - 居中显示"""
        lines = []
        
        braille_parts = braille.split()
        total_length = len(braille_parts)
        
        if total_length <= self.line_width:
            padding = (self.line_width - total_length) // 2
            lines.append({
                '类型': '标题',
                '盲文': braille,
                '原文': original,
                '盲文长度': total_length,
                '左填充': padding,
                '行宽': self.line_width
            })
        else:
            chunks = self._split_braille_into_chunks(braille_parts, self.line_width)
            for i, chunk in enumerate(chunks):
                chunk_braille = ' '.join(chunk)
                chunk_length = len(chunk)
                
                padding = 0
                if i == 0 or i == len(chunks) - 1:
                    padding = (self.line_width - chunk_length) // 2
                
                lines.append({
                    '类型': '标题' if i == 0 else '标题续',
                    '盲文': chunk_braille,
                    '原文': original,
                    '盲文长度': chunk_length,
                    '左填充': padding,
                    '行宽': self.line_width,
                    '分段': i,
                    '总分段': len(chunks)
                })
        
        return lines
    
    def _layout_paragraph(self, braille: str, original: str, 
                         item: Dict[str, Any]) -> List[Dict[str, Any]]:
        """排版段落 - 首行缩进"""
        lines = []
        
        if not braille:
            return lines
        
        braille_parts = braille.split()
        
        if not braille_parts:
            return lines
        
        effective_width_first = self.line_width - self.indent
        effective_width_rest = self.line_width
        
        first_chunk_end = self._find_chunk_end(braille_parts, 0, effective_width_first)
        first_chunk = braille_parts[:first_chunk_end]
        
        lines.append({
            '类型': '段落',
            '盲文': ' '.join(first_chunk),
            '原文': original[:len(first_chunk)] if original else '',
            '盲文长度': len(first_chunk),
            '左缩进': self.indent,
            '行宽': self.line_width,
            '是否超宽': len(first_chunk) > effective_width_first
        })
        
        remaining = braille_parts[first_chunk_end:]
        current_pos = first_chunk_end
        
        while remaining:
            chunk_end = self._find_chunk_end(remaining, 0, effective_width_rest)
            chunk = remaining[:chunk_end]
            
            lines.append({
                '类型': '段落续',
                '盲文': ' '.join(chunk),
                '原文': original[current_pos:current_pos+len(chunk)] if original else '',
                '盲文长度': len(chunk),
                '左缩进': 0,
                '行宽': self.line_width,
                '是否超宽': len(chunk) > effective_width_rest
            })
            
            remaining = remaining[chunk_end:]
            current_pos += chunk_end
        
        return lines
    
    def _layout_figure_note(self, braille: str, 
                            item: Dict[str, Any]) -> List[Dict[str, Any]]:
        """排版图注 - 特殊标记"""
        lines = []
        
        figure_id = item.get('编号', '未知')
        prefix = f'【图{figure_id}】'
        
        prefix_braille = self._simple_text_to_braille(prefix)
        prefix_parts = prefix_braille.split()
        prefix_length = len(prefix_parts)
        
        effective_width = self.line_width - prefix_length - 1
        
        braille_parts = braille.split()
        
        if not braille_parts:
            return lines
        
        if len(braille_parts) <= effective_width:
            full_braille = prefix_braille + ' 0 ' + braille
            lines.append({
                '类型': '图注',
                '编号': figure_id,
                '盲文': full_braille,
                '原文': item.get('原文', ''),
                '盲文长度': prefix_length + 1 + len(braille_parts),
                '前缀长度': prefix_length,
                '行宽': self.line_width
            })
        else:
            first_chunk_end = self._find_chunk_end(braille_parts, 0, effective_width)
            first_chunk = braille_parts[:first_chunk_end]
            
            first_line_braille = prefix_braille + ' 0 ' + ' '.join(first_chunk)
            lines.append({
                '类型': '图注',
                '编号': figure_id,
                '盲文': first_line_braille,
                '原文': item.get('原文', ''),
                '盲文长度': prefix_length + 1 + len(first_chunk),
                '前缀长度': prefix_length,
                '行宽': self.line_width
            })
            
            remaining = braille_parts[first_chunk_end:]
            while remaining:
                chunk_end = self._find_chunk_end(remaining, 0, self.line_width)
                chunk = remaining[:chunk_end]
                
                lines.append({
                    '类型': '图注续',
                    '编号': figure_id,
                    '盲文': ' '.join(chunk),
                    '盲文长度': len(chunk),
                    '左缩进': prefix_length,
                    '行宽': self.line_width
                })
                
                remaining = remaining[chunk_end:]
        
        return lines
    
    def _find_chunk_end(self, parts: List[str], start: int, max_length: int) -> int:
        """查找最佳断行位置"""
        if start + max_length >= len(parts):
            return len(parts)
        
        end = min(start + max_length, len(parts))
        
        for i in range(end - 1, start, -1):
            if self._is_good_break_point(parts, i):
                return i - start
        
        return max_length
    
    def _is_good_break_point(self, parts: List[str], index: int) -> bool:
        """判断是否是好的断行点（标点后换行）"""
        if index >= len(parts):
            return False
        
        part = parts[index]
        
        punctuation_dots = ['2', '3', '4', '36', '56', '236', '235']
        if part in punctuation_dots:
            return True
        
        return False
    
    def _split_braille_into_chunks(self, parts: List[str], 
                                    chunk_size: int) -> List[List[str]]:
        """将盲文分割成块"""
        chunks = []
        current = []
        current_length = 0
        
        for part in parts:
            if current_length + 1 > chunk_size and current:
                chunks.append(current)
                current = []
                current_length = 0
            
            current.append(part)
            current_length += 1
        
        if current:
            chunks.append(current)
        
        return chunks
    
    def _build_page(self, lines: List[Dict[str, Any]], page_number: int,
                    title: str) -> Dict[str, Any]:
        """构建页面对象"""
        return {
            '页码': page_number,
            '课文标题': title,
            '行数': len(lines),
            '最大行数': self.lines_per_page,
            '行宽': self.line_width,
            '行': lines
        }
    
    def _simple_text_to_braille(self, text: str) -> str:
        """简单文本转盲文（用于图注前缀等）"""
        if text in self._braille_cache:
            return self._braille_cache[text]
        
        result = []
        for char in text:
            if char == '【' or char == '】':
                result.append('12356')
            elif char.isdigit():
                result.append('3456')
                result.append(str(ord(char) - ord('0') + 1) if char != '0' else '3456')
            else:
                result.append('0')
        
        braille = ' '.join(result)
        self._braille_cache[text] = braille
        return braille
    
    def check_line_overflow(self, line: Dict[str, Any]) -> Dict[str, Any]:
        """检查单行是否超宽"""
        braille_length = line.get('盲文长度', 0)
        line_width = line.get('行宽', self.line_width)
        left_indent = line.get('左缩进', 0)
        left_padding = line.get('左填充', 0)
        
        total_used = left_indent + left_padding + braille_length
        
        is_overflow = total_used > line_width
        
        return {
            '是否超宽': is_overflow,
            '实际使用': total_used,
            '行宽限制': line_width,
            '超出数量': max(0, total_used - line_width)
        }
    
    def calculate_page_count(self, content: List[Dict[str, Any]]) -> int:
        """估算总页数"""
        pages = self.paginate(content)
        return len(pages)
