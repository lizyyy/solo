from typing import Dict, List, Tuple
from .models import (
    LoanSample,
    SensitivityResult,
    CalculationStep,
    AnomalyFlag,
)


class SensitivityEngine:
    def __init__(self, parameters: Dict[str, float], parameter_version_id: str):
        self.parameters = parameters
        self.parameter_version_id = parameter_version_id

    def _normalize_rate(self, rate: float) -> float:
        return min(max(rate / 10.0, 0.0), 1.0)

    def _normalize_term(self, term: int) -> float:
        return min(max(1.0 - term / 360.0, 0.0), 1.0)

    def _normalize_fico(self, fico: int) -> float:
        return min(max((850 - fico) / 550.0, 0.0), 1.0)

    def _normalize_dti(self, dti: float) -> float:
        return min(max(dti / 60.0, 0.0), 1.0)

    def _normalize_ltv(self, ltv: float) -> float:
        return min(max(ltv / 100.0, 0.0), 1.0)

    def _normalize_age(self, age: int) -> float:
        if age < 25:
            return 0.8
        elif age > 60:
            return 0.7
        else:
            return 0.3

    def _normalize_history(self, has_history: bool) -> float:
        return 1.0 if has_history else 0.0

    def _determine_risk_level(self, score: float) -> str:
        high_threshold = self.parameters.get("high_risk_threshold_value", 0.70)
        medium_threshold = self.parameters.get("medium_risk_threshold_value", 0.40)
        if score >= high_threshold:
            return "high"
        elif score >= medium_threshold:
            return "medium"
        else:
            return "low"

    def calculate(self, sample: LoanSample, anomalies: List[AnomalyFlag]) -> SensitivityResult:
        steps: List[CalculationStep] = []
        component_scores: Dict[str, float] = {}
        weighted_scores: Dict[str, float] = {}

        param_map = {
            "rate": ("rate_sensitivity", self._normalize_rate(sample.interest_rate)),
            "term": ("term_sensitivity", self._normalize_term(sample.remaining_term)),
            "fico": ("fico_sensitivity", self._normalize_fico(sample.fico_score)),
            "dti": ("dti_sensitivity", self._normalize_dti(sample.dti_ratio)),
            "ltv": ("ltv_sensitivity", self._normalize_ltv(sample.ltv_ratio)),
            "age": ("age_sensitivity", self._normalize_age(sample.borrower_age)),
            "history": ("history_sensitivity", self._normalize_history(sample.has_prepayment_history)),
        }

        for key, (param_name, normalized_value) in param_map.items():
            param_value = self.parameters.get(f"{param_name}_value", 0.0)
            param_weight = self.parameters.get(f"{param_name}_weight", 0.0)

            component_score = normalized_value * param_value
            weighted_score = component_score * param_weight

            component_scores[key] = component_score
            weighted_scores[key] = weighted_score

            steps.append(CalculationStep(
                step_name=f"{key}_component",
                input_values={
                    f"raw_{key}": getattr(sample, {
                        "rate": "interest_rate",
                        "term": "remaining_term",
                        "fico": "fico_score",
                        "dti": "dti_ratio",
                        "ltv": "ltv_ratio",
                        "age": "borrower_age",
                        "history": "has_prepayment_history",
                    }[key]),
                    f"normalized_{key}": round(normalized_value, 4),
                },
                formula=f"normalized_{key} * {param_name}_value",
                result=round(component_score, 4),
                parameter_used={
                    f"{param_name}_value": param_value,
                },
            ))

            steps.append(CalculationStep(
                step_name=f"{key}_weighted",
                input_values={
                    f"{key}_component_score": round(component_score, 4),
                },
                formula=f"{key}_component_score * {param_name}_weight",
                result=round(weighted_score, 4),
                parameter_used={
                    f"{param_name}_weight": param_weight,
                },
            ))

        total_weight = sum(
            self.parameters.get(f"{name}_weight", 0.0)
            for name in [
                "rate_sensitivity",
                "term_sensitivity",
                "fico_sensitivity",
                "dti_sensitivity",
                "ltv_sensitivity",
                "age_sensitivity",
                "history_sensitivity",
            ]
        )

        if total_weight > 0:
            raw_score = sum(weighted_scores.values()) / total_weight
        else:
            raw_score = sum(weighted_scores.values())

        steps.append(CalculationStep(
            step_name="final_aggregation",
            input_values={
                **{f"{k}_weighted": round(v, 4) for k, v in weighted_scores.items()},
                "total_weight": round(total_weight, 4),
            },
            formula="sum(weighted_scores) / total_weight",
            result=round(raw_score, 4),
            parameter_used={},
        ))

        risk_level = self._determine_risk_level(raw_score)
        high_threshold = self.parameters.get("high_risk_threshold_value", 0.70)
        medium_threshold = self.parameters.get("medium_risk_threshold_value", 0.40)

        steps.append(CalculationStep(
            step_name="risk_level_determination",
            input_values={
                "final_score": round(raw_score, 4),
                "high_threshold": high_threshold,
                "medium_threshold": medium_threshold,
            },
            formula="if score >= high_threshold: 'high' elif score >= medium_threshold: 'medium' else 'low'",
            result=1.0 if risk_level == "high" else 0.5 if risk_level == "medium" else 0.0,
            parameter_used={
                "high_risk_threshold_value": high_threshold,
                "medium_risk_threshold_value": medium_threshold,
            },
        ))

        needs_manual_review = len(anomalies) > 0 and any(
            a.severity == "critical" for a in anomalies
        )

        params_used = {}
        for key in self.parameters:
            params_used[key] = self.parameters[key]

        return SensitivityResult(
            sample_id=sample.sample_id,
            loan_id=sample.loan_id,
            sensitivity_score=round(raw_score, 4),
            risk_level=risk_level,
            calculation_steps=steps,
            parameters_used=params_used,
            parameter_version_id=self.parameter_version_id,
            anomalies=anomalies,
            needs_manual_review=needs_manual_review,
            review_status="pending" if needs_manual_review else "not_applicable",
        )

    def calculate_batch(
        self,
        samples: List[LoanSample],
        sample_anomalies: Dict[str, List[AnomalyFlag]],
    ) -> List[SensitivityResult]:
        results = []
        for sample in samples:
            anomalies = sample_anomalies.get(sample.sample_id, [])
            result = self.calculate(sample, anomalies)
            results.append(result)
        return results

    def explain_calculation(self, result: SensitivityResult) -> Dict:
        explanations = []
        for step in result.calculation_steps:
            input_str = ", ".join(
                f"{k}={v}" for k, v in step.input_values.items()
            )
            param_str = ", ".join(
                f"{k}={v}" for k, v in step.parameter_used.items()
            )
            explanations.append({
                "step": step.step_name,
                "formula": step.formula,
                "inputs": input_str,
                "parameters": param_str if param_str else "none",
                "result": step.result,
            })

        component_contributions = {}
        for step in result.calculation_steps:
            if step.step_name.endswith("_weighted"):
                component = step.step_name.replace("_weighted", "")
                component_contributions[component] = step.result

        total = sum(component_contributions.values())
        contribution_pct = {}
        if total > 0:
            for k, v in component_contributions.items():
                contribution_pct[k] = round(v / total * 100, 2)

        return {
            "sample_id": result.sample_id,
            "final_score": result.sensitivity_score,
            "risk_level": result.risk_level,
            "calculation_walkthrough": explanations,
            "component_contributions": component_contributions,
            "contribution_percentages": contribution_pct,
            "parameter_version": result.parameter_version_id,
            "anomalies": [a.to_dict() for a in result.anomalies],
        }
