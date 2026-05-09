package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.ReplenishmentDeliveryRequest;
import com.manufacture.outsourcing.dto.ReplenishmentRequest;
import com.manufacture.outsourcing.entity.InspectionResult;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.entity.OutsourcingOrder;
import com.manufacture.outsourcing.entity.ReplenishmentTask;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.ReplenishmentTaskRepository;
import com.manufacture.outsourcing.util.NoGenerator;
import com.manufacture.outsourcing.util.SecurityUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
public class ReplenishmentService {

    private final ReplenishmentTaskRepository replenishmentTaskRepository;
    private final InspectionService inspectionService;
    private final OperationLogService logService;

    public ReplenishmentService(ReplenishmentTaskRepository replenishmentTaskRepository,
                                 InspectionService inspectionService,
                                 OperationLogService logService) {
        this.replenishmentTaskRepository = replenishmentTaskRepository;
        this.inspectionService = inspectionService;
        this.logService = logService;
    }

    public BigDecimal calculateReplenishmentQuantityForInspection(InspectionResult result) {
        List<ReplenishmentTask> tasks = replenishmentTaskRepository.findByInspectionResultId(result.getId());
        return tasks.stream()
                .filter(t -> !ReplenishmentTask.STATUS_CANCELLED.equals(t.getTaskStatus()))
                .map(ReplenishmentTask::getRequiredQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Transactional
    public ReplenishmentTask createTask(ReplenishmentRequest request) {
        InspectionResult inspection = inspectionService.getById(request.getInspectionResultId());

        if (!InspectionResult.STATUS_COMPLETED.equals(inspection.getResultStatus()) &&
            !InspectionResult.STATUS_CONFIRMED.equals(inspection.getResultStatus())) {
            throw BusinessException.badRequest("验收记录需确认后才能创建补货任务");
        }

        ReplenishmentTask task = new ReplenishmentTask();
        task.setTaskNo(NoGenerator.generateReplenishmentNo());
        task.setOrder(inspection.getBatch().getOrder());
        task.setBatch(inspection.getBatch());
        task.setInspectionResult(inspection);
        task.setSupplier(inspection.getBatch().getOrder().getSupplier());
        task.setRequiredQuantity(request.getRequiredQuantity());
        task.setReceivedQuantity(BigDecimal.ZERO);
        task.setRemainingQuantity(request.getRequiredQuantity());
        task.setRequiredDate(request.getRequiredDate());
        task.setTaskDescription(request.getTaskDescription());
        task.setHandler(SecurityUtil.getCurrentRealName());
        task.setTaskStatus(ReplenishmentTask.STATUS_CREATED);

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        updateOrderReplenishment(inspection.getBatch().getOrder(), request.getRequiredQuantity());

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getTaskStatus(),
                "创建补货任务 " + saved.getTaskNo() + "，补货数量：" + request.getRequiredQuantity(),
                null,
                saved
        );

        return saved;
    }

    private void updateOrderReplenishment(OutsourcingOrder order, BigDecimal quantity) {
        order.setReplenishmentQuantity(order.getReplenishmentQuantity().add(quantity));
    }

    @Transactional
    public ReplenishmentTask notifySupplier(Long taskId, String supplierResponse) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (!ReplenishmentTask.STATUS_CREATED.equals(oldStatus) &&
            !ReplenishmentTask.STATUS_PENDING_RETRY.equals(oldStatus)) {
            throw BusinessException.badRequest("当前状态不允许通知供应商");
        }

        task.setTaskStatus(ReplenishmentTask.STATUS_NOTIFIED);
        task.setSupplierResponse(supplierResponse);

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                OperationLog.ACTION_NOTIFY,
                oldStatus,
                saved.getTaskStatus(),
                "已通知供应商补货任务 " + saved.getTaskNo(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public ReplenishmentTask confirmSupplier(Long taskId, String supplierResponse) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (!ReplenishmentTask.STATUS_NOTIFIED.equals(oldStatus)) {
            throw BusinessException.badRequest("当前状态不允许确认供应商");
        }

        task.setTaskStatus(ReplenishmentTask.STATUS_CONFIRMED);
        if (supplierResponse != null) {
            task.setSupplierResponse(task.getSupplierResponse() + "；" + supplierResponse);
        }

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                OperationLog.ACTION_CONFIRM,
                oldStatus,
                saved.getTaskStatus(),
                "供应商已确认补货任务 " + saved.getTaskNo(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public ReplenishmentTask recordDelivery(Long taskId, ReplenishmentDeliveryRequest request) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (!List.of(
                ReplenishmentTask.STATUS_CONFIRMED,
                ReplenishmentTask.STATUS_IN_PROGRESS,
                ReplenishmentTask.STATUS_PARTIAL,
                ReplenishmentTask.STATUS_FAILED
        ).contains(oldStatus)) {
            throw BusinessException.badRequest("当前状态不允许登记补货到货，当前状态：" + oldStatus);
        }

        if (request.getReceivedQuantity().compareTo(task.getRemainingQuantity()) > 0) {
            throw BusinessException.badRequest("补货到货数量不能超过剩余补货数量");
        }

        task.setReceivedQuantity(task.getReceivedQuantity().add(request.getReceivedQuantity()));
        task.setRemainingQuantity(task.getRemainingQuantity().subtract(request.getReceivedQuantity()));
        task.setActualDeliveryDate(request.getActualDeliveryDate() != null ? 
                request.getActualDeliveryDate() : LocalDate.now());

        if (task.getRemainingQuantity().compareTo(BigDecimal.ZERO) == 0) {
            task.setTaskStatus(ReplenishmentTask.STATUS_COMPLETED);
        } else {
            if (!ReplenishmentTask.STATUS_PARTIAL.equals(oldStatus)) {
                task.setTaskStatus(ReplenishmentTask.STATUS_PARTIAL);
            }
        }

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                "登记补货到货",
                oldStatus,
                saved.getTaskStatus(),
                "补货任务 " + saved.getTaskNo() + " 到货 " + request.getReceivedQuantity() + "，剩余 " + saved.getRemainingQuantity(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public ReplenishmentTask markFailed(Long taskId, String failureReason) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (List.of(ReplenishmentTask.STATUS_COMPLETED, ReplenishmentTask.STATUS_CANCELLED).contains(oldStatus)) {
            throw BusinessException.badRequest("已完成或已取消的补货任务不能标记失败");
        }

        task.setTaskStatus(ReplenishmentTask.STATUS_FAILED);
        task.setFailureReason(failureReason);

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logFailure(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                "标记失败",
                oldStatus,
                saved.getTaskStatus(),
                "补货任务 " + saved.getTaskNo() + " 执行失败",
                null,
                saved,
                failureReason
        );

        return saved;
    }

    @Transactional
    public ReplenishmentTask retryTask(Long taskId, String retryDescription) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (!ReplenishmentTask.STATUS_FAILED.equals(oldStatus) &&
            !ReplenishmentTask.STATUS_PENDING_RETRY.equals(oldStatus)) {
            throw BusinessException.badRequest("只有失败或待重试的补货任务才能重试");
        }

        task.setRetryCount(task.getRetryCount() == null ? 1 : task.getRetryCount() + 1);
        task.setRetryDescription(retryDescription);
        task.setTaskStatus(ReplenishmentTask.STATUS_PENDING_RETRY);
        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                OperationLog.ACTION_RETRY,
                oldStatus,
                saved.getTaskStatus(),
                "发起补货任务 " + saved.getTaskNo() + " 的重试，第 " + saved.getRetryCount() + " 次",
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public ReplenishmentTask cancelTask(Long taskId, String reason) {
        ReplenishmentTask task = getById(taskId);
        String oldStatus = task.getTaskStatus();

        if (ReplenishmentTask.STATUS_COMPLETED.equals(oldStatus)) {
            throw BusinessException.badRequest("已完成的补货任务不能取消");
        }

        task.setTaskStatus(ReplenishmentTask.STATUS_CANCELLED);
        task.setFailureReason(reason);

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                OperationLog.ACTION_CANCEL,
                oldStatus,
                saved.getTaskStatus(),
                "取消补货任务 " + saved.getTaskNo() + "，原因：" + reason,
                null,
                saved
        );

        return saved;
    }

    public ReplenishmentTask getById(Long id) {
        return replenishmentTaskRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("补货任务不存在"));
    }

    public List<ReplenishmentTask> findByOrderId(Long orderId) {
        return replenishmentTaskRepository.findByOrderId(orderId);
    }

    public List<ReplenishmentTask> findByBatchId(Long batchId) {
        return replenishmentTaskRepository.findByBatchId(batchId);
    }

    public List<ReplenishmentTask> findByInspectionId(Long inspectionId) {
        return replenishmentTaskRepository.findByInspectionResultId(inspectionId);
    }

    public List<ReplenishmentTask> findFailedTasks() {
        return replenishmentTaskRepository.findByTaskStatusIn(
                List.of(ReplenishmentTask.STATUS_FAILED, ReplenishmentTask.STATUS_PENDING_RETRY)
        );
    }

    public List<ReplenishmentTask> findBySupplierId(Long supplierId) {
        return replenishmentTaskRepository.findBySupplierId(supplierId);
    }
}
