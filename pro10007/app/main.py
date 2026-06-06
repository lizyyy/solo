from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
from datetime import datetime

from .database import engine, get_db, Base
from .models import (
    Customer, LoanAccount, RepaymentRecord,
    WarningRecord, ReviewRecord, DataImportLog
)
from .data_cleaner import LoanDataCleaner
from .warning_engine import WarningEngine
from . import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="小微贷款展期预警系统",
    description="处理小微贷款展期预警，支持同一客户多账号合并检测、退款跨清算日异常检测",
    version="1.0.0"
)


@app.post("/import/accounts", response_model=schemas.DataImportResponse)
async def import_accounts(
    file: UploadFile = File(..., description="贷款账户数据文件 (Excel/CSV)"),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        cleaner = LoanDataCleaner()
        result = cleaner.clean_dataframe(df, data_type="account")

        customer_map = {}
        for item in result.cleaned_data:
            if item["customer_id"] not in customer_map:
                existing_customer = db.query(Customer).filter(
                    Customer.customer_id == item["customer_id"]
                ).first()
                if not existing_customer:
                    customer = Customer(
                        customer_id=item["customer_id"],
                        customer_name=item.get("customer_name"),
                        id_card=item.get("id_card"),
                        phone=item.get("phone"),
                        data_quality_notes=item.get("data_quality_notes", "")
                    )
                    db.add(customer)
                customer_map[item["customer_id"]] = True

        db.flush()

        for item in result.cleaned_data:
            existing_account = db.query(LoanAccount).filter(
                LoanAccount.account_no == item["account_no"]
            ).first()
            if existing_account:
                continue

            account = LoanAccount(
                account_no=item["account_no"],
                customer_id=item["customer_id"],
                loan_amount=item["loan_amount"],
                outstanding_principal=item["outstanding_principal"],
                interest_rate=item["interest_rate"],
                loan_start_date=item["loan_start_date"],
                loan_due_date=item["loan_due_date"],
                actual_repayment_date=item["actual_repayment_date"],
                status=item["status"],
                data_quality_notes=item["data_quality_notes"],
                raw_data=item["raw_data"]
            )
            db.add(account)

        import_log = DataImportLog(
            file_name=file.filename,
            total_records=len(df),
            valid_records=len(result.cleaned_data),
            invalid_records=len(result.invalid_records),
            cleaning_notes=result.get_notes_summary()
        )
        db.add(import_log)
        db.commit()
        db.refresh(import_log)

        return schemas.DataImportResponse(
            success=True,
            file_name=file.filename,
            total_records=len(df),
            valid_records=len(result.cleaned_data),
            invalid_records=len(result.invalid_records),
            cleaning_notes=result.get_notes_summary(),
            import_log_id=import_log.id
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据导入失败: {str(e)}")


@app.post("/import/repayments", response_model=schemas.DataImportResponse)
async def import_repayments(
    file: UploadFile = File(..., description="还款记录数据文件 (Excel/CSV)"),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        cleaner = LoanDataCleaner()
        result = cleaner.clean_dataframe(df, data_type="repayment")

        for item in result.cleaned_data:
            repayment = RepaymentRecord(
                account_no=item["account_no"],
                repayment_date=item["repayment_date"],
                repayment_amount=item["repayment_amount"],
                repayment_type=item["repayment_type"],
                clearing_date=item["clearing_date"],
                is_refund=item["is_refund"],
                source_material=item["source_material"],
                data_quality_notes=item["data_quality_notes"]
            )
            db.add(repayment)

        import_log = DataImportLog(
            file_name=file.filename,
            total_records=len(df),
            valid_records=len(result.cleaned_data),
            invalid_records=len(result.invalid_records),
            cleaning_notes=result.get_notes_summary()
        )
        db.add(import_log)
        db.commit()
        db.refresh(import_log)

        return schemas.DataImportResponse(
            success=True,
            file_name=file.filename,
            total_records=len(df),
            valid_records=len(result.cleaned_data),
            invalid_records=len(result.invalid_records),
            cleaning_notes=result.get_notes_summary(),
            import_log_id=import_log.id
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据导入失败: {str(e)}")


@app.post("/warnings/run", response_model=schemas.WarningRunResponse)
async def run_warnings(
    warning_days: int = Query(7, description="提前预警天数"),
    db: Session = Depends(get_db)
):
    try:
        engine = WarningEngine(db)
        warnings = engine.run_all_checks(warning_days=warning_days)
        new_count, skip_count = engine.save_warnings(warnings)

        total = db.query(WarningRecord).count()

        return schemas.WarningRunResponse(
            success=True,
            new_warnings=new_count,
            skipped_duplicates=skip_count,
            total_warnings=total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预警检查失败: {str(e)}")


@app.get("/warnings", response_model=List[schemas.WarningWithReviewResponse])
async def get_warnings(
    warning_level: Optional[str] = Query(None, description="按预警级别过滤: HIGH/MEDIUM/LOW"),
    warning_type: Optional[str] = Query(None, description="按预警类型过滤"),
    only_unreviewed: bool = Query(False, description="仅显示未复核的预警"),
    db: Session = Depends(get_db)
):
    query = db.query(WarningRecord)

    if warning_level:
        query = query.filter(WarningRecord.warning_level == warning_level)
    if warning_type:
        query = query.filter(WarningRecord.warning_type == warning_type)
    if only_unreviewed:
        query = query.filter(~WarningRecord.review.has())

    warnings = query.order_by(WarningRecord.warning_level, WarningRecord.created_at.desc()).all()
    return warnings


@app.get("/warnings/{warning_id}", response_model=schemas.WarningWithReviewResponse)
async def get_warning_detail(
    warning_id: int,
    db: Session = Depends(get_db)
):
    warning = db.query(WarningRecord).filter(WarningRecord.id == warning_id).first()
    if not warning:
        raise HTTPException(status_code=404, detail="预警记录不存在")
    return warning


@app.post("/reviews", response_model=schemas.ReviewRecordResponse)
async def create_review(
    review: schemas.ReviewRecordCreate,
    db: Session = Depends(get_db)
):
    warning = db.query(WarningRecord).filter(WarningRecord.id == review.warning_id).first()
    if not warning:
        raise HTTPException(status_code=404, detail="预警记录不存在")

    existing_review = db.query(ReviewRecord).filter(ReviewRecord.warning_id == review.warning_id).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="该预警已复核，请勿重复提交")

    db_review = ReviewRecord(
        warning_id=review.warning_id,
        reviewer=review.reviewer,
        review_result=review.review_result,
        review_comments=review.review_comments,
        exception_explanation=review.exception_explanation
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)

    return db_review


@app.get("/reviews", response_model=List[schemas.ReviewRecordResponse])
async def get_reviews(
    reviewer: Optional[str] = Query(None, description="按复核员过滤"),
    only_exportable: bool = Query(False, description="仅显示可导出的复核记录"),
    db: Session = Depends(get_db)
):
    query = db.query(ReviewRecord)
    if reviewer:
        query = query.filter(ReviewRecord.reviewer == reviewer)
    if only_exportable:
        query = query.filter(ReviewRecord.is_exported == False)

    return query.order_by(ReviewRecord.reviewed_at.desc()).all()


@app.get("/reviews/export", response_class=PlainTextResponse)
async def export_reviews(
    reviewer: Optional[str] = Query(None, description="按复核员过滤"),
    db: Session = Depends(get_db)
):
    query = db.query(ReviewRecord).filter(ReviewRecord.is_exported == False)
    if reviewer:
        query = query.filter(ReviewRecord.reviewer == reviewer)

    reviews = query.all()

    if not reviews:
        return "暂无待导出的复核记录"

    export_lines = []
    export_lines.append("=" * 80)
    export_lines.append("小微贷款展期预警复核记录导出")
    export_lines.append(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    export_lines.append(f"导出记录数: {len(reviews)}")
    export_lines.append("=" * 80)
    export_lines.append("")

    for idx, review in enumerate(reviews, 1):
        warning = db.query(WarningRecord).filter(WarningRecord.id == review.warning_id).first()

        export_lines.append(f"--- 复核记录 #{idx} ---")
        export_lines.append(f"复核ID: {review.id}")
        export_lines.append(f"预警ID: {review.warning_id}")
        export_lines.append(f"复核员: {review.reviewer}")
        export_lines.append(f"复核时间: {review.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        export_lines.append(f"复核结果: {review.review_result}")
        export_lines.append("")

        if warning:
            export_lines.append("【预警信息】")
            export_lines.append(f"  预警类型: {WarningEngine.WARNING_TYPES.get(warning.warning_type, warning.warning_type)}")
            export_lines.append(f"  预警级别: {WarningEngine.WARNING_LEVELS.get(warning.warning_level, warning.warning_level)}")
            export_lines.append(f"  贷款账号: {warning.account_no}")
            export_lines.append(f"  客户编号: {warning.customer_id}")
            export_lines.append(f"  预警内容: {warning.warning_message}")
            export_lines.append(f"  关联材料: {warning.related_materials or '无'}")
            export_lines.append("")

        export_lines.append("【复核意见】")
        export_lines.append(f"  复核评论: {review.review_comments or '无'}")
        export_lines.append("")

        if review.exception_explanation:
            export_lines.append("【异常说明（可直接转发）】")
            export_lines.append(review.exception_explanation)
            export_lines.append("")

        export_lines.append("")

        review.is_exported = True

    db.commit()

    export_content = "\n".join(export_lines)

    return export_content


@app.get("/stats/multi-account-customers", response_model=List[schemas.CustomerStats])
async def get_multi_account_customers(
    db: Session = Depends(get_db)
):
    from collections import defaultdict

    id_card_groups = defaultdict(list)
    customers = db.query(Customer).all()

    for customer in customers:
        if customer.id_card:
            id_card_groups[customer.id_card].append(customer)

    stats = []
    for id_card, customer_list in id_card_groups.items():
        if len(customer_list) > 1:
            customer_ids = [c.customer_id for c in customer_list]
            accounts = db.query(LoanAccount).filter(
                LoanAccount.customer_id.in_(customer_ids)
            ).all()

            warnings_count = db.query(WarningRecord).filter(
                WarningRecord.customer_id.in_(customer_ids),
                WarningRecord.warning_type == "MULTI_ACCOUNT_SAME_CUSTOMER"
            ).count()

            for customer in customer_list:
                customer_accounts = [a for a in accounts if a.customer_id == customer.customer_id]
                total_outstanding = sum(a.outstanding_principal or 0 for a in customer_accounts)

                stats.append(schemas.CustomerStats(
                    customer_id=customer.customer_id,
                    customer_name=customer.customer_name,
                    account_count=len(customer_accounts),
                    total_outstanding=total_outstanding,
                    warning_count=warnings_count
                ))

    return stats


@app.get("/")
async def root():
    return {
        "message": "小微贷款展期预警系统",
        "version": "1.0.0",
        "endpoints": {
            "数据导入": {
                "POST /import/accounts": "导入贷款账户数据",
                "POST /import/repayments": "导入还款记录数据"
            },
            "预警管理": {
                "POST /warnings/run": "执行预警检查",
                "GET /warnings": "查询预警列表",
                "GET /warnings/{id}": "查询预警详情"
            },
            "复核管理": {
                "POST /reviews": "提交复核记录",
                "GET /reviews": "查询复核列表",
                "GET /reviews/export": "导出复核记录"
            },
            "统计分析": {
                "GET /stats/multi-account-customers": "多账号客户统计"
            },
            "API文档": {
                "/docs": "Swagger UI 文档",
                "/redoc": "ReDoc 文档"
            }
        }
    }
