from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import List, Tuple

from .engine import QuotaEngine
from .models import AnomalyLevel, Team, Topic
from .parser import InputValidator, RetentionParser, TeamParser, TopicParser
from .reporter import MarkdownReporter, ReportSerializer, TerminalReporter


TEST_TEAMS_YAML = """
teams:
  - name: 数据平台
    aliases: [dp, data-platform, 数平]
    owners: [zhangsan, lisi]
    topic_prefixes: [dp., data.]
    default_partitions: 6
    default_retention: 7d
    max_partitions_per_topic: 24
    max_total_partitions: 200
    max_retention: 30d

  - name: 推荐系统
    aliases: [rec, recommend]
    owners: [wangwu]
    topic_prefixes: [rec., recommend.]
    default_partitions: 12
    default_retention: 3d
    max_partitions_per_topic: 48
    max_total_partitions: 500
    max_retention: 14d

  - name: 支付系统
    aliases: [pay, payment]
    owners: [zhaoliu]
    topic_prefixes: [pay., payment.]
    default_partitions: 6
    default_retention: 7d
    max_partitions_per_topic: 12
    max_total_partitions: 100
    max_retention: 90d
"""

TEST_TOPICS_YAML = """
topics:
  - name: dp.user.click
    partitions: 6
    retention: 7d
    owner: zhangsan

  - name: dp.user.login
    partitions: 12
    retention: 14d
    owner: lisi

  - name: rec.item.rank
    partitions: 24
    retention: 3d

  - name: rec.user.interest
    partitions: 48
    retention: 7d

  - name: pay.order.created
    partitions: 6
    retention: 60d

  - name: pay.transaction.success
    partitions: 24
    retention: 90d

  - name: unknown.topic
    partitions: 6
    retention: 7d
"""

TEST_TOPICS_CSV = """topic,partitions,retention,team,owner
dp.order.created,6,7d,数据平台,zhangsan
dp.order.cancelled,12,30d,数平,lisi
rec.user.profile,24,2d,recommend,wangwu
pay.refund.request,6,60d,payment,zhaoliu
unknown.topic,6,7d,,"""

TEST_TEAMS_CSV = """name,aliases,owners,topic_prefixes,default_partitions,default_retention,max_partitions_per_topic,max_total_partitions,max_retention
数据平台,"dp,数平","zhangsan,lisi","dp.,data.",6,7d,24,200,30d
推荐系统,"rec,recommend",wangwu,"rec.,recommend.",12,3d,48,500,14d
支付系统,"pay,payment",zhaoliu,"pay.,payment.",6,7d,12,100,90d
"""


def run_selfcheck(output_dir: Path, verbose: bool) -> Tuple[int, int, List[Tuple[str, bool, str]]]:
    results: List[Tuple[str, bool, str]] = []

    results.append(_test_retention_parser())
    results.append(_test_team_alias_matching())
    results.append(_test_yaml_parsing(output_dir))
    results.append(_test_csv_parsing(output_dir))
    results.append(_test_team_assignment())
    results.append(_test_prefix_conflict_detection())
    results.append(_test_quota_rules())
    results.append(_test_owner_merge())
    results.append(_test_report_generation(output_dir))
    results.append(_test_input_validation())
    results.append(_test_boundary_cases())
    results.append(_test_edge_case_retention_units())

    passed = sum(1 for _, success, _ in results if success)
    failed = len(results) - passed

    return passed, failed, results


def _test_retention_parser() -> Tuple[str, bool, str]:
    name = "Retention 单位解析"
    try:
        test_cases = [
            ("1d", 86400),
            ("24h", 86400),
            ("1440m", 86400),
            ("86400s", 86400),
            ("86400000ms", 86400),
            ("7 days", 604800),
            ("2weeks", 1209600),
            ("0.5d", 43200),
            (86400000, 86400),
        ]

        for input_val, expected_seconds in test_cases:
            td = RetentionParser.parse(input_val)
            if abs(td.total_seconds() - expected_seconds) > 1:
                return name, False, f"输入 {input_val}: 期望 {expected_seconds}s, 实际 {td.total_seconds()}s"

        return name, True, "所有单位转换正确"
    except Exception as e:
        return name, False, str(e)


def _test_team_alias_matching() -> Tuple[str, bool, str]:
    name = "团队别名匹配"
    try:
        team = Team(
            name="数据平台",
            aliases=["dp", "data-platform", "数平"],
            topic_prefixes=["dp."],
        )

        test_aliases = ["dp", "DP", "数平", "数据平台", "DATA-PLATFORM"]
        for alias in test_aliases:
            if not team.matches_alias(alias):
                return name, False, f"别名 '{alias}' 未匹配"

        return name, True, "大小写不敏感别名匹配正确"
    except Exception as e:
        return name, False, str(e)


def _test_yaml_parsing(output_dir: Path) -> Tuple[str, bool, str]:
    name = "YAML 格式解析"
    try:
        yaml_dir = output_dir / "yaml-test"
        yaml_dir.mkdir(exist_ok=True)

        teams_file = yaml_dir / "teams.yaml"
        teams_file.write_text(TEST_TEAMS_YAML, encoding="utf-8")

        topics_file = yaml_dir / "topics.yaml"
        topics_file.write_text(TEST_TOPICS_YAML, encoding="utf-8")

        teams = TeamParser.parse_yaml(teams_file)
        if len(teams) != 3:
            return name, False, f"期望 3 个团队，实际 {len(teams)}"

        topics = TopicParser.parse_yaml(topics_file)
        if len(topics) != 7:
            return name, False, f"期望 7 个 Topic，实际 {len(topics)}"

        engine = QuotaEngine(teams)
        report = engine.calculate(topics, {"test": "yaml"})

        if len(report.assigned_topics) != 6 or len(report.unassigned_topics) != 1:
            return name, False, "Topic 团队分配数量不正确"

        return name, True, f"YAML 解析正确: {len(teams)}团队, {len(topics)}Topic"
    except Exception as e:
        return name, False, str(e)


def _test_csv_parsing(output_dir: Path) -> Tuple[str, bool, str]:
    name = "CSV 格式解析"
    try:
        csv_dir = output_dir / "csv-test"
        csv_dir.mkdir(exist_ok=True)

        teams_file = csv_dir / "teams.csv"
        teams_file.write_text(TEST_TEAMS_CSV, encoding="utf-8")

        topics_file = csv_dir / "topics.csv"
        topics_file.write_text(TEST_TOPICS_CSV, encoding="utf-8")

        teams = TeamParser.parse_csv(teams_file)
        topics = TopicParser.parse_csv(topics_file)

        if len(teams) != 3:
            return name, False, f"期望 3 个团队，实际 {len(teams)}"

        if len(topics) != 5:
            return name, False, f"期望 5 个 Topic，实际 {len(topics)}"

        return name, True, f"CSV 解析正确: {len(teams)}团队, {len(topics)}Topic"
    except Exception as e:
        return name, False, str(e)


def _test_team_assignment() -> Tuple[str, bool, str]:
    name = "团队分配逻辑"
    try:
        teams = [
            Team(name="A", topic_prefixes=["a.", "app."]),
            Team(name="B", topic_prefixes=["app.api."]),
            Team(name="C", topic_prefixes=["c."]),
        ]

        test_cases = [
            ("a.user.event", "A"),
            ("app.api.v1", "B"),
            ("app.api.v2", "B"),
            ("app.other", "A"),
            ("c.test", "C"),
            ("unknown", None),
        ]

        engine = QuotaEngine(teams)
        topics = [Topic(name=n, partitions=6, retention=timedelta(days=7)) for n, _ in test_cases]
        engine.calculate(topics, {})

        for (topic_name, expected_team), topic in zip(test_cases, topics):
            actual = topic.assigned_team.name if topic.assigned_team else None
            if actual != expected_team:
                return name, False, f"Topic {topic_name}: 期望 {expected_team}, 实际 {actual}"

        return name, True, "最长前缀匹配正确"
    except Exception as e:
        return name, False, str(e)


def _test_prefix_conflict_detection() -> Tuple[str, bool, str]:
    name = "前缀冲突检测"
    try:
        teams = [
            Team(name="A", topic_prefixes=["common."]),
            Team(name="B", topic_prefixes=["common."]),
            Team(name="C", topic_prefixes=["c."]),
        ]

        engine = QuotaEngine(teams)
        topics = [
            Topic(name="common.event", partitions=6, retention=timedelta(days=7)),
            Topic(name="common.log", partitions=6, retention=timedelta(days=7)),
            Topic(name="c.test", partitions=6, retention=timedelta(days=7)),
        ]

        report = engine.calculate(topics, {})

        if len(report.prefix_conflicts) != 1:
            return name, False, f"期望 1 个前缀冲突，实际 {len(report.prefix_conflicts)}"

        if report.prefix_conflicts[0].prefix != "common.":
            return name, False, "冲突前缀不正确"

        return name, True, "前缀冲突检测正确"
    except Exception as e:
        return name, False, str(e)


def _test_quota_rules() -> Tuple[str, bool, str]:
    name = "配额规则校验"
    try:
        team = Team(
            name="TestTeam",
            topic_prefixes=["test."],
            default_partitions=6,
            default_retention=timedelta(days=7),
            max_partitions_per_topic=12,
            max_total_partitions=30,
            max_retention=timedelta(days=30),
        )

        topics = [
            Topic(name="test.normal", partitions=6, retention=timedelta(days=7)),
            Topic(name="test.too_many_partitions", partitions=24, retention=timedelta(days=7)),
            Topic(name="test.too_long_retention", partitions=6, retention=timedelta(days=60)),
            Topic(name="test.quota1", partitions=12, retention=timedelta(days=7)),
            Topic(name="test.quota2", partitions=12, retention=timedelta(days=7)),
        ]

        engine = QuotaEngine([team])
        report = engine.calculate(topics, {})

        summary = report.team_summaries["TestTeam"]

        if not summary.over_partition_quota:
            return name, False, f"总分区 {summary.total_partitions} 超过配额 30，应标记为超限"

        too_many_part = [t for t in topics if t.name == "test.too_many_partitions"][0]
        if not any(a.rule_name == "PARTITIONS_EXCEED_PER_TOPIC" for a in too_many_part.anomalies):
            return name, False, "分区超限未检测到 ERROR"

        too_long_ret = [t for t in topics if t.name == "test.too_long_retention"][0]
        if not any(a.rule_name == "RETENTION_EXCEED_LIMIT" for a in too_long_ret.anomalies):
            return name, False, "保留时间超限未检测到 WARNING"

        return name, True, "配额规则校验正确"
    except Exception as e:
        return name, False, str(e)


def _test_owner_merge() -> Tuple[str, bool, str]:
    name = "负责人归并"
    try:
        team = Team(
            name="Test",
            owners=["zhangsan", "lisi"],
            topic_prefixes=["test."],
        )

        topics = [
            Topic(name="test.a", partitions=6, retention=timedelta(days=7), owner_hint="zhangsan"),
            Topic(name="test.b", partitions=6, retention=timedelta(days=7), owner_hint="wangwu"),
            Topic(name="test.c", partitions=6, retention=timedelta(days=7), owner_hint="Zhaoliu"),
        ]

        engine = QuotaEngine([team])
        report = engine.calculate(topics, {})

        if len(report.owner_merge_issues) != 1:
            return name, False, f"期望 1 个归并问题，实际 {len(report.owner_merge_issues)}"

        issue = report.owner_merge_issues[0]
        if len(issue["unconfigured_owners"]) != 2:
            return name, False, "未正确识别未配置的负责人"

        return name, True, "负责人归并问题检测正确"
    except Exception as e:
        return name, False, str(e)


def _test_report_generation(output_dir: Path) -> Tuple[str, bool, str]:
    name = "报告生成"
    try:
        report_dir = output_dir / "report-test"
        report_dir.mkdir(exist_ok=True)

        teams = [
            Team(name="TestTeam", owners=["test"], topic_prefixes=["test."]),
        ]
        topics = [
            Topic(name="test.topic1", partitions=6, retention=timedelta(days=7)),
            Topic(name="test.topic2", partitions=12, retention=timedelta(days=14)),
        ]

        engine = QuotaEngine(teams)
        report = engine.calculate(topics, {"test": "data"})

        json_path = report_dir / "report.json"
        ReportSerializer.to_json(report, json_path)
        if not json_path.exists() or json_path.stat().st_size == 0:
            return name, False, "JSON 报告生成失败"

        md_path = report_dir / "report.md"
        MarkdownReporter.generate(report, md_path)
        if not md_path.exists() or md_path.stat().st_size == 0:
            return name, False, "Markdown 报告生成失败"

        return name, True, "所有报告格式生成正确"
    except Exception as e:
        return name, False, str(e)


def _test_input_validation() -> Tuple[str, bool, str]:
    name = "输入校验"
    try:
        good_topics = [Topic(name="good", partitions=6, retention=timedelta(days=7))]
        ok, errors = InputValidator.validate_topics(good_topics)
        if not ok:
            return name, False, "正确 Topic 校验失败"

        bad_topics = [
            Topic(name="dup", partitions=6, retention=timedelta(days=7)),
            Topic(name="dup", partitions=6, retention=timedelta(days=7)),
        ]
        ok, errors = InputValidator.validate_topics(bad_topics)
        if ok:
            return name, False, "重复 Topic 未检测到"

        bad_topics2 = [Topic(name="neg", partitions=-1, retention=timedelta(days=7))]
        ok, errors = InputValidator.validate_topics(bad_topics2)
        if ok:
            return name, False, "负数分区未检测到"

        good_teams = [Team(name="test", topic_prefixes=["test."])]
        ok, errors = InputValidator.validate_teams(good_teams)
        if not ok:
            return name, False, "正确团队校验失败"

        bad_teams = [Team(name="bad", topic_prefixes=[])]
        ok, errors = InputValidator.validate_teams(bad_teams)
        if ok:
            return name, False, "无前缀团队未检测到"

        return name, True, "输入校验规则正确"
    except Exception as e:
        return name, False, str(e)


def _test_boundary_cases() -> Tuple[str, bool, str]:
    name = "边界条件测试"
    try:
        team = Team(
            name="Boundary",
            topic_prefixes=["b."],
            max_partitions_per_topic=12,
            max_total_partitions=100,
        )

        topics_at_limit = [
            Topic(name="b.exact", partitions=12, retention=timedelta(days=7)),
        ]
        engine = QuotaEngine([team])
        report = engine.calculate(topics_at_limit, {})
        exact_topic = report.all_topics[0]
        if any(a.rule_name == "PARTITIONS_EXCEED_PER_TOPIC" for a in exact_topic.anomalies):
            return name, False, "刚好等于限制不应触发错误"

        topics_over = [Topic(name="b.over", partitions=13, retention=timedelta(days=7))]
        report2 = engine.calculate(topics_over, {})
        over_topic = report2.all_topics[0]
        if not any(a.rule_name == "PARTITIONS_EXCEED_PER_TOPIC" for a in over_topic.anomalies):
            return name, False, "超过限制应触发错误"

        empty_teams: List[Team] = []
        empty_engine = QuotaEngine(empty_teams)
        empty_report = empty_engine.calculate([], {})
        if len(empty_report.all_topics) != 0:
            return name, False, "空输入处理错误"

        return name, True, "边界条件处理正确"
    except Exception as e:
        return name, False, str(e)


def _test_edge_case_retention_units() -> Tuple[str, bool, str]:
    name = "极端 Retention 单位"
    try:
        edge_cases = [
            ("1 milliseconds", 0.001),
            ("1 sec", 1),
            ("1min", 60),
            ("1 hour", 3600),
            ("1 day", 86400),
            ("1 week", 604800),
            ("0.5 hours", 1800),
            ("2.5 days", 216000),
        ]

        for input_str, expected in edge_cases:
            td = RetentionParser.parse(input_str)
            if abs(td.total_seconds() - expected) > 0.001:
                return name, False, f"'{input_str}' 解析错误"

        formatted = RetentionParser.format(timedelta(days=1.5), "d")
        if formatted != "1.5d":
            return name, False, f"格式化错误: {formatted}"

        formatted_int = RetentionParser.format(timedelta(days=7), "d")
        if formatted_int != "7d":
            return name, False, f"整数格式化错误: {formatted_int}"

        return name, True, "各种单位格式处理正确"
    except Exception as e:
        return name, False, str(e)
