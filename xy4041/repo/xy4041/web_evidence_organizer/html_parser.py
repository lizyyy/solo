#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HTML页面解析器
从HTML文件中提取标题、元数据、时间信息等
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

from .config import TimeTrustLevel


class HTMLParser:
    """HTML页面解析器"""

    TIME_PATTERNS = [
        (r"(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2}):(\d{2})", "%Y-%m-%d %H:%M:%S"),
        (r"(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2})", "%Y-%m-%d %H:%M"),
        (r"(\d{4})/(\d{2})/(\d{2})\s*(\d{2}):(\d{2}):(\d{2})", "%Y/%m/%d %H:%M:%S"),
        (r"(\d{4})/(\d{2})/(\d{2})\s*(\d{2}):(\d{2})", "%Y/%m/%d %H:%M"),
        (r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})时(\d{1,2})分(\d{1,2})秒", "%Y年%m月%d日 %H时%M分%S秒"),
        (r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})时(\d{1,2})分", "%Y年%m月%d日 %H时%M分"),
    ]

    META_TIME_NAMES = [
        "date", "time", "datetime", "timestamp",
        "created", "modified", "updated", "published",
        "og:updated_time", "article:modified_time",
        "article:published_time",
    ]

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.soup: Optional[BeautifulSoup] = None
        self._parsed_data: Dict = {}

    def parse(self) -> Dict:
        """
        解析HTML文件

        Returns:
            解析结果字典
        """
        path = Path(self.file_path)
        if not path.exists():
            raise ValueError(f"文件不存在: {self.file_path}")

        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        self.soup = BeautifulSoup(content, "lxml")

        self._parsed_data = {
            "title": self._extract_title(),
            "meta_tags": self._extract_meta_tags(),
            "times": self._extract_times(),
            "links": self._extract_links(),
            "text_content": self._extract_text_content(),
            "file_path": self.file_path,
        }

        return self._parsed_data

    def _extract_title(self) -> str:
        """提取页面标题"""
        if not self.soup:
            return ""

        title_tag = self.soup.find("title")
        if title_tag:
            return title_tag.get_text(strip=True)

        h1_tags = self.soup.find_all("h1")
        if h1_tags:
            return h1_tags[0].get_text(strip=True)

        return ""

    def _extract_meta_tags(self) -> Dict[str, str]:
        """提取meta标签"""
        if not self.soup:
            return {}

        meta_data = {}
        for meta in self.soup.find_all("meta"):
            name = meta.get("name") or meta.get("property") or meta.get("http-equiv")
            content = meta.get("content")

            if name and content:
                meta_data[name.lower()] = content.strip()

        return meta_data

    def _extract_times(self) -> List[Dict]:
        """提取时间信息"""
        times = []

        if self.soup:
            for name in self.META_TIME_NAMES:
                if name in self._parsed_data.get("meta_tags", {}):
                    time_str = self._parsed_data["meta_tags"][name]
                    parsed = self._parse_time_string(time_str)
                    if parsed:
                        times.append({
                            "source": "meta",
                            "source_type": f"meta_{name}",
                            "time_str": time_str,
                            "parsed_time": parsed,
                            "trust_level": TimeTrustLevel.MEDIUM,
                        })

        if self._parsed_data.get("text_content"):
            text = self._parsed_data["text_content"]
            for pattern, fmt in self.TIME_PATTERNS:
                for match in re.finditer(pattern, text):
                    try:
                        time_str = match.group(0)
                        dt = datetime.strptime(time_str, fmt)
                        times.append({
                            "source": "text",
                            "source_type": "text_pattern",
                            "time_str": time_str,
                            "parsed_time": dt,
                            "trust_level": TimeTrustLevel.LOW,
                        })
                    except (ValueError, TypeError):
                        continue

        return times

    def _parse_time_string(self, time_str: str) -> Optional[datetime]:
        """解析时间字符串"""
        for pattern, fmt in self.TIME_PATTERNS:
            match = re.search(pattern, time_str)
            if match:
                try:
                    normalized = match.group(0)
                    if "年" in normalized or "月" in normalized or "日" in normalized:
                        normalized = normalized.replace("年", "-").replace("月", "-").replace("日", "")
                        normalized = normalized.replace("时", ":").replace("分", ":").replace("秒", "")
                    return datetime.strptime(normalized, fmt)
                except (ValueError, TypeError):
                    continue
        return None

    def _extract_links(self) -> List[Dict]:
        """提取链接信息"""
        if not self.soup:
            return []

        links = []
        for a in self.soup.find_all("a", href=True):
            href = a.get("href")
            text = a.get_text(strip=True)
            if href and (href.startswith("http") or href.startswith("/")):
                links.append({
                    "href": href,
                    "text": text[:200] if text else "",
                })

        return links

    def _extract_text_content(self) -> str:
        """提取文本内容"""
        if not self.soup:
            return ""

        for script in self.soup(["script", "style"]):
            script.decompose()

        text = self.soup.get_text(separator="\n", strip=True)
        return text[:10000]

    def get_events(self) -> List[Dict]:
        """
        从HTML中提取事件（用于时间线）

        Returns:
            事件列表
        """
        events = []

        if not self._parsed_data:
            self.parse()

        title = self._parsed_data.get("title", "")
        times = self._parsed_data.get("times", [])

        for time_info in times:
            parsed_time = time_info.get("parsed_time")
            if parsed_time:
                events.append({
                    "source": "html_page",
                    "source_file": self.file_path,
                    "timestamp": parsed_time,
                    "time_source": time_info.get("source_type", "html_meta_time"),
                    "trust_level": time_info.get("trust_level", TimeTrustLevel.MEDIUM),
                    "event_type": "page_snapshot",
                    "summary": f"页面快照: {title[:100] if title else '未知页面'}",
                    "details": {
                        "title": title,
                        "time_str": time_info.get("time_str"),
                        "meta_tags": self._parsed_data.get("meta_tags", {}),
                    },
                })

        if not events:
            file_stat = Path(self.file_path).stat()
            events.append({
                "source": "html_page",
                "source_file": self.file_path,
                "timestamp": datetime.fromtimestamp(file_stat.st_mtime),
                "time_source": "file_modified_time",
                "trust_level": TimeTrustLevel.LOW,
                "event_type": "page_snapshot",
                "summary": f"页面快照: {title[:100] if title else '未知页面'} (基于文件修改时间)",
                "details": {
                    "title": title,
                    "note": "使用文件修改时间作为近似时间",
                },
            })

        return events
