#!/usr/bin/env python3
import json
from pathlib import Path

initial_data = {
    "cn-north": {
        "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
        "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
        "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
        "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
        "member:M001:benefits:gold": "{\"discount\": 0.95, \"points_multiplier\": 1.5}"
    },
    "cn-south": {
        "product:P001:price": "{\"price\": 199.99, \"currency\": \"CNY\"}",
        "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
        "inventory:P001:WH001": "{\"available\": 150, \"reserved\": 20}",
        "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
        "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
    },
    "cn-east": {
        "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
        "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
        "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
        "inventory:P002:WH002": "{\"available\": 30, \"reserved\": 10}",
        "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
    },
    "cn-west": {
        "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
        "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
        "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
        "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
        "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
    }
}

cache_file = Path('examples/mock_cache.json')
with open(cache_file, 'w', encoding='utf-8') as f:
    json.dump(initial_data, f, ensure_ascii=False, indent=2)

print('✓ 已恢复模拟缓存到初始状态')
