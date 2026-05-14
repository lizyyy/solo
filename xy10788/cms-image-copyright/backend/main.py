from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import os
import shutil
import hashlib
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse

from database import get_db, engine, Base
from models import Image, ImageUsage, ReplacementRecord, CopyrightExtension
from schemas import (
    ImageCreate, ImageResponse, ImageUsageCreate, ImageUsageResponse,
    ReplacementInitiate, ReplacementResponse, CopyrightExtensionCreate,
    CopyrightExtensionResponse, RiskExportItem, UsageDetail
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CMS图片版权追踪系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "../uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def calculate_image_status(expiry_date: datetime) -> str:
    now = datetime.utcnow()
    days_until_expiry = (expiry_date - now).days
    
    if days_until_expiry < 0:
        return "expired"
    elif days_until_expiry <= 30:
        return "expiring_soon"
    else:
        return "normal"

@app.post("/api/images/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    original_url: str = Query(...),
    copyright_holder: str = Query(...),
    license_type: str = Query(...),
    copyright_expiry_date: str = Query(...),
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    existing = db.query(Image).filter(Image.original_url == original_url).first()
    if existing:
        raise HTTPException(status_code=400, detail="图片URL已存在")
    
    try:
        expiry_date = datetime.fromisoformat(copyright_expiry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用ISO格式")
    
    file_ext = os.path.splitext(file.filename)[1]
    file_hash = hashlib.md5(f"{original_url}{datetime.utcnow()}".encode()).hexdigest()
    saved_filename = f"{file_hash}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    status = calculate_image_status(expiry_date)
    
    db_image = Image(
        original_url=original_url,
        file_name=file.filename,
        file_path=saved_filename,
        copyright_holder=copyright_holder,
        license_type=license_type,
        copyright_expiry_date=expiry_date,
        notes=notes,
        status=status
    )
    
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    
    return db_image

@app.get("/api/images", response_model=List[ImageResponse])
def get_images(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Image)
    if status:
        query = query.filter(Image.status == status)
    
    images = query.all()
    for img in images:
        img.status = calculate_image_status(img.copyright_expiry_date)
        img.usage_count = db.query(ImageUsage).filter(ImageUsage.image_id == img.id, ImageUsage.is_active == True).count()
    
    db.commit()
    return images

@app.get("/api/images/{image_id}", response_model=ImageResponse)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    
    image.status = calculate_image_status(image.copyright_expiry_date)
    image.usage_count = db.query(ImageUsage).filter(ImageUsage.image_id == image_id, ImageUsage.is_active == True).count()
    db.commit()
    
    return image

@app.post("/api/images/{image_id}/usages", response_model=ImageUsageResponse)
def add_image_usage(usage: ImageUsageCreate, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == usage.image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    
    existing = db.query(ImageUsage).filter(
        ImageUsage.image_id == usage.image_id,
        ImageUsage.page_url == usage.page_url,
        ImageUsage.is_active == True
    ).first()
    
    if existing:
        return existing
    
    db_usage = ImageUsage(**usage.dict())
    db.add(db_usage)
    db.commit()
    db.refresh(db_usage)
    
    return db_usage

@app.get("/api/images/{image_id}/usages", response_model=List[UsageDetail])
def get_image_usages(image_id: int, db: Session = Depends(get_db)):
    usages = db.query(ImageUsage).filter(
        ImageUsage.image_id == image_id,
        ImageUsage.is_active == True
    ).all()
    
    return usages

@app.get("/api/pages/by-image-url")
def get_pages_by_image_url(image_url: str, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.original_url == image_url).first()
    if not image:
        return {"pages": [], "image_found": False}
    
    usages = db.query(ImageUsage).filter(
        ImageUsage.image_id == image.id,
        ImageUsage.is_active == True
    ).all()
    
    return {
        "image_found": True,
        "image_id": image.id,
        "image_status": calculate_image_status(image.copyright_expiry_date),
        "copyright_expiry_date": image.copyright_expiry_date,
        "pages": [
            {
                "page_url": u.page_url,
                "page_title": u.page_title,
                "usage_location": u.usage_location,
                "added_at": u.added_at
            }
            for u in usages
        ]
    }

@app.post("/api/replacements/initiate", response_model=ReplacementResponse)
def initiate_replacement(replacement: ReplacementInitiate, db: Session = Depends(get_db)):
    old_image = db.query(Image).filter(Image.id == replacement.old_image_id).first()
    new_image = db.query(Image).filter(Image.id == replacement.new_image_id).first()
    
    if not old_image or not new_image:
        raise HTTPException(status_code=404, detail="图片不存在")
    
    old_status = calculate_image_status(old_image.copyright_expiry_date)
    if old_status != "expired":
        pass
    
    usage = db.query(ImageUsage).filter(
        ImageUsage.image_id == replacement.old_image_id,
        ImageUsage.page_url == replacement.page_url,
        ImageUsage.is_active == True
    ).first()
    
    if not usage:
        raise HTTPException(status_code=404, detail="该页面未使用此图片")
    
    replacement_key = hashlib.md5(
        f"{replacement.old_image_id}_{replacement.new_image_id}_{replacement.page_url}".encode()
    ).hexdigest()
    
    existing = db.query(ReplacementRecord).filter(ReplacementRecord.replacement_key == replacement_key).first()
    if existing:
        return existing
    
    db_replacement = ReplacementRecord(
        old_image_id=replacement.old_image_id,
        new_image_id=replacement.new_image_id,
        page_url=replacement.page_url,
        old_url=old_image.original_url,
        new_url=new_image.original_url,
        status="in_progress",
        initiated_by=replacement.initiated_by,
        replacement_key=replacement_key
    )
    
    db.add(db_replacement)
    db.commit()
    db.refresh(db_replacement)
    
    try:
        usage.is_active = False
        new_usage = ImageUsage(
            image_id=replacement.new_image_id,
            page_url=replacement.page_url,
            page_title=usage.page_title,
            usage_location=usage.usage_location,
            is_active=True
        )
        db.add(new_usage)
        
        db_replacement.status = "completed"
        db_replacement.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(db_replacement)
        
    except Exception as e:
        db_replacement.status = "failed"
        db_replacement.error_message = str(e)
        db.commit()
        db.refresh(db_replacement)
        raise HTTPException(status_code=500, detail=f"替换失败: {str(e)}")
    
    return db_replacement

@app.get("/api/replacements", response_model=List[ReplacementResponse])
def get_replacements(
    status: Optional[str] = None,
    page_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReplacementRecord)
    if status:
        query = query.filter(ReplacementRecord.status == status)
    if page_url:
        query = query.filter(ReplacementRecord.page_url == page_url)
    
    return query.order_by(ReplacementRecord.initiated_at.desc()).all()

@app.post("/api/copyright/extend", response_model=CopyrightExtensionResponse)
def extend_copyright(extension: CopyrightExtensionCreate, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == extension.image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    
    if extension.new_expiry_date <= image.copyright_expiry_date:
        raise HTTPException(status_code=400, detail="新的到期日期必须晚于当前到期日期")
    
    db_extension = CopyrightExtension(
        image_id=extension.image_id,
        previous_expiry_date=image.copyright_expiry_date,
        new_expiry_date=extension.new_expiry_date,
        extended_by=extension.extended_by,
        reason=extension.reason
    )
    
    image.copyright_expiry_date = extension.new_expiry_date
    image.status = calculate_image_status(extension.new_expiry_date)
    
    db.add(db_extension)
    db.commit()
    db.refresh(db_extension)
    
    return db_extension

@app.get("/api/risk/export")
def export_risks(format: str = "excel", db: Session = Depends(get_db)):
    now = datetime.utcnow()
    images = db.query(Image).all()
    
    risk_data = []
    for img in images:
        status = calculate_image_status(img.copyright_expiry_date)
        days_until_expiry = (img.copyright_expiry_date - now).days
        
        usages = db.query(ImageUsage).filter(
            ImageUsage.image_id == img.id,
            ImageUsage.is_active == True
        ).all()
        usage_pages = [u.page_url for u in usages]
        
        if status in ["expired", "expiring_soon"]:
            risk_data.append({
                "图片ID": img.id,
                "原始URL": img.original_url,
                "文件名": img.file_name,
                "风险状态": "已过期" if status == "expired" else "即将过期",
                "版权到期日期": img.copyright_expiry_date.strftime("%Y-%m-%d"),
                "版权方": img.copyright_holder,
                "授权类型": img.license_type,
                "使用页面数量": len(usage_pages),
                "使用页面": ", ".join(usage_pages),
                "距离过期天数": days_until_expiry,
                "上传日期": img.upload_date.strftime("%Y-%m-%d")
            })
    
    df = pd.DataFrame(risk_data)
    
    if format == "excel":
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='版权风险')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=copyright_risk_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    else:
        return StreamingResponse(
            iter([df.to_csv(index=False)]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=copyright_risk_{datetime.now().strftime('%Y%m%d')}.csv"}
        )

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    thirty_days_later = now + timedelta(days=30)
    
    total_images = db.query(Image).count()
    expired_count = db.query(Image).filter(Image.copyright_expiry_date < now).count()
    expiring_soon_count = db.query(Image).filter(
        Image.copyright_expiry_date >= now,
        Image.copyright_expiry_date <= thirty_days_later
    ).count()
    
    total_replacements = db.query(ReplacementRecord).count()
    failed_replacements = db.query(ReplacementRecord).filter(ReplacementRecord.status == "failed").count()
    
    return {
        "total_images": total_images,
        "expired_count": expired_count,
        "expiring_soon_count": expiring_soon_count,
        "normal_count": total_images - expired_count - expiring_soon_count,
        "total_replacements": total_replacements,
        "failed_replacements": failed_replacements
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
