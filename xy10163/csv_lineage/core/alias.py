from typing import Dict, List, Optional, Set, Tuple
from difflib import SequenceMatcher
import re

class AliasManager:
    def __init__(self, storage):
        self.storage = storage

    def add_alias(self, table_name: str, canonical_name: str, alias: str) -> bool:
        aliases = self.storage.get_aliases(table_name)
        
        for canonical, alias_list in aliases.items():
            if alias in alias_list and canonical != canonical_name:
                return False
        
        if canonical_name not in aliases:
            aliases[canonical_name] = []
        
        if alias not in aliases[canonical_name]:
            aliases[canonical_name].append(alias)
        
        self.storage.save_aliases(table_name, aliases)
        return True

    def get_canonical_name(self, table_name: str, field_name: str) -> Optional[str]:
        aliases = self.storage.get_aliases(table_name)
        
        if field_name in aliases:
            return field_name
        
        for canonical, alias_list in aliases.items():
            if field_name in alias_list:
                return canonical
        
        return None

    def get_all_aliases(self, table_name: str, field_name: str) -> List[str]:
        aliases = self.storage.get_aliases(table_name)
        canonical = self.get_canonical_name(table_name, field_name)
        
        if canonical is None:
            return [field_name]
        
        result = [canonical]
        if canonical in aliases:
            result.extend(aliases[canonical])
        return result

    def suggest_aliases(self, old_fields: List[str], new_fields: List[str], 
                       threshold: float = 0.8) -> List[Tuple[str, str, float]]:
        suggestions = []
        
        for old_field in old_fields:
            for new_field in new_fields:
                if old_field == new_field:
                    continue
                
                similarity = self._calculate_similarity(old_field, new_field)
                
                if similarity >= threshold:
                    suggestions.append((old_field, new_field, similarity))
        
        return sorted(suggestions, key=lambda x: x[2], reverse=True)

    def _calculate_similarity(self, s1: str, s2: str) -> float:
        s1_clean = self._normalize(s1)
        s2_clean = self._normalize(s2)
        
        seq_score = SequenceMatcher(None, s1_clean, s2_clean).ratio()
        
        words1 = set(re.split(r'[_ \-]+', s1_clean))
        words2 = set(re.split(r'[_ \-]+', s2_clean))
        
        if words1 and words2:
            jaccard = len(words1 & words2) / len(words1 | words2)
        else:
            jaccard = 0
        
        return max(seq_score, jaccard)

    def _normalize(self, s: str) -> str:
        return re.sub(r'[^a-zA-Z0-9_ \-]', '', s.lower())

    SEMANTIC_KEYWORDS = {
        'date': ['date', 'time', 'day', 'period', 'transaction_date', 'order_date', 'sale_date'],
        'user': ['user', 'customer', 'buyer', 'client', 'member', 'account'],
        'order': ['order', 'transaction', 'sale', 'purchase', 'invoice'],
        'amount': ['amount', 'price', 'cost', 'value', 'total', 'payment', 'revenue'],
        'product': ['product', 'item', 'goods', 'sku'],
        'quantity': ['quantity', 'qty', 'count', 'number', 'units'],
        'channel': ['channel', 'source', 'medium', 'platform', 'device'],
        'id': ['id', 'no', 'number', 'code', 'key'],
        'name': ['name', 'title', 'label', 'description']
    }

    def detect_renames(self, old_schema: Dict, new_schema: Dict, 
                       table_name: str) -> Dict[str, str]:
        old_fields_list = old_schema.get("fields", [])
        new_fields_list = new_schema.get("fields", [])
        old_fields = [f["name"] for f in old_fields_list]
        new_fields = [f["name"] for f in new_fields_list]
        
        removed_fields = set(old_fields) - set(new_fields)
        added_fields = set(new_fields) - set(old_fields)
        
        if not removed_fields or not added_fields:
            return {}
        
        renames = {}
        matched_old = set()
        matched_new = set()
        
        old_field_map = {f["name"]: f for f in old_fields_list}
        new_field_map = {f["name"]: f for f in new_fields_list}
        
        if len(old_fields_list) == len(new_fields_list):
            for idx, (old_name, new_name) in enumerate(zip(old_fields, new_fields)):
                if old_name in removed_fields and new_name in added_fields:
                    score = self._calculate_field_match_score(
                        old_field_map[old_name], 
                        new_field_map[new_name],
                        old_name, new_name, idx
                    )
                    if score >= 0.6:
                        renames[old_name] = new_name
                        matched_old.add(old_name)
                        matched_new.add(new_name)
        
        remaining_removed = list(removed_fields - matched_old)
        remaining_added = list(added_fields - matched_new)
        
        if remaining_removed and remaining_added:
            suggestions = []
            for old_name in remaining_removed:
                for new_name in remaining_added:
                    if old_name in matched_old or new_name in matched_new:
                        continue
                    score = self._calculate_field_match_score(
                        old_field_map[old_name],
                        new_field_map[new_name],
                        old_name, new_name, -1
                    )
                    if score >= 0.5:
                        suggestions.append((old_name, new_name, score))
            
            suggestions.sort(key=lambda x: x[2], reverse=True)
            
            for old_name, new_name, score in suggestions:
                if old_name in matched_old or new_name in matched_new:
                    continue
                renames[old_name] = new_name
                matched_old.add(old_name)
                matched_new.add(new_name)
        
        return renames

    def _calculate_field_match_score(self, old_field: Dict, new_field: Dict,
                                    old_name: str, new_name: str, 
                                    position: int) -> float:
        scores = []
        weights = []
        
        name_similarity = self._calculate_similarity(old_name, new_name)
        scores.append(name_similarity)
        weights.append(0.3)
        
        if old_field.get("dtype") == new_field.get("dtype"):
            scores.append(1.0)
        else:
            scores.append(0.0)
        weights.append(0.2)
        
        old_unique_ratio = old_field.get("unique_count", 0) / max(old_field.get("non_null_count", 1), 1)
        new_unique_ratio = new_field.get("unique_count", 0) / max(new_field.get("non_null_count", 1), 1)
        unique_similarity = 1 - abs(old_unique_ratio - new_unique_ratio)
        scores.append(unique_similarity)
        weights.append(0.15)
        
        old_null_ratio = old_field.get("null_count", 0) / (old_field.get("non_null_count", 0) + old_field.get("null_count", 1))
        new_null_ratio = new_field.get("null_count", 0) / (new_field.get("non_null_count", 0) + new_field.get("null_count", 1))
        null_similarity = 1 - abs(old_null_ratio - new_null_ratio)
        scores.append(null_similarity)
        weights.append(0.1)
        
        semantic_match = self._get_semantic_match_score(old_name, new_name)
        scores.append(semantic_match)
        weights.append(0.2)
        
        if position >= 0:
            scores.append(1.0)
            weights.append(0.05)
        else:
            scores.append(0.5)
            weights.append(0.05)
        
        total_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        return total_score

    def _get_semantic_match_score(self, name1: str, name2: str) -> float:
        name1_norm = self._normalize(name1)
        name2_norm = self._normalize(name2)
        
        words1 = set(re.split(r'[_ \-]+', name1_norm))
        words2 = set(re.split(r'[_ \-]+', name2_norm))
        
        categories1 = set()
        categories2 = set()
        
        for category, keywords in self.SEMANTIC_KEYWORDS.items():
            if any(kw in name1_norm for kw in keywords):
                categories1.add(category)
            if any(kw in name2_norm for kw in keywords):
                categories2.add(category)
        
        if categories1 and categories2:
            intersection = categories1 & categories2
            union = categories1 | categories2
            if intersection:
                return 0.7 + 0.3 * (len(intersection) / len(union))
        
        common_words = words1 & words2
        if common_words and len(common_words) >= 1:
            return 0.6
        
        return 0.0

    def apply_renames_to_aliases(self, table_name: str, renames: Dict[str, str]):
        for old_name, new_name in renames.items():
            canonical = self.get_canonical_name(table_name, old_name)
            if canonical is None:
                canonical = old_name
                self.add_alias(table_name, canonical, old_name)
            self.add_alias(table_name, canonical, new_name)
