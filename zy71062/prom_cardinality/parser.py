import re
import json
import yaml
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class MetricSample:
    name: str
    labels: Dict[str, str]
    value: float
    timestamp: Optional[int] = None


class PrometheusParser:
    METRIC_LINE_PATTERN = re.compile(
        r'^(?P<name>[a-zA-Z_:][a-zA-Z0-9_:]*)'
        r'(?P<labels>\{[^}]*\})?'
        r'\s+'
        r'(?P<value>[+-]?\d+\.?\d*(?:e[+-]?\d+)?)'
        r'(?:\s+(?P<timestamp>\d+))?$'
    )
    
    LABEL_PATTERN = re.compile(
        r'(?P<key>[a-zA-Z_][a-zA-Z0-9_]*)'
        r'='
        r'"(?P<value>[^"\\]*(?:\\.[^"\\]*)*)"'
    )

    def __init__(self, config):
        self.config = config
    
    def parse(self) -> List[MetricSample]:
        samples = []
        
        if self.config.metrics_path:
            samples.extend(self._parse_prometheus_text())
        
        if self.config.labels_path:
            samples.extend(self._parse_labels_file())
        
        return self._deduplicate_samples(samples)
    
    def _parse_prometheus_text(self) -> List[MetricSample]:
        samples = []
        
        with open(self.config.metrics_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                
                if not line or line.startswith('#'):
                    continue
                
                sample = self._parse_metric_line(line, line_num)
                if sample:
                    samples.append(sample)
        
        return samples
    
    def _parse_metric_line(self, line: str, line_num: int) -> Optional[MetricSample]:
        match = self.METRIC_LINE_PATTERN.match(line)
        if not match:
            if self.config.verbose:
                print(f"警告: 第 {line_num} 行格式无法解析: {line[:50]}...")
            return None
        
        name = match.group('name')
        labels_str = match.group('labels') or '{}'
        value = float(match.group('value'))
        timestamp = int(match.group('timestamp')) if match.group('timestamp') else None
        
        labels = self._parse_labels(labels_str)
        
        return MetricSample(
            name=name,
            labels=labels,
            value=value,
            timestamp=timestamp
        )
    
    def _parse_labels(self, labels_str: str) -> Dict[str, str]:
        labels = {}
        
        if labels_str == '{}':
            return labels
        
        labels_str = labels_str[1:-1]
        
        for match in self.LABEL_PATTERN.finditer(labels_str):
            key = match.group('key')
            value = match.group('value')
            value = value.replace('\\"', '"').replace('\\\\', '\\')
            labels[key] = value
        
        return labels
    
    def _parse_labels_file(self) -> List[MetricSample]:
        samples = []
        
        ext = self.config.labels_path.lower().split('.')[-1]
        
        with open(self.config.labels_path, 'r') as f:
            if ext in ['yaml', 'yml']:
                data = yaml.safe_load(f)
            else:
                data = json.load(f)
        
        if isinstance(data, list):
            for item in data:
                samples.extend(self._data_to_samples(item))
        elif isinstance(data, dict):
            samples.extend(self._data_to_samples(data))
        
        return samples
    
    def _data_to_samples(self, data: Dict[str, Any]) -> List[MetricSample]:
        samples = []
        
        if 'metric' in data and 'labels' in data:
            samples.append(MetricSample(
                name=data['metric'],
                labels=data['labels'],
                value=data.get('value', 1.0)
            ))
        elif 'metrics' in data:
            for item in data['metrics']:
                if isinstance(item, dict) and 'name' in item:
                    samples.append(MetricSample(
                        name=item['name'],
                        labels=item.get('labels', {}),
                        value=item.get('value', 1.0)
                    ))
        else:
            for metric_name, labels_list in data.items():
                if isinstance(labels_list, list):
                    for labels in labels_list:
                        if isinstance(labels, dict):
                            samples.append(MetricSample(
                                name=metric_name,
                                labels=labels,
                                value=1.0
                            ))
        
        return samples
    
    def _deduplicate_samples(self, samples: List[MetricSample]) -> List[MetricSample]:
        seen = set()
        unique = []
        
        for sample in samples:
            labels_key = tuple(sorted(sample.labels.items()))
            key = (sample.name, labels_key)
            
            if key not in seen:
                seen.add(key)
                unique.append(sample)
        
        return unique
