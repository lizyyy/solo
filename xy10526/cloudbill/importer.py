from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    CloudBill, Resource, TagStrategy, OwnerMapping, Project, Tag,
    BillStatus, ProjectStatus, ImportBatch, HistoryRecord, generate_id
)
from .storage import Storage
import json


class Importer:
    def __init__(self, storage: Storage):
        self.storage = storage

    def import_bills(self, file_path: str, operator: Optional[str] = None) -> Dict[str, Any]:
        batch_id = generate_id("batch_bill_")
        batch = ImportBatch(
            batch_id=batch_id,
            import_type="bill",
            file_name=file_path,
            record_count=0,
            success_count=0,
            fail_count=0,
            status="running",
            operator=operator
        )
        self.storage.batches.save(batch_id, batch)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                raise ValueError("账单文件格式错误：应该是列表")

            batch.record_count = len(data)
            errors = []
            imported_ids = []

            for idx, item in enumerate(data):
                try:
                    bill_id = item.get("bill_id") or generate_id("bill_")

                    if self.storage.bills.exists(bill_id):
                        errors.append(f"跳过重复账单: {bill_id}")
                        continue

                    raw_tags = Tag(
                        project=item.get("project"),
                        env=item.get("env"),
                        owner=item.get("owner")
                    )

                    bill = CloudBill(
                        bill_id=bill_id,
                        resource_id=item["resource_id"],
                        resource_type=item["resource_type"],
                        cost=float(item["cost"]),
                        currency=item.get("currency", "CNY"),
                        billing_period=item["billing_period"],
                        billing_date=item["billing_date"],
                        provider=item["provider"],
                        raw_tags=raw_tags,
                        status=BillStatus.IMPORTED,
                        import_batch_id=batch_id
                    )

                    self.storage.bills.save(bill.bill_id, bill)
                    imported_ids.append(bill.bill_id)
                    batch.success_count += 1

                except Exception as e:
                    errors.append(f"第{idx}行错误: {str(e)}")
                    batch.fail_count += 1

            batch.errors = errors
            batch.status = "completed"
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)

            return {
                "success": True,
                "batch_id": batch_id,
                "total": batch.record_count,
                "success_count": batch.success_count,
                "failed": batch.fail_count,
                "errors": errors,
                "imported_ids": imported_ids
            }

        except Exception as e:
            batch.status = "failed"
            batch.errors = [str(e)]
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)
            return {
                "success": False,
                "batch_id": batch_id,
                "error": str(e)
            }

    def import_resources(self, file_path: str, operator: Optional[str] = None) -> Dict[str, Any]:
        batch_id = generate_id("batch_res_")
        batch = ImportBatch(
            batch_id=batch_id,
            import_type="resource",
            file_name=file_path,
            record_count=0,
            success_count=0,
            fail_count=0,
            status="running",
            operator=operator
        )
        self.storage.batches.save(batch_id, batch)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                raise ValueError("资源文件格式错误")

            batch.record_count = len(data)
            errors = []

            for idx, item in enumerate(data):
                try:
                    resource_id = item["resource_id"]
                    tags = Tag(
                        project=item.get("project"),
                        env=item.get("env"),
                        owner=item.get("owner")
                    )

                    existing = self.storage.resources.get(resource_id)
                    if existing:
                        existing.tags = tags
                        existing.updated_at = datetime.now()
                        existing.resource_type = item.get("resource_type", existing.resource_type)
                        self.storage.resources.save(resource_id, existing)
                    else:
                        resource = Resource(
                            resource_id=resource_id,
                            resource_type=item["resource_type"],
                            provider=item["provider"],
                            tags=tags
                        )
                        self.storage.resources.save(resource_id, resource)

                    batch.success_count += 1

                except Exception as e:
                    errors.append(f"第{idx}行错误: {str(e)}")
                    batch.fail_count += 1

            batch.errors = errors
            batch.status = "completed"
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)

            return {
                "success": True,
                "batch_id": batch_id,
                "total": batch.record_count,
                "success_count": batch.success_count,
                "failed": batch.fail_count,
                "errors": errors
            }

        except Exception as e:
            batch.status = "failed"
            batch.errors = [str(e)]
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)
            return {
                "success": False,
                "batch_id": batch_id,
                "error": str(e)
            }

    def import_strategies(self, file_path: str, operator: Optional[str] = None) -> Dict[str, Any]:
        batch_id = generate_id("batch_strat_")
        batch = ImportBatch(
            batch_id=batch_id,
            import_type="strategy",
            file_name=file_path,
            record_count=0,
            success_count=0,
            fail_count=0,
            status="running",
            operator=operator
        )
        self.storage.batches.save(batch_id, batch)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                raise ValueError("策略文件格式错误")

            batch.record_count = len(data)
            errors = []

            for idx, item in enumerate(data):
                try:
                    strategy_id = item.get("strategy_id") or generate_id("strat_")

                    strategy = TagStrategy(
                        strategy_id=strategy_id,
                        name=item["name"],
                        description=item.get("description", ""),
                        resource_type_pattern=item["resource_type_pattern"],
                        tag_rules=item["tag_rules"],
                        priority=item.get("priority", 0),
                        is_active=item.get("is_active", True)
                    )

                    self.storage.strategies.save(strategy_id, strategy)
                    batch.success_count += 1

                except Exception as e:
                    errors.append(f"第{idx}行错误: {str(e)}")
                    batch.fail_count += 1

            batch.errors = errors
            batch.status = "completed"
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)

            return {
                "success": True,
                "batch_id": batch_id,
                "total": batch.record_count,
                "success_count": batch.success_count,
                "failed": batch.fail_count,
                "errors": errors
            }

        except Exception as e:
            batch.status = "failed"
            batch.errors = [str(e)]
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)
            return {
                "success": False,
                "batch_id": batch_id,
                "error": str(e)
            }

    def import_owners(self, file_path: str, operator: Optional[str] = None) -> Dict[str, Any]:
        batch_id = generate_id("batch_own_")
        batch = ImportBatch(
            batch_id=batch_id,
            import_type="owner",
            file_name=file_path,
            record_count=0,
            success_count=0,
            fail_count=0,
            status="running",
            operator=operator
        )
        self.storage.batches.save(batch_id, batch)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                raise ValueError("负责人文件格式错误")

            batch.record_count = len(data)
            errors = []

            for idx, item in enumerate(data):
                try:
                    owner_id = item.get("owner_id") or generate_id("own_")

                    owner = OwnerMapping(
                        owner_id=owner_id,
                        name=item["name"],
                        email=item["email"],
                        projects=item["projects"],
                        is_active=item.get("is_active", True)
                    )

                    self.storage.owners.save(owner_id, owner)
                    batch.success_count += 1

                except Exception as e:
                    errors.append(f"第{idx}行错误: {str(e)}")
                    batch.fail_count += 1

            batch.errors = errors
            batch.status = "completed"
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)

            return {
                "success": True,
                "batch_id": batch_id,
                "total": batch.record_count,
                "success_count": batch.success_count,
                "failed": batch.fail_count,
                "errors": errors
            }

        except Exception as e:
            batch.status = "failed"
            batch.errors = [str(e)]
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)
            return {
                "success": False,
                "batch_id": batch_id,
                "error": str(e)
            }

    def import_projects(self, file_path: str, operator: Optional[str] = None) -> Dict[str, Any]:
        batch_id = generate_id("batch_proj_")
        batch = ImportBatch(
            batch_id=batch_id,
            import_type="project",
            file_name=file_path,
            record_count=0,
            success_count=0,
            fail_count=0,
            status="running",
            operator=operator
        )
        self.storage.batches.save(batch_id, batch)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, list):
                raise ValueError("项目文件格式错误")

            batch.record_count = len(data)
            errors = []

            for idx, item in enumerate(data):
                try:
                    project_id = item.get("project_id") or generate_id("proj_")

                    project = Project(
                        project_id=project_id,
                        name=item["name"],
                        code=item["code"],
                        status=ProjectStatus(item.get("status", "active")),
                        description=item.get("description")
                    )

                    self.storage.projects.save(project_id, project)
                    batch.success_count += 1

                except Exception as e:
                    errors.append(f"第{idx}行错误: {str(e)}")
                    batch.fail_count += 1

            batch.errors = errors
            batch.status = "completed"
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)

            return {
                "success": True,
                "batch_id": batch_id,
                "total": batch.record_count,
                "success_count": batch.success_count,
                "failed": batch.fail_count,
                "errors": errors
            }

        except Exception as e:
            batch.status = "failed"
            batch.errors = [str(e)]
            batch.completed_at = datetime.now()
            self.storage.batches.save(batch_id, batch)
            return {
                "success": False,
                "batch_id": batch_id,
                "error": str(e)
            }
