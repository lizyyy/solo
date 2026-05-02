import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set, Tuple
from collections import defaultdict

from ..parsers.account import AccountRecord, AccountParser
from ..parsers.ldap import LDAPGroup, LDAPParser
from ..parsers.asset import AssetRecord, AssetParser
from ..parsers.sudoers import SudoersRule, SudoersParser
from ..storage.store import DataStore
from ..storage.quarantine import QuarantineManager, QuarantineItem


ORPHAN_ACCOUNT_RULE = "orphan_account"
GROUP_DRIFT_RULE = "group_drift"
SUDO_OVERREACH_RULE = "sudo_overreach"
ASSET_ENV_MISMATCH_RULE = "asset_env_mismatch"
DUPLICATE_ACCOUNT_RULE = "duplicate_account"
BAD_ROW_RULE = "bad_row"


@dataclass
class RuleResult:
    rule_id: str
    severity: str
    description: str
    affected_entity: str
    entity_type: str
    evidence: Dict[str, Any]
    remediation_suggestion: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "severity": self.severity,
            "description": self.description,
            "affected_entity": self.affected_entity,
            "entity_type": self.entity_type,
            "evidence": self.evidence,
            "remediation_suggestion": self.remediation_suggestion,
        }


class RuleEngine:
    DEFAULT_SEVERITY = {
        ORPHAN_ACCOUNT_RULE: "critical",
        GROUP_DRIFT_RULE: "high",
        SUDO_OVERREACH_RULE: "critical",
        ASSET_ENV_MISMATCH_RULE: "high",
        DUPLICATE_ACCOUNT_RULE: "medium",
        BAD_ROW_RULE: "low",
    }

    PRODUCTION_GROUPS = ["production_admin", "prod_admin", "prod_sudo", "server_admin_prod"]
    TEST_GROUPS = ["test_admin", "test_sudo", "server_admin_test"]
    DEV_GROUPS = ["dev_admin", "dev_sudo", "server_admin_dev"]

    def __init__(
        self,
        accounts: List[AccountRecord],
        ldap_groups: List[LDAPGroup],
        assets: List[AssetRecord],
        sudoers_rules: List[SudoersRule],
        account_parser: Optional[AccountParser] = None,
        asset_parser: Optional[AssetParser] = None,
        sudoers_parser: Optional[SudoersParser] = None,
        severity_config: Optional[Dict[str, str]] = None,
    ):
        self.accounts = accounts
        self.ldap_groups = ldap_groups
        self.assets = assets
        self.sudoers_rules = sudoers_rules
        self.account_parser = account_parser or AccountParser()
        self.asset_parser = asset_parser or AssetParser()
        self.sudoers_parser = sudoers_parser or SudoersParser()
        self.severity = severity_config or self.DEFAULT_SEVERITY

        self._username_to_account: Dict[str, AccountRecord] = {}
        self._group_to_members: Dict[str, Set[str]] = defaultdict(set)
        self._user_to_groups: Dict[str, List[str]] = defaultdict(list)
        self._hostname_to_asset: Dict[str, AssetRecord] = {}
        self._user_to_sudo_rules: Dict[str, List[SudoersRule]] = defaultdict(list)

        self._build_indices()

    def _build_indices(self) -> None:
        for account in self.accounts:
            if account.username:
                self._username_to_account[account.username.lower()] = account

        for group in self.ldap_groups:
            group_name_lower = group.group_name.lower()
            for member in group.members:
                self._group_to_members[group_name_lower].add(member.lower())
                self._user_to_groups[member.lower()].append(group.group_name)

        for asset in self.assets:
            if asset.hostname:
                self._hostname_to_asset[asset.hostname.lower()] = asset

        for rule in self.sudoers_rules:
            if rule.user:
                user_lower = rule.user.lower()
                if user_lower.startswith("%"):
                    user_lower = user_lower[1:]
                self._user_to_sudo_rules[user_lower].append(rule)

    def check_all(self, enabled_rules: Optional[List[str]] = None) -> List[RuleResult]:
        all_results: List[RuleResult] = []

        if enabled_rules is None:
            enabled_rules = [
                ORPHAN_ACCOUNT_RULE,
                GROUP_DRIFT_RULE,
                SUDO_OVERREACH_RULE,
                ASSET_ENV_MISMATCH_RULE,
                DUPLICATE_ACCOUNT_RULE,
                BAD_ROW_RULE,
            ]

        if ORPHAN_ACCOUNT_RULE in enabled_rules:
            all_results.extend(self.check_orphan_accounts())

        if GROUP_DRIFT_RULE in enabled_rules:
            all_results.extend(self.check_group_drift())

        if SUDO_OVERREACH_RULE in enabled_rules:
            all_results.extend(self.check_sudo_overreach())

        if ASSET_ENV_MISMATCH_RULE in enabled_rules:
            all_results.extend(self.check_asset_env_mismatch())

        if DUPLICATE_ACCOUNT_RULE in enabled_rules:
            all_results.extend(self.check_duplicate_accounts())

        if BAD_ROW_RULE in enabled_rules:
            all_results.extend(self.check_bad_rows())

        return all_results

    def check_orphan_accounts(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        inactive_users: Set[str] = set()
        for account in self.accounts:
            if self.account_parser.is_inactive_status(account.status):
                inactive_users.add(account.username.lower())

        for user_lower in inactive_users:
            in_ldap = user_lower in self._user_to_groups
            in_sudo = user_lower in self._user_to_sudo_rules

            if in_ldap or in_sudo:
                groups = self._user_to_groups.get(user_lower, [])
                sudo_rules = self._user_to_sudo_rules.get(user_lower, [])

                account = self._username_to_account.get(user_lower)
                original_username = account.username if account else user_lower

                results.append(RuleResult(
                    rule_id=ORPHAN_ACCOUNT_RULE,
                    severity=self.severity.get(ORPHAN_ACCOUNT_RULE, "critical"),
                    description=f"Inactive/terminated user '{original_username}' still has active permissions",
                    affected_entity=original_username,
                    entity_type="user",
                    evidence={
                        "status": account.status if account else "inactive",
                        "in_ldap_groups": groups,
                        "in_sudo_rules_count": len(sudo_rules),
                        "sudo_rules": [r.to_dict() for r in sudo_rules],
                    },
                    remediation_suggestion=f"Remove user '{original_username}' from LDAP groups {groups} and revoke sudo permissions",
                ))

        return results

    def check_group_drift(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        production_groups_lower = [g.lower() for g in self.PRODUCTION_GROUPS]
        test_groups_lower = [g.lower() for g in self.TEST_GROUPS]

        for account in self.accounts:
            if not self.account_parser.is_active_status(account.status):
                continue

            username_lower = account.username.lower()
            user_groups = self._user_to_groups.get(username_lower, [])
            user_groups_lower = [g.lower() for g in user_groups]

            dept = account.department.lower() if account.department else ""
            is_test_dept = "test" in dept or "qa" in dept
            is_dev_dept = "dev" in dept or "develop" in dept
            is_prod_dept = "prod" in dept or "ops" in dept or "运维" in dept

            in_production_group = any(pg in user_groups_lower for pg in production_groups_lower)
            in_test_group = any(tg in user_groups_lower for tg in test_groups_lower)

            if is_test_dept and in_production_group:
                prod_groups_actual = [
                    g for g in user_groups
                    if any(pg in g.lower() for pg in production_groups_lower)
                ]
                results.append(RuleResult(
                    rule_id=GROUP_DRIFT_RULE,
                    severity=self.severity.get(GROUP_DRIFT_RULE, "high"),
                    description=f"Test/QA department user '{account.username}' in production admin groups",
                    affected_entity=account.username,
                    entity_type="user",
                    evidence={
                        "department": account.department,
                        "groups": user_groups,
                        "production_groups": prod_groups_actual,
                        "expected_groups_type": "test/qa only",
                    },
                    remediation_suggestion=f"Remove '{account.username}' from production groups {prod_groups_actual}",
                ))

            if is_prod_dept and in_test_group and not in_production_group:
                test_groups_actual = [
                    g for g in user_groups
                    if any(tg in g.lower() for tg in test_groups_lower)
                ]
                results.append(RuleResult(
                    rule_id=GROUP_DRIFT_RULE,
                    severity=self.severity.get(GROUP_DRIFT_RULE, "high"),
                    description=f"Production/Ops department user '{account.username}' only in test groups",
                    affected_entity=account.username,
                    entity_type="user",
                    evidence={
                        "department": account.department,
                        "groups": user_groups,
                        "test_groups": test_groups_actual,
                        "expected_groups_type": "production access expected",
                    },
                    remediation_suggestion=f"Check if '{account.username}' needs production group access instead of test groups",
                ))

        return results

    def check_sudo_overreach(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        for rule in self.sudoers_rules:
            issues: List[str] = []
            evidence_details: Dict[str, Any] = {}

            if self.sudoers_parser.is_forbidden_user(rule.user):
                issues.append(f"Forbidden user '{rule.user}' in sudo rule")
                evidence_details["forbidden_user"] = rule.user

            if self.sudoers_parser.has_all_command(rule.commands):
                issues.append("ALL command access is dangerous")
                evidence_details["has_all_command"] = True

            for cmd in rule.commands:
                if self.sudoers_parser.is_forbidden_command(cmd):
                    issues.append(f"Forbidden command: {cmd}")
                    evidence_details.setdefault("forbidden_commands", []).append(cmd)

            if rule.nopasswd:
                issues.append("NOPASSWD flag enables passwordless sudo")
                evidence_details["has_nopasswd"] = True

            if issues:
                user_display = rule.user
                if rule.user.startswith("%"):
                    user_display = f"Group {rule.user[1:]}"

                results.append(RuleResult(
                    rule_id=SUDO_OVERREACH_RULE,
                    severity=self.severity.get(SUDO_OVERREACH_RULE, "critical"),
                    description=f"Sudo rule for {user_display} has dangerous configurations: {', '.join(issues)}",
                    affected_entity=rule.user,
                    entity_type="sudo_rule",
                    evidence={
                        "rule": rule.to_dict(),
                        "issues": issues,
                        "details": evidence_details,
                    },
                    remediation_suggestion=f"Review and restrict sudo rule for {user_display}. Remove ALL, forbidden commands, and NOPASSWD if not necessary",
                ))

        return results

    def check_asset_env_mismatch(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        test_users: Set[str] = set()
        test_groups_lower = [g.lower() for g in self.TEST_GROUPS]

        for account in self.accounts:
            username_lower = account.username.lower()
            user_groups = self._user_to_groups.get(username_lower, [])
            user_groups_lower = [g.lower() for g in user_groups]

            in_test_group = any(tg in user_groups_lower for tg in test_groups_lower)
            dept = account.department.lower() if account.department else ""
            is_test_dept = "test" in dept or "qa" in dept

            if in_test_group or is_test_dept:
                test_users.add(username_lower)

        for user_lower in test_users:
            sudo_rules = self._user_to_sudo_rules.get(user_lower, [])

            for rule in sudo_rules:
                host = rule.host.lower()

                if host == "all":
                    account = self._username_to_account.get(user_lower)
                    username = account.username if account else user_lower

                    results.append(RuleResult(
                        rule_id=ASSET_ENV_MISMATCH_RULE,
                        severity=self.severity.get(ASSET_ENV_MISMATCH_RULE, "high"),
                        description=f"Test user '{username}' has sudo access on ALL hosts",
                        affected_entity=username,
                        entity_type="user",
                        evidence={
                            "user_type": "test/qa",
                            "sudo_host": "ALL",
                            "rule": rule.to_dict(),
                        },
                        remediation_suggestion=f"Restrict '{username}' sudo access to test environment hosts only",
                    ))
                else:
                    asset = self._hostname_to_asset.get(host)
                    if asset and self.asset_parser.is_production_env(asset.environment):
                        account = self._username_to_account.get(user_lower)
                        username = account.username if account else user_lower

                        results.append(RuleResult(
                            rule_id=ASSET_ENV_MISMATCH_RULE,
                            severity=self.severity.get(ASSET_ENV_MISMATCH_RULE, "high"),
                            description=f"Test user '{username}' has sudo access on production host '{asset.hostname}'",
                            affected_entity=username,
                            entity_type="user",
                            evidence={
                                "user_type": "test/qa",
                                "production_host": asset.hostname,
                                "host_environment": asset.environment,
                                "rule": rule.to_dict(),
                            },
                            remediation_suggestion=f"Remove '{username}' sudo access from production host '{asset.hostname}'",
                        ))

        return results

    def check_duplicate_accounts(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        username_counts: Dict[str, List[AccountRecord]] = defaultdict(list)
        for account in self.accounts:
            if account.username:
                username_counts[account.username.lower()].append(account)

        for username_lower, accounts in username_counts.items():
            if len(accounts) > 1:
                original_username = accounts[0].username
                rows = [f"{a.source_file}:{a.row_number}" for a in accounts]
                statuses = [a.status for a in accounts]

                results.append(RuleResult(
                    rule_id=DUPLICATE_ACCOUNT_RULE,
                    severity=self.severity.get(DUPLICATE_ACCOUNT_RULE, "medium"),
                    description=f"Duplicate account entries for '{original_username}'",
                    affected_entity=original_username,
                    entity_type="user",
                    evidence={
                        "count": len(accounts),
                        "rows": rows,
                        "statuses": statuses,
                        "details": [a.to_dict() for a in accounts],
                    },
                    remediation_suggestion=f"Deduplicate entries for '{original_username}', keep only the authoritative record",
                ))

        return results

    def check_bad_rows(self) -> List[RuleResult]:
        results: List[RuleResult] = []

        for account in self.accounts:
            if not account.is_valid:
                results.append(RuleResult(
                    rule_id=BAD_ROW_RULE,
                    severity=self.severity.get(BAD_ROW_RULE, "low"),
                    description=f"Invalid account row at {account.source_file}:{account.row_number}",
                    affected_entity=f"{account.source_file}:{account.row_number}",
                    entity_type="data_row",
                    evidence={
                        "file": account.source_file,
                        "row": account.row_number,
                        "errors": account.validation_errors,
                        "raw_data": account.raw_row,
                    },
                    remediation_suggestion="Fix or remove invalid data row",
                ))

        for rule in self.sudoers_rules:
            if not rule.is_valid:
                results.append(RuleResult(
                    rule_id=BAD_ROW_RULE,
                    severity=self.severity.get(BAD_ROW_RULE, "low"),
                    description=f"Invalid sudoers rule at {rule.source_file}:{rule.line_number}",
                    affected_entity=f"{rule.source_file}:{rule.line_number}",
                    entity_type="data_row",
                    evidence={
                        "file": rule.source_file,
                        "line": rule.line_number,
                        "errors": rule.validation_errors,
                        "raw_line": rule.raw_line,
                    },
                    remediation_suggestion="Fix invalid sudoers rule syntax",
                ))

        return results

    def to_quarantine_items(self, results: List[RuleResult]) -> List[QuarantineItem]:
        items: List[QuarantineItem] = []
        for result in results:
            item = QuarantineItem(
                rule_id=result.rule_id,
                severity=result.severity,
                category=QuarantineManager.RULE_TO_CATEGORY.get(result.rule_id, "unknown"),
                description=result.description,
                affected_entity=result.affected_entity,
                entity_type=result.entity_type,
                evidence=result.evidence,
                remediation_plan={
                    "suggestion": result.remediation_suggestion,
                },
            )
            items.append(item)
        return items
