from typing import List, Dict, Any
from collections import defaultdict
from rule_engine import Issue


class MetricsAggregator:
    def __init__(self, issues: List[Issue], calls: List[Dict[str, Any]]):
        self.issues = issues
        self.calls = calls
        self.call_dict = {c.get('call_id'): c for c in calls}

    def aggregate_by_agent(self) -> Dict[str, Dict[str, Any]]:
        agent_metrics = defaultdict(lambda: {
            'total_issues': 0,
            'issue_types': defaultdict(int),
            'severity_counts': defaultdict(int),
            'calls': set(),
            'issue_details': []
        })

        for issue in self.issues:
            agent_metrics[issue.agent_id]['total_issues'] += 1
            agent_metrics[issue.agent_id]['issue_types'][issue.issue_type] += 1
            agent_metrics[issue.agent_id]['severity_counts'][issue.severity] += 1
            agent_metrics[issue.agent_id]['calls'].add(issue.call_id)
            agent_metrics[issue.agent_id]['issue_details'].append({
                'call_id': issue.call_id,
                'issue_type': issue.issue_type,
                'severity': issue.severity,
                'description': issue.description,
                'rule_name': issue.rule_name
            })

        for agent_id in agent_metrics:
            agent_metrics[agent_id]['call_count'] = len(agent_metrics[agent_id]['calls'])
            agent_metrics[agent_id]['calls'] = list(agent_metrics[agent_id]['calls'])
            agent_metrics[agent_id]['issue_types'] = dict(agent_metrics[agent_id]['issue_types'])
            agent_metrics[agent_id]['severity_counts'] = dict(agent_metrics[agent_id]['severity_counts'])

        return dict(agent_metrics)

    def aggregate_by_call(self) -> Dict[str, Dict[str, Any]]:
        call_metrics = defaultdict(lambda: {
            'total_issues': 0,
            'issue_types': defaultdict(int),
            'severity_counts': defaultdict(int),
            'issues': []
        })

        for issue in self.issues:
            call_metrics[issue.call_id]['total_issues'] += 1
            call_metrics[issue.call_id]['issue_types'][issue.issue_type] += 1
            call_metrics[issue.call_id]['severity_counts'][issue.severity] += 1
            call_metrics[issue.call_id]['issues'].append({
                'issue_type': issue.issue_type,
                'severity': issue.severity,
                'description': issue.description,
                'rule_name': issue.rule_name,
                'utterance_index': issue.utterance_index
            })

        for call_id in call_metrics:
            call_metrics[call_id]['issue_types'] = dict(call_metrics[call_id]['issue_types'])
            call_metrics[call_id]['severity_counts'] = dict(call_metrics[call_id]['severity_counts'])

        return dict(call_metrics)

    def aggregate_by_issue_type(self) -> Dict[str, Dict[str, Any]]:
        type_metrics = defaultdict(lambda: {
            'total_count': 0,
            'by_severity': defaultdict(int),
            'affected_agents': set(),
            'affected_calls': set(),
            'rule_names': set()
        })

        for issue in self.issues:
            type_metrics[issue.issue_type]['total_count'] += 1
            type_metrics[issue.issue_type]['by_severity'][issue.severity] += 1
            type_metrics[issue.issue_type]['affected_agents'].add(issue.agent_id)
            type_metrics[issue.issue_type]['affected_calls'].add(issue.call_id)
            type_metrics[issue.issue_type]['rule_names'].add(issue.rule_name)

        for issue_type in type_metrics:
            type_metrics[issue_type]['affected_agents'] = list(type_metrics[issue_type]['affected_agents'])
            type_metrics[issue_type]['affected_calls'] = list(type_metrics[issue_type]['affected_calls'])
            type_metrics[issue_type]['rule_names'] = list(type_metrics[issue_type]['rule_names'])
            type_metrics[issue_type]['by_severity'] = dict(type_metrics[issue_type]['by_severity'])

        return dict(type_metrics)

    def get_summary(self) -> Dict[str, Any]:
        if not self.issues:
            return {
                'total_calls': len(self.calls),
                'total_issues': 0,
                'calls_with_issues': 0,
                'issue_type_distribution': {},
                'severity_distribution': {},
                'average_issues_per_call': 0
            }

        calls_with_issues = len(set(issue.call_id for issue in self.issues))
        severity_dist = defaultdict(int)
        type_dist = defaultdict(int)

        for issue in self.issues:
            severity_dist[issue.severity] += 1
            type_dist[issue.issue_type] += 1

        return {
            'total_calls': len(self.calls),
            'total_issues': len(self.issues),
            'calls_with_issues': calls_with_issues,
            'issue_type_distribution': dict(type_dist),
            'severity_distribution': dict(severity_dist),
            'average_issues_per_call': len(self.issues) / len(self.calls) if self.calls else 0,
            'issue_rate': calls_with_issues / len(self.calls) if self.calls else 0
        }

    def get_stage_analysis(self) -> Dict[str, Dict[str, Any]]:
        stage_metrics = defaultdict(lambda: {
            'total_issues': 0,
            'issue_types': defaultdict(int)
        })

        for issue in self.issues:
            call = self.call_dict.get(issue.call_id, {})
            utterances = call.get('utterances', [])

            if issue.utterance_index >= 0 and issue.utterance_index < len(utterances):
                total_duration = utterances[-1].get('end_time', 0) if utterances else 1
                utt_start = utterances[issue.utterance_index].get('start_time', 0)
                progress = utt_start / total_duration if total_duration > 0 else 0

                if progress < 0.2:
                    stage = 'opening'
                elif progress < 0.5:
                    stage = 'main'
                elif progress < 0.8:
                    stage = 'closing'
                else:
                    stage = 'after_closing'

                stage_metrics[stage]['total_issues'] += 1
                stage_metrics[stage]['issue_types'][issue.issue_type] += 1

        for stage in stage_metrics:
            stage_metrics[stage]['issue_types'] = dict(stage_metrics[stage]['issue_types'])

        return dict(stage_metrics)

    def get_agent_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        agent_metrics = self.aggregate_by_agent()
        leaderboard = []

        for agent_id, metrics in agent_metrics.items():
            leaderboard.append({
                'agent_id': agent_id,
                'total_issues': metrics['total_issues'],
                'call_count': metrics['call_count'],
                'issue_rate': metrics['total_issues'] / metrics['call_count'] if metrics['call_count'] > 0 else 0,
                'issue_types': metrics['issue_types'],
                'severity_counts': metrics['severity_counts']
            })

        leaderboard.sort(key=lambda x: x['total_issues'], reverse=True)
        return leaderboard[:limit]

    def get_severity_breakdown(self) -> Dict[str, Dict[str, Any]]:
        severity_breakdown = defaultdict(lambda: {
            'count': 0,
            'issue_types': defaultdict(int),
            'agents': set(),
            'calls': set()
        })

        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}

        for issue in self.issues:
            severity_breakdown[issue.severity]['count'] += 1
            severity_breakdown[issue.severity]['issue_types'][issue.issue_type] += 1
            severity_breakdown[issue.severity]['agents'].add(issue.agent_id)
            severity_breakdown[issue.severity]['calls'].add(issue.call_id)

        for severity in severity_breakdown:
            severity_breakdown[severity]['issue_types'] = dict(severity_breakdown[severity]['issue_types'])
            severity_breakdown[severity]['agents'] = list(severity_breakdown[severity]['agents'])
            severity_breakdown[severity]['calls'] = list(severity_breakdown[severity]['calls'])

        return dict(sorted(
            severity_breakdown.items(),
            key=lambda x: severity_order.get(x[0], 99)
        ))
