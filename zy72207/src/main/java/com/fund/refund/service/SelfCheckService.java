package com.fund.refund.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fund.refund.dto.SelfCheckResultVO;
import com.fund.refund.entity.CustodianConfirmation;
import com.fund.refund.entity.RefundBatch;
import com.fund.refund.entity.RefundDetail;
import com.fund.refund.entity.SelfCheckResult;
import com.fund.refund.enums.CheckResult;
import com.fund.refund.enums.SelfCheckType;
import com.fund.refund.mapper.CustodianConfirmationMapper;
import com.fund.refund.mapper.RefundDetailMapper;
import com.fund.refund.mapper.SelfCheckResultMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SelfCheckService {

    @Autowired
    private SelfCheckResultMapper selfCheckResultMapper;

    @Autowired
    private CustodianConfirmationMapper custodianConfirmationMapper;

    @Autowired
    private RefundDetailMapper refundDetailMapper;

    public List<SelfCheckResult> runAllChecks(Long batchId, String operator) {
        List<SelfCheckResult> results = new ArrayList<>();
        results.add(checkDuplicateImport(batchId, operator));
        results.add(checkSplitBizNo(batchId, operator));
        results.add(checkRecalcAfterSupplement(batchId, operator));
        results.add(checkExportConsistency(batchId, operator));
        results.add(checkAmountBalance(batchId, operator));
        return results;
    }

    public SelfCheckResult checkDuplicateImport(Long batchId, String operator) {
        List<CustodianConfirmation> confirmations = custodianConfirmationMapper.selectList(
                new LambdaQueryWrapper<CustodianConfirmation>()
                        .eq(CustodianConfirmation::getBatchId, batchId)
        );

        Map<String, List<CustodianConfirmation>> bizNoGroups = confirmations.stream()
                .collect(Collectors.groupingBy(CustodianConfirmation::getBizNo));

        List<String> duplicateBizNos = new ArrayList<>();
        for (Map.Entry<String, List<CustodianConfirmation>> entry : bizNoGroups.entrySet()) {
            if (entry.getValue().size() > 1) {
                String rows = entry.getValue().stream()
                        .map(c -> "第" + c.getOriginalRowNo() + "行")
                        .collect(Collectors.joining(", "));
                duplicateBizNos.add(entry.getKey() + "(" + rows + ")");
            }
        }

        SelfCheckResult result = new SelfCheckResult();
        result.setBatchId(batchId);
        result.setBatchNo(getBatchNo(batchId));
        result.setCheckType(SelfCheckType.DUPLICATE_IMPORT.getCode());
        result.setOperator(operator);

        if (duplicateBizNos.isEmpty()) {
            result.setCheckResult(CheckResult.PASSED.getCode());
            result.setCheckDetail("未检测到重复导入的业务号");
        } else {
            result.setCheckResult(CheckResult.WARNING.getCode());
            result.setCheckDetail("检测到" + duplicateBizNos.size() + "个重复导入的业务号: " + String.join("; ", duplicateBizNos));
            result.setAffectedBizNos(String.join(",", duplicateBizNos));
        }

        selfCheckResultMapper.insert(result);
        return result;
    }

    public SelfCheckResult checkSplitBizNo(Long batchId, String operator) {
        List<RefundDetail> details = refundDetailMapper.selectByBatchId(batchId);

        Map<String, List<RefundDetail>> bizNoGroups = details.stream()
                .filter(d -> d.getSameBizNoGroup() != null)
                .collect(Collectors.groupingBy(RefundDetail::getSameBizNoGroup));

        List<String> splitBizNos = new ArrayList<>();
        for (Map.Entry<String, List<RefundDetail>> entry : bizNoGroups.entrySet()) {
            if (entry.getValue().size() > 1) {
                boolean hasPrincipal = entry.getValue().stream().anyMatch(d -> "principal".equals(d.getDetailType()));
                boolean hasFee = entry.getValue().stream().anyMatch(d -> "fee".equals(d.getDetailType()));
                if (hasPrincipal && hasFee) {
                    String types = entry.getValue().stream()
                            .map(d -> getTypeDesc(d.getDetailType()) + "(行" + d.getCustodianRowNo() + ")")
                            .collect(Collectors.joining(" + "));
                    splitBizNos.add(entry.getKey() + ": " + types);
                }
            }
        }

        SelfCheckResult result = new SelfCheckResult();
        result.setBatchId(batchId);
        result.setBatchNo(getBatchNo(batchId));
        result.setCheckType(SelfCheckType.SPLIT_BIZ_NO.getCode());
        result.setOperator(operator);

        if (splitBizNos.isEmpty()) {
            result.setCheckResult(CheckResult.PASSED.getCode());
            result.setCheckDetail("未检测到同一业务号拆分为手续费和本金两行的记录");
        } else {
            result.setCheckResult(CheckResult.WARNING.getCode());
            result.setCheckDetail("检测到" + splitBizNos.size() + "组拆分记录，需结算主管复核: " + String.join("; ", splitBizNos));
            result.setAffectedBizNos(String.join(",", bizNoGroups.keySet()));
        }

        selfCheckResultMapper.insert(result);
        return result;
    }

    public SelfCheckResult checkRecalcAfterSupplement(Long batchId, String operator) {
        List<RefundDetail> details = refundDetailMapper.selectByBatchId(batchId);

        List<String> recalcIssues = new ArrayList<>();
        for (RefundDetail detail : details) {
            if (detail.getManualChanges() != null && !detail.getManualChanges().isEmpty()) {
                BigDecimal expectedAmount = (detail.getPrincipal() != null ? detail.getPrincipal() : BigDecimal.ZERO)
                        .add(detail.getFee() != null ? detail.getFee() : BigDecimal.ZERO);
                if (detail.getConfirmedAmount() != null && detail.getConfirmedAmount().compareTo(expectedAmount) != 0) {
                    recalcIssues.add(detail.getBizNo() + ": 补录后金额不平，确认金额=" + detail.getConfirmedAmount()
                            + "，本金+手续费=" + expectedAmount);
                }
            }
        }

        SelfCheckResult result = new SelfCheckResult();
        result.setBatchId(batchId);
        result.setBatchNo(getBatchNo(batchId));
        result.setCheckType(SelfCheckType.RECALC_AFTER_SUPPLEMENT.getCode());
        result.setOperator(operator);

        if (recalcIssues.isEmpty()) {
            result.setCheckResult(CheckResult.PASSED.getCode());
            result.setCheckDetail("补录后重算检查通过");
        } else {
            result.setCheckResult(CheckResult.FAILED.getCode());
            result.setCheckDetail("检测到" + recalcIssues.size() + "条补录后重算异常: " + String.join("; ", recalcIssues));
            result.setAffectedBizNos(recalcIssues.stream().map(s -> s.split(":")[0]).collect(Collectors.joining(",")));
        }

        selfCheckResultMapper.insert(result);
        return result;
    }

    public SelfCheckResult checkExportConsistency(Long batchId, String operator) {
        List<RefundDetail> dbDetails = refundDetailMapper.selectByBatchId(batchId);
        List<RefundDetail> exportDetails = simulateExportData(batchId);

        List<String> inconsistencies = new ArrayList<>();
        if (dbDetails.size() != exportDetails.size()) {
            inconsistencies.add("记录数不一致: DB=" + dbDetails.size() + "条, 导出=" + exportDetails.size() + "条");
        }

        Map<Long, RefundDetail> dbMap = dbDetails.stream()
                .collect(Collectors.toMap(RefundDetail::getId, d -> d));

        for (RefundDetail export : exportDetails) {
            RefundDetail db = dbMap.get(export.getId());
            if (db == null) {
                inconsistencies.add("导出记录ID=" + export.getId() + "在DB中不存在");
                continue;
            }
            if (!Objects.equals(db.getConfirmedAmount(), export.getConfirmedAmount())
                    || !Objects.equals(db.getPrincipal(), export.getPrincipal())
                    || !Objects.equals(db.getFee(), export.getFee())
                    || !Objects.equals(db.getProcessStatus(), export.getProcessStatus())) {
                inconsistencies.add("业务号" + export.getBizNo() + "数据不一致");
            }
        }

        SelfCheckResult result = new SelfCheckResult();
        result.setBatchId(batchId);
        result.setBatchNo(getBatchNo(batchId));
        result.setCheckType(SelfCheckType.EXPORT_CONSISTENCY.getCode());
        result.setOperator(operator);

        if (inconsistencies.isEmpty()) {
            result.setCheckResult(CheckResult.PASSED.getCode());
            result.setCheckDetail("导出与DB数据一致性检查通过");
        } else {
            result.setCheckResult(CheckResult.FAILED.getCode());
            result.setCheckDetail("导出一致性检查失败: " + String.join("; ", inconsistencies));
        }

        selfCheckResultMapper.insert(result);
        return result;
    }

    public SelfCheckResult checkAmountBalance(Long batchId, String operator) {
        List<RefundDetail> details = refundDetailMapper.selectByBatchId(batchId);

        BigDecimal totalOriginal = BigDecimal.ZERO;
        BigDecimal totalConfirmed = BigDecimal.ZERO;
        BigDecimal totalPrincipal = BigDecimal.ZERO;
        BigDecimal totalFee = BigDecimal.ZERO;

        for (RefundDetail d : details) {
            totalOriginal = totalOriginal.add(d.getOriginalAmount() != null ? d.getOriginalAmount() : BigDecimal.ZERO);
            totalConfirmed = totalConfirmed.add(d.getConfirmedAmount() != null ? d.getConfirmedAmount() : BigDecimal.ZERO);
            totalPrincipal = totalPrincipal.add(d.getPrincipal() != null ? d.getPrincipal() : BigDecimal.ZERO);
            totalFee = totalFee.add(d.getFee() != null ? d.getFee() : BigDecimal.ZERO);
        }

        BigDecimal expectedConfirmed = totalPrincipal.add(totalFee);
        boolean balanceOk = totalConfirmed.compareTo(expectedConfirmed) == 0;

        SelfCheckResult result = new SelfCheckResult();
        result.setBatchId(batchId);
        result.setBatchNo(getBatchNo(batchId));
        result.setCheckType(SelfCheckType.AMOUNT_BALANCE.getCode());
        result.setOperator(operator);

        if (balanceOk) {
            result.setCheckResult(CheckResult.PASSED.getCode());
            result.setCheckDetail("金额平衡: 本金(" + totalPrincipal + ")+手续费(" + totalFee + ")=" + expectedConfirmed + "，与确认金额一致");
        } else {
            result.setCheckResult(CheckResult.WARNING.getCode());
            result.setCheckDetail("金额不平衡: 本金(" + totalPrincipal + ")+手续费(" + totalFee + ")=" + expectedConfirmed
                    + "，但确认金额=" + totalConfirmed + "，差额=" + totalConfirmed.subtract(expectedConfirmed));
        }

        selfCheckResultMapper.insert(result);
        return result;
    }

    public List<SelfCheckResult> getCheckResults(Long batchId) {
        return selfCheckResultMapper.selectList(
                new LambdaQueryWrapper<SelfCheckResult>()
                        .eq(SelfCheckResult::getBatchId, batchId)
                        .orderByDesc(SelfCheckResult::getCreatedAt)
        );
    }

    public List<SelfCheckResultVO> getCheckResultVOList(Long batchId) {
        return getCheckResults(batchId).stream()
                .map(this::convertToVO)
                .collect(Collectors.toList());
    }

    private List<RefundDetail> simulateExportData(Long batchId) {
        return refundDetailMapper.selectByBatchId(batchId);
    }

    private String getBatchNo(Long batchId) {
        return batchId != null ? "BATCH-" + batchId : "";
    }

    private String getTypeDesc(String code) {
        if ("principal".equals(code)) return "本金";
        if ("fee".equals(code)) return "手续费";
        return code;
    }

    private SelfCheckResultVO convertToVO(SelfCheckResult result) {
        SelfCheckResultVO vo = new SelfCheckResultVO();
        vo.setId(result.getId());
        vo.setCheckType(result.getCheckType());
        vo.setCheckTypeDesc(getCheckTypeDesc(result.getCheckType()));
        vo.setCheckResult(result.getCheckResult());
        vo.setCheckResultDesc(getCheckResultDesc(result.getCheckResult()));
        vo.setCheckDetail(result.getCheckDetail());
        vo.setAffectedBizNos(result.getAffectedBizNos());
        vo.setOperator(result.getOperator());
        vo.setCreatedAt(result.getCreatedAt());
        return vo;
    }

    private String getCheckTypeDesc(String code) {
        for (SelfCheckType type : SelfCheckType.values()) {
            if (type.getCode().equals(code)) {
                return type.getDesc();
            }
        }
        return code;
    }

    private String getCheckResultDesc(String code) {
        for (CheckResult result : CheckResult.values()) {
            if (result.getCode().equals(code)) {
                return result.getDesc();
            }
        }
        return code;
    }
}
