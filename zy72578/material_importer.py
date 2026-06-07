from typing import List, Dict, Optional
from models import (
    Material, MaterialType, ThresholdNote, OnlineExperimentBucket,
    VotingResult, WorkflowStep, ReviewStatus, SelfCheckResult, ConflictEvidence
)
from errors import (
    DuplicateImportError, MinorityMaskedError, CaliberMismatchError,
    ThresholdConflictError, WorkflowStepError, FriendlyError
)


class MaterialImporter:
    def __init__(self):
        self._imported_materials: Dict[str, Material] = {}
        self._import_history: List[Material] = []

    def import_material(
        self,
        material_id: str,
        material_type: MaterialType,
        model_name: str,
        threshold_notes: List[ThresholdNote],
        experiment_buckets: List[OnlineExperimentBucket]
    ) -> Material:
        is_duplicate = material_id in self._imported_materials
        
        if is_duplicate and material_type != MaterialType.SUPPLEMENT:
            raise DuplicateImportError(material_id, model_name)
        
        material = Material(
            material_id=material_id,
            material_type=material_type,
            model_name=model_name,
            threshold_notes=threshold_notes,
            experiment_buckets=experiment_buckets,
            is_duplicate=is_duplicate
        )
        
        self._imported_materials[material_id] = material
        self._import_history.append(material)
        
        return material

    def get_import_history(self) -> List[Material]:
        return list(self._import_history)

    def get_material(self, material_id: str) -> Optional[Material]:
        return self._imported_materials.get(material_id)

    def get_materials_by_model(self, model_name: str) -> List[Material]:
        return [m for m in self._import_history if m.model_name == model_name]
