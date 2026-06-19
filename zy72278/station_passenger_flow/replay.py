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
        if version < 0:
            return None
        if self._store and result_id:
            replay_data = self._store.load_replay_version(result_id, version)
            if replay_data is not None:
                return [PathPoint(**p) for p in replay_data.get("path_points", [])]
        if 0 <= version < len(self._replay_history):
            return self._replay_history[version]
        return None

    def get_path_version_detail(self, version: int, result_id: str = None) -> Optional[Dict[str, Any]]:
        if version < 0:
            available = self._store.list_replay_versions(result_id) if (self._store and result_id) else list(range(len(self._replay_history)))
            return {
                "found": False,
                "message": f"回放版本{version}不存在（版本号不能为负数）。当前可选版本：{available}。请先确认版本号再查看。",
                "available_versions": available
            }

        if self._store and result_id:
            replay_data = self._store.load_replay_version(result_id, version)
            if replay_data is not None:
                points = [PathPoint(**p) for p in replay_data.get("path_points", [])]
                return {
                    "found": True,
                    "replay_version": replay_data["replay_version"],
                    "result_version": replay_data["result_version"],
                    "result_id": replay_data["result_id"],
                    "saved_at": replay_data["saved_at"],
                    "path_points": points,
                    "total_points": len(points),
                    "source": "persistent"
                }
            available = self._store.list_replay_versions(result_id)
            return {
                "found": False,
                "message": f"回放版本{version}不存在。当前可选版本：{available}。请先确认版本号再查看。",
                "available_versions": available
            }

        if 0 <= version < len(self._replay_history):
            return {
                "found": True,
                "replay_version": version,
                "result_version": None,
                "result_id": None,
                "saved_at": None,
                "path_points": self._replay_history[version],
                "total_points": len(self._replay_history[version]),
                "source": "memory"
            }

        return {
            "found": False,
            "message": f"回放版本{version}不存在。当前内存中有{len(self._replay_history)}个版本（0~{len(self._replay_history)-1}）。",
            "available_versions": list(range(len(self._replay_history)))
        }

    def compare_paths(self, version1: int, version2: int, result_id: str = None) -> Dict[str, Any]:
        detail1 = self.get_path_version_detail(version1, result_id)
        detail2 = self.get_path_version_detail(version2, result_id)

        if not detail1.get("found"):
            return {
                "error": "版本不存在",
                "can_continue": False,
                "message": detail1.get("message", f"版本{version1}不存在，无法对比。"),
                "missing_version": version1,
                "available_versions": detail1.get("available_versions", [])
            }
        if not detail2.get("found"):
            return {
                "error": "版本不存在",
                "can_continue": False,
                "message": detail2.get("message", f"版本{version2}不存在，无法对比。"),
                "missing_version": version2,
                "available_versions": detail2.get("available_versions", [])
            }

        path1 = detail1["path_points"]
        path2 = detail2["path_points"]

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
            "can_continue": True,
            "version1": version1,
            "version2": version2,
            "total_points_v1": len(path1),
            "total_points_v2": len(path2),
            "differences": differences,
            "is_consistent": len(differences) == 0,
            "result_version_v1": detail1.get("result_version"),
            "result_version_v2": detail2.get("result_version")
        }

    def check_history_consistency(self, result: PassengerFlowResult) -> Dict[str, Any]:
        if not result.path_history:
            return {
                "can_continue": False,
                "message": "没有路径回放记录"
            }

        existing_versions = self.list_available_versions(result.result_id)
        versions_list = existing_versions.get("versions", [])

        if not versions_list:
            new_version = self.record_path(result.path_history, result.result_id, result.version)
            return {
                "can_continue": True,
                "message": "首次记录路径回放",
                "version": new_version,
                "result_version": result.version,
                "result_id": result.result_id
            }

        latest_real_version = max(versions_list)
        latest_stored_path = self.get_path_version(latest_real_version, result.result_id)

        if latest_stored_path is None:
            return {
                "can_continue": False,
                "message": f"无法获取最新历史版本{latest_real_version}的路径数据，版本可能不存在。",
                "error_details": {"latest_version": latest_real_version, "available": versions_list}
            }

        comparison = self._compare_two_path_lists(
            latest_stored_path, result.path_history,
            version1=latest_real_version, version2="current"
        )

        if not comparison.get("can_continue"):
            return {
                "can_continue": False,
                "message": f"对比失败：{comparison.get('message', '未知错误')}。",
                "error_details": comparison
            }

        if comparison.get("is_consistent"):
            return {
                "can_continue": True,
                "message": f"路径回放与历史版本{latest_real_version}一致，无需生成新版本。",
                "existing_version": latest_real_version,
                "result_version": result.version,
                "result_id": result.result_id
            }

        new_version = self.record_path(result.path_history, result.result_id, result.version)
        return {
            "can_continue": True,
            "message": f"路径已更新，新版本号: {new_version}",
            "version": new_version,
            "result_version": result.version,
            "result_id": result.result_id,
            "differences": len(comparison.get("differences", [])),
            "comparison": comparison
        }

    def _compare_two_path_lists(self, path1: List[PathPoint], path2: List[PathPoint], 
                                version1: Any, version2: Any) -> Dict[str, Any]:
        if len(path1) != len(path2):
            return {
                "can_continue": True,
                "is_consistent": False,
                "differences": [f"路径点数不同：版本{version1}有{len(path1)}个点，版本{version2}有{len(path2)}个点"],
                "total_points_v1": len(path1),
                "total_points_v2": len(path2),
                "position_diff_count": 0,
                "passenger_diff_count": 0,
                "point_count_diff": abs(len(path1) - len(path2))
            }

        differences = []
        position_diff_count = 0
        passenger_diff_count = 0

        for i, (p1, p2) in enumerate(zip(path1, path2)):
            if abs(p1.x - p2.x) > 0.001 or abs(p1.y - p2.y) > 0.001 or abs(p1.z - p2.z) > 0.001:
                position_diff_count += 1
                differences.append(f"点{i+1}位置不同：版本{version1}({p1.x:.2f}, {p1.y:.2f}, {p1.z:.2f}) vs 版本{version2}({p2.x:.2f}, {p2.y:.2f}, {p2.z:.2f})")
            if abs(p1.passenger_count - p2.passenger_count) > 0.001:
                passenger_diff_count += 1
                differences.append(f"点{i+1}客流不同：版本{version1}({p1.passenger_count}) vs 版本{version2}({p2.passenger_count})")

        total1 = sum(p.passenger_count for p in path1)
        total2 = sum(p.passenger_count for p in path2)

        return {
            "can_continue": True,
            "is_consistent": len(differences) == 0,
            "differences": differences,
            "total_passengers_v1": total1,
            "total_passengers_v2": total2,
            "passenger_diff": total2 - total1,
            "position_diff_count": position_diff_count,
            "passenger_diff_count": passenger_diff_count,
            "point_count_diff": 0,
            "version_v1": version1,
            "version_v2": version2
        }

    def verify_with_latest_result(self, result_id: str, replay_version: int) -> Dict[str, Any]:
        if not self._store:
            return {
                "consistent": False,
                "can_verify": False,
                "message": "未配置数据存储，无法校验回放与最新结果的一致性。"
            }

        if replay_version < 0:
            available = self._store.list_replay_versions(result_id)
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"回放版本{replay_version}不存在（版本号不能为负数）。请检查版本号。可选版本：{available}",
                "available_replay_versions": available
            }

        replay_data = self._store.load_replay_version(result_id, replay_version)
        if replay_data is None:
            available = self._store.list_replay_versions(result_id)
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"回放版本{replay_version}不存在，请检查版本号。可选版本：{available}",
                "available_replay_versions": available
            }

        result_version_in_replay = replay_data["result_version"]
        result_id_in_replay = replay_data["result_id"]
        latest_result = self._store.load_latest_result(result_id)

        if latest_result is None:
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"找不到结果ID「{result_id}」的任何数据，无法校验。"
            }

        if result_id_in_replay != latest_result.result_id:
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"回放关联的结果ID({result_id_in_replay})与当前结果ID({latest_result.result_id})不一致，不是同一份数据。",
                "replay_result_id": result_id_in_replay,
                "latest_result_id": latest_result.result_id
            }

        consistency_issues = []
        evidence = {
            "result_id_match": result_id_in_replay == latest_result.result_id,
            "cad_layer_name_match": None,
            "rangefinder_count": None,
            "result_version_match": latest_result.version == result_version_in_replay,
            "replay_result_id": result_id_in_replay,
            "latest_result_id": latest_result.result_id,
            "replay_result_version": result_version_in_replay,
            "latest_result_version": latest_result.version,
            "replay_saved_at": replay_data.get("saved_at"),
            "latest_calculate_time": latest_result.calculate_time.isoformat() if latest_result.calculate_time else None
        }

        if latest_result.version != result_version_in_replay:
            consistency_issues.append({
                "field": "result_version",
                "replay_value": result_version_in_replay,
                "latest_value": latest_result.version,
                "message": f"回放关联的结果版本({result_version_in_replay})与最新结果版本({latest_result.version})不一致，CAD图层名和测距仪记录可能与最新结果对不上。"
            })
        evidence["result_version_match"] = latest_result.version == result_version_in_replay

        if latest_result.cad_layer:
            evidence["cad_layer_name"] = latest_result.cad_layer.layer_name
            evidence["cad_layer_id"] = latest_result.cad_layer.layer_id
            evidence["cad_z_direction"] = latest_result.cad_layer.z_direction
            evidence["cad_source_file"] = latest_result.cad_layer.source_file

            replay_z_values = [p.get("z", 0) for p in replay_data.get("path_points", [])]
            if replay_z_values:
                first_replay_z = replay_z_values[0]
                cad_z = latest_result.cad_layer.z_direction
                if (cad_z > 0) != (first_replay_z >= 0):
                    consistency_issues.append({
                        "field": "z_direction",
                        "cad_value": cad_z,
                        "replay_value": first_replay_z,
                        "message": f"CAD图层Z轴方向({cad_z})与回放路径Z坐标({first_replay_z})趋势不一致，可能存在旧习惯写反的问题，请留给现场班组复核。"
                    })
        else:
            evidence["cad_layer_name"] = "无"

        if latest_result.rangefinder_records:
            evidence["rangefinder_count"] = len(latest_result.rangefinder_records)
            evidence["rangefinder_record_ids"] = [r.record_id for r in latest_result.rangefinder_records]
            evidence["rangefinder_measure_points"] = [r.measure_point for r in latest_result.rangefinder_records]
        else:
            evidence["rangefinder_count"] = 0

        evidence["path_point_count"] = len(replay_data.get("path_points", []))
        evidence["total_passengers"] = sum(
            p.get("passenger_count", 0) for p in replay_data.get("path_points", [])
        )

        if consistency_issues:
            return {
                "consistent": False,
                "can_verify": True,
                "message": f"回放版本{replay_version}与最新结果存在{len(consistency_issues)}处不一致，请确认CAD图层名和测距仪记录是否与最新结果对得上。",
                "issues": consistency_issues,
                "evidence": evidence,
                "latest_cad_layer_name": latest_result.cad_layer.layer_name if latest_result.cad_layer else None,
                "latest_rangefinder_count": len(latest_result.rangefinder_records),
                "latest_result_version": latest_result.version
            }

        return {
            "consistent": True,
            "can_verify": True,
            "message": f"回放版本{replay_version}与最新结果版本{latest_result.version}一致，CAD图层名和测距仪记录都对得上。",
            "evidence": evidence,
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
