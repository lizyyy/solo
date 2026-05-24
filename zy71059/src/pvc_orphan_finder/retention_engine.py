from typing import List, Dict, Optional
from datetime import datetime, timedelta
import fnmatch

from dateutil import parser as date_parser

from .models import K8sResource, RetentionRule


class RetentionEngine:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.retention_label = self.config.get('retention_label', 'pvc-orphan/retention-policy')
        self.expiry_label = self.config.get('expiry_label', 'pvc-orphan/expires-at')
        self.protected_namespaces = self.config.get('protected_namespaces', [
            'kube-system',
            'kube-public',
            'kube-node-lease',
        ])
        self.protected_labels = self.config.get('protected_labels', [
            'app.kubernetes.io/name',
            'app',
        ])
        self.default_retention_days = self.config.get('default_retention_days', 30)

    def check_retention(self, pvc: K8sResource) -> List[RetentionRule]:
        rules = []

        rules.extend(self._check_namespace_protection(pvc))
        rules.extend(self._check_retention_labels(pvc))
        rules.extend(self._check_protected_labels(pvc))
        rules.extend(self._check_annotations(pvc))

        return rules

    def _check_namespace_protection(self, pvc: K8sResource) -> List[RetentionRule]:
        rules = []

        for pattern in self.protected_namespaces:
            if fnmatch.fnmatch(pvc.namespace, pattern):
                rules.append(RetentionRule(
                    rule_type='namespace-protection',
                    description=f"Namespace '{pvc.namespace}' matches protected pattern '{pattern}'",
                    is_active=True
                ))

        return rules

    def _check_retention_labels(self, pvc: K8sResource) -> List[RetentionRule]:
        rules = []

        for key, value in pvc.labels.items():
            if key == self.retention_label:
                if value.lower() == 'retain':
                    rules.append(RetentionRule(
                        rule_type='retention-label',
                        description=f"PVC has retention label '{key}={value}'",
                        is_active=True
                    ))
                elif value.lower() == 'delete':
                    rules.append(RetentionRule(
                        rule_type='retention-label',
                        description=f"PVC marked for deletion: '{key}={value}'",
                        is_active=False
                    ))
            elif key == self.expiry_label:
                try:
                    expiry_date = date_parser.parse(value)
                    now = datetime.now()
                    is_expired = expiry_date < now
                    rules.append(RetentionRule(
                        rule_type='expiry-label',
                        description=f"PVC expiry label '{key}={value}'",
                        expires_at=expiry_date,
                        is_active=not is_expired
                    ))
                except Exception as e:
                    rules.append(RetentionRule(
                        rule_type='expiry-label-invalid',
                        description=f"Invalid expiry date format: '{value}'. Error: {e}",
                        is_active=False
                    ))

        return rules

    def _check_protected_labels(self, pvc: K8sResource) -> List[RetentionRule]:
        rules = []

        for label in self.protected_labels:
            if label in pvc.labels:
                rules.append(RetentionRule(
                    rule_type='protected-label',
                    description=f"PVC has protected label '{label}={pvc.labels[label]}'",
                    is_active=True
                ))

        return rules

    def _check_annotations(self, pvc: K8sResource) -> List[RetentionRule]:
        rules = []

        pv_name = pvc.spec.get('volumeName', '')
        if pv_name:
            rules.append(RetentionRule(
                rule_type='bound-pv',
                description=f"PVC is bound to PersistentVolume '{pv_name}'",
                is_active=False
            ))

        storage_class = pvc.spec.get('storageClassName')
        if storage_class:
            if 'retain' in storage_class.lower():
                rules.append(RetentionRule(
                    rule_type='storage-class',
                    description=f"StorageClass '{storage_class}' suggests retention",
                    is_active=True
                ))

        for key in pvc.annotations:
            if 'retain' in key.lower():
                rules.append(RetentionRule(
                    rule_type='retention-annotation',
                    description=f"PVC has retention annotation '{key}'",
                    is_active=True
                ))

        return rules

    def should_keep(self, rules: List[RetentionRule]) -> bool:
        return any(rule.is_active for rule in rules)

    def get_active_rules(self, rules: List[RetentionRule]) -> List[RetentionRule]:
        return [r for r in rules if r.is_active]

    def get_expired_rules(self, rules: List[RetentionRule]) -> List[RetentionRule]:
        return [r for r in rules if r.expires_at and r.expires_at < datetime.now()]
