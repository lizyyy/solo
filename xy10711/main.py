from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import os
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from database import get_db, init_db, Template, TemplateField, Form, Extraction, Review, Timeline, TrainingVersion

app = FastAPI(title="PDF表单抽取复核系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    created_by: str
    fields: List[dict]


class FormCreate(BaseModel):
    template_id: int
    filename: str
    created_by: str


class ReviewCreate(BaseModel):
    form_id: int
    reviewer: str
    review_type: str
    status: str
    reason: str


class ExtractionUpdate(BaseModel):
    is_correct: bool
    corrected_value: Optional[str] = None


class TrainingCreate(BaseModel):
    version: str
    description: str
    trained_by: str
    form_ids: List[int]


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def read_root():
    return FileResponse("static/index.html")


@app.get("/api/templates")
def get_templates(db: Session = Depends(get_db)):
    templates = db.query(Template).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat(),
            "fields_count": len(t.fields),
            "forms_count": len(t.forms)
        }
        for t in templates
    ]


@app.post("/api/templates")
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    db_template = Template(
        name=template.name,
        description=template.description,
        created_by=template.created_by
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    for field in template.fields:
        db_field = TemplateField(
            template_id=db_template.id,
            field_name=field["field_name"],
            x1=field["x1"],
            y1=field["y1"],
            x2=field["x2"],
            y2=field["y2"],
            page=field.get("page", 1),
            expected_value=field.get("expected_value"),
            is_required=field.get("is_required", True)
        )
        db.add(db_field)
    
    db.commit()
    return {"id": db_template.id, "message": "模板创建成功"}


@app.get("/api/templates/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "created_by": template.created_by,
        "created_at": template.created_at.isoformat(),
        "fields": [
            {
                "id": f.id,
                "field_name": f.field_name,
                "x1": f.x1,
                "y1": f.y1,
                "x2": f.x2,
                "y2": f.y2,
                "page": f.page,
                "expected_value": f.expected_value,
                "is_required": f.is_required
            }
            for f in template.fields
        ]
    }


@app.get("/api/forms")
def get_forms(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Form)
    if status:
        query = query.filter(Form.status == status)
    forms = query.all()
    
    result = []
    for form in forms:
        correct_count = db.query(Extraction).filter(
            Extraction.form_id == form.id,
            Extraction.is_correct == True
        ).count()
        total_count = len(form.extractions)
        
        result.append({
            "id": form.id,
            "template_id": form.template_id,
            "template_name": form.template.name if form.template else None,
            "filename": form.filename,
            "status": form.status,
            "created_by": form.created_by,
            "created_at": form.created_at.isoformat(),
            "correct_rate": correct_count / total_count if total_count > 0 else 0,
            "extractions_count": total_count
        })
    return result


@app.post("/api/forms")
def create_form(form: FormCreate, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == form.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    db_form = Form(
        template_id=form.template_id,
        filename=form.filename,
        created_by=form.created_by,
        status="extracted"
    )
    db.add(db_form)
    db.commit()
    db.refresh(db_form)

    for field in template.fields:
        extracted_value = f"抽取_{field.field_name}_{db_form.id}"
        if field.field_name == "姓名":
            extracted_value = "张三"
        elif field.field_name == "金额":
            extracted_value = "10000" if db_form.id % 2 == 1 else "1000O"
        
        db_extraction = Extraction(
            form_id=db_form.id,
            field_name=field.field_name,
            extracted_value=extracted_value,
            confidence=0.85 if db_form.id % 2 == 0 else 0.95,
            x1=field.x1,
            y1=field.y1,
            x2=field.x2,
            y2=field.y2,
            page=field.page
        )
        db.add(db_extraction)
    
    db_timeline = Timeline(
        form_id=db_form.id,
        action="表单抽取",
        actor=form.created_by,
        description=f"基于模板[{template.name}]完成表单字段抽取，共{len(template.fields)}个字段"
    )
    db.add(db_timeline)
    db.commit()
    
    return {"id": db_form.id, "message": "表单创建成功"}


@app.get("/api/forms/{form_id}")
def get_form(form_id: int, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    
    extractions = []
    for ext in form.extractions:
        extractions.append({
            "id": ext.id,
            "field_name": ext.field_name,
            "extracted_value": ext.extracted_value,
            "confidence": ext.confidence,
            "is_correct": ext.is_correct,
            "corrected_value": ext.corrected_value,
            "x1": ext.x1,
            "y1": ext.y1,
            "x2": ext.x2,
            "y2": ext.y2,
            "page": ext.page
        })
    
    reviews = []
    for rev in form.reviews:
        reviews.append({
            "id": rev.id,
            "reviewer": rev.reviewer,
            "review_type": rev.review_type,
            "status": rev.status,
            "reason": rev.reason,
            "created_at": rev.created_at.isoformat()
        })
    
    timeline = []
    for tl in form.timeline:
        timeline.append({
            "id": tl.id,
            "action": tl.action,
            "actor": tl.actor,
            "description": tl.description,
            "created_at": tl.created_at.isoformat()
        })
    
    return {
        "id": form.id,
        "template_id": form.template_id,
        "template_name": form.template.name if form.template else None,
        "filename": form.filename,
        "status": form.status,
        "created_by": form.created_by,
        "created_at": form.created_at.isoformat(),
        "extractions": extractions,
        "reviews": reviews,
        "timeline": timeline
    }


@app.put("/api/extractions/{extraction_id}")
def update_extraction(extraction_id: int, update: ExtractionUpdate, db: Session = Depends(get_db)):
    extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="抽取记录不存在")
    
    extraction.is_correct = update.is_correct
    if update.corrected_value:
        extraction.corrected_value = update.corrected_value
    
    db.commit()
    
    form = db.query(Form).filter(Form.id == extraction.form_id).first()
    all_extractions = db.query(Extraction).filter(Extraction.form_id == form.id).all()
    all_correct = all(e.is_correct for e in all_extractions if e.is_correct is not None)
    
    if all_correct and len([e for e in all_extractions if e.is_correct is not None]) == len(all_extractions):
        form.status = "reviewed"
    
    return {"message": "更新成功"}


@app.post("/api/reviews")
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.id == review.form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    
    db_review = Review(
        form_id=review.form_id,
        reviewer=review.reviewer,
        review_type=review.review_type,
        status=review.status,
        reason=review.reason
    )
    db.add(db_review)
    
    action_map = {
        "manual": "人工复核",
        "training": "版本训练",
        "export": "导出复核"
    }
    action = action_map.get(review.review_type, "复核处理")
    
    db_timeline = Timeline(
        form_id=review.form_id,
        action=action,
        actor=review.reviewer,
        description=f"{action}结果：{review.status}。理由：{review.reason}"
    )
    db.add(db_timeline)
    
    if review.status == "failed":
        form.status = "correction_needed"
    elif review.status == "retrain":
        form.status = "training"
    elif review.status == "success":
        form.status = "completed"
    
    db.commit()
    return {"id": db_review.id, "message": "复核记录创建成功"}


@app.post("/api/recalculate/{form_id}")
def recalculate_form(form_id: int, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    
    template = db.query(Template).filter(Template.id == form.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    for extraction in form.extractions:
        field = next((f for f in template.fields if f.field_name == extraction.field_name), None)
        if field:
            extraction.x1 = field.x1
            extraction.y1 = field.y1
            extraction.x2 = field.x2
            extraction.y2 = field.y2
            extraction.page = field.page
    
    db_timeline = Timeline(
        form_id=form_id,
        action="坐标重算",
        actor="system",
        description=f"根据模板最新字段坐标重新计算了{len(form.extractions)}个字段的位置"
    )
    db.add(db_timeline)
    db.commit()
    
    return {"message": "重新计算完成"}


@app.post("/api/training")
def create_training(training: TrainingCreate, db: Session = Depends(get_db)):
    db_training = TrainingVersion(
        version=training.version,
        description=training.description,
        trained_by=training.trained_by,
        form_ids=json.dumps(training.form_ids)
    )
    db.add(db_training)
    
    for form_id in training.form_ids:
        form = db.query(Form).filter(Form.id == form_id).first()
        if form:
            form.status = "trained"
            db_timeline = Timeline(
                form_id=form_id,
                action="版本训练",
                actor=training.trained_by,
                description=f"已纳入版本训练 {training.version}：{training.description}"
            )
            db.add(db_timeline)
    
    db.commit()
    return {"id": db_training.id, "message": "训练版本创建成功"}


@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_forms = db.query(Form).count()
    status_stats = {}
    for status in ["pending", "extracted", "reviewed", "correction_needed", "training", "trained", "completed"]:
        count = db.query(Form).filter(Form.status == status).count()
        if count > 0:
            status_stats[status] = count
    
    recent_forms = db.query(Form).order_by(Form.created_at.desc()).limit(5).all()
    
    return {
        "total_forms": total_forms,
        "status_stats": status_stats,
        "recent_forms": [
            {
                "id": f.id,
                "filename": f.filename,
                "status": f.status,
                "created_at": f.created_at.isoformat()
            }
            for f in recent_forms
        ]
    }


@app.get("/api/export/{form_id}")
def export_form(form_id: int, db: Session = Depends(get_db)):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, height - 100, f"表单复核导出报告")
    c.setFont("Helvetica", 12)
    c.drawString(100, height - 130, f"表单：{form.filename}")
    c.drawString(100, height - 150, f"状态：{form.status}")
    c.drawString(100, height - 170, f"创建时间：{form.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    
    y = height - 220
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, y, "字段名")
    c.drawString(250, y, "抽取值")
    c.drawString(400, y, "是否正确")
    c.drawString(500, y, "修正值")
    
    c.setFont("Helvetica", 10)
    for ext in form.extractions:
        y -= 30
        c.drawString(100, y, ext.field_name)
        c.drawString(250, y, ext.extracted_value or "")
        c.drawString(400, y, "是" if ext.is_correct else "否" if ext.is_correct is not None else "待复核")
        c.drawString(500, y, ext.corrected_value or "")
    
    y -= 60
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, y, "处理时间线")
    c.setFont("Helvetica", 10)
    for tl in form.timeline:
        y -= 30
        c.drawString(100, y, f"[{tl.created_at.strftime('%Y-%m-%d %H:%M')}] {tl.actor} - {tl.action}")
        y -= 20
        c.drawString(120, y, tl.description)
    
    c.save()
    buffer.seek(0)
    
    filename = f"export_{form.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    with open(f"uploads/{filename}", "wb") as f:
        f.write(buffer.getvalue())
    
    return FileResponse(f"uploads/{filename}", filename=filename)


@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    contents = await file.read()
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as f:
        f.write(contents)
    return {"filename": file.filename, "path": file_path}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
