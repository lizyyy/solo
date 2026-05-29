import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import (
    Experiment, Formula, KilnRecord, ClayRecord, Photo, Note, Report, Anomaly,
)


def export_experiment_report(db: Session, experiment_id: int) -> dict:
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        return {}

    formulas = db.query(Formula).filter(Formula.experiment_id == experiment_id).order_by(Formula.version).all()
    kiln_records = db.query(KilnRecord).filter(KilnRecord.experiment_id == experiment_id).order_by(KilnRecord.recorded_at).all()
    clay_records = db.query(ClayRecord).filter(ClayRecord.experiment_id == experiment_id).all()
    photos = db.query(Photo).filter(Photo.experiment_id == experiment_id).order_by(Photo.uploaded_at).all()
    notes = db.query(Note).filter(Note.experiment_id == experiment_id).order_by(Note.created_at).all()
    reports = db.query(Report).filter(Report.experiment_id == experiment_id).order_by(Report.created_at).all()
    anomalies = db.query(Anomaly).filter(Anomaly.experiment_id == experiment_id).order_by(Anomaly.created_at).all()

    report = {
        "exported_at": datetime.utcnow().isoformat(),
        "experiment": {
            "id": exp.id,
            "name": exp.name,
            "created_at": exp.created_at.isoformat() if exp.created_at else None,
        },
        "data_sources": {
            "formula": [
                {
                    "id": f.id,
                    "version": f.version,
                    "name": f.name,
                    "parent_id": f.parent_id,
                    "ingredients": f.ingredients,
                    "source": f.source,
                }
                for f in formulas
            ],
            "kiln": [
                {
                    "id": k.id,
                    "formula_id": k.formula_id,
                    "target_temp": k.target_temp,
                    "temp_curve": k.temp_curve,
                    "soak_duration_min": k.soak_duration_min,
                    "source": k.source,
                }
                for k in kiln_records
            ],
            "clay": [
                {
                    "id": c.id,
                    "clay_type": c.clay_type,
                    "clay_origin": c.clay_origin,
                    "properties": c.properties,
                    "source": c.source,
                }
                for c in clay_records
            ],
            "photo": [
                {
                    "id": p.id,
                    "file_path": p.file_path,
                    "label": p.label,
                    "photo_type": p.photo_type,
                    "color_hex": p.color_hex,
                    "source": p.source,
                }
                for p in photos
            ],
            "note": [
                {
                    "id": n.id,
                    "author": n.author,
                    "content": n.content,
                    "source": n.source,
                }
                for n in notes
            ],
            "report": [
                {
                    "id": r.id,
                    "title": r.title,
                    "content": r.content,
                    "source": r.source,
                }
                for r in reports
            ],
        },
        "anomalies": [
            {
                "id": a.id,
                "category": a.category,
                "severity": a.severity,
                "message": a.message,
                "detail": a.detail,
                "suggestion": a.suggestion,
                "resolved": bool(a.resolved),
            }
            for a in anomalies
        ],
    }
    return report
