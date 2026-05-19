from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

from .models import Silence, Alert, MatchResult, RiskLevel, RISK_LEVELS


class ExpiryChecker:
    def __init__(self, reference_time: Optional[datetime] = None):
        self.reference_time = reference_time or datetime.now()

    def is_expired(self, silence: Silence) -> bool:
        if not silence.ends_at:
            return False
        return silence.ends_at < self.reference_time

    def is_expiring_soon(self, silence: Silence, hours: int = 24) -> bool:
        if not silence.ends_at:
            return False
        threshold = self.reference_time + timedelta(hours=hours)
        return self.reference_time < silence.ends_at <= threshold

    def get_expiry_status(self, silence: Silence) -> Dict[str, Any]:
        if not silence.ends_at:
            return {
                "status": "unknown",
                "days_remaining": None,
                "hours_remaining": None,
            }

        delta = silence.ends_at - self.reference_time
        total_seconds = delta.total_seconds()

        if total_seconds < 0:
            status = "expired"
        elif total_seconds < 24 * 3600:
            status = "expiring_soon"
        elif total_seconds < 7 * 24 * 3600:
            status = "expiring_this_week"
        else:
            status = "active"

        return {
            "status": status,
            "days_remaining": delta.days,
            "hours_remaining": int(total_seconds / 3600),
            "expires_at": silence.ends_at,
        }


class HitStatistics:
    def __init__(self):
        self.hit_counts: Dict[str, int] = defaultdict(int)
        self.no_hit_silences: List[Silence] = []
        self.high_hit_silences: List[tuple] = []

    def calculate(self, match_results: List[MatchResult],
                  high_hit_threshold: int = 10) -> Dict[str, Any]:
        self.hit_counts.clear()
        self.no_hit_silences = []
        self.high_hit_silences = []

        total_hits = 0
        for result in match_results:
            hit_count = len(result.matched_alerts)
            self.hit_counts[result.silence.id] = hit_count
            total_hits += hit_count

            if hit_count == 0:
                self.no_hit_silences.append(result.silence)
            elif hit_count >= high_hit_threshold:
                self.high_hit_silences.append((result.silence, hit_count))

        return {
            "total_silences": len(match_results),
            "total_hits": total_hits,
            "average_hits_per_silence": total_hits / len(match_results) if match_results else 0,
            "no_hit_count": len(self.no_hit_silences),
            "high_hit_count": len(self.high_hit_silences),
            "hit_distribution": dict(sorted(self.hit_counts.items())),
        }


class RiskAssessor:
    def __init__(self, reference_time: Optional[datetime] = None):
        self.expiry_checker = ExpiryChecker(reference_time)
        self.hit_statistics = HitStatistics()
        self.assessment_results: Dict[str, Dict[str, Any]] = {}

    def assess_silence(self, silence: Silence,
                       match_result: Optional[MatchResult] = None) -> RiskLevel:
        score = 0
        reasons = []

        hit_count = len(match_result.matched_alerts) if match_result else 0

        if self.expiry_checker.is_expired(silence):
            score += 50
            reasons.append("silence already expired")
        elif self.expiry_checker.is_expiring_soon(silence, hours=24):
            score += 25
            reasons.append("silence expiring within 24h")

        if hit_count == 0:
            score += 30
            reasons.append("no alerts matched")
        elif hit_count >= 20:
            score += 40
            reasons.append(f"high hit count ({hit_count} alerts)")
        elif hit_count >= 10:
            score += 20
            reasons.append(f"moderate hit count ({hit_count} alerts)")

        if not silence.created_by or silence.created_by.lower() in ["unknown", ""]:
            score += 20
            reasons.append("no creator specified")

        if not silence.comment or len(silence.comment.strip()) < 5:
            score += 15
            reasons.append("no meaningful comment")

        has_severity_matcher = any(
            m.name.lower() == "severity" for m in silence.matchers
        )
        if not has_severity_matcher and len(silence.matchers) > 0:
            score += 10
            reasons.append("no severity label in matchers (risk of broad matching)")

        has_wildcard = any(
            m.is_regex and m.value in [".*", ".+", "^.*$"]
            for m in silence.matchers
        )
        if has_wildcard:
            score += 35
            reasons.append("wildcard regex matcher detected (high risk)")

        if len(silence.matchers) == 1:
            score += 10
            reasons.append("only one matcher (broad matching risk)")

        if score >= 100:
            level = "CRITICAL"
        elif score >= 75:
            level = "HIGH"
        elif score >= 50:
            level = "MEDIUM"
        elif score >= 25:
            level = "LOW"
        else:
            level = "INFO"

        result = RiskLevel(
            level=level,
            score=min(score, 100),
            reason="; ".join(reasons) if reasons else "no risks detected",
        )

        self.assessment_results[silence.id] = {
            "silence": silence,
            "risk_level": result,
            "hit_count": hit_count,
            "expiry_status": self.expiry_checker.get_expiry_status(silence),
        }

        return result

    def assess_all(self, match_results: List[MatchResult]) -> Dict[str, Any]:
        stats = self.hit_statistics.calculate(match_results)

        risk_counts: Dict[str, int] = defaultdict(int)
        high_risk_silences = []

        for result in match_results:
            risk = self.assess_silence(result.silence, result)
            risk_counts[risk.level] += 1

            if risk.level in ["CRITICAL", "HIGH"]:
                high_risk_silences.append({
                    "silence": result.silence,
                    "risk_level": risk,
                    "hit_count": len(result.matched_alerts),
                })

        high_risk_silences.sort(key=lambda x: x["risk_level"].score, reverse=True)

        return {
            "statistics": stats,
            "risk_distribution": dict(sorted(risk_counts.items())),
            "high_risk_count": len(high_risk_silences),
            "high_risk_silences": high_risk_silences,
            "creator_risk_summary": self._get_creator_risk_summary(),
        }

    def _get_creator_risk_summary(self) -> Dict[str, Dict[str, Any]]:
        creator_risks: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "critical_high_count": 0, "total_score": 0}
        )

        for result in self.assessment_results.values():
            creator = result["silence"].created_by or "unknown"
            risk = result["risk_level"]
            creator_risks[creator]["count"] += 1
            creator_risks[creator]["total_score"] += risk.score
            if risk.level in ["CRITICAL", "HIGH"]:
                creator_risks[creator]["critical_high_count"] += 1

        for creator in creator_risks:
            creator_risks[creator]["avg_score"] = (
                creator_risks[creator]["total_score"] / creator_risks[creator]["count"]
            )

        return dict(sorted(creator_risks.items()))
