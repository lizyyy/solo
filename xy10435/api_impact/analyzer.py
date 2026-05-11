from typing import Dict, List, Optional
from datetime import datetime
import hashlib
import json

from .models import (
    AlertInfo,
    ApiDiff,
    CallerImpact,
    CallerInfo,
    ChangeAnalysis,
    ChangeType,
    ConfirmationStatus,
    EndpointChange,
    FieldChange,
    ManualNote,
    RiskLevel,
)


CRITICAL_CHANGES = {
    ChangeType.FIELD_REMOVED,
    ChangeType.TYPE_CHANGED,
    ChangeType.REQUIRED_ADDED,
}

HIGH_CHANGES = {
    ChangeType.ENUM_CHANGED,
}


class ImpactAnalyzer:
    def analyze(
        self,
        api_diff: ApiDiff,
        callers: List[CallerInfo],
        alerts: Optional[List[AlertInfo]] = None,
        notes: Optional[List[ManualNote]] = None,
        existing_confirmations: Optional[Dict[str, ConfirmationStatus]] = None,
    ) -> ChangeAnalysis:
        diff_id = self._generate_diff_id(api_diff)
        caller_impacts: List[CallerImpact] = []
        alerts = alerts or []
        notes = notes or []
        existing_confirmations = existing_confirmations or {}

        affected_endpoints = set()
        for ep_change in api_diff.endpoint_changes:
            affected_endpoints.add(f"{ep_change.method}:{ep_change.endpoint_path}")

        for caller in callers:
            caller_endpoints = set(caller.endpoints_called)
            overlapping = caller_endpoints & affected_endpoints

            if overlapping:
                relevant_changes = self._get_relevant_changes(
                    api_diff.endpoint_changes,
                    overlapping,
                )
                risk_level = self._calculate_risk(relevant_changes, caller)
                requires_action = self._requires_action(relevant_changes)

                caller_alerts = [
                    a for a in alerts
                    if a.service_name == caller.service_name
                ]
                caller_notes = [
                    n for n in notes
                    if n.service_name == caller.service_name
                ]

                confirmation_key = f"{diff_id}:{caller.service_name}"
                confirmation_status = existing_confirmations.get(
                    confirmation_key,
                    ConfirmationStatus.UNCONFIRMED,
                )

                caller_impacts.append(CallerImpact(
                    service_name=caller.service_name,
                    team_name=caller.team_name,
                    owner=caller.owner,
                    endpoints_affected=sorted(overlapping),
                    changes=relevant_changes,
                    risk_level=risk_level,
                    confirmation_status=confirmation_status,
                    alerts=caller_alerts,
                    notes=caller_notes,
                    requires_action=requires_action,
                ))

        return ChangeAnalysis(
            diff_id=diff_id,
            api_diff=api_diff,
            caller_impacts=caller_impacts,
            generated_at=datetime.now(),
            notes=notes,
            alerts=alerts,
        )

    def _generate_diff_id(self, api_diff: ApiDiff) -> str:
        data = {
            "api_name": api_diff.api_name,
            "old_version": api_diff.old_version,
            "new_version": api_diff.new_version,
            "endpoint_changes": [
                {
                    "path": ec.endpoint_path,
                    "method": ec.method,
                    "changes": [
                        {
                            "type": fc.change_type.value,
                            "path": fc.path,
                        }
                        for fc in ec.changes
                    ],
                }
                for ec in api_diff.endpoint_changes
            ],
        }
        content = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _get_relevant_changes(
        self,
        endpoint_changes: List[EndpointChange],
        affected_endpoint_keys: set,
    ) -> List[FieldChange]:
        relevant: List[FieldChange] = []
        for ep_change in endpoint_changes:
            key = f"{ep_change.method}:{ep_change.endpoint_path}"
            if key in affected_endpoint_keys:
                relevant.extend(ep_change.changes)
        return relevant

    def _calculate_risk(
        self,
        changes: List[FieldChange],
        caller: CallerInfo,
    ) -> RiskLevel:
        change_types = {c.change_type for c in changes}

        if change_types & CRITICAL_CHANGES:
            if caller.call_volume and caller.call_volume > 10000:
                return RiskLevel.CRITICAL
            return RiskLevel.HIGH

        if change_types & HIGH_CHANGES:
            return RiskLevel.MEDIUM

        return RiskLevel.LOW

    def _requires_action(self, changes: List[FieldChange]) -> bool:
        change_types = {c.change_type for c in changes}
        return bool(change_types & (CRITICAL_CHANGES | HIGH_CHANGES))

    def recalculate_risk(
        self,
        analysis: ChangeAnalysis,
    ) -> ChangeAnalysis:
        updated_impacts = []
        for impact in analysis.caller_impacts:
            caller_info = CallerInfo(
                service_name=impact.service_name,
                team_name=impact.team_name,
                owner=impact.owner,
                endpoints_called=impact.endpoints_affected,
                call_volume=None,
            )
            new_risk = self._calculate_risk(impact.changes, caller_info)
            requires_action = self._requires_action(impact.changes)
            impact_data = impact.model_dump()
            impact_data["risk_level"] = new_risk
            impact_data["requires_action"] = requires_action
            updated_impacts.append(CallerImpact(**impact_data))

        analysis_data = analysis.model_dump()
        analysis_data["caller_impacts"] = updated_impacts
        analysis_data["generated_at"] = datetime.now()
        return ChangeAnalysis(**analysis_data)
