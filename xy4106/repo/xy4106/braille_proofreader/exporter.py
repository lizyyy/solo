from typing import Dict, List, Any, Optional
import json
import datetime


class Exporter:
    """盲文教材导出器
    
    支持导出格式：
    - BRF (Braille Ready Format): 盲文标准格式
    - TXT: 纯文本格式
    - Markdown: 可读性格式
    - JSON: 结构化数据格式
    """
    
    BRAILLE_UNICODE_BASE = 0x2800
    
    DOT_POSITIONS = {
        '1': 0,
        '2': 1,
        '3': 2,
        '4': 3,
        '5': 4,
        '6': 5,
        '7': 6,
        '8': 7,
    }
    
    def __init__(self):
        self._dot_cache = {}
    
    def export_brf(self, draft_data: Dict[str, Any]) -> str:
        """导出BRF格式（盲文标准格式）
        
        BRF格式使用ASCII字符表示盲文点位，通常使用：
        - 'a'-'z' 表示常用点位
        - 特殊字符表示标点
        """
        lines = []
        
        config = draft_data.get('配置', {})
        line_width = config.get('行宽', 32)
        pages = draft_data.get('页面', [])
        
        for page in pages:
            page_num = page.get('页码', 0)
            page_lines = page.get('行', [])
            
            for line in page_lines:
                braille = line.get('盲文', '')
                line_type = line.get('类型', '')
                
                brf_line = self._braille_to_brf(braille, line_type)
                
                if len(brf_line) < line_width:
                    brf_line = brf_line.ljust(line_width)
                
                lines.append(brf_line)
            
            lines.append('\x0c')
        
        return '\r\n'.join(lines)
    
    def export_txt(self, draft_data: Dict[str, Any]) -> str:
        """导出TXT纯文本格式"""
        lines = []
        
        config = draft_data.get('配置', {})
        line_width = config.get('行宽', 32)
        total_pages = draft_data.get('总页数', 0)
        pages = draft_data.get('页面', [])
        
        lines.append('=' * 60)
        lines.append('盲文教材 - 纯文本格式')
        lines.append(f'生成时间: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'行宽: {line_width} 方')
        lines.append(f'总页数: {total_pages}')
        lines.append('=' * 60)
        lines.append('')
        
        for page in pages:
            page_num = page.get('页码', 0)
            lesson_title = page.get('课文标题', '未知课文')
            page_lines = page.get('行', [])
            
            lines.append(f'【第 {page_num} 页 - {lesson_title}】')
            lines.append('-' * 40)
            
            for line_index, line in enumerate(page_lines, 1):
                braille = line.get('盲文', '')
                line_type = line.get('类型', '')
                original = line.get('原文', '')
                braille_length = line.get('盲文长度', 0)
                
                unicode_braille = self._braille_to_unicode(braille)
                
                type_label = ''
                if line_type == '标题':
                    type_label = '[标题]'
                elif line_type == '图注':
                    type_label = '[图注]'
                elif line_type == '段落续':
                    type_label = '[续]'
                
                lines.append(f'{line_index:2d}. {type_label:6} {unicode_braille}')
                if original:
                    lines.append(f'    原文: {original}')
            
            lines.append('')
            lines.append('=' * 60)
            lines.append('')
        
        return '\n'.join(lines)
    
    def export_markdown(self, draft_data: Dict[str, Any], 
                       report_data: Optional[Dict[str, Any]] = None) -> str:
        """导出Markdown格式（可读性最佳）"""
        lines = []
        
        config = draft_data.get('配置', {})
        line_width = config.get('行宽', 32)
        total_pages = draft_data.get('总页数', 0)
        pages = draft_data.get('页面', [])
        
        lines.append('# 盲文教材')
        lines.append('')
        lines.append('## 基本信息')
        lines.append('')
        lines.append(f'- **生成时间**: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'- **行宽**: {line_width} 方')
        lines.append(f'- **总页数**: {total_pages}')
        lines.append('')
        
        if report_data:
            lines.append('## 校对报告摘要')
            lines.append('')
            by_severity = report_data.get('按严重程度', {})
            lines.append(f'- **错误**: {by_severity.get("错误", 0)} 个')
            lines.append(f'- **警告**: {by_severity.get("警告", 0)} 个')
            lines.append(f'- **提示**: {by_severity.get("提示", 0)} 个')
            lines.append('')
        
        lines.append('## 详细内容')
        lines.append('')
        
        for page in pages:
            page_num = page.get('页码', 0)
            lesson_title = page.get('课文标题', '未知课文')
            page_lines = page.get('行', [])
            
            lines.append(f'### 第 {page_num} 页 - {lesson_title}')
            lines.append('')
            
            lines.append('| 行号 | 类型 | 盲文（Unicode） | 原文 |')
            lines.append('|------|------|-----------------|------|')
            
            for line_index, line in enumerate(page_lines, 1):
                braille = line.get('盲文', '')
                line_type = line.get('类型', '段落')
                original = line.get('原文', '')
                
                unicode_braille = self._braille_to_unicode(braille)
                
                type_display = {
                    '标题': '标题',
                    '标题续': '标题续',
                    '段落': '段落',
                    '段落续': '段落续',
                    '图注': '图注',
                    '图注续': '图注续'
                }.get(line_type, line_type)
                
                lines.append(f'| {line_index:2d} | {type_display} | `{unicode_braille}` | {original[:30]}{"..." if len(original) > 30 else ""} |')
            
            lines.append('')
        
        if report_data:
            lines.append('## 详细问题列表')
            lines.append('')
            
            issues = report_data.get('问题列表', [])
            
            if issues:
                for severity in ['错误', '警告', '提示']:
                    severity_issues = [i for i in issues if i.get('严重程度') == severity]
                    
                    if severity_issues:
                        lines.append(f'### {severity}')
                        lines.append('')
                        
                        for issue in severity_issues:
                            problem_type = issue.get('问题类型', '未知问题')
                            location = issue.get('位置', '未知')
                            description = issue.get('描述', '')
                            suggestion = issue.get('建议', '')
                            
                            lines.append(f'**{problem_type}**')
                            lines.append(f'- 位置: {location}')
                            lines.append(f'- 描述: {description}')
                            if suggestion:
                                lines.append(f'- 建议: {suggestion}')
                            lines.append('')
            else:
                lines.append('*未发现问题*')
                lines.append('')
        
        return '\n'.join(lines)
    
    def export_json(self, draft_data: Dict[str, Any],
                    report_data: Optional[Dict[str, Any]] = None) -> str:
        """导出JSON格式（结构化数据）"""
        export_data = {
            '版本': '0.1.0',
            '导出时间': datetime.datetime.now().isoformat(),
            '分页草稿': draft_data,
        }
        
        if report_data:
            export_data['校对报告'] = report_data
        
        return json.dumps(export_data, ensure_ascii=False, indent=2)
    
    def _braille_to_brf(self, braille_text: str, line_type: str = '') -> str:
        """将盲文点位转换为BRF格式字符"""
        if not braille_text:
            return ''
        
        result = []
        parts = braille_text.split()
        
        for part in parts:
            if part == '0':
                result.append(' ')
                continue
            
            brf_char = self._dots_to_brf_char(part)
            result.append(brf_char)
        
        return ''.join(result)
    
    def _dots_to_brf_char(self, dots: str) -> str:
        """将点位字符串转换为BRF字符
        
        BRF使用ASCII字符映射盲文点位：
        - 点位1: a, A, @
        - 点位12: b, B
        - 等等...
        """
        dot_value = self._dots_to_value(dots)
        
        brf_map = {
            0: ' ',
            1: 'A', 2: '1', 3: 'B', 4: '\'', 5: 'K',
            6: '2', 7: 'L', 8: '@', 9: 'I', 10: 'F',
            11: '/', 12: 'M', 13: 'S', 14: 'P', 15: '"',
            16: ',', 17: 'E', 18: ':', 19: 'H', 20: 'O',
            21: '4', 22: 'Z', 23: '<', 24: '%', 25: '?',
            26: 'W', 27: ']', 28: 'X', 29: '!', 30: '&',
            31: '>', 32: '^', 33: '-', 34: '9', 35: '_',
            36: '8', 37: '7', 38: '0', 39: '|', 40: '$',
            41: '"', 42: ';', 43: '(', 44: 'C', 45: 'D',
            46: 'Y', 47: 'N', 48: ':', 49: 'G', 50: '5',
            51: '6', 52: 'V', 53: 'U', 54: '3', 55: '[',
            56: 'J', 57: 'Q', 58: ')', 59: 'T', 60: '*',
            61: 'R', 62: '+', 63: '#'
        }
        
        return brf_map.get(dot_value, '?')
    
    def _dots_to_value(self, dots: str) -> int:
        """将点位字符串转换为数值"""
        value = 0
        for dot_char in dots:
            if dot_char in self.DOT_POSITIONS:
                value |= (1 << self.DOT_POSITIONS[dot_char])
        return value
    
    def _braille_to_unicode(self, braille_text: str) -> str:
        """将盲文点位转换为Unicode盲文字符"""
        if not braille_text:
            return ''
        
        result = []
        parts = braille_text.split()
        
        for part in parts:
            if part == '0':
                result.append('⠀')
                continue
            
            unicode_char = self._dots_to_unicode_char(part)
            result.append(unicode_char)
        
        return ''.join(result)
    
    def _dots_to_unicode_char(self, dots: str) -> str:
        """将点位字符串转换为Unicode盲文字符"""
        value = self._dots_to_value(dots)
        return chr(self.BRAILLE_UNICODE_BASE + value)
