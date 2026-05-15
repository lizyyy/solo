package com.devicecommand.dto;

import javax.validation.constraints.NotBlank;

public class ConfirmCommandRequest {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotBlank(message = "确认结果不能为空")
    private String confirmResult;

    private String resultCode;

    private String resultMessage;

    private String resultDetail;

    private String confirmSource;

    private String handler;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getConfirmResult() { return confirmResult; }
    public void setConfirmResult(String confirmResult) { this.confirmResult = confirmResult; }
    public String getResultCode() { return resultCode; }
    public void setResultCode(String resultCode) { this.resultCode = resultCode; }
    public String getResultMessage() { return resultMessage; }
    public void setResultMessage(String resultMessage) { this.resultMessage = resultMessage; }
    public String getResultDetail() { return resultDetail; }
    public void setResultDetail(String resultDetail) { this.resultDetail = resultDetail; }
    public String getConfirmSource() { return confirmSource; }
    public void setConfirmSource(String confirmSource) { this.confirmSource = confirmSource; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
}
