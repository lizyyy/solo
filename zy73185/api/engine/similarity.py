import re
from typing import Set

_PUNCT_RE = re.compile(r"[\s，。、；：\"''（）\(\)\[\]【】,.;:\-_/\\]+")


def _tokenize(text: str) -> Set[str]:
    tokens: Set[str] = set()
    cleaned = _PUNCT_RE.sub(" ", text.lower())
    for piece in cleaned.split():
        if piece:
            tokens.add(piece)
    for i in range(len(cleaned) - 1):
        bigram = cleaned[i : i + 2].strip()
        if len(bigram) == 2:
            tokens.add(bigram)
    return tokens


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def similarity_score(a: str, b: str) -> float:
    return jaccard(_tokenize(a), _tokenize(b))
