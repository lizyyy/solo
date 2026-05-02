import pytest
import json
import yaml
from pathlib import Path
from data_loader import CallDataLoader
from rule_engine import RuleEngine, Issue
from metrics import MetricsAggregator
from export import MarkdownExporter, CSVExporter


class TestDataLoader:
    def test_load_calls_from_json(self, tmp_path):
        calls_data = [
            {
                "call_id": "TEST001",
                "agent_id": "AGENT001",
                "utterances": [
                    {"speaker": "agent", "text": "您好", "start_time": 0.0, "end_time": 2.0}
                ]
            }
        ]
        file_path = tmp_path / "calls.json"
        file_path.write_text(json.dumps(calls_data))

        loader = CallDataLoader()
        calls = loader.load_calls(str(file_path))

        assert len(calls) == 1
        assert calls[0]["call_id"] == "TEST001"

    def test_load_rules_from_yaml(self, tmp_path):
        rules_data = {
            "rules": [
                {"name": "开场白缺失", "type": "opening_missing", "severity": "medium"}
            ]
        }
        file_path = tmp_path / "rules.yaml"
        file_path.write_text(yaml.dump(rules_data))

        loader = CallDataLoader()
        rules = loader.load_rules(str(file_path))

        assert len(rules) > 0

    def test_load_sensitive_words(self, tmp_path):
        words_content = "敏感词1\n敏感词2\n# 注释\n敏感词3"
        file_path = tmp_path / "words.txt"
        file_path.write_text(words_content)

        loader = CallDataLoader()
        words = loader.load_sensitive_words(str(file_path))

        assert "敏感词1" in words
        assert "敏感词2" in words
        assert "敏感词3" in words
        assert "# 注释" not in words

    def test_sort_utterances_by_time(self):
        loader = CallDataLoader()
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "later", "start_time": 10.0, "end_time": 12.0},
                {"speaker": "agent", "text": "first", "start_time": 0.0, "end_time": 2.0},
                {"speaker": "agent", "text": "second", "start_time": 5.0, "end_time": 7.0}
            ]
        }

        sorted_call = loader.sort_utterances_by_time(call)

        assert sorted_call["utterances"][0]["text"] == "first"
        assert sorted_call["utterances"][1]["text"] == "second"
        assert sorted_call["utterances"][2]["text"] == "later"


class TestRuleEngine:
    def test_opening_missing_detected(self):
        rules = [
            {"name": "开场白缺失", "type": "opening_missing", "severity": "medium"}
        ]
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "customer", "text": "hello", "start_time": 0.0, "end_time": 2.0},
                {"speaker": "agent", "text": "请问有什么需要帮助的", "start_time": 2.5, "end_time": 5.0}
            ]
        }

        engine = RuleEngine(rules, [])
        issues = engine.check_opening_missing(call)

        assert len(issues) == 1
        assert issues[0].issue_type == "opening_missing"

    def test_opening_present_no_issue(self):
        rules = [
            {"name": "开场白缺失", "type": "opening_missing", "severity": "medium"}
        ]
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "您好，请问有什么需要帮助的", "start_time": 0.0, "end_time": 3.0},
                {"speaker": "customer", "text": "hello", "start_time": 3.5, "end_time": 5.0}
            ]
        }

        engine = RuleEngine(rules, [])
        issues = engine.check_opening_missing(call)

        assert len(issues) == 0

    def test_sensitive_word_detected(self):
        rules = [
            {"name": "敏感词命中", "type": "sensitive_word", "severity": "critical"}
        ]
        sensitive_words = ["退款", "服务"]
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "退款是不可能的", "start_time": 0.0, "end_time": 3.0}
            ]
        }

        engine = RuleEngine(rules, sensitive_words)
        issues = engine.check_sensitive_words(call)

        assert len(issues) >= 1
        assert any("退款" in i.description for i in issues)

    def test_long_silence_detected(self):
        rules = [
            {"name": "长时间静默", "type": "long_silence", "severity": "medium", "threshold": 30}
        ]
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "您好", "start_time": 0.0, "end_time": 2.0},
                {"speaker": "customer", "text": "hello", "start_time": 2.5, "end_time": 4.0},
                {"speaker": "agent", "text": "请稍等", "start_time": 50.0, "end_time": 52.0}
            ]
        }

        engine = RuleEngine(rules, [])
        issues = engine.check_long_silence(call)

        assert len(issues) >= 1
        assert any("long_silence" in i.issue_type for i in issues)

    def test_multiple_rules_same_utterance(self):
        rules = [
            {"name": "敏感词命中", "type": "sensitive_word", "severity": "critical"},
            {"name": "承诺时效矛盾", "type": "promise_timing_conflict", "severity": "high", "conflict_pairs": [["time", "later"]]}
        ]
        sensitive_words = ["退款", "不可能"]
        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "退款是不可能的，我们3天处理", "start_time": 0.0, "end_time": 3.0},
                {"speaker": "agent", "text": "但是可能要稍后才能完成", "start_time": 3.5, "end_time": 6.0}
            ]
        }

        engine = RuleEngine(rules, sensitive_words)
        issues = engine.analyze_call(call)

        issue_types = set(i.issue_type for i in issues)
        assert "sensitive_word" in issue_types
        assert "promise_timing_conflict" in issue_types


class TestTimeDisorder:
    def test_unsorted_utterances_get_sorted(self):
        rules = [
            {"name": "开场白缺失", "type": "opening_missing", "severity": "medium"}
        ]
        loader = CallDataLoader()

        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "second", "start_time": 10.0, "end_time": 12.0},
                {"speaker": "agent", "text": "first", "start_time": 0.0, "end_time": 2.0},
                {"speaker": "customer", "text": "third", "start_time": 5.0, "end_time": 7.0}
            ]
        }

        sorted_call = loader.sort_utterances_by_time(call)

        assert sorted_call["utterances"][0]["text"] == "first"
        assert sorted_call["utterances"][1]["text"] == "third"
        assert sorted_call["utterances"][2]["text"] == "second"

    def test_time_disorder_long_silence_detection(self):
        rules = [
            {"name": "长时间静默", "type": "long_silence", "severity": "medium", "threshold": 10}
        ]

        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "开始", "start_time": 20.0, "end_time": 22.0},
                {"speaker": "customer", "text": "中间", "start_time": 5.0, "end_time": 7.0},
                {"speaker": "agent", "text": "结束", "start_time": 40.0, "end_time": 42.0}
            ]
        }

        loader = CallDataLoader()
        sorted_call = loader.sort_utterances_by_time(call)

        engine = RuleEngine(rules, [])
        issues = engine.check_long_silence(sorted_call)

        assert len(issues) >= 1

    def test_same_utterance_multiple_rules(self):
        rules = [
            {"name": "敏感词命中", "type": "sensitive_word", "severity": "critical"},
            {"name": "承诺时效矛盾", "type": "promise_timing_conflict", "severity": "high", "conflict_pairs": [["soon", "later"]]}
        ]
        sensitive_words = ["退款"]

        call = {
            "call_id": "TEST001",
            "agent_id": "AGENT001",
            "utterances": [
                {"speaker": "agent", "text": "退款马上给您，稍后再说", "start_time": 0.0, "end_time": 3.0},
                {"speaker": "agent", "text": "好吧，之后处理", "start_time": 3.5, "end_time": 6.0}
            ]
        }

        engine = RuleEngine(rules, sensitive_words)
        issues = engine.analyze_call(call)

        issue_types = set(i.issue_type for i in issues)
        assert "sensitive_word" in issue_types
        assert "promise_timing_conflict" in issue_types


class TestMetricsAggregator:
    def test_aggregate_by_agent(self):
        issues = [
            Issue("CALL001", "AGENT001", "opening_missing", "开场白缺失", "medium", "desc"),
            Issue("CALL002", "AGENT001", "sensitive_word", "敏感词", "critical", "desc"),
            Issue("CALL003", "AGENT002", "long_silence", "静默", "medium", "desc")
        ]
        calls = [
            {"call_id": "CALL001", "agent_id": "AGENT001", "utterances": []},
            {"call_id": "CALL002", "agent_id": "AGENT001", "utterances": []},
            {"call_id": "CALL003", "agent_id": "AGENT002", "utterances": []}
        ]

        aggregator = MetricsAggregator(issues, calls)
        agent_metrics = aggregator.aggregate_by_agent()

        assert "AGENT001" in agent_metrics
        assert agent_metrics["AGENT001"]["total_issues"] == 2
        assert agent_metrics["AGENT002"]["total_issues"] == 1

    def test_aggregate_by_issue_type(self):
        issues = [
            Issue("CALL001", "AGENT001", "opening_missing", "开场白缺失", "medium", "desc"),
            Issue("CALL002", "AGENT001", "opening_missing", "开场白缺失", "medium", "desc"),
            Issue("CALL003", "AGENT002", "sensitive_word", "敏感词", "critical", "desc")
        ]
        calls = [
            {"call_id": "CALL001", "agent_id": "AGENT001", "utterances": []},
            {"call_id": "CALL002", "agent_id": "AGENT001", "utterances": []},
            {"call_id": "CALL003", "agent_id": "AGENT002", "utterances": []}
        ]

        aggregator = MetricsAggregator(issues, calls)
        type_metrics = aggregator.aggregate_by_issue_type()

        assert type_metrics["opening_missing"]["total_count"] == 2
        assert type_metrics["sensitive_word"]["total_count"] == 1


class TestExport:
    def test_markdown_export(self, tmp_path):
        issues = [
            Issue("CALL001", "AGENT001", "opening_missing", "开场白缺失", "medium", "坐席未说开场白")
        ]
        summary = {
            "total_calls": 1,
            "total_issues": 1,
            "calls_with_issues": 1,
            "issue_type_distribution": {"opening_missing": 1},
            "severity_distribution": {"medium": 1},
            "average_issues_per_call": 1.0,
            "issue_rate": 1.0
        }
        agent_metrics = {}
        call_metrics = {}

        exporter = MarkdownExporter(issues, summary, agent_metrics, call_metrics)
        report = exporter.generate_report()

        assert "客服录音质检复盘报告" in report
        assert "CALL001" in report
        assert "opening_missing" in report

    def test_csv_export(self, tmp_path):
        issues = [
            Issue("CALL001", "AGENT001", "opening_missing", "开场白缺失", "medium", "坐席未说开场白", 0, 1.5)
        ]

        exporter = CSVExporter(issues)
        csv_path = tmp_path / "test.csv"
        exporter.export(str(csv_path))

        content = csv_path.read_text()
        assert "call_id" in content
        assert "CALL001" in content
        assert "opening_missing" in content
