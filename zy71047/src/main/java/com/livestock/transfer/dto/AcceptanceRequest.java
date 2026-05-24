package com.livestock.transfer.dto;

import java.time.LocalDateTime;
import java.util.List;

public class AcceptanceRequest {
    private String transferNo;
    private LocalDateTime acceptanceTime;
    private List<String> acceptedTags;
    private String acceptor;
    private String remark;

    public String getTransferNo() { return transferNo; }
    public void setTransferNo(String transferNo) { this.transferNo = transferNo; }
    public LocalDateTime getAcceptanceTime() { return acceptanceTime; }
    public void setAcceptanceTime(LocalDateTime acceptanceTime) { this.acceptanceTime = acceptanceTime; }
    public List<String> getAcceptedTags() { return acceptedTags; }
    public void setAcceptedTags(List<String> acceptedTags) { this.acceptedTags = acceptedTags; }
    public String getAcceptor() { return acceptor; }
    public void setAcceptor(String acceptor) { this.acceptor = acceptor; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
