import re
import hashlib
from typing import List, Optional, Set
from collections import Counter

from .types import FailureRecord, NormalizedSignature
from .config import ClusterConfig


class SignatureNormalizer:
    def __init__(self, config: ClusterConfig):
        self.config = config
        self._compile_patterns()

    def _compile_patterns(self):
        self.hex_pattern = re.compile(r"\b0x[0-9a-fA-F]+\b")
        self.uuid_pattern = re.compile(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )
        self.path_pattern = re.compile(
            r"(?:[a-zA-Z]:)?[\\/](?:[^\\/\s]+[\\/])+[^\\/\s]*(?:\.\w+)?"
        )
        self.number_pattern = re.compile(r"\b\d+\.?\d*\b")
        self.timestamp_pattern = re.compile(
            r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?"
        )
        self.line_number_pattern = re.compile(r"(line\s*)\d+", re.IGNORECASE)
        self.memory_address_pattern = re.compile(r"0x[0-9a-fA-F]+")

        self.error_type_patterns = [
            (re.compile(r"\b" + re.escape(t) + r"\b"), t)
            for t in self.config.error_patterns
        ]

    def normalize(self, record: FailureRecord) -> NormalizedSignature:
        error_msg = record.error_message or ""
        stack_trace = record.stack_trace or ""

        normalized_error = self._normalize_text(error_msg)
        normalized_stack = self._normalize_stack(stack_trace) if stack_trace else None

        tokens = self._tokenize(f"{normalized_error} {normalized_stack or ''}")

        signature_text = self._build_signature_text(normalized_error, normalized_stack, tokens)
        signature_hash = hashlib.sha256(signature_text.encode()).hexdigest()[:16]

        error_type = self._detect_error_type(error_msg, stack_trace)
        error_category = self._categorize_error(error_type, normalized_error)

        return NormalizedSignature(
            normalized_error=normalized_error,
            normalized_stack=normalized_stack,
            signature_hash=signature_hash,
            tokens=tokens,
            error_type=error_type,
            error_category=error_category,
        )

    def _normalize_text(self, text: str) -> str:
        result = text

        if self.config.normalize_uuids:
            result = self.uuid_pattern.sub("<UUID>", result)

        if self.config.normalize_hex:
            result = self.hex_pattern.sub("<HEX>", result)
            result = self.memory_address_pattern.sub("<MEM>", result)

        if self.config.normalize_paths:
            result = self.path_pattern.sub("<PATH>", result)

        if self.config.normalize_timestamps:
            result = self.timestamp_pattern.sub("<TS>", result)

        if self.config.normalize_numbers:
            result = self.line_number_pattern.sub(r"\1<N>", result)
            result = self.number_pattern.sub("<N>", result)

        result = re.sub(r"\s+", " ", result).strip()
        return result

    def _normalize_stack(self, stack: str) -> str:
        lines = stack.splitlines()
        filtered_lines = []

        for line in lines:
            skip = False
            for ignore_pattern in self.config.stack_frame_ignore:
                if re.search(ignore_pattern, line, re.IGNORECASE):
                    skip = True
                    break

            if not skip:
                normalized_line = self._normalize_text(line)
                if normalized_line:
                    filtered_lines.append(normalized_line)

        return "\n".join(filtered_lines[:50])

    def _tokenize(self, text: str) -> List[str]:
        words = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", text.lower())

        stop_words = set(w.lower() for w in self.config.stop_words)
        filtered = [w for w in words if w not in stop_words and len(w) > 2]

        counter = Counter(filtered)
        sorted_tokens = sorted(counter.items(), key=lambda x: -x[1])
        tokens = [t for t, _ in sorted_tokens[: self.config.max_tokens_per_signature]]

        return sorted(tokens)

    def _build_signature_text(self, error: str, stack: Optional[str], tokens: List[str]) -> str:
        parts = []
        parts.append(error[:200])
        if stack:
            parts.append(stack[:300])
        parts.append(" ".join(tokens))
        return "|".join(parts)

    def _detect_error_type(self, error_msg: str, stack_trace: str) -> Optional[str]:
        full_text = f"{error_msg}\n{stack_trace}"
        for pattern, type_name in self.error_type_patterns:
            if pattern.search(full_text):
                return type_name
        return None

    def _categorize_error(self, error_type: Optional[str], normalized_error: str) -> Optional[str]:
        if not error_type:
            if "timeout" in normalized_error.lower():
                return "timeout"
            if "connection" in normalized_error.lower() or "network" in normalized_error.lower():
                return "network"
            if "import" in normalized_error.lower() or "module" in normalized_error.lower():
                return "dependency"
            if "assert" in normalized_error.lower():
                return "assertion"
            return None
        return error_type
