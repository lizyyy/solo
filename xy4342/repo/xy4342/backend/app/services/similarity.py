from typing import List, Dict, Tuple, Optional
import re
import math
from collections import Counter


class SimpleTextSimilarity:
    def __init__(self, threshold: float = 0.7):
        self.threshold = threshold
    
    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        tokens = []
        i = 0
        while i < len(text):
            if '\u4e00' <= text[i] <= '\u9fff':
                if i + 1 < len(text) and '\u4e00' <= text[i+1] <= '\u9fff':
                    tokens.append(text[i:i+2])
                    i += 1
                else:
                    tokens.append(text[i])
                i += 1
            elif text[i].isalnum():
                j = i
                while j < len(text) and text[j].isalnum():
                    j += 1
                tokens.append(text[i:j])
                i = j
            else:
                i += 1
        
        return tokens
    
    def _cosine_similarity(self, vec1: Counter, vec2: Counter) -> float:
        intersection = set(vec1.keys()) & set(vec2.keys())
        numerator = sum([vec1[x] * vec2[x] for x in intersection])
        
        sum1 = sum([vec1[x] ** 2 for x in list(vec1.keys())])
        sum2 = sum([vec2[x] ** 2 for x in list(vec2.keys())])
        denominator = math.sqrt(sum1) * math.sqrt(sum2)
        
        if not denominator:
            return 0.0
        else:
            return float(numerator) / denominator
    
    def _jaccard_similarity(self, tokens1: List[str], tokens2: List[str]) -> float:
        set1 = set(tokens1)
        set2 = set(tokens2)
        
        if not set1 and not set2:
            return 1.0
        
        intersection = set1 & set2
        union = set1 | set2
        
        return len(intersection) / len(union) if union else 0.0
    
    def compare(self, text1: str, text2: str) -> Dict[str, float]:
        tokens1 = self._tokenize(text1)
        tokens2 = self._tokenize(text2)
        
        vec1 = Counter(tokens1)
        vec2 = Counter(tokens2)
        
        cosine = self._cosine_similarity(vec1, vec2)
        jaccard = self._jaccard_similarity(tokens1, tokens2)
        
        return {
            "cosine": cosine,
            "jaccard": jaccard,
            "average": (cosine + jaccard) / 2
        }
    
    def is_similar(self, text1: str, text2: str) -> Tuple[bool, float]:
        scores = self.compare(text1, text2)
        avg_score = scores["average"]
        return avg_score >= self.threshold, avg_score
    
    def find_duplicates(
        self, 
        texts: List[Dict], 
        key_field: str = "content"
    ) -> List[Dict]:
        duplicates = []
        
        for i in range(len(texts)):
            for j in range(i + 1, len(texts)):
                text1 = texts[i].get(key_field, "")
                text2 = texts[j].get(key_field, "")
                
                is_sim, score = self.is_similar(text1, text2)
                
                if is_sim:
                    duplicates.append({
                        "index1": i,
                        "index2": j,
                        "text1_info": {k: v for k, v in texts[i].items() if k != key_field},
                        "text2_info": {k: v for k, v in texts[j].items() if k != key_field},
                        "similarity_score": score,
                        "text1_preview": text1[:100] if len(text1) > 100 else text1,
                        "text2_preview": text2[:100] if len(text2) > 100 else text2
                    })
        
        duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)
        return duplicates


class DialogueSimilarityChecker:
    def __init__(self, similarity_threshold: float = 0.85):
        self.similarity = SimpleTextSimilarity(threshold=similarity_threshold)
    
    def check_dialogue_duplicates(
        self, 
        dialogues: List[Dict]
    ) -> List[Dict]:
        return self.similarity.find_duplicates(dialogues, key_field="content")
    
    def check_action_duplicates(
        self,
        panels: List[Dict]
    ) -> List[Dict]:
        return self.similarity.find_duplicates(panels, key_field="action")
    
    def find_similar_panels(
        self,
        panels: List[Dict],
        fields: List[str] = ["action", "location", "characters_present"]
    ) -> List[Dict]:
        similar_groups = []
        
        for i in range(len(panels)):
            for j in range(i + 1, len(panels)):
                total_score = 0.0
                matched_fields = []
                
                for field in fields:
                    text1 = str(panels[i].get(field, ""))
                    text2 = str(panels[j].get(field, ""))
                    
                    if text1 and text2:
                        scores = self.similarity.compare(text1, text2)
                        if scores["average"] >= 0.7:
                            total_score += scores["average"]
                            matched_fields.append(field)
                
                if matched_fields and total_score / len(matched_fields) >= 0.75:
                    similar_groups.append({
                        "panel1_info": {
                            "chapter": panels[i].get("chapter"),
                            "panel_number": panels[i].get("panel_number"),
                            "page_number": panels[i].get("page_number")
                        },
                        "panel2_info": {
                            "chapter": panels[j].get("chapter"),
                            "panel_number": panels[j].get("panel_number"),
                            "page_number": panels[j].get("page_number")
                        },
                        "matched_fields": matched_fields,
                        "average_similarity": total_score / len(matched_fields)
                    })
        
        similar_groups.sort(key=lambda x: x["average_similarity"], reverse=True)
        return similar_groups
