import re
import difflib
from typing import List, Tuple, Dict, Any
from collections import Counter

from app.core.config import settings


def preprocess_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_keywords(text: str, max_keywords: int = 20) -> List[str]:
    text = preprocess_text(text)
    words = re.findall(r'[\w\u4e00-\u9fff]+', text)

    stop_words = {'的', '是', '在', '了', '和', '与', '及', '或', '等', '也', '都', '就', '要', '会', '能', '可以', '可能', '应该',
                  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
                  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
                  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
                  'through', 'during', 'before', 'after', 'above', 'below', 'between',
                  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
                  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their'}

    filtered_words = [word for word in words if word not in stop_words and len(word) > 1]
    word_counts = Counter(filtered_words)
    keywords = [word for word, _ in word_counts.most_common(max_keywords)]

    return keywords


def match_keywords(standard_text: str, meeting_text: str) -> Tuple[List[str], List[str], float]:
    standard_keywords = extract_keywords(standard_text)
    meeting_keywords = extract_keywords(meeting_text)

    if not standard_keywords:
        return [], [], 0.0

    matched_keywords = []
    missing_keywords = []

    for keyword in standard_keywords:
        if keyword in meeting_text.lower():
            matched_keywords.append(keyword)
        else:
            missing_keywords.append(keyword)

    match_ratio = len(matched_keywords) / len(standard_keywords)

    return matched_keywords, missing_keywords, match_ratio


def sentence_similarity(sentence1: str, sentence2: str) -> float:
    s1 = preprocess_text(sentence1)
    s2 = preprocess_text(sentence2)

    if not s1 or not s2:
        return 0.0

    words1 = set(re.findall(r'[\w\u4e00-\u9fff]+', s1))
    words2 = set(re.findall(r'[\w\u4e00-\u9fff]+', s2))

    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2

    jaccard = len(intersection) / len(union) if union else 0.0

    seq_ratio = difflib.SequenceMatcher(None, s1, s2).ratio()

    return (jaccard * 0.4 + seq_ratio * 0.6)


def split_sentences(text: str) -> List[str]:
    sentences = re.split(r'[。！？.!?\n]', text)
    return [s.strip() for s in sentences if s.strip()]


def compare_sentences(standard_text: str, meeting_text: str, threshold: float = None) -> Tuple[List[Dict[str, Any]], float]:
    if threshold is None:
        threshold = settings.SIMILARITY_THRESHOLD

    standard_sentences = split_sentences(standard_text)
    meeting_sentences = split_sentences(meeting_text)

    results = []
    total_similarity = 0.0
    count = 0

    for std_sent in standard_sentences:
        best_similarity = 0.0
        best_meeting_sent = ""
        best_diff = ""

        for meet_sent in meeting_sentences:
            sim = sentence_similarity(std_sent, meet_sent)
            if sim > best_similarity:
                best_similarity = sim
                best_meeting_sent = meet_sent

        if best_similarity > 0:
            diff = list(difflib.ndiff([std_sent], [best_meeting_sent]))
            best_diff = "\n".join(diff)

        results.append({
            "standard_sentence": std_sent,
            "meeting_sentence": best_meeting_sent,
            "similarity": best_similarity,
            "is_match": best_similarity >= threshold,
            "diff": best_diff
        })

        total_similarity += best_similarity
        count += 1

    average_similarity = total_similarity / count if count > 0 else 0.0

    return results, average_similarity


def calculate_overall_similarity(standard_text: str, meeting_text: str, threshold: float = None) -> Tuple[float, bool, Dict[str, Any]]:
    if threshold is None:
        threshold = settings.SIMILARITY_THRESHOLD

    matched_keywords, missing_keywords, keyword_ratio = match_keywords(standard_text, meeting_text)

    sentence_results, avg_sentence_sim = compare_sentences(standard_text, meeting_text, threshold)

    overall_similarity = keyword_ratio * 0.3 + avg_sentence_sim * 0.7

    is_match = overall_similarity >= threshold

    details = {
        "keyword_match": {
            "matched": matched_keywords,
            "missing": missing_keywords,
            "ratio": keyword_ratio
        },
        "sentence_compare": {
            "results": sentence_results,
            "average_similarity": avg_sentence_sim
        }
    }

    return overall_similarity, is_match, details


def determine_error_type(standard_text: str, meeting_text: str, similarity: float, threshold: float = None) -> str:
    if threshold is None:
        threshold = settings.SIMILARITY_THRESHOLD

    if similarity >= threshold:
        return "correct"

    std_len = len(preprocess_text(standard_text))
    meet_len = len(preprocess_text(meeting_text))

    if meet_len == 0 or meet_len < std_len * 0.3:
        return "missing"

    matched_keywords, missing_keywords, keyword_ratio = match_keywords(standard_text, meeting_text)

    if keyword_ratio < 0.3:
        return "wrong"

    return "incomplete"
