from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.models import Formula, Anomaly
from app.exceptions import FormulaDuplicateError
import json


def _ingredients_key(ingredients: dict) -> str:
    normalized = {k.strip().lower(): round(v, 4) for k, v in ingredients.items()}
    return json.dumps(normalized, sort_keys=True)


def check_duplicate(db: Session, experiment_id: int, ingredients: dict, exclude_id: int | None = None):
    key = _ingredients_key(ingredients)
    candidates = db.query(Formula).filter(Formula.experiment_id == experiment_id).all()
    for f in candidates:
        if exclude_id and f.id == exclude_id:
            continue
        if _ingredients_key(f.ingredients) == key:
            anomaly = Anomaly(
                experiment_id=experiment_id,
                category="formula_duplicate",
                severity="warning",
                message=f"配方与实验内已有配方 id={f.id} 完全相同",
                detail={"existing_formula_id": f.id, "duplicate_ingredients": ingredients},
                suggestion="确认是否为有意重复；如为新版本请使用 fork 接口",
            )
            db.add(anomaly)
            db.commit()
            db.refresh(anomaly)
            raise FormulaDuplicateError(
                message=f"配方与已有配方 id={f.id} 完全相同",
                detail={"anomaly_id": anomaly.id, "existing_formula_id": f.id},
            )


def create_formula(db: Session, experiment_id: int, name: str, ingredients: dict, parent_id: int | None = None):
    check_duplicate(db, experiment_id, ingredients)

    if parent_id:
        parent = db.query(Formula).filter(Formula.id == parent_id).first()
        if not parent:
            raise FormulaDuplicateError(message=f"父配方 id={parent_id} 不存在")
        version = parent.version + 1
    else:
        last = (
            db.query(Formula)
            .filter(Formula.experiment_id == experiment_id)
            .order_by(Formula.version.desc())
            .first()
        )
        version = (last.version + 1) if last else 1

    formula = Formula(
        experiment_id=experiment_id,
        version=version,
        parent_id=parent_id,
        name=name,
        ingredients=ingredients,
        source="formula",
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula


def fork_formula(db: Session, formula_id: int, new_name: str | None = None):
    src = db.query(Formula).filter(Formula.id == formula_id).first()
    if not src:
        raise FormulaDuplicateError(message=f"源配方 id={formula_id} 不存在")

    new_ingredients = {k: v * 0.95 for k, v in src.ingredients.items()}

    check_duplicate(db, src.experiment_id, new_ingredients, exclude_id=src.id)

    version = src.version + 1
    forked = Formula(
        experiment_id=src.experiment_id,
        version=version,
        parent_id=src.id,
        name=new_name or f"{src.name}-fork",
        ingredients=new_ingredients,
        source="formula",
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked


def get_formula_chain(db: Session, formula_id: int):
    chain = []
    current = db.query(Formula).filter(Formula.id == formula_id).first()
    while current:
        chain.append(current)
        if current.parent_id:
            current = db.query(Formula).filter(Formula.id == current.parent_id).first()
        else:
            break
    chain.reverse()
    return chain


def list_formulas(db: Session, experiment_id: int):
    return db.query(Formula).filter(Formula.experiment_id == experiment_id).order_by(Formula.version).all()
