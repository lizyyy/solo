from typing import List, Dict, Tuple, Any
from datetime import datetime

from kbcheck.models import Document, Owner, CheckResult


class OwnerChecker:
    def __init__(self):
        pass

    def analyze_owner_risks(
        self,
        documents: List[Document],
        owners: List[Owner],
        check_results: List[CheckResult],
    ) -> Dict[str, Any]:
        owner_map = {o.owner_id: o for o in owners}
        doc_map = {d.doc_id: d for d in documents}

        active_owners: Dict[str, List[Document]] = {}
        inactive_owners: Dict[str, List[Document]] = {}
        unassigned_docs: List[Document] = []

        for doc in documents:
            owner = owner_map.get(doc.owner_id)
            if not owner:
                unassigned_docs.append(doc)
            elif owner.is_active:
                if owner.owner_id not in active_owners:
                    active_owners[owner.owner_id] = []
                active_owners[owner.owner_id].append(doc)
            else:
                if owner.owner_id not in inactive_owners:
                    inactive_owners[owner.owner_id] = []
                inactive_owners[owner.owner_id].append(doc)

        owner_error_counts: Dict[str, Dict[str, int]] = {}
        for result in check_results:
            if result.status == "failed" or result.status == "warning":
                source_doc = doc_map.get(result.source_doc_id)
                if source_doc:
                    owner_id = source_doc.owner_id
                    if owner_id not in owner_error_counts:
                        owner_error_counts[owner_id] = {"failed": 0, "warning": 0}
                    if result.status == "failed":
                        owner_error_counts[owner_id]["failed"] += 1
                    else:
                        owner_error_counts[owner_id]["warning"] += 1

        return {
            "active_owners": active_owners,
            "inactive_owners": inactive_owners,
            "unassigned_docs": unassigned_docs,
            "owner_error_counts": owner_error_counts,
        }

    def get_repair_list_by_owner(
        self,
        documents: List[Document],
        owners: List[Owner],
        check_results: List[CheckResult],
    ) -> Dict[str, List[Dict[str, Any]]]:
        owner_map = {o.owner_id: o for o in owners}
        doc_map = {d.doc_id: d for d in documents}

        repair_lists: Dict[str, List[Dict[str, Any]]] = {}

        for result in check_results:
            if result.status == "passed":
                continue

            source_doc = doc_map.get(result.source_doc_id)
            if not source_doc:
                continue

            owner_id = source_doc.owner_id
            owner = owner_map.get(owner_id)

            if owner_id not in repair_lists:
                repair_lists[owner_id] = []

            repair_lists[owner_id].append({
                "document": {
                    "id": source_doc.doc_id,
                    "title": source_doc.title,
                    "path": source_doc.path,
                },
                "owner": {
                    "id": owner_id,
                    "name": owner.name if owner else "未知",
                    "email": owner.email if owner else "",
                    "is_active": owner.is_active if owner else False,
                },
                "issue": {
                    "link_id": result.link_id,
                    "target_url": result.target_url,
                    "status": result.status,
                    "error_type": result.error_type,
                    "error_message": result.error_message,
                    "http_status": result.http_status_code,
                },
                "priority": self._calculate_priority(result),
            })

        for owner_id in repair_lists:
            repair_lists[owner_id].sort(key=lambda x: {
                "critical": 0,
                "high": 1,
                "medium": 2,
                "low": 3,
            }[x["priority"]])

        return repair_lists

    def _calculate_priority(self, result: CheckResult) -> str:
        if result.status == "failed":
            if result.error_type == "404":
                return "critical"
            return "high"

        if result.status == "warning":
            if result.error_type == "owner_inactive":
                return "high"
            if result.error_type == "permission":
                return "medium"
            if result.error_type == "redirect":
                return "medium"
            return "low"

        return "low"
