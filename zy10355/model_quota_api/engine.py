from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from collections import defaultdict
from models import (
    BusinessParty,
    ModelInfo,
    GpuQuota,
    InferenceRequest,
    QueuePosition,
    ReturnRecord,
    UsageRecord,
    RequestStatus,
    PriorityLevel,
)


class QuotaEngineError(Exception):
    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(message)


class QuotaEngine:
    def __init__(self):
        self.parties: Dict[str, BusinessParty] = {}
        self.models: Dict[str, ModelInfo] = {}
        self.quotas: Dict[Tuple[str, str], GpuQuota] = {}
        self.requests: Dict[UUID, InferenceRequest] = {}
        self.requests_by_idempotency: Dict[str, UUID] = {}
        self.queues: Dict[Tuple[str, str], List[UUID]] = defaultdict(list)
        self.return_records: List[ReturnRecord] = []
        self.usage_records: List[UsageRecord] = []

    def register_party(self, party: BusinessParty) -> BusinessParty:
        if party.party_id in self.parties:
            raise QuotaEngineError("PARTY_EXISTS", f"业务方 {party.party_id} 已存在")
        self.parties[party.party_id] = party
        return party

    def register_model(self, model: ModelInfo) -> ModelInfo:
        if model.model_id in self.models:
            raise QuotaEngineError("MODEL_EXISTS", f"模型 {model.model_id} 已存在")
        self.models[model.model_id] = model
        return model

    def set_quota(self, quota: GpuQuota) -> GpuQuota:
        key = (quota.party_id, quota.model_id)
        self.quotas[key] = quota
        return quota

    def get_quota(self, party_id: str, model_id: str) -> Optional[GpuQuota]:
        return self.quotas.get((party_id, model_id))

    def _validate_party_and_model(self, party_id: str, model_id: str) -> Tuple[BusinessParty, ModelInfo]:
        party = self.parties.get(party_id)
        if not party:
            raise QuotaEngineError("PARTY_NOT_FOUND", f"业务方 {party_id} 不存在")
        if not party.is_active:
            raise QuotaEngineError("PARTY_INACTIVE", f"业务方 {party_id} 已停用")

        model = self.models.get(model_id)
        if not model:
            raise QuotaEngineError("MODEL_NOT_FOUND", f"模型 {model_id} 不存在")
        if not model.is_active:
            raise QuotaEngineError("MODEL_INACTIVE", f"模型 {model_id} 已停用")

        return party, model

    def create_request(
        self,
        idempotency_key: str,
        party_id: str,
        model_id: str,
        requested_gpu_units: Optional[int] = None,
        priority: PriorityLevel = PriorityLevel.NORMAL,
    ) -> InferenceRequest:
        if idempotency_key in self.requests_by_idempotency:
            return self.requests[self.requests_by_idempotency[idempotency_key]]

        party, model = self._validate_party_and_model(party_id, model_id)

        if requested_gpu_units is None:
            requested_gpu_units = model.gpu_units_per_request

        request = InferenceRequest(
            idempotency_key=idempotency_key,
            party_id=party_id,
            model_id=model_id,
            requested_gpu_units=requested_gpu_units,
            priority=priority,
        )

        self.requests[request.request_id] = request
        self.requests_by_idempotency[idempotency_key] = request.request_id
        return request

    def _enqueue_request(self, request: InferenceRequest) -> QueuePosition:
        queue_key = (request.party_id, request.model_id)
        queue = self.queues[queue_key]

        insert_pos = 0
        for i, req_id in enumerate(queue):
            queued_req = self.requests[req_id]
            if request.priority > queued_req.priority:
                insert_pos = i
                break
            insert_pos = i + 1

        queue.insert(insert_pos, request.request_id)

        for pos, req_id in enumerate(queue):
            req = self.requests[req_id]
            req.queue_position = pos + 1
            req.updated_at = datetime.now()

        request.status = RequestStatus.QUEUED
        request.queued_at = datetime.now()
        request.updated_at = datetime.now()

        return QueuePosition(
            request_id=request.request_id,
            party_id=request.party_id,
            model_id=request.model_id,
            position=request.queue_position,
            priority=request.priority,
            requested_gpu_units=request.requested_gpu_units,
        )

    def validate_and_process(self, request_id: UUID) -> InferenceRequest:
        request = self.requests.get(request_id)
        if not request:
            raise QuotaEngineError("REQUEST_NOT_FOUND", f"请求 {request_id} 不存在")

        if request.status not in [RequestStatus.PENDING, RequestStatus.FAILED]:
            return request

        quota = self.get_quota(request.party_id, request.model_id)
        if not quota:
            raise QuotaEngineError("QUOTA_NOT_FOUND", f"业务方 {request.party_id} 在模型 {request.model_id} 上无额度配置")

        now = datetime.now()
        if now < quota.effective_date:
            raise QuotaEngineError("QUOTA_NOT_EFFECTIVE", "额度尚未生效")
        if quota.expire_date and now > quota.expire_date:
            raise QuotaEngineError("QUOTA_EXPIRED", "额度已过期")

        if quota.available_quota < request.requested_gpu_units:
            self._enqueue_request(request)
            return request

        quota.used_quota += request.requested_gpu_units
        quota.updated_at = datetime.now()

        request.status = RequestStatus.RUNNING
        request.started_at = datetime.now()
        request.updated_at = datetime.now()

        usage = UsageRecord(
            party_id=request.party_id,
            model_id=request.model_id,
            request_id=request.request_id,
            gpu_units=request.requested_gpu_units,
            start_time=request.started_at,
            status=RequestStatus.RUNNING,
        )
        self.usage_records.append(usage)

        return request

    def complete_request(self, request_id: UUID, success: bool = True) -> InferenceRequest:
        request = self.requests.get(request_id)
        if not request:
            raise QuotaEngineError("REQUEST_NOT_FOUND", f"请求 {request_id} 不存在")

        if request.status != RequestStatus.RUNNING:
            raise QuotaEngineError("INVALID_STATUS", f"请求状态 {request.status} 不允许完成")

        request.status = RequestStatus.SUCCESS if success else RequestStatus.FAILED
        request.completed_at = datetime.now()
        request.updated_at = datetime.now()

        for usage in self.usage_records:
            if usage.request_id == request_id and usage.status == RequestStatus.RUNNING:
                usage.end_time = request.completed_at
                usage.duration_seconds = int(
                    (usage.end_time - usage.start_time).total_seconds()
                )
                usage.status = request.status
                break

        self._return_quota(request.request_id, "request_completed" if success else "request_failed")
        self._process_queue(request.party_id, request.model_id)

        return request

    def fail_request(self, request_id: UUID, error_code: str, error_message: str) -> InferenceRequest:
        request = self.requests.get(request_id)
        if not request:
            raise QuotaEngineError("REQUEST_NOT_FOUND", f"请求 {request_id} 不存在")

        request.status = RequestStatus.FAILED
        request.error_code = error_code
        request.error_message = error_message
        request.completed_at = datetime.now()
        request.updated_at = datetime.now()

        self._return_quota(request.request_id, f"error:{error_code}")
        self._process_queue(request.party_id, request.model_id)

        return request

    def _return_quota(self, request_id: UUID, reason: str) -> ReturnRecord:
        request = self.requests[request_id]

        quota = self.get_quota(request.party_id, request.model_id)
        if quota:
            quota.used_quota -= request.requested_gpu_units
            quota.updated_at = datetime.now()

        return_record = ReturnRecord(
            request_id=request_id,
            party_id=request.party_id,
            model_id=request.model_id,
            returned_gpu_units=request.requested_gpu_units,
            return_reason=reason,
        )
        self.return_records.append(return_record)
        return return_record

    def _process_queue(self, party_id: str, model_id: str):
        queue_key = (party_id, model_id)
        queue = self.queues[queue_key]

        while queue:
            request_id = queue[0]
            request = self.requests[request_id]

            quota = self.get_quota(party_id, model_id)
            if not quota or quota.available_quota < request.requested_gpu_units:
                break

            queue.pop(0)

            for pos, req_id in enumerate(queue):
                req = self.requests[req_id]
                req.queue_position = pos + 1
                req.updated_at = datetime.now()

            quota.used_quota += request.requested_gpu_units
            quota.updated_at = datetime.now()

            request.status = RequestStatus.RUNNING
            request.queue_position = None
            request.started_at = datetime.now()
            request.updated_at = datetime.now()

            usage = UsageRecord(
                party_id=request.party_id,
                model_id=request.model_id,
                request_id=request.request_id,
                gpu_units=request.requested_gpu_units,
                start_time=request.started_at,
                status=RequestStatus.RUNNING,
            )
            self.usage_records.append(usage)

    def cancel_request(self, request_id: UUID) -> InferenceRequest:
        request = self.requests.get(request_id)
        if not request:
            raise QuotaEngineError("REQUEST_NOT_FOUND", f"请求 {request_id} 不存在")

        if request.status in [RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.CANCELLED]:
            return request

        queue_key = (request.party_id, request.model_id)
        queue = self.queues[queue_key]

        if request_id in queue:
            queue.remove(request_id)
            for pos, req_id in enumerate(queue):
                req = self.requests[req_id]
                req.queue_position = pos + 1
                req.updated_at = datetime.now()

        if request.status == RequestStatus.RUNNING:
            self._return_quota(request_id, "cancelled")

        request.status = RequestStatus.CANCELLED
        request.updated_at = datetime.now()

        return request

    def adjust_priority(self, request_id: UUID, new_priority: PriorityLevel) -> InferenceRequest:
        request = self.requests.get(request_id)
        if not request:
            raise QuotaEngineError("REQUEST_NOT_FOUND", f"请求 {request_id} 不存在")

        if request.status != RequestStatus.QUEUED:
            raise QuotaEngineError("INVALID_STATUS", "只有排队中的请求可以调整优先级")

        queue_key = (request.party_id, request.model_id)
        queue = self.queues[queue_key]

        if request_id in queue:
            queue.remove(request_id)

        request.priority = new_priority
        request.updated_at = datetime.now()

        self._enqueue_request(request)

        return request

    def get_request(self, request_id: UUID) -> Optional[InferenceRequest]:
        return self.requests.get(request_id)

    def get_request_by_idempotency(self, idempotency_key: str) -> Optional[InferenceRequest]:
        request_id = self.requests_by_idempotency.get(idempotency_key)
        return self.requests.get(request_id) if request_id else None

    def get_party_requests(
        self, party_id: str, status: Optional[RequestStatus] = None
    ) -> List[InferenceRequest]:
        result = []
        for req in self.requests.values():
            if req.party_id == party_id:
                if status is None or req.status == status:
                    result.append(req)
        return result

    def get_queue(self, party_id: str, model_id: str) -> List[QueuePosition]:
        queue_key = (party_id, model_id)
        queue = self.queues[queue_key]
        return [
            QueuePosition(
                request_id=req_id,
                party_id=party_id,
                model_id=model_id,
                position=pos + 1,
                priority=self.requests[req_id].priority,
                requested_gpu_units=self.requests[req_id].requested_gpu_units,
            )
            for pos, req_id in enumerate(queue)
        ]

    def get_usage_records(
        self,
        party_id: Optional[str] = None,
        model_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[UsageRecord]:
        result = []
        for record in self.usage_records:
            if party_id and record.party_id != party_id:
                continue
            if model_id and record.model_id != model_id:
                continue
            if start_time and record.start_time < start_time:
                continue
            if end_time and record.start_time > end_time:
                continue
            result.append(record)
        return result

    def get_return_records(
        self,
        party_id: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> List[ReturnRecord]:
        result = []
        for record in self.return_records:
            if party_id and record.party_id != party_id:
                continue
            if model_id and record.model_id != model_id:
                continue
            result.append(record)
        return result
