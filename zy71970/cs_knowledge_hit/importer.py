from __future__ import annotations
import csv
import json
import os
from datetime import datetime
from typing import Tuple

from .models import Conversation, KnowledgeItem, Message, ConversationSource
from .errors import get_error


class ImportResult:
    def __init__(self):
        self.conversations: list = []
        self.knowledge_items: list = []
        self.warnings: list = []
        self.errors: list = []

    def add_warning(self, msg: str):
        self.warnings.append(msg)

    def add_error(self, msg: str):
        self.errors.append(msg)

    @property
    def has_errors(self):
        return len(self.errors) > 0

    @property
    def summary(self) -> str:
        parts = []
        if self.conversations:
            parts.append(f"导入对话 {len(self.conversations)} 条")
        if self.knowledge_items:
            parts.append(f"导入知识条目 {len(self.knowledge_items)} 条")
        if self.warnings:
            parts.append(f"警告 {len(self.warnings)} 条")
        if self.errors:
            parts.append(f"错误 {len(self.errors)} 条")
        return "；".join(parts) if parts else "未导入任何数据"


class Importer:
    def __init__(self):
        self._seen_conv_ids: set = set()
        self._seen_kb_ids: set = set()

    def import_conversations(self, filepath: str) -> ImportResult:
        result = ImportResult()
        if not os.path.exists(filepath):
            result.add_error(get_error("MISSING_CONV_FILE"))
            return result

        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".csv":
            self._parse_conversations_csv(filepath, result)
        elif ext == ".json":
            self._parse_conversations_json(filepath, result)
        else:
            result.add_error(get_error("INVALID_FORMAT"))

        if not result.conversations and not result.has_errors:
            result.add_error(get_error("EMPTY_CONV"))
        return result

    def import_knowledge_base(self, filepath: str) -> ImportResult:
        result = ImportResult()
        if not os.path.exists(filepath):
            result.add_error(get_error("MISSING_KB_FILE"))
            return result

        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".csv":
            self._parse_kb_csv(filepath, result)
        elif ext == ".json":
            self._parse_kb_json(filepath, result)
        else:
            result.add_error(get_error("INVALID_FORMAT"))

        if not result.knowledge_items and not result.has_errors:
            result.add_warning(get_error("EMPTY_KB"))
        return result

    def _parse_conversations_csv(self, filepath: str, result: ImportResult):
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        conv = self._row_to_conversation(row, row_num, result)
                        if conv:
                            result.conversations.append(conv)
                    except Exception as e:
                        result.add_warning(
                            get_error("CONV_PARSE_ERROR") + f"（第 {row_num} 行：{e}）"
                        )
        except UnicodeDecodeError:
            try:
                with open(filepath, "r", encoding="gbk") as f:
                    reader = csv.DictReader(f)
                    for row_num, row in enumerate(reader, start=2):
                        try:
                            conv = self._row_to_conversation(row, row_num, result)
                            if conv:
                                result.conversations.append(conv)
                        except Exception as e:
                            result.add_warning(
                                get_error("CONV_PARSE_ERROR") + f"（第 {row_num} 行：{e}）"
                            )
            except Exception:
                result.add_error(get_error("INVALID_FORMAT"))
        except Exception:
            result.add_error(get_error("INVALID_FORMAT"))

    def _parse_conversations_json(self, filepath: str, result: ImportResult):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            result.add_error(get_error("INVALID_FORMAT"))
            return
        except Exception:
            result.add_error(get_error("INVALID_FORMAT"))
            return

        if not data:
            return

        items = data if isinstance(data, list) else data.get("conversations", data.get("data", []))
        if not isinstance(items, list):
            result.add_error(get_error("INVALID_FORMAT"))
            return

        for idx, item in enumerate(items):
            try:
                conv = self._dict_to_conversation(item, idx + 1, result)
                if conv:
                    result.conversations.append(conv)
            except Exception as e:
                result.add_warning(
                    get_error("CONV_PARSE_ERROR") + f"（第 {idx + 1} 条：{e}）"
                )

    def _row_to_conversation(self, row: dict, row_num: int, result: ImportResult) -> Conversation | None:
        conv_id = row.get("id") or row.get("conversation_id") or row.get("会话ID") or row.get("对话ID")
        if not conv_id:
            result.add_warning(get_error("MISSING_FIELD", field="对话ID") + f"（第 {row_num} 行）")
            return None

        conv_id = str(conv_id).strip()
        if conv_id in self._seen_conv_ids:
            result.add_warning(get_error("DUPLICATE_ID", id=conv_id))
            return None
        self._seen_conv_ids.add(conv_id)

        ts_str = row.get("timestamp") or row.get("时间") or row.get("创建时间") or ""
        timestamp = self._parse_datetime(ts_str) or datetime.now()

        customer_id = str(row.get("customer_id") or row.get("客户ID") or row.get("用户ID") or "unknown").strip()
        agent_id = str(row.get("agent_id") or row.get("客服ID") or row.get("坐席ID") or "unknown").strip()

        messages = []
        content = row.get("content") or row.get("消息内容") or row.get("对话内容") or ""
        role = row.get("role") or row.get("角色") or "customer"
        if content:
            messages.append(Message(role=role.strip(), content=content.strip()))

        source_str = row.get("source") or row.get("来源") or ""
        source = self._parse_source(source_str)

        manual_label = row.get("manual_label") or row.get("人工标注") or row.get("改判结果") or None

        return Conversation(
            id=conv_id,
            timestamp=timestamp,
            customer_id=customer_id,
            agent_id=agent_id,
            messages=messages,
            source=source,
            manual_label=manual_label,
            raw_data=dict(row),
        )

    def _dict_to_conversation(self, item: dict, idx: int, result: ImportResult) -> Conversation | None:
        conv_id = item.get("id") or item.get("conversation_id") or ""
        if not conv_id:
            result.add_warning(get_error("MISSING_FIELD", field="对话ID") + f"（第 {idx} 条）")
            return None

        conv_id = str(conv_id).strip()
        if conv_id in self._seen_conv_ids:
            result.add_warning(get_error("DUPLICATE_ID", id=conv_id))
            return None
        self._seen_conv_ids.add(conv_id)

        ts_str = item.get("timestamp") or item.get("time") or ""
        timestamp = self._parse_datetime(ts_str) or datetime.now()

        customer_id = str(item.get("customer_id") or "unknown").strip()
        agent_id = str(item.get("agent_id") or "unknown").strip()

        messages = []
        raw_messages = item.get("messages") or []
        if isinstance(raw_messages, list):
            for msg in raw_messages:
                if isinstance(msg, dict):
                    messages.append(Message(
                        role=str(msg.get("role", "customer")).strip(),
                        content=str(msg.get("content", "")).strip(),
                        timestamp=self._parse_datetime(msg.get("timestamp", "")),
                    ))
        else:
            content = item.get("content") or ""
            if content:
                messages.append(Message(role="customer", content=str(content).strip()))

        source = self._parse_source(item.get("source", ""))

        manual_label = item.get("manual_label") or None

        return Conversation(
            id=conv_id,
            timestamp=timestamp,
            customer_id=customer_id,
            agent_id=agent_id,
            messages=messages,
            source=source,
            manual_label=manual_label,
            raw_data=item,
        )

    def _parse_kb_csv(self, filepath: str, result: ImportResult):
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        kb = self._row_to_kb(row, row_num, result)
                        if kb:
                            result.knowledge_items.append(kb)
                    except Exception as e:
                        result.add_warning(
                            get_error("KB_PARSE_ERROR") + f"（第 {row_num} 行：{e}）"
                        )
        except UnicodeDecodeError:
            try:
                with open(filepath, "r", encoding="gbk") as f:
                    reader = csv.DictReader(f)
                    for row_num, row in enumerate(reader, start=2):
                        try:
                            kb = self._row_to_kb(row, row_num, result)
                            if kb:
                                result.knowledge_items.append(kb)
                        except Exception as e:
                            result.add_warning(
                                get_error("KB_PARSE_ERROR") + f"（第 {row_num} 行：{e}）"
                            )
            except Exception:
                result.add_error(get_error("INVALID_FORMAT"))
        except Exception:
            result.add_error(get_error("INVALID_FORMAT"))

    def _parse_kb_json(self, filepath: str, result: ImportResult):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            result.add_error(get_error("INVALID_FORMAT"))
            return
        except Exception:
            result.add_error(get_error("INVALID_FORMAT"))
            return

        if not data:
            return

        items = data if isinstance(data, list) else data.get("knowledge_base", data.get("items", data.get("data", [])))
        if not isinstance(items, list):
            result.add_error(get_error("INVALID_FORMAT"))
            return

        for idx, item in enumerate(items):
            try:
                kb = self._dict_to_kb(item, idx + 1, result)
                if kb:
                    result.knowledge_items.append(kb)
            except Exception as e:
                result.add_warning(
                    get_error("KB_PARSE_ERROR") + f"（第 {idx + 1} 条：{e}）"
                )

    def _row_to_kb(self, row: dict, row_num: int, result: ImportResult) -> KnowledgeItem | None:
        kb_id = row.get("id") or row.get("knowledge_id") or row.get("知识ID") or ""
        if not kb_id:
            result.add_warning(get_error("MISSING_FIELD", field="知识ID") + f"（第 {row_num} 行）")
            return None

        kb_id = str(kb_id).strip()
        if kb_id in self._seen_kb_ids:
            result.add_warning(get_error("DUPLICATE_ID", id=kb_id))
            return None
        self._seen_kb_ids.add(kb_id)

        title = str(row.get("title") or row.get("标题") or row.get("知识标题") or "").strip()
        content = str(row.get("content") or row.get("内容") or row.get("知识内容") or "").strip()

        keywords_str = row.get("keywords") or row.get("关键词") or ""
        keywords = [k.strip() for k in str(keywords_str).replace("，", ",").split(",") if k.strip()]

        category = str(row.get("category") or row.get("分类") or row.get("知识分类") or "").strip()
        active = str(row.get("active") or row.get("启用") or "true").strip().lower() in ("true", "1", "是", "yes")

        return KnowledgeItem(
            id=kb_id, title=title, content=content,
            keywords=keywords, category=category, active=active,
        )

    def _dict_to_kb(self, item: dict, idx: int, result: ImportResult) -> KnowledgeItem | None:
        kb_id = item.get("id") or item.get("knowledge_id") or ""
        if not kb_id:
            result.add_warning(get_error("MISSING_FIELD", field="知识ID") + f"（第 {idx} 条）")
            return None

        kb_id = str(kb_id).strip()
        if kb_id in self._seen_kb_ids:
            result.add_warning(get_error("DUPLICATE_ID", id=kb_id))
            return None
        self._seen_kb_ids.add(kb_id)

        title = str(item.get("title", "")).strip()
        content = str(item.get("content", "")).strip()
        keywords = item.get("keywords", [])
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.replace("，", ",").split(",") if k.strip()]
        category = str(item.get("category", "")).strip()
        active = item.get("active", True)
        if isinstance(active, str):
            active = active.strip().lower() in ("true", "1", "是", "yes")

        return KnowledgeItem(
            id=kb_id, title=title, content=content,
            keywords=keywords, category=category, active=active,
        )

    @staticmethod
    def _parse_datetime(ts_str: str) -> datetime | None:
        if not ts_str or not str(ts_str).strip():
            return None
        ts_str = str(ts_str).strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S+08:00",
            "%Y%m%d%H%M%S",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_source(source_str: str) -> ConversationSource:
        s = str(source_str).strip().lower()
        if s in ("missing_kb", "缺知识库", "缺库"):
            return ConversationSource.MISSING_KB
        elif s in ("duplicate_override", "重复改判", "重复人工改判"):
            return ConversationSource.DUPLICATE_OVERRIDE
        elif s in ("boundary", "边界", "边界情况"):
            return ConversationSource.BOUNDARY
        return ConversationSource.NORMAL
