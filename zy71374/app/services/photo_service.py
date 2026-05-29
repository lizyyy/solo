from __future__ import annotations
import os
import hashlib
from PIL import Image
from sqlalchemy.orm import Session
from app.models.models import Photo, Anomaly
from app.exceptions import PhotoMismatchError

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _extract_dominant_color(image_path: str) -> str | None:
    try:
        img = Image.open(image_path).convert("RGB").resize((1, 1))
        r, g, b = img.getpixel((0, 0))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return None


def _file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _check_mismatch(db: Session, experiment_id: int, file_path: str, label: str | None):
    file_hash = _file_hash(file_path)
    existing = db.query(Photo).filter(Photo.experiment_id != experiment_id).all()
    for p in existing:
        stored_path = os.path.join(UPLOAD_DIR, os.path.basename(p.file_path))
        if os.path.exists(stored_path):
            if _file_hash(stored_path) == file_hash:
                anomaly = Anomaly(
                    experiment_id=experiment_id,
                    category="photo_mismatch",
                    severity="warning",
                    message=f"上传照片与实验 id={p.experiment_id} 的照片 id={p.id} 文件内容完全相同，可能错挂",
                    detail={
                        "current_experiment_id": experiment_id,
                        "matched_experiment_id": p.experiment_id,
                        "matched_photo_id": p.id,
                    },
                    suggestion="确认照片是否归属当前实验；如需重新关联请使用 PATCH /photos/{id}",
                )
                db.add(anomaly)
                db.commit()
                db.refresh(anomaly)
                raise PhotoMismatchError(
                    message=f"照片与实验 id={p.experiment_id} 的照片 id={p.id} 重复，可能错挂",
                    detail={"anomaly_id": anomaly.id, "matched_photo_id": p.id},
                )


def upload_photo(
    db: Session,
    experiment_id: int,
    file_bytes: bytes,
    filename: str,
    label: str | None = None,
    photo_type: str | None = None,
):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise PhotoMismatchError(message=f"不支持的文件类型 {ext}，仅支持 {ALLOWED_EXTENSIONS}")

    safe_name = f"{experiment_id}_{filename}"
    dest = os.path.join(UPLOAD_DIR, safe_name)
    with open(dest, "wb") as f:
        f.write(file_bytes)

    _check_mismatch(db, experiment_id, dest, label)

    color_hex = _extract_dominant_color(dest)

    photo = Photo(
        experiment_id=experiment_id,
        file_path=safe_name,
        label=label,
        photo_type=photo_type,
        color_hex=color_hex,
        source="photo",
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def list_photos(db: Session, experiment_id: int):
    return db.query(Photo).filter(Photo.experiment_id == experiment_id).order_by(Photo.uploaded_at).all()


def reassign_photo(db: Session, photo_id: int, new_experiment_id: int):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise PhotoMismatchError(message=f"照片 id={photo_id} 不存在")
    old_exp = photo.experiment_id
    photo.experiment_id = new_experiment_id
    anomaly = Anomaly(
        experiment_id=new_experiment_id,
        category="photo_mismatch",
        severity="info",
        message=f"照片 id={photo_id} 从实验 id={old_exp} 重新关联到实验 id={new_experiment_id}",
        detail={"photo_id": photo_id, "from_experiment": old_exp, "to_experiment": new_experiment_id},
        suggestion="已自动记录关联变更，请确认新归属是否正确",
    )
    db.add(anomaly)
    db.commit()
    db.refresh(photo)
    return photo
