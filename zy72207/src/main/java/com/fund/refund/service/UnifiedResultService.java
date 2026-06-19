package com.fund.refund.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fund.refund.dto.RefundDetailVO;
import com.fund.refund.entity.CustodianConfirmation;
import com.fund.refund.entity.ExDividendEvidence;
import com.fund.refund.entity.RefundDetail;
import com.fund.refund.enums.DetailType;
import com.fund.refund.enums.ProcessStatus;
import com.fund.refund.mapper.CustodianConfirmationMapper;
import com.fund.refund.mapper.ExDividendEvidenceMapper;
import com.fund.refund.mapper.RefundDetailMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UnifiedResultService {

    @Autowired
    private RefundDetailMapper refundDetailMapper;

    @Autowired
    private CustodianConfirmationMapper custodianConfirmationMapper;

    @Autowired
    private ExDividendEvidenceMapper exDividendEvidenceMapper;

    public List<RefundDetail> getUnifiedDetails(Long batchId) {
        return refundDetailMapper.selectByBatchId(batchId);
    }

    public List<RefundDetailVO> getUnifiedDetailVOList(Long batchId) {
        List<RefundDetail> details = getUnifiedDetails(batchId);
        Map<String, CustodianConfirmation> custodianMap = getCustodianMap(batchId);
        Map<String, ExDividendEvidence> evidenceMap = getEvidenceMap(batchId);

        return details.stream()
                .map(d -> convertToVO(
                        d,
                        custodianMap.get(buildCustodianKey(d.getBizNo(), d.getCustodianRowNo())),
                        evidenceMap.get(d.getBizNo())
                ))
                .collect(Collectors.toList());
    }

    public RefundDetailVO getUnifiedDetailVO(Long detailId) {
        RefundDetail detail = refundDetailMapper.selectById(detailId);
        if (detail == null) {
            return null;
        }
        CustodianConfirmation custodian = custodianConfirmationMapper.selectOne(
                new LambdaQueryWrapper<CustodianConfirmation>()
                        .eq(CustodianConfirmation::getBatchId, detail.getBatchId())
                        .eq(CustodianConfirmation::getBizNo, detail.getBizNo())
                        .eq(CustodianConfirmation::getOriginalRowNo, detail.getCustodianRowNo())
                        .last("LIMIT 1")
        );
        ExDividendEvidence evidence = exDividendEvidenceMapper.selectOne(
                new LambdaQueryWrapper<ExDividendEvidence>()
                        .eq(ExDividendEvidence::getBatchId, detail.getBatchId())
                        .eq(ExDividendEvidence::getBizNo, detail.getBizNo())
                        .last("LIMIT 1")
        );
        return convertToVO(detail, custodian, evidence);
    }

    private String buildCustodianKey(String bizNo, Integer rowNo) {
        return (bizNo == null ? "" : bizNo) + ":" + (rowNo == null ? "" : rowNo);
    }

    private RefundDetailVO convertToVO(RefundDetail detail, CustodianConfirmation custodian, ExDividendEvidence evidence) {
        RefundDetailVO vo = new RefundDetailVO();
        vo.setId(detail.getId());
        vo.setBatchNo(detail.getBatchNo());
        vo.setBizNo(detail.getBizNo());
        vo.setSameBizNoGroup(detail.getSameBizNoGroup());
        vo.setDetailType(detail.getDetailType());
        vo.setDetailTypeDesc(getDetailTypeDesc(detail.getDetailType()));
        vo.setCustodianRowNo(detail.getCustodianRowNo());
        vo.setMerchantNo(detail.getMerchantNo());
        vo.setMerchantName(detail.getMerchantName());
        vo.setTradeDate(detail.getTradeDate());
        vo.setSettlementDate(detail.getSettlementDate());
        vo.setOriginalAmount(detail.getOriginalAmount());
        vo.setConfirmedAmount(detail.getConfirmedAmount());
        vo.setPrincipal(detail.getPrincipal());
        vo.setFee(detail.getFee());
        vo.setCurrency(detail.getCurrency());
        vo.setProcessStatus(detail.getProcessStatus());
        vo.setProcessStatusDesc(getProcessStatusDesc(detail.getProcessStatus()));
        vo.setManualChanges(detail.getManualChanges());
        vo.setManualOperator(detail.getManualOperator());
        vo.setManualOperateAt(detail.getManualOperateAt());
        vo.setEvidenceStatus(detail.getEvidenceStatus());
        vo.setDiffStatus(detail.getDiffStatus());
        vo.setDiffRemark(detail.getDiffRemark());
        vo.setSupervisorRemark(detail.getSupervisorRemark());
        vo.setSupervisor(detail.getSupervisor());
        vo.setSupervisorReviewedAt(detail.getSupervisorReviewedAt());
        vo.setRemark(detail.getRemark());

        if (custodian != null) {
            vo.setOriginalEvidenceContent("托管确认页第" + custodian.getOriginalRowNo() + "行: " + custodian.getRawContent());
        }
        if (evidence != null) {
            vo.setExDividendEvidenceContent("除权日" + evidence.getExDividendDate() + ": " + evidence.getEvidenceContent());
        }
        return vo;
    }

    private String getDetailTypeDesc(String code) {
        for (DetailType type : DetailType.values()) {
            if (type.getCode().equals(code)) {
                return type.getDesc();
            }
        }
        return code;
    }

    private String getProcessStatusDesc(String code) {
        for (ProcessStatus status : ProcessStatus.values()) {
            if (status.getCode().equals(code)) {
                return status.getDesc();
            }
        }
        return code;
    }

    private Map<String, CustodianConfirmation> getCustodianMap(Long batchId) {
        List<CustodianConfirmation> list = custodianConfirmationMapper.selectList(
                new LambdaQueryWrapper<CustodianConfirmation>()
                        .eq(CustodianConfirmation::getBatchId, batchId)
        );
        return list.stream()
                .collect(Collectors.toMap(CustodianConfirmation::getBizNo, c -> c, (v1, v2) -> v1));
    }

    private Map<String, ExDividendEvidence> getEvidenceMap(Long batchId) {
        List<ExDividendEvidence> list = exDividendEvidenceMapper.selectList(
                new LambdaQueryWrapper<ExDividendEvidence>()
                        .eq(ExDividendEvidence::getBatchId, batchId)
        );
        return list.stream()
                .collect(Collectors.toMap(ExDividendEvidence::getBizNo, e -> e, (v1, v2) -> v1));
    }
}
