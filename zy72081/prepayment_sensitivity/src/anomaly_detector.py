from typing import Dict, List, Tuple
from .models import LoanSample, AnomalyFlag


class AnomalyDetector:
    def __init__(self):
        self.field_rules = {
            "principal": {
                "type": "range",
                "min": 10000,
                "max": 2000000,
                "expected_range": "10,000 - 2,000,000",
                "severity": "critical",
                "description": "贷款本金应在合理范围内",
            },
            "interest_rate": {
                "type": "range",
                "min": 0.5,
                "max": 15.0,
                "expected_range": "0.5% - 15.0%",
                "severity": "critical",
                "description": "利率应在合理范围内",
            },
            "remaining_term": {
                "type": "range",
                "min": 1,
                "max": 360,
                "expected_range": "1 - 360个月",
                "severity": "critical",
                "description": "剩余期限应在1-360个月之间",
            },
            "borrower_age": {
                "type": "range",
                "min": 18,
                "max": 100,
                "expected_range": "18 - 100岁",
                "severity": "warning",
                "description": "借款人年龄应在合理范围内",
            },
            "fico_score": {
                "type": "range",
                "min": 300,
                "max": 850,
                "expected_range": "300 - 850",
                "severity": "critical",
                "description": "FICO评分应在300-850之间",
            },
            "dti_ratio": {
                "type": "range",
                "min": 0,
                "max": 80,
                "expected_range": "0 - 80%",
                "severity": "warning",
                "description": "DTI比率通常不超过80%",
            },
            "ltv_ratio": {
                "type": "range",
                "min": 0,
                "max": 125,
                "expected_range": "0 - 125%",
                "severity": "warning",
                "description": "LTV比率通常不超过125%",
            },
        }

    def detect_sample(self, sample: LoanSample) -> List[AnomalyFlag]:
        anomalies = []

        for field, rules in self.field_rules.items():
            value = getattr(sample, field)

            if value is None:
                anomalies.append(AnomalyFlag(
                    sample_id=sample.sample_id,
                    field_name=field,
                    expected_range=rules["expected_range"],
                    actual_value=None,
                    severity="critical",
                    description=f"{field}字段为空",
                ))
                continue

            if rules["type"] == "range":
                if value < rules["min"] or value > rules["max"]:
                    anomalies.append(AnomalyFlag(
                        sample_id=sample.sample_id,
                        field_name=field,
                        expected_range=rules["expected_range"],
                        actual_value=value,
                        severity=rules["severity"],
                        description=rules["description"],
                    ))

        critical_count = sum(1 for a in anomalies if a.severity == "critical")
        if critical_count >= 3:
            anomalies.append(AnomalyFlag(
                sample_id=sample.sample_id,
                field_name="overall",
                expected_range="最多2个严重异常",
                actual_value=f"{critical_count}个严重异常",
                severity="critical",
                description="样本存在多个严重异常，建议人工复核完整数据来源",
            ))

        if sample.principal > 0 and sample.interest_rate > 0 and sample.remaining_term > 0:
            try:
                denominator = 1 - (1 + sample.interest_rate / 100 / 12) ** (-sample.remaining_term)
                if abs(denominator) > 1e-10:
                    monthly_payment = sample.principal * (sample.interest_rate / 100 / 12) / denominator
                    monthly_income = (sample.principal * sample.dti_ratio / 100) / 12
                    if monthly_payment > monthly_income * 1.5 and monthly_income > 0:
                        anomalies.append(AnomalyFlag(
                            sample_id=sample.sample_id,
                            field_name="payment_income_ratio",
                            expected_range="月供 <= 月收入 * 1.5",
                            actual_value=round(monthly_payment / monthly_income, 2) if monthly_income > 0 else "N/A",
                            severity="warning",
                            description="月供与月收入比率异常偏高，请核实收入或贷款金额",
                        ))
            except (ZeroDivisionError, OverflowError):
                pass

        return anomalies

    def detect_batch(self, samples: List[LoanSample]) -> Dict[str, List[AnomalyFlag]]:
        result = {}
        for sample in samples:
            result[sample.sample_id] = self.detect_sample(sample)
        return result

    def get_anomaly_summary(
        self,
        sample_anomalies: Dict[str, List[AnomalyFlag]],
    ) -> Dict:
        total_samples = len(sample_anomalies)
        samples_with_anomalies = sum(
            1 for v in sample_anomalies.values() if len(v) > 0
        )
        total_anomalies = sum(len(v) for v in sample_anomalies.values())
        critical_anomalies = sum(
            1 for v in sample_anomalies.values()
            for a in v if a.severity == "critical"
        )
        warning_anomalies = sum(
            1 for v in sample_anomalies.values()
            for a in v if a.severity == "warning"
        )

        field_counts = {}
        for v in sample_anomalies.values():
            for a in v:
                field_counts[a.field_name] = field_counts.get(a.field_name, 0) + 1

        return {
            "total_samples": total_samples,
            "samples_with_anomalies": samples_with_anomalies,
            "clean_samples": total_samples - samples_with_anomalies,
            "total_anomalies": total_anomalies,
            "critical_anomalies": critical_anomalies,
            "warning_anomalies": warning_anomalies,
            "anomaly_rate": round(samples_with_anomalies / total_samples * 100, 2) if total_samples > 0 else 0,
            "field_distribution": field_counts,
        }
