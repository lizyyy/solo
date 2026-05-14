package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.InspectionResultRequest;
import com.manufacture.outsourcing.entity.DeliveryBatch;
import com.manufacture.outsourcing.entity.InspectionResult;
import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.InspectionResultRepository;
import com.manufacture.outsourcing.util.NoGenerator;
import com.manufacture.outsourcing.util.SecurityUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class InspectionService {

    private final InspectionResultRepository inspectionRepository;
    private final DeliveryBatchService batchService;
    private final OperationLogService logService;
    private final CompensationProcessor compensationProcessor;

    public InspectionService(InspectionResultRepository inspectionRepository,
                              DeliveryBatchService batchService,
                              OperationLogService logService,
                              CompensationProcessor compensationProcessor) {
        this.inspectionRepository = inspectionRepository;
        this.batchService = batchService;
        this.logService = logService;
        this.compensationProcessor = compensationProcessor;
    }

    @Transactional
    public InspectionResult createInspection(InspectionResultRequest request) {
        DeliveryBatch batch = batchService.getById(request.getBatchId());
        String batchStatus = batch.getBatchStatus();

        if (!DeliveryBatch.STATUS_INSPECTION.equals(batchStatus)) {
            throw BusinessException.badRequest("请先开始验收流程，当前批次状态：" + batchStatus);
        }

        BigDecimal total = request.getQualifiedQuantity().add(request.getUnqualifiedQuantity());
        if (total.compareTo(batch.getDeliveryQuantity()) > 0) {
            throw BusinessException.badRequest("验收数量不能超过到货数量");
        }

        InspectionResult result = new InspectionResult();
        result.setResultNo(NoGenerator.generateInspectionNo());
        result.setBatch(batch);
        result.setInspector(SecurityUtil.getCurrentRealName());
        result.setInspectionTime(LocalDateTime.now());
        result.setSampleQuantity(request.getSampleQuantity());
        result.setQualifiedSample(request.getQualifiedSample());
        result.setQualifiedQuantity(request.getQualifiedQuantity());
        result.setUnqualifiedQuantity(request.getUnqualifiedQuantity());
        result.setInspectionConclusion(request.getInspectionConclusion());
        result.setDefectDescription(request.getDefectDescription());
        result.setInspectionRemark(request.getInspectionRemark());
        result.setProcessingSuggestion(request.getProcessingSuggestion());
        result.setResultStatus(InspectionResult.STATUS_PENDING);
        result.setCompensationStep(InspectionResult.STEP_NONE);
        result.setCompensationRetryCount(0);

        InspectionResult saved = inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                saved.getId(),
                saved.getResultNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getResultStatus(),
                "创建验收记录 " + saved.getResultNo() + "，合格数：" + request.getQualifiedQuantity() + "，不合格数：" + request.getUnqualifiedQuantity() + "，处理建议：" + request.getProcessingSuggestion(),
                null,
                saved
        );

        return saved;
    }

    @Transactional
    public InspectionResult confirmInspection(Long inspectionId) {
        InspectionResult result = getById(inspectionId);
        String oldStatus = result.getResultStatus();

        if (!InspectionResult.STATUS_PENDING.equals(oldStatus) &&
            !InspectionResult.STATUS_COMPENSATION_FAILED.equals(oldStatus) &&
            !InspectionResult.STATUS_COMPENSATION_RETRY.equals(oldStatus)) {
            throw BusinessException.badRequest("当前验收记录状态不允许确认，当前状态：" + oldStatus);
        }

        result.setResultStatus(InspectionResult.STATUS_CONFIRMED);
        InspectionResult saved = inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                saved.getId(),
                saved.getResultNo(),
                OperationLog.ACTION_CONFIRM,
                oldStatus,
                saved.getResultStatus(),
                "确认验收记录 " + saved.getResultNo() + "，处理建议：" + saved.getProcessingSuggestion(),
                null,
                saved
        );

        try {
            compensationProcessor.executeCompensation(saved);
            updateStatusCompleted(saved.getId());

            InspectionResult completed = getById(saved.getId());
            logService.logSuccess(
                    OperationLog.ENTITY_INSPECTION,
                    completed.getId(),
                    completed.getResultNo(),
                    OperationLog.ACTION_COMPENSATION,
                    InspectionResult.STATUS_CONFIRMED,
                    completed.getResultStatus(),
                    "验收 " + completed.getResultNo() + " 的补偿处理已完成，当前步骤：" + completed.getCompensationStep(),
                    null,
                    completed
            );

            saved = completed;
        } catch (Exception e) {
            log.error("验收补偿处理失败: {}", e.getMessage(), e);
            InspectionResult failed = updateStatusCompensationFailed(saved.getId(), e.getMessage());

            String progress = compensationProcessor.getCompensationProgress(failed);
            String step = failed.getCompensationStep();

            logService.logFailure(
                    OperationLog.ENTITY_INSPECTION,
                    failed.getId(),
                    failed.getResultNo(),
                    OperationLog.ACTION_COMPENSATION,
                    oldStatus,
                    failed.getResultStatus(),
                    progress,
                    null,
                    failed,
                    e.getMessage()
            );

            throw BusinessException.of(
                "验收确认成功，但补偿处理失败。" +
                progress + "。" +
                "请调用重试接口从当前步骤 [" + step + "] 继续执行，无需重新确认验收。"
            );
        }

        return saved;
    }

    @Transactional
    public InspectionResult retryCompensation(Long inspectionId) {
        InspectionResult result = getById(inspectionId);
        String oldStatus = result.getResultStatus();
        String currentStep = result.getCompensationStep();

        if (!InspectionResult.STATUS_COMPENSATION_FAILED.equals(oldStatus) &&
            !InspectionResult.STATUS_COMPENSATION_RETRY.equals(oldStatus)) {
            throw BusinessException.badRequest("只有补偿失败的验收记录才能重试，当前状态：" + oldStatus);
        }

        if (currentStep == null) {
            currentStep = InspectionResult.STEP_NONE;
        }

        result.setResultStatus(InspectionResult.STATUS_COMPENSATION_RETRY);
        result.setCompensationRetryCount(
            result.getCompensationRetryCount() == null ? 1 : result.getCompensationRetryCount() + 1
        );
        inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                result.getId(),
                result.getResultNo(),
                OperationLog.ACTION_RETRY,
                oldStatus,
                result.getResultStatus(),
                "从步骤 [" + currentStep + "] 重试验收 " + result.getResultNo() + " 的补偿处理，第 " + result.getCompensationRetryCount() + " 次",
                null,
                result
        );

        try {
            compensationProcessor.executeCompensation(result);
            InspectionResult saved = updateStatusCompleted(result.getId());

            logService.logSuccess(
                    OperationLog.ENTITY_INSPECTION,
                    saved.getId(),
                    saved.getResultNo(),
                    OperationLog.ACTION_COMPENSATION,
                    InspectionResult.STATUS_COMPENSATION_RETRY,
                    saved.getResultStatus(),
                    "验收 " + saved.getResultNo() + " 的补偿处理重试成功",
                    null,
                    saved
            );

            return saved;

        } catch (Exception e) {
            log.error("补偿重试失败: {}", e.getMessage(), e);
            InspectionResult failed = updateStatusCompensationFailed(result.getId(), e.getMessage());

            String progress = compensationProcessor.getCompensationProgress(result);

            throw BusinessException.of(
                "补偿处理重试仍失败。" +
                progress + "。" +
                "可再次重试从当前步骤继续，或检查失败原因后再操作。"
            );
        }
    }

    public String getCompensationProgress(Long inspectionId) {
        InspectionResult result = getById(inspectionId);
        return compensationProcessor.getCompensationProgress(result);
    }

    public void setSimulateDeductionFailure(boolean simulate) {
        compensationProcessor.setSimulateDeductionFailure(simulate);
    }

    public boolean isSimulateDeductionFailure() {
        return compensationProcessor.isSimulateDeductionFailure();
    }

    public InspectionResult getById(Long id) {
        return inspectionRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("验收记录不存在"));
    }

    public List<InspectionResult> findByBatchId(Long batchId) {
        return inspectionRepository.findByBatchIdOrderByCreatedAtDesc(batchId);
    }

    public InspectionResult getByResultNo(String resultNo) {
        return inspectionRepository.findByResultNo(resultNo)
                .orElseThrow(() -> BusinessException.notFound("验收记录不存在"));
    }

    public List<InspectionResult> findFailedCompensation() {
        return inspectionRepository.findByResultStatusIn(
                List.of(InspectionResult.STATUS_COMPENSATION_FAILED, InspectionResult.STATUS_COMPENSATION_RETRY)
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public InspectionResult updateStatusCompleted(Long inspectionId) {
        InspectionResult result = inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> BusinessException.notFound("验收记录不存在"));
        result.setResultStatus(InspectionResult.STATUS_COMPLETED);
        return inspectionRepository.save(result);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public InspectionResult updateStatusCompensationFailed(Long inspectionId, String errorMessage) {
        InspectionResult result = inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> BusinessException.notFound("验收记录不存在"));
        result.setResultStatus(InspectionResult.STATUS_COMPENSATION_FAILED);
        if (result.getCompensationError() == null) {
            result.setCompensationError(errorMessage);
        }
        return inspectionRepository.save(result);
    }
}
