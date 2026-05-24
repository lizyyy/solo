from __future__ import annotations

import csv
import re
from datetime import timedelta
from pathlib import Path
from typing import List, Optional, Tuple

import yaml

from .models import Team, Topic


class RetentionParser:
    _UNIT_PATTERNS = {
        "ms": (1 / 1000, re.compile(r"^(\d+(?:\.\d+)?)\s*(ms|milliseconds?)$", re.I)),
        "s": (1, re.compile(r"^(\d+(?:\.\d+)?)\s*(s|sec|seconds?)$", re.I)),
        "m": (60, re.compile(r"^(\d+(?:\.\d+)?)\s*(m|min|minutes?)$", re.I)),
        "h": (3600, re.compile(r"^(\d+(?:\.\d+)?)\s*(h|hr|hours?)$", re.I)),
        "d": (86400, re.compile(r"^(\d+(?:\.\d+)?)\s*(d|days?)$", re.I)),
        "w": (604800, re.compile(r"^(\d+(?:\.\d+)?)\s*(w|weeks?)$", re.I)),
    }

    @classmethod
    def parse(cls, value: str | int | float) -> timedelta:
        if isinstance(value, (int, float)):
            return timedelta(milliseconds=int(value))

        value_str = str(value).strip()

        if value_str.isdigit():
            return timedelta(milliseconds=int(value_str))

        for unit, (multiplier, pattern) in cls._UNIT_PATTERNS.items():
            match = pattern.match(value_str)
            if match:
                num_value = float(match.group(1))
                return timedelta(seconds=num_value * multiplier)

        raise ValueError(f"无法解析 retention 值: {value}")

    @classmethod
    def format(cls, td: timedelta, unit: str = "d") -> str:
        seconds = td.total_seconds()
        if unit == "ms":
            return f"{int(seconds * 1000)}ms"
        elif unit == "s":
            return f"{int(seconds)}s"
        elif unit == "m":
            return f"{int(seconds / 60)}m"
        elif unit == "h":
            return f"{int(seconds / 3600)}h"
        elif unit == "d":
            days = seconds / 86400
            if days.is_integer():
                return f"{int(days)}d"
            return f"{days:.1f}d"
        return str(td)


class TopicParser:
    @classmethod
    def parse_csv(cls, file_path: Path) -> List[Topic]:
        topics = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                topic = cls._parse_row(row)
                topics.append(topic)
        return topics

    @classmethod
    def parse_yaml(cls, file_path: Path) -> List[Topic]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        topics = []
        topics_data = data.get("topics", [data] if "name" in data else data)

        for item in topics_data:
            topic = cls._parse_dict(item)
            topics.append(topic)
        return topics

    @classmethod
    def parse_auto(cls, file_path: Path) -> List[Topic]:
        suffix = file_path.suffix.lower()
        if suffix in (".yaml", ".yml"):
            return cls.parse_yaml(file_path)
        elif suffix == ".csv":
            return cls.parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    @classmethod
    def _parse_row(cls, row: dict) -> Topic:
        name = row.get("topic") or row.get("name") or row.get("Topic")
        if not name:
            raise ValueError(f"缺少 topic 名称: {row}")

        partitions = int(row.get("partitions") or row.get("Partitions") or 6)
        retention_str = row.get("retention") or row.get("Retention") or "7d"
        retention = RetentionParser.parse(retention_str)

        team_hint = row.get("team") or row.get("Team") or None
        owner_hint = row.get("owner") or row.get("Owner") or None

        return Topic(
            name=name.strip(),
            partitions=partitions,
            retention=retention,
            team_hint=team_hint.strip() if team_hint else None,
            owner_hint=owner_hint.strip() if owner_hint else None,
        )

    @classmethod
    def _parse_dict(cls, data: dict) -> Topic:
        name = data.get("name") or data.get("topic")
        if not name:
            raise ValueError(f"缺少 topic 名称: {data}")

        partitions = int(data.get("partitions", 6))
        retention_str = data.get("retention", "7d")
        retention = RetentionParser.parse(retention_str)

        return Topic(
            name=name.strip(),
            partitions=partitions,
            retention=retention,
            team_hint=data.get("team"),
            owner_hint=data.get("owner"),
        )


class TeamParser:
    @classmethod
    def parse_yaml(cls, file_path: Path) -> List[Team]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        teams = []
        teams_data = data.get("teams", [data] if "name" in data else data)

        for item in teams_data:
            team = cls._parse_team(item)
            teams.append(team)
        return teams

    @classmethod
    def parse_csv(cls, file_path: Path) -> List[Team]:
        teams = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                team = cls._parse_row(row)
                teams.append(team)
        return teams

    @classmethod
    def parse_auto(cls, file_path: Path) -> List[Team]:
        suffix = file_path.suffix.lower()
        if suffix in (".yaml", ".yml"):
            return cls.parse_yaml(file_path)
        elif suffix == ".csv":
            return cls.parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    @classmethod
    def _parse_team(cls, data: dict) -> Team:
        name = data.get("name")
        if not name:
            raise ValueError(f"缺少团队名称: {data}")

        default_retention_str = data.get("default_retention", "7d")
        default_retention = RetentionParser.parse(default_retention_str)

        max_retention_str = data.get("max_retention", "30d")
        max_retention = RetentionParser.parse(max_retention_str)

        return Team(
            name=name.strip(),
            aliases=[a.strip() for a in data.get("aliases", [])],
            owners=[o.strip() for o in data.get("owners", [])],
            topic_prefixes=[p.strip() for p in data.get("topic_prefixes", [])],
            default_partitions=int(data.get("default_partitions", 6)),
            default_retention=default_retention,
            max_partitions_per_topic=int(data.get("max_partitions_per_topic", 24)),
            max_total_partitions=int(data.get("max_total_partitions", 1000)),
            max_retention=max_retention,
        )

    @classmethod
    def _parse_row(cls, row: dict) -> Team:
        name = row.get("name") or row.get("team")
        if not name:
            raise ValueError(f"缺少团队名称: {row}")

        aliases_str = row.get("aliases", "")
        aliases = [a.strip() for a in aliases_str.split(",") if a.strip()] if aliases_str else []

        owners_str = row.get("owners", "")
        owners = [o.strip() for o in owners_str.split(",") if o.strip()] if owners_str else []

        prefixes_str = row.get("topic_prefixes", "")
        prefixes = [p.strip() for p in prefixes_str.split(",") if p.strip()] if prefixes_str else []

        default_retention_str = row.get("default_retention") or "7d"
        default_retention = RetentionParser.parse(default_retention_str)

        max_retention_str = row.get("max_retention") or "30d"
        max_retention = RetentionParser.parse(max_retention_str)

        return Team(
            name=name.strip(),
            aliases=aliases,
            owners=owners,
            topic_prefixes=prefixes,
            default_partitions=int(row.get("default_partitions") or 6),
            default_retention=default_retention,
            max_partitions_per_topic=int(row.get("max_partitions_per_topic") or 24),
            max_total_partitions=int(row.get("max_total_partitions") or 1000),
            max_retention=max_retention,
        )


class InputValidator:
    @classmethod
    def validate_topics(cls, topics: List[Topic]) -> Tuple[bool, List[str]]:
        errors = []
        seen_names = set()

        for topic in topics:
            if not topic.name:
                errors.append("存在空的 topic 名称")
                continue

            if topic.name in seen_names:
                errors.append(f"Topic 名称重复: {topic.name}")
            seen_names.add(topic.name)

            if topic.partitions <= 0:
                errors.append(f"Topic {topic.name} 分区数必须为正数: {topic.partitions}")
            elif topic.partitions > 1000:
                errors.append(f"Topic {topic.name} 分区数过大: {topic.partitions}")

            if topic.retention.total_seconds() <= 0:
                errors.append(f"Topic {topic.name} 保留时间必须为正数")

        return len(errors) == 0, errors

    @classmethod
    def validate_teams(cls, teams: List[Team]) -> Tuple[bool, List[str]]:
        errors = []
        seen_names = set()
        seen_aliases = set()

        for team in teams:
            if not team.name:
                errors.append("存在空的团队名称")
                continue

            if team.name in seen_names:
                errors.append(f"团队名称重复: {team.name}")
            seen_names.add(team.name)

            for alias in team.aliases:
                if alias.lower() in seen_aliases:
                    errors.append(f"团队别名重复: {alias}")
                seen_aliases.add(alias.lower())

            if not team.topic_prefixes:
                errors.append(f"团队 {team.name} 没有配置 topic 前缀")

            if team.max_total_partitions <= 0:
                errors.append(f"团队 {team.name} 最大总分区数必须为正数")

            if team.default_partitions > team.max_partitions_per_topic:
                errors.append(f"团队 {team.name} 默认分区数大于单topic最大限制")

        return len(errors) == 0, errors
