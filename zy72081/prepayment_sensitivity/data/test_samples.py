from typing import List, Dict
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models import LoanSample, ReviewChartData, generate_id


def create_test_samples() -> List[LoanSample]:
    samples = []

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-001_clean"),
        loan_id="LOAN-001",
        principal=350000.0,
        interest_rate=4.25,
        remaining_term=240,
        borrower_age=38,
        fico_score=720,
        dti_ratio=32.0,
        ltv_ratio=75.0,
        has_prepayment_history=False,
        source="core_system_2026q2",
        raw_data={
            "loan_number": "LN2024-03421",
            "origination_date": "2024-03-15",
            "property_type": "single_family",
            "loan_purpose": "purchase",
        },
    ))

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-002_needs_review"),
        loan_id="LOAN-002",
        principal=2800000.0,
        interest_rate=18.5,
        remaining_term=480,
        borrower_age=152,
        fico_score=250,
        dti_ratio=95.0,
        ltv_ratio=140.0,
        has_prepayment_history=True,
        source="manual_input_data_entry",
        raw_data={
            "loan_number": "LN2023-08912",
            "origination_date": "2023-11-20",
            "property_type": "multi_family",
            "loan_purpose": "refinance",
            "note": "数据可能存在录入错误，需要人工核实",
        },
    ))

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-003_old_caliber"),
        loan_id="LOAN-003",
        principal=420000.0,
        interest_rate=5.75,
        remaining_term=180,
        borrower_age=45,
        fico_score=680,
        dti_ratio=38.0,
        ltv_ratio=82.0,
        has_prepayment_history=True,
        source="historical_backfill_2025",
        raw_data={
            "loan_number": "LN2022-01567",
            "origination_date": "2022-06-05",
            "property_type": "condo",
            "loan_purpose": "cashout_refinance",
            "note": "2025年复盘图表补录，使用旧口径计算",
            "old_calculation_method": "2025_q1_methodology",
        },
    ))

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-004_clean"),
        loan_id="LOAN-004",
        principal=520000.0,
        interest_rate=3.85,
        remaining_term=300,
        borrower_age=42,
        fico_score=760,
        dti_ratio=28.0,
        ltv_ratio=68.0,
        has_prepayment_history=False,
        source="core_system_2026q2",
        raw_data={
            "loan_number": "LN2024-07823",
            "origination_date": "2024-08-10",
            "property_type": "single_family",
            "loan_purpose": "purchase",
        },
    ))

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-005_outlier"),
        loan_id="LOAN-005",
        principal=9500000.0,
        interest_rate=0.1,
        remaining_term=0,
        borrower_age=105,
        fico_score=900,
        dti_ratio=150.0,
        ltv_ratio=200.0,
        has_prepayment_history=True,
        source="test_data_feed",
        raw_data={
            "loan_number": "LN2021-99999",
            "origination_date": "2021-01-01",
            "property_type": "commercial",
            "loan_purpose": "business",
            "note": "明显越界测试样本",
        },
    ))

    samples.append(LoanSample(
        sample_id=generate_id("SAMP", "LOAN-006_chart_conflict"),
        loan_id="LOAN-006",
        principal=380000.0,
        interest_rate=6.25,
        remaining_term=220,
        borrower_age=52,
        fico_score=640,
        dti_ratio=42.0,
        ltv_ratio=88.0,
        has_prepayment_history=True,
        source="core_system_2026q2",
        raw_data={
            "loan_number": "LN2023-04521",
            "origination_date": "2023-04-18",
            "property_type": "townhouse",
            "loan_purpose": "refinance",
        },
    ))

    return samples


def create_review_chart_data() -> List[ReviewChartData]:
    chart_data = []

    chart_data.append(ReviewChartData(
        record_id=generate_id("CHART", "manual_review_loan002"),
        loan_id="LOAN-002",
        reported_sensitivity=0.45,
        reported_risk="medium",
        report_period="2026-Q1",
        data_source="manual_review_excel",
        manual_note="2026年一季度人工复核记录，principal: 280000, 当时认为数据异常已修正",
    ))

    chart_data.append(ReviewChartData(
        record_id=generate_id("CHART", "old_caliber_loan003"),
        loan_id="LOAN-003",
        reported_sensitivity=0.38,
        reported_risk="low",
        report_period="2025-Q4",
        data_source="historical_review",
        manual_note="2025年复盘图表补录，旧口径：principal: 450000, rate_sensitivity_weight: 0.25",
    ))

    chart_data.append(ReviewChartData(
        record_id=generate_id("CHART", "conflict_loan006"),
        loan_id="LOAN-006",
        reported_sensitivity=0.52,
        reported_risk="medium",
        report_period="2026-Q1",
        data_source="quarterly_review",
        manual_note="2026一季度复盘，人工调整了风险等级",
    ))

    return chart_data


def create_manual_notes() -> Dict[str, List[str]]:
    return {
        "LOAN-002": [
            "2026-05-15 小岑：本金280万疑似多打了一个零，实际应为28万",
            "2026-05-16 小张：已核实原始合同，本金确认为280,000",
            "2026-05-17 复核：利率18.5%不符合常规产品，建议核实",
        ],
        "LOAN-003": [
            "2025-12-20 历史补录：使用2025年Q1方法学计算",
            "2026-01-10 小岑：与系统计算值差异较大，需确认参数版本",
            "2026-03-05 备注：旧口径中rate权重为0.25，现版本为0.30",
        ],
        "LOAN-006": [
            "2026-04-01 复盘：一季度风险等级人工上调为medium",
            "2026-05-20 小张：FICO评分近期有更新，从620升至640",
        ],
    }
