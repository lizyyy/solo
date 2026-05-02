from data_loader import CallDataLoader
from rule_engine import RuleEngine
from metrics import MetricsAggregator

loader = CallDataLoader()
calls = loader.load_calls('data/sample_calls.json')
calls = [loader.sort_utterances_by_time(call) for call in calls]
rules = loader.load_rules('rules/sample_rules.yaml')
words = loader.load_sensitive_words('rules/sensitive_words.txt')

print(f'Loaded {len(calls)} calls, {len(rules)} rules, {len(words)} sensitive words')

engine = RuleEngine(rules, words)
issues = engine.analyze_calls(calls)

aggregator = MetricsAggregator(issues, calls)
summary = aggregator.get_summary()

print(f'Total calls: {summary["total_calls"]}')
print(f'Total issues: {summary["total_issues"]}')
print(f'Issue types: {summary["issue_type_distribution"]}')
print(f'Severity: {summary["severity_distribution"]}')
print('\nIssues found:')
for issue in issues:
    print(f'  - [{issue.severity}] {issue.issue_type} ({issue.rule_name}): {issue.description}')
