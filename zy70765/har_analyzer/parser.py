import json
import re
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse


class HarEntry:
    def __init__(
        self,
        index: int,
        url: str,
        domain: str,
        resource_type: str,
        status: int,
        time: float,
        timings: Dict[str, Any],
        started_date_time: str,
        request: Dict[str, Any],
        response: Dict[str, Any],
        source_file: str,
        raw_index: int,
    ):
        self.index = index
        self.url = url
        self.domain = domain
        self.resource_type = resource_type
        self.status = status
        self.time = time
        self.timings = timings
        self.started_date_time = started_date_time
        self.request = request
        self.response = response
        self.source_file = source_file
        self.raw_index = raw_index
        self.is_bad = False
        self.bad_reason = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "url": self.url,
            "domain": self.domain,
            "resource_type": self.resource_type,
            "status": self.status,
            "time": self.time,
            "timings": self.timings,
            "started_date_time": self.started_date_time,
            "source_file": self.source_file,
            "raw_index": self.raw_index,
            "is_bad": self.is_bad,
            "bad_reason": self.bad_reason,
        }


class BadEntry(HarEntry):
    def __init__(
        self,
        raw_index: int,
        source_file: str,
        bad_reason: str,
        raw_data: Optional[Any] = None,
    ):
        super().__init__(
            index=raw_index,
            url="",
            domain="",
            resource_type="",
            status=0,
            time=0.0,
            timings={},
            started_date_time="",
            request={},
            response={},
            source_file=source_file,
            raw_index=raw_index,
        )
        self.is_bad = True
        self.bad_reason = bad_reason
        self.raw_data = raw_data


class HarParser:
    RESOURCE_TYPE_MAPPING = {
        "document": "document",
        "script": "script",
        "js": "script",
        "stylesheet": "stylesheet",
        "css": "stylesheet",
        "image": "image",
        "img": "image",
        "media": "media",
        "font": "font",
        "websocket": "websocket",
        "xhr": "xhr",
        "fetch": "xhr",
        "ajax": "xhr",
        "other": "other",
    }

    def __init__(self):
        self.entries: List[HarEntry] = []
        self.bad_entries: List[BadEntry] = []
        self.source_file = ""

    def extract_resource_type(self, entry: Dict[str, Any]) -> str:
        resource_type = entry.get("_resourceType", "")
        if resource_type:
            return self.RESOURCE_TYPE_MAPPING.get(
                resource_type.lower(), resource_type.lower()
            )

        response = entry.get("response", {})
        content = response.get("content", {})
        mime_type = content.get("mimeType", "")

        if mime_type:
            if "text/html" in mime_type:
                return "document"
            elif "javascript" in mime_type or "ecmascript" in mime_type:
                return "script"
            elif "css" in mime_type:
                return "stylesheet"
            elif "image" in mime_type:
                return "image"
            elif "font" in mime_type:
                return "font"
            elif "audio" in mime_type or "video" in mime_type:
                return "media"

        request = entry.get("request", {})
        url = request.get("url", "")
        if re.search(r"\.(js|mjs)(\?|$)", url, re.IGNORECASE):
            return "script"
        elif re.search(r"\.css(\?|$)", url, re.IGNORECASE):
            return "stylesheet"
        elif re.search(r"\.(png|jpg|jpeg|gif|webp|svg|ico)(\?|$)", url, re.IGNORECASE):
            return "image"
        elif re.search(r"\.(woff|woff2|ttf|otf|eot)(\?|$)", url, re.IGNORECASE):
            return "font"
        elif re.search(r"\.(mp4|webm|mp3|wav)(\?|$)", url, re.IGNORECASE):
            return "media"

        return "other"

    def extract_domain(self, url: str) -> str:
        try:
            parsed = urlparse(url)
            return parsed.netloc or "unknown"
        except Exception:
            return "unknown"

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        self.source_file = file_path
        self.entries = []
        self.bad_entries = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"JSON解析失败: {str(e)}",
                "entries": [],
                "bad_entries": [],
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"文件读取失败: {str(e)}",
                "entries": [],
                "bad_entries": [],
            }

        log = raw_data.get("log", {})
        entries = log.get("entries", [])

        valid_index = 0
        for raw_index, entry in enumerate(entries):
            try:
                request = entry.get("request", {})
                response = entry.get("response", {})
                url = request.get("url", "")
                domain = self.extract_domain(url)
                resource_type = self.extract_resource_type(entry)
                status = response.get("status", 0)
                time = entry.get("time", 0.0)
                timings = entry.get("timings", {})
                started_date_time = entry.get("startedDateTime", "")

                har_entry = HarEntry(
                    index=valid_index,
                    url=url,
                    domain=domain,
                    resource_type=resource_type,
                    status=status,
                    time=float(time) if time is not None else 0.0,
                    timings=timings,
                    started_date_time=started_date_time,
                    request=request,
                    response=response,
                    source_file=file_path,
                    raw_index=raw_index,
                )
                self.entries.append(har_entry)
                valid_index += 1
            except Exception as e:
                bad_entry = BadEntry(
                    raw_index=raw_index,
                    source_file=file_path,
                    bad_reason=f"解析失败: {str(e)}",
                    raw_data=entry,
                )
                self.bad_entries.append(bad_entry)

        return {
            "success": True,
            "entries": self.entries,
            "bad_entries": self.bad_entries,
            "total_entries": len(entries),
            "valid_entries": len(self.entries),
            "bad_entries_count": len(self.bad_entries),
        }

    def get_all_entries(self) -> List[HarEntry]:
        return sorted(
            self.entries + self.bad_entries, key=lambda x: x.raw_index
        )
