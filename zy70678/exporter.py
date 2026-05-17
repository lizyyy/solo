import pandas as pd
from datetime import date, datetime
from typing import List, Dict
from sqlalchemy.orm import Session
import models
import schemas
from services import MaterialReviewService
import os


class ReportExporter:
    def __init__(self, db: Session):
        self.db = db
        self.service = MaterialReviewService(db)
        self.export_dir = "exports"
        os.makedirs(self.export_dir, exist_ok=True)

    def export_student_review_to_excel(self, student_id: int, file_path: str = None) -> str:
        review_result = self.service.review_student_materials(student_id)
        student = self.db.query(models.Student).filter(models.Student.id == student_id).first()

        if not file_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(self.export_dir, f"review_{student.student_id}_{timestamp}.xlsx")

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            basic_info = pd.DataFrame({
                '项目': ['学号', '姓名', '年级', '专业', '审核日期', '审核状态'],
                '内容': [
                    student.student_id,
                    student.name,
                    student.grade or '',
                    student.major or '',
                    date.today().strftime('%Y-%m-%d'),
                    review_result.status.value
                ]
            })
            basic_info.to_excel(writer, sheet_name='基本信息', index=False)

            family_data = []
            for member in student.family_members:
                family_data.append({
                    '姓名': member.name,
                    '关系': member.relation,
                    '年龄': member.age or '',
                    '身份证号': member.id_card or '',
                    '工作单位': member.workplace or '',
                    '年收入': member.annual_income or '',
                    '是否收入来源': '是' if member.is_source_of_income else '否'
                })
            if family_data:
                pd.DataFrame(family_data).to_excel(writer, sheet_name='家庭成员', index=False)

            issues_data = []
            for material in student.materials:
                mat_type = material.material_type
                issues_data.append({
                    '材料名称': mat_type.name,
                    '是否必填': '是' if mat_type.is_required else '否',
                    '提交状态': '已提交',
                    '签发日期': material.issue_date.strftime('%Y-%m-%d') if material.issue_date else '',
                    '有效期至': material.expiry_date.strftime('%Y-%m-%d') if material.expiry_date else '',
                    '是否盖章': '是' if material.has_stamp else '否',
                    '备注': material.remarks or ''
                })
            pd.DataFrame(issues_data).to_excel(writer, sheet_name='材料清单', index=False)

            issues_summary = []
            if review_result.missing_materials:
                for mat in review_result.missing_materials:
                    issues_summary.append({'问题类型': '缺少材料', '问题描述': mat, '严重程度': '严重'})
            if review_result.expired_materials:
                for mat in review_result.expired_materials:
                    issues_summary.append({'问题类型': '材料过期', '问题描述': mat, '严重程度': '错误'})
            if review_result.no_stamp_materials:
                for mat in review_result.no_stamp_materials:
                    issues_summary.append({'问题类型': '缺少公章', '问题描述': mat, '严重程度': '错误'})
            for issue in review_result.family_consistency_issues:
                issues_summary.append({'问题类型': '家庭信息不一致', '问题描述': issue, '严重程度': '警告'})

            if issues_summary:
                pd.DataFrame(issues_summary).to_excel(writer, sheet_name='问题清单', index=False)

        return file_path

    def export_batch_review_to_excel(self, file_path: str = None) -> str:
        if not file_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(self.export_dir, f"batch_review_{timestamp}.xlsx")

        all_results = self.service.batch_review_all()

        summary_data = []
        for result in all_results:
            summary_data.append({
                '学号': result.student_id,
                '姓名': result.student_name,
                '提交材料数': result.total_materials,
                '缺少材料数': len(result.missing_materials),
                '过期材料数': len(result.expired_materials),
                '缺章材料数': len(result.no_stamp_materials),
                '家庭问题数': len(result.family_consistency_issues),
                '总问题数': result.issue_summary['total_issues'],
                '审核状态': result.status.value
            })

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='审核汇总', index=False)

            detail_data = []
            for result in all_results:
                issues = []
                if result.missing_materials:
                    issues.append(f"缺少: {', '.join(result.missing_materials)}")
                if result.expired_materials:
                    issues.append(f"过期: {', '.join(result.expired_materials)}")
                if result.no_stamp_materials:
                    issues.append(f"缺章: {', '.join(result.no_stamp_materials)}")
                if result.family_consistency_issues:
                    issues.append(f"家庭问题: {'; '.join(result.family_consistency_issues)}")

                detail_data.append({
                    '学号': result.student_id,
                    '姓名': result.student_name,
                    '问题详情': ' | '.join(issues) if issues else '无问题',
                    '审核状态': result.status.value
                })
            pd.DataFrame(detail_data).to_excel(writer, sheet_name='问题详情', index=False)

        return file_path

    def export_issues_by_type(self, issue_type: str, file_path: str = None) -> str:
        if not file_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(self.export_dir, f"{issue_type}_issues_{timestamp}.xlsx")

        students_with_issues = self.service.get_students_with_issues(issue_type)

        df = pd.DataFrame(students_with_issues)
        df.to_excel(file_path, index=False)

        return file_path

    def generate_review_report_csv(self, output_path: str = None) -> str:
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(self.export_dir, f"review_report_{timestamp}.csv")

        all_results = self.service.batch_review_all()

        rows = []
        for result in all_results:
            rows.append({
                '学号': result.student_id,
                '姓名': result.student_name,
                '提交材料数': result.total_materials,
                '缺少材料数': len(result.missing_materials),
                '过期材料数': len(result.expired_materials),
                '缺章材料数': len(result.no_stamp_materials),
                '家庭问题数': len(result.family_consistency_issues),
                '总问题数': result.issue_summary['total_issues'],
                '审核状态': result.status.value,
                '缺少材料列表': ', '.join(result.missing_materials) if result.missing_materials else '',
                '过期材料列表': ', '.join(result.expired_materials) if result.expired_materials else '',
                '缺章材料列表': ', '.join(result.no_stamp_materials) if result.no_stamp_materials else '',
                '家庭问题描述': '; '.join(result.family_consistency_issues) if result.family_consistency_issues else ''
            })

        df = pd.DataFrame(rows)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')

        return output_path
