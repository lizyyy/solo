package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.entity.*;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.*;
import com.manufacture.outsourcing.util.NoGenerator;
import com.manufacture.outsourcing.util.SecurityUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class CompensationProcessor {

    private final InspectionResultRepository inspectionRepository;
    private final DeductionRecordRepository deductionRecordRepository;
    private final DeductionRuleRepository deductionRuleRepository;
    private final ReplenishmentTaskRepository replenishmentTaskRepository;
    private final DeliveryBatchRepository batchRepository;
    private final OutsourcingOrderRepository orderRepository;
    private final OperationLogService logService;

    private final AtomicBoolean simulateDeductionFailure = new AtomicBoolean(false);

    public CompensationProcessor(InspectionResultRepository inspectionRepository,
                                  DeductionRecordRepository deductionRecordRepository,
                                  DeductionRuleRepository deductionRuleRepository,
                                  ReplenishmentTaskRepository replenishmentTaskRepository,
                                  DeliveryBatchRepository batchRepository,
                                  OutsourcingOrderRepository orderRepository,
                                  OperationLogService logService) {
        this.inspectionRepository = inspectionRepository;
        this.deductionRecordRepository = deductionRecordRepository;
        this.deductionRuleRepository = deductionRuleRepository;
        this.replenishmentTaskRepository = replenishmentTaskRepository;
        this.batchRepository = batchRepository;
        this.orderRepository = orderRepository;
        this.logService = logService;
    }

    public void setSimulateDeductionFailure(boolean simulate) {
        simulateDeductionFailure.set(simulate);
    }

    public boolean isSimulateDeductionFailure() {
        return simulateDeductionFailure.get();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void executeCompensation(InspectionResult result) {
        String currentStep = result.getCompensationStep();
        if (currentStep == null) {
            currentStep = InspectionResult.STEP_NONE;
        }

        log.info("执行补偿流程，验收: {}, 当前步骤: {}", result.getResultNo(), currentStep);

        String suggestion = result.getProcessingSuggestion();

        switch (suggestion) {
            case "扣款接收":
                executeDeductionCompensation(result);
                break;
            case "要求补货":
                executeReplenishmentCompensation(result);
                break;
            case "直接入库":
                log.info("处理建议为直接入库，无需补偿处理");
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
                break;
            case "退货":
                log.info("处理建议为退货，等待仓库处理退货流程");
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
                break;
            case "返工后复检":
                log.info("处理建议为返工后复检，等待供应商返工后重新验收");
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
                break;
            default:
                log.warn("未识别的处理建议: {}", suggestion);
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
        }
    }

    @Transactional
    public void executeDeductionCompensation(InspectionResult result) {
        String currentStep = result.getCompensationStep();
        if (currentStep == null) {
            currentStep = InspectionResult.STEP_NONE;
        }

        log.info("执行扣款补偿流程，验收: {}, 当前步骤: {}", result.getResultNo(), currentStep);

        try {
            DeductionRecord existingRecord = findExistingDeductionRecord(result);

            if (InspectionResult.STEP_NONE.equals(currentStep)) {
                if (existingRecord == null) {
                    updateStep(result, InspectionResult.STEP_DEDUCTION_CREATE, null);
                    existingRecord = createDeductionRecordForInspection(result);
                }
                currentStep = InspectionResult.STEP_DEDUCTION_CREATE;
            }

            if (InspectionResult.STEP_DEDUCTION_CREATE.equals(currentStep)) {
                if (existingRecord == null) {
                    existingRecord = findExistingDeductionRecord(result);
                }
                if (existingRecord == null) {
                    throw BusinessException.of("扣款记录创建失败，无法找到扣款记录");
                }
                updateStep(result, InspectionResult.STEP_DEDUCTION_APPROVE, null);
                approveDeductionRecord(existingRecord, result);
                currentStep = InspectionResult.STEP_DEDUCTION_APPROVE;
            }

            if (InspectionResult.STEP_DEDUCTION_APPROVE.equals(currentStep)) {
                if (existingRecord == null) {
                    existingRecord = findExistingDeductionRecord(result);
                }
                updateStep(result, InspectionResult.STEP_DEDUCTION_EXECUTE, null);
                executeDeduction(existingRecord, result);
                currentStep = InspectionResult.STEP_DEDUCTION_EXECUTE;
            }

            if (InspectionResult.STEP_DEDUCTION_EXECUTE.equals(currentStep)) {
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
                updateBatchStatisticsAfterCompensation(result);
                log.info("扣款补偿流程完成，验收: {}", result.getResultNo());
            }

        } catch (Exception e) {
            log.error("扣款补偿流程在步骤 {} 失败: {}", result.getCompensationStep(), e.getMessage(), e);
            updateStep(result, result.getCompensationStep(), e.getMessage());
            throw e;
        }
    }

    @Transactional
    public void executeReplenishmentCompensation(InspectionResult result) {
        String currentStep = result.getCompensationStep();
        if (currentStep == null) {
            currentStep = InspectionResult.STEP_NONE;
        }

        log.info("执行补货补偿流程，验收: {}, 当前步骤: {}", result.getResultNo(), currentStep);

        try {
            ReplenishmentTask existingTask = findExistingReplenishmentTask(result);

            if (InspectionResult.STEP_NONE.equals(currentStep)) {
                if (existingTask == null) {
                    updateStep(result, InspectionResult.STEP_REPLENISH_CREATE, null);
                    existingTask = createReplenishmentTaskForInspection(result);
                }
                currentStep = InspectionResult.STEP_REPLENISH_CREATE;
            }

            if (InspectionResult.STEP_REPLENISH_CREATE.equals(currentStep)) {
                if (existingTask == null) {
                    existingTask = findExistingReplenishmentTask(result);
                }
                if (existingTask == null) {
                    throw BusinessException.of("补货任务创建失败，无法找到补货任务");
                }
                updateStep(result, InspectionResult.STEP_REPLENISH_NOTIFY, null);
                notifySupplierForReplenishment(existingTask, result);
                currentStep = InspectionResult.STEP_REPLENISH_NOTIFY;
            }

            if (InspectionResult.STEP_REPLENISH_NOTIFY.equals(currentStep)) {
                markStepCompleted(result, InspectionResult.STEP_COMPLETED);
                updateBatchStatisticsAfterCompensation(result);
                log.info("补货补偿流程完成（已通知供应商），验收: {}", result.getResultNo());
            }

        } catch (Exception e) {
            log.error("补货补偿流程在步骤 {} 失败: {}", result.getCompensationStep(), e.getMessage(), e);
            updateStep(result, result.getCompensationStep(), e.getMessage());
            throw e;
        }
    }

    private DeductionRecord findExistingDeductionRecord(InspectionResult result) {
        List<DeductionRecord> records = deductionRecordRepository.findByInspectionResultId(result.getId());
        return records.isEmpty() ? null : records.get(0);
    }

    private ReplenishmentTask findExistingReplenishmentTask(InspectionResult result) {
        List<ReplenishmentTask> tasks = replenishmentTaskRepository.findByInspectionResultId(result.getId());
        return tasks.isEmpty() ? null : tasks.get(0);
    }

    @Transactional
    public DeductionRecord createDeductionRecordForInspection(InspectionResult result) {
        log.info("为验收 {} 创建扣款记录", result.getResultNo());

        BigDecimal unqualifiedQty = result.getUnqualifiedQuantity() != null ? 
                result.getUnqualifiedQuantity() : BigDecimal.ZERO;
        
        BigDecimal unitPrice = result.getBatch().getOrder().getUnitPrice();
        BigDecimal deductionAmount = calculateDeductionAmount(result, unqualifiedQty, unitPrice);

        String defectType = detectDefectType(result);

        DeductionRecord record = new DeductionRecord();
        record.setRecordNo(NoGenerator.generateDeductionNo());
        record.setInspectionResult(result);
        record.setOrder(result.getBatch().getOrder());
        record.setBatch(result.getBatch());
        record.setSupplier(result.getBatch().getOrder().getSupplier());
        record.setDefectType(defectType);
        record.setDefectiveQuantity(unqualifiedQty);
        record.setDeductionAmount(deductionAmount);
        record.setDeductionMethod("自动计算");
        record.setDeductionReason("验收不合格自动扣款：" + 
                (result.getDefectDescription() != null ? result.getDefectDescription() : "质量问题"));
        record.setRecordStatus(DeductionRecord.STATUS_PENDING);

        DeductionRecord saved = deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                saved.getId(),
                saved.getRecordNo(),
                "自动创建",
                null,
                saved.getRecordStatus(),
                "系统自动为验收 " + result.getResultNo() + " 创建扣款记录，不合格数量：" + 
                        unqualifiedQty + "，扣款金额：" + deductionAmount,
                null,
                saved
        );

        return saved;
    }

    private BigDecimal calculateDeductionAmount(InspectionResult result, BigDecimal qty, BigDecimal unitPrice) {
        List<DeductionRule> rules = deductionRuleRepository.findBySupplierIdAndIsActiveTrue(
                result.getBatch().getOrder().getSupplier().getId());
        
        if (rules.isEmpty()) {
            rules = deductionRuleRepository.findByIsActiveTrue();
        }

        if (!rules.isEmpty()) {
            DeductionRule rule = rules.get(0);
            if (DeductionRule.METHOD_PERCENTAGE.equals(rule.getCalculationMethod())) {
                BigDecimal rate = rule.getMinRate() != null ? 
                        rule.getMinRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) :
                        BigDecimal.valueOf(0.1);
                return qty.multiply(unitPrice).multiply(rate)
                        .setScale(2, RoundingMode.HALF_UP);
            } else if (DeductionRule.METHOD_FIXED.equals(rule.getCalculationMethod())) {
                return rule.getFixedAmount() != null ? 
                        rule.getFixedAmount() : qty.multiply(unitPrice);
            } else if (DeductionRule.METHOD_MULTIPLE.equals(rule.getCalculationMethod())) {
                BigDecimal multiple = rule.getMinRate() != null ? 
                        rule.getMinRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) :
                        BigDecimal.valueOf(1.0);
                return qty.multiply(unitPrice).multiply(multiple)
                        .setScale(2, RoundingMode.HALF_UP);
            }
        }

        return qty.multiply(unitPrice).multiply(BigDecimal.valueOf(0.1))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private String detectDefectType(InspectionResult result) {
        String desc = result.getDefectDescription();
        if (desc == null) {
            return DeductionRule.DEFECT_OTHER;
        }
        String lower = desc.toLowerCase();
        if (lower.contains("外观") || lower.contains("划痕") || lower.contains("色斑")) {
            return DeductionRule.DEFECT_APPEARANCE;
        }
        if (lower.contains("尺寸") || lower.contains("超差") || lower.contains("公差")) {
            return DeductionRule.DEFECT_DIMENSION;
        }
        if (lower.contains("功能") || lower.contains("性能") || lower.contains("失效")) {
            return DeductionRule.DEFECT_FUNCTION;
        }
        return DeductionRule.DEFECT_OTHER;
    }

    @Transactional
    public void approveDeductionRecord(DeductionRecord record, InspectionResult result) {
        log.info("自动审批扣款记录 {}", record.getRecordNo());

        if (DeductionRecord.STATUS_APPROVED.equals(record.getRecordStatus()) ||
            DeductionRecord.STATUS_COMPLETED.equals(record.getRecordStatus())) {
            log.info("扣款记录 {} 已审批或已完成，跳过", record.getRecordNo());
            return;
        }

        record.setRecordStatus(DeductionRecord.STATUS_APPROVED);
        record.setApprover("系统自动");
        record.setApprovedAt(LocalDateTime.now());
        record.setApprovalRemark("验收确认后自动审批");

        deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                record.getId(),
                record.getRecordNo(),
                "自动审批",
                DeductionRecord.STATUS_PENDING,
                record.getRecordStatus(),
                "系统自动审批扣款记录 " + record.getRecordNo(),
                null,
                record
        );
    }

    @Transactional
    public void executeDeduction(DeductionRecord record, InspectionResult result) {
        log.info("执行扣款 {}，金额: {}", record.getRecordNo(), record.getDeductionAmount());

        if (DeductionRecord.STATUS_COMPLETED.equals(record.getRecordStatus())) {
            log.info("扣款 {} 已完成，跳过执行", record.getRecordNo());
            return;
        }

        if (simulateDeductionFailure.get()) {
            String errorMsg = "模拟扣款失败：财务系统暂时不可用，请稍后重试";
            record.setRecordStatus(DeductionRecord.STATUS_FAILED);
            record.setFailureReason(errorMsg);
            deductionRecordRepository.save(record);

            logService.logFailure(
                    OperationLog.ENTITY_DEDUCTION,
                    record.getId(),
                    record.getRecordNo(),
                    "自动执行扣款",
                    DeductionRecord.STATUS_APPROVED,
                    record.getRecordStatus(),
                    "扣款 " + record.getRecordNo() + " 执行失败（模拟）",
                    null,
                    record,
                    errorMsg
            );

            throw BusinessException.of(errorMsg);
        }

        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        record.setRecordStatus(DeductionRecord.STATUS_COMPLETED);
        deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                record.getId(),
                record.getRecordNo(),
                "自动执行扣款",
                DeductionRecord.STATUS_APPROVED,
                record.getRecordStatus(),
                "扣款 " + record.getRecordNo() + " 执行成功，金额：" + record.getDeductionAmount(),
                null,
                record
        );
    }

    @Transactional
    public ReplenishmentTask createReplenishmentTaskForInspection(InspectionResult result) {
        log.info("为验收 {} 创建补货任务", result.getResultNo());

        BigDecimal replenishQty = result.getUnqualifiedQuantity() != null ? 
                result.getUnqualifiedQuantity() : BigDecimal.ZERO;

        ReplenishmentTask task = new ReplenishmentTask();
        task.setTaskNo(NoGenerator.generateReplenishmentNo());
        task.setOrder(result.getBatch().getOrder());
        task.setBatch(result.getBatch());
        task.setInspectionResult(result);
        task.setSupplier(result.getBatch().getOrder().getSupplier());
        task.setRequiredQuantity(replenishQty);
        task.setReceivedQuantity(BigDecimal.ZERO);
        task.setRemainingQuantity(replenishQty);
        task.setRequiredDate(LocalDate.now().plusDays(7));
        task.setTaskDescription("验收不合格自动补货：不合格数量 " + replenishQty + 
                "，原因：" + (result.getDefectDescription() != null ? result.getDefectDescription() : "质量问题"));
        task.setHandler(SecurityUtil.getCurrentRealName());
        task.setTaskStatus(ReplenishmentTask.STATUS_CREATED);

        ReplenishmentTask saved = replenishmentTaskRepository.save(task);

        OutsourcingOrder order = result.getBatch().getOrder();
        order.setReplenishmentQuantity(order.getReplenishmentQuantity().add(replenishQty));
        orderRepository.save(order);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                saved.getId(),
                saved.getTaskNo(),
                "自动创建",
                null,
                saved.getTaskStatus(),
                "系统自动为验收 " + result.getResultNo() + " 创建补货任务，补货数量：" + replenishQty,
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public void notifySupplierForReplenishment(ReplenishmentTask task, InspectionResult result) {
        log.info("通知供应商补货任务 {}", task.getTaskNo());

        if (!ReplenishmentTask.STATUS_CREATED.equals(task.getTaskStatus()) &&
            !ReplenishmentTask.STATUS_FAILED.equals(task.getTaskStatus())) {
            log.info("补货任务 {} 状态为 {}，跳过通知", task.getTaskNo(), task.getTaskStatus());
            return;
        }

        task.setTaskStatus(ReplenishmentTask.STATUS_NOTIFIED);
        task.setSupplierResponse("系统已自动发送补货通知，请供应商确认");
        replenishmentTaskRepository.save(task);

        logService.logSuccess(
                OperationLog.ENTITY_REPLENISHMENT,
                task.getId(),
                task.getTaskNo(),
                "自动通知",
                ReplenishmentTask.STATUS_CREATED,
                task.getTaskStatus(),
                "系统自动通知供应商补货任务 " + task.getTaskNo(),
                null,
                task
        );
    }

    @Transactional
    public void updateStep(InspectionResult result, String step, String error) {
        result.setCompensationStep(step);
        result.setCompensationError(error);
        inspectionRepository.save(result);

        if (error != null) {
            logService.logFailure(
                    OperationLog.ENTITY_INSPECTION,
                    result.getId(),
                    result.getResultNo(),
                    "补偿步骤",
                    null,
                    step,
                    "补偿步骤 [" + step + "] 失败：" + error,
                    null,
                    result,
                    error
            );
        } else {
            logService.logSuccess(
                    OperationLog.ENTITY_INSPECTION,
                    result.getId(),
                    result.getResultNo(),
                    "补偿步骤",
                    null,
                    step,
                    "进入补偿步骤 [" + step + "]",
                    null,
                    result
            );
        }
    }

    @Transactional
    public void markStepCompleted(InspectionResult result, String step) {
        result.setCompensationStep(step);
        result.setCompensationError(null);
        inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                result.getId(),
                result.getResultNo(),
                "补偿完成",
                null,
                step,
                "补偿流程完成",
                null,
                result
        );
    }

    @Transactional
    public void updateBatchStatisticsAfterCompensation(InspectionResult result) {
        DeliveryBatch batch = result.getBatch();
        
        BigDecimal deductionAmount = calculateTotalDeductionForResult(result);
        BigDecimal replenishmentQuantity = calculateTotalReplenishmentForResult(result);

        batch.setQualifiedQuantity(result.getQualifiedQuantity());
        batch.setUnqualifiedQuantity(result.getUnqualifiedQuantity());
        batch.setDeductionAmount(deductionAmount);
        batch.setReplenishmentQuantity(replenishmentQuantity);

        if (result.getUnqualifiedQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setBatchStatus(DeliveryBatch.STATUS_QUALIFIED);
        } else if (result.getQualifiedQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setBatchStatus(DeliveryBatch.STATUS_UNQUALIFIED);
        } else {
            batch.setBatchStatus(DeliveryBatch.STATUS_PARTIAL_PASS);
        }

        batchRepository.save(batch);

        OutsourcingOrder order = batch.getOrder();
        order.setQualifiedQuantity(order.getQualifiedQuantity().add(result.getQualifiedQuantity()));
        order.setUnqualifiedQuantity(order.getUnqualifiedQuantity().add(result.getUnqualifiedQuantity()));
        order.setDeductionAmount(order.getDeductionAmount().add(deductionAmount));
        orderRepository.save(order);
    }

    private BigDecimal calculateTotalDeductionForResult(InspectionResult result) {
        List<DeductionRecord> records = deductionRecordRepository.findByInspectionResultId(result.getId());
        return records.stream()
                .filter(r -> List.of(
                        DeductionRecord.STATUS_APPROVED,
                        DeductionRecord.STATUS_COMPLETED
                ).contains(r.getRecordStatus()))
                .map(DeductionRecord::getDeductionAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateTotalReplenishmentForResult(InspectionResult result) {
        List<ReplenishmentTask> tasks = replenishmentTaskRepository.findByInspectionResultId(result.getId());
        return tasks.stream()
                .filter(t -> !ReplenishmentTask.STATUS_CANCELLED.equals(t.getTaskStatus()))
                .map(ReplenishmentTask::getRequiredQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public String getCompensationProgress(InspectionResult result) {
        String step = result.getCompensationStep();
        String error = result.getCompensationError();
        
        if (step == null || InspectionResult.STEP_NONE.equals(step)) {
            return "补偿流程尚未开始";
        }
        
        if (InspectionResult.STEP_COMPLETED.equals(step)) {
            return "补偿流程已完成";
        }
        
        if (error != null) {
            return "补偿流程在步骤 [" + step + "] 失败：" + error;
        }
        
        return "补偿流程正在执行，当前步骤：" + step;
    }
}
