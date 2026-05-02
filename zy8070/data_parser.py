import pandas as pd
import json
import os
from datetime import datetime


class DataParser:
    def __init__(self):
        self.supported_time_formats = [
            "%H:%M:%S",
            "%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%H时%M分%S秒",
            "%H时%M分",
        ]

    def parse_session_csv(self, path):
        if os.path.getsize(path) == 0:
            raise ValueError("CSV 文件为空")

        try:
            df = pd.read_csv(path, encoding='utf-8')
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(path, encoding='utf-8-sig')
            except UnicodeDecodeError:
                df = pd.read_csv(path, encoding='gbk')

        required_cols = ['环节名称', '开始时间', '结束时间']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"CSV 缺少必要列: {', '.join(missing)}")

        df['开始时间'] = df['开始时间'].apply(self._parse_time)
        df['结束时间'] = df['结束时间'].apply(self._parse_time)

        return df

    def _parse_time(self, time_str):
        if pd.isna(time_str) or str(time_str).strip() == '':
            return None

        time_str = str(time_str).strip()

        for fmt in self.supported_time_formats:
            try:
                parsed = datetime.strptime(time_str, fmt)
                return parsed.strftime("%H:%M:%S")
            except ValueError:
                continue

        raise ValueError(f"无法解析时间格式: {time_str}")

    def parse_products_json(self, path):
        if os.path.getsize(path) == 0:
            raise ValueError("JSON 文件为空")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            raise ValueError("JSON 格式应为对象或数组")

        for item in data:
            if '环节ID' not in item and '环节名称' not in item:
                raise ValueError("商品数据缺少环节标识")

        return data

    def parse_banned_words(self, path):
        if os.path.getsize(path) == 0:
            return []

        with open(path, 'r', encoding='utf-8') as f:
            words = [line.strip() for line in f if line.strip()]

        return list(set(words))