import os
import uuid
import io
import csv
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
from pydantic import BaseModel

from .database import engine, get_db, Base
from .models import Product, Correction, Batch, ClassificationRule, Category
from .classifier import CategoryClassifier

Base.metadata.create_all(bind=engine)

app = FastAPI(title="商品标题归类纠错器", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("./data", exist_ok=True)
os.makedirs("./data/exports", exist_ok=True)


class ReviewRequest(BaseModel):
    category: str
    reason: Optional[str] = ""
    operator: Optional[str] = "系统"


class BatchReviewRequest(BaseModel):
    product_ids: List[int]
    category: str
    reason: Optional[str] = ""
    operator: Optional[str] = "系统"


class RollbackRequest(BaseModel):
    reason: Optional[str] = "误判回滚"
    operator: Optional[str] = "系统"


class RuleCreateRequest(BaseModel):
    category: str
    keywords: str
    priority: Optional[int] = 100


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.id)).scalar() or 0
    pending_review = db.query(func.count(Product.id)).filter(
        Product.status == "pending_review"
    ).scalar() or 0
    auto_classified = db.query(func.count(Product.id)).filter(
        Product.status == "auto_classified"
    ).scalar() or 0
    reviewed = db.query(func.count(Product.id)).filter(
        Product.status == "reviewed"
    ).scalar() or 0
    total_corrections = db.query(func.count(Correction.id)).filter(
        Correction.is_rolled_back == 0
    ).scalar() or 0
    rolled_back = db.query(func.count(Correction.id)).filter(
        Correction.is_rolled_back == 1
    ).scalar() or 0

    categories_stats = db.query(
        Product.current_category,
        func.count(Product.id)
    ).filter(
        Product.current_category.isnot(None)
    ).group_by(Product.current_category).all()

    category_distribution = [
        {"category": cat, "count": cnt} for cat, cnt in categories_stats if cat
    ]

    return {
        "total_products": total_products,
        "pending_review": pending_review,
        "auto_classified": auto_classified,
        "reviewed": reviewed,
        "total_corrections": total_corrections,
        "rolled_back": rolled_back,
        "category_distribution": category_distribution
    }


@app.post("/api/import")
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    if file.filename.endswith('.csv'):
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    elif file.filename.endswith(('.xlsx', '.xls')):
        content = await file.read()
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式，请上传 CSV 或 Excel 文件")

    required_columns = ['product_id', 'title']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"缺少必要列: {col}")

    df['product_id'] = df['product_id'].astype(str)
    df['title'] = df['title'].astype(str).fillna('')
    df['category'] = df['category'].astype(str) if 'category' in df.columns else None

    classifier = CategoryClassifier(db)
    items = []
    for _, row in df.iterrows():
        items.append({
            "product_id": row['product_id'],
            "title": row['title'],
            "original_category": row.get('category')
        })

    classified_results = classifier.batch_classify(items)

    batch = Batch(
        batch_id=batch_id,
        filename=file.filename,
        total_count=len(classified_results),
        status="importing"
    )
    db.add(batch)
    db.flush()

    auto_count = 0
    review_count = 0

    for result in classified_results:
        existing = db.query(Product).filter(
            Product.product_id == result['product_id']
        ).first()

        if existing:
            old_category = existing.current_category
            existing.title = result['title']
            existing.original_category = result['original_category']
            existing.current_category = result['predicted_category']
            existing.batch_id = batch_id
            if result['needs_review']:
                existing.status = "pending_review"
                review_count += 1
            else:
                existing.status = "auto_classified"
                auto_count += 1

            if old_category != result['predicted_category'] and result['predicted_category']:
                correction = Correction(
                    product_id=existing.id,
                    batch_id=batch_id,
                    old_category=old_category,
                    new_category=result['predicted_category'],
                    reason=result['reason'],
                    source="auto"
                )
                db.add(correction)
        else:
            product = Product(
                product_id=result['product_id'],
                title=result['title'],
                original_category=result['original_category'],
                current_category=result['predicted_category'],
                batch_id=batch_id,
                status="pending_review" if result['needs_review'] else "auto_classified"
            )
            db.add(product)
            db.flush()

            if result['needs_review']:
                review_count += 1
            else:
                auto_count += 1

            if result['predicted_category']:
                correction = Correction(
                    product_id=product.id,
                    batch_id=batch_id,
                    old_category=result['original_category'],
                    new_category=result['predicted_category'],
                    reason=result['reason'],
                    source="auto"
                )
                db.add(correction)

    batch.auto_classified_count = auto_count
    batch.pending_review_count = review_count
    batch.status = "completed"
    batch.completed_at = datetime.utcnow()

    db.commit()

    return {
        "batch_id": batch_id,
        "total": len(classified_results),
        "auto_classified": auto_count,
        "pending_review": review_count,
        "message": "导入完成"
    }


@app.get("/api/products")
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    if status:
        query = query.filter(Product.status == status)
    if batch_id:
        query = query.filter(Product.batch_id == batch_id)
    if category:
        query = query.filter(Product.current_category == category)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Product.title.like(search_term)) |
            (Product.product_id.like(search_term))
        )

    total = query.count()
    products = query.order_by(Product.updated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    result = []
    for p in products:
        latest_correction = db.query(Correction).filter(
            Correction.product_id == p.id,
            Correction.is_rolled_back == 0
        ).order_by(Correction.created_at.desc()).first()

        result.append({
            "id": p.id,
            "product_id": p.product_id,
            "title": p.title,
            "original_category": p.original_category,
            "current_category": p.current_category,
            "status": p.status,
            "batch_id": p.batch_id,
            "latest_reason": latest_correction.reason if latest_correction else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": result
    }


@app.get("/api/products/{product_id}")
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    corrections = db.query(Correction).filter(
        Correction.product_id == product_id
    ).order_by(Correction.created_at.desc()).all()

    correction_history = []
    for c in corrections:
        correction_history.append({
            "id": c.id,
            "old_category": c.old_category,
            "new_category": c.new_category,
            "reason": c.reason,
            "source": c.source,
            "operator": c.operator,
            "is_rolled_back": c.is_rolled_back,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    return {
        "id": product.id,
        "product_id": product.product_id,
        "title": product.title,
        "original_category": product.original_category,
        "current_category": product.current_category,
        "status": product.status,
        "correction_history": correction_history
    }


@app.post("/api/products/{product_id}/review")
def review_product(
    product_id: int,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    old_category = product.current_category
    new_category = request.category

    if old_category != new_category:
        correction = Correction(
            product_id=product.id,
            old_category=old_category,
            new_category=new_category,
            reason=request.reason or "人工复核修正",
            source="manual",
            operator=request.operator
        )
        db.add(correction)

    product.current_category = new_category
    product.status = "reviewed"
    db.commit()

    return {
        "message": "复核完成",
        "old_category": old_category,
        "new_category": new_category
    }


@app.post("/api/products/batch-review")
def batch_review_products(
    request: BatchReviewRequest,
    db: Session = Depends(get_db)
):
    if not request.product_ids:
        raise HTTPException(status_code=400, detail="请选择要复核的商品")

    products = db.query(Product).filter(
        Product.id.in_(request.product_ids)
    ).all()

    updated_count = 0
    for product in products:
        old_category = product.current_category
        new_category = request.category

        if old_category != new_category:
            correction = Correction(
                product_id=product.id,
                old_category=old_category,
                new_category=new_category,
                reason=request.reason or "批量人工复核",
                source="manual",
                operator=request.operator
            )
            db.add(correction)

        product.current_category = new_category
        product.status = "reviewed"
        updated_count += 1

    db.commit()

    return {
        "message": f"已复核 {updated_count} 个商品",
        "count": updated_count
    }


@app.post("/api/products/{product_id}/rollback")
def rollback_product(
    product_id: int,
    request: RollbackRequest,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    corrections = db.query(Correction).filter(
        Correction.product_id == product_id,
        Correction.is_rolled_back == 0
    ).order_by(Correction.created_at.desc()).all()

    if not corrections:
        raise HTTPException(status_code=400, detail="无可回滚的记录")

    current_category = product.current_category

    corrections[0].is_rolled_back = 1

    if len(corrections) > 1:
        prev_category = corrections[1].old_category or corrections[1].new_category
        product.current_category = prev_category
    else:
        product.current_category = product.original_category

    rollback_correction = Correction(
        product_id=product.id,
        old_category=current_category,
        new_category=product.current_category,
        reason=request.reason,
        source="rollback",
        operator=request.operator
    )
    db.add(rollback_correction)

    product.status = "pending_review"
    db.commit()

    return {
        "message": "回滚成功",
        "old_category": current_category,
        "new_category": product.current_category
    }


@app.get("/api/batches")
def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(func.count(Batch.id)).scalar() or 0
    batches = db.query(Batch).order_by(Batch.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [{
            "id": b.id,
            "batch_id": b.batch_id,
            "filename": b.filename,
            "total_count": b.total_count,
            "auto_classified_count": b.auto_classified_count,
            "pending_review_count": b.pending_review_count,
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "completed_at": b.completed_at.isoformat() if b.completed_at else None
        } for b in batches]
    }


@app.get("/api/rules")
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(ClassificationRule).order_by(
        ClassificationRule.priority.desc(),
        ClassificationRule.created_at.desc()
    ).all()

    return [{
        "id": r.id,
        "category": r.category,
        "keywords": r.keywords,
        "is_active": r.is_active,
        "priority": r.priority,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in rules]


@app.post("/api/rules")
def create_rule(request: RuleCreateRequest, db: Session = Depends(get_db)):
    rule = ClassificationRule(
        category=request.category,
        keywords=request.keywords,
        priority=request.priority,
        is_active=1
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return {
        "message": "规则创建成功",
        "rule": {
            "id": rule.id,
            "category": rule.category,
            "keywords": rule.keywords,
            "priority": rule.priority
        }
    }


@app.put("/api/rules/{rule_id}")
def update_rule(rule_id: int, request: RuleCreateRequest, db: Session = Depends(get_db)):
    rule = db.query(ClassificationRule).filter(ClassificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    rule.category = request.category
    rule.keywords = request.keywords
    rule.priority = request.priority
    db.commit()

    return {"message": "规则更新成功"}


@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(ClassificationRule).filter(ClassificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    db.delete(rule)
    db.commit()

    return {"message": "规则已删除"}


@app.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    classifier = CategoryClassifier(db)
    default_rules = classifier.default_rules
    categories = [rule["category"] for rule in default_rules]

    db_rules = db.query(ClassificationRule).filter(
        ClassificationRule.is_active == 1
    ).all()
    for rule in db_rules:
        if rule.category not in categories:
            categories.append(rule.category)

    return {"categories": sorted(list(set(categories)))}


@app.get("/api/export/report")
def export_report(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    if batch_id:
        query = query.filter(Product.batch_id == batch_id)

    products = query.order_by(Product.updated_at.desc()).all()

    corrections = db.query(Correction).filter(
        Correction.batch_id == batch_id if batch_id else True
    ).all()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"classifier_report_{timestamp}.csv"
    filepath = f"./data/exports/{filename}"

    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow([
            '商品ID', '商品标题', '原始类目', '当前类目', '状态',
            '是否归类正确', '归类原因', '人工复核备注', '导入批次'
        ])

        for p in products:
            latest_correction = db.query(Correction).filter(
                Correction.product_id == p.id,
                Correction.is_rolled_back == 0
            ).order_by(Correction.created_at.desc()).first()

            is_correct = p.status == "reviewed" and p.current_category is not None
            status_map = {
                "pending": "待处理",
                "pending_review": "待复核",
                "auto_classified": "已自动归类",
                "reviewed": "已复核"
            }

            writer.writerow([
                p.product_id,
                p.title,
                p.original_category or '',
                p.current_category or '',
                status_map.get(p.status, p.status),
                '是' if is_correct else '否',
                latest_correction.reason if latest_correction else '',
                latest_correction.operator if latest_correction and latest_correction.source == "manual" else '',
                p.batch_id or ''
            ])

    return FileResponse(
        filepath,
        media_type='text/csv',
        filename=filename
    )


@app.get("/api/export/history")
def export_history(
    product_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Correction)
    if product_id:
        query = query.filter(Correction.product_id == product_id)

    corrections = query.order_by(Correction.created_at.desc()).all()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"correction_history_{timestamp}.csv"
    filepath = f"./data/exports/{filename}"

    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow([
            '修正时间', '商品ID', '原类目', '新类目', '原因',
            '操作类型', '操作人', '是否回滚'
        ])

        source_map = {
            "auto": "自动归类",
            "manual": "人工复核",
            "rollback": "误判回滚"
        }

        for c in corrections:
            product = db.query(Product).filter(Product.id == c.product_id).first()
            writer.writerow([
                c.created_at.strftime('%Y-%m-%d %H:%M:%S') if c.created_at else '',
                product.product_id if product else '',
                c.old_category or '',
                c.new_category or '',
                c.reason or '',
                source_map.get(c.source, c.source),
                c.operator or '',
                '是' if c.is_rolled_back else '否'
            ])

    return FileResponse(
        filepath,
        media_type='text/csv',
        filename=filename
    )


app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
def root():
    return FileResponse("frontend/index.html")
