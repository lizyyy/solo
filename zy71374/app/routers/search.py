from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])


class FormulaSearchQuery(BaseModel):
    ingredients: dict[str, float]
    threshold: float = 0.85
    limit: int = 10


class ColorSearchQuery(BaseModel):
    color_hex: str
    max_distance: float = 50.0
    limit: int = 10


class ExperimentSearchResponse(BaseModel):
    experiment_id: int
    experiment_name: str
    best_similarity: float
    matching_formulas: int


@router.post("/by-formula")
def search_by_formula(body: FormulaSearchQuery, db: Session = Depends(get_db)):
    results = search_service.search_by_formula(db, body.ingredients, body.threshold, body.limit)
    return [
        {
            "formula_id": r["formula"].id,
            "experiment_id": r["formula"].experiment_id,
            "name": r["formula"].name,
            "similarity": r["similarity"],
            "ingredients": r["formula"].ingredients,
        }
        for r in results
    ]


@router.post("/by-color")
def search_by_color(body: ColorSearchQuery, db: Session = Depends(get_db)):
    results = search_service.search_by_color(db, body.color_hex, body.max_distance, body.limit)
    return [
        {
            "photo_id": r["photo"].id,
            "experiment_id": r["photo"].experiment_id,
            "color_hex": r["photo"].color_hex,
            "distance": r["distance"],
            "similarity": r["similarity"],
        }
        for r in results
    ]


@router.get("/similar-experiments/{experiment_id}", response_model=list[ExperimentSearchResponse])
def search_similar_experiments(experiment_id: int, threshold: float = 0.8, db: Session = Depends(get_db)):
    return search_service.search_similar_experiments(db, experiment_id, threshold)
