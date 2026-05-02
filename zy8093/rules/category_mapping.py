from typing import Dict, List, Set, Tuple
from parsers.manifest import ImageEntry
from parsers.labels import Annotation


def check_category_consistency(
    manifest: Dict[str, ImageEntry],
    annotations: Dict[str, List[Annotation]],
    split_data: Dict[str, List[str]],
    category_definitions: Dict[str, str] = None
) -> List[dict]:
    issues = []
    
    manifest_ids = set(manifest.keys())
    annotation_ids = set(annotations.keys())
    split_ids = set()
    for split in ["train", "val", "test"]:
        split_ids.update(split_data.get(split, []))
    
    if not category_definitions:
        category_definitions = {}
    
    annotation_categories = set()
    for image_anns in annotations.values():
        for ann in image_anns:
            annotation_categories.add(ann.category_id)
    
    for cat_id in annotation_categories:
        if cat_id not in category_definitions:
            issues.append({
                "issue_type": "UNKNOWN_CATEGORY",
                "severity": "warning",
                "image_id": None,
                "annotation_id": None,
                "category_id": cat_id,
                "message": f"Category '{cat_id}' not found in category definitions"
            })
    
    missing_in_manifest = annotation_ids - manifest_ids
    for img_id in missing_in_manifest:
        issues.append({
            "issue_type": "MISSING_IN_MANIFEST",
            "severity": "error",
            "image_id": img_id,
            "annotation_id": None,
            "category_id": None,
            "message": f"Image '{img_id}' exists in annotations but not in manifest"
        })
    
    missing_in_annotations = split_ids - annotation_ids
    for img_id in missing_in_annotations:
        issues.append({
            "issue_type": "MISSING_ANNOTATIONS",
            "severity": "error",
            "image_id": img_id,
            "annotation_id": None,
            "category_id": None,
            "message": f"Image '{img_id}' in split has no annotations"
        })
    
    return issues