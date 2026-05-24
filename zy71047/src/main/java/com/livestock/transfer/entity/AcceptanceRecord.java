package com.livestock.transfer.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "acceptance_record")
public class AcceptanceRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transfer_id", nullable = false)
    private Long transferId;

    @Column(name = "acceptance_no", nullable = false, unique = true)
    private String acceptanceNo;

    @Column(name = "acceptance_time", nullable = false)
    private LocalDateTime acceptanceTime;

    @Column(name = "accepted_quantity", nullable = false)
    private Integer acceptedQuantity;

    @Column(name = "difference_quantity")
    private Integer differenceQuantity;

    @Column(name = "difference_reason")
    private String differenceReason;

    @Column(name = "status")
    private String status = "PENDING";

    @Column(name = "acceptor")
    private String acceptor;

    @Column(name = "remark")
    private String remark;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTransferId() { return transferId; }
    public void setTransferId(Long transferId) { this.transferId = transferId; }
    public String getAcceptanceNo() { return acceptanceNo; }
    public void setAcceptanceNo(String acceptanceNo) { this.acceptanceNo = acceptanceNo; }
    public LocalDateTime getAcceptanceTime() { return acceptanceTime; }
    public void setAcceptanceTime(LocalDateTime acceptanceTime) { this.acceptanceTime = acceptanceTime; }
    public Integer getAcceptedQuantity() { return acceptedQuantity; }
    public void setAcceptedQuantity(Integer acceptedQuantity) { this.acceptedQuantity = acceptedQuantity; }
    public Integer getDifferenceQuantity() { return differenceQuantity; }
    public void setDifferenceQuantity(Integer differenceQuantity) { this.differenceQuantity = differenceQuantity; }
    public String getDifferenceReason() { return differenceReason; }
    public void setDifferenceReason(String differenceReason) { this.differenceReason = differenceReason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAcceptor() { return acceptor; }
    public void setAcceptor(String acceptor) { this.acceptor = acceptor; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
