package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;

public class AllocationReceiveRequest {
    @NotNull(message = "签收人不能为空")
    private String receiver;
    private String receiptEvidence;

    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public String getReceiptEvidence() { return receiptEvidence; }
    public void setReceiptEvidence(String receiptEvidence) { this.receiptEvidence = receiptEvidence; }
}
