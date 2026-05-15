package com.metadata.repair.entity;

import com.metadata.repair.enums.RepairStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "repair_history")
public class RepairHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String batchNo;

    @Enumerated(EnumType.STRING)
    private RepairStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepairStatus newStatus;

    private String operator;

    @Column(length = 2000)
    private String remark;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public RepairStatus getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(RepairStatus previousStatus) { this.previousStatus = previousStatus; }
    public RepairStatus getNewStatus() { return newStatus; }
    public void setNewStatus(RepairStatus newStatus) { this.newStatus = newStatus; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
