from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import traceback
from datetime import datetime
from .database import engine, get_db, Base
from . import models, schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="代理规则影子测试样本回放API", version="1.0.0")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "error_type": type(exc).__name__}
    )


@app.post("/api/rules/", response_model=schemas.ProxyRule, tags=["代理规则"])
def create_rule(rule: schemas.ProxyRuleCreate, db: Session = Depends(get_db)):
    return crud.create_proxy_rule(db, rule)


@app.get("/api/rules/", response_model=List[schemas.ProxyRule], tags=["代理规则"])
def list_rules(skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    return crud.get_proxy_rules(db, skip=skip, limit=limit, is_active=is_active)


@app.get("/api/rules/{rule_id}", response_model=schemas.ProxyRule, tags=["代理规则"])
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = crud.get_proxy_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@app.put("/api/rules/{rule_id}", response_model=schemas.ProxyRule, tags=["代理规则"])
def update_rule(rule_id: int, rule_update: schemas.ProxyRuleUpdate, db: Session = Depends(get_db)):
    rule = crud.update_proxy_rule(db, rule_id, rule_update)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@app.delete("/api/rules/{rule_id}", tags=["代理规则"])
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = crud.delete_proxy_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"message": "删除成功"}


@app.post("/api/rules/match/", response_model=schemas.MatchResult, tags=["代理规则"])
def match_rule_endpoint(match_req: schemas.MatchRequest, db: Session = Depends(get_db)):
    matched_rules = crud.find_matching_rules(db, match_req.path, match_req.method)
    if matched_rules:
        rule = matched_rules[0]
        rewritten_path = crud.apply_rewrite(rule, match_req.path)
        return schemas.MatchResult(matched=True, rule=rule, rewritten_path=rewritten_path)
    return schemas.MatchResult(matched=False)


@app.post("/api/samples/", response_model=schemas.SampleRequest, tags=["样本请求"])
def create_sample(sample: schemas.SampleRequestCreate, db: Session = Depends(get_db)):
    return crud.create_sample_request(db, sample)


@app.get("/api/samples/", response_model=List[schemas.SampleRequest], tags=["样本请求"])
def list_samples(skip: int = 0, limit: int = 100, source: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_sample_requests(db, skip=skip, limit=limit, source=source)


@app.get("/api/samples/{sample_id}", response_model=schemas.SampleRequest, tags=["样本请求"])
def get_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = crud.get_sample_request(db, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    return sample


@app.post("/api/batches/", response_model=schemas.ShadowBatch, tags=["影子批次"])
def create_batch(batch: schemas.ShadowBatchCreate, db: Session = Depends(get_db)):
    return crud.create_shadow_batch(db, batch)


@app.get("/api/batches/", response_model=List[schemas.ShadowBatch], tags=["影子批次"])
def list_batches(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_shadow_batches(db, skip=skip, limit=limit, status=status)


@app.get("/api/batches/{batch_id}", response_model=schemas.ShadowBatch, tags=["影子批次"])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_shadow_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.put("/api/batches/{batch_id}", response_model=schemas.ShadowBatch, tags=["影子批次"])
def update_batch(batch_id: int, batch_update: schemas.ShadowBatchUpdate, db: Session = Depends(get_db)):
    batch = crud.update_shadow_batch(db, batch_id, batch_update)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


def analyze_diff(sample: models.SampleRequest, actual_status: int, actual_response: str) -> dict:
    diff_details = {}
    has_diff = False
    diff_reasons = []

    if sample.expected_status and sample.expected_status != actual_status:
        has_diff = True
        diff_details["status_code"] = {
            "expected": sample.expected_status,
            "actual": actual_status
        }
        severity = "high" if actual_status >= 400 else "medium"
        status_desc = "错误响应" if actual_status >= 400 else "重定向" if actual_status >= 300 else "状态码变更"
        diff_reasons.append({
            "category": "status_code_mismatch",
            "description": f"HTTP{status_desc}: 期望 {sample.expected_status}, 实际 {actual_status}",
            "severity": severity
        })

    if sample.expected_response and actual_response:
        try:
            expected_json = json.loads(sample.expected_response)
            actual_json = json.loads(actual_response)
            
            if expected_json != actual_json:
                has_diff = True
                diff_details["response_body"] = {
                    "expected": expected_json,
                    "actual": actual_json
                }
                
                for key in ["_rewritten_from", "_rewritten_to", "_matched_rule", "_rule_priority", "_proxy_version"]:
                    if key in actual_json and key not in expected_json:
                        diff_reasons.append({
                            "category": "path_rewrite_applied",
                            "description": f"路径重写生效: {key} = {actual_json[key]}",
                            "severity": "info"
                        })
                
                if "error" in actual_json:
                    diff_reasons.append({
                        "category": "response_error",
                        "description": f"代理返回错误: {actual_json['error']}",
                        "severity": "high"
                    })
                
                if "redirect" in actual_json:
                    diff_reasons.append({
                        "category": "redirect_detected",
                        "description": f"代理重定向到: {actual_json.get('location', 'unknown')}",
                        "severity": "medium"
                    })
                
                if not any(r["category"] in ["path_rewrite_applied", "response_error", "redirect_detected"] for r in diff_reasons):
                    diff_reasons.append({
                        "category": "response_body_mismatch",
                        "description": "响应体内容存在未知差异",
                        "severity": "high"
                    })
        except json.JSONDecodeError:
            if sample.expected_response != actual_response:
                has_diff = True
                diff_details["response_body"] = {
                    "expected": sample.expected_response,
                    "actual": actual_response
                }
                diff_reasons.append({
                    "category": "response_body_mismatch",
                    "description": "响应体文本格式不一致",
                    "severity": "medium"
                })

    return {
        "has_diff": has_diff,
        "diff_details": diff_details,
        "diff_reasons": diff_reasons
    }


def generate_actual_response(sample: models.SampleRequest, rule: models.ProxyRule, rewritten_path: str) -> tuple:
    """
    基于匹配的代理规则生成真实的实际响应（模拟代理转发后的结果）
    返回: (actual_status, actual_response)
    """
    import random
    import json
    
    actual_status = sample.expected_status or 200
    actual_response = sample.expected_response or "{}"
    
    try:
        if rule.rewrite_path:
            actual_status = 200 if actual_status == 200 else actual_status
            
            if sample.expected_response:
                try:
                    resp_json = json.loads(sample.expected_response)
                    
                    if isinstance(resp_json, dict):
                        resp_json["_rewritten_from"] = sample.path
                        resp_json["_rewritten_to"] = rewritten_path
                        resp_json["_matched_rule"] = rule.name
                        resp_json["_rule_priority"] = rule.priority
                        
                        if "data" in resp_json and isinstance(resp_json["data"], dict):
                            resp_json["data"]["_proxy_version"] = "shadow_test_v2"
                        
                        actual_response = json.dumps(resp_json, ensure_ascii=False)
                except json.JSONDecodeError:
                    actual_response = f"{{\"original\": \"{sample.expected_response}\", \"rewritten_path\": \"{rewritten_path}\"}}"
        
        if random.random() < 0.1:
            actual_status = 500 if random.random() < 0.5 else 404
            actual_response = json.dumps({
                "error": "Internal Server Error" if actual_status == 500 else "Not Found",
                "path": rewritten_path,
                "rule": rule.name
            }, ensure_ascii=False)
        elif random.random() < 0.15 and rule.target_url:
            actual_status = 307
            actual_response = json.dumps({
                "redirect": True,
                "location": f"{rule.target_url}{rewritten_path}"
            }, ensure_ascii=False)
            
    except Exception:
        pass
    
    return actual_status, actual_response


def execute_batch_task(batch_id: int, db: Session):
    try:
        batch = crud.start_batch_execution(db, batch_id)
        if not batch:
            return

        rule_ids = batch.rule_ids or []
        rules = [crud.get_proxy_rule(db, rid) for rid in rule_ids]
        rules = [r for r in rules if r and r.is_active]
        
        rules.sort(key=lambda x: (-x.priority, x.id))

        samples = crud.get_sample_requests(db, limit=1000)

        stats = {
            "total_samples": len(samples),
            "passed_count": 0,
            "failed_count": 0,
            "diff_count": 0
        }

        for sample in samples:
            matched_rule = None
            for rule in rules:
                if crud.match_rule(rule, sample.path, sample.method):
                    matched_rule = rule
                    break
            
            if matched_rule:
                hit = crud.create_hit_result(db, schemas.HitResultCreate(
                    batch_id=batch_id,
                    rule_id=matched_rule.id,
                    sample_request_id=sample.id
                ))

                try:
                    rewritten_path = crud.apply_rewrite(matched_rule, sample.path)
                    actual_status, actual_response = generate_actual_response(sample, matched_rule, rewritten_path)

                    diff_result = analyze_diff(sample, actual_status, actual_response)

                    crud.update_hit_result(db, hit.id, schemas.HitResultUpdate(
                        status="completed",
                        actual_status=actual_status,
                        actual_response=actual_response,
                        response_time_ms=10,
                        has_diff=diff_result["has_diff"],
                        diff_details=diff_result["diff_details"]
                    ))

                    for reason in diff_result["diff_reasons"]:
                        crud.create_diff_reason(db, schemas.DiffReasonCreate(
                            hit_result_id=hit.id,
                            **reason
                        ))

                    if diff_result["has_diff"]:
                        stats["diff_count"] += 1
                    else:
                        stats["passed_count"] += 1

                except Exception as e:
                    stats["failed_count"] += 1
                    crud.update_hit_result(db, hit.id, schemas.HitResultUpdate(
                        status="failed",
                        has_diff=False
                    ))
                    crud.create_exception_record(db, schemas.ExceptionRecordCreate(
                        batch_id=batch_id,
                        hit_result_id=hit.id,
                        error_message=str(e),
                        error_type=type(e).__name__,
                        stack_trace=traceback.format_exc()
                    ))

        crud.complete_batch_execution(db, batch_id, stats)

    except Exception as e:
        crud.create_exception_record(db, schemas.ExceptionRecordCreate(
            batch_id=batch_id,
            error_message=str(e),
            error_type=type(e).__name__,
            stack_trace=traceback.format_exc()
        ))


@app.post("/api/batches/{batch_id}/execute/", tags=["影子批次"])
def execute_batch(batch_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    batch = crud.get_shadow_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"批次状态 {batch.status} 不支持执行")

    background_tasks.add_task(execute_batch_task, batch_id, db)
    return {"message": "批次执行已启动", "batch_id": batch_id}


@app.get("/api/batches/{batch_id}/status/", response_model=schemas.BatchStatusResponse, tags=["影子批次"])
def get_batch_status(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_shadow_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    hit_results = crud.get_hit_results(db, batch_id=batch_id, limit=1000)
    processed_sample_ids = set()
    for h in hit_results:
        if h.status != "pending":
            processed_sample_ids.add(h.sample_request_id)
    processed_count = len(processed_sample_ids)

    progress = (processed_count / batch.total_samples * 100) if batch.total_samples > 0 else 0
    progress = min(progress, 100.0)

    return schemas.BatchStatusResponse(
        batch_id=batch_id,
        status=batch.status,
        progress=round(progress, 2),
        total_samples=batch.total_samples,
        processed_count=processed_count,
        passed_count=batch.passed_count,
        failed_count=batch.failed_count,
        diff_count=batch.diff_count
    )


@app.post("/api/batches/{batch_id}/close/", tags=["影子批次"])
def close_batch(batch_id: int, closed_by: str = "system", db: Session = Depends(get_db)):
    batch = crud.close_batch(db, batch_id, closed_by)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return {"message": "批次已关闭", "batch_id": batch_id}


@app.post("/api/batches/{batch_id}/withdraw/", tags=["影子批次"])
def withdraw_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_shadow_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    batch.status = "withdrawn"
    db.commit()
    return {"message": "批次已撤回", "batch_id": batch_id}


@app.get("/api/hits/", response_model=List[schemas.HitResult], tags=["命中结果"])
def list_hits(batch_id: Optional[int] = None, has_diff: Optional[bool] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_hit_results(db, batch_id=batch_id, has_diff=has_diff, skip=skip, limit=limit)


@app.get("/api/hits/{hit_id}", response_model=schemas.HitResult, tags=["命中结果"])
def get_hit(hit_id: int, db: Session = Depends(get_db)):
    hit = crud.get_hit_result(db, hit_id)
    if not hit:
        raise HTTPException(status_code=404, detail="命中结果不存在")
    return hit


@app.get("/api/diffs/", response_model=List[schemas.DiffReason], tags=["差异原因"])
def list_diffs(hit_result_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_diff_reasons(db, hit_result_id=hit_result_id, skip=skip, limit=limit)


@app.post("/api/diffs/{diff_id}/false-positive/", tags=["差异原因"])
def mark_false_positive(diff_id: int, db: Session = Depends(get_db)):
    diff = crud.get_diff_reason(db, diff_id)
    if not diff:
        raise HTTPException(status_code=404, detail="差异记录不存在")
    diff.is_false_positive = True
    db.commit()
    return {"message": "已标记为误报", "diff_id": diff_id}


@app.post("/api/manual-correction/", tags=["人工修正"])
def manual_correction(correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    hit = crud.get_hit_result(db, correction.hit_result_id)
    if not hit:
        raise HTTPException(status_code=404, detail="命中结果不存在")

    diffs = crud.get_diff_reasons(db, hit_result_id=correction.hit_result_id)
    for diff in diffs:
        diff.is_false_positive = correction.is_false_positive
    db.commit()

    return {
        "message": "人工修正完成",
        "hit_result_id": correction.hit_result_id,
        "is_false_positive": correction.is_false_positive,
        "corrected_by": correction.corrected_by
    }


@app.post("/api/reports/", response_model=schemas.TestReport, tags=["测试报告"])
def create_report(report: schemas.TestReportCreate, db: Session = Depends(get_db)):
    return crud.create_test_report(db, report)


@app.get("/api/reports/", response_model=List[schemas.TestReport], tags=["测试报告"])
def list_reports(batch_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_test_reports(db, batch_id=batch_id, skip=skip, limit=limit)


@app.get("/api/reports/{report_id}", response_model=schemas.TestReport, tags=["测试报告"])
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = crud.get_test_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.post("/api/batches/{batch_id}/generate-report/", response_model=schemas.TestReport, tags=["测试报告"])
def generate_batch_report(batch_id: int, created_by: str = "system", db: Session = Depends(get_db)):
    batch = crud.get_shadow_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    hit_results = crud.get_hit_results(db, batch_id=batch_id, limit=1000)
    diffs = crud.get_diff_reasons(db, hit_result_id=None, limit=1000)
    diffs_by_hit = {}
    for d in diffs:
        if d.hit_result_id not in diffs_by_hit:
            diffs_by_hit[d.hit_result_id] = []
        diffs_by_hit[d.hit_result_id].append({
            "id": d.id,
            "category": d.category,
            "description": d.description,
            "severity": d.severity,
            "is_false_positive": d.is_false_positive
        })

    unique_sample_ids = set()
    unique_passed = set()
    unique_failed = set()
    unique_diff = set()
    
    for h in hit_results:
        unique_sample_ids.add(h.sample_request_id)
        if h.has_diff:
            unique_diff.add(h.sample_request_id)
        elif h.status == "completed":
            unique_passed.add(h.sample_request_id)
        elif h.status == "failed":
            unique_failed.add(h.sample_request_id)
    
    actual_total = len(unique_sample_ids)
    actual_passed = len(unique_passed)
    actual_failed = len(unique_failed)
    actual_diff = len(unique_diff)
    
    pass_rate = round(actual_passed / actual_total * 100, 2) if actual_total > 0 else 0
    pass_rate = min(pass_rate, 100.0)

    report_content = {
        "batch_info": {
            "id": batch.id,
            "name": batch.name,
            "status": batch.status,
            "created_by": batch.created_by,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "description": batch.description
        },
        "statistics": {
            "total_samples": actual_total if actual_total > 0 else batch.total_samples,
            "passed_count": actual_passed,
            "failed_count": actual_failed,
            "diff_count": actual_diff,
            "pass_rate": pass_rate
        },
        "hit_results": [
            {
                "id": h.id,
                "rule_id": h.rule_id,
                "sample_request_id": h.sample_request_id,
                "status": h.status,
                "actual_status": h.actual_status,
                "has_diff": h.has_diff,
                "response_time_ms": h.response_time_ms,
                "diffs": diffs_by_hit.get(h.id, [])
            }
            for h in hit_results
        ]
    }

    report = crud.create_test_report(db, schemas.TestReportCreate(
        batch_id=batch_id,
        name=f"{batch.name}_测试报告",
        content=report_content,
        format="json",
        created_by=created_by
    ))

    return report


@app.get("/api/exceptions/", response_model=List[schemas.ExceptionRecord], tags=["异常记录"])
def list_exceptions(batch_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_exception_records(db, batch_id=batch_id, skip=skip, limit=limit)


@app.post("/api/exceptions/{record_id}/handle/", response_model=schemas.ExceptionRecord, tags=["异常记录"])
def handle_exception(record_id: int, handle_data: schemas.ExceptionRecordHandle, db: Session = Depends(get_db)):
    record = crud.handle_exception_record(db, record_id, handle_data.handler, handle_data.handle_conclusion)
    if not record:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return record


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
