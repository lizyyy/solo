from dataclasses import dataclass
from typing import Any, Optional

from ..state_machine import SampleChain, SampleEvent


@dataclass
class Issue:
    issue_id: str
    severity: str
    category: str
    sample_id: str
    athlete_id: str
    description: str
    event_id: Optional[str] = None


class RuleEngine:
    def __init__(self, rules_config: Optional[dict[str, Any]] = None):
        self.rules_config = rules_config or {}

    def validate_chain(self, chain: SampleChain) -> list[Issue]:
        issues = []
        issues.extend(self._check_seal_consistency(chain))
        issues.extend(self._check_handover_signatures(chain))
        issues.extend(self._check_time_order(chain))
        issues.extend(self._check_ab_split(chain))
        return issues

    def _check_seal_consistency(self, chain: SampleChain) -> list[Issue]:
        issues = []
        seal_a = chain.seal_a
        seal_b = chain.seal_b

        if seal_a and seal_b and seal_a != seal_b:
            issues.append(Issue(
                issue_id="SEAL_001",
                severity="error",
                category="seal_mismatch",
                sample_id=chain.sample_id,
                athlete_id=chain.athlete_id,
                description=f"A/B瓶封签号不一致: A瓶={seal_a}, B瓶={seal_b}"
            ))
        return issues

    def _check_handover_signatures(self, chain: SampleChain) -> list[Issue]:
        issues = []
        required_signatures = self.rules_config.get('required_signatures', ['collector', 'athlete', 'chaperone', 'receiver'])

        for event in chain.events:
            if event.event_type == 'handover':
                signatures = event.details.get('signatures', {})
                missing = [r for r in required_signatures if r not in signatures]
                if missing:
                    issues.append(Issue(
                        issue_id="HAND_001",
                        severity="error",
                        category="missing_signature",
                        sample_id=chain.sample_id,
                        athlete_id=chain.athlete_id,
                        description=f"交接缺签: {', '.join(missing)}",
                        event_id=event.event_id
                    ))
        return issues

    def _check_time_order(self, chain: SampleChain) -> list[Issue]:
        issues = []
        for i in range(1, len(chain.events)):
            prev = chain.events[i - 1]
            curr = chain.events[i]
            if curr.timestamp < prev.timestamp:
                issues.append(Issue(
                    issue_id="TIME_001",
                    severity="error",
                    category="time_reversal",
                    sample_id=chain.sample_id,
                    athlete_id=chain.athlete_id,
                    description=f"时间倒挂: {prev.event_type}({prev.timestamp.isoformat()}) -> {curr.event_type}({curr.timestamp.isoformat()})",
                    event_id=curr.event_id
                ))
        return issues

    def _check_ab_split(self, chain: SampleChain) -> list[Issue]:
        issues = []
        sealing_events = [e for e in chain.events if e.event_type == 'sealing']

        bottles = {}
        for e in sealing_events:
            bottle = e.details.get('bottle')
            if bottle in ('A', 'B'):
                bottles[bottle] = e

        if 'A' in bottles and 'B' not in bottles:
            issues.append(Issue(
                issue_id="SPLIT_001",
                severity="warning",
                category="ab_split_incomplete",
                sample_id=chain.sample_id,
                athlete_id=chain.athlete_id,
                description="A瓶已密封但B瓶缺失",
                event_id=bottles['A'].event_id
            ))
        elif 'B' in bottles and 'A' not in bottles:
            issues.append(Issue(
                issue_id="SPLIT_002",
                severity="warning",
                category="ab_split_incomplete",
                sample_id=chain.sample_id,
                athlete_id=chain.athlete_id,
                description="B瓶已密封但A瓶缺失",
                event_id=bottles['B'].event_id
            ))
        return issues


def run_audit(chains: list[SampleChain], rules_config: Optional[dict[str, Any]] = None) -> list[Issue]:
    engine = RuleEngine(rules_config)
    all_issues = []
    for chain in chains:
        all_issues.extend(engine.validate_chain(chain))
    return all_issues
