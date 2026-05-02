from typing import Dict, List
from parsers.manifest import ImageEntry
from parsers.labels import Annotation


def validate_bounding_boxes(
    manifest: Dict[str, ImageEntry],
    annotations: Dict[str, List[Annotation]]
) -> List[dict]:
    issues = []
    
    for image_id, image_anns in annotations.items():
        if image_id not in manifest:
            continue
        
        image_entry = manifest[image_id]
        width = image_entry.width
        height = image_entry.height
        
        for ann in image_anns:
            if ann.is_empty:
                issues.append({
                    "issue_type": "EMPTY_ANNOTATION",
                    "severity": "warning",
                    "image_id": image_id,
                    "annotation_id": ann.annotation_id,
                    "category_id": ann.category_id,
                    "message": f"Annotation '{ann.annotation_id}' has empty bounding box"
                })
                continue
            
            if ann.bbox is None:
                continue
            
            bbox = ann.bbox
            
            if bbox.xmin < 0 or bbox.ymin < 0:
                issues.append({
                    "issue_type": "BBOX_NEGATIVE",
                    "severity": "error",
                    "image_id": image_id,
                    "annotation_id": ann.annotation_id,
                    "category_id": ann.category_id,
                    "message": f"Bounding box has negative coordinates: xmin={bbox.xmin}, ymin={bbox.ymin}"
                })
            
            if bbox.xmax > width or bbox.ymax > height:
                issues.append({
                    "issue_type": "BBOX_OUT_OF_BOUNDS",
                    "severity": "error",
                    "image_id": image_id,
                    "annotation_id": ann.annotation_id,
                    "category_id": ann.category_id,
                    "message": f"Bounding box exceeds image bounds: xmax={bbox.xmax}/{width}, ymax={bbox.ymax}/{height}"
                })
            
            if bbox.xmin >= bbox.xmax or bbox.ymin >= bbox.ymax:
                issues.append({
                    "issue_type": "BBOX_INVALID",
                    "severity": "error",
                    "image_id": image_id,
                    "annotation_id": ann.annotation_id,
                    "category_id": ann.category_id,
                    "message": f"Bounding box has invalid dimensions: xmin={bbox.xmin} >= xmax={bbox.xmax} or ymin={bbox.ymin} >= ymax={bbox.ymax}"
                })
    
    return issues