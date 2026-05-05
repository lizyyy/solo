from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
import json

from database import get_db
from models import AuditSession, RedisKey, UsageEvent, AnalysisResult, KeyAnalysis
from schemas import AnalysisResultResponse, FullAnalysisResponse, KeyAnalysisResponse
from analyzer import RedisStructureAnalyzer, StructureRule, DEFAULT_STRUCTURE_RULES
from import_service import DataImportService
from config import get_settings


router = APIRouter(prefix="/analysis", tags=["Analysis"])

settings = get_settings()
import_service = DataImportService(settings.upload_dir)


async def get_analyzer_for_session(
    session_id: int,
    db: AsyncSession
) -> RedisStructureAnalyzer:
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    custom_rules = None
    if session.rules_file:
        try:
            rules_data = await import_service.parse_rules_yaml(session.rules_file)
            if rules_data:
                custom_rules = {
                    k: StructureRule(**v) for k, v in rules_data.items()
                }
        except Exception:
            pass
    
    return RedisStructureAnalyzer(custom_rules=custom_rules)


@router.post("/{session_id}", response_model=FullAnalysisResponse)
async def run_analysis(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    result = await db.execute(
        select(RedisKey).where(RedisKey.session_id == session_id)
    )
    redis_keys = result.scalars().all()
    
    if not redis_keys:
        raise HTTPException(
            status_code=400, 
            detail=f"No keys found for session {session_id}. Please import keys first."
        )
    
    result = await db.execute(
        select(UsageEvent).where(UsageEvent.session_id == session_id)
    )
    usage_events = result.scalars().all()
    
    events_by_key: Dict[str, List[Dict[str, Any]]] = {}
    for event in usage_events:
        if event.key_name not in events_by_key:
            events_by_key[event.key_name] = []
        events_by_key[event.key_name].append({
            "command": event.command,
            "timestamp": event.timestamp,
            "read_write": event.read_write,
            "latency_ms": event.latency_ms,
        })
    
    analyzer = await get_analyzer_for_session(session_id, db)
    
    all_key_analyses = []
    key_analysis_records = []
    
    for redis_key in redis_keys:
        key_data = {
            "key_name": redis_key.key_name,
            "data_type": redis_key.data_type,
            "ttl": redis_key.ttl,
            "memory_bytes": redis_key.memory_bytes,
            "value_size": redis_key.value_size,
            "field_count": redis_key.field_count,
            "list_length": redis_key.list_length,
            "set_cardinality": redis_key.set_cardinality,
            "zset_cardinality": redis_key.zset_cardinality,
            "stream_length": redis_key.stream_length,
            "tags": redis_key.tags,
        }
        
        key_events = events_by_key.get(redis_key.key_name, [])
        analysis_result = analyzer.analyze_key(key_data, key_events)
        
        all_key_analyses.append(analysis_result)
        
        existing_result = await db.execute(
            select(KeyAnalysis).where(KeyAnalysis.key_id == redis_key.id)
        )
        existing_ka = existing_result.scalar_one_or_none()
        
        if existing_ka:
            existing_ka.scenario = analysis_result["scenario"]
            existing_ka.recommended_type = analysis_result["recommended_type"]
            existing_ka.current_type_suitability = analysis_result["current_type_suitability"]
            existing_ka.estimated_memory_bytes = analysis_result["estimated_memory_bytes"]
            existing_ka.memory_optimization_potential = analysis_result["memory_optimization_potential"]
            existing_ka.is_hot_key = analysis_result["is_hot_key"]
            existing_ka.hot_key_score = analysis_result["hot_key_score"]
            existing_ka.is_big_key = analysis_result["is_big_key"]
            existing_ka.big_key_score = analysis_result["big_key_score"]
            existing_ka.ttl_risk_level = analysis_result["ttl_risk_level"]
            existing_ka.migration_risk_level = analysis_result["migration_risk_level"]
            existing_ka.issues = json.dumps(analysis_result["issues"], ensure_ascii=False) if analysis_result["issues"] else None
            existing_ka.warnings = json.dumps(analysis_result["warnings"], ensure_ascii=False) if analysis_result["warnings"] else None
            existing_ka.suggestions = json.dumps(analysis_result["suggestions"], ensure_ascii=False) if analysis_result["suggestions"] else None
        else:
            key_analysis = KeyAnalysis(
                key_id=redis_key.id,
                scenario=analysis_result["scenario"],
                recommended_type=analysis_result["recommended_type"],
                current_type_suitability=analysis_result["current_type_suitability"],
                estimated_memory_bytes=analysis_result["estimated_memory_bytes"],
                memory_optimization_potential=analysis_result["memory_optimization_potential"],
                is_hot_key=analysis_result["is_hot_key"],
                hot_key_score=analysis_result["hot_key_score"],
                is_big_key=analysis_result["is_big_key"],
                big_key_score=analysis_result["big_key_score"],
                ttl_risk_level=analysis_result["ttl_risk_level"],
                migration_risk_level=analysis_result["migration_risk_level"],
                issues=json.dumps(analysis_result["issues"], ensure_ascii=False) if analysis_result["issues"] else None,
                warnings=json.dumps(analysis_result["warnings"], ensure_ascii=False) if analysis_result["warnings"] else None,
                suggestions=json.dumps(analysis_result["suggestions"], ensure_ascii=False) if analysis_result["suggestions"] else None,
            )
            db.add(key_analysis)
            key_analysis_records.append(key_analysis)
    
    summary = analyzer.generate_summary(all_key_analyses)
    
    analysis_types = [
        ("structure", "Data structure suitability analysis"),
        ("memory", "Memory usage and optimization analysis"),
        ("risk", "Risk assessment (hot keys, big keys, TTL)"),
        ("migration", "Migration risk and complexity analysis"),
    ]
    
    analysis_results = []
    for analysis_type, desc in analysis_types:
        existing_result = await db.execute(
            select(AnalysisResult).where(
                AnalysisResult.session_id == session_id,
                AnalysisResult.analysis_type == analysis_type
            )
        )
        existing_ar = existing_result.scalar_one_or_none()
        
        if existing_ar:
            existing_ar.summary = desc
            existing_ar.score = summary["overall_score"]
            existing_ar.total_keys = summary["total_keys"]
            existing_ar.issues_found = summary["issues_found"]
            existing_ar.warnings_found = summary["warnings_found"]
        else:
            analysis_result = AnalysisResult(
                session_id=session_id,
                analysis_type=analysis_type,
                summary=desc,
                score=summary["overall_score"],
                total_keys=summary["total_keys"],
                issues_found=summary["issues_found"],
                warnings_found=summary["warnings_found"],
            )
            db.add(analysis_result)
        
        analysis_results.append({
            "analysis_type": analysis_type,
            "summary": desc,
            "score": summary["overall_score"],
            "total_keys": summary["total_keys"],
            "issues_found": summary["issues_found"],
            "warnings_found": summary["warnings_found"],
        })
    
    session.status = "analyzed"
    await db.commit()
    
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == session_id)
    )
    db_analysis_results = result.scalars().all()
    
    result = await db.execute(
        select(KeyAnalysis, RedisKey)
        .join(RedisKey, KeyAnalysis.key_id == RedisKey.id)
        .where(RedisKey.session_id == session_id)
    )
    key_analysis_pairs = result.all()
    
    key_analysis_responses = []
    for ka, rk in key_analysis_pairs:
        issues = json.loads(ka.issues) if ka.issues else []
        warnings = json.loads(ka.warnings) if ka.warnings else []
        suggestions = json.loads(ka.suggestions) if ka.suggestions else []
        
        key_analysis_responses.append(KeyAnalysisResponse(
            id=ka.id,
            key_id=ka.key_id,
            scenario=ka.scenario,
            recommended_type=ka.recommended_type,
            current_type_suitability=ka.current_type_suitability,
            estimated_memory_bytes=ka.estimated_memory_bytes,
            memory_optimization_potential=ka.memory_optimization_potential,
            is_hot_key=ka.is_hot_key,
            hot_key_score=ka.hot_key_score,
            is_big_key=ka.is_big_key,
            big_key_score=ka.big_key_score,
            ttl_risk_level=ka.ttl_risk_level,
            migration_risk_level=ka.migration_risk_level,
            issues=issues,
            warnings=warnings,
            suggestions=suggestions,
        ))
    
    return FullAnalysisResponse(
        session_id=session_id,
        session_name=session.session_name,
        status=session.status,
        overall_score=summary["overall_score"],
        analysis_results=[
            AnalysisResultResponse(
                id=ar.id,
                session_id=ar.session_id,
                analysis_type=ar.analysis_type,
                summary=ar.summary,
                score=ar.score,
                total_keys=ar.total_keys,
                issues_found=ar.issues_found,
                warnings_found=ar.warnings_found,
                created_at=ar.created_at,
            )
            for ar in db_analysis_results
        ],
        key_analyses=key_analysis_responses,
    )


@router.get("/{session_id}", response_model=FullAnalysisResponse)
async def get_analysis(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    if session.status not in ["analyzed", "confirmed"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Analysis not run for session {session_id}. Run POST /analysis/{session_id} first."
        )
    
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == session_id)
    )
    analysis_results = result.scalars().all()
    
    result = await db.execute(
        select(KeyAnalysis, RedisKey)
        .join(RedisKey, KeyAnalysis.key_id == RedisKey.id)
        .where(RedisKey.session_id == session_id)
    )
    key_analysis_pairs = result.all()
    
    key_analysis_responses = []
    overall_score = 0.0
    
    if key_analysis_pairs:
        total_suitability = 0
        for ka, rk in key_analysis_pairs:
            if ka.current_type_suitability:
                total_suitability += ka.current_type_suitability
            
            issues = json.loads(ka.issues) if ka.issues else []
            warnings = json.loads(ka.warnings) if ka.warnings else []
            suggestions = json.loads(ka.suggestions) if ka.suggestions else []
            
            key_analysis_responses.append(KeyAnalysisResponse(
                id=ka.id,
                key_id=ka.key_id,
                scenario=ka.scenario,
                recommended_type=ka.recommended_type,
                current_type_suitability=ka.current_type_suitability,
                estimated_memory_bytes=ka.estimated_memory_bytes,
                memory_optimization_potential=ka.memory_optimization_potential,
                is_hot_key=ka.is_hot_key,
                hot_key_score=ka.hot_key_score,
                is_big_key=ka.is_big_key,
                big_key_score=ka.big_key_score,
                ttl_risk_level=ka.ttl_risk_level,
                migration_risk_level=ka.migration_risk_level,
                issues=issues,
                warnings=warnings,
                suggestions=suggestions,
            ))
        
        overall_score = total_suitability / len(key_analysis_pairs)
    
    return FullAnalysisResponse(
        session_id=session_id,
        session_name=session.session_name,
        status=session.status,
        overall_score=round(overall_score, 2),
        analysis_results=[
            AnalysisResultResponse(
                id=ar.id,
                session_id=ar.session_id,
                analysis_type=ar.analysis_type,
                summary=ar.summary,
                score=ar.score,
                total_keys=ar.total_keys,
                issues_found=ar.issues_found,
                warnings_found=ar.warnings_found,
                created_at=ar.created_at,
            )
            for ar in analysis_results
        ],
        key_analyses=key_analysis_responses,
    )


@router.get("/key/{key_id}", response_model=KeyAnalysisResponse)
async def get_key_analysis(
    key_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KeyAnalysis).where(KeyAnalysis.key_id == key_id)
    )
    key_analysis = result.scalar_one_or_none()
    
    if not key_analysis:
        raise HTTPException(status_code=404, detail=f"No analysis found for key {key_id}")
    
    issues = json.loads(key_analysis.issues) if key_analysis.issues else []
    warnings = json.loads(key_analysis.warnings) if key_analysis.warnings else []
    suggestions = json.loads(key_analysis.suggestions) if key_analysis.suggestions else []
    
    return KeyAnalysisResponse(
        id=key_analysis.id,
        key_id=key_analysis.key_id,
        scenario=key_analysis.scenario,
        recommended_type=key_analysis.recommended_type,
        current_type_suitability=key_analysis.current_type_suitability,
        estimated_memory_bytes=key_analysis.estimated_memory_bytes,
        memory_optimization_potential=key_analysis.memory_optimization_potential,
        is_hot_key=key_analysis.is_hot_key,
        hot_key_score=key_analysis.hot_key_score,
        is_big_key=key_analysis.is_big_key,
        big_key_score=key_analysis.big_key_score,
        ttl_risk_level=key_analysis.ttl_risk_level,
        migration_risk_level=key_analysis.migration_risk_level,
        issues=issues,
        warnings=warnings,
        suggestions=suggestions,
    )


@router.get("/summary/{session_id}")
async def get_analysis_summary(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    result = await db.execute(
        select(KeyAnalysis, RedisKey)
        .join(RedisKey, KeyAnalysis.key_id == RedisKey.id)
        .where(RedisKey.session_id == session_id)
    )
    key_analysis_pairs = result.all()
    
    if not key_analysis_pairs:
        raise HTTPException(
            status_code=400, 
            detail=f"No analysis data found for session {session_id}"
        )
    
    total_keys = len(key_analysis_pairs)
    hot_key_count = sum(1 for ka, rk in key_analysis_pairs if ka.is_hot_key)
    big_key_count = sum(1 for ka, rk in key_analysis_pairs if ka.is_big_key)
    high_ttl_risk = sum(1 for ka, rk in key_analysis_pairs if ka.ttl_risk_level == "high")
    high_migration_risk = sum(1 for ka, rk in key_analysis_pairs if ka.migration_risk_level == "high")
    
    type_distribution: Dict[str, int] = {}
    scenario_distribution: Dict[str, int] = {}
    avg_suitability = 0
    
    for ka, rk in key_analysis_pairs:
        data_type = rk.data_type
        type_distribution[data_type] = type_distribution.get(data_type, 0) + 1
        
        if ka.scenario:
            scenario_distribution[ka.scenario] = scenario_distribution.get(ka.scenario, 0) + 1
        
        if ka.current_type_suitability:
            avg_suitability += ka.current_type_suitability
    
    avg_suitability = avg_suitability / total_keys if total_keys > 0 else 0
    
    return {
        "session_id": session_id,
        "session_name": session.session_name,
        "status": session.status,
        "total_keys_analyzed": total_keys,
        "average_suitability_score": round(avg_suitability, 2),
        "hot_keys": hot_key_count,
        "big_keys": big_key_count,
        "high_ttl_risk_keys": high_ttl_risk,
        "high_migration_risk_keys": high_migration_risk,
        "data_type_distribution": type_distribution,
        "scenario_distribution": scenario_distribution,
    }
