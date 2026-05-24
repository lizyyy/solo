package com.hazardous.waste.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "disposal_report")
public class DisposalReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double totalWeight;

    @Column(nullable = false)
    private Integer wasteCount;

    private String transferFormNo;

    private String disposalCompany;

    private String disposalMethod;

    private LocalDateTime disposalTime;

    private String disposalResult;

    @Column(length = 3000)
    private String disposalReason;

    @Column(length = 3000)
    private String checkDetail;

    private String reporter;

    private String approver;

    private LocalDateTime approveTime;

    @Column(nullable = false)
    private Boolean isApproved;

    @Column(length = 2000)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isApproved == null) isApproved = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReportNo() { return reportNo; }
    public void setReportNo(String reportNo) { this.reportNo = reportNo; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Double getTotalWeight() { return totalWeight; }
    public void setTotalWeight(Double totalWeight) { this.totalWeight = totalWeight; }
    public Integer getWasteCount() { return wasteCount; }
    public void setWasteCount(Integer wasteCount) { this.wasteCount = wasteCount; }
    public String getTransferFormNo() { return transferFormNo; }
    public void setTransferFormNo(String transferFormNo) { this.transferFormNo = transferFormNo; }
    public String getDisposalCompany() { return disposalCompany; }
    public void setDisposalCompany(String disposalCompany) { this.disposalCompany = disposalCompany; }
    public String getDisposalMethod() { return disposalMethod; }
    public void setDisposalMethod(String disposalMethod) { this.disposalMethod = disposalMethod; }
    public LocalDateTime getDisposalTime() { return disposalTime; }
    public void setDisposalTime(LocalDateTime disposalTime) { this.disposalTime = disposalTime; }
    public String getDisposalResult() { return disposalResult; }
    public void setDisposalResult(String disposalResult) { this.disposalResult = disposalResult; }
    public String getDisposalReason() { return disposalReason; }
    public void setDisposalReason(String disposalReason) { this.disposalReason = disposalReason; }
    public String getCheckDetail() { return checkDetail; }
    public void setCheckDetail(String checkDetail) { this.checkDetail = checkDetail; }
    public String getReporter() { return reporter; }
    public void setReporter(String reporter) { this.reporter = reporter; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public LocalDateTime getApproveTime() { return approveTime; }
    public void setApproveTime(LocalDateTime approveTime) { this.approveTime = approveTime; }
    public Boolean getIsApproved() { return isApproved; }
    public void setIsApproved(Boolean isApproved) { this.isApproved = isApproved; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
