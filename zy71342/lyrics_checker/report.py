import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_text_report(self, check_result: Dict, title: str = "歌词检查报告") -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"  {title}")
        lines.append(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        
        if 'basic_info' in check_result:
            lines.append("【基本信息】")
            info = check_result['basic_info']
            lines.append(f"  标题: {info.get('title', '未命名')}")
            lines.append(f"  作者: {info.get('author', '未知')}")
            lines.append(f"  总行数: {info.get('total_lines', 0)}")
            lines.append(f"  总段落: {info.get('total_paragraphs', 0)}")
            lines.append("")
        
        if 'rhyme' in check_result:
            lines.append("【韵脚检查】")
            rhyme = check_result['rhyme']
            
            if 'scheme_check' in rhyme:
                sc = rhyme['scheme_check']
                summary = sc.get('summary', {})
                lines.append(f"  押韵方案: {sc.get('scheme_type', 'aabb').upper()}")
                lines.append(f"  押韵对: {summary.get('rhyming_pairs', 0)}/{summary.get('total_pairs', 0)}")
                lines.append(f"  问题数: {summary.get('issues_count', 0)}")
                
                if sc.get('issues'):
                    lines.append("  押韵问题:")
                    for issue in sc['issues'][:5]:
                        line_nums = [str(n + 1) for n in issue['lines']]
                        lines.append(f"    - 第{'/'.join(line_nums)}行: {issue['details']}")
                    if len(sc['issues']) > 5:
                        lines.append(f"    ... 还有{len(sc['issues']) - 5}处问题")
            lines.append("")
            
            if 'rhyme_groups' in rhyme:
                rg = rhyme['rhyme_groups']
                lines.append(f"  韵脚分布: 共{rg.get('total_unique_finals', 0)}种韵脚")
                if rg.get('most_common'):
                    mc = rg['most_common']
                    lines.append(f"  最常用韵脚「{mc['final']}」: {len(mc['lines'])}行")
            lines.append("")
        
        if 'word_count' in check_result:
            lines.append("【字数统计】")
            wc = check_result['word_count']
            summary = wc.get('summary', {})
            lines.append(f"  汉字总数: {summary.get('total_chinese_chars', 0)}")
            lines.append(f"  英文词数: {summary.get('total_english_words', 0)}")
            lines.append(f"  平均每行: {summary.get('avg_chinese_per_line', 0)}字")
            lines.append(f"  字数范围: {summary.get('min_chars_per_line', 0)}-{summary.get('max_chars_per_line', 0)}字")
            
            if wc.get('issues'):
                lines.append("  字数问题:")
                for issue in wc['issues']:
                    lines.append(f"    - {issue['details']}")
            lines.append("")
        
        if 'repetition' in check_result:
            lines.append("【重复检测】")
            rep = check_result['repetition']
            summary = rep.get('summary', {})
            lines.append(f"  重复词: {summary.get('repeated_words_count', 0)}个")
            lines.append(f"  重复短语: {summary.get('repeated_phrases_count', 0)}个")
            lines.append(f"  重复行组: {summary.get('repeated_line_groups', 0)}组")
            
            if rep.get('word_repetition', {}).get('repeated_words'):
                words = rep['word_repetition']['repeated_words'][:5]
                lines.append("  高频重复词:")
                for w in words:
                    lines.append(f"    - 「{w['word']}」 x{w['count']} {w['reason']}")
            
            if rep.get('line_repetition', {}).get('chorus_candidates'):
                lines.append(f"  疑似副歌: {len(rep['line_repetition']['chorus_candidates'])}组")
            
            if rep.get('issues'):
                lines.append("  重复问题:")
                for issue in rep['issues']:
                    lines.append(f"    - [{issue['severity']}] {issue['details']}")
            lines.append("")
        
        if 'polyphone' in check_result:
            lines.append("【多音字与混合语言】")
            poly = check_result['polyphone']
            rr = poly.get('review_report', {})
            lines.append(f"  待复核场景: {rr.get('unresolved_count', 0)}个")
            
            if poly.get('polyphones', {}).get('polyphones'):
                polys = poly['polyphones']['polyphones'][:5]
                lines.append("  多音字位置:")
                for p in polys:
                    lines.append(f"    - 第{p['line_index']+1}行「{p['char']}」: {p['reason']}")
            
            if poly.get('mixed_language', {}).get('mixed_lines'):
                mixed = poly['mixed_language']
                lines.append(f"  中英文混合: {mixed['total_mixed_lines']}行")
                for m in mixed['mixed_lines'][:3]:
                    lines.append(f"    - 第{m['line_index']+1}行: {m['reason']}")
            lines.append("")
        
        if 'all_issues' in check_result:
            lines.append("【问题汇总】")
            all_issues = check_result['all_issues']
            severity_order = {'error': 0, 'warning': 1, 'info': 2}
            sorted_issues = sorted(all_issues, key=lambda x: severity_order.get(x.get('severity', 'info'), 3))
            
            for issue in sorted_issues:
                severity = issue.get('severity', 'info').upper()
                lines.append(f"  [{severity}] {issue.get('details', '')}")
                if 'suggestion' in issue:
                    lines.append(f"       建议: {issue['suggestion']}")
            lines.append("")
        
        lines.append("=" * 60)
        lines.append("  报告结束")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def generate_json_report(self, check_result: Dict, indent: int = 2) -> str:
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0",
            **check_result
        }
        return json.dumps(report_data, ensure_ascii=False, indent=indent)
    
    def save_report(self, check_result: Dict, 
                    filename: str,
                    formats: List[str] = ['txt', 'json']) -> Dict[str, str]:
        saved_files = {}
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        for fmt in formats:
            full_filename = f"{filename}_{timestamp}.{fmt}"
            file_path = self.output_dir / full_filename
            
            if fmt == 'txt':
                content = self.generate_text_report(check_result)
            elif fmt == 'json':
                content = self.generate_json_report(check_result)
            else:
                continue
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            saved_files[fmt] = str(file_path)
        
        return saved_files
    
    def get_suggestions(self, check_result: Dict) -> List[Dict]:
        suggestions = []
        
        if 'rhyme' in check_result:
            rhyme = check_result['rhyme']
            if rhyme.get('scheme_check', {}).get('issues'):
                suggestions.append({
                    'category': 'rhyme',
                    'priority': 'high',
                    'title': '调整押韵',
                    'details': '存在不押韵的句子对，建议调整句尾字',
                    'action_items': ['检查标注的不押韵行', '考虑替换句尾字或调整句式'],
                })
        
        if 'word_count' in check_result:
            wc = check_result['word_count']
            for issue in wc.get('issues', []):
                if issue.get('type') == 'line_length_inconsistent':
                    suggestions.append({
                        'category': 'word_count',
                        'priority': 'medium',
                        'title': '统一每行字数',
                        'details': issue['details'],
                        'action_items': ['保持每行字数在±2字范围内', '可适当添加或删减修饰词'],
                    })
        
        if 'repetition' in check_result:
            rep = check_result['repetition']
            for issue in rep.get('issues', []):
                if issue.get('type') == 'word_repetition':
                    suggestions.append({
                        'category': 'repetition',
                        'priority': 'low',
                        'title': '丰富词汇',
                        'details': issue['details'],
                        'action_items': [issue.get('suggestion', '替换部分重复词')],
                    })
        
        if 'polyphone' in check_result:
            poly = check_result['polyphone']
            review = poly.get('review_report', {})
            if review.get('unresolved_count', 0) > 0:
                suggestions.append({
                    'category': 'polyphone',
                    'priority': 'medium',
                    'title': '复核多音字',
                    'details': f"有{review['unresolved_count']}个场景需要确认",
                    'action_items': ['逐一确认多音字的实际演唱读音', '确认中英文混合的处理方式'],
                })
        
        return suggestions
    
    def print_console_report(self, check_result: Dict):
        text_report = self.generate_text_report(check_result)
        print(text_report)
