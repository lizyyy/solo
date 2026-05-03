from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, date, timedelta
from typing import Optional, List
import io
import csv

from app.models import (
    get_db, DehydratorRun, ChemicalBatch, LabMoistureResult,
    ReviewRule, ExceptionReview, Shift
)
from app.schemas import (
    ImportResponse, DehydratorRunResponse, ChemicalBatchResponse,
    LabMoistureResultResponse, ExceptionReviewResponse,
    ExceptionReviewResolve, ReviewRuleResponse
)
from app.utils import (
    calculate_file_hash, read_csv_file, read_jsonl_file, read_yaml_file,
    dehydrator_run_from_csv_row, chemical_batch_from_jsonl,
    lab_moisture_from_csv_row, review_rule_from_yaml,
    run_exception_check, batch_runs_by_time, get_shift
)

router = APIRouter(prefix="/import", tags=["导入接口"])


@router.post("/dehydrator-runs", response_model=ImportResponse)
async def import_dehydrator_runs(
    file: UploadFile = File(..., description="脱水机运行记录CSV文件"),
    db: Session = Depends(get_db)
):
    try:
        file_content = await file.read()
        file_hash = calculate_file_hash(file_content)
        
        existing = db.query(DehydratorRun).filter(
            DehydratorRun.file_hash == file_hash
        ).first()
        
        if existing:
            return ImportResponse(
                success=True,
                imported_count=0,
                skipped_count=0,
                message="文件已存在，跳过导入",
                errors=[]
            )
        
        file.file.seek(0)
        df = await read_csv_file(file)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                run_data = dehydrator_run_from_csv_row(row, file.filename)
                
                existing_run = db.query(DehydratorRun).filter(
                    DehydratorRun.run_id == run_data.run_id
                ).first()
                
                if existing_run:
                    skipped_count += 1
                    continue
                
                shift, shift_date = get_shift(run_data.start_time)
                
                db_run = DehydratorRun(
                    run_id=run_data.run_id,
                    machine_id=run_data.machine_id,
                    start_time=run_data.start_time,
                    end_time=run_data.end_time,
                    feed_sludge_volume=run_data.feed_sludge_volume,
                    feed_sludge_concentration=run_data.feed_sludge_concentration,
                    dry_solids_input=run_data.dry_solids_input,
                    shift=shift.value,
                    shift_date=shift_date,
                    batch_id=run_data.batch_id,
                    source_file=file.filename,
                    file_hash=file_hash
                )
                
                if not db_run.batch_id:
                    matched_batch = batch_runs_by_time(db_run, db)
                    if matched_batch:
                        db_run.batch_id = matched_batch.batch_id
                
                db.add(db_run)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx+2} 行: {str(e)}")
                continue
        
        db.commit()
        
        runs = db.query(DehydratorRun).filter(
            DehydratorRun.file_hash == file_hash
        ).all()
        
        for run in runs:
            exceptions = run_exception_check(run, db)
            for exc in exceptions:
                db.add(exc)
        
        db.commit()
        
        return ImportResponse(
            success=True,
            imported_count=imported_count,
            skipped_count=skipped_count,
            message=f"成功导入 {imported_count} 条记录",
            errors=errors
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/chemical-batches", response_model=ImportResponse)
async def import_chemical_batches(
    file: UploadFile = File(..., description="药剂批次JSONL文件"),
    db: Session = Depends(get_db)
):
    try:
        file_content = await file.read()
        file_hash = calculate_file_hash(file_content)
        
        existing = db.query(ChemicalBatch).filter(
            ChemicalBatch.file_hash == file_hash
        ).first()
        
        if existing:
            return ImportResponse(
                success=True,
                imported_count=0,
                skipped_count=0,
                message="文件已存在，跳过导入",
                errors=[]
            )
        
        file.file.seek(0)
        records = await read_jsonl_file(file)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for idx, record in enumerate(records):
            try:
                batch_data = chemical_batch_from_jsonl(record, file.filename)
                
                existing_batch = db.query(ChemicalBatch).filter(
                    ChemicalBatch.batch_id == batch_data.batch_id
                ).first()
                
                if existing_batch:
                    skipped_count += 1
                    continue
                
                db_batch = ChemicalBatch(
                    batch_id=batch_data.batch_id,
                    chemical_type=batch_data.chemical_type,
                    concentration=batch_data.concentration,
                    dosage_rate_target=batch_data.dosage_rate_target,
                    dosage_rate_min=batch_data.dosage_rate_min,
                    dosage_rate_max=batch_data.dosage_rate_max,
                    start_time=batch_data.start_time,
                    end_time=batch_data.end_time,
                    total_chemical_used=batch_data.total_chemical_used,
                    supplier=batch_data.supplier,
                    source_file=file.filename,
                    file_hash=file_hash
                )
                
                db.add(db_batch)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx+1} 条: {str(e)}")
                continue
        
        db.commit()
        
        batches = db.query(ChemicalBatch).filter(
            ChemicalBatch.file_hash == file_hash
        ).all()
        
        for batch in batches:
            unassigned_runs = db.query(DehydratorRun).filter(
                DehydratorRun.batch_id == None,
                DehydratorRun.start_time >= batch.start_time
            ).all()
            
            for run in unassigned_runs:
                if batch.end_time is None or run.start_time <= batch.end_time:
                    run.batch_id = batch.batch_id
        
        db.commit()
        
        return ImportResponse(
            success=True,
            imported_count=imported_count,
            skipped_count=skipped_count,
            message=f"成功导入 {imported_count} 条批次记录",
            errors=errors
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/lab-moisture", response_model=ImportResponse)
async def import_lab_moisture(
    file: UploadFile = File(..., description="实验室含水率CSV文件"),
    db: Session = Depends(get_db)
):
    try:
        file_content = await file.read()
        file_hash = calculate_file_hash(file_content)
        
        existing = db.query(LabMoistureResult).filter(
            LabMoistureResult.file_hash == file_hash
        ).first()
        
        if existing:
            return ImportResponse(
                success=True,
                imported_count=0,
                skipped_count=0,
                message="文件已存在，跳过导入",
                errors=[]
            )
        
        file.file.seek(0)
        df = await read_csv_file(file)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                lab_data = lab_moisture_from_csv_row(row, file.filename)
                
                existing_lab = db.query(LabMoistureResult).filter(
                    LabMoistureResult.result_id == lab_data.result_id
                ).first()
                
                if existing_lab:
                    skipped_count += 1
                    continue
                
                db_lab = LabMoistureResult(
                    result_id=lab_data.result_id,
                    sample_time=lab_data.sample_time,
                    moisture_content=lab_data.moisture_content,
                    cake_solids=lab_data.cake_solids,
                    run_id=lab_data.run_id,
                    batch_id=lab_data.batch_id,
                    tested_by=lab_data.tested_by,
                    tested_at=lab_data.tested_at,
                    source_file=file.filename,
                    file_hash=file_hash
                )
                
                if not db_lab.run_id:
                    nearby_runs = db.query(DehydratorRun).filter(
                        DehydratorRun.start_time <= lab_data.sample_time,
                        (DehydratorRun.end_time == None) | (DehydratorRun.end_time >= lab_data.sample_time)
                    ).all()
                    
                    if nearby_runs:
                        db_lab.run_id = nearby_runs[0].run_id
                
                db.add(db_lab)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx+2} 行: {str(e)}")
                continue
        
        db.commit()
        
        labs = db.query(LabMoistureResult).filter(
            LabMoistureResult.file_hash == file_hash
        ).all()
        
        for lab in labs:
            if lab.run_id:
                run = db.query(DehydratorRun).filter(
                    DehydratorRun.run_id == lab.run_id
                ).first()
                if run:
                    exceptions = run_exception_check(run, db)
                    for exc in exceptions:
                        db.add(exc)
        
        db.commit()
        
        return ImportResponse(
            success=True,
            imported_count=imported_count,
            skipped_count=skipped_count,
            message=f"成功导入 {imported_count} 条实验室记录",
            errors=errors
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/review-rules", response_model=ImportResponse)
async def import_review_rules(
    file: UploadFile = File(..., description="复核规则YAML文件"),
    db: Session = Depends(get_db)
):
    try:
        file_content = await file.read()
        file_hash = calculate_file_hash(file_content)
        
        existing = db.query(ReviewRule).filter(
            ReviewRule.source_file == file.filename
        ).first()
        
        if existing:
            return ImportResponse(
                success=True,
                imported_count=0,
                skipped_count=0,
                message="规则文件已导入，跳过",
                errors=[]
            )
        
        file.file.seek(0)
        yaml_data = await read_yaml_file(file)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        rules = yaml_data.get('rules', yaml_data) if isinstance(yaml_data, dict) else yaml_data
        
        if isinstance(rules, dict):
            rule_list = []
            for rule_id, rule_data in rules.items():
                if isinstance(rule_data, dict):
                    rule_data['rule_id'] = rule_id
                    rule_list.append(rule_data)
            rules = rule_list
        
        if not isinstance(rules, list):
            rules = [rules]
        
        for idx, rule_data in enumerate(rules):
            try:
                rule_id = rule_data.get('rule_id', rule_data.get('id', f"rule_{datetime.now().timestamp()}"))
                
                rule = review_rule_from_yaml(rule_data, str(rule_id))
                
                existing_rule = db.query(ReviewRule).filter(
                    ReviewRule.rule_id == rule.rule_id
                ).first()
                
                if existing_rule:
                    existing_rule.rule_name = rule.rule_name
                    existing_rule.rule_type = rule.rule_type
                    existing_rule.threshold_value = rule.threshold_value
                    existing_rule.min_value = rule.min_value
                    existing_rule.max_value = rule.max_value
                    existing_rule.is_enabled = rule.is_enabled
                    existing_rule.priority = rule.priority
                    skipped_count += 1
                else:
                    db_rule = ReviewRule(
                        rule_id=rule.rule_id,
                        rule_name=rule.rule_name,
                        rule_type=rule.rule_type,
                        threshold_value=rule.threshold_value,
                        min_value=rule.min_value,
                        max_value=rule.max_value,
                        is_enabled=rule.is_enabled,
                        priority=rule.priority,
                        source_file=file.filename
                    )
                    db.add(db_rule)
                    imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx+1} 条规则: {str(e)}")
                continue
        
        db.commit()
        
        return ImportResponse(
            success=True,
            imported_count=imported_count,
            skipped_count=skipped_count,
            message=f"成功导入/更新 {imported_count + skipped_count} 条规则",
            errors=errors
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
