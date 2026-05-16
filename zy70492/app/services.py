import httpx
import json
from typing import List, Dict, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app import models, schemas, crud
from app.models import TaskStatus, FailureType
from app.config import settings


class MaterialDownloader:
    def __init__(self):
        self.timeout = settings.MATERIAL_DOWNLOAD_TIMEOUT
        self.max_retries = settings.MAX_RETRY_COUNT
    
    async def verify_and_download(self, url: str) -> Tuple[bool, str, Dict]:
        if "expired" in url.lower() or "invalid" in url.lower():
            return False, "下载链接已失效", {
                "error_code": "LINK_EXPIRED",
                "details": "该材料下载链接已超过有效期",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        if "404" in url or "not-found" in url:
            return False, "资源不存在", {
                "error_code": "RESOURCE_NOT_FOUND",
                "details": "请求的材料资源不存在",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                
                if response.status_code == 401:
                    return False, "权限验证失败", {
                        "error_code": "PERMISSION_DENIED",
                        "details": "无权限访问该材料",
                        "status_code": 401
                    }
                
                if response.status_code == 404:
                    return False, "资源不存在", {
                        "error_code": "RESOURCE_NOT_FOUND",
                        "details": "材料链接已失效",
                        "status_code": 404
                    }
                
                if response.status_code >= 400:
                    return False, f"下载失败: HTTP {response.status_code}", {
                        "error_code": "DOWNLOAD_FAILED",
                        "status_code": response.status_code
                    }
                
                content = response.text
                try:
                    data = json.loads(content)
                except json.JSONDecodeError:
                    data = {"raw_content": content[:500]}
                
                return True, "下载成功", data
                
        except httpx.TimeoutException:
            return False, "下载超时", {
                "error_code": "TIMEOUT",
                "details": "材料下载请求超时"
            }
        except httpx.HTTPError as e:
            return False, f"网络错误: {str(e)}", {
                "error_code": "NETWORK_ERROR",
                "details": str(e)
            }
        except Exception as e:
            return False, f"内部错误: {str(e)}", {
                "error_code": "INTERNAL_ERROR",
                "details": str(e)
            }


class QuotaRecycleService:
    def __init__(self, db: Session):
        self.db = db
        self.downloader = MaterialDownloader()
    
    async def execute_recycle_task(self, task_id: int) -> models.QuotaRecycleTask:
        task = crud.get_task(self.db, task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        crud.update_task_status(self.db, task_id, TaskStatus.PROCESSING)
        
        success, message, material_data = await self.downloader.verify_and_download(task.material_url)
        
        if not success:
            failure_type = self._map_error_to_failure_type(message)
            crud.create_failed_item(self.db, schemas.FailedItemCreate(
                task_id=task_id,
                failure_type=failure_type,
                error_message=message,
                raw_data=json.dumps(material_data, ensure_ascii=False)
            ))
            crud.update_task_stats(self.db, task_id, 0, 1, 0.0)
            return crud.get_task(self.db, task_id)
        
        summary = self._generate_material_summary(material_data)
        task.material_summary = summary
        self.db.commit()
        
        success_count = 0
        failed_count = 0
        total_recycled = 0.0
        
        mock_tenants = self._generate_mock_tenant_data(material_data)
        
        for tenant in mock_tenants:
            try:
                if tenant.get("should_fail", False):
                    fail_reason = tenant.get("fail_reason", "租户配额计算错误")
                    failure_type = tenant.get("failure_type", FailureType.QUOTA_CALCULATION_ERROR)
                    
                    crud.create_failed_item(self.db, schemas.FailedItemCreate(
                        task_id=task_id,
                        failure_type=failure_type,
                        tenant_id=tenant["tenant_id"],
                        tenant_name=tenant["tenant_name"],
                        error_message=fail_reason,
                        raw_data=json.dumps(tenant, ensure_ascii=False)
                    ))
                    failed_count += 1
                else:
                    recycled = tenant["recycled_quota"]
                    crud.create_recycle_detail(self.db, schemas.RecycleDetailCreate(
                        task_id=task_id,
                        tenant_id=tenant["tenant_id"],
                        tenant_name=tenant["tenant_name"],
                        original_quota=tenant["original_quota"],
                        recycled_quota=recycled,
                        remaining_quota=tenant["original_quota"] - recycled,
                        reason=f"灰度物流拦截 - {tenant.get('risk_level', '高风险')}",
                        evidence_url=task.material_url
                    ))
                    success_count += 1
                    total_recycled += recycled
                    
            except Exception as e:
                crud.create_failed_item(self.db, schemas.FailedItemCreate(
                    task_id=task_id,
                    failure_type=FailureType.INTERNAL_ERROR,
                    tenant_id=tenant.get("tenant_id"),
                    tenant_name=tenant.get("tenant_name"),
                    error_message=f"处理失败: {str(e)}",
                    raw_data=json.dumps(tenant, ensure_ascii=False)
                ))
                failed_count += 1
        
        crud.update_task_stats(self.db, task_id, success_count, failed_count, total_recycled)
        return crud.get_task(self.db, task_id)
    
    def _map_error_to_failure_type(self, error_message: str) -> FailureType:
        msg_lower = error_message.lower()
        if "失效" in msg_lower or "expired" in msg_lower or "不存在" in msg_lower:
            return FailureType.DOWNLOAD_LINK_EXPIRED
        elif "权限" in msg_lower or "permission" in msg_lower:
            return FailureType.PERMISSION_DENIED
        elif "超时" in msg_lower or "timeout" in msg_lower or "网络" in msg_lower:
            return FailureType.NETWORK_ERROR
        elif "验证" in msg_lower:
            return FailureType.MATERIAL_VERIFICATION_FAILED
        else:
            return FailureType.INTERNAL_ERROR
    
    def _generate_material_summary(self, material_data: Dict) -> str:
        parts = ["材料摘要:\n"]
        
        if isinstance(material_data, dict):
            if "tenants" in material_data:
                parts.append(f"- 涉及租户数量: {len(material_data['tenants'])}\n")
            if "risk_level" in material_data:
                parts.append(f"- 风险等级: {material_data['risk_level']}\n")
            if "intercept_time" in material_data:
                parts.append(f"- 拦截时间: {material_data['intercept_time']}\n")
        
        parts.append(f"- 数据获取时间: {datetime.utcnow().isoformat()}\n")
        return "".join(parts)
    
    def _generate_mock_tenant_data(self, material_data: Dict) -> List[Dict]:
        base_tenants = [
            {
                "tenant_id": "T001",
                "tenant_name": "示例物流有限公司",
                "original_quota": 10000.0,
                "recycled_quota": 8000.0,
                "risk_level": "高风险",
                "should_fail": False
            },
            {
                "tenant_id": "T002",
                "tenant_name": "灰度仓储服务公司",
                "original_quota": 5000.0,
                "recycled_quota": 3500.0,
                "risk_level": "中风险",
                "should_fail": False
            },
            {
                "tenant_id": "T003",
                "tenant_name": "链接已失效租户",
                "original_quota": 8000.0,
                "recycled_quota": 0.0,
                "risk_level": "高风险",
                "should_fail": True,
                "fail_reason": "材料下载链接已失效，无法验证回收依据",
                "failure_type": FailureType.DOWNLOAD_LINK_EXPIRED
            },
            {
                "tenant_id": "T004",
                "tenant_name": "配额计算错误租户",
                "original_quota": 3000.0,
                "recycled_quota": 0.0,
                "risk_level": "低风险",
                "should_fail": True,
                "fail_reason": "租户配额数据不完整，计算回收额度失败",
                "failure_type": FailureType.QUOTA_CALCULATION_ERROR
            },
            {
                "tenant_id": "T005",
                "tenant_name": "极速配送集团",
                "original_quota": 15000.0,
                "recycled_quota": 12000.0,
                "risk_level": "高风险",
                "should_fail": False
            }
        ]
        return base_tenants


def create_sample_data(db: Session) -> None:
    if crud.get_task_by_batch_no(db, "BATCH-2024-001"):
        return
    
    task1 = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
        batch_no="BATCH-2024-001",
        operator="admin",
        risk_type=models.RiskType.GRAY_LOGISTICS,
        material_url="https://example.com/materials/gray-logistics-2024-01.json",
        material_summary="示例批处理器量物流拦截材料",
        total_target_quota=30000.0,
        remark="首批灰度物流配额回收任务"
    ))
    
    task2 = crud.create_task(db, schemas.QuotaRecycleTaskCreate(
        batch_no="BATCH-2024-002",
        operator="operator_a",
        risk_type=models.RiskType.UNAUTHORIZED_ACCESS,
        material_url="https://expired-example.com/materials/invalid-link.json",
        material_summary="已失效链接材料",
        total_target_quota=15000.0,
        remark="测试链接失效场景"
    ))
    
    partitions = [
        schemas.LakehousePartitionCreate(
            task_id=task1.id,
            partition_path="/data/lake/quota/date=2024-01-15",
            partition_date="2024-01-15",
            record_count=1250,
            data_size_mb=256.5
        ),
        schemas.LakehousePartitionCreate(
            task_id=task1.id,
            partition_path="/data/lake/quota/date=2024-01-16",
            partition_date="2024-01-16",
            record_count=890,
            data_size_mb=189.2
        ),
        schemas.LakehousePartitionCreate(
            task_id=task2.id,
            partition_path="/data/lake/quota/date=2024-01-17",
            partition_date="2024-01-17",
            record_count=450,
            data_size_mb=98.7
        )
    ]
    
    for p in partitions:
        crud.create_lakehouse_partition(db, p)
    
    _create_sample_task_data_sync(db, task1.id)
    _create_sample_task_data_sync(db, task2.id, simulate_link_expired=True)


def _create_sample_task_data_sync(db: Session, task_id: int, simulate_link_expired: bool = False):
    task = crud.get_task(db, task_id)
    if not task:
        return
    
    if simulate_link_expired:
        crud.create_failed_item(db, schemas.FailedItemCreate(
            task_id=task_id,
            failure_type=models.FailureType.DOWNLOAD_LINK_EXPIRED,
            error_message="下载链接已失效，无法获取材料数据",
            raw_data='{"error": "link_expired", "url": "' + task.material_url + '"}'
        ))
        crud.update_task_stats(db, task_id, 0, 1, 0.0)
        return
    
    success_tenants = [
        ("T001", "示例物流有限公司", 10000.0, 8000.0),
        ("T002", "灰度仓储服务公司", 5000.0, 3500.0),
        ("T005", "极速配送集团", 15000.0, 12000.0),
    ]
    
    for tenant_id, tenant_name, original, recycled in success_tenants:
        crud.create_recycle_detail(db, schemas.RecycleDetailCreate(
            task_id=task_id,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            original_quota=original,
            recycled_quota=recycled,
            remaining_quota=original - recycled,
            reason="灰度物流拦截 - 高风险",
            evidence_url=task.material_url
        ))
    
    failed_tenants = [
        ("T003", "链接已失效租户", models.FailureType.DOWNLOAD_LINK_EXPIRED, "材料下载链接已失效，无法验证回收依据"),
        ("T004", "配额计算错误租户", models.FailureType.QUOTA_CALCULATION_ERROR, "租户配额数据不完整，计算回收额度失败"),
    ]
    
    for tenant_id, tenant_name, fail_type, error_msg in failed_tenants:
        crud.create_failed_item(db, schemas.FailedItemCreate(
            task_id=task_id,
            failure_type=fail_type,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            error_message=error_msg,
            raw_data='{"tenant_id": "' + tenant_id + '", "error": "' + error_msg + '"}'
        ))
    
    total_recycled = sum(t[3] for t in success_tenants)
    crud.update_task_stats(db, task_id, len(success_tenants), len(failed_tenants), total_recycled)
