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
    private final InspectionStatisticsService statisticsService;

    public InspectionService(InspectionResultRepository inspectionRepository,
                              DeliveryBatchService batchService,
                              OperationLogService logService,
                              InspectionStatisticsService statisticsService) {
        this.inspectionRepository = inspectionRepository;
        this.batchService = batchService;
        this.logService = logService;
        this.statisticsService = statisticsService;
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

        InspectionResult saved = inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                saved.getId(),
                saved.getResultNo(),
                OperationLog.ACTION_CREATE,
                null,
                saved.getResultStatus(),
                "创建验收记录 " + saved.getResultNo() + "，合格数：" + request.getQualifiedQuantity() + "，不合格数：" + request.getUnqualifiedQuantity(),
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
                "确认验收记录 " + saved.getResultNo(),
                null,
                saved
        );

        try {
            executeCompensationActions(saved);
            saved.setResultStatus(InspectionResult.STATUS_COMPLETED);
            inspectionRepository.save(saved);

            updateBatchStatistics(saved);

            logService.logSuccess(
                    OperationLog.ENTITY_INSPECTION,
                    saved.getId(),
                    saved.getResultNo(),
                    OperationLog.ACTION_COMPENSATION,
                    InspectionResult.STATUS_CONFIRMED,
                    saved.getResultStatus(),
                    "验收 " + saved.getResultNo() + " 的后续处理已完成",
                    null,
                    saved
            );

        } catch (Exception e) {
            log.error("验收后续处理失败: {}", e.getMessage(), e);
            saved.setResultStatus(InspectionResult.STATUS_COMPENSATION_FAILED);
            inspectionRepository.save(saved);

            logService.logFailure(
                    OperationLog.ENTITY_INSPECTION,
                    saved.getId(),
                    saved.getResultNo(),
                    OperationLog.ACTION_COMPENSATION,
                    oldStatus,
                    saved.getResultStatus(),
                    "验收 " + saved.getResultNo() + " 的后续处理失败，可重试",
                    null,
                    saved,
                    e.getMessage()
            );

            throw BusinessException.of("验收确认成功，但后续扣款/补货处理失败：" + e.getMessage() + "。系统已保存当前状态，可稍后重试补偿处理。");
        }

        return saved;
    }

    @Transactional
    public InspectionResult retryCompensation(Long inspectionId) {
        InspectionResult result = getById(inspectionId);
        String oldStatus = result.getResultStatus();

        if (!InspectionResult.STATUS_COMPENSATION_FAILED.equals(oldStatus) &&
            !InspectionResult.STATUS_COMPENSATION_RETRY.equals(oldStatus)) {
            throw BusinessException.badRequest("只有补偿失败的验收记录才能重试");
        }

        result.setResultStatus(InspectionResult.STATUS_COMPENSATION_RETRY);
        inspectionRepository.save(result);

        logService.logSuccess(
                OperationLog.ENTITY_INSPECTION,
                result.getId(),
                result.getResultNo(),
                OperationLog.ACTION_RETRY,
                oldStatus,
                result.getResultStatus(),
                "重试验收 " + result.getResultNo() + " 的补偿处理",
                null,
                result
        );

        try {
            executeCompensationActions(result);
            result.setResultStatus(InspectionResult.STATUS_COMPLETED);
            InspectionResult saved = inspectionRepository.save(result);

            updateBatchStatistics(result);

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
            result.setResultStatus(InspectionResult.STATUS_COMPENSATION_FAILED);
            inspectionRepository.save(result);

            throw BusinessException.of("补偿处理重试仍失败：" + e.getMessage() + "。可再次重试，或联系管理员检查系统状态。");
        }
    }

    private void executeCompensationActions(InspectionResult result) {
        String suggestion = result.getProcessingSuggestion();

        switch (suggestion) {
            case "扣款接收":
                log.info("执行扣款处理，验收记录: {}", result.getResultNo());
                break;
            case "要求补货":
                log.info("执行补货处理，验收记录: {}", result.getResultNo());
                break;
            case "直接入库":
                log.info("直接入库，无需额外处理");
                break;
            case "退货":
                log.info("执行退货处理");
                break;
            case "返工后复检":
                log.info("等待返工后复检");
                break;
            default:
                log.warn("未识别的处理建议: {}", suggestion);
        }
    }

    private void updateBatchStatistics(InspectionResult result) {
        DeliveryBatch batch = result.getBatch();
        BigDecimal deductionAmount = statisticsService.calculateDeductionAmountForInspection(result);
        BigDecimal replenishmentQuantity = statisticsService.calculateReplenishmentQuantityForInspection(result);

        batchService.updateBatchAfterInspection(
                batch.getId(),
                result.getQualifiedQuantity(),
                result.getUnqualifiedQuantity(),
                deductionAmount,
                replenishmentQuantity
        );
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
}
