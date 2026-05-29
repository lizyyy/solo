from __future__ import annotations
from datetime import date
from models import (
    CustAssessment,
    ProdGrade,
    PurchaseApp,
    ReviewResult,
    IssueDetail,
    IssueType,
    Source,
    RiskLevel,
)


class SuitabilityEngine:
    def __init__(self, reference_date: date = None):
        self.reference_date = reference_date or date.today()

    def check_single(
        self,
        app: PurchaseApp,
        assessment: CustAssessment,
        grade: ProdGrade,
    ) -> ReviewResult:
        issues = []

        expired = self._check_assessment_expiry(app, assessment)
        if expired:
            issues.append(expired)

        mismatch = self._check_grade_mismatch(app, assessment, grade)
        if mismatch:
            issues.append(mismatch)

        missing_rec = self._check_recording(app)
        if missing_rec:
            issues.append(missing_rec)

        suitability_verify = self._compute_suitability_verify(issues)
        material_version = self._compute_material_version(assessment, grade)
        callback_status = self._compute_callback_status(app, issues)

        return ReviewResult(
            app_id=app.app_id,
            cust_id=app.cust_id,
            prod_code=app.prod_code,
            suitability_verify=suitability_verify,
            material_version=material_version,
            callback_status=callback_status,
            issues=issues,
            cust_assessment=assessment.to_dict(),
            prod_grade=grade.to_dict(),
            purchase_app=app.to_dict(),
        )

    def check_batch(
        self,
        apps: list,
        assessments: dict,
        grades: dict,
    ) -> dict:
        normal = []
        problematic = []

        for app in apps:
            assessment = assessments.get(app.cust_id)
            grade = grades.get(app.prod_code)

            if assessment is None or grade is None:
                placeholder_issue = IssueDetail(
                    issue_type=IssueType.ASSESSMENT_EXPIRED,
                    description=f"缺少{'客户测评' if assessment is None else '产品等级'}数据",
                    source=Source.CUST_ASSESSMENT if assessment is None else Source.PROD_GRADE,
                    raw_data={},
                )
                result = ReviewResult(
                    app_id=app.app_id,
                    cust_id=app.cust_id,
                    prod_code=app.prod_code,
                    suitability_verify="fail",
                    material_version="unknown",
                    callback_status="pending",
                    issues=[placeholder_issue],
                    cust_assessment=assessment.to_dict() if assessment else None,
                    prod_grade=grade.to_dict() if grade else None,
                    purchase_app=app.to_dict(),
                )
                problematic.append(result)
                continue

            result = self.check_single(app, assessment, grade)
            if result.is_pass:
                normal.append(result)
            else:
                problematic.append(result)

        return {"normal": normal, "problematic": problematic}

    def _check_assessment_expiry(
        self, app: PurchaseApp, assessment: CustAssessment
    ) -> IssueDetail | None:
        if app.app_date > assessment.expiry_date:
            return IssueDetail(
                issue_type=IssueType.ASSESSMENT_EXPIRED,
                description=(
                    f"客户测评已过期: 测评有效期至 {assessment.expiry_date.isoformat()}, "
                    f"申请日期 {app.app_date.isoformat()}"
                ),
                source=Source.CUST_ASSESSMENT,
                raw_data=assessment.to_dict(),
            )
        return None

    def _check_grade_mismatch(
        self,
        app: PurchaseApp,
        assessment: CustAssessment,
        grade: ProdGrade,
    ) -> IssueDetail | None:
        if assessment.risk_level < grade.risk_level:
            return IssueDetail(
                issue_type=IssueType.GRADE_MISMATCH,
                description=(
                    f"风险等级不匹配: 客户风险承受能力 {assessment.risk_level.value}, "
                    f"产品风险等级 {grade.risk_level.value}"
                ),
                source=Source.PROD_GRADE,
                raw_data={
                    "cust_risk": assessment.risk_level.value,
                    "prod_risk": grade.risk_level.value,
                    "assessment": assessment.to_dict(),
                    "grade": grade.to_dict(),
                },
            )
        return None

    def _check_recording(self, app: PurchaseApp) -> IssueDetail | None:
        if not app.has_recording:
            return IssueDetail(
                issue_type=IssueType.RECORDING_MISSING,
                description=f"缺少录音确认: 申请 {app.app_id} 无关联录音",
                source=Source.PURCHASE_APP,
                raw_data=app.to_dict(),
            )
        return None

    def _compute_suitability_verify(self, issues: list) -> str:
        if not issues:
            return "pass"
        issue_types = {i.issue_type for i in issues}
        if IssueType.ASSESSMENT_EXPIRED in issue_types:
            return "fail_expired"
        if IssueType.GRADE_MISMATCH in issue_types:
            return "fail_mismatch"
        if IssueType.RECORDING_MISSING in issue_types:
            return "fail_no_recording"
        return "fail"

    def _compute_material_version(
        self, assessment: CustAssessment, grade: ProdGrade
    ) -> str:
        return f"assess_v{assessment.assess_date.isoformat()}|grade_v{grade.version}"

    def _compute_callback_status(self, app: PurchaseApp, issues: list) -> str:
        if app.has_recording and len(issues) == 0:
            return "completed"
        if app.has_recording and len(issues) > 0:
            return "callback_needed"
        return "pending"
