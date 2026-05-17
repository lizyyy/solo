from datetime import date, datetime
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import models
import schemas
import uuid


class MaterialReviewService:
    def __init__(self, db: Session):
        self.db = db

    def check_material_validity(self, material: models.StudentMaterial, material_type: models.MaterialType, check_date: date = None) -> Tuple[bool, List[str]]:
        if check_date is None:
            check_date = date.today()

        issues = []
        is_valid = True

        if material_type.need_stamp and not material.has_stamp:
            issues.append("缺少公章")
            is_valid = False

        if material.expiry_date and material.expiry_date < check_date:
            issues.append("证明已过期")
            is_valid = False

        if material_type.validity_days and material.issue_date:
            calculated_expiry = material.issue_date.replace(year=material.issue_date.year + material_type.validity_days // 365)
            if calculated_expiry < check_date:
                issues.append(f"证明超出{material_type.validity_days}天有效期")
                is_valid = False

        return is_valid, issues

    def check_family_consistency(self, student: models.Student) -> List[str]:
        issues = []
        members = student.family_members

        if not members:
            issues.append("未填写家庭成员信息")
            return issues

        id_cards = [m.id_card for m in members if m.id_card]
        if len(id_cards) != len(set(id_cards)):
            issues.append("家庭成员身份证号重复")

        income_sources = [m for m in members if m.is_source_of_income]
        if not income_sources:
            issues.append("未指定家庭收入来源成员")

        for member in members:
            if not member.name:
                issues.append("存在家庭成员姓名为空")
            if not member.relation:
                issues.append(f"{member.name}的关系未填写")

        return issues

    def inventory_materials(self, student: models.Student) -> Dict:
        required_types = self.db.query(models.MaterialType).filter(models.MaterialType.is_required == True).all()
        student_materials = student.materials

        material_map = {m.material_type_id: m for m in student_materials}

        missing_materials = []
        for mat_type in required_types:
            if mat_type.id not in material_map:
                missing_materials.append(mat_type.name)

        return {
            "total_required": len(required_types),
            "total_submitted": len(student_materials),
            "missing": missing_materials,
            "missing_count": len(missing_materials),
        }

    def create_issue(self, material_id: int, issue_type: str, issue_level: schemas.IssueLevel, description: str) -> models.MaterialIssue:
        issue = models.MaterialIssue(
            material_id=material_id,
            issue_type=issue_type,
            issue_level=issue_level,
            description=description
        )
        self.db.add(issue)
        return issue

    def determine_issue_level(self, issue_type: str) -> schemas.IssueLevel:
        level_map = {
            "missing": schemas.IssueLevel.CRITICAL,
            "expired": schemas.IssueLevel.ERROR,
            "no_stamp": schemas.IssueLevel.ERROR,
            "family_consistency": schemas.IssueLevel.WARNING,
            "incomplete": schemas.IssueLevel.WARNING,
        }
        return level_map.get(issue_type, schemas.IssueLevel.INFO)

    def review_student_materials(self, student_id: int) -> schemas.ReviewResult:
        student = self.db.query(models.Student).filter(models.Student.id == student_id).first()
        if not student:
            raise ValueError(f"学生ID {student_id} 不存在")

        inventory_result = self.inventory_materials(student)

        expired_materials = []
        no_stamp_materials = []
        material_issues = []

        for material in student.materials:
            material_type = material.material_type
            is_valid, validity_issues = self.check_material_validity(material, material_type)

            if "证明已过期" in validity_issues or "证明超出" in "".join(validity_issues):
                expired_materials.append(material_type.name)
                for issue_desc in validity_issues:
                    if "过期" in issue_desc or "超出" in issue_desc:
                        self.create_issue(material.id, "expired", schemas.IssueLevel.ERROR, f"{material_type.name}: {issue_desc}")

            if "缺少公章" in validity_issues:
                no_stamp_materials.append(material_type.name)
                self.create_issue(material.id, "no_stamp", schemas.IssueLevel.ERROR, f"{material_type.name}: 缺少公章")

        for missing_mat in inventory_result["missing"]:
            material_issues.append(f"缺少必填材料: {missing_mat}")

        family_issues = self.check_family_consistency(student)

        all_issues = material_issues + family_issues
        total_issues = len(all_issues)

        if total_issues == 0:
            status = schemas.MaterialStatus.APPROVED
        elif any(key in str(all_issues) for key in ["缺少", "过期", "公章"]):
            status = schemas.MaterialStatus.NEED_REVIEW
        else:
            status = schemas.MaterialStatus.PENDING

        issue_summary = {
            "missing_count": inventory_result["missing_count"],
            "expired_count": len(expired_materials),
            "no_stamp_count": len(no_stamp_materials),
            "family_issue_count": len(family_issues),
            "total_issues": total_issues,
        }

        return schemas.ReviewResult(
            student_id=student.student_id,
            student_name=student.name,
            total_materials=inventory_result["total_submitted"],
            missing_materials=inventory_result["missing"],
            expired_materials=expired_materials,
            no_stamp_materials=no_stamp_materials,
            family_consistency_issues=family_issues,
            issue_summary=issue_summary,
            status=status
        )

    def generate_report(self, student_id: int, reviewer: str = None) -> models.ReviewReport:
        review_result = self.review_student_materials(student_id)
        student = self.db.query(models.Student).filter(models.Student.id == student_id).first()

        report_code = f"REP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

        report = models.ReviewReport(
            student_id=student_id,
            report_code=report_code,
            total_materials=review_result.total_materials,
            missing_materials=review_result.issue_summary["missing_count"],
            expired_materials=review_result.issue_summary["expired_count"],
            no_stamp_materials=review_result.issue_summary["no_stamp_count"],
            family_consistency_issues=review_result.issue_summary["family_issue_count"],
            total_issues=review_result.issue_summary["total_issues"],
            critical_issues=review_result.issue_summary["missing_count"] + review_result.issue_summary["expired_count"],
            status=review_result.status,
            review_date=date.today(),
            reviewer=reviewer
        )

        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_students_with_issues(self, issue_type: str = None) -> List[Dict]:
        students = self.db.query(models.Student).all()
        result = []

        for student in students:
            review_result = self.review_student_materials(student.id)
            if issue_type:
                if issue_type == "missing" and review_result.missing_materials:
                    result.append(review_result.dict())
                elif issue_type == "expired" and review_result.expired_materials:
                    result.append(review_result.dict())
                elif issue_type == "no_stamp" and review_result.no_stamp_materials:
                    result.append(review_result.dict())
                elif issue_type == "family" and review_result.family_consistency_issues:
                    result.append(review_result.dict())
            else:
                if review_result.issue_summary["total_issues"] > 0:
                    result.append(review_result.dict())

        return result

    def batch_review_all(self) -> List[schemas.ReviewResult]:
        students = self.db.query(models.Student).all()
        results = []
        for student in students:
            results.append(self.review_student_materials(student.id))
        return results


def init_material_types(db: Session) -> None:
    existing_count = db.query(models.MaterialType).count()
    if existing_count > 0:
        return

    default_types = [
        {"code": "LOW_INCOME", "name": "低保证明", "validity_days": 365, "need_stamp": True},
        {"code": "POVERTY", "name": "贫困证明", "validity_days": 365, "need_stamp": True},
        {"code": "DISABILITY", "name": "残疾证明", "validity_days": None, "need_stamp": True},
        {"code": "ORPHAN", "name": "孤儿证明", "validity_days": None, "need_stamp": True},
        {"code": "FAMILY_INCOME", "name": "家庭收入证明", "validity_days": 180, "need_stamp": True},
        {"code": "MEDICAL", "name": "医疗证明", "validity_days": 90, "need_stamp": True},
        {"code": "APPLICATION", "name": "助学金申请表", "validity_days": None, "need_stamp": True},
        {"code": "ID_COPY", "name": "身份证复印件", "validity_days": None, "need_stamp": False},
    ]

    idx = 1
    for mat_type in default_types:
        db_obj = models.MaterialType(
            code=mat_type["code"],
            name=mat_type["name"],
            description="",
            validity_days=mat_type["validity_days"],
            is_required=True,
            need_stamp=mat_type["need_stamp"],
            sort_order=idx
        )
        db.add(db_obj)
        idx += 1

    db.commit()
