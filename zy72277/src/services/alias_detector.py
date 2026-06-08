from datetime import datetime
from typing import List, Dict, Tuple, Optional
from src.models.base import (
    RangefinderRecord, ObstacleRemark, NameAliasCandidate,
    OperationLog, ConfirmStatus
)
from src.utils.geo import haversine_distance, name_similarity
from config.settings import DISTANCE_THRESHOLD_METERS, NAME_SIMILARITY_THRESHOLD


class AliasDetector:
    def detect_aliases(
        self,
        records: List[RangefinderRecord],
        remarks: List[ObstacleRemark],
        previous_candidates: List[NameAliasCandidate] = None
    ) -> Tuple[List[NameAliasCandidate], List[OperationLog]]:
        candidates: List[NameAliasCandidate] = []
        logs: List[OperationLog] = []
        all_items = []

        prev_map = {}
        if previous_candidates:
            for pc in previous_candidates:
                pair_key = tuple(sorted([pc.primary_record_id, pc.alias_record_id]))
                prev_map[pair_key] = pc

        for r in records:
            if not r.is_duplicate:
                all_items.append({
                    "id": r.record_id,
                    "name": r.obstacle_name,
                    "lat": r.latitude,
                    "lon": r.longitude,
                    "type": "record"
                })

        for rm in remarks:
            all_items.append({
                "id": rm.remark_id,
                "name": rm.obstacle_name,
                "lat": rm.latitude,
                "lon": rm.longitude,
                "type": "remark"
            })

        seen_pairs = set()

        for i, item1 in enumerate(all_items):
            for j, item2 in enumerate(all_items):
                if i >= j:
                    continue

                pair_key = tuple(sorted([item1["id"], item2["id"]]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                if item1["name"] == item2["name"]:
                    continue

                distance = haversine_distance(
                    item1["lat"], item1["lon"],
                    item2["lat"], item2["lon"]
                )

                if distance > DISTANCE_THRESHOLD_METERS:
                    continue

                similarity = name_similarity(item1["name"], item2["name"])

                if similarity >= NAME_SIMILARITY_THRESHOLD or distance < 1.0:
                    primary = item1 if item1["type"] == "record" else item2
                    alias = item2 if item1["type"] == "record" else item1

                    inherited = prev_map.get(pair_key)

                    if inherited and inherited.confirm_status != ConfirmStatus.PENDING:
                        candidate = NameAliasCandidate(
                            candidate_id=inherited.candidate_id,
                            primary_name=primary["name"],
                            alias_name=alias["name"],
                            similarity=similarity,
                            distance_meters=distance,
                            primary_record_id=primary["id"],
                            alias_record_id=alias["id"],
                            confirm_status=inherited.confirm_status,
                            reviewed_by=inherited.reviewed_by,
                            reviewed_at=inherited.reviewed_at
                        )
                        candidates.append(candidate)
                        logs.append(OperationLog(
                            operator="system",
                            action="alias_decision_inherited",
                            detail=f"继承已有决策:「{primary['name']}」与「{alias['name']}」{inherited.confirm_status.value}"
                        ))
                    else:
                        candidate = NameAliasCandidate(
                            primary_name=primary["name"],
                            alias_name=alias["name"],
                            similarity=similarity,
                            distance_meters=distance,
                            primary_record_id=primary["id"],
                            alias_record_id=alias["id"],
                            confirm_status=ConfirmStatus.PENDING
                        )
                        candidates.append(candidate)

                        logs.append(OperationLog(
                            operator="system",
                            action="alias_candidate_detected",
                            detail=f"发现可能的同物异名:「{primary['name']}」与「{alias['name']}」相似度{similarity:.2f}，距离{distance:.2f}米，待学员复核"
                        ))

        return candidates, logs

    def review_alias(
        self,
        candidate_id: str,
        all_candidates: List[NameAliasCandidate],
        reviewer: str,
        is_same_object: bool
    ) -> Tuple[List[NameAliasCandidate], List[OperationLog]]:
        logs: List[OperationLog] = []

        for candidate in all_candidates:
            if candidate.candidate_id == candidate_id:
                candidate.confirm_status = ConfirmStatus.CONFIRMED if is_same_object else ConfirmStatus.REJECTED
                candidate.reviewed_by = reviewer
                candidate.reviewed_at = datetime.now()

                action = "alias_confirmed" if is_same_object else "alias_rejected"
                decision = "确认是同物异名" if is_same_object else "判定为不同物体"
                logs.append(OperationLog(
                    operator=reviewer,
                    action=action,
                    detail=f"{decision}:「{candidate.primary_name}」与「{candidate.alias_name}」"
                ))
                break

        return all_candidates, logs
