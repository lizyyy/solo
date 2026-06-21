from models import *
from material_importer import MaterialImporter
from ensemble_vote_explainer import EnsembleVoteExplainer

importer = MaterialImporter()
explainer = EnsembleVoteExplainer()

note = ThresholdNote(note_id="NOTE-004", model_name="retention_model_v1", threshold=0.60)
m1 = importer.import_material("MAT-004", MaterialType.NORMAL, "retention_model_v1", [note], [])
r1 = explainer.process_material(m1)
print("step1 threshold:", r1.final_threshold)
print("step1 step:", r1.workflow_step.value)
