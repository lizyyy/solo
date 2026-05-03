import re
import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict
from .models import LabeledItem, Cluster
from config.loader import RulesConfig, DictionaryConfig


@dataclass
class SimilarityResult:
    item1_id: str
    item2_id: str
    similarity: float
    method: str
    common_terms: List[str]


class SimilarityEngine:
    def __init__(
        self,
        rules_config: RulesConfig,
        dict_config: Optional[DictionaryConfig] = None
    ):
        self.rules = rules_config
        self.dict_config = dict_config or DictionaryConfig()
        self._stopwords = set(self.dict_config.stopwords)
        self._idf_cache: Dict[str, float] = {}

    def calculate_similarity(
        self,
        item1: LabeledItem,
        item2: LabeledItem,
        method: str = 'hybrid'
    ) -> SimilarityResult:
        if method == 'jaccard':
            sim, common = self._jaccard_similarity(item1.text, item2.text)
        elif method == 'cosine':
            sim, common = self._cosine_similarity(item1.text, item2.text)
        elif method == 'levenshtein':
            sim = self._levenshtein_similarity(item1.text, item2.text)
            common = []
        else:
            sim, common = self._hybrid_similarity(item1, item2)

        return SimilarityResult(
            item1_id=item1.item_id,
            item2_id=item2.item_id,
            similarity=round(sim, 4),
            method=method,
            common_terms=common
        )

    def _jaccard_similarity(self, text1: str, text2: str) -> Tuple[float, List[str]]:
        tokens1 = self._tokenize(text1)
        tokens2 = self._tokenize(text2)

        set1 = set(tokens1)
        set2 = set(tokens2)

        if not set1 and not set2:
            return 0.0, []

        intersection = set1 & set2
        union = set1 | set2

        if not union:
            return 0.0, []

        similarity = len(intersection) / len(union)
        common_terms = list(intersection)[:10]

        return similarity, common_terms

    def _cosine_similarity(self, text1: str, text2: str) -> Tuple[float, List[str]]:
        tokens1 = self._tokenize(text1)
        tokens2 = self._tokenize(text2)

        if not tokens1 or not tokens2:
            return 0.0, []

        freq1 = Counter(tokens1)
        freq2 = Counter(tokens2)

        all_tokens = set(freq1.keys()) | set(freq2.keys())

        dot_product = 0
        mag1 = 0
        mag2 = 0

        common_terms = []
        for token in all_tokens:
            tfidf1 = self._tfidf(token, freq1[token], len(all_tokens))
            tfidf2 = self._tfidf(token, freq2[token], len(all_tokens))

            dot_product += tfidf1 * tfidf2
            mag1 += tfidf1 ** 2
            mag2 += tfidf2 ** 2

            if freq1[token] > 0 and freq2[token] > 0:
                common_terms.append(token)

        if mag1 == 0 or mag2 == 0:
            return 0.0, []

        similarity = dot_product / (math.sqrt(mag1) * math.sqrt(mag2))
        return max(0.0, min(1.0, similarity)), common_terms[:10]

    def _levenshtein_similarity(self, text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0

        len1, len2 = len(text1), len(text2)
        if len1 == 0 or len2 == 0:
            return 0.0

        dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]

        for i in range(len1 + 1):
            dp[i][0] = i
        for j in range(len2 + 1):
            dp[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if text1[i - 1] == text2[j - 1] else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )

        max_len = max(len1, len2)
        if max_len == 0:
            return 0.0

        similarity = 1.0 - (dp[len1][len2] / max_len)
        return similarity

    def _hybrid_similarity(self, item1: LabeledItem, item2: LabeledItem) -> Tuple[float, List[str]]:
        label_similarity = self._label_similarity(item1, item2)
        text_jaccard, common1 = self._jaccard_similarity(item1.text, item2.text)
        text_cosine, common2 = self._cosine_similarity(item1.text, item2.text)

        weights = {
            'label': 0.35,
            'jaccard': 0.25,
            'cosine': 0.4
        }

        total_similarity = (
            weights['label'] * label_similarity +
            weights['jaccard'] * text_jaccard +
            weights['cosine'] * text_cosine
        )

        common_terms = list(set(common1 + common2))[:10]

        return total_similarity, common_terms

    def _label_similarity(self, item1: LabeledItem, item2: LabeledItem) -> float:
        labels1 = set(item1.labels)
        labels2 = set(item2.labels)

        if not labels1 and not labels2:
            return 0.5

        if not labels1 or not labels2:
            return 0.0

        intersection = labels1 & labels2
        union = labels1 | labels2

        if not union:
            return 0.0

        return len(intersection) / len(union)

    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []

        text = text.lower()
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)

        tokens = []
        i = 0
        n = len(text)

        while i < n:
            if '\u4e00' <= text[i] <= '\u9fff':
                if i + 1 < n and '\u4e00' <= text[i + 1] <= '\u9fff':
                    bigram = text[i:i + 2]
                    if bigram not in self._stopwords:
                        tokens.append(bigram)
                char = text[i]
                if char not in self._stopwords:
                    tokens.append(char)
                i += 1
            elif text[i].isalnum():
                j = i
                while j < n and text[j].isalnum():
                    j += 1
                word = text[i:j]
                if word not in self._stopwords and len(word) > 1:
                    tokens.append(word)
                i = j
            else:
                i += 1

        return tokens

    def _tfidf(self, term: str, tf: int, doc_count: int) -> float:
        if tf == 0:
            return 0.0

        if term not in self._idf_cache:
            self._idf_cache[term] = math.log(1 + 1.0)

        idf = self._idf_cache[term]
        return tf * idf


class ClusterEngine:
    def __init__(
        self,
        rules_config: RulesConfig,
        similarity_engine: SimilarityEngine
    ):
        self.rules = rules_config
        self.similarity = similarity_engine

    def cluster_items(
        self,
        items: List[LabeledItem],
        threshold: Optional[float] = None,
        by_label: bool = True
    ) -> List[Cluster]:
        threshold = threshold or self.rules.cluster_threshold
        clusters: List[Cluster] = []

        if not items:
            return clusters

        if by_label:
            clusters = self._cluster_by_label_first(items, threshold)
        else:
            clusters = self._cluster_by_similarity(items, threshold)

        for cluster in clusters:
            self._generate_cluster_explanation(cluster)

        clusters = [c for c in clusters if len(c.items) >= self.rules.min_cluster_size]
        clusters.sort(key=lambda c: len(c.items), reverse=True)

        return clusters

    def _cluster_by_label_first(
        self,
        items: List[LabeledItem],
        threshold: float
    ) -> List[Cluster]:
        label_groups: Dict[str, List[LabeledItem]] = defaultdict(list)

        for item in items:
            for label in item.labels:
                label_groups[label].append(item)

        all_clusters: List[Cluster] = []
        cluster_counter = 0

        for label_id, label_items in label_groups.items():
            if len(label_items) < 2:
                continue

            sub_clusters = self._cluster_by_similarity(label_items, threshold)

            for cluster in sub_clusters:
                cluster.cluster_id = f"cluster_{cluster_counter}"
                cluster.label = label_id
                all_clusters.append(cluster)
                cluster_counter += 1

        return all_clusters

    def _cluster_by_similarity(
        self,
        items: List[LabeledItem],
        threshold: float
    ) -> List[Cluster]:
        if not items:
            return []

        clusters: List[List[LabeledItem]] = []
        similarity_matrix: Dict[Tuple[str, str], float] = {}

        for i, item1 in enumerate(items):
            for j, item2 in enumerate(items[i + 1:], start=i + 1):
                result = self.similarity.calculate_similarity(item1, item2, 'hybrid')
                similarity_matrix[(item1.item_id, item2.item_id)] = result.similarity
                similarity_matrix[(item2.item_id, item1.item_id)] = result.similarity

        unassigned = set(item.item_id for item in items)
        item_map = {item.item_id: item for item in items}

        for item in items:
            if item.item_id not in unassigned:
                continue

            cluster: List[LabeledItem] = [item]
            unassigned.remove(item.item_id)

            for other_id in list(unassigned):
                other_item = item_map[other_id]
                sim = similarity_matrix.get(
                    (item.item_id, other_id),
                    self.similarity.calculate_similarity(item, other_item, 'hybrid').similarity
                )

                if sim >= threshold:
                    cluster.append(other_item)
                    unassigned.remove(other_id)

            if len(cluster) >= 1:
                clusters.append(cluster)

        result_clusters: List[Cluster] = []
        for idx, cluster_items in enumerate(clusters):
            if len(cluster_items) < 2:
                continue

            similarity_scores: Dict[str, float] = {}
            for item1 in cluster_items:
                for item2 in cluster_items:
                    if item1.item_id == item2.item_id:
                        continue
                    key = (item1.item_id, item2.item_id)
                    if key not in similarity_scores:
                        similarity_scores[key[0] + "_" + key[1]] = similarity_matrix.get(
                            key,
                            self.similarity.calculate_similarity(item1, item2, 'hybrid').similarity
                        )

            avg_similarity = (
                sum(similarity_scores.values()) / len(similarity_scores)
                if similarity_scores else 0.5
            )

            representative = self._find_representative(cluster_items)

            result_clusters.append(Cluster(
                cluster_id=f"cluster_{idx}",
                label=cluster_items[0].labels[0] if cluster_items[0].labels else "未分类",
                representative_text=representative.text[:200] + '...' if len(representative.text) > 200 else representative.text,
                items=cluster_items,
                similarity_scores=similarity_scores,
                avg_similarity=round(avg_similarity, 4),
                explanation=""
            ))

        return result_clusters

    def _find_representative(self, items: List[LabeledItem]) -> LabeledItem:
        if not items:
            raise ValueError("Cannot find representative for empty list")

        if len(items) == 1:
            return items[0]

        best_item = items[0]
        best_avg_sim = -1.0

        for item in items:
            total_sim = 0.0
            count = 0
            for other in items:
                if item.item_id == other.item_id:
                    continue
                result = self.similarity.calculate_similarity(item, other, 'hybrid')
                total_sim += result.similarity
                count += 1

            avg_sim = total_sim / count if count > 0 else 0
            if avg_sim > best_avg_sim:
                best_avg_sim = avg_sim
                best_item = item

        return best_item

    def _generate_cluster_explanation(self, cluster: Cluster):
        if not cluster.items:
            return

        label_rule = self.rules.labels.get(cluster.label)
        label_name = label_rule.display_name if label_rule else cluster.label

        student_names = sorted(set(item.student_name for item in cluster.items))

        examples = []
        for item in cluster.items[:3]:
            short_text = item.text[:80] + '...' if len(item.text) > 80 else item.text
            examples.append(f"- {item.student_name}: {short_text}")

        cluster.explanation = (
            f"【{label_name}】聚类包含 {len(cluster.items)} 条记录，"
            f"涉及学生：{', '.join(student_names[:5])}{'...' if len(student_names) > 5 else ''}。\n"
            f"平均相似度：{cluster.avg_similarity:.1%}\n"
            f"代表性片段：\n" + '\n'.join(examples)
        )
