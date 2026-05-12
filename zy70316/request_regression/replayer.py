import os
import json
import time
import importlib
from typing import Any, Dict, List, Optional

import requests

from .models import RequestSample, ReplayResult, SampleStatus
from .config import RegressionConfig, ServiceConfig


class ReplayEngine:
    def __init__(self, config: RegressionConfig):
        self.config = config

    def replay_sample(self, sample: RequestSample, service_name: str) -> ReplayResult:
        service = self.config.get_service(service_name)
        if not service:
            return ReplayResult(
                sample_id=sample.id,
                source=service_name,
                status_code=0,
                headers={},
                body=None,
                response_time_ms=0,
                error=f"Service '{service_name}' not found in config",
            )

        if sample.status != SampleStatus.VALID:
            return ReplayResult(
                sample_id=sample.id,
                source=service_name,
                status_code=0,
                headers={},
                body=None,
                response_time_ms=0,
                error=f"Sample is not valid: {sample.status.value}",
            )

        start_time = time.time()

        try:
            if service.type == "http":
                result = self._replay_http(sample, service)
            elif service.type == "builtin":
                result = self._replay_builtin(sample, service)
            else:
                result = ReplayResult(
                    sample_id=sample.id,
                    source=service_name,
                    status_code=0,
                    headers={},
                    body=None,
                    response_time_ms=0,
                    error=f"Unknown service type: {service.type}",
                )
        except Exception as e:
            result = ReplayResult(
                sample_id=sample.id,
                source=service_name,
                status_code=0,
                headers={},
                body=None,
                response_time_ms=(time.time() - start_time) * 1000,
                error=str(e),
            )

        result.response_time_ms = (time.time() - start_time) * 1000
        return result

    def _replay_http(self, sample: RequestSample, service: ServiceConfig) -> ReplayResult:
        if not service.url:
            raise ValueError("HTTP service requires a URL")

        url = service.url.rstrip("/") + sample.url
        headers = dict(service.headers)
        headers.update(sample.headers)

        response = requests.request(
            method=sample.method,
            url=url,
            headers=headers,
            json=sample.body if sample.method in ["POST", "PUT", "PATCH"] else None,
            params=sample.body if sample.method == "GET" and isinstance(sample.body, dict) else None,
            timeout=30,
        )

        response_body = None
        try:
            response_body = response.json()
        except Exception:
            response_body = response.text

        return ReplayResult(
            sample_id=sample.id,
            source=service.name,
            status_code=response.status_code,
            headers=dict(response.headers),
            body=response_body,
            response_time_ms=0,
        )

    def _replay_builtin(self, sample: RequestSample, service: ServiceConfig) -> ReplayResult:
        if not service.module or not service.processor:
            raise ValueError("Builtin service requires module and processor")

        module = importlib.import_module(service.module)
        processor_func = getattr(module, service.processor)

        response = processor_func(sample.method, sample.url, sample.headers, sample.body)

        return ReplayResult(
            sample_id=sample.id,
            source=service.name,
            status_code=response.get("status_code", 200),
            headers=response.get("headers", {}),
            body=response.get("body"),
            response_time_ms=0,
        )

    def save_replay_result(self, result: ReplayResult, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"{result.source}_{result.sample_id}.json")

        data = {
            "sample_id": result.sample_id,
            "source": result.source,
            "status_code": result.status_code,
            "headers": result.headers,
            "body": result.body,
            "response_time_ms": result.response_time_ms,
            "side_effects": result.side_effects,
            "error": result.error,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return file_path

    def load_replay_results(self, input_dir: str, source: Optional[str] = None) -> Dict[str, ReplayResult]:
        results: Dict[str, ReplayResult] = {}

        if not os.path.exists(input_dir):
            return results

        for filename in os.listdir(input_dir):
            if not filename.endswith(".json"):
                continue

            file_path = os.path.join(input_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                if source and data.get("source") != source:
                    continue

                result = ReplayResult(
                    sample_id=data["sample_id"],
                    source=data["source"],
                    status_code=data["status_code"],
                    headers=data.get("headers", {}),
                    body=data.get("body"),
                    response_time_ms=data.get("response_time_ms", 0),
                    side_effects=data.get("side_effects", {}),
                    error=data.get("error"),
                )
                results[result.sample_id] = result
            except Exception:
                continue

        return results
