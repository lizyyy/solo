import numpy as np
from models import GridMap, Pose, RobotParams, Path, PathPoint
from validator import PathValidator
from evidence_chain import EvidenceChain

grid_map = GridMap(
    resolution=0.5,
    width_m=10.0,
    height_m=10.0,
    obstacles=np.zeros((20, 20)),
)

grid_map.obstacles[10, 10] = 1.0

robot_params = RobotParams.from_wheelbase_steering(0.5, np.radians(30), 1.0)
evidence = EvidenceChain()

points = []
for i in range(10):
    x = 1.0 + i * 0.5
    y = 5.0
    points.append(PathPoint(
        pose=Pose(x, y, 0),
        curvature=0.0,
        speed=1.0,
        timestamp=i * 0.5,
    ))

points[5].curvature = 2.0
points[5].speed = 1.5

test_path = Path(
    points=points,
    total_length=5.0,
    max_curvature=2.0,
    avg_curvature=0.2,
    smoothness=0.5,
)

validator = PathValidator(grid_map, robot_params, evidence)
result = validator.validate(test_path)

print(validator.get_human_readable_report(result))
print()
print(validator.explain_why_needed())
print()
print('📋 交接单:')
print(evidence.get_chain_for_handoff())

evidence.export_to_json('validation_evidence.json')
print('\n💾 证据链已保存到 validation_evidence.json')
