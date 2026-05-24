package com.hazardous.waste.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transfer_form")
public class TransferForm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String formNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double totalWeight;

    private String transporter;

    private String transportPlateNo;

    private String driver;

    private String receiver;

    private LocalDateTime receiveTime;

    private String receiverSignature;

    private LocalDateTime transferTime;

    @Column(nullable = false)
    private Boolean isUsed;

    @Column(nullable = false)
    private Boolean isSigned;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_form_id")
    private List<WasteRecord> wasteRecords = new ArrayList<>();

    @Column(length = 2000)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isUsed == null) isUsed = false;
        if (isSigned == null) isSigned = false;
        if (totalWeight == null) totalWeight = 0.0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFormNo() { return formNo; }
    public void setFormNo(String formNo) { this.formNo = formNo; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Double getTotalWeight() { return totalWeight; }
    public void setTotalWeight(Double totalWeight) { this.totalWeight = totalWeight; }
    public String getTransporter() { return transporter; }
    public void setTransporter(String transporter) { this.transporter = transporter; }
    public String getTransportPlateNo() { return transportPlateNo; }
    public void setTransportPlateNo(String transportPlateNo) { this.transportPlateNo = transportPlateNo; }
    public String getDriver() { return driver; }
    public void setDriver(String driver) { this.driver = driver; }
    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public LocalDateTime getReceiveTime() { return receiveTime; }
    public void setReceiveTime(LocalDateTime receiveTime) { this.receiveTime = receiveTime; }
    public String getReceiverSignature() { return receiverSignature; }
    public void setReceiverSignature(String receiverSignature) { this.receiverSignature = receiverSignature; }
    public LocalDateTime getTransferTime() { return transferTime; }
    public void setTransferTime(LocalDateTime transferTime) { this.transferTime = transferTime; }
    public Boolean getIsUsed() { return isUsed; }
    public void setIsUsed(Boolean isUsed) { this.isUsed = isUsed; }
    public Boolean getIsSigned() { return isSigned; }
    public void setIsSigned(Boolean isSigned) { this.isSigned = isSigned; }
    public List<WasteRecord> getWasteRecords() { return wasteRecords; }
    public void setWasteRecords(List<WasteRecord> wasteRecords) { this.wasteRecords = wasteRecords; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
