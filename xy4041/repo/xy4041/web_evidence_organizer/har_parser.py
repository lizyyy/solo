#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HAR日志解析器
从HAR网络日志中提取请求/响应时间、状态码等信息
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from .config import TimeTrustLevel


class HARParser:
    """HAR日志解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._har_data: Dict = {}
        self._entries: List[Dict] = []

    def parse(self) -> Dict:
        """
        解析HAR文件

        Returns:
            解析结果字典
        """
        path = Path(self.file_path)
        if not path.exists():
            raise ValueError(f"文件不存在: {self.file_path}")

        with open(path, "r", encoding="utf-8") as f:
            self._har_data = json.load(f)

        log = self._har_data.get("log", {})
        self._entries = log.get("entries", [])

        result = {
            "file_path": self.file_path,
            "version": log.get("version", ""),
            "creator": log.get("creator", {}),
            "browser": log.get("browser", {}),
            "pages": self._parse_pages(log.get("pages", [])),
            "entry_count": len(self._entries),
            "time_range": self._get_time_range(),
            "status_codes": self._get_status_code_summary(),
        }

        return result

    def _parse_pages(self, pages: List[Dict]) -> List[Dict]:
        """解析页面信息"""
        parsed_pages = []
        for page in pages:
            started = page.get("startedDateTime")
            try:
                started_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                started_dt = None

            parsed_pages.append({
                "id": page.get("id", ""),
                "title": page.get("title", ""),
                "startedDateTime": started,
                "started_datetime": started_dt,
                "page_timings": page.get("pageTimings", {}),
            })
        return parsed_pages

    def _get_time_range(self) -> Dict:
        """获取时间范围"""
        if not self._entries:
            return {"start": None, "end": None}

        times = []
        for entry in self._entries:
            started = entry.get("startedDateTime")
            if started:
                try:
                    dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
                    times.append(dt)
                except (ValueError, TypeError):
                    continue

        if not times:
            return {"start": None, "end": None}

        return {
            "start": min(times),
            "end": max(times),
        }

    def _get_status_code_summary(self) -> Dict:
        """获取状态码统计"""
        status_counts = {}
        for entry in self._entries:
            response = entry.get("response", {})
            status = response.get("status", 0)
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "counts": status_counts,
            "has_4xx": any(400 <= s < 500 for s in status_counts.keys()),
            "has_5xx": any(500 <= s < 600 for s in status_counts.keys()),
        }

    def get_entries(self, filter_status: List[int] = None) -> List[Dict]:
        """
        获取所有请求条目

        Args:
            filter_status: 过滤指定状态码（可选）

        Returns:
            请求条目列表
        """
        entries = []
        for entry in self._entries:
            response = entry.get("response", {})
            status = response.get("status", 0)

            if filter_status and status not in filter_status:
                continue

            started = entry.get("startedDateTime")
            try:
                started_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                started_dt = None

            request = entry.get("request", {})
            url = request.get("url", "")
            parsed_url = urlparse(url)

            entries.append({
                "startedDateTime": started,
                "started_datetime": started_dt,
                "time": entry.get("time", 0),
                "request": {
                    "method": request.get("method", ""),
                    "url": url,
                    "hostname": parsed_url.hostname,
                    "path": parsed_url.path,
                    "query": parsed_url.query,
                    "headers": request.get("headers", []),
                    "headers_size": request.get("headersSize", 0),
                    "body_size": request.get("bodySize", 0),
                },
                "response": {
                    "status": status,
                    "status_text": response.get("statusText", ""),
                    "headers": response.get("headers", []),
                    "headers_size": response.get("headersSize", 0),
                    "body_size": response.get("bodySize", 0),
                    "content": response.get("content", {}),
                    "redirect_url": response.get("redirectURL", ""),
                },
                "cache": entry.get("cache", {}),
                "timings": entry.get("timings", {}),
                "server_ip_address": entry.get("serverIPAddress", ""),
                "connection": entry.get("connection", ""),
                "pageref": entry.get("pageref", ""),
            })

        return entries

    def get_error_entries(self) -> List[Dict]:
        """
        获取错误请求（4xx/5xx）

        Returns:
            错误请求列表
        """
        error_entries = []
        for entry in self.get_entries():
            status = entry["response"]["status"]
            if 400 <= status < 600:
                error_entries.append(entry)
        return error_entries

    def get_events(self) -> List[Dict]:
        """
        从HAR中提取事件（用于时间线）

        Returns:
            事件列表
        """
        events = []

        if not self._entries:
            self.parse()

        for entry in self.get_entries():
            started_dt = entry.get("started_datetime")
            if not started_dt:
                continue

            status = entry["response"]["status"]
            method = entry["request"]["method"]
            url = entry["request"]["url"]
            hostname = entry["request"]["hostname"] or "unknown"

            event_type = "network_request"
            summary = f"{method} {url[:100]}"
            trust_level = TimeTrustLevel.HIGH

            if 400 <= status < 500:
                event_type = "network_client_error"
                summary = f"[4xx] {method} {url[:80]} - 状态码: {status}"
            elif 500 <= status < 600:
                event_type = "network_server_error"
                summary = f"[5xx] {method} {url[:80]} - 状态码: {status}"

            events.append({
                "source": "har_log",
                "source_file": self.file_path,
                "timestamp": started_dt,
                "time_source": "har_request_time",
                "trust_level": trust_level,
                "event_type": event_type,
                "summary": summary,
                "details": {
                    "method": method,
                    "url": url,
                    "hostname": hostname,
                    "status": status,
                    "status_text": entry["response"]["status_text"],
                    "time_ms": entry.get("time", 0),
                    "server_ip": entry.get("server_ip_address", ""),
                    "pageref": entry.get("pageref", ""),
                },
            })

        return events

    def get_summary(self) -> Dict:
        """
        获取HAR文件摘要

        Returns:
            摘要信息字典
        """
        if not self._har_data:
            self.parse()

        entries = self.get_entries()
        error_entries = self.get_error_entries()

        methods = {}
        hosts = {}
        content_types = {}

        for entry in entries:
            method = entry["request"]["method"]
            methods[method] = methods.get(method, 0) + 1

            hostname = entry["request"]["hostname"]
            if hostname:
                hosts[hostname] = hosts.get(hostname, 0) + 1

            content = entry["response"].get("content", {})
            mime_type = content.get("mimeType", "")
            if mime_type:
                main_type = mime_type.split(";")[0].split("/")[0]
                content_types[main_type] = content_types.get(main_type, 0) + 1

        time_range = self._get_time_range()

        return {
            "file_path": self.file_path,
            "total_requests": len(entries),
            "error_requests": len(error_entries),
            "methods": methods,
            "hosts": hosts,
            "content_types": content_types,
            "time_range": {
                "start": time_range["start"].isoformat() if time_range["start"] else None,
                "end": time_range["end"].isoformat() if time_range["end"] else None,
            },
            "has_4xx_errors": any(400 <= e["response"]["status"] < 500 for e in error_entries),
            "has_5xx_errors": any(500 <= e["response"]["status"] < 600 for e in error_entries),
        }
