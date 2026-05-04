from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import os
import uuid

from src.core.feature_map_calculator import LayerConfig, LayerInfo
from src.classification.classifier import ClassificationResult
from src.detection.detector import AnchorConfig, NMSResult, BoundingBox


@dataclass
class ExperimentConfig:
    experiment_name: str
    workflow_type: str  
    input_size: tuple  
    class_labels: List[str]
    layers: List[LayerConfig]
    anchor_config: Optional[AnchorConfig] = None
    nms_iou_threshold: float = 0.5
    nms_confidence_threshold: float = 0.5


@dataclass
class ExperimentResult:
    layer_infos: List[LayerInfo]
    classification_result: Optional[ClassificationResult] = None
    detection_raw_boxes: Optional[List[BoundingBox]] = None
    nms_result: Optional[NMSResult] = None


@dataclass
class Experiment:
    experiment_id: str
    name: str
    created_at: datetime
    config: ExperimentConfig
    result: Optional[ExperimentResult] = None
    
    def to_dict(self) -> Dict[str, Any]:
        config_dict = {
            "experiment_name": self.config.experiment_name,
            "workflow_type": self.config.workflow_type,
            "input_size": list(self.config.input_size),
            "class_labels": self.config.class_labels,
            "layers": [
                {
                    "layer_type": l.layer_type,
                    "kernel_size": l.kernel_size,
                    "stride": l.stride,
                    "padding": l.padding,
                    "dilation": l.dilation,
                    "out_channels": l.out_channels,
                    "name": l.name
                }
                for l in self.config.layers
            ],
            "nms_iou_threshold": self.config.nms_iou_threshold,
            "nms_confidence_threshold": self.config.nms_confidence_threshold
        }
        
        if self.config.anchor_config:
            config_dict["anchor_config"] = {
                "ratios": self.config.anchor_config.ratios,
                "scales": self.config.anchor_config.scales,
                "base_size": self.config.anchor_config.base_size
            }
        
        result_dict = None
        if self.result:
            result_dict = {
                "layer_infos": [
                    {
                        "name": li.name,
                        "layer_type": li.layer_type,
                        "input_size": list(li.input_size),
                        "output_size": list(li.output_size),
                        "receptive_field": list(li.receptive_field),
                        "layer_index": li.layer_index
                    }
                    for li in self.result.layer_infos
                ]
            }
            
            if self.result.classification_result:
                result_dict["classification_result"] = {
                    "class_name": self.result.classification_result.class_name,
                    "class_index": self.result.classification_result.class_index,
                    "confidence": self.result.classification_result.confidence,
                    "top_k": [
                        {"name": c[0], "index": c[1], "confidence": c[2]}
                        for c in self.result.classification_result.top_k
                    ]
                }
            
            if self.result.detection_raw_boxes:
                result_dict["detection_raw_boxes"] = [
                    {
                        "x1": b.x1, "y1": b.y1, "x2": b.x2, "y2": b.y2,
                        "class_name": b.class_name, "class_id": b.class_id,
                        "confidence": b.confidence,
                        "feature_map_x": b.feature_map_x,
                        "feature_map_y": b.feature_map_y
                    }
                    for b in self.result.detection_raw_boxes
                ]
            
            if self.result.nms_result:
                result_dict["nms_result"] = {
                    "kept_boxes": [
                        {
                            "x1": b.x1, "y1": b.y1, "x2": b.x2, "y2": b.y2,
                            "class_name": b.class_name, "class_id": b.class_id,
                            "confidence": b.confidence
                        }
                        for b in self.result.nms_result.kept_boxes
                    ],
                    "iou_threshold": self.result.nms_result.iou_threshold,
                    "confidence_threshold": self.result.nms_result.confidence_threshold
                }
        
        return {
            "experiment_id": self.experiment_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "config": config_dict,
            "result": result_dict
        }


class ExperimentManager:
    
    def __init__(self, storage_dir: str = "./data/experiments"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        self.experiments: Dict[str, Experiment] = {}
        self._load_from_disk()
    
    def create_experiment(
        self,
        config: ExperimentConfig,
        name: Optional[str] = None
    ) -> Experiment:
        exp_id = str(uuid.uuid4())[:8]
        exp_name = name or config.experiment_name or f"Experiment_{exp_id}"
        
        experiment = Experiment(
            experiment_id=exp_id,
            name=exp_name,
            created_at=datetime.now(),
            config=config
        )
        
        self.experiments[exp_id] = experiment
        self._save_to_disk(experiment)
        
        return experiment
    
    def save_result(self, experiment_id: str, result: ExperimentResult):
        if experiment_id in self.experiments:
            self.experiments[experiment_id].result = result
            self._save_to_disk(self.experiments[experiment_id])
    
    def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        return self.experiments.get(experiment_id)
    
    def list_experiments(self) -> List[Experiment]:
        return sorted(
            self.experiments.values(),
            key=lambda x: x.created_at,
            reverse=True
        )
    
    def delete_experiment(self, experiment_id: str) -> bool:
        if experiment_id in self.experiments:
            del self.experiments[experiment_id]
            file_path = os.path.join(self.storage_dir, f"{experiment_id}.json")
            if os.path.exists(file_path):
                os.remove(file_path)
            return True
        return False
    
    def compare_experiments(
        self,
        experiment_ids: List[str]
    ) -> List[Experiment]:
        return [
            self.experiments[eid]
            for eid in experiment_ids
            if eid in self.experiments
        ]
    
    def _save_to_disk(self, experiment: Experiment):
        file_path = os.path.join(self.storage_dir, f"{experiment.experiment_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(experiment.to_dict(), f, indent=2, ensure_ascii=False)
    
    def _load_from_disk(self):
        if not os.path.exists(self.storage_dir):
            return
        
        for filename in os.listdir(self.storage_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(self.storage_dir, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    layers = []
                    for layer_data in data["config"]["layers"]:
                        layers.append(LayerConfig(
                            layer_type=layer_data["layer_type"],
                            kernel_size=layer_data["kernel_size"],
                            stride=layer_data["stride"],
                            padding=layer_data["padding"],
                            dilation=layer_data["dilation"],
                            out_channels=layer_data.get("out_channels"),
                            name=layer_data["name"]
                        ))
                    
                    anchor_config = None
                    if "anchor_config" in data["config"]:
                        anchor_config = AnchorConfig(
                            ratios=data["config"]["anchor_config"]["ratios"],
                            scales=data["config"]["anchor_config"]["scales"],
                            base_size=data["config"]["anchor_config"]["base_size"]
                        )
                    
                    config = ExperimentConfig(
                        experiment_name=data["config"]["experiment_name"],
                        workflow_type=data["config"]["workflow_type"],
                        input_size=tuple(data["config"]["input_size"]),
                        class_labels=data["config"]["class_labels"],
                        layers=layers,
                        anchor_config=anchor_config,
                        nms_iou_threshold=data["config"].get("nms_iou_threshold", 0.5),
                        nms_confidence_threshold=data["config"].get("nms_confidence_threshold", 0.5)
                    )
                    
                    experiment = Experiment(
                        experiment_id=data["experiment_id"],
                        name=data["name"],
                        created_at=datetime.fromisoformat(data["created_at"]),
                        config=config,
                        result=None
                    )
                    
                    self.experiments[data["experiment_id"]] = experiment
                    
                except Exception as e:
                    print(f"Error loading experiment {filename}: {e}")
