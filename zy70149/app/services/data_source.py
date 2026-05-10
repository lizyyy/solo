import hashlib
import json
from typing import List, Dict, Any
from abc import ABC, abstractmethod


class DataSource(ABC):
    @abstractmethod
    def fetch_data(self, config: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_checksum(self, data: List[Dict[str, Any]]) -> str:
        pass


class MockDataSource(DataSource):
    def fetch_data(self, config: str) -> List[Dict[str, Any]]:
        try:
            config_dict = json.loads(config)
        except json.JSONDecodeError:
            return []
        
        items = config_dict.get("items", [])
        return items

    def get_checksum(self, data: List[Dict[str, Any]]) -> str:
        if not data:
            return hashlib.sha256(b"empty").hexdigest()
        
        sorted_data = sorted(
            [json.dumps(item, sort_keys=True) for item in data]
        )
        combined = "|".join(sorted_data)
        return hashlib.sha256(combined.encode()).hexdigest()


class DataSourceFactory:
    _sources: Dict[str, DataSource] = {
        "mock": MockDataSource(),
    }

    @classmethod
    def get(cls, source_type: str) -> DataSource:
        source = cls._sources.get(source_type)
        if not source:
            raise ValueError(f"未知的数据源类型: {source_type}")
        return source

    @classmethod
    def register(cls, source_type: str, source: DataSource):
        cls._sources[source_type] = source


data_source_factory = DataSourceFactory()
