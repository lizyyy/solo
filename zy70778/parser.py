import json
import pandas as pd
from typing import List, Dict, Any
from schemas import ScenarioBase, ReportFormat
import re
import io


class ReportParser:
    def __init__(self):
        self.parsers = {
            ReportFormat.JMETER: self._parse_jmeter,
            ReportFormat.LOCUST: self._parse_locust,
            ReportFormat.K6: self._parse_k6,
            ReportFormat.GENERIC: self._parse_generic
        }

    def parse(self, content: str, format_type: ReportFormat) -> List[ScenarioBase]:
        parser_func = self.parsers.get(format_type)
        if not parser_func:
            raise ValueError(f"Unsupported format: {format_type}")
        return parser_func(content)

    def _parse_jmeter(self, content: str) -> List[ScenarioBase]:
        scenarios = []
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "scenarios" in data:
                for item in data["scenarios"]:
                    scenario = ScenarioBase(
                        scenario_name=item.get("label", item.get("scenario_name", "unknown")),
                        throughput=float(item.get("throughput", item.get("requests_per_second", 0))),
                        p95=float(item.get("p95", item.get("95th_percentile", 0))),
                        error_rate=float(item.get("error_rate", item.get("error_pct", 0))),
                        concurrency=item.get("concurrency"),
                        duration=item.get("duration")
                    )
                    scenarios.append(scenario)
            else:
                df = pd.read_csv(io.StringIO(content)) if "," in content else pd.read_excel(io.StringIO(content))
                for _, row in df.iterrows():
                    scenario = ScenarioBase(
                        scenario_name=str(row.get("label", row.get("scenario_name", "unknown"))),
                        throughput=float(row.get("throughput", row.get("requests_per_second", 0))),
                        p95=float(row.get("p95", row.get("95th_percentile", 0))),
                        error_rate=float(row.get("error_rate", row.get("error_pct", 0))),
                        concurrency=row.get("concurrency"),
                        duration=row.get("duration")
                    )
                    scenarios.append(scenario)
        except Exception as e:
            raise ValueError(f"JMeter parse error: {str(e)}")
        return scenarios

    def _parse_locust(self, content: str) -> List[ScenarioBase]:
        scenarios = []
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                if "stats" in data:
                    for item in data["stats"]:
                        scenario = ScenarioBase(
                            scenario_name=item.get("name", "unknown"),
                            throughput=float(item.get("requests_per_second", 0)),
                            p95=float(item.get("p95", item.get("response_time_percentile_95", 0))),
                            error_rate=self._calc_error_rate(item.get("num_requests", 0), item.get("num_failures", 0)),
                            concurrency=item.get("current_users"),
                            duration=item.get("duration")
                        )
                        scenarios.append(scenario)
                else:
                    for key, item in data.items():
                        if isinstance(item, dict) and "requests_per_second" in item:
                            scenario = ScenarioBase(
                                scenario_name=key,
                                throughput=float(item.get("requests_per_second", 0)),
                                p95=float(item.get("p95", 0)),
                                error_rate=self._calc_error_rate(item.get("num_requests", 0), item.get("num_failures", 0))
                            )
                            scenarios.append(scenario)
        except Exception as e:
            raise ValueError(f"Locust parse error: {str(e)}")
        return scenarios

    def _parse_k6(self, content: str) -> List[ScenarioBase]:
        scenarios = []
        try:
            data = json.loads(content)
            if "metrics" in data:
                metrics = data["metrics"]
                scenario_name = data.get("group", "default")
                throughput = metrics.get("http_reqs", {}).get("rate", 0)
                p95 = metrics.get("http_req_duration", {}).get("p95", 0)
                error_rate = self._calc_k6_error_rate(metrics)
                scenario = ScenarioBase(
                    scenario_name=scenario_name,
                    throughput=float(throughput),
                    p95=float(p95),
                    error_rate=float(error_rate)
                )
                scenarios.append(scenario)
            elif isinstance(data, list):
                for item in data:
                    scenario = ScenarioBase(
                        scenario_name=item.get("name", "unknown"),
                        throughput=float(item.get("throughput", item.get("reqs_sec", 0))),
                        p95=float(item.get("p95", 0)),
                        error_rate=float(item.get("error_rate", 0))
                    )
                    scenarios.append(scenario)
        except Exception as e:
            raise ValueError(f"k6 parse error: {str(e)}")
        return scenarios

    def _parse_generic(self, content: str) -> List[ScenarioBase]:
        scenarios = []
        try:
            if content.strip().startswith("[") or content.strip().startswith("{"):
                data = json.loads(content)
                items = data if isinstance(data, list) else data.get("scenarios", [data])
            else:
                df = pd.read_csv(io.StringIO(content))
                items = df.to_dict("records")
            
            for item in items:
                if isinstance(item, dict):
                    scenario = ScenarioBase(
                        scenario_name=str(item.get("scenario_name", item.get("name", "unknown"))),
                        throughput=float(item.get("throughput", 0)),
                        p95=float(item.get("p95", 0)),
                        error_rate=float(item.get("error_rate", 0)),
                        concurrency=item.get("concurrency"),
                        duration=item.get("duration")
                    )
                    scenarios.append(scenario)
        except Exception as e:
            raise ValueError(f"Generic parse error: {str(e)}")
        return scenarios

    def _calc_error_rate(self, total: int, failures: int) -> float:
        if total == 0:
            return 0.0
        return (failures / total) * 100

    def _calc_k6_error_rate(self, metrics: Dict) -> float:
        total = metrics.get("http_reqs", {}).get("count", 0)
        if total == 0:
            return 0.0
        failed = metrics.get("http_req_failed", {}).get("count", 0)
        return (failed / total) * 100


def match_scenario_pattern(scenario_name: str, pattern: str) -> bool:
    if not pattern:
        return True
    regex_pattern = pattern.replace("*", ".*")
    return bool(re.match(f"^{regex_pattern}$", scenario_name))
