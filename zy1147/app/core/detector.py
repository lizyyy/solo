import re
import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from app.core.text_processor import TextProcessor
from app.core.semantic import SemanticMatcher, SemanticMatchResult


@dataclass
class DetectionHit:
    hit_word: str
    matched_word: str
    start_position: int
    end_position: int
    match_type: str
    category: str
    severity: str
    description: str
    suggestion: str
    context_before: str
    context_after: str
    confidence: float
    sensitive_word_id: Optional[int] = None


@dataclass
class DetectionResult:
    request_id: str
    original_text: str
    normalized_text: str
    segments: List[Dict[str, Any]]
    is_sensitive: bool
    highest_severity: str
    total_hits: int
    hits: List[DetectionHit]
    processing_time_ms: int
    lexicon_version: str


class ContentDetector:
    
    _severity_order = {
        'low': 0,
        'medium': 1,
        'high': 2,
        'critical': 3
    }
    
    def __init__(self, text_processor: TextProcessor = None, semantic_matcher: SemanticMatcher = None):
        self.text_processor = text_processor or TextProcessor()
        self.semantic_matcher = semantic_matcher or SemanticMatcher()
        
        self._sensitive_words_cache: Dict[str, Dict[str, Any]] = {}
        self._synonyms_cache: Dict[str, str] = {}
        self._whitelist_cache: set = set()
        self._context_rules_cache: List[Dict] = []
        self._lexicon_version = "1.0.0"
        
        self._category_descriptions = {
            'political': '政治敏感内容',
            'violent': '暴力恐怖内容',
            'pornographic': '色情低俗内容',
            'gambling': '赌博相关内容',
            'fraud': '诈骗欺诈内容',
            'abusive': '辱骂攻击内容',
            'discriminatory': '歧视性内容',
            'terrorist': '恐怖主义内容',
            'drug': '毒品相关内容',
            'other': '其他敏感内容'
        }
        
        self._severity_suggestions = {
            'low': '建议人工复核，可正常发布',
            'medium': '建议人工审核，可暂存待审',
            'high': '建议拦截，需要人工确认',
            'critical': '必须拦截，上报风控系统'
        }
    
    def load_lexicon(self, sensitive_words: List[Dict], synonyms: List[Dict], 
                      whitelist: List[Dict], context_rules: List[Dict], version: str = "1.0.0"):
        self._sensitive_words_cache.clear()
        for word in sensitive_words:
            normalized = word.get('normalized_word', word.get('word', ''))
            self._sensitive_words_cache[normalized] = {
                'id': word.get('id'),
                'word': word.get('word'),
                'normalized_word': normalized,
                'category': word.get('category', 'other'),
                'severity': word.get('severity', 'medium'),
                'description': word.get('description', ''),
                'suggestion': word.get('suggestion', ''),
                'pinyin': word.get('pinyin'),
                'is_regex': word.get('is_regex', False)
            }
        
        self._synonyms_cache.clear()
        for syn in synonyms:
            normalized = syn.get('normalized_synonym', syn.get('synonym', ''))
            self._synonyms_cache[normalized] = syn.get('sensitive_word_id')
        
        self._whitelist_cache.clear()
        for item in whitelist:
            normalized = item.get('normalized_term', item.get('term', ''))
            self._whitelist_cache.add(normalized)
        
        self._context_rules_cache = context_rules
        self._lexicon_version = version
    
    def detect(self, text: str) -> DetectionResult:
        start_time = time.time()
        request_id = str(uuid.uuid4())
        
        processed = self.text_processor.process_for_detection(text)
        normalized = processed['normalized']
        segments = processed['segments']
        
        all_hits: List[DetectionHit] = []
        
        exact_hits = self._detect_exact_match(text, normalized)
        all_hits.extend(exact_hits)
        
        synonym_hits = self._detect_synonyms(text, normalized)
        all_hits.extend(synonym_hits)
        
        variant_hits = self._detect_variants(text, normalized)
        all_hits.extend(variant_hits)
        
        semantic_hits = self._detect_semantic(text, segments)
        all_hits.extend(semantic_hits)
        
        all_hits = self._apply_whitelist(text, normalized, all_hits)
        
        all_hits = self._apply_context_rules(text, all_hits)
        
        all_hits = self._deduplicate_hits(all_hits)
        
        all_hits = self._sort_hits(all_hits)
        
        is_sensitive = len(all_hits) > 0
        highest_severity = self._get_highest_severity(all_hits)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return DetectionResult(
            request_id=request_id,
            original_text=text,
            normalized_text=normalized,
            segments=segments,
            is_sensitive=is_sensitive,
            highest_severity=highest_severity,
            total_hits=len(all_hits),
            hits=all_hits,
            processing_time_ms=processing_time,
            lexicon_version=self._lexicon_version
        )
    
    def detect_batch(self, texts: List[str]) -> List[DetectionResult]:
        results = []
        for text in texts:
            result = self.detect(text)
            results.append(result)
        return results
    
    def _detect_exact_match(self, original: str, normalized: str) -> List[DetectionHit]:
        hits = []
        
        for word, info in self._sensitive_words_cache.items():
            if not info.get('is_regex', False):
                if word in normalized:
                    positions = self._find_all_positions(normalized, word)
                    for start, end in positions:
                        context_before, context_after = self.text_processor.extract_context(
                            original, max(0, start - 5), min(len(original), end + 5)
                        )
                        
                        category_desc = self._category_descriptions.get(
                            info['category'], info['category']
                        )
                        suggestion = info.get('suggestion') or self._severity_suggestions.get(
                            info['severity'], '建议人工复核'
                        )
                        
                        hits.append(DetectionHit(
                            hit_word=original[start:end] if start < len(original) else word,
                            matched_word=info['word'],
                            start_position=start,
                            end_position=end,
                            match_type='exact',
                            category=info['category'],
                            severity=info['severity'],
                            description=f"精确匹配敏感词: {category_desc}",
                            suggestion=suggestion,
                            context_before=context_before,
                            context_after=context_after,
                            confidence=1.0,
                            sensitive_word_id=info.get('id')
                        ))
            else:
                try:
                    pattern = re.compile(word, re.IGNORECASE)
                    for match in pattern.finditer(normalized):
                        start, end = match.span()
                        context_before, context_after = self.text_processor.extract_context(
                            original, max(0, start - 5), min(len(original), end + 5)
                        )
                        
                        category_desc = self._category_descriptions.get(
                            info['category'], info['category']
                        )
                        suggestion = info.get('suggestion') or self._severity_suggestions.get(
                            info['severity'], '建议人工复核'
                        )
                        
                        hits.append(DetectionHit(
                            hit_word=original[start:end] if start < len(original) else match.group(),
                            matched_word=info['word'],
                            start_position=start,
                            end_position=end,
                            match_type='regex',
                            category=info['category'],
                            severity=info['severity'],
                            description=f"正则匹配敏感词: {category_desc}",
                            suggestion=suggestion,
                            context_before=context_before,
                            context_after=context_after,
                            confidence=0.95,
                            sensitive_word_id=info.get('id')
                        ))
                except re.error:
                    continue
        
        return hits
    
    def _detect_synonyms(self, original: str, normalized: str) -> List[DetectionHit]:
        hits = []
        
        for synonym, word_id in self._synonyms_cache.items():
            if synonym in normalized:
                word_info = None
                for info in self._sensitive_words_cache.values():
                    if info.get('id') == word_id:
                        word_info = info
                        break
                
                if word_info:
                    positions = self._find_all_positions(normalized, synonym)
                    for start, end in positions:
                        context_before, context_after = self.text_processor.extract_context(
                            original, max(0, start - 5), min(len(original), end + 5)
                        )
                        
                        category_desc = self._category_descriptions.get(
                            word_info['category'], word_info['category']
                        )
                        suggestion = word_info.get('suggestion') or self._severity_suggestions.get(
                            word_info['severity'], '建议人工复核'
                        )
                        
                        hits.append(DetectionHit(
                            hit_word=original[start:end] if start < len(original) else synonym,
                            matched_word=word_info['word'],
                            start_position=start,
                            end_position=end,
                            match_type='synonym',
                            category=word_info['category'],
                            severity=word_info['severity'],
                            description=f"同义词匹配: {category_desc} (原词: {word_info['word']})",
                            suggestion=suggestion,
                            context_before=context_before,
                            context_after=context_after,
                            confidence=0.85,
                            sensitive_word_id=word_info.get('id')
                        ))
        
        return hits
    
    def _detect_variants(self, original: str, normalized: str) -> List[DetectionHit]:
        hits = []
        
        pinyin = self.text_processor.to_pinyin(normalized)
        
        for word, info in self._sensitive_words_cache.items():
            word_pinyin = info.get('pinyin') or self.text_processor.to_pinyin(word)
            
            if word_pinyin and word_pinyin in pinyin:
                positions = self._find_all_positions(pinyin, word_pinyin)
                for start, end in positions:
                    char_start = len(pinyin[:start].replace(' ', '')) // 2
                    char_end = min(len(original), char_start + len(word))
                    
                    context_before, context_after = self.text_processor.extract_context(
                        original, max(0, char_start - 5), min(len(original), char_end + 5)
                    )
                    
                    category_desc = self._category_descriptions.get(
                        info['category'], info['category']
                    )
                    suggestion = info.get('suggestion') or self._severity_suggestions.get(
                        info['severity'], '建议人工复核'
                    )
                    
                    hits.append(DetectionHit(
                        hit_word=original[char_start:char_end],
                        matched_word=info['word'],
                        start_position=char_start,
                        end_position=char_end,
                        match_type='pinyin',
                        category=info['category'],
                        severity=info['severity'],
                        description=f"拼音匹配: {category_desc} (拼音: {word_pinyin})",
                        suggestion=suggestion,
                        context_before=context_before,
                        context_after=context_after,
                        confidence=0.7,
                        sensitive_word_id=info.get('id')
                    ))
        
        return hits
    
    def _detect_semantic(self, original: str, segments: List[Dict]) -> List[DetectionHit]:
        hits = []
        
        semantic_results = self.semantic_matcher.match_semantic(original, segments)
        
        for result in semantic_results:
            if result.matched:
                start = original.find(result.matched_phrase)
                if start == -1:
                    start = 0
                end = start + len(result.matched_phrase)
                
                context_before, context_after = self.text_processor.extract_context(
                    original, max(0, start - 5), min(len(original), end + 5)
                )
                
                category_info = next(
                    (p for p in self.semantic_matcher._semantic_patterns 
                     if any(t in result.trigger_words for t in p['trigger_words'])),
                    None
                )
                
                category = category_info['category'] if category_info else 'other'
                severity = category_info['severity'] if category_info else 'medium'
                
                category_desc = self._category_descriptions.get(category, category)
                suggestion = self._severity_suggestions.get(severity, '建议人工复核')
                
                hits.append(DetectionHit(
                    hit_word=result.matched_phrase,
                    matched_word=result.original_phrase,
                    start_position=start,
                    end_position=end,
                    match_type=result.match_type,
                    category=category,
                    severity=severity,
                    description=f"语义匹配: {category_desc} (触发词: {', '.join(result.trigger_words)})",
                    suggestion=suggestion,
                    context_before=context_before,
                    context_after=context_after,
                    confidence=result.confidence
                ))
        
        return hits
    
    def _apply_whitelist(self, original: str, normalized: str, hits: List[DetectionHit]) -> List[DetectionHit]:
        filtered_hits = []
        
        for hit in hits:
            is_whitelisted = False
            
            hit_normalized = self.text_processor.normalize(hit.hit_word)
            if hit_normalized in self._whitelist_cache:
                is_whitelisted = True
            
            for white_term in self._whitelist_cache:
                if white_term in normalized:
                    white_start = normalized.find(white_term)
                    white_end = white_start + len(white_term)
                    
                    if self._ranges_overlap(hit.start_position, hit.end_position, white_start, white_end):
                        is_whitelisted = True
                        break
            
            if not is_whitelisted:
                filtered_hits.append(hit)
        
        return filtered_hits
    
    def _apply_context_rules(self, text: str, hits: List[DetectionHit]) -> List[DetectionHit]:
        for hit in hits:
            context_result = self.semantic_matcher.check_context_enhancement(
                text, hit.matched_word, self._context_rules_cache
            )
            
            if context_result['should_exempt']:
                hits = [h for h in hits if h != hit]
            elif context_result['should_enhance']:
                severity_order = self._severity_order
                current_level = severity_order.get(hit.severity, 1)
                if current_level < 3:
                    new_severity = list(severity_order.keys())[list(severity_order.values()).index(current_level + 1)]
                    hit.severity = new_severity
                    hit.description += f" (增强规则: {context_result['reason']})"
        
        return hits
    
    def _deduplicate_hits(self, hits: List[DetectionHit]) -> List[DetectionHit]:
        if not hits:
            return hits
        
        sorted_hits = sorted(hits, key=lambda h: (h.start_position, -h.confidence, -self._severity_order.get(h.severity, 0)))
        
        unique_hits = []
        used_positions = set()
        
        for hit in sorted_hits:
            position_key = (hit.start_position, hit.end_position)
            
            if position_key not in used_positions:
                is_overlapping = False
                for used_start, used_end in used_positions:
                    if self._ranges_overlap(hit.start_position, hit.end_position, used_start, used_end):
                        is_overlapping = True
                        break
                
                if not is_overlapping:
                    unique_hits.append(hit)
                    used_positions.add(position_key)
        
        return unique_hits
    
    def _sort_hits(self, hits: List[DetectionHit]) -> List[DetectionHit]:
        return sorted(
            hits,
            key=lambda h: (
                -self._severity_order.get(h.severity, 0),
                -h.confidence,
                h.start_position
            )
        )
    
    def _find_all_positions(self, text: str, substring: str) -> List[Tuple[int, int]]:
        positions = []
        start = 0
        while True:
            idx = text.find(substring, start)
            if idx == -1:
                break
            positions.append((idx, idx + len(substring)))
            start = idx + 1
        return positions
    
    def _ranges_overlap(self, start1: int, end1: int, start2: int, end2: int) -> bool:
        return start1 < end2 and start2 < end1
    
    def _get_highest_severity(self, hits: List[DetectionHit]) -> str:
        if not hits:
            return 'low'
        
        max_level = -1
        max_severity = 'low'
        
        for hit in hits:
            level = self._severity_order.get(hit.severity, 0)
            if level > max_level:
                max_level = level
                max_severity = hit.severity
        
        return max_severity
    
    def get_lexicon_stats(self) -> Dict[str, int]:
        return {
            'sensitive_words': len(self._sensitive_words_cache),
            'synonyms': len(self._synonyms_cache),
            'whitelist': len(self._whitelist_cache),
            'context_rules': len(self._context_rules_cache),
            'version': self._lexicon_version
        }
