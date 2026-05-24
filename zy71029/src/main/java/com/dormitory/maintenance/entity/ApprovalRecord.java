package com.dormitory.maintenance.entity;

import com.dormitory.maintenance.enums.ApprovalResult;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "approval_record")
public class ApprovalRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = false)
    private MaintenanceOrder order;

    @Column(nullable = false)
    private String orderNo;

    private Integer approvalLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalResult result;

    @Column(nullable = false)
    private String approver;

    private LocalDateTime approvalTime;

    @Column(length = 2000)
    private String approvalRemark;

    @Column(length = 2000)
    private String handlingInstruction;

    private LocalDateTime originalStartTime;

    private LocalDateTime originalEndTime;

    private LocalDateTime adjustedStartTime;

    private LocalDateTime adjustedEndTime;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MaintenanceOrder getOrder() { return order; }
    public void setOrder(MaintenanceOrder order) { this.order = order; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Integer getApprovalLevel() { return approvalLevel; }
    public void setApprovalLevel(Integer approvalLevel) { this.approvalLevel = approvalLevel; }
    public ApprovalResult getResult() { return result; }
    public void setResult(ApprovalResult result) { this.result = result; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public LocalDateTime getApprovalTime() { return approvalTime; }
    public void setApprovalTime(LocalDateTime approvalTime) { this.approvalTime = approvalTime; }
    public String getApprovalRemark() { return approvalRemark; }
    public void setApprovalRemark(String approvalRemark) { this.approvalRemark = approvalRemark; }
    public String getHandlingInstruction() { return handlingInstruction; }
    public void setHandlingInstruction(String handlingInstruction) { this.handlingInstruction = handlingInstruction; }
    public LocalDateTime getOriginalStartTime() { return originalStartTime; }
    public void setOriginalStartTime(LocalDateTime originalStartTime) { this.originalStartTime = originalStartTime; }
    public LocalDateTime getOriginalEndTime() { return originalEndTime; }
    public void setOriginalEndTime(LocalDateTime originalEndTime) { this.originalEndTime = originalEndTime; }
    public LocalDateTime getAdjustedStartTime() { return adjustedStartTime; }
    public void setAdjustedStartTime(LocalDateTime adjustedStartTime) { this.adjustedStartTime = adjustedStartTime; }
    public LocalDateTime getAdjustedEndTime() { return adjustedEndTime; }
    public void setAdjustedEndTime(LocalDateTime adjustedEndTime) { this.adjustedEndTime = adjustedEndTime; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
