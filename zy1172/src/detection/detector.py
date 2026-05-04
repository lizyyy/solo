from dataclasses import dataclass
from typing import List, Tuple, Optional
import numpy as np


@dataclass
class AnchorConfig:
    ratios: List[float] 
    scales: List[float] 
    base_size: int = 16


@dataclass
class BoundingBox:
    x1: int
    y1: int
    x2: int
    y2: int
    class_name: str
    class_id: int
    confidence: float
    feature_map_x: int = 0
    feature_map_y: int = 0
    anchor_index: int = 0


@dataclass
class NMSResult:
    kept_boxes: List[BoundingBox]
    suppressed_boxes: List[Tuple[BoundingBox, str]]
    iou_threshold: float
    confidence_threshold: float


class Detector:
    
    def __init__(self, class_labels: List[str] = None):
        if class_labels is None:
            self.class_labels = [
                "person", "bicycle", "car", "motorcycle", "airplane",
                "bus", "train", "truck", "boat", "traffic light"
            ]
        else:
            self.class_labels = class_labels
    
    @staticmethod
    def generate_anchors(
        feature_map_size: Tuple[int, int],
        config: AnchorConfig,
        stride: int
    ) -> List[Tuple[int, int, int, int]]:
        anchors = []
        fm_h, fm_w = feature_map_size
        
        for y in range(fm_h):
            for x in range(fm_w):
                for ratio in config.ratios:
                    for scale in config.scales:
                        base_w = config.base_size * scale
                        base_h = base_w / ratio
                        
                        center_x = x * stride + stride / 2
                        center_y = y * stride + stride / 2
                        
                        x1 = int(center_x - base_w / 2)
                        y1 = int(center_y - base_h / 2)
                        x2 = int(center_x + base_w / 2)
                        y2 = int(center_y + base_h / 2)
                        
                        anchors.append((x1, y1, x2, y2))
        
        return anchors
    
    @staticmethod
    def compute_iou(box1: Tuple[int, int, int, int], box2: Tuple[int, int, int, int]) -> float:
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        xi1 = max(x1_1, x1_2)
        yi1 = max(y1_1, y1_2)
        xi2 = min(x2_1, x2_2)
        yi2 = min(y2_1, y2_2)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        inter_area = (xi2 - xi1) * (yi2 - yi1)
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        
        union_area = area1 + area2 - inter_area
        
        return inter_area / union_area if union_area > 0 else 0.0
    
    def simulate_detections(
        self,
        feature_map_size: Tuple[int, int],
        anchor_config: AnchorConfig,
        stride: int,
        image_size: Tuple[int, int],
        num_detections: int = 10
    ) -> List[BoundingBox]:
        np.random.seed(hash(str(feature_map_size)) % 4294967295)
        
        boxes = []
        fm_h, fm_w = feature_map_size
        img_h, img_w = image_size
        
        for i in range(num_detections):
            fm_y = np.random.randint(0, fm_h)
            fm_x = np.random.randint(0, fm_w)
            
            center_x = int(fm_x * stride + stride / 2)
            center_y = int(fm_y * stride + stride / 2)
            
            w = np.random.randint(32, min(128, img_w - center_x))
            h = np.random.randint(32, min(128, img_h - center_y))
            
            x1 = max(0, center_x - w // 2)
            y1 = max(0, center_y - h // 2)
            x2 = min(img_w, center_x + w // 2)
            y2 = min(img_h, center_y + h // 2)
            
            class_id = np.random.randint(0, len(self.class_labels))
            confidence = np.random.uniform(0.1, 1.0)
            
            box = BoundingBox(
                x1=x1, y1=y1, x2=x2, y2=y2,
                class_name=self.class_labels[class_id],
                class_id=class_id,
                confidence=confidence,
                feature_map_x=fm_x,
                feature_map_y=fm_y,
                anchor_index=i
            )
            boxes.append(box)
        
        return boxes
    
    def nms(
        self,
        boxes: List[BoundingBox],
        iou_threshold: float = 0.5,
        confidence_threshold: float = 0.5
    ) -> NMSResult:
        filtered_boxes = [box for box in boxes if box.confidence >= confidence_threshold]
        
        if not filtered_boxes:
            return NMSResult(
                kept_boxes=[],
                suppressed_boxes=[],
                iou_threshold=iou_threshold,
                confidence_threshold=confidence_threshold
            )
        
        sorted_boxes = sorted(filtered_boxes, key=lambda x: x.confidence, reverse=True)
        
        kept_boxes = []
        suppressed_boxes = []
        
        while sorted_boxes:
            current = sorted_boxes.pop(0)
            kept_boxes.append(current)
            
            to_remove = []
            for i, box in enumerate(sorted_boxes):
                if box.class_id == current.class_id:
                    iou = self.compute_iou(
                        (current.x1, current.y1, current.x2, current.y2),
                        (box.x1, box.y1, box.x2, box.y2)
                    )
                    if iou > iou_threshold:
                        suppressed_boxes.append((box, f"IoU={iou:.3f} with box at ({current.x1},{current.y1})"))
                        to_remove.append(i)
            
            for i in reversed(to_remove):
                sorted_boxes.pop(i)
        
        low_confidence_boxes = [box for box in boxes if box.confidence < confidence_threshold]
        for box in low_confidence_boxes:
            suppressed_boxes.append((box, f"Low confidence: {box.confidence:.3f} < {confidence_threshold}"))
        
        return NMSResult(
            kept_boxes=kept_boxes,
            suppressed_boxes=suppressed_boxes,
            iou_threshold=iou_threshold,
            confidence_threshold=confidence_threshold
        )
    
    def set_class_labels(self, labels: List[str]):
        self.class_labels = labels
