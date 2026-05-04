from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum
from app.core.experiment_manager import experiment_manager, ExperimentType

router = APIRouter()


class ExperimentTypeEnum(str, Enum):
    tokenization = "tokenization"
    inference = "inference"
    sampling_comparison = "sampling_comparison"
    kv_cache_test = "kv_cache_test"
    fine_tune = "fine_tune"


class CreateExperimentRequest(BaseModel):
    name: str
    type: ExperimentTypeEnum
    parameters: Dict[str, Any]
    results: Dict[str, Any]
    risks: List[str] = []
    input_data: Dict[str, Any] = {}
    notes: str = ""


class UpdateExperimentRequest(BaseModel):
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    risks: Optional[List[str]] = None
    input_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


@router.post("/")
def create_experiment(request: CreateExperimentRequest):
    try:
        type_map = {
            ExperimentTypeEnum.tokenization: ExperimentType.TOKENIZATION,
            ExperimentTypeEnum.inference: ExperimentType.INFERENCE,
            ExperimentTypeEnum.sampling_comparison: ExperimentType.SAMPLING_COMPARISON,
            ExperimentTypeEnum.kv_cache_test: ExperimentType.KV_CACHE_TEST,
            ExperimentTypeEnum.fine_tune: ExperimentType.FINE_TUNE,
        }
        
        experiment = experiment_manager.create_experiment(
            name=request.name,
            exp_type=type_map[request.type],
            parameters=request.parameters,
            results=request.results,
            risks=request.risks,
            input_data=request.input_data,
            notes=request.notes
        )
        
        return {
            "success": True,
            "data": experiment.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create experiment: {str(e)}")


@router.get("/")
def list_experiments(
    type: Optional[ExperimentTypeEnum] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    try:
        exp_type = None
        if type:
            type_map = {
                ExperimentTypeEnum.tokenization: ExperimentType.TOKENIZATION,
                ExperimentTypeEnum.inference: ExperimentType.INFERENCE,
                ExperimentTypeEnum.sampling_comparison: ExperimentType.SAMPLING_COMPARISON,
                ExperimentTypeEnum.kv_cache_test: ExperimentType.KV_CACHE_TEST,
                ExperimentTypeEnum.fine_tune: ExperimentType.FINE_TUNE,
            }
            exp_type = type_map[type]
        
        result = experiment_manager.list_experiments(
            exp_type=exp_type,
            limit=limit,
            offset=offset
        )
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list experiments: {str(e)}")


@router.get("/{experiment_id}")
def get_experiment(experiment_id: str):
    experiment = experiment_manager.get_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {
        "success": True,
        "data": experiment.to_dict()
    }


@router.put("/{experiment_id}")
def update_experiment(experiment_id: str, request: UpdateExperimentRequest):
    experiment = experiment_manager.update_experiment(
        experiment_id=experiment_id,
        name=request.name,
        parameters=request.parameters,
        results=request.results,
        risks=request.risks,
        input_data=request.input_data,
        notes=request.notes
    )
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {
        "success": True,
        "data": experiment.to_dict()
    }


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: str):
    success = experiment_manager.delete_experiment(experiment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {
        "success": True,
        "message": "Experiment deleted successfully"
    }


@router.get("/{experiment_id}/export/markdown", response_class=PlainTextResponse)
def export_to_markdown(experiment_id: str):
    md_content = experiment_manager.export_to_markdown(experiment_id)
    if not md_content:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return PlainTextResponse(
        content=md_content,
        media_type="text/markdown"
    )


@router.get("/{experiment_id}/export/json")
def export_to_json(experiment_id: str, pretty: bool = True):
    json_content = experiment_manager.export_to_json(experiment_id, pretty=pretty)
    if not json_content:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {
        "success": True,
        "data": json.loads(json_content) if pretty else json_content
    }


import json
