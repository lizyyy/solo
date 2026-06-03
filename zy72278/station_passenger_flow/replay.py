from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import PathPoint, PassengerFlowResult


class PathReplay:
    def __init__(self):
        self._replay_history: List[List[PathPoint]] = []

    def record_path(self, path_points: List[PathPoint]) -> int:
        self._replay_history.append(path_points)
        return len(self._replay_history) - 1

    def get_path_version(self, version: int) -> Optional[List[PathPoint]]:
        if 0 <= version < len(self._replay_history):
            return self._replay_history[version]
        return None

    def compare_paths(self, version1: int, version2: int) -> Dict[str, Any]:
        path1 = self.get_path_version(version1)
        path2 = self.get_path_version(version2)

        if not path1 or not path2:
            return {"error": "版本不存在"}

        differences = []
        max_len = max(len(path1), len(path2))

        for i in range(max_len):
            if i >= len(path1) or i >= len(path2):
                differences.append({
                    "index": i,
                    "type": "point_missing",
                    "message": f"第{i}个点在某个版本中不存在"
                })
                continue

            p1, p2 = path1[i], path2[i]
            if abs(p1.x - p2.x) > 0.01 or abs(p1.y - p2.y) > 0.01 or abs(p1.z - p2.z) > 0.01:
                differences.append({
                    "index": i,
                    "type": "position_changed",
                    "old": {"x": p1.x, "y": p1.y, "z": p1.z},
                    "new": {"x": p2.x, "y": p2.y, "z": p2.z}
                })
            if p1.passenger_count != p2.passenger_count:
                differences.append({
                    "index": i,
                    "type": "passenger_count_changed",
                    "old": p1.passenger_count,
                    "new": p2.passenger_count
                })

        return {
            "version1": version1,
            "version2": version2,
            "total_points_v1": len(path1),
            "total_points_v2": len(path2),
            "differences": differences,
            "is_consistent": len(differences) == 0
        }

    def check_history_consistency(self, result: PassengerFlowResult) -> Dict[str, Any]:
        if not result.path_history:
            return {"message": "没有路径回放记录"}

        if not self._replay_history:
            self._replay_history.append(result.path_history)
            return {"message": "首次记录路径回放", "version": 0}

        latest_version = len(self._replay_history) - 1
        comparison = self.compare_paths(latest_version, -1)

        if comparison.get("is_consistent"):
            return {"message": "路径回放与历史记录一致"}

        new_version = self.record_path(result.path_history)
        return {
            "message": f"路径已更新，新版本号: {new_version}",
            "differences": len(comparison.get("differences", [])),
            "comparison": comparison
        }

    def print_replay_summary(self, result: PassengerFlowResult):
        print("\n" + "=" * 60)
        print("路径回放摘要")
        print("=" * 60)
        print(f"站厅: {result.hall_name}")
        print(f"路径点数: {len(result.path_history)}")
        if result.path_history:
            print(f"起始点: ({result.path_history[0].x:.2f}, {result.path_history[0].y:.2f}, {result.path_history[0].z:.2f})")
            print(f"终点: ({result.path_history[-1].x:.2f}, {result.path_history[-1].y:.2f}, {result.path_history[-1].z:.2f})")
            total_passengers = sum(p.passenger_count for p in result.path_history)
            print(f"总客流统计: {total_passengers} 人次")
            print(f"历史版本数: {len(self._replay_history)}")
        print("=" * 60 + "\n")
