package com.fund.refund.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.fund.refund.entity.RefundDetail;
import com.fund.refund.enums.DetailType;
import com.fund.refund.enums.ProcessStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ExportService {

    @Autowired
    private UnifiedResultService unifiedResultService;

    public void exportDetails(Long batchId, HttpServletResponse response) throws IOException {
        List<RefundDetail> details = unifiedResultService.getUnifiedDetails(batchId);
        List<ExportRow> rows = details.stream()
                .map(this::convertToExportRow)
                .collect(Collectors.toList());

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("utf-8");
        String fileName = URLEncoder.encode("商户退款批次回放明细_" + batchId, StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        response.setHeader("Content-disposition", "attachment;filename*=utf-8''" + fileName + ".xlsx");

        EasyExcel.write(response.getOutputStream(), ExportRow.class)
                .sheet("明细")
                .doWrite(rows);
    }

    private ExportRow convertToExportRow(RefundDetail detail) {
        ExportRow row = new ExportRow();
        row.setCustodianRowNo(detail.getCustodianRowNo());
        row.setBizNo(detail.getBizNo());
        row.setSameBizNoGroup(detail.getSameBizNoGroup());
        row.setDetailType(getDetailTypeDesc(detail.getDetailType()));
        row.setMerchantName(detail.getMerchantName());
        row.setTradeDate(detail.getTradeDate() != null ? detail.getTradeDate().toString() : "");
        row.setSettlementDate(detail.getSettlementDate() != null ? detail.getSettlementDate().toString() : "");
        row.setOriginalAmount(detail.getOriginalAmount());
        row.setConfirmedAmount(detail.getConfirmedAmount());
        row.setPrincipal(detail.getPrincipal());
        row.setFee(detail.getFee());
        row.setProcessStatus(getProcessStatusDesc(detail.getProcessStatus()));
        row.setManualChanges(detail.getManualChanges());
        row.setManualOperator(detail.getManualOperator());
        row.setEvidenceStatus(detail.getEvidenceStatus());
        row.setDiffStatus(detail.getDiffStatus());
        row.setDiffRemark(detail.getDiffRemark());
        row.setSupervisorRemark(detail.getSupervisorRemark());
        row.setRemark(detail.getRemark());
        return row;
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

    public static class ExportRow {

        @ExcelProperty("托管确认页行号")
        @ColumnWidth(15)
        private Integer custodianRowNo;

        @ExcelProperty("业务号")
        @ColumnWidth(20)
        private String bizNo;

        @ExcelProperty("同一业务号分组")
        @ColumnWidth(20)
        private String sameBizNoGroup;

        @ExcelProperty("明细类型")
        @ColumnWidth(10)
        private String detailType;

        @ExcelProperty("商户名称")
        @ColumnWidth(20)
        private String merchantName;

        @ExcelProperty("交易日")
        @ColumnWidth(12)
        private String tradeDate;

        @ExcelProperty("结算日")
        @ColumnWidth(12)
        private String settlementDate;

        @ExcelProperty("原始金额")
        @ColumnWidth(12)
        private java.math.BigDecimal originalAmount;

        @ExcelProperty("确认金额")
        @ColumnWidth(12)
        private java.math.BigDecimal confirmedAmount;

        @ExcelProperty("本金")
        @ColumnWidth(12)
        private java.math.BigDecimal principal;

        @ExcelProperty("手续费")
        @ColumnWidth(12)
        private java.math.BigDecimal fee;

        @ExcelProperty("处理状态")
        @ColumnWidth(18)
        private String processStatus;

        @ExcelProperty("人工改动")
        @ColumnWidth(30)
        private String manualChanges;

        @ExcelProperty("改动人")
        @ColumnWidth(12)
        private String manualOperator;

        @ExcelProperty("证据状态")
        @ColumnWidth(12)
        private String evidenceStatus;

        @ExcelProperty("差异状态")
        @ColumnWidth(12)
        private String diffStatus;

        @ExcelProperty("差异说明")
        @ColumnWidth(30)
        private String diffRemark;

        @ExcelProperty("主管复核意见")
        @ColumnWidth(30)
        private String supervisorRemark;

        @ExcelProperty("备注")
        @ColumnWidth(30)
        private String remark;

        public Integer getCustodianRowNo() {
            return custodianRowNo;
        }

        public void setCustodianRowNo(Integer custodianRowNo) {
            this.custodianRowNo = custodianRowNo;
        }

        public String getBizNo() {
            return bizNo;
        }

        public void setBizNo(String bizNo) {
            this.bizNo = bizNo;
        }

        public String getSameBizNoGroup() {
            return sameBizNoGroup;
        }

        public void setSameBizNoGroup(String sameBizNoGroup) {
            this.sameBizNoGroup = sameBizNoGroup;
        }

        public String getDetailType() {
            return detailType;
        }

        public void setDetailType(String detailType) {
            this.detailType = detailType;
        }

        public String getMerchantName() {
            return merchantName;
        }

        public void setMerchantName(String merchantName) {
            this.merchantName = merchantName;
        }

        public String getTradeDate() {
            return tradeDate;
        }

        public void setTradeDate(String tradeDate) {
            this.tradeDate = tradeDate;
        }

        public String getSettlementDate() {
            return settlementDate;
        }

        public void setSettlementDate(String settlementDate) {
            this.settlementDate = settlementDate;
        }

        public java.math.BigDecimal getOriginalAmount() {
            return originalAmount;
        }

        public void setOriginalAmount(java.math.BigDecimal originalAmount) {
            this.originalAmount = originalAmount;
        }

        public java.math.BigDecimal getConfirmedAmount() {
            return confirmedAmount;
        }

        public void setConfirmedAmount(java.math.BigDecimal confirmedAmount) {
            this.confirmedAmount = confirmedAmount;
        }

        public java.math.BigDecimal getPrincipal() {
            return principal;
        }

        public void setPrincipal(java.math.BigDecimal principal) {
            this.principal = principal;
        }

        public java.math.BigDecimal getFee() {
            return fee;
        }

        public void setFee(java.math.BigDecimal fee) {
            this.fee = fee;
        }

        public String getProcessStatus() {
            return processStatus;
        }

        public void setProcessStatus(String processStatus) {
            this.processStatus = processStatus;
        }

        public String getManualChanges() {
            return manualChanges;
        }

        public void setManualChanges(String manualChanges) {
            this.manualChanges = manualChanges;
        }

        public String getManualOperator() {
            return manualOperator;
        }

        public void setManualOperator(String manualOperator) {
            this.manualOperator = manualOperator;
        }

        public String getEvidenceStatus() {
            return evidenceStatus;
        }

        public void setEvidenceStatus(String evidenceStatus) {
            this.evidenceStatus = evidenceStatus;
        }

        public String getDiffStatus() {
            return diffStatus;
        }

        public void setDiffStatus(String diffStatus) {
            this.diffStatus = diffStatus;
        }

        public String getDiffRemark() {
            return diffRemark;
        }

        public void setDiffRemark(String diffRemark) {
            this.diffRemark = diffRemark;
        }

        public String getSupervisorRemark() {
            return supervisorRemark;
        }

        public void setSupervisorRemark(String supervisorRemark) {
            this.supervisorRemark = supervisorRemark;
        }

        public String getRemark() {
            return remark;
        }

        public void setRemark(String remark) {
            this.remark = remark;
        }
    }
}
