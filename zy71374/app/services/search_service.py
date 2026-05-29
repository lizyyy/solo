import json
import numpy as np
from sqlalchemy.orm import Session
from app.models.models import Formula, Photo, Experiment, KilnRecord, ClayRecord, Note, Report


def _cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    all_keys = set(a.keys()) | set(b.keys())
    va = np.array([a.get(k, 0.0) for k in all_keys])
    vb = np.array([b.get(k, 0.0) for k in all_keys])
    dot = np.dot(va, vb)
    na = np.linalg.norm(va)
    nb = np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))


def _hex_distance(c1: str, c2: str) -> float:
    try:
        r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
        r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
        return float(np.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2))
    except Exception:
        return 999.0


def search_by_formula(db: Session, ingredients: dict[str, float], threshold: float = 0.85, limit: int = 10):
    all_formulas = db.query(Formula).all()
    results = []
    for f in all_formulas:
        sim = _cosine_similarity(ingredients, f.ingredients)
        if sim >= threshold:
            results.append({"formula": f, "similarity": round(sim, 4)})
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def search_by_color(db: Session, color_hex: str, max_distance: float = 50.0, limit: int = 10):
    all_photos = db.query(Photo).filter(Photo.color_hex.isnot(None)).all()
    results = []
    for p in all_photos:
        dist = _hex_distance(color_hex, p.color_hex)
        if dist <= max_distance:
            similarity = round(1.0 - dist / 441.67, 4)
            results.append({"photo": p, "distance": round(dist, 2), "similarity": similarity})
    results.sort(key=lambda x: x["distance"])
    return results[:limit]


def search_similar_experiments(db: Session, experiment_id: int, threshold: float = 0.8):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        return []

    formulas = db.query(Formula).filter(Formula.experiment_id == experiment_id).all()
    if not formulas:
        return []

    primary = max(formulas, key=lambda f: f.version)
    formula_results = search_by_formula(db, primary.ingredients, threshold=threshold, limit=20)

    experiment_map: dict[int, list] = {}
    for r in formula_results:
        eid = r["formula"].experiment_id
        if eid == experiment_id:
            continue
        experiment_map.setdefault(eid, []).append(r)

    results = []
    for eid, matches in experiment_map.items():
        best = max(matches, key=lambda m: m["similarity"])
        e = db.query(Experiment).filter(Experiment.id == eid).first()
        results.append({
            "experiment_id": eid,
            "experiment_name": e.name if e else "unknown",
            "best_similarity": best["similarity"],
            "matching_formulas": len(matches),
        })
    results.sort(key=lambda x: x["best_similarity"], reverse=True)
    return results
