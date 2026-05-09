package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.DeductionRecordRequest;
import com.manufacture.outsourcing.entity.DeductionRecord;
import com.manufacture.outsourcing.entity.DeductionRule;
import com.manufacture.outsourcing.entity.InspectionResult;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.DeductionRecordRepository;
import com.manufacture.outsourcing.repository.DeductionRuleRepository;
import com.manufacture.outsourcing.util.NoGenerator;
import com.manufacture.outsourcing.util.SecurityUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class DeductionService {

    private final DeductionRecordRepository deductionRecordRepository;
    private final DeductionRuleRepository deductionRuleRepository;
    private final InspectionService inspectionService;
    private final OperationLogService logService;

    public DeductionService(DeductionRecordRepository deductionRecordRepository,
                            DeductionRuleRepository deductionRuleRepository,
                            InspectionService inspectionService,
                            OperationLogService logService) {
        this.deductionRecordRepository = deductionRecordRepository;
        this.deductionRuleRepository = deductionRuleRepository;
        this.inspectionService = inspectionService;
        this.logService = logService;
    }

    public BigDecimal calculateDeductionAmountForInspection(InspectionResult result) {
        List<DeductionRecord> records = deductionRecordRepository.findByInspectionResultId(result.getId());
        return records.stream()
                .filter(r -> List.of(
                        DeductionRecord.STATUS_APPROVED,
                        DeductionRecord.STATUS_COMPLETED
                ).contains(r.getRecordStatus()))
                .map(DeductionRecord::getDeductionAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Transactional
    public DeductionRecord createDeductionRecord(DeductionRecordRequest request) {
        InspectionResult inspection = inspectionService.getById(request.getInspectionResultId());

        DeductionRecord record = new DeductionRecord();
        record.setRecordNo(NoGenerator.generateDeductionNo());
        record.setInspectionResult(inspection);
        record.setOrder(inspection.getBatch().getOrder());
        record.setBatch(inspection.getBatch());
        record.setSupplier(inspection.getBatch().getOrder().getSupplier());

        if (request.getRuleId() != null) {
            DeductionRule rule = deductionRuleRepository.findById(request.getRuleId())
                    .orElseThrow(() -> BusinessException.notFound("扣款规则不存在"));
            record.setDeductionRule(rule);
            record.setDeductionMethod(rule.getCalculationMethod());
            record.setDefectType(rule.getDefectType());
        } else {
            record.setDeductionMethod(request.getDeductionMethod() != null ? 
                    request.getDeductionMethod() : "手动录入");
            record.setDefectType(request.getDefectType());
        }

        record.setDefectiveQuantity(request.getDefectiveQuantity() != null ? 
                request.getDefectiveQuantity() : inspection.getUnqualifiedQuantity());
        record.setDeductionAmount(request.getDeductionAmount());
        record.setDeductionReason(request.getDeductionReason());
        record.setRecordStatus(DeductionRecord.STATUS_PENDING);

        DeductionRecord saved = deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                saved.getId(),
                saved.getRecordNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getRecordStatus(),
                "创建扣款记录 " + saved.getRecordNo() + "，扣款金额：" + request.getDeductionAmount(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public DeductionRecord approve(Long recordId, String approvalRemark) {
        DeductionRecord record = getById(recordId);
        String oldStatus = record.getRecordStatus();

        if (!DeductionRecord.STATUS_PENDING.equals(oldStatus) &&
            !DeductionRecord.STATUS_FAILED.equals(oldStatus)) {
            throw BusinessException.badRequest("当前状态不允许审批，当前状态：" + oldStatus);
        }

        record.setRecordStatus(DeductionRecord.STATUS_APPROVED);
        record.setApprover(SecurityUtil.getCurrentRealName());
        record.setApprovedAt(LocalDateTime.now());
        record.setApprovalRemark(approvalRemark);

        DeductionRecord saved = deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                saved.getId(),
                saved.getRecordNo(),
                OperationLog.ACTION_APPROVE,
                oldStatus,
                saved.getRecordStatus(),
                "审批通过扣款记录 " + saved.getRecordNo(),
                null,
                saved
        );

        try {
            executeDeduction(saved);
            saved.setRecordStatus(DeductionRecord.STATUS_COMPLETED);
            deductionRecordRepository.save(saved);

            logService.logSuccess(
                    OperationLog.ENTITY_DEDUCTION,
                    saved.getId(),
                    saved.getRecordNo(),
                    OperationLog.ACTION_COMPLETE,
                    DeductionRecord.STATUS_APPROVED,
                    saved.getRecordStatus(),
                    "扣款 " + saved.getRecordNo() + " 已完成",
                    null,
                    saved
            );

        } catch (Exception e) {
            log.error("扣款执行失败: {}", e.getMessage(), e);
            saved.setRecordStatus(DeductionRecord.STATUS_FAILED);
            saved.setFailureReason(e.getMessage());
            deductionRecordRepository.save(saved);

            logService.logFailure(
                    OperationLog.ENTITY_DEDUCTION,
                    saved.getId(),
                    saved.getRecordNo(),
                    "扣款执行",
                    oldStatus,
                    saved.getRecordStatus(),
                    "扣款 " + saved.getRecordNo() + " 执行失败，可重试",
                    null,
                    saved,
                    e.getMessage()
            );

            throw BusinessException.of("扣款审批通过，但实际扣款执行失败：" + e.getMessage() + "。扣款记录已保存，可重试执行。");
        }

        return saved;
    }

    @Transactional
    public DeductionRecord retryExecution(Long recordId, String retryDescription) {
        DeductionRecord record = getById(recordId);
        String oldStatus = record.getRecordStatus();

        if (!DeductionRecord.STATUS_FAILED.equals(oldStatus)) {
            throw BusinessException.badRequest("只有执行失败的扣款记录才能重试");
        }

        record.setRetryCount(record.getRetryCount() == null ? 1 : record.getRetryCount() + 1);
        record.setRetryDescription(retryDescription);
        deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                record.getId(),
                record.getRecordNo(),
                OperationLog.ACTION_RETRY,
                oldStatus,
                record.getRecordStatus(),
                "重试扣款 " + record.getRecordNo() + " 的执行",
                null,
                record
        );

        try {
            executeDeduction(record);
            record.setRecordStatus(DeductionRecord.STATUS_COMPLETED);
            DeductionRecord saved = deductionRecordRepository.save(record);

            logService.logSuccess(
                    OperationLog.ENTITY_DEDUCTION,
                    saved.getId(),
                    saved.getRecordNo(),
                    OperationLog.ACTION_COMPLETE,
                    oldStatus,
                    saved.getRecordStatus(),
                    "扣款 " + saved.getRecordNo() + " 重试执行成功",
                    null,
                    saved
            );

            return saved;

        } catch (Exception e) {
            log.error("扣款重试失败: {}", e.getMessage(), e);
            record.setRecordStatus(DeductionRecord.STATUS_FAILED);
            record.setFailureReason(e.getMessage());
            deductionRecordRepository.save(record);

            throw BusinessException.of("扣款重试仍失败：" + e.getMessage() + "。可再次重试，或联系财务人员手动处理。");
        }
    }

    private void executeDeduction(DeductionRecord record) {
        log.info("执行扣款逻辑: {}，金额: {}", record.getRecordNo(), record.getDeductionAmount());
    }

    @Transactional
    public DeductionRecord reject(Long recordId, String approvalRemark) {
        DeductionRecord record = getById(recordId);
        String oldStatus = record.getRecordStatus();

        if (!DeductionRecord.STATUS_PENDING.equals(oldStatus)) {
            throw BusinessException.badRequest("只有待审批状态才能驳回");
        }

        record.setRecordStatus(DeductionRecord.STATUS_REJECTED);
        record.setApprover(SecurityUtil.getCurrentRealName());
        record.setApprovedAt(LocalDateTime.now());
        record.setApprovalRemark(approvalRemark);

        DeductionRecord saved = deductionRecordRepository.save(record);

        logService.logSuccess(
                OperationLog.ENTITY_DEDUCTION,
                saved.getId(),
                saved.getRecordNo(),
                OperationLog.ACTION_REJECT,
                oldStatus,
                saved.getRecordStatus(),
                "驳回扣款记录 " + saved.getRecordNo(),
                null,
                saved
        );

        return saved;
    }

    public DeductionRecord getById(Long id) {
        return deductionRecordRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("扣款记录不存在"));
    }

    public List<DeductionRecord> findByInspectionId(Long inspectionId) {
        return deductionRecordRepository.findByInspectionResultId(inspectionId);
    }

    public List<DeductionRecord> findByOrderId(Long orderId) {
        return deductionRecordRepository.findByOrderId(orderId);
    }

    public List<DeductionRecord> findFailedRecords() {
        return deductionRecordRepository.findByRecordStatusIn(List.of(DeductionRecord.STATUS_FAILED));
    }

    public List<DeductionRule> findActiveRules() {
        return deductionRuleRepository.findByIsActiveTrue();
    }
}
