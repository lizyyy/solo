#!/usr/bin/env python3
import sys
from database import SessionLocal, Template, TemplateField, Form, Extraction, Review, Timeline, TrainingVersion, init_db

def init_sample_data():
    db = SessionLocal()
    
    if db.query(Template).count() > 0:
        print("数据库已有数据，跳过初始化")
        return
    
    template = Template(
        name="报销单模板",
        description="公司标准费用报销单，包含姓名、金额、日期等字段",
        created_by="质量负责人"
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    
    fields = [
        TemplateField(template_id=template.id, field_name="姓名", x1=100, y1=200, x2=200, y2=220, page=1),
        TemplateField(template_id=template.id, field_name="金额", x1=100, y1=250, x2=200, y2=270, page=1),
        TemplateField(template_id=template.id, field_name="日期", x1=300, y1=200, x2=450, y2=220, page=1),
        TemplateField(template_id=template.id, field_name="部门", x1=300, y1=250, x2=450, y2=270, page=1),
    ]
    for field in fields:
        db.add(field)
    db.commit()
    
    forms_data = [
        {"filename": "报销单_001.pdf", "created_by": "张三", "status": "correction_needed", "extractions": [
            {"field_name": "姓名", "value": "张三", "confidence": 0.98},
            {"field_name": "金额", "value": "1000O", "confidence": 0.75},
            {"field_name": "日期", "value": "2024-01-15", "confidence": 0.92},
            {"field_name": "部门", "value": "技术部", "confidence": 0.88},
        ]},
        {"filename": "报销单_002.pdf", "created_by": "李四", "status": "training", "extractions": [
            {"field_name": "姓名", "value": "李四", "confidence": 0.95},
            {"field_name": "金额", "value": "2500", "confidence": 0.82},
            {"field_name": "日期", "value": "2024-01-16", "confidence": 0.90},
            {"field_name": "部门", "value": "产品部", "confidence": 0.85},
        ]},
        {"filename": "报销单_003.pdf", "created_by": "王五", "status": "completed", "extractions": [
            {"field_name": "姓名", "value": "王五", "confidence": 0.97},
            {"field_name": "金额", "value": "1800", "confidence": 0.93},
            {"field_name": "日期", "value": "2024-01-17", "confidence": 0.94},
            {"field_name": "部门", "value": "财务部", "confidence": 0.91},
        ]},
    ]
    
    for form_data in forms_data:
        form = Form(
            template_id=template.id,
            filename=form_data["filename"],
            created_by=form_data["created_by"],
            status=form_data["status"]
        )
        db.add(form)
        db.commit()
        db.refresh(form)
        
        for ext_data in form_data["extractions"]:
            field = next(f for f in fields if f.field_name == ext_data["field_name"])
            extraction = Extraction(
                form_id=form.id,
                field_name=ext_data["field_name"],
                extracted_value=ext_data["value"],
                confidence=ext_data["confidence"],
                x1=field.x1,
                y1=field.y1,
                x2=field.x2,
                y2=field.y2,
                page=field.page
            )
            db.add(extraction)
        
        timeline = Timeline(
            form_id=form.id,
            action="表单抽取",
            actor=form_data["created_by"],
            description=f"基于模板[{template.name}]完成表单字段抽取，共{len(form_data['extractions'])}个字段"
        )
        db.add(timeline)
        
        if form_data["filename"] == "报销单_001.pdf":
            review = Review(
                form_id=form.id,
                reviewer="张主管",
                review_type="manual",
                status="failed",
                reason="字段\"金额\"抽取值\"1000O\"识别错误，应为\"10000\"，OCR将数字0误识别为字母O。"
            )
            db.add(review)
            
            timeline2 = Timeline(
                form_id=form.id,
                action="人工复核",
                actor="张主管",
                description="人工复核结果：处理失败。理由：字段\"金额\"抽取值\"1000O\"识别错误，应为\"10000\"，OCR将数字0误识别为字母O。"
            )
            db.add(timeline2)
            
            review2 = Review(
                form_id=form.id,
                reviewer="李工程师",
                review_type="training",
                status="retrain",
                reason="坐标偏差导致识别错误，需要重新训练模型。已收集3份相似样本用于训练。"
            )
            db.add(review2)
            
            timeline3 = Timeline(
                form_id=form.id,
                action="版本训练",
                actor="李工程师",
                description="版本训练结果：需要重新训练。理由：坐标偏差导致识别错误，需要重新训练模型。已收集3份相似样本用于训练。"
            )
            db.add(timeline3)
    
    training = TrainingVersion(
        version="v1.1",
        description="基于3份纠错样本的模型训练版本，优化OCR数字识别精度",
        trained_by="李工程师",
        form_ids="[1, 2]"
    )
    db.add(training)
    
    db.commit()
    print("样例数据初始化完成！")
    print(f"- 模板: 1份 (含4个字段)")
    print(f"- 表单: 3份")
    print(f"- 训练版本: 1份 (v1.1)")

if __name__ == "__main__":
    init_db()
    init_sample_data()
