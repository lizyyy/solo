import json
import re
from typing import Dict, List
from collections import Counter

class SummaryService:
    def __init__(self):
        # 停用词列表（简化版）
        self.stop_words = set([
            '的', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
            '好', '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么',
            '怎么', '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗',
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
            'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
            'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
            'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
            'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
            'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
            'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
            'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
            'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this',
            'that', 'these', 'those', 'am'
        ])
    
    def generate_summary(self, content: str, content_type: str = 'json') -> Dict:
        """
        生成访谈摘要
        """
        if content_type == 'json':
            return self._generate_summary_from_json(content)
        else:
            return self._generate_summary_from_text(content)
    
    def _generate_summary_from_json(self, json_content: str) -> Dict:
        """
        从JSON格式生成摘要
        """
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError:
            return self._generate_summary_from_text(json_content)
        
        # 提取所有文本内容
        all_text = self._extract_text_from_json(data)
        
        # 生成摘要
        summary_parts = []
        
        # 1. 提取访谈基本信息
        if isinstance(data, dict):
            if 'interview_id' in data:
                summary_parts.append(f"访谈ID: {data['interview_id']}")
            if 'date' in data:
                summary_parts.append(f"访谈日期: {data['date']}")
            if 'researcher' in data:
                summary_parts.append(f"研究员: {data['researcher']}")
            if 'topic' in data:
                summary_parts.append(f"访谈主题: {data['topic']}")
        
        # 2. 提取对话摘要
        conversations = self._extract_conversations(data)
        if conversations:
            summary_parts.append(f"\n对话摘要:")
            # 取前5个对话片段作为摘要
            for i, conv in enumerate(conversations[:5]):
                summary_parts.append(f"  {i+1}. {conv[:200]}...")
        
        # 3. 提取关键词
        keywords = self._extract_keywords(all_text)
        
        # 4. 统计信息
        stats = {
            'total_words': len(all_text.split()),
            'total_segments': len(conversations) if conversations else 1,
            'keywords_count': len(keywords)
        }
        
        return {
            'summary_content': '\n'.join(summary_parts),
            'keywords': keywords,
            'statistics': stats
        }
    
    def _generate_summary_from_text(self, text: str) -> Dict:
        """
        从纯文本生成摘要
        """
        # 按段落分割
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        summary_parts = []
        
        # 1. 基本信息
        summary_parts.append(f"文本长度: {len(text)} 字符")
        summary_parts.append(f"段落数: {len(paragraphs)}")
        
        # 2. 内容摘要
        if paragraphs:
            summary_parts.append(f"\n内容摘要:")
            # 取前3个段落的开头部分
            for i, para in enumerate(paragraphs[:3]):
                summary_parts.append(f"  段落 {i+1}: {para[:300]}...")
        
        # 3. 关键词
        keywords = self._extract_keywords(text)
        
        # 4. 统计信息
        stats = {
            'total_words': len(text.split()),
            'total_paragraphs': len(paragraphs),
            'keywords_count': len(keywords)
        }
        
        return {
            'summary_content': '\n'.join(summary_parts),
            'keywords': keywords,
            'statistics': stats
        }
    
    def _extract_text_from_json(self, data) -> str:
        """
        从JSON数据中提取所有文本
        """
        texts = []
        
        def extract(value):
            if isinstance(value, str):
                texts.append(value)
            elif isinstance(value, dict):
                for v in value.values():
                    extract(v)
            elif isinstance(value, list):
                for item in value:
                    extract(item)
        
        extract(data)
        return ' '.join(texts)
    
    def _extract_conversations(self, data) -> List[str]:
        """
        从JSON中提取对话内容
        """
        conversations = []
        
        # 常见的对话字段名
        conversation_fields = ['conversations', 'dialogues', 'interviews', 'transcripts', 'segments']
        
        if isinstance(data, dict):
            # 查找对话字段
            for field in conversation_fields:
                if field in data and isinstance(data[field], list):
                    for item in data[field]:
                        if isinstance(item, dict):
                            # 尝试提取内容
                            for key in ['content', 'text', 'utterance', 'speech']:
                                if key in item and isinstance(item[key], str):
                                    conversations.append(item[key])
                                    break
                        elif isinstance(item, str):
                            conversations.append(item)
        
        return conversations
    
    def _extract_keywords(self, text: str, top_n: int = 20) -> List[str]:
        """
        提取关键词（简化版，基于词频）
        """
        # 清理文本
        text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z\s]', ' ', text)
        
        # 分词（简化版：按空格和汉字边界分割）
        # 注意：实际应用中应该使用专业的分词库如jieba
        words = []
        
        # 处理英文单词
        english_words = re.findall(r'[a-zA-Z]+', text)
        words.extend([w.lower() for w in english_words if len(w) > 2])
        
        # 处理中文（简化为2-4字的组合）
        # 实际应用中应该使用分词库
        chinese_chars = re.findall(r'[\u4e00-\u9fa5]+', text)
        for chars in chinese_chars:
            # 简单的n-gram提取
            n = 2
            for i in range(len(chars) - n + 1):
                word = chars[i:i+n]
                if word not in self.stop_words:
                    words.append(word)
        
        # 计算词频
        word_freq = Counter(words)
        
        # 过滤停用词并按频率排序
        filtered_keywords = [
            word for word, freq in word_freq.most_common(top_n * 2)
            if word not in self.stop_words and len(word) > 1
        ]
        
        return filtered_keywords[:top_n]
    
    def generate_searchable_summary(self, content: str) -> Dict:
        """
        生成可检索的摘要，包含更多元数据
        """
        basic_summary = self.generate_summary(content)
        
        # 添加更多检索相关的元数据
        searchable_data = {
            **basic_summary,
            'search_terms': self._generate_search_terms(basic_summary.get('keywords', [])),
            'content_hash': hash(content)  # 简单的内容哈希，用于去重
        }
        
        return searchable_data
    
    def _generate_search_terms(self, keywords: List[str]) -> List[str]:
        """
        生成搜索词列表
        """
        search_terms = []
        
        # 添加关键词的变体
        for keyword in keywords:
            search_terms.append(keyword)
            # 可以添加同义词、相关词等
        
        return list(set(search_terms))
