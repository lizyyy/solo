package com.cityops.batterydispatch.service;

import com.cityops.batterydispatch.dto.CreateTaskRequest;
import com.cityops.batterydispatch.dto.ManualConfirmRequest;
import com.cityops.batterydispatch.dto.OperationLogVO;
import com.cityops.batterydispatch.dto.TaskProcessRequest;
import com.cityops.batterydispatch.dto.TaskVO;
import com.cityops.batterydispatch.entity.DispatchTask;
import com.cityops.batterydispatch.entity.TaskOperationLog;
import com.cityops.batterydispatch.entity.BatterySwapReport;
import com.cityops.batterydispatch.entity.Dispatcher;
import com.cityops.batterydispatch.enums.DispatchStatus;
import com.cityops.batterydispatch.enums.ErrorCode;
import com.cityops.batterydispatch.enums.OperationType;
import com.cityops.batterydispatch.exception.BusinessException;
import com.cityops.batterydispatch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DispatchTaskService {
    private final DispatchTaskRepository dispatchTaskRepository;
    private final TaskOperationLogRepository operationLogRepository;
    private final BatterySwapReportRepository swapReportRepository;
    private final DispatcherRepository dispatcherRepository;
    private final BusinessValidationService validationService;
    private final DispatchStateMachine stateMachine;

    @Transactional
    public TaskVO createTask(CreateTaskRequest request) {
        validateRequest(request);

        ValidationResult validationResult = validationService.validateTaskCreation(
            request.getVehicleNo(),
            request.getBatteryNo(),
            request.getLocationCode(),
            request.getOriginalBatteryLevel()
        );

        DispatchTask task = buildTask(request, validationResult);
        task = dispatchTaskRepository.save(task);

        saveOperationLog(task.getTaskNo(), OperationType.CREATE_TASK,
            null, task.getStatus(), "创建任务", buildTaskDetail(task), "system");

        saveOperationLog(task.getTaskNo(), OperationType.AUTO_CHECK,
            null, task.getStatus(), task.getStatusReason(),
            validationService.generateSuggestion(validationResult), "system");

        return convertToVO(task);
    }

    @Transactional
    public TaskVO dispatchTask(String taskNo, TaskProcessRequest request) {
        DispatchTask task = getTask(taskNo);
        stateMachine.validateTransition(task.getStatus(), DispatchStatus.DISPATCHED);

        if (request.getDispatcherNo() != null) {
            Dispatcher dispatcher = dispatcherRepository.findByDispatcherNoAndActiveTrue(request.getDispatcherNo())
                .orElseThrow(() -> new BusinessException(ErrorCode.MISSING_REQUIRED_FIELD, "派送员不存在"));
            task.setDispatcherNo(dispatcher.getDispatcherNo());
            task.setDispatcherName(dispatcher.getName());
        }

        DispatchStatus fromStatus = task.getStatus();
        task.setStatus(DispatchStatus.DISPATCHED);
        task.setDispatchedAt(LocalDateTime.now());
        task.setDisposeReason("开始派送");
        task = dispatchTaskRepository.save(task);

        saveOperationLog(taskNo, OperationType.DISPATCH, fromStatus, DispatchStatus.DISPATCHED,
            "开始派送", request.getRemark(), request.getOperator());

        return convertToVO(task);
    }

    @Transactional
    public TaskVO arriveAtLocation(String taskNo, TaskProcessRequest request) {
        DispatchTask task = getTask(taskNo);
        stateMachine.validateTransition(task.getStatus(), DispatchStatus.ARRIVED);

        DispatchStatus fromStatus = task.getStatus();
        task.setStatus(DispatchStatus.ARRIVED);
        task.setArrivedAt(LocalDateTime.now());
        task = dispatchTaskRepository.save(task);

        saveOperationLog(taskNo, OperationType.ARRIVE, fromStatus, DispatchStatus.ARRIVED,
            "到达换电地点", request.getRemark(), request.getOperator());

        return convertToVO(task);
    }

    @Transactional
    public TaskVO signForTask(String taskNo, TaskProcessRequest request) {
        DispatchTask task = getTask(taskNo);
        stateMachine.validateTransition(task.getStatus(), DispatchStatus.COMPLETED);

        boolean override = request.getOverrideCheck() != null && request.getOverrideCheck();
        validationService.validatePhoto(request.getPhotoUrl(), override);

        if (request.getPhotoUrl() == null || request.getPhotoUrl().isEmpty()) {
            DispatchStatus fromStatus = task.getStatus();
            task.setStatus(DispatchStatus.PHOTO_MISSING);
            task.setStatusReason("签收照片缺失");
            task = dispatchTaskRepository.save(task);

            saveOperationLog(taskNo, OperationType.SIGN_FOR, fromStatus, DispatchStatus.PHOTO_MISSING,
                "签收照片缺失", request.getRemark(), request.getOperator());

            throw new BusinessException(ErrorCode.PHOTO_REQUIRED);
        }

        return completeTask(task, request);
    }

    @Transactional
    public TaskVO manualConfirm(String taskNo, ManualConfirmRequest request) {
        DispatchTask task = getTask(taskNo);

        if (request.getConfirmed()) {
            DispatchStatus targetStatus = request.getTargetStatus() != null
                ? DispatchStatus.valueOf(request.getTargetStatus())
                : DispatchStatus.DISPATCHED;

            stateMachine.validateTransition(task.getStatus(), targetStatus);

            DispatchStatus fromStatus = task.getStatus();
            task.setStatus(targetStatus);
            task.setManualConfirmed(true);
            task.setConfirmedBy(request.getOperator());
            task.setConfirmedAt(LocalDateTime.now());
            task.setReviewRemark(request.getRemark());

            if (targetStatus == DispatchStatus.DISPATCHED) {
                task.setDispatchedAt(LocalDateTime.now());
            }
            if (targetStatus == DispatchStatus.COMPLETED) {
                task.setCompletedAt(LocalDateTime.now());
                createSwapReport(task);
            }

            task = dispatchTaskRepository.save(task);

            saveOperationLog(taskNo, OperationType.MANUAL_CONFIRM, fromStatus, targetStatus,
                "人工确认通过", request.getRemark(), request.getOperator());
        } else {
            stateMachine.validateTransition(task.getStatus(), DispatchStatus.CANCELLED);

            DispatchStatus fromStatus = task.getStatus();
            task.setStatus(DispatchStatus.CANCELLED);
            task.setCancelledAt(LocalDateTime.now());
            task.setManualConfirmed(true);
            task.setConfirmedBy(request.getOperator());
            task.setConfirmedAt(LocalDateTime.now());
            task.setReviewRemark(request.getRemark());
            task.setDisposeReason("人工取消：" + request.getRemark());
            task = dispatchTaskRepository.save(task);

            saveOperationLog(taskNo, OperationType.CANCEL, fromStatus, DispatchStatus.CANCELLED,
                "人工取消任务", request.getRemark(), request.getOperator());
        }

        return convertToVO(task);
    }

    @Transactional
    public TaskVO cancelTask(String taskNo, TaskProcessRequest request) {
        DispatchTask task = getTask(taskNo);
        stateMachine.validateTransition(task.getStatus(), DispatchStatus.CANCELLED);

        DispatchStatus fromStatus = task.getStatus();
        task.setStatus(DispatchStatus.CANCELLED);
        task.setCancelledAt(LocalDateTime.now());
        task.setDisposeReason("取消任务：" + request.getRemark());
        task = dispatchTaskRepository.save(task);

        saveOperationLog(taskNo, OperationType.CANCEL, fromStatus, DispatchStatus.CANCELLED,
            "取消任务", request.getRemark(), request.getOperator());

        return convertToVO(task);
    }

    public TaskVO getTaskDetail(String taskNo) {
        DispatchTask task = getTask(taskNo);
        return convertToVO(task);
    }

    public List<TaskVO> getTasksByStatus(List<DispatchStatus> statuses) {
        List<DispatchTask> tasks = dispatchTaskRepository.findByStatusIn(statuses);
        return tasks.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    public List<TaskVO> getTasksByBatch(String batchNo) {
        List<DispatchTask> tasks = dispatchTaskRepository.findByBatchNo(batchNo);
        return tasks.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    private TaskVO completeTask(DispatchTask task, TaskProcessRequest request) {
        DispatchStatus fromStatus = task.getStatus();
        task.setStatus(DispatchStatus.COMPLETED);
        task.setPhotoUrl(request.getPhotoUrl());
        task.setPhotoChecksum(request.getPhotoChecksum());
        task.setSignedAt(LocalDateTime.now());
        task.setCompletedAt(LocalDateTime.now());
        task.setDisposeReason("换电完成");
        task = dispatchTaskRepository.save(task);

        createSwapReport(task);

        saveOperationLog(task.getTaskNo(), OperationType.COMPLETE, fromStatus, DispatchStatus.COMPLETED,
            "换电完成，签收成功", request.getRemark(), request.getOperator());

        return convertToVO(task);
    }

    private void createSwapReport(DispatchTask task) {
        BatterySwapReport report = new BatterySwapReport();
        report.setReportNo("RPT" + System.currentTimeMillis());
        report.setTaskNo(task.getTaskNo());
        report.setVehicleNo(task.getVehicleNo());
        report.setOldBatteryNo(task.getBatteryNo());
        report.setNewBatteryNo(task.getBatteryNo());
        report.setAreaCode(task.getAreaCode());
        report.setDispatcherNo(task.getDispatcherNo());
        report.setDispatcherName(task.getDispatcherName());
        report.setRiderName(task.getRiderName());
        report.setOldBatteryLevel(task.getOriginalBatteryLevel());
        report.setNewBatteryLevel(100);
        report.setLocation(task.getVehicleLocation());
        report.setPhotoUrl(task.getPhotoUrl());
        report.setFinalStatus(task.getStatus());
        report.setDisposeReason(task.getDisposeReason());
        report.setSwapTime(task.getCompletedAt());
        swapReportRepository.save(report);
    }

    private DispatchTask buildTask(CreateTaskRequest request, ValidationResult validationResult) {
        DispatchTask task = new DispatchTask();
        task.setTaskNo(generateTaskNo());
        task.setBatchNo(request.getBatchNo());
        task.setVehicleNo(request.getVehicleNo());
        task.setBatteryNo(request.getBatteryNo());
        task.setAreaCode(request.getAreaCode());
        task.setVehicleLocation(request.getVehicleLocation());
        task.setLocationCode(request.getLocationCode());
        task.setDispatcherNo(request.getDispatcherNo());
        task.setRiderName(request.getRiderName());
        task.setOriginalBatteryLevel(request.getOriginalBatteryLevel());
        task.setRawInput(request.getRawInput());

        DispatchStatus initialStatus = validationService.determineInitialStatus(validationResult);
        task.setStatus(initialStatus);
        task.setStatusReason(buildStatusReason(validationResult));
        task.setSuggestion(validationService.generateSuggestion(validationResult));

        return task;
    }

    private String buildStatusReason(ValidationResult validationResult) {
        if (!validationResult.hasWarnings()) {
            return "校验通过";
        }
        return validationResult.getWarnings().stream()
            .map(ValidationResult.ValidationWarning::getMessage)
            .collect(Collectors.joining("; "));
    }

    private String generateTaskNo() {
        return "TASK" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
            + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }

    private String buildTaskDetail(DispatchTask task) {
        return String.format("车辆:%s, 电池:%s, 片区:%s, 位置:%s",
            task.getVehicleNo(), task.getBatteryNo(), task.getAreaCode(), task.getVehicleLocation());
    }

    private void validateRequest(CreateTaskRequest request) {
        if (request.getVehicleNo() == null || request.getVehicleNo().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.MISSING_REQUIRED_FIELD, "车辆编号不能为空");
        }
        if (request.getBatteryNo() == null || request.getBatteryNo().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.MISSING_REQUIRED_FIELD, "电池编号不能为空");
        }
        if (request.getAreaCode() == null || request.getAreaCode().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.MISSING_REQUIRED_FIELD, "片区不能为空");
        }
    }

    private DispatchTask getTask(String taskNo) {
        return dispatchTaskRepository.findByTaskNo(taskNo)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在: " + taskNo));
    }

    private void saveOperationLog(String taskNo, OperationType operationType,
                                  DispatchStatus fromStatus, DispatchStatus toStatus,
                                  String reason, String detail, String operator) {
        TaskOperationLog log = new TaskOperationLog();
        log.setTaskNo(taskNo);
        log.setOperationType(operationType);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setOperationReason(reason);
        log.setOperationDetail(detail);
        log.setOperator(operator);
        operationLogRepository.save(log);
    }

    private TaskVO convertToVO(DispatchTask task) {
        TaskVO vo = new TaskVO();
        vo.setId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setBatchNo(task.getBatchNo());
        vo.setVehicleNo(task.getVehicleNo());
        vo.setBatteryNo(task.getBatteryNo());
        vo.setAreaCode(task.getAreaCode());
        vo.setVehicleLocation(task.getVehicleLocation());
        vo.setLocationCode(task.getLocationCode());
        vo.setDispatcherNo(task.getDispatcherNo());
        vo.setDispatcherName(task.getDispatcherName());
        vo.setRiderName(task.getRiderName());
        vo.setOriginalBatteryLevel(task.getOriginalBatteryLevel());
        vo.setStatus(task.getStatus().name());
        vo.setStatusDescription(task.getStatus().getDescription());
        vo.setStatusReason(task.getStatusReason());
        vo.setSuggestion(task.getSuggestion());
        vo.setDisposeReason(task.getDisposeReason());
        vo.setManualConfirmed(task.getManualConfirmed());
        vo.setConfirmedBy(task.getConfirmedBy());
        vo.setConfirmedAt(task.getConfirmedAt());
        vo.setPhotoUrl(task.getPhotoUrl());
        vo.setDispatchedAt(task.getDispatchedAt());
        vo.setArrivedAt(task.getArrivedAt());
        vo.setSignedAt(task.getSignedAt());
        vo.setCompletedAt(task.getCompletedAt());
        vo.setCreatedAt(task.getCreatedAt());

        List<TaskOperationLog> logs = operationLogRepository.findByTaskNoOrderByOperationTimeAsc(task.getTaskNo());
        vo.setOperationLogs(logs.stream().map(this::convertLogToVO).collect(Collectors.toList()));

        return vo;
    }

    private OperationLogVO convertLogToVO(TaskOperationLog log) {
        OperationLogVO vo = new OperationLogVO();
        vo.setOperationType(log.getOperationType().name());
        vo.setOperationTypeDescription(log.getOperationType().getDescription());
        vo.setFromStatus(log.getFromStatus() != null ? log.getFromStatus().name() : null);
        vo.setToStatus(log.getToStatus() != null ? log.getToStatus().name() : null);
        vo.setOperationReason(log.getOperationReason());
        vo.setOperationDetail(log.getOperationDetail());
        vo.setOperator(log.getOperator());
        vo.setOperationTime(log.getOperationTime());
        return vo;
    }
}
