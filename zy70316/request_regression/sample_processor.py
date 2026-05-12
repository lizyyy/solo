import os
import re
import json
import hashlib
from typing import Any, Dict, List, Optional
from datetime import datetime

from .models import RequestSample, SampleStatus
from .config import RegressionConfig


class SampleProcessor:
    def __init__(self, config: RegressionConfig):
        self.config = config

    def process_sample_file(self, file_path: str) -> List[RequestSample]:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        samples = []
        if isinstance(raw_data, list):
            for item in raw_data:
                sample = self._parse_raw_sample(item)
                if sample:
                    samples.append(sample)
        else:
            sample = self._parse_raw_sample(raw_data)
            if sample:
                samples.append(sample)

        return samples

    def _parse_timestamp(self, ts_str: str) -> datetime:
        ts_str = ts_str.replace("Z", "+00:00")
        return datetime.fromisoformat(ts_str)

    def _parse_raw_sample(self, raw: Dict[str, Any]) -> Optional[RequestSample]:
        try:
            ts_str = raw.get("timestamp")
            if ts_str:
                timestamp = self._parse_timestamp(ts_str)
            else:
                timestamp = datetime.now()

            sample = RequestSample(
                id=raw.get("id", hashlib.md5(json.dumps(raw, sort_keys=True).encode()).hexdigest()[:12]),
                group=raw.get("group", self._infer_group(raw)),
                method=raw.get("method", "GET").upper(),
                url=raw.get("url", ""),
                headers=raw.get("headers", {}),
                body=raw.get("body"),
                timestamp=timestamp,
                side_effects=raw.get("side_effects", {}),
            )

            sample = self._validate_and_mark(sample)
            return sample
        except Exception as e:
            return None

    def _infer_group(self, raw: Dict[str, Any]) -> str:
        url = raw.get("url", "")
        if "/member" in url or "/user" in url:
            return "member"
        elif "/order" in url:
            return "order"
        elif "/inventory" in url or "/stock" in url:
            return "inventory"
        return "unknown"

    def _validate_and_mark(self, sample: RequestSample) -> RequestSample:
        missing_headers = []
        for header in self.config.required_headers:
            if header.lower() not in [h.lower() for h in sample.headers.keys()]:
                missing_headers.append(header)

        if missing_headers:
            sample.status = SampleStatus.MISSING_HEADERS
            return sample

        if not sample.url:
            sample.status = SampleStatus.BAD
            return sample

        return sample

    def desensitize(self, sample: RequestSample) -> RequestSample:
        try:
            headers_dict = dict(sample.headers)
            for rule in self.config.desensitization_rules:
                if rule.field in headers_dict:
                    if rule.pattern:
                        headers_dict[rule.field] = re.sub(rule.pattern, rule.replacement, headers_dict[rule.field])
                    else:
                        headers_dict[rule.field] = rule.replacement

            body = self._desensitize_body(sample.body, "")

            sample.headers = headers_dict
            sample.body = body
            sample.desensitized = True
            sample.original_id = sample.id
            sample.id = f"{sample.id}_d"

        except Exception as e:
            sample.status = SampleStatus.DESENSITIZATION_FAILED

        return sample

    def _desensitize_body(self, body: Any, path: str) -> Any:
        if body is None:
            return None

        if isinstance(body, dict):
            result = {}
            for key, value in body.items():
                full_path = f"{path}.{key}" if path else key
                matched_rule = None
                for rule in self.config.desensitization_rules:
                    if rule.field in full_path:
                        matched_rule = rule
                        break

                if matched_rule:
                    if isinstance(value, str) and matched_rule.pattern:
                        result[key] = re.sub(matched_rule.pattern, matched_rule.replacement, value)
                    else:
                        result[key] = matched_rule.replacement
                else:
                    result[key] = self._desensitize_body(value, full_path)
            return result

        if isinstance(body, list):
            return [self._desensitize_body(item, path) for item in body]

        return body

    def group_samples(self, samples: List[RequestSample]) -> Dict[str, List[RequestSample]]:
        groups: Dict[str, List[RequestSample]] = {}
        for sample in samples:
            if sample.group not in groups:
                groups[sample.group] = []
            groups[sample.group].append(sample)
        return groups

    def save_processed_sample(self, sample: RequestSample, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"{sample.id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample.to_dict(), f, indent=2, ensure_ascii=False)
        return file_path

    def load_processed_samples(self, input_dir: str) -> List[RequestSample]:
        samples = []
        if not os.path.exists(input_dir):
            return samples

        for filename in os.listdir(input_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(input_dir, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        samples.append(RequestSample.from_dict(data))
                except Exception:
                    continue
        return samples
