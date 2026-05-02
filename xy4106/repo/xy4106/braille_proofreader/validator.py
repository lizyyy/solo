from typing import Dict, List, Any, Optional, Tuple
import re


class Validator:
    """盲文教材校验器
    
    检测以下问题：
    1. 未注音词
    2. 超行（超出行宽）
    3. 图文引用断链
    4. 页码跳号
    5. 同音词歧义
    """
    
    def __init__(self):
        self.common_punctuation = set('，。、；：？！“”‘’（）【】《》—…·')
        self.chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
    
    def check_unmarked_words(self, 
                             lesson: Dict[str, Any],
                             pinyin_data_list: List[Dict[str, Any]],
                             figure_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """检查未注音词
        
        Args:
            lesson: 课文数据
            pinyin_data_list: 注音数据列表
            figure_data_list: 图说明数据列表
            
        Returns:
            问题列表
        """
        issues = []
        
        all_marked_words = set()
        for pinyin_data in pinyin_data_list:
            for item in pinyin_data.get('条目', []):
                word = item.get('词语', '').strip()
                if word:
                    all_marked_words.add(word)
        
        all_figure_ids = set()
        for figure_data in figure_data_list:
            for fig in figure_data.get('图片', []):
                fig_id = fig.get('编号', '').strip()
                if fig_id:
                    all_figure_ids.add(fig_id)
        
        paragraphs = lesson.get('段落', [])
        lesson_title = lesson.get('标题', '未知课文')
        
        title = lesson.get('标题', '')
        title_words = self._extract_words(title)
        for word in title_words:
            if len(word) >= 2 and word not in all_marked_words:
                if not self._is_punctuation_or_number(word):
                    issues.append({
                        '严重程度': '警告',
                        '问题类型': '未注音词',
                        '位置': f'{lesson_title} - 标题',
                        '词语': word,
                        '描述': f'标题中的词语"{word}"未找到对应注音',
                        '建议': f'在注音表中添加"{word}"的拼音注音'
                    })
        
        for para in paragraphs:
            para_index = para.get('序号', 0)
            content = para.get('内容', '')
            
            words = self._extract_words(content)
            for word in words:
                if len(word) >= 2 and word not in all_marked_words:
                    if not self._is_punctuation_or_number(word):
                        issues.append({
                            '严重程度': '警告',
                            '问题类型': '未注音词',
                            '位置': f'{lesson_title} - 段落{para_index + 1}',
                            '词语': word,
                            '上下文': self._get_context(content, word),
                            '描述': f'段落中的词语"{word}"未找到对应注音',
                            '建议': f'在注音表中添加"{word}"的拼音注音，或确认是否为生僻词'
                        })
            
            figure_refs = para.get('图片引用', [])
            for ref in figure_refs:
                ref_clean = ref.strip()
                if ref_clean and ref_clean not in all_figure_ids:
                    issues.append({
                        '严重程度': '错误',
                        '问题类型': '图文引用断链',
                        '位置': f'{lesson_title} - 段落{para_index + 1}',
                        '引用': ref,
                        '描述': f'引用的图片"{ref}"在图说明文件中未找到',
                        '建议': f'检查图说明文件是否包含编号为"{ref}"的图片，或修正课文中的引用'
                    })
        
        return issues
    
    def check_line_overflow(self, draft_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查超行问题
        
        Args:
            draft_data: 分页草稿数据
            
        Returns:
            问题列表
        """
        issues = []
        
        pages = draft_data.get('页面', [])
        line_width = draft_data.get('配置', {}).get('行宽', 32)
        
        for page in pages:
            page_num = page.get('页码', 0)
            lines = page.get('行', [])
            lesson_title = page.get('课文标题', '未知课文')
            
            for line_index, line in enumerate(lines):
                braille_length = line.get('盲文长度', 0)
                left_indent = line.get('左缩进', 0)
                left_padding = line.get('左填充', 0)
                effective_width = line.get('行宽', line_width)
                
                total_used = left_indent + left_padding + braille_length
                
                if total_used > effective_width:
                    line_type = line.get('类型', '未知')
                    original = line.get('原文', '')[:20] + '...' if len(line.get('原文', '')) > 20 else line.get('原文', '')
                    
                    issues.append({
                        '严重程度': '错误',
                        '问题类型': '超行',
                        '位置': f'{lesson_title} - 第{page_num}页 第{line_index + 1}行',
                        '行类型': line_type,
                        '原文': original,
                        '盲文长度': braille_length,
                        '实际宽度': total_used,
                        '限制宽度': effective_width,
                        '超出数量': total_used - effective_width,
                        '描述': f'该行盲文超出限制宽度{total_used - effective_width}方',
                        '建议': '建议调整断句位置或简化表达方式'
                    })
        
        return issues
    
    def check_figure_references(self,
                                lessons: List[Dict[str, Any]],
                                figure_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """检查图文引用断链
        
        Args:
            lessons: 课文列表
            figure_data_list: 图说明数据列表
            
        Returns:
            问题列表
        """
        issues = []
        
        all_figure_ids = set()
        figure_map = {}
        for figure_data in figure_data_list:
            for fig in figure_data.get('图片', []):
                fig_id = fig.get('编号', '').strip()
                if fig_id:
                    all_figure_ids.add(fig_id)
                    figure_map[fig_id] = fig
        
        referenced_ids = set()
        
        for lesson in lessons:
            lesson_title = lesson.get('标题', '未知课文')
            paragraphs = lesson.get('段落', [])
            
            for para in paragraphs:
                para_index = para.get('序号', 0)
                figure_refs = para.get('图片引用', [])
                
                for ref in figure_refs:
                    ref_clean = ref.strip()
                    referenced_ids.add(ref_clean)
                    
                    if ref_clean and ref_clean not in all_figure_ids:
                        issues.append({
                            '严重程度': '错误',
                            '问题类型': '图文引用断链',
                            '位置': f'{lesson_title} - 段落{para_index + 1}',
                            '引用编号': ref_clean,
                            '描述': f'课文中引用的图片"{ref_clean}"在图说明中未找到定义',
                            '建议': f'检查图说明JSON文件，添加编号为"{ref_clean}"的图片说明'
                        })
        
        for fig_id in all_figure_ids:
            if fig_id not in referenced_ids:
                fig = figure_map.get(fig_id, {})
                issues.append({
                    '严重程度': '提示',
                    '问题类型': '未引用图片',
                    '位置': f'图说明 - 编号{fig_id}',
                    '图片说明': fig.get('说明', '')[:30] + '...' if len(fig.get('说明', '')) > 30 else fig.get('说明', ''),
                    '描述': f'图说明中的图片"{fig_id}"未被课文引用',
                    '建议': '确认该图片是否需要，或在课文中添加引用'
                })
        
        return issues
    
    def check_page_numbering(self, draft_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查页码跳号或重复
        
        Args:
            draft_data: 分页草稿数据
            
        Returns:
            问题列表
        """
        issues = []
        
        pages = draft_data.get('页面', [])
        if not pages:
            return issues
        
        page_numbers = []
        for page in pages:
            page_num = page.get('页码', 0)
            page_numbers.append(page_num)
        
        expected = 1
        seen = set()
        
        for i, actual in enumerate(page_numbers):
            lesson_title = pages[i].get('课文标题', '未知课文')
            
            if actual in seen:
                issues.append({
                    '严重程度': '错误',
                    '问题类型': '页码重复',
                    '位置': f'{lesson_title} - 第{actual}页',
                    '页码': actual,
                    '描述': f'页码{actual}出现重复',
                    '建议': '检查分页逻辑或手动调整页码'
                })
            seen.add(actual)
            
            if actual > expected:
                issues.append({
                    '严重程度': '错误',
                    '问题类型': '页码跳号',
                    '位置': f'{lesson_title} - 第{actual}页',
                    '期望页码': expected,
                    '实际页码': actual,
                    '跳过页码': list(range(expected, actual)),
                    '描述': f'页码从{expected}跳转到{actual}，缺少{actual - expected}个页码',
                    '建议': '检查是否有内容被意外跳过'
                })
            
            expected = actual + 1
        
        total_pages = draft_data.get('总页数', 0)
        max_page = max(page_numbers) if page_numbers else 0
        
        if total_pages != max_page:
            issues.append({
                '严重程度': '警告',
                '问题类型': '页数不一致',
                '配置总页数': total_pages,
                '实际最大页码': max_page,
                '描述': f'配置的总页数{total_pages}与实际最大页码{max_page}不一致',
                '建议': '重新生成分页草稿'
            })
        
        return issues
    
    def check_homonym_ambiguity(self, pinyin_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """检查同音词歧义
        
        Args:
            pinyin_data_list: 注音数据列表
            
        Returns:
            问题列表
        """
        issues = []
        
        pinyin_to_words: Dict[str, List[Dict[str, Any]]] = {}
        
        for pinyin_data in pinyin_data_list:
            filename = pinyin_data.get('文件名', '未知文件')
            for item in pinyin_data.get('条目', []):
                word = item.get('词语', '').strip()
                pinyin = item.get('拼音', '').strip()
                braille = item.get('盲文点位', '').strip()
                note = item.get('备注', '').strip()
                
                if pinyin:
                    if pinyin not in pinyin_to_words:
                        pinyin_to_words[pinyin] = []
                    pinyin_to_words[pinyin].append({
                        '词语': word,
                        '拼音': pinyin,
                        '盲文点位': braille,
                        '备注': note,
                        '来源文件': filename
                    })
        
        for pinyin, words in pinyin_to_words.items():
            if len(words) > 1:
                unique_words = [w['词语'] for w in words if w['词语']]
                
                if len(set(unique_words)) > 1:
                    word_list = ', '.join(f'"{w}"' for w in unique_words)
                    
                    has_same_braille = False
                    brailles = [w['盲文点位'] for w in words if w['盲文点位']]
                    if len(set(brailles)) < len(brailles):
                        has_same_braille = True
                    
                    has_note = all(w['备注'] for w in words)
                    
                    severity = '警告' if has_same_braille else '提示'
                    if has_same_braille and not has_note:
                        severity = '错误'
                    
                    issues.append({
                        '严重程度': severity,
                        '问题类型': '同音词歧义',
                        '拼音': pinyin,
                        '同音词': unique_words,
                        '盲文点位': brailles,
                        '是否有相同盲文': has_same_braille,
                        '是否有备注区分': has_note,
                        '描述': f'拼音"{pinyin}"对应多个词语: {word_list}',
                        '建议': '建议在盲文点位中添加声调符号或在备注中明确区分不同词语'
                    })
        
        return issues
    
    def _extract_words(self, text: str) -> List[str]:
        """从文本中提取可能的词语"""
        if not text:
            return []
        
        text_no_markdown = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', text)
        
        chinese_only = ''.join(self.chinese_pattern.findall(text_no_markdown))
        
        words = []
        for i in range(len(chinese_only) - 1):
            for j in range(i + 2, min(i + 5, len(chinese_only) + 1)):
                words.append(chinese_only[i:j])
        
        return words
    
    def _is_punctuation_or_number(self, text: str) -> bool:
        """判断是否是标点或数字"""
        if not text:
            return True
        
        for char in text:
            if char not in self.common_punctuation and not char.isdigit():
                return False
        return True
    
    def _get_context(self, text: str, word: str, context_length: int = 10) -> str:
        """获取词语的上下文"""
        try:
            index = text.find(word)
            if index == -1:
                return ''
            
            start = max(0, index - context_length)
            end = min(len(text), index + len(word) + context_length)
            
            context = text[start:end]
            if start > 0:
                context = '...' + context
            if end < len(text):
                context = context + '...'
            
            return context
        except:
            return ''
