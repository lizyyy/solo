package com.fund.refund.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fund.refund.dto.*;
import com.fund.refund.entity.*;
import com.fund.refund.enums.ProcessStatus;
import com.fund.refund.mapper.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RefundBatchReplayService {

    @Autowired
    private RefundBatchMapper refundBatchMapper;

    @Autowired
    private CustodianConfirmationMapper custodianConfirmationMapper;

    @Autowired
    private ExDividendEvidenceMapper exDividendEvidenceMapper;

    @Autowired
    private RefundDetailMapper refundDetailMapper;

    @Autowired
    private AuditLogMapper auditLogMapper;

    @Autowired
    private UnifiedResultService unifiedResultService;

    @Autowired
    private SelfCheckService selfCheckService;

    @Transactional(rollbackFor = Exception.class)
    public RefundBatch step1ImportCustodianConfirmation(BatchImportRequest request) {
        RefundBatch batch = new RefundBatch();
        batch.setBatchNo(request.getBatchNo());
        batch.setBatchName(request.getBatchName());
        batch.setBatchDate(request.getBatchDate().atStartOfDay());
        batch.setFundCode(request.getFundCode());
        batch.setFundName(request.getFundName());
        batch.setCustodian(request.getCustodian());
        batch.setOperator(request.getOperator());
        batch.setProcessStatus(ProcessStatus.IMPORTED.getCode());
        batch.setCurrentStep("step1_import");
        batch.setTotalCount(request.getRows().size());

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (BatchImportRequest.CustodianRow row : request.getRows()) {
            totalAmount = totalAmount.add(row.getAmount() != null ? row.getAmount() : BigDecimal.ZERO);
        }
        batch.setTotalAmount(totalAmount);
        refundBatchMapper.insert(batch);

        for (BatchImportRequest.CustodianRow row : request.getRows()) {
            CustodianConfirmation cc = new CustodianConfirmation();
            cc.setBatchId(batch.getId());
            cc.setBatchNo(batch.getBatchNo());
            cc.setOriginalRowNo(row.getRowNo());
            cc.setBizNo(row.getBizNo());
            cc.setMerchantNo(row.getMerchantNo());
            cc.setMerchantName(row.getMerchantName());
            cc.setTradeDate(row.getTradeDate());
            cc.setSettlementDate(row.getSettlementDate());
            cc.setOriginalAmount(row.getAmount());
            cc.setOriginalPrincipal(row.getPrincipal());
            cc.setOriginalFee(row.getFee());
            cc.setCurrency(row.getCurrency());
            cc.setOriginalStatus(row.getStatus());
            cc.setOriginalRemark(row.getRemark());
            cc.setRawContent(row.getRawContent());
            custodianConfirmationMapper.insert(cc);
        }

        generateDetailsFromCustodian(batch.getId(), batch.getBatchNo(), request.getRows(), request.getOperator());

        logAudit(batch.getId(), batch.getBatchNo(), null, null,
                "STEP1_IMPORT", null, "批次" + batch.getBatchNo(), request.getOperator(), "托管确认页导入完成");

        return batch;
    }

    private void generateDetailsFromCustodian(Long batchId, String batchNo,
                                              List<BatchImportRequest.CustodianRow> rows,
                                              String operator) {
        Map<String, List<BatchImportRequest.CustodianRow>> bizNoGroups = rows.stream()
                .collect(Collectors.groupingBy(BatchImportRequest.CustodianRow::getBizNo));

        for (Map.Entry<String, List<BatchImportRequest.CustodianRow>> entry : bizNoGroups.entrySet()) {
            String bizNo = entry.getKey();
            List<BatchImportRequest.CustodianRow> bizRows = entry.getValue();

            if (bizRows.size() > 1) {
                boolean hasSplit = bizRows.stream().anyMatch(r -> isPrincipalRow(r))
                        && bizRows.stream().anyMatch(r -> isFeeRow(r));

                if (hasSplit) {
                    for (BatchImportRequest.CustodianRow row : bizRows) {
                        RefundDetail detail = createDetail(batchId, batchNo, row);
                        detail.setSameBizNoGroup(bizNo);
                        if (isPrincipalRow(row)) {
                            detail.setDetailType("principal");
                        } else if (isFeeRow(row)) {
                            detail.setDetailType("fee");
                        } else {
                            detail.setDetailType("combined");
                        }
                        detail.setProcessStatus(ProcessStatus.PENDING_SUPERVISOR.getCode());
                        detail.setRemark("同一业务号拆分为手续费和本金，待结算主管复核");
                        refundDetailMapper.insert(detail);
                    }
                    continue;
                }
            }

            for (BatchImportRequest.CustodianRow row : bizRows) {
                RefundDetail detail = createDetail(batchId, batchNo, row);
                detail.setDetailType("combined");
                detail.setProcessStatus(ProcessStatus.IMPORTED.getCode());
                refundDetailMapper.insert(detail);
            }
        }
    }

    private RefundDetail createDetail(Long batchId, String batchNo, BatchImportRequest.CustodianRow row) {
        RefundDetail detail = new RefundDetail();
        detail.setBatchId(batchId);
        detail.setBatchNo(batchNo);
        detail.setBizNo(row.getBizNo());
        detail.setCustodianRowNo(row.getRowNo());
        detail.setMerchantNo(row.getMerchantNo());
        detail.setMerchantName(row.getMerchantName());
        detail.setTradeDate(row.getTradeDate());
        detail.setSettlementDate(row.getSettlementDate());
        detail.setOriginalAmount(row.getAmount());
        detail.setConfirmedAmount(row.getAmount());
        detail.setPrincipal(row.getPrincipal());
        detail.setFee(row.getFee());
        detail.setCurrency(row.getCurrency());
        detail.setEvidenceStatus("pending");
        detail.setDiffStatus("pending");
        return detail;
    }

    private boolean isPrincipalRow(BatchImportRequest.CustodianRow row) {
        if (row.getRemark() != null && row.getRemark().contains("本金")) return true;
        if (row.getRawContent() != null && row.getRawContent().contains("本金")) return true;
        if (row.getFee() == null || row.getFee().compareTo(BigDecimal.ZERO) == 0) {
            if (row.getPrincipal() != null && row.getPrincipal().compareTo(BigDecimal.ZERO) > 0) return true;
        }
        return false;
    }

    private boolean isFeeRow(BatchImportRequest.CustodianRow row) {
        if (row.getRemark() != null && row.getRemark().contains("手续费")) return true;
        if (row.getRawContent() != null && row.getRawContent().contains("手续费")) return true;
        if (row.getPrincipal() == null || row.getPrincipal().compareTo(BigDecimal.ZERO) == 0) {
            if (row.getFee() != null && row.getFee().compareTo(BigDecimal.ZERO) > 0) return true;
        }
        return false;
    }

    @Transactional(rollbackFor = Exception.class)
    public RefundBatch step2ReviewExDividendEvidence(EvidenceReviewRequest request) {
        RefundBatch batch = refundBatchMapper.selectById(request.getBatchId());
        if (batch == null) {
            throw new IllegalArgumentException("批次不存在");
        }

        for (EvidenceReviewRequest.EvidenceItem item : request.getEvidenceItems()) {
            ExDividendEvidence evidence = new ExDividendEvidence();
            evidence.setBatchId(batch.getId());
            evidence.setBatchNo(batch.getBatchNo());
            evidence.setBizNo(item.getBizNo());
            evidence.setExDividendDate(item.getExDividendDate());
            evidence.setEvidenceSource(item.getEvidenceSource());
            evidence.setEvidenceContent(item.getEvidenceContent());
            evidence.setScreenshotUrl(item.getScreenshotUrl());
            evidence.setReviewer(request.getReviewer());
            evidence.setReviewRemark(item.getReviewRemark());
            evidence.setReviewedAt(item.getReviewedAt() != null ? item.getReviewedAt() : LocalDateTime.now());
            exDividendEvidenceMapper.insert(evidence);

            List<RefundDetail> details = refundDetailMapper.selectByBizNo(batch.getId(), item.getBizNo());
            for (RefundDetail detail : details) {
                String oldStatus = detail.getEvidenceStatus();
                detail.setEvidenceStatus("reviewed");
                if (!ProcessStatus.PENDING_SUPERVISOR.getCode().equals(detail.getProcessStatus())) {
                    detail.setProcessStatus(ProcessStatus.EVIDENCE_REVIEWED.getCode());
                }
                refundDetailMapper.updateById(detail);

                logAudit(batch.getId(), batch.getBatchNo(), detail.getId(), detail.getBizNo(),
                        "EVIDENCE_REVIEW", oldStatus, "reviewed", request.getReviewer(),
                        "除权日证据已补看: " + item.getEvidenceContent());
            }
        }

        batch.setProcessStatus(ProcessStatus.EVIDENCE_REVIEWED.getCode());
        batch.setCurrentStep("step2_evidence");
        refundBatchMapper.updateById(batch);

        logAudit(batch.getId(), batch.getBatchNo(), null, null,
                "STEP2_COMPLETE", batch.getProcessStatus(), ProcessStatus.EVIDENCE_REVIEWED.getCode(),
                request.getReviewer(), "除权日截图补看完成");

        return batch;
    }

    @Transactional(rollbackFor = Exception.class)
    public RefundBatch step3UpdateDiffList(DiffUpdateRequest request) {
        RefundBatch batch = refundBatchMapper.selectById(request.getBatchId());
        if (batch == null) {
            throw new IllegalArgumentException("批次不存在");
        }

        for (DiffUpdateRequest.DiffItem item : request.getDiffItems()) {
            RefundDetail detail = refundDetailMapper.selectById(item.getDetailId());
            if (detail == null) continue;

            String oldStatus = detail.getDiffStatus();
            String oldAmount = detail.getConfirmedAmount() != null ? detail.getConfirmedAmount().toString() : null;
            String oldManual = detail.getManualChanges();

            if (item.getDiffStatus() != null) {
                detail.setDiffStatus(item.getDiffStatus());
            }
            if (item.getDiffRemark() != null) {
                detail.setDiffRemark(item.getDiffRemark());
            }
            if (item.getConfirmedAmount() != null) {
                detail.setConfirmedAmount(item.getConfirmedAmount());
            }
            if (item.getPrincipal() != null) {
                detail.setPrincipal(item.getPrincipal());
            }
            if (item.getFee() != null) {
                detail.setFee(item.getFee());
            }
            if (item.getManualChanges() != null && !item.getManualChanges().isEmpty()) {
                detail.setManualChanges(item.getManualChanges());
                detail.setManualOperator(request.getOperator());
                detail.setManualOperateAt(LocalDateTime.now());
            }

            if (!ProcessStatus.PENDING_SUPERVISOR.getCode().equals(detail.getProcessStatus())) {
                if ("resolved".equals(item.getDiffStatus()) || "normal".equals(item.getDiffStatus())) {
                    detail.setProcessStatus(ProcessStatus.DIFF_UPDATED.getCode());
                } else if ("abnormal".equals(item.getDiffStatus())) {
                    detail.setProcessStatus(ProcessStatus.ABNORMAL.getCode());
                } else {
                    detail.setProcessStatus(ProcessStatus.DIFF_UPDATED.getCode());
                }
            }

            refundDetailMapper.updateById(detail);

            StringBuilder changeLog = new StringBuilder();
            if (!Objects.equals(oldStatus, detail.getDiffStatus())) {
                changeLog.append("差异状态: ").append(oldStatus).append("->").append(detail.getDiffStatus()).append("; ");
            }
            if (!Objects.equals(oldAmount, detail.getConfirmedAmount() != null ? detail.getConfirmedAmount().toString() : null)) {
                changeLog.append("确认金额: ").append(oldAmount).append("->").append(detail.getConfirmedAmount()).append("; ");
            }
            if (!Objects.equals(oldManual, detail.getManualChanges())) {
                changeLog.append("人工改动: ").append(oldManual).append("->").append(detail.getManualChanges());
            }

            if (changeLog.length() > 0) {
                logAudit(batch.getId(), batch.getBatchNo(), detail.getId(), detail.getBizNo(),
                        "DIFF_UPDATE", null, changeLog.toString(), request.getOperator(),
                        item.getDiffRemark());
            }
        }

        batch.setProcessStatus(ProcessStatus.DIFF_UPDATED.getCode());
        batch.setCurrentStep("step3_diff");
        refundBatchMapper.updateById(batch);

        selfCheckService.runAllChecks(batch.getId(), request.getOperator());

        logAudit(batch.getId(), batch.getBatchNo(), null, null,
                "STEP3_COMPLETE", null, null, request.getOperator(),
                "差异清单更新完成，自检已执行");

        return batch;
    }

    @Transactional(rollbackFor = Exception.class)
    public void supervisorReview(SupervisorReviewRequest request) {
        RefundBatch batch = refundBatchMapper.selectById(request.getBatchId());
        if (batch == null) {
            throw new IllegalArgumentException("批次不存在");
        }
        batch.setSupervisor(request.getSupervisor());

        Map<String, List<SupervisorReviewRequest.ReviewItem>> groupMap = request.getReviewItems().stream()
                .collect(Collectors.groupingBy(SupervisorReviewRequest.ReviewItem::getSameBizNoGroup));

        for (Map.Entry<String, List<SupervisorReviewRequest.ReviewItem>> entry : groupMap.entrySet()) {
            String groupKey = entry.getKey();
            List<SupervisorReviewRequest.ReviewItem> items = entry.getValue();

            boolean allApproved = items.stream().allMatch(SupervisorReviewRequest.ReviewItem::getApproved);

            for (SupervisorReviewRequest.ReviewItem item : items) {
                RefundDetail detail = refundDetailMapper.selectById(item.getDetailId());
                if (detail == null) continue;

                String oldStatus = detail.getProcessStatus();
                detail.setSupervisorRemark(item.getSupervisorRemark());
                detail.setSupervisor(request.getSupervisor());
                detail.setSupervisorReviewedAt(LocalDateTime.now());

                if (allApproved) {
                    detail.setProcessStatus(ProcessStatus.SUPERVISOR_APPROVED.getCode());
                } else {
                    detail.setProcessStatus(ProcessStatus.ABNORMAL.getCode());
                }

                refundDetailMapper.updateById(detail);

                logAudit(batch.getId(), batch.getBatchNo(), detail.getId(), detail.getBizNo(),
                        "SUPERVISOR_REVIEW", oldStatus, detail.getProcessStatus(),
                        request.getSupervisor(), item.getSupervisorRemark());
            }
        }

        long pendingCount = refundDetailMapper.selectCount(new LambdaQueryWrapper<RefundDetail>()
                .eq(RefundDetail::getBatchId, batch.getId())
                .eq(RefundDetail::getProcessStatus, ProcessStatus.PENDING_SUPERVISOR.getCode()));

        if (pendingCount == 0) {
            batch.setProcessStatus(ProcessStatus.SUPERVISOR_APPROVED.getCode());
        }
        refundBatchMapper.updateById(batch);
    }

    public BatchReplayResultVO getReplayResult(Long batchId) {
        RefundBatch batch = refundBatchMapper.selectById(batchId);
        if (batch == null) {
            return null;
        }

        BatchReplayResultVO vo = new BatchReplayResultVO();
        vo.setBatchId(batch.getId());
        vo.setBatchNo(batch.getBatchNo());
        vo.setBatchName(batch.getBatchName());
        vo.setBatchDate(batch.getBatchDate());
        vo.setFundCode(batch.getFundCode());
        vo.setFundName(batch.getFundName());
        vo.setCustodian(batch.getCustodian());
        vo.setTotalCount(batch.getTotalCount());
        vo.setTotalAmount(batch.getTotalAmount());
        vo.setProcessStatus(batch.getProcessStatus());
        vo.setProcessStatusDesc(getProcessStatusDesc(batch.getProcessStatus()));
        vo.setCurrentStep(batch.getCurrentStep());
        vo.setOperator(batch.getOperator());
        vo.setSupervisor(batch.getSupervisor());
        vo.setRemark(batch.getRemark());
        vo.setCreatedAt(batch.getCreatedAt());

        vo.setDetails(unifiedResultService.getUnifiedDetailVOList(batchId));
        vo.setSelfCheckResults(selfCheckService.getCheckResultVOList(batchId));

        List<RefundDetail> pendingDetails = refundDetailMapper.selectPendingSupervisor(batchId);
        Set<String> pendingBizNos = pendingDetails.stream()
                .map(RefundDetail::getSameBizNoGroup)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        vo.setPendingSupervisorBizNos(new ArrayList<>(pendingBizNos));

        return vo;
    }

    public List<RefundDetail> getExportData(Long batchId) {
        return unifiedResultService.getUnifiedDetails(batchId);
    }

    public List<AuditLog> getAuditLogs(Long batchId) {
        return auditLogMapper.selectList(
                new LambdaQueryWrapper<AuditLog>()
                        .eq(AuditLog::getBatchId, batchId)
                        .orderByDesc(AuditLog::getCreatedAt)
        );
    }

    public List<RefundBatch> getBatchList() {
        return refundBatchMapper.selectList(
                new LambdaQueryWrapper<RefundBatch>()
                        .orderByDesc(RefundBatch::getCreatedAt)
        );
    }

    private void logAudit(Long batchId, String batchNo, Long detailId, String bizNo,
                          String operation, String oldValue, String newValue,
                          String operator, String remark) {
        AuditLog log = new AuditLog();
        log.setBatchId(batchId);
        log.setBatchNo(batchNo);
        log.setDetailId(detailId);
        log.setBizNo(bizNo);
        log.setOperation(operation);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setOperator(operator);
        log.setRemark(remark);
        auditLogMapper.insert(log);
    }

    private String getProcessStatusDesc(String code) {
        for (ProcessStatus status : ProcessStatus.values()) {
            if (status.getCode().equals(code)) {
                return status.getDesc();
            }
        }
        return code;
    }
}
