import re
import csv
import json
from typing import Dict, List, Any, Optional
from io import StringIO


class MarkdownParser:
    """解析Markdown课文文件"""
    
    def __init__(self):
        self.figure_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
        self.heading_pattern = re.compile(r'^(#+)\s+(.*?)$', re.MULTILINE)
        self.list_pattern = re.compile(r'^(\s*)[-*+]\s+(.*?)$', re.MULTILINE)
        self.ordered_list_pattern = re.compile(r'^(\s*)(\d+)\.\s+(.*?)$', re.MULTILINE)
    
    def parse(self, content: str, filename: str = '') -> Dict[str, Any]:
        """解析Markdown内容
        
        Args:
            content: Markdown文本内容
            filename: 源文件名（用于元数据）
            
        Returns:
            包含标题、段落、图片引用等信息的字典
        """
        lines = content.split('\n')
        
        title = self._extract_title(lines, filename)
        
        paragraphs = []
        current_paragraph = []
        paragraph_index = 0
        
        for line in lines:
            if self._is_heading(line):
                if current_paragraph:
                    para = self._build_paragraph(current_paragraph, paragraph_index)
                    if para['内容'].strip():
                        paragraphs.append(para)
                    paragraph_index += 1
                    current_paragraph = []
                continue
            
            if line.strip() == '':
                if current_paragraph:
                    para = self._build_paragraph(current_paragraph, paragraph_index)
                    if para['内容'].strip():
                        paragraphs.append(para)
                    paragraph_index += 1
                    current_paragraph = []
                continue
            
            current_paragraph.append(line)
        
        if current_paragraph:
            para = self._build_paragraph(current_paragraph, paragraph_index)
            if para['内容'].strip():
                paragraphs.append(para)
        
        figure_references = self._extract_figure_references(content)
        
        return {
            '文件名': filename,
            '标题': title,
            '段落': paragraphs,
            '图片引用': figure_references,
            '总段落数': len(paragraphs)
        }
    
    def _extract_title(self, lines: List[str], filename: str) -> str:
        """从文件中提取标题"""
        for line in lines:
            line = line.strip()
            if line.startswith('# '):
                return line[2:].strip()
            elif line.startswith('## '):
                return line[3:].strip()
        
        base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
        return base_name.replace('_', ' ').replace('-', ' ')
    
    def _is_heading(self, line: str) -> bool:
        """判断是否是标题行"""
        stripped = line.strip()
        return stripped.startswith('#') and stripped != '#'
    
    def _build_paragraph(self, lines: List[str], index: int) -> Dict[str, Any]:
        """构建段落数据"""
        full_text = ' '.join(line.strip() for line in lines if line.strip())
        full_text = re.sub(r'\s+', ' ', full_text)
        
        figure_refs = []
        for match in self.figure_pattern.finditer(full_text):
            alt_text = match.group(1)
            img_path = match.group(2)
            figure_refs.append({
                '原文': match.group(0),
                '替代文本': alt_text,
                '路径': img_path
            })
        
        list_type = None
        if self.list_pattern.match('\n'.join(lines)):
            list_type = '无序列表'
        elif self.ordered_list_pattern.match('\n'.join(lines)):
            list_type = '有序列表'
        
        return {
            '序号': index,
            '内容': full_text,
            '列表类型': list_type,
            '图片引用': [fr['路径'] for fr in figure_refs] if figure_refs else [],
            '图片引用详情': figure_refs,
            '字符数': len(full_text)
        }
    
    def _extract_figure_references(self, content: str) -> List[Dict[str, Any]]:
        """提取所有图片引用"""
        references = []
        for match in self.figure_pattern.finditer(content):
            references.append({
                '原文': match.group(0),
                '替代文本': match.group(1),
                '路径': match.group(2),
                '位置': match.start()
            })
        return references


class CSVParser:
    """解析词语注音CSV文件"""
    
    EXPECTED_HEADERS = ['词语', '拼音', '盲文点位', '备注']
    
    def __init__(self):
        self.delimiters = [',', '\t', ';', '|']
    
    def parse(self, content: str, filename: str = '') -> Dict[str, Any]:
        """解析CSV内容
        
        Args:
            content: CSV文本内容
            filename: 源文件名
            
        Returns:
            包含词语、拼音、盲文映射的字典
        """
        lines = content.strip().split('\n')
        if not lines:
            return {
                '文件名': filename,
                '表头': [],
                '条目': [],
                '总数': 0
            }
        
        detected_delimiter = self._detect_delimiter(lines[0])
        
        entries = []
        headers = []
        
        try:
            f = StringIO(content)
            reader = csv.reader(f, delimiter=detected_delimiter)
            
            first_row = next(reader, None)
            if first_row:
                is_header = self._is_header_row(first_row)
                if is_header:
                    headers = first_row
                else:
                    headers = self._generate_headers(len(first_row))
                    entry = self._build_entry(first_row, headers, 0)
                    if entry:
                        entries.append(entry)
            
            for row_num, row in enumerate(reader, start=len(entries)):
                if not row or all(cell.strip() == '' for cell in row):
                    continue
                entry = self._build_entry(row, headers, row_num)
                if entry:
                    entries.append(entry)
        
        except Exception as e:
            return self._fallback_parse(content, filename)
        
        return {
            '文件名': filename,
            '表头': headers,
            '条目': entries,
            '总数': len(entries),
            '分隔符': detected_delimiter
        }
    
    def _detect_delimiter(self, first_line: str) -> str:
        """自动检测CSV分隔符"""
        max_count = 0
        best_delimiter = ','
        
        for delim in self.delimiters:
            count = first_line.count(delim)
            if count > max_count:
                max_count = count
                best_delimiter = delim
        
        return best_delimiter
    
    def _is_header_row(self, row: List[str]) -> bool:
        """判断是否是表头行"""
        if not row:
            return False
        
        header_keywords = ['词语', '拼音', '盲文', '点位', '词', '注音', '字']
        
        for cell in row:
            cell_lower = cell.strip()
            for keyword in header_keywords:
                if keyword in cell_lower:
                    return True
        
        if len(row) >= 2:
            first_cell = row[0].strip()
            if first_cell and '\u4e00' <= first_cell[0] <= '\u9fff':
                return False
        
        return False
    
    def _generate_headers(self, column_count: int) -> List[str]:
        """生成默认表头"""
        default_headers = ['词语', '拼音', '盲文点位', '备注', '词性']
        return default_headers[:column_count] + [f'列{i+1}' for i in range(column_count - len(default_headers))]
    
    def _build_entry(self, row: List[str], headers: List[str], index: int) -> Optional[Dict[str, Any]]:
        """构建单个注音条目"""
        if not row:
            return None
        
        entry = {
            '序号': index,
            '原始行': row
        }
        
        word = ''
        pinyin = ''
        braille = ''
        note = ''
        
        for i, cell in enumerate(row):
            cell = cell.strip()
            if i < len(headers):
                header = headers[i].lower()
                entry[headers[i]] = cell
                
                if '词' in header or '字' in header:
                    word = cell
                elif '拼' in header or '音' in header:
                    pinyin = cell
                elif '盲' in header or '点位' in header or '点' in header:
                    braille = cell
                elif '备' in header or '注' in header:
                    note = cell
            else:
                entry[f'额外列{i}'] = cell
        
        if not word and row:
            word = row[0].strip() if row[0].strip() else ''
        
        entry['词语'] = word
        entry['拼音'] = pinyin
        entry['盲文点位'] = braille
        entry['备注'] = note
        
        if not word.strip():
            return None
        
        return entry
    
    def _fallback_parse(self, content: str, filename: str) -> Dict[str, Any]:
        """备用解析方法"""
        lines = content.strip().split('\n')
        entries = []
        
        for i, line in enumerate(lines):
            if not line.strip():
                continue
            
            parts = re.split(r'[,\t;|]', line)
            parts = [p.strip() for p in parts if p.strip()]
            
            if not parts:
                continue
            
            entry = {
                '序号': i,
                '词语': parts[0] if parts else '',
                '拼音': parts[1] if len(parts) > 1 else '',
                '盲文点位': parts[2] if len(parts) > 2 else '',
                '备注': parts[3] if len(parts) > 3 else '',
                '原始行': parts
            }
            entries.append(entry)
        
        return {
            '文件名': filename,
            '表头': ['词语', '拼音', '盲文点位', '备注'],
            '条目': entries,
            '总数': len(entries),
            '解析方式': '备用解析'
        }


class JSONParser:
    """解析触摸图说明JSON文件"""
    
    def __init__(self):
        pass
    
    def parse(self, content: str, filename: str = '') -> Dict[str, Any]:
        """解析JSON内容
        
        Args:
            content: JSON文本内容
            filename: 源文件名
            
        Returns:
            包含图片说明的字典
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            return {
                '文件名': filename,
                '错误': f'JSON解析失败: {str(e)}',
                '图片': [],
                '总数': 0
            }
        
        if isinstance(data, list):
            figures = self._parse_figure_list(data)
        elif isinstance(data, dict):
            figures = self._parse_figure_dict(data)
        else:
            figures = []
        
        return {
            '文件名': filename,
            '图片': figures,
            '总数': len(figures),
            '原始数据类型': type(data).__name__
        }
    
    def _parse_figure_list(self, data: List[Any]) -> List[Dict[str, Any]]:
        """解析图片列表格式"""
        figures = []
        
        for i, item in enumerate(data):
            figure = self._extract_figure_info(item, i)
            if figure:
                figures.append(figure)
        
        return figures
    
    def _parse_figure_dict(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """解析图片字典格式"""
        figures = []
        
        if '图片' in data and isinstance(data['图片'], list):
            for i, item in enumerate(data['图片']):
                figure = self._extract_figure_info(item, i)
                if figure:
                    figures.append(figure)
        
        elif 'figures' in data and isinstance(data['figures'], list):
            for i, item in enumerate(data['figures']):
                figure = self._extract_figure_info(item, i)
                if figure:
                    figures.append(figure)
        
        else:
            figure = self._extract_figure_info(data, 0)
            if figure:
                figures.append(figure)
            
            for key, value in data.items():
                if isinstance(value, dict) and ('说明' in value or 'description' in value):
                    figure = self._extract_figure_info(value, len(figures))
                    if figure:
                        figure['键名'] = key
                        figures.append(figure)
        
        return figures
    
    def _extract_figure_info(self, item: Any, index: int) -> Optional[Dict[str, Any]]:
        """提取单个图片的信息"""
        if not isinstance(item, dict):
            return None
        
        figure = {
            '序号': index,
            '原始数据': item
        }
        
        figure_id = item.get('编号') or item.get('id') or item.get('ID') or str(index)
        description = item.get('说明') or item.get('描述') or item.get('description') or item.get('desc') or ''
        path = item.get('路径') or item.get('文件') or item.get('path') or item.get('file') or ''
        alt_text = item.get('替代文本') or item.get('alt') or item.get('alt_text') or ''
        tags = item.get('标签') or item.get('tags') or []
        position = item.get('位置') or item.get('position') or None
        
        figure['编号'] = figure_id
        figure['说明'] = str(description) if description else ''
        figure['路径'] = str(path) if path else ''
        figure['替代文本'] = str(alt_text) if alt_text else ''
        figure['标签'] = tags if isinstance(tags, list) else [str(tags)]
        figure['位置'] = position
        
        if not figure['说明'] and not figure['路径']:
            return None
        
        return figure
    
    def validate_structure(self, data: Any) -> Dict[str, Any]:
        """验证JSON结构是否符合预期"""
        issues = []
        
        if isinstance(data, list):
            for i, item in enumerate(data):
                if not isinstance(item, dict):
                    issues.append({
                        '位置': f'列表项[{i}]',
                        '问题': '应为对象类型',
                        '类型': type(item).__name__
                    })
                else:
                    if '说明' not in item and 'description' not in item:
                        issues.append({
                            '位置': f'列表项[{i}]',
                            '问题': '缺少说明字段',
                            '建议': '添加"说明"或"description"字段'
                        })
        
        elif isinstance(data, dict):
            if '图片' not in data and 'figures' not in data:
                if '说明' not in data and 'description' not in data:
                    issues.append({
                        '位置': '根对象',
                        '问题': '未找到图片列表或说明字段',
                        '建议': '使用"图片"数组或直接包含"说明"字段'
                    })
        
        else:
            issues.append({
                '位置': '根',
                '问题': '数据类型不支持',
                '类型': type(data).__name__
            })
        
        return {
            '有效': len(issues) == 0,
            '问题': issues
        }
