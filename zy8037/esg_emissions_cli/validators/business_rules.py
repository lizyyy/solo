"""
Business rule validation
"""

from typing import List, Dict


class BusinessRuleValidator:
    def check_negative_reversals(self, adjustments: List, anomalies: List[Dict]) -> None:
        for adj in adjustments:
            if hasattr(adj, 'is_negative_reversal') and adj.is_negative_reversal():
                pass

    def check_site_aliases(self, bill_site: str, normalized_site: str, anomalies: List[Dict]) -> None:
        if bill_site.strip() != normalized_site and normalized_site is not None:
            for anom in anomalies:
                if anom.get('type') == '别名匹配' and anom.get('site') == normalized_site:
                    return
            anomalies.append({
                'type': '别名匹配',
                'site': normalized_site,
                'severity': 'info',
                'description': f"原始站点名 '{bill_site}' 已匹配到 '{normalized_site}'"
            })
