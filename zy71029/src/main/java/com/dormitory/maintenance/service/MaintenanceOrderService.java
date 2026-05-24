package com.dormitory.maintenance.service;

import com.dormitory.maintenance.component.DuplicateOrderChecker;
import com.dormitory.maintenance.component.QuietPeriodValidator;
import com.dormitory.maintenance.component.StatusMachine;
import com.dormitory.maintenance.dto.BatchSubmitRequest;
import com.dormitory.maintenance.dto.MaintenanceOrderRequest;
import com.dormitory.maintenance.dto.ValidationResult;
import com.dormitory.maintenance.entity.*;
import com.dormitory.maintenance.enums.MaintenanceStatus;
import com.dormitory.maintenance.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MaintenanceOrderService {

    @Autowired
    private MaintenanceOrderRepository orderRepository;

    @Autowired
    private DormBuildingRepository buildingRepository;

    @Autowired
    private ConstructionTeamRepository teamRepository;

    @Autowired
    private QuietPeriodValidator quietPeriodValidator;

    @Autowired
    private DuplicateOrderChecker duplicateChecker;

    @Autowired
    private StatusMachine statusMachine;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public MaintenanceOrder createOrder(MaintenanceOrderRequest request) {
        MaintenanceOrder order = new MaintenanceOrder();
        order.setOrderNo(generateOrderNo());
        updateOrderFromRequest(order, request);
        order.setStatus(MaintenanceStatus.PENDING_SUBMIT);

        MaintenanceOrder saved = orderRepository.save(order);
        validateAndSetConflict(saved);
        saved = orderRepository.save(saved);

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "CREATE", null, saved.getTitle(),
                "创建维修工单", request.getOperator() != null ? request.getOperator() : "system"
        );

        return saved;
    }

    @Transactional
    public Map<String, Object> batchSubmit(BatchSubmitRequest request) {
        String batchNo = request.getBatchNo() != null ? request.getBatchNo() : generateBatchNo();
        List<MaintenanceOrder> successOrders = new ArrayList<>();
        List<Map<String, Object>> failedOrders = new ArrayList<>();

        for (MaintenanceOrderRequest orderRequest : request.getOrders()) {
            try {
                orderRequest.setBatchNo(batchNo);
                MaintenanceOrder order = createOrder(orderRequest);
                MaintenanceOrder submitted = submitForApproval(order.getId(), request.getOperator());
                successOrders.add(submitted);
            } catch (Exception e) {
                failedOrders.add(Map.of(
                        "title", orderRequest.getTitle(),
                        "error", e.getMessage()
                ));
            }
        }

        return Map.of(
                "batchNo", batchNo,
                "successCount", successOrders.size(),
                "failedCount", failedOrders.size(),
                "successOrders", successOrders,
                "failedOrders", failedOrders
        );
    }

    @Transactional
    public MaintenanceOrder submitForApproval(Long orderId, String operator) {
        MaintenanceOrder order = getOrder(orderId);

        if (!statusMachine.canTransition(order.getStatus(), MaintenanceStatus.PENDING_APPROVAL)) {
            throw new IllegalStateException("当前状态不允许提交审批");
        }

        ValidationResult strictValidation = validateOrderStrict(order);
        if (strictValidation.hasErrors()) {
            throw new IllegalArgumentException("工单校验未通过：" + strictValidation.getErrorSummary());
        }

        MaintenanceStatus oldStatus = order.getStatus();
        order.setStatus(MaintenanceStatus.PENDING_APPROVAL);

        validateAndSetConflict(order);

        MaintenanceOrder saved = orderRepository.save(order);

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "SUBMIT", oldStatus.getDescription(), saved.getStatus().getDescription(),
                "提交审批", operator != null ? operator : "system"
        );

        return saved;
    }

    @Transactional
    public MaintenanceOrder updateOrder(Long orderId, MaintenanceOrderRequest request) {
        MaintenanceOrder order = getOrder(orderId);

        if (!statusMachine.canModify(order.getStatus())) {
            throw new IllegalStateException("当前状态不允许修改");
        }

        String oldBasicInfo = String.format("时间:%s至%s, 施工队:%s",
                order.getScheduledStartTime(), order.getScheduledEndTime(),
                order.getTeam() != null ? order.getTeam().getTeamName() : "未分配");
        String oldValidationInfo = String.format("校验结论: 冲突=%s, 详情=%s",
                order.getHasConflict(),
                order.getConflictDetail() != null ? order.getConflictDetail() : "无");

        updateOrderFromRequest(order, request);
        validateAndSetConflict(order);

        MaintenanceOrder saved = orderRepository.save(order);

        String newBasicInfo = String.format("时间:%s至%s, 施工队:%s",
                saved.getScheduledStartTime(), saved.getScheduledEndTime(),
                saved.getTeam() != null ? saved.getTeam().getTeamName() : "未分配");
        String newValidationInfo = String.format("校验结论: 冲突=%s, 详情=%s",
                saved.getHasConflict(),
                saved.getConflictDetail() != null ? saved.getConflictDetail() : "无");

        String operator = request.getOperator() != null ? request.getOperator() : "system";

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "UPDATE_BASIC", oldBasicInfo, newBasicInfo,
                "修改工单基本信息", operator
        );

        if (!oldValidationInfo.equals(newValidationInfo)) {
            auditLogService.logOrderChange(
                    saved.getId(), saved.getOrderNo(),
                    "CORRECT_CONCLUSION",
                    oldValidationInfo,
                    newValidationInfo,
                    "人工修正校验结论，修正人: " + operator,
                    operator
            );
        }

        return saved;
    }

    public ValidationResult validateOrder(Long orderId) {
        MaintenanceOrder order = getOrder(orderId);
        return validateOrder(order);
    }

    private ValidationResult validateOrder(MaintenanceOrder order) {
        ValidationResult quietResult = quietPeriodValidator.validateOrder(order);
        ValidationResult duplicateResult = duplicateChecker.checkDuplicate(order);

        ValidationResult combined = new ValidationResult();
        combined.getWarnings().addAll(quietResult.getWarnings());
        combined.getWarnings().addAll(duplicateResult.getWarnings());
        combined.getErrors().addAll(quietResult.getErrors());
        combined.getErrors().addAll(duplicateResult.getErrors());

        if (combined.hasIssues()) {
            combined.setConflictDetail(combined.getSummary());
        }

        return combined;
    }

    private ValidationResult validateOrderStrict(MaintenanceOrder order) {
        ValidationResult quietResult = quietPeriodValidator.validateOrder(order);
        ValidationResult duplicateResult = duplicateChecker.checkDuplicateStrict(order);

        ValidationResult combined = new ValidationResult();
        combined.getWarnings().addAll(quietResult.getWarnings());
        combined.getWarnings().addAll(duplicateResult.getWarnings());
        combined.getErrors().addAll(quietResult.getErrors());
        combined.getErrors().addAll(duplicateResult.getErrors());

        if (combined.hasIssues()) {
            combined.setConflictDetail(combined.getSummary());
        }

        return combined;
    }

    public List<MaintenanceOrder> getAbnormalOrders() {
        return orderRepository.findOrdersWithConflict(MaintenanceStatus.COMPLETED);
    }

    public List<MaintenanceOrder> getOrdersByBatch(String batchNo) {
        return orderRepository.findByBatchNoOrderByCreatedAtDesc(batchNo);
    }

    public MaintenanceOrder getOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在"));
    }

    public MaintenanceOrder getOrderByNo(String orderNo) {
        return orderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new IllegalArgumentException("工单不存在"));
    }

    public List<MaintenanceOrder> getAllOrders() {
        return orderRepository.findAll();
    }

    @Transactional
    public MaintenanceOrder startWork(Long orderId, String operator) {
        MaintenanceOrder order = getOrder(orderId);

        if (!statusMachine.canTransition(order.getStatus(), MaintenanceStatus.IN_PROGRESS)) {
            throw new IllegalStateException("当前状态不允许开始施工");
        }

        MaintenanceStatus oldStatus = order.getStatus();
        order.setStatus(MaintenanceStatus.IN_PROGRESS);
        order.setActualStartTime(LocalDateTime.now());

        MaintenanceOrder saved = orderRepository.save(order);

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "START_WORK", oldStatus.getDescription(), saved.getStatus().getDescription(),
                "开始施工", operator != null ? operator : "system"
        );

        return saved;
    }

    @Transactional
    public MaintenanceOrder completeWork(Long orderId, String operator) {
        MaintenanceOrder order = getOrder(orderId);

        if (!statusMachine.canTransition(order.getStatus(), MaintenanceStatus.COMPLETED)) {
            throw new IllegalStateException("当前状态不允许完成施工");
        }

        MaintenanceStatus oldStatus = order.getStatus();
        order.setStatus(MaintenanceStatus.COMPLETED);
        order.setActualEndTime(LocalDateTime.now());

        MaintenanceOrder saved = orderRepository.save(order);

        if (duplicateChecker.hasOverTimeRisk(saved)) {
            String overTimeDetail = duplicateChecker.getOverTimeDetail(saved);
            saved.setHasConflict(true);
            saved.setConflictDetail((saved.getConflictDetail() != null ? saved.getConflictDetail() + "; " : "") + overTimeDetail);
            saved = orderRepository.save(saved);
        }

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "COMPLETE_WORK", oldStatus.getDescription(), saved.getStatus().getDescription(),
                "完成施工", operator != null ? operator : "system"
        );

        return saved;
    }

    public Map<String, Object> checkOverTime(Long orderId) {
        MaintenanceOrder order = getOrder(orderId);
        boolean hasOverTime = duplicateChecker.hasOverTimeRisk(order);
        String overTimeDetail = duplicateChecker.getOverTimeDetail(order);

        return Map.of(
                "orderId", orderId,
                "orderNo", order.getOrderNo(),
                "hasOverTimeRisk", hasOverTime,
                "overTimeDetail", overTimeDetail,
                "scheduledMinutes", order.getActualStartTime() != null ?
                        java.time.Duration.between(order.getScheduledStartTime(), order.getScheduledEndTime()).toMinutes() : 0,
                "actualMinutes", order.getActualStartTime() != null ?
                        java.time.Duration.between(order.getActualStartTime(),
                                order.getActualEndTime() != null ? order.getActualEndTime() : LocalDateTime.now()).toMinutes() : 0
        );
    }

    public List<Map<String, Object>> getOverTimeOrders() {
        List<MaintenanceOrder> inProgressOrders = orderRepository.findByStatus(MaintenanceStatus.IN_PROGRESS);
        List<Map<String, Object>> overTimeOrders = new ArrayList<>();

        for (MaintenanceOrder order : inProgressOrders) {
            if (duplicateChecker.hasOverTimeRisk(order)) {
                Map<String, Object> info = new java.util.HashMap<>();
                info.put("orderId", order.getId());
                info.put("orderNo", order.getOrderNo());
                info.put("title", order.getTitle());
                info.put("overTimeDetail", duplicateChecker.getOverTimeDetail(order));
                info.put("actualStartTime", order.getActualStartTime());
                overTimeOrders.add(info);
            }
        }

        return overTimeOrders;
    }

    public List<MaintenanceOrder> getOrdersByStatus(MaintenanceStatus status) {
        return orderRepository.findByStatus(status);
    }

    @Transactional
    public MaintenanceOrder requestOverTime(Long orderId, String reason, String operator) {
        MaintenanceOrder order = getOrder(orderId);

        if (order.getStatus() != MaintenanceStatus.IN_PROGRESS) {
            throw new IllegalStateException("只有施工中的工单才能申请加班");
        }

        order.setOverTimeRequested(true);
        order.setOverTimeReason(reason);

        MaintenanceOrder saved = orderRepository.save(order);

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "OVERTIME_REQUEST",
                "未申请加班",
                "申请加班: " + reason,
                "提交加班申请",
                operator != null ? operator : "system"
        );

        return saved;
    }

    @Transactional
    public MaintenanceOrder approveOverTime(Long orderId, boolean approved, String remark, String approver) {
        MaintenanceOrder order = getOrder(orderId);

        if (!Boolean.TRUE.equals(order.getOverTimeRequested())) {
            throw new IllegalStateException("该工单未申请加班");
        }

        if (order.getOverTimeApproved() != null) {
            throw new IllegalStateException("该工单加班申请已审批");
        }

        String oldValue = "待审批";
        String newValue = approved ? "已批准" : "已拒绝";
        order.setOverTimeApproved(approved);
        order.setOverTimeApprover(approver);
        order.setOverTimeApproveTime(LocalDateTime.now());
        order.setOverTimeApproveRemark(remark);

        MaintenanceOrder saved = orderRepository.save(order);

        auditLogService.logOrderChange(
                saved.getId(), saved.getOrderNo(),
                "OVERTIME_APPROVE",
                oldValue,
                newValue,
                remark,
                approver != null ? approver : "system"
        );

        return saved;
    }

    private void updateOrderFromRequest(MaintenanceOrder order, MaintenanceOrderRequest request) {
        order.setBatchNo(request.getBatchNo());
        order.setTitle(request.getTitle());
        order.setDescription(request.getDescription());
        order.setRoomNo(request.getRoomNo());
        order.setLocation(request.getLocation());
        order.setPriority(request.getPriority());
        order.setCategory(request.getCategory());
        order.setIsEmergency(request.getIsEmergency() != null && request.getIsEmergency());
        order.setApplicant(request.getApplicant());
        order.setApplicantPhone(request.getApplicantPhone());
        order.setRemark(request.getRemark());

        if (request.getScheduledStartTime() != null) {
            order.setScheduledStartTime(request.getScheduledStartTime());
        }
        if (request.getScheduledEndTime() != null) {
            order.setScheduledEndTime(request.getScheduledEndTime());
        }

        if (request.getBuildingId() != null) {
            DormBuilding building = buildingRepository.findById(request.getBuildingId())
                    .orElseThrow(() -> new IllegalArgumentException("宿舍楼不存在"));
            order.setBuilding(building);
        }

        if (request.getTeamId() != null) {
            ConstructionTeam team = teamRepository.findById(request.getTeamId())
                    .orElseThrow(() -> new IllegalArgumentException("施工队不存在"));
            order.setTeam(team);
        }
    }

    private void validateAndSetConflict(MaintenanceOrder order) {
        ValidationResult validation = validateOrder(order);
        order.setValidationResult(validation.getSummary());
        order.setHasConflict(validation.hasIssues());
        order.setConflictDetail(validation.getConflictDetail());
    }

    private String generateOrderNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "WO" + date + uuid;
    }

    private String generateBatchNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        return "BATCH" + date + uuid;
    }
}
