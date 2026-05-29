from typing import Dict, List, Optional
from .rhyme import RhymeChecker
from .word_count import WordCounter
from .repetition import RepetitionDetector
from .polyphone import PolyphoneHandler
from .report import ReportGenerator
from .version import VersionManager

class LyricsChecker:
    def __init__(self, 
                 reports_dir: str = "./reports",
                 versions_dir: str = "./versions"):
        self.rhyme_checker = RhymeChecker()
        self.word_counter = WordCounter()
        self.repetition_detector = RepetitionDetector()
        self.polyphone_handler = PolyphoneHandler()
        self.report_generator = ReportGenerator(reports_dir)
        self.version_manager = VersionManager(versions_dir)
    
    def check(self, 
              lyrics_text: str,
              song_title: str = "未命名",
              author: str = "未知",
              rhyme_scheme: str = "aabb",
              forbidden_words: Optional[List[str]] = None,
              save_version: bool = True,
              save_report: bool = True,
              version_notes: str = "") -> Dict:
        lines = lyrics_text.split('\n')
        paragraphs = self._split_paragraphs(lines)
        
        basic_info = {
            'title': song_title,
            'author': author,
            'total_lines': len(lines),
            'total_paragraphs': len(paragraphs),
            'lyrics_text': lyrics_text,
        }
        
        rhyme_result = self._check_rhyme(lines, rhyme_scheme)
        word_count_result = self.word_counter.analyze_lines(lines)
        repetition_result = self.repetition_detector.generate_repetition_report(
            lyrics_text, forbidden_words
        )
        polyphone_result = self.polyphone_handler.analyze_all_scenarios(lyrics_text)
        
        all_issues = self._collect_issues(
            rhyme_result, word_count_result, repetition_result
        )
        
        suggestions = self.report_generator.get_suggestions({
            'rhyme': rhyme_result,
            'word_count': word_count_result,
            'repetition': repetition_result,
            'polyphone': polyphone_result,
        })
        
        result = {
            'basic_info': basic_info,
            'rhyme': rhyme_result,
            'word_count': word_count_result,
            'repetition': repetition_result,
            'polyphone': polyphone_result,
            'all_issues': all_issues,
            'suggestions': suggestions,
            'overall_score': self._calculate_score(all_issues, len(lines)),
        }
        
        if save_version:
            version_result = self.version_manager.save_version(
                lyrics_text=lyrics_text,
                song_title=song_title,
                author=author,
                check_result=result,
                notes=version_notes,
            )
            result['version_info'] = version_result
        
        if save_report:
            saved_files = self.report_generator.save_report(
                result, filename=song_title
            )
            result['report_files'] = saved_files
        
        return result
    
    def _check_rhyme(self, lines: List[str], rhyme_scheme: str) -> Dict:
        content_lines = [l for l in lines if l.strip() and not l.strip().startswith('[')]
        
        scheme_check = self.rhyme_checker.check_rhyme_scheme(
            content_lines, scheme_type=rhyme_scheme
        )
        
        rhyme_groups = self.rhyme_checker.find_rhyme_groups(content_lines)
        
        line_finals = []
        for i, line in enumerate(lines):
            if line.strip():
                final_info = self.rhyme_checker.get_line_final(line)
                final_info['line_index'] = i
                line_finals.append(final_info)
        
        return {
            'scheme_type': rhyme_scheme,
            'scheme_check': scheme_check,
            'rhyme_groups': rhyme_groups,
            'line_finals': line_finals,
        }
    
    def _split_paragraphs(self, lines: List[str]) -> List[List[str]]:
        paragraphs = []
        current_para = []
        
        for line in lines:
            if line.strip() == '':
                if current_para:
                    paragraphs.append(current_para)
                    current_para = []
            else:
                current_para.append(line)
        
        if current_para:
            paragraphs.append(current_para)
        
        return paragraphs
    
    def _collect_issues(self, 
                        rhyme_result: Dict,
                        word_count_result: Dict,
                        repetition_result: Dict) -> List[Dict]:
        all_issues = []
        
        if rhyme_result.get('scheme_check', {}).get('issues'):
            for issue in rhyme_result['scheme_check']['issues']:
                all_issues.append({
                    'type': issue['type'],
                    'severity': 'warning',
                    'category': 'rhyme',
                    'details': issue['details'],
                    'lines': issue.get('lines'),
                })
        
        if word_count_result.get('issues'):
            for issue in word_count_result['issues']:
                all_issues.append({
                    **issue,
                    'category': 'word_count',
                })
        
        if repetition_result.get('issues'):
            for issue in repetition_result['issues']:
                all_issues.append({
                    **issue,
                    'category': 'repetition',
                })
        
        return all_issues
    
    def _calculate_score(self, issues: List[Dict], total_lines: int) -> Dict:
        error_count = sum(1 for i in issues if i.get('severity') == 'error')
        warning_count = sum(1 for i in issues if i.get('severity') == 'warning')
        info_count = sum(1 for i in issues if i.get('severity') == 'info')
        
        base_score = 100
        base_score -= error_count * 10
        base_score -= warning_count * 5
        base_score -= info_count * 2
        base_score = max(0, min(100, base_score))
        
        if base_score >= 80:
            grade = 'A'
            comment = '优秀，可进入下一步'
        elif base_score >= 60:
            grade = 'B'
            comment = '良好，建议微调'
        elif base_score >= 40:
            grade = 'C'
            comment = '一般，需要修改'
        else:
            grade = 'D'
            comment = '较差，建议重写'
        
        return {
            'score': base_score,
            'grade': grade,
            'comment': comment,
            'breakdown': {
                'errors': error_count,
                'warnings': warning_count,
                'infos': info_count,
            },
            'reason': f"基于{error_count}个错误、{warning_count}个警告、{info_count}个提示项计算，评分为{base_score}分（{grade}级）",
        }
    
    def print_report(self, check_result: Dict):
        self.report_generator.print_console_report(check_result)
    
    def list_songs(self) -> List[Dict]:
        return self.version_manager.list_songs()
    
    def get_song_versions(self, song_title: str) -> List[Dict]:
        return self.version_manager.list_versions(song_title)
    
    def compare_versions(self, song_title: str, v1: str, v2: str) -> Dict:
        return self.version_manager.compare_versions(song_title, v1, v2)
