from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json

from database import get_db
from models import AuditSession, RedisKey, KeyAnalysis, ComparisonResult
from schemas import ComparisonResultResponse, ComparisonAlternative
from analyzer import RedisStructureAnalyzer, StructureRule
from import_service import DataImportService
from config import get_settings


router = APIRouter(prefix="/comparison", tags=["Comparison"])

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


@router.post("/{session_id}", response_model=List[ComparisonResultResponse])
async def generate_comparison(
    session_id: int,
    scenario: Optional[str] = None,
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
            detail=f"No analysis data found for session {session_id}. Run analysis first."
        )
    
    analyzer = await get_analyzer_for_session(session_id, db)
    
    scenario_groups: dict = {}
    for ka, rk in key_analysis_pairs:
        key_scenario = ka.scenario or "general"
        
        if scenario and key_scenario != scenario:
            continue
        
        if key_scenario not in scenario_groups:
            scenario_groups[key_scenario] = {
                "current_types": set(),
                "keys": [],
                "first_key": rk,
                "first_analysis": ka,
            }
        
        scenario_groups[key_scenario]["current_types"].add(rk.data_type)
        scenario_groups[key_scenario]["keys"].append({
            "key": rk,
            "analysis": ka,
        })
    
    comparison_results = []
    
    for scenario_name, group_data in scenario_groups.items():
        current_types = list(group_data["current_types"])
        first_key = group_data["first_key"]
        first_analysis = group_data["first_analysis"]
        
        for current_type in current_types:
            key_data = {
                "key_name": first_key.key_name,
                "data_type": current_type,
                "ttl": first_key.ttl,
                "memory_bytes": first_key.memory_bytes,
                "value_size": first_key.value_size,
                "field_count": first_key.field_count,
                "list_length": first_key.list_length,
                "set_cardinality": first_key.set_cardinality,
                "zset_cardinality": first_key.zset_cardinality,
                "stream_length": first_key.stream_length,
                "tags": first_key.tags,
            }
            
            alternatives = analyzer.get_alternatives_comparison(
                current_type,
                scenario_name,
                **key_data
            )
            
            alt_records = []
            for alt in alternatives:
                alt_records.append({
                    "data_type": alt["data_type"],
                    "suitability_score": alt["suitability_score"],
                    "memory_estimate": alt["memory_estimate"],
                    "migration_complexity": alt["migration_complexity"],
                    "code_changes": alt["code_changes"],
                    "issues": alt["issues"],
                    "suggestions": alt["suggestions"],
                })
            
            recommended_structure = None
            if alt_records:
                best_alt = max(alt_records, key=lambda x: x["suitability_score"])
                if best_alt["suitability_score"] > 50:
                    recommended_structure = best_alt["data_type"]
            
            summary_parts = [
                f"Scenario: {scenario_name}",
                f"Current type: {current_type}",
                f"Found {len(alt_records)} alternatives"
            ]
            
            existing_comparison = await db.execute(
                select(ComparisonResult).where(
                    ComparisonResult.session_id == session_id,
                    ComparisonResult.scenario == scenario_name,
                    ComparisonResult.current_structure == current_type
                )
            )
            existing_cr = existing_comparison.scalar_one_or_none()
            
            alternatives_json = json.dumps([
                {
                    "data_type": a["data_type"],
                    "suitability_score": a["suitability_score"],
                    "memory_estimate": a["memory_estimate"],
                    "migration_complexity": a["migration_complexity"],
                    "code_changes": a["code_changes"],
                }
                for a in alt_records
            ], ensure_ascii=False)
            
            if existing_cr:
                existing_cr.alternatives = alternatives_json
                existing_cr.comparison_summary = " | ".join(summary_parts)
                existing_cr.recommended_structure = recommended_structure
                comparison_record = existing_cr
            else:
                comparison_record = ComparisonResult(
                    session_id=session_id,
                    scenario=scenario_name,
                    current_structure=current_type,
                    alternatives=alternatives_json,
                    comparison_summary=" | ".join(summary_parts),
                    recommended_structure=recommended_structure,
                )
                db.add(comparison_record)
            
            comparison_results.append({
                "record": comparison_record,
                "alternatives": alt_records,
            })
    
    await db.commit()
    
    result = await db.execute(
        select(ComparisonResult).where(ComparisonResult.session_id == session_id)
    )
    db_comparisons = result.scalars().all()
    
    responses = []
    for comp in db_comparisons:
        try:
            alternatives_data = json.loads(comp.alternatives) if comp.alternatives else []
        except Exception:
            alternatives_data = []
        
        alternatives = [
            ComparisonAlternative(
                data_type=a.get("data_type", ""),
                suitability_score=a.get("suitability_score", 0.0),
                memory_estimate=a.get("memory_estimate", 0),
                migration_complexity=a.get("migration_complexity", "low"),
                code_changes=a.get("code_changes", "minimal"),
            )
            for a in alternatives_data
        ]
        
        responses.append(ComparisonResultResponse(
            id=comp.id,
            session_id=comp.session_id,
            scenario=comp.scenario,
            current_structure=comp.current_structure,
            alternatives=alternatives,
            comparison_summary=comp.comparison_summary,
            recommended_structure=comp.recommended_structure,
            created_at=comp.created_at,
        ))
    
    return responses


@router.get("/{session_id}", response_model=List[ComparisonResultResponse])
async def get_comparison(
    session_id: int,
    scenario: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    query = select(ComparisonResult).where(ComparisonResult.session_id == session_id)
    if scenario:
        query = query.where(ComparisonResult.scenario == scenario)
    
    result = await db.execute(query)
    comparisons = result.scalars().all()
    
    if not comparisons:
        raise HTTPException(
            status_code=404,
            detail=f"No comparison results found for session {session_id}. Generate comparison first."
        )
    
    responses = []
    for comp in comparisons:
        try:
            alternatives_data = json.loads(comp.alternatives) if comp.alternatives else []
        except Exception:
            alternatives_data = []
        
        alternatives = [
            ComparisonAlternative(
                data_type=a.get("data_type", ""),
                suitability_score=a.get("suitability_score", 0.0),
                memory_estimate=a.get("memory_estimate", 0),
                migration_complexity=a.get("migration_complexity", "low"),
                code_changes=a.get("code_changes", "minimal"),
            )
            for a in alternatives_data
        ]
        
        responses.append(ComparisonResultResponse(
            id=comp.id,
            session_id=comp.session_id,
            scenario=comp.scenario,
            current_structure=comp.current_structure,
            alternatives=alternatives,
            comparison_summary=comp.comparison_summary,
            recommended_structure=comp.recommended_structure,
            created_at=comp.created_at,
        ))
    
    return responses


@router.get("/detail/{comparison_id}")
async def get_comparison_detail(
    comparison_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ComparisonResult).where(ComparisonResult.id == comparison_id)
    )
    comparison = result.scalar_one_or_none()
    
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison {comparison_id} not found")
    
    try:
        alternatives_data = json.loads(comparison.alternatives) if comparison.alternatives else []
    except Exception:
        alternatives_data = []
    
    return {
        "id": comparison.id,
        "session_id": comparison.session_id,
        "scenario": comparison.scenario,
        "current_structure": comparison.current_structure,
        "recommended_structure": comparison.recommended_structure,
        "comparison_summary": comparison.comparison_summary,
        "created_at": comparison.created_at,
        "alternatives": alternatives_data,
    }


@router.get("/matrix/{session_id}")
async def get_comparison_matrix(
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
    
    scenarios = set()
    data_types = set()
    
    for ka, rk in key_analysis_pairs:
        if ka.scenario:
            scenarios.add(ka.scenario)
        data_types.add(rk.data_type)
    
    scenarios = sorted(scenarios) if scenarios else ["general"]
    data_types = sorted(data_types)
    
    matrix = []
    for scenario in scenarios:
        row = {
            "scenario": scenario,
            "types": {}
        }
        
        for data_type in data_types:
            count = sum(
                1 for ka, rk in key_analysis_pairs
                if (ka.scenario == scenario or (scenario == "general" and not ka.scenario))
                and rk.data_type == data_type
            )
            
            if count > 0:
                avg_suitability = sum(
                    ka.current_type_suitability or 0
                    for ka, rk in key_analysis_pairs
                    if (ka.scenario == scenario or (scenario == "general" and not ka.scenario))
                    and rk.data_type == data_type
                ) / count
                
                row["types"][data_type] = {
                    "count": count,
                    "avg_suitability": round(avg_suitability, 2),
                }
        
        matrix.append(row)
    
    return {
        "session_id": session_id,
        "scenarios": list(scenarios),
        "data_types": list(data_types),
        "matrix": matrix,
    }
