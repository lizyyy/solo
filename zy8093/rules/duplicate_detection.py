import hashlib
from pathlib import Path
from typing import Dict, List, Tuple

import imagehash
from PIL import Image

from parsers.manifest import ImageEntry


def compute_image_phash(image_path: str) -> str:
    try:
        img = Image.open(image_path)
        hash_val = imagehash.phash(img)
        return str(hash_val)
    except Exception:
        return None


def compute_file_hash(file_path: str) -> str:
    try:
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return None


def find_duplicate_images(
    manifest: Dict[str, ImageEntry],
    split_data: Dict[str, List[str]],
    base_path: str = "."
) -> List[dict]:
    issues = []
    
    phash_groups: Dict[str, List[str]] = {}
    filehash_groups: Dict[str, List[str]] = {}
    
    for image_id, entry in manifest.items():
        full_path = Path(base_path) / entry.file_path
        
        if not full_path.exists():
            issues.append({
                "issue_type": "FILE_MISSING",
                "severity": "error",
                "image_id": image_id,
                "annotation_id": None,
                "category_id": None,
                "message": f"Image file not found: {full_path}"
            })
            continue
        
        phash = compute_image_phash(str(full_path))
        if phash:
            if phash not in phash_groups:
                phash_groups[phash] = []
            phash_groups[phash].append(image_id)
        
        filehash = compute_file_hash(str(full_path))
        if filehash:
            if filehash not in filehash_groups:
                filehash_groups[filehash] = []
            filehash_groups[filehash].append(image_id)
    
    train_ids = set(split_data.get("train", []))
    val_ids = set(split_data.get("val", []))
    
    for phash, img_ids in phash_groups.items():
        if len(img_ids) >= 2:
            in_train = [id for id in img_ids if id in train_ids]
            in_val = [id for id in img_ids if id in val_ids]
            
            if in_train and in_val:
                issues.append({
                    "issue_type": "DUPLICATE_ACROSS_SPLITS",
                    "severity": "error",
                    "image_id": ",".join(img_ids),
                    "annotation_id": None,
                    "category_id": None,
                    "message": f"Duplicate images across train/val splits (pHash match): {', '.join(img_ids)}"
                })
            elif len(img_ids) > 5:
                issues.append({
                    "issue_type": "EXCESSIVE_DUPLICATES",
                    "severity": "warning",
                    "image_id": ",".join(img_ids),
                    "annotation_id": None,
                    "category_id": None,
                    "message": f"Found {len(img_ids)} duplicate images with same pHash"
                })
    
    for filehash, img_ids in filehash_groups.items():
        if len(img_ids) >= 2:
            in_train = [id for id in img_ids if id in train_ids]
            in_val = [id for id in img_ids if id in val_ids]
            
            if in_train and in_val:
                issues.append({
                    "issue_type": "IDENTICAL_ACROSS_SPLITS",
                    "severity": "error",
                    "image_id": ",".join(img_ids),
                    "annotation_id": None,
                    "category_id": None,
                    "message": f"Identical images across train/val splits (file hash match): {', '.join(img_ids)}"
                })
    
    return issues