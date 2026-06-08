from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import PathPoint, PassengerFlowResult
from .store import DataStore


class PathReplay:
    def __init__(self, data_store: DataStore = None):
        self._replay_history: List[List[PathPoint]] = []
        self._store = data_store

    def record_path(self, path_points: List[PathPoint], result_id: str = None, result_version: int = None) -> int:
        new_version = len(self._replay_history)
        self._replay_history.append(path_points)
        if self._store and result_id:
            saved_version = self._store.save_replay_version(result_id, result_version or 1, path_points)
            return saved_version
        return new_version

    def get_path_version(self, version: int, result_id: str = None) -> Optional[List[PathPoint]]:
        if self._store and result_id:
            replay_data = self._store.load_replay_version(result_id, version)
            if replay_data is None:
                return None
            return [PathPoint(**p) for p in replay_data.get("path_points", [])]
        if 0 <= version < len(self._replay_history):
            return self._replay_history[version]
        return None

    def get_path_version_detail(self, version: int, result_id: str = None) -> Optional[Dict[str, Any]]:
        if self._store and result_id:
            replay_data = self._store.load_replay_version(result_id, version)
            if replay_data is None:
                available = self._store.list_replay_versions(result_id)
                return {
                    "found": False,
                    "message": f"回放版本{version}不存在。当前可选版本：{available}。请先确认版本号再查看。",
                    "available_versions": available
                }
            points = [PathPoint(**p) for p in replay_data.get("path_points", [])]
            return {
                "found": True,
                "replay_version": replay_data["replay_version"],
                "result_version": replay_data["result_version"],
                "saved_at": replay_data["saved_at"],
                "path_points": points,
                "total_points": len(points)
            }
        if 0 <= version < len(self._replay_history):
            return {
                "found": True,
                "replay_version": version,
                "result_version": None,
                "saved_at": None,
                "path_points": self._replay_history[version],
                "total_points": len(self._replay_history[version])
            }
        return {
            "found": False,
            "message": f"回放版本{version}不存在。当前内存中有{len(self._replay_history)}个版本（0~{len(self._replay_history)-1}）。",
            "available_versions": list(range(len(self._replay_history)))
        }

    def compare_paths(self, version1: int, version2: int, result_id: str = None) -> Dict[str, Any]:
        path1 = self.get_path_version(version1, result_id)
        path2 = self.get_path_version(version2, result_id)

        if not path1:
            return {
                "error": "版本不存在",
                "message": f"版本{version1}不存在，无法对比。请检查版本号是否正确。",
                "missing_version": version1
            }
        if not path2:
            return {
                "error": "版本不存在",
                "message": f"版本{version2}不存在，无法对比。请检查版本号是否正确。",
                "missing_version": version2
            }

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
            new_version = self.record_path(result.path_history, result.result_id, result.version)
            return {
                "message": "首次记录路径回放",
                "version": new_version,
                "result_version": result.version
            }

        latest_version = len(self._replay_history) - 1
        comparison = self.compare_paths(latest_version, -1)

        if comparison.get("is_consistent"):
            return {"message": "路径回放与历史记录一致"}

        new_version = self.record_path(result.path_history, result.result_id, result.version)
        return {
            "message": f"路径已更新，新版本号: {new_version}",
            "version": new_version,
            "result_version": result.version,
            "differences": len(comparison.get("differences", [])),
            "comparison": comparison
        }

    def verify_with_latest_result(self, result_id: str, replay_version: int) -> Dict[str, Any]:
        if not self._store:
            return {
                "message": "未配置数据存储，无法校验回放与最新结果的一致性。",
                "can_verify": False
            }

        replay_data = self._store.load_replay_version(result_id, replay_version)
        if replay_data is None:
            available = self._store.list_replay_versions(result_id)
            return {
                "consistent": False,
                "message": f"回放版本{replay_version}不存在，请检查版本号。可选版本：{available}",
                "can_verify": True,
                "available_replay_versions": available
            }

        result_version_in_replay = replay_data["result_version"]
        latest_result = self._store.load_latest_result(result_id)

        if latest_result is None:
            return {
                "consistent": False,
                "message": f"找不到结果ID「{result_id}」的任何数据，无法校验。",
                "can_verify": True
            }

        consistency_issues = []

        if latest_result.version != result_version_in_replay:
            consistency_issues.append({
                "field": "result_version",
                "replay_value": result_version_in_replay,
                "latest_value": latest_result.version,
                "message": f"回放关联的结果版本({result_version_in_replay})与最新结果版本({latest_result.version})不一致，CAD图层名和测距仪记录可能与最新结果对不上。"
            })

        if latest_result.cad_layer:
            cad_z = latest_result.cad_layer.z_direction
            replay_z_values = [p.get("z", 0) for p in replay_data.get("path_points", [])]
            if replay_z_values:
                avg_replay_z = sum(abs(v) for v in replay_z_values) / len(replay_z_values)
                if avg_replay_z > 0 and (cad_z > 0) != (replay_z_values[0] >= 0):
                    consistency_issues.append({
                        "field": "z_direction",
                        "cad_value": cad_z,
                        "replay_avg_z": replay_z_values[0],
                        "message": f"CAD图层Z轴方向({cad_z})与回放路径Z坐标趋势不一致，可能存在旧习惯写反的问题，请留给现场班组复核。"
                    })

        if consistency_issues:
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"回放版本{replay_version}与最新结果存在{len(consistency_issues)}处不一致，请确认CAD图层名和测距仪记录是否与最新结果对得上。",
                "issues": consistency_issues,
                "latest_cad_layer_name": latest_result.cad_layer.layer_name if latest_result.cad_layer else None,
                "latest_rangefinder_count": len(latest_result.rangefinder_records),
                "latest_result_version": latest_result.version
            }

        return {
            "consistent": True,
            "can_verify": True,
            "message": f"回放版本{replay_version}与最新结果版本{latest_result.version}一致，CAD图层名和测距仪记录都对得上。",
            "latest_cad_layer_name": latest_result.cad_layer.layer_name if latest_result.cad_layer else None,
            "latest_rangefinder_count": len(latest_result.rangefinder_records),
            "latest_result_version": latest_result.version
        }

    def list_available_versions(self, result_id: str = None) -> Dict[str, Any]:
        if self._store and result_id:
            versions = self._store.list_replay_versions(result_id)
            return {
                "source": "persistent",
                "result_id": result_id,
                "versions": versions,
                "message": f"结果「{result_id}」有{len(versions)}个回放版本可供查看。" if versions else "还没有回放记录。"
            }
        return {
            "source": "memory",
            "versions": list(range(len(self._replay_history))),
            "message": f"内存中有{len(self._replay_history)}个回放版本。" if self._replay_history else "还没有回放记录。"
        }

    def print_replay_summary(self, result: PassengerFlowResult):
        print("\n" + "=" * 60)
        print("路径回放摘要")
        print("=" * 60)
        print(f"站厅: {result.hall_name}")
        print(f"结果ID: {result.result_id}")
        print(f"结果版本: {result.version}")
        print(f"路径点数: {len(result.path_history)}")
        if result.path_history:
            print(f"起始点: ({result.path_history[0].x:.2f}, {result.path_history[0].y:.2f}, {result.path_history[0].z:.2f})")
            print(f"终点: ({result.path_history[-1].x:.2f}, {result.path_history[-1].y:.2f}, {result.path_history[-1].z:.2f})")
            total_passengers = sum(p.passenger_count for p in result.path_history)
            print(f"总客流统计: {total_passengers} 人次")
        if self._store:
            available = self._store.list_replay_versions(result.result_id)
            print(f"持久化回放版本: {available}")
        else:
            print(f"内存回放版本数: {len(self._replay_history)}")
        print("=" * 60 + "\n")
