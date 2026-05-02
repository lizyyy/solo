from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
import json

from app.models import (
    Prescription, PrescriptionItem, InsuranceSettlement,
    DrugInventory, DrugReturn, ReviewRecord, RiskFinding,
    ReviewStatus
)
from app.schemas import (
    PrescriptionCreate, InsuranceSettlementCreate,
    DrugInventoryCreate, DrugReturnCreate, BatchImportRequest
)
from app.rules import run_all_rules, Severity


class ImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def import_prescription(self, data: PrescriptionCreate, batch_no: Optional[str] = None) -> Prescription:
        existing = await self.db.execute(
            select(Prescription).where(Prescription.prescription_no == data.prescription_no)
        )
        existing_rx = existing.scalar_one_or_none()

        if existing_rx:
            await self.db.execute(
                update(Prescription).where(Prescription.id == existing_rx.id).values(
                    patient_name=data.patient_name,
                    patient_id=data.patient_id,
                    prescription_date=data.prescription_date,
                    doctor_name=data.doctor_name,
                    department=data.department,
                    diagnosis=data.diagnosis,
                    batch_no=data.batch_no or batch_no,
                    updated_at=datetime.utcnow()
                )
            )
            await self.db.commit()
            rx = existing_rx
        else:
            rx = Prescription(
                prescription_no=data.prescription_no,
                patient_name=data.patient_name,
                patient_id=data.patient_id,
                prescription_date=data.prescription_date,
                doctor_name=data.doctor_name,
                department=data.department,
                diagnosis=data.diagnosis,
                batch_no=data.batch_no or batch_no
            )
            self.db.add(rx)
            await self.db.commit()
            await self.db.refresh(rx)

        if data.items:
            await self.db.execute(
                select(PrescriptionItem).where(PrescriptionItem.prescription_id == rx.id)
            )

            for item_data in data.items:
                item = PrescriptionItem(
                    prescription_id=rx.id,
                    drug_name=item_data.drug_name,
                    drug_code=item_data.drug_code,
                    specification=item_data.specification,
                    quantity=item_data.quantity,
                    unit=item_data.unit,
                    dosage=item_data.dosage,
                    batch_no=item_data.batch_no
                )
                self.db.add(item)
            await self.db.commit()

        return rx

    async def import_settlement(self, data: InsuranceSettlementCreate, batch_no: Optional[str] = None) -> InsuranceSettlement:
        rx_result = await self.db.execute(
            select(Prescription).where(Prescription.prescription_no == data.prescription_no)
        )
        prescription = rx_result.scalar_one_or_none()
        if not prescription:
            raise ValueError(f"处方号 {data.prescription_no} 不存在")

        existing = await self.db.execute(
            select(InsuranceSettlement).where(InsuranceSettlement.settlement_no == data.settlement_no)
        )
        existing_stl = existing.scalar_one_or_none()

        if existing_stl:
            await self.db.execute(
                update(InsuranceSettlement).where(InsuranceSettlement.id == existing_stl.id).values(
                    settlement_date=data.settlement_date,
                    total_amount=data.total_amount,
                    insurance_payment=data.insurance_payment,
                    personal_payment=data.personal_payment,
                    batch_no=data.batch_no or batch_no
                )
            )
            await self.db.commit()
            return existing_stl
        else:
            stl = InsuranceSettlement(
                settlement_no=data.settlement_no,
                prescription_id=prescription.id,
                settlement_date=data.settlement_date,
                total_amount=data.total_amount,
                insurance_payment=data.insurance_payment,
                personal_payment=data.personal_payment,
                batch_no=data.batch_no or batch_no
            )
            self.db.add(stl)
            await self.db.commit()
            await self.db.refresh(stl)
            return stl

    async def import_inventory(self, data: DrugInventoryCreate) -> DrugInventory:
        existing = await self.db.execute(
            select(DrugInventory).where(
                DrugInventory.drug_code == data.drug_code,
                DrugInventory.batch_no == data.batch_no
            )
        )
        existing_inv = existing.scalar_one_or_none()

        if existing_inv:
            await self.db.execute(
                update(DrugInventory).where(DrugInventory.id == existing_inv.id).values(
                    drug_name=data.drug_name,
                    quantity=data.quantity,
                    unit=data.unit,
                    expiry_date=data.expiry_date,
                    manufacturer=data.manufacturer,
                    updated_at=datetime.utcnow()
                )
            )
            await self.db.commit()
            return existing_inv
        else:
            inv = DrugInventory(
                drug_code=data.drug_code,
                drug_name=data.drug_name,
                batch_no=data.batch_no,
                quantity=data.quantity,
                unit=data.unit,
                expiry_date=data.expiry_date,
                manufacturer=data.manufacturer
            )
            self.db.add(inv)
            await self.db.commit()
            await self.db.refresh(inv)
            return inv

    async def import_return(self, data: DrugReturnCreate, batch_no: Optional[str] = None) -> DrugReturn:
        rx_result = await self.db.execute(
            select(Prescription).options(selectinload(Prescription.items)).where(
                Prescription.prescription_no == data.prescription_no
            )
        )
        prescription = rx_result.scalar_one_or_none()
        if not prescription:
            raise ValueError(f"处方号 {data.prescription_no} 不存在")

        item = None
        for rx_item in prescription.items:
            if rx_item.drug_name == data.drug_name:
                if data.batch_no and rx_item.batch_no == data.batch_no:
                    item = rx_item
                    break
                elif not data.batch_no:
                    item = rx_item
                    break

        if not item:
            raise ValueError(f"处方 {data.prescription_no} 中未找到药品 {data.drug_name}")

        existing = await self.db.execute(
            select(DrugReturn).where(DrugReturn.return_no == data.return_no)
        )
        existing_ret = existing.scalar_one_or_none()

        if existing_ret:
            await self.db.execute(
                update(DrugReturn).where(DrugReturn.id == existing_ret.id).values(
                    return_quantity=data.return_quantity,
                    return_date=data.return_date,
                    return_reason=data.return_reason,
                    operator=data.operator,
                    batch_no=data.batch_no_import or batch_no
                )
            )
            await self.db.commit()
            return existing_ret
        else:
            ret = DrugReturn(
                return_no=data.return_no,
                prescription_item_id=item.id,
                return_quantity=data.return_quantity,
                return_date=data.return_date,
                return_reason=data.return_reason,
                operator=data.operator,
                batch_no=data.batch_no_import or batch_no
            )
            self.db.add(ret)
            await self.db.commit()
            await self.db.refresh(ret)
            return ret

    async def batch_import(self, request: BatchImportRequest) -> Dict[str, Any]:
        batch_no = request.batch_no or f"BATCH_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        errors = []
        counts = {
            "prescriptions": 0,
            "settlements": 0,
            "inventories": 0,
            "returns": 0
        }

        for rx_data in request.prescriptions:
            try:
                await self.import_prescription(rx_data, batch_no)
                counts["prescriptions"] += 1
            except Exception as e:
                errors.append(f"处方 {rx_data.prescription_no}: {str(e)}")

        for stl_data in request.settlements:
            try:
                await self.import_settlement(stl_data, batch_no)
                counts["settlements"] += 1
            except Exception as e:
                errors.append(f"结算 {stl_data.settlement_no}: {str(e)}")

        for inv_data in request.inventories:
            try:
                await self.import_inventory(inv_data)
                counts["inventories"] += 1
            except Exception as e:
                errors.append(f"库存 {inv_data.drug_code}/{inv_data.batch_no}: {str(e)}")

        for ret_data in request.returns:
            try:
                await self.import_return(ret_data, batch_no)
                counts["returns"] += 1
            except Exception as e:
                errors.append(f"退药 {ret_data.return_no}: {str(e)}")

        return {
            "success": len(errors) == 0,
            "batch_no": batch_no,
            "message": f"导入完成，成功: {sum(counts.values())}, 错误: {len(errors)}",
            "imported": counts,
            "errors": errors
        }


class ValidationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_inventory_context(self) -> Dict[str, Any]:
        inv_result = await self.db.execute(select(DrugInventory))
        inventories = inv_result.scalars().all()

        inventory_batches = set()
        inventory_map = {}
        inventory_expiry_map = {}

        for inv in inventories:
            key = (inv.drug_code, inv.batch_no)
            inventory_batches.add(inv.batch_no)
            inventory_map[key] = inv.quantity
            if inv.expiry_date:
                inventory_expiry_map[key] = inv.expiry_date

        return {
            "inventory_batches": inventory_batches,
            "inventory_map": inventory_map,
            "inventory_expiry_map": inventory_expiry_map
        }

    async def validate_prescription(self, prescription_no: str) -> Dict[str, Any]:
        rx_result = await self.db.execute(
            select(Prescription)
            .options(
                selectinload(Prescription.items).selectinload(PrescriptionItem.return_records),
                selectinload(Prescription.settlements),
                selectinload(Prescription.reviews)
            )
            .where(Prescription.prescription_no == prescription_no)
        )
        prescription = rx_result.scalar_one_or_none()

        if not prescription:
            raise ValueError(f"处方号 {prescription_no} 不存在")

        inventory_ctx = await self.get_inventory_context()

        context = {
            "prescription": prescription,
            "prescription_items": prescription.items,
            "settlements": prescription.settlements,
            **inventory_ctx
        }

        results = await run_all_rules(context)

        passed_count = sum(1 for r in results if r.passed)
        failed_count = len(results) - passed_count
        has_high_severity = any(
            not r.passed and r.severity == Severity.HIGH
            for r in results
        )

        await self.db.execute(
            select(RiskFinding).where(RiskFinding.prescription_id == prescription.id)
        )

        for result in results:
            if not result.passed:
                finding = RiskFinding(
                    prescription_id=prescription.id,
                    rule_code=result.rule_code,
                    rule_name=result.rule_name,
                    severity=result.severity,
                    description=result.description,
                    affected_data=json.dumps(result.affected_data, ensure_ascii=False, default=str),
                    is_resolved=0
                )
                self.db.add(finding)

        await self.db.commit()

        return {
            "prescription_no": prescription_no,
            "total_rules": len(results),
            "passed_count": passed_count,
            "failed_count": failed_count,
            "has_high_severity_issues": has_high_severity,
            "results": [
                {
                    "rule_code": r.rule_code,
                    "rule_name": r.rule_name,
                    "passed": r.passed,
                    "severity": r.severity,
                    "description": r.description,
                    "affected_data": r.affected_data
                }
                for r in results
            ]
        }

    async def validate_batch(self, batch_no: str) -> List[Dict[str, Any]]:
        rx_result = await self.db.execute(
            select(Prescription.prescription_no).where(Prescription.batch_no == batch_no)
        )
        prescription_nos = [row[0] for row in rx_result.all()]

        results = []
        for rx_no in prescription_nos:
            try:
                result = await self.validate_prescription(rx_no)
                results.append(result)
            except Exception as e:
                results.append({
                    "prescription_no": rx_no,
                    "error": str(e)
                })

        return results


class ReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_review(self, prescription_id: int) -> ReviewRecord:
        result = await self.db.execute(
            select(ReviewRecord).where(ReviewRecord.prescription_id == prescription_id)
        )
        review = result.scalar_one_or_none()

        if not review:
            review = ReviewRecord(
                prescription_id=prescription_id,
                status=ReviewStatus.PENDING
            )
            self.db.add(review)
            await self.db.commit()
            await self.db.refresh(review)

        return review

    async def update_status(
        self,
        prescription_no: str,
        status: ReviewStatus,
        reviewer: Optional[str] = None,
        review_comment: Optional[str] = None,
        rectification_note: Optional[str] = None
    ) -> ReviewRecord:
        rx_result = await self.db.execute(
            select(Prescription).where(Prescription.prescription_no == prescription_no)
        )
        prescription = rx_result.scalar_one_or_none()

        if not prescription:
            raise ValueError(f"处方号 {prescription_no} 不存在")

        review = await self.get_or_create_review(prescription.id)

        review.status = status
        if reviewer:
            review.reviewer = reviewer
        if review_comment:
            review.review_comment = review_comment
        if rectification_note:
            review.rectification_note = rectification_note
        review.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(review)

        return review

    async def get_review(self, prescription_no: str) -> Optional[ReviewRecord]:
        rx_result = await self.db.execute(
            select(Prescription).where(Prescription.prescription_no == prescription_no)
        )
        prescription = rx_result.scalar_one_or_none()

        if not prescription:
            return None

        result = await self.db.execute(
            select(ReviewRecord).where(ReviewRecord.prescription_id == prescription.id)
        )
        return result.scalar_one_or_none()


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _format_date(self, date_val) -> str:
        if date_val is None:
            return "未填写"
        if isinstance(date_val, datetime):
            return date_val.strftime('%Y-%m-%d')
        if isinstance(date_val, str):
            try:
                return datetime.fromisoformat(date_val.replace('Z', '+00:00')).strftime('%Y-%m-%d')
            except:
                return date_val[:10] if len(date_val) >= 10 else date_val
        return str(date_val)

    async def generate_markdown_report(self, batch_no: Optional[str] = None) -> str:
        from sqlalchemy.orm import selectinload

        query = select(Prescription).options(
            selectinload(Prescription.reviews)
        ).order_by(Prescription.created_at)

        if batch_no:
            query = query.where(Prescription.batch_no == batch_no)

        rx_result = await self.db.execute(query)
        prescriptions = rx_result.scalars().unique().all()

        risk_query = select(RiskFinding).where(RiskFinding.is_resolved == 0)
        if batch_no:
            risk_query = risk_query.join(Prescription).where(Prescription.batch_no == batch_no)

        risk_result = await self.db.execute(risk_query)
        risks = risk_result.scalars().all()

        high_risk_count = sum(1 for r in risks if r.severity == "high")

        def get_review_status(rx):
            if rx.reviews:
                return str(rx.reviews[-1].status)
            return None

        passed_prescriptions = sum(
            1 for p in prescriptions
            if get_review_status(p) in ("approved", "in_review")
        )
        failed_prescriptions = sum(
            1 for p in prescriptions
            if get_review_status(p) in ("rejected", "needs_rectification")
        )

        lines = []
        lines.append(f"# 处方外配复核审计报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        if batch_no:
            lines.append(f"**批次号**: {batch_no}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 一、统计概览")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 处方总数 | {len(prescriptions)} |")
        lines.append(f"| 通过/审核中 | {passed_prescriptions} |")
        lines.append(f"| 驳回/需整改 | {failed_prescriptions} |")
        lines.append(f"| 高风险问题 | {high_risk_count} |")
        lines.append(f"| 风险问题总数 | {len(risks)} |")
        lines.append("")

        lines.append("## 二、处方明细")
        lines.append("")
        for idx, rx in enumerate(prescriptions, 1):
            lines.append(f"### {idx}. 处方号: {rx.prescription_no}")
            lines.append("")
            lines.append(f"- **患者**: {rx.patient_name or '未填写'}")
            lines.append(f"- **处方日期**: {self._format_date(rx.prescription_date)}")
            review = rx.reviews[-1] if rx.reviews else None
            if review:
                lines.append(f"- **复核状态**: {review.status}")
                if review.reviewer:
                    lines.append(f"- **复核人**: {review.reviewer}")
                if review.review_comment:
                    lines.append(f"- **复核意见**: {review.review_comment}")
            else:
                lines.append(f"- **复核状态**: 待审核")
            lines.append("")

        lines.append("## 三、风险问题明细")
        lines.append("")

        if not risks:
            lines.append("> 暂无未解决的风险问题")
            lines.append("")
        else:
            severity_order = {"high": 0, "medium": 1, "low": 2}
            sorted_risks = sorted(risks, key=lambda r: severity_order.get(r.severity, 3))

            for idx, risk in enumerate(sorted_risks, 1):
                severity_label = {"high": "高", "medium": "中", "low": "低"}.get(risk.severity, "未知")
                lines.append(f"### {idx}. 【{severity_label}风险】{risk.rule_name}")
                lines.append("")
                lines.append(f"- **规则代码**: {risk.rule_code}")
                lines.append(f"- **问题描述**: {risk.description}")
                if risk.affected_data and risk.affected_data != "{}":
                    lines.append(f"- **相关数据**: ```json")
                    try:
                        import json
                        data = json.loads(risk.affected_data)
                        lines.append(json.dumps(data, indent=2, ensure_ascii=False))
                    except:
                        lines.append(risk.affected_data)
                    lines.append("```")
                lines.append("")

        lines.append("## 四、复核建议")
        lines.append("")
        if high_risk_count > 0:
            lines.append(f"⚠️ **紧急**: 存在 {high_risk_count} 个高风险问题，建议立即处理。")
            lines.append("")
        if failed_prescriptions > 0:
            lines.append(f"📋 **需关注**: {failed_prescriptions} 张处方处于驳回/需整改状态，请跟进整改。")
            lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*报告由系统自动生成*")

        return "\n".join(lines)

    async def get_report_stats(self, batch_no: Optional[str] = None) -> Dict[str, Any]:
        from sqlalchemy import text

        where_clause = ""
        params = {}
        if batch_no:
            where_clause = "WHERE p.batch_no = :batch_no"
            params["batch_no"] = batch_no

        rx_query = f"SELECT COUNT(*) FROM prescriptions p {where_clause}"
        rx_result = await self.db.execute(text(rx_query), params)
        total_rx = rx_result.scalar() or 0

        risk_query = """
        SELECT COUNT(*) FROM risk_findings rf
        JOIN prescriptions p ON rf.prescription_id = p.id
        WHERE rf.is_resolved = 0
        """ + (f" AND p.batch_no = :batch_no" if batch_no else "")
        risk_result = await self.db.execute(text(risk_query), params)
        total_risks = risk_result.scalar() or 0

        high_risk_query = """
        SELECT COUNT(*) FROM risk_findings rf
        JOIN prescriptions p ON rf.prescription_id = p.id
        WHERE rf.is_resolved = 0 AND rf.severity = 'high'
        """ + (f" AND p.batch_no = :batch_no" if batch_no else "")
        high_result = await self.db.execute(text(high_risk_query), params)
        high_risks = high_result.scalar() or 0

        status_query = f"""
        SELECT r.status, COUNT(*) as cnt
        FROM prescriptions p
        LEFT JOIN review_records r ON p.id = r.prescription_id
        {where_clause}
        GROUP BY r.status
        """
        status_result = await self.db.execute(text(status_query), params)
        status_counts = dict(status_result.fetchall())

        passed = status_counts.get("approved", 0) + status_counts.get("in_review", 0)
        failed = status_counts.get("rejected", 0) + status_counts.get("needs_rectification", 0)

        return {
            "total_prescriptions": total_rx,
            "passed_validations": passed,
            "failed_validations": failed,
            "high_severity_issues": high_risks,
            "total_issues": total_risks
        }
