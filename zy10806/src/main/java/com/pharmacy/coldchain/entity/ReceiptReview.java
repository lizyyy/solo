package com.pharmacy.coldchain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "receipt_reviews")
public class ReceiptReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reviewNo;

    @Column(nullable = false)
    private String orderNo;

    @Column(nullable = false)
    private String batchNo;

    @Column(nullable = false)
    private String inboundStoreCode;

    private BigDecimal arrivalTemperature;

    private Integer receivedQuantity;

    private Integer abnormalQuantity;

    private Boolean packagingIntact = true;

    private Boolean hasTemperatureRecord = true;

    private Boolean isProbeAbnormal = false;

    private String probeAbnormalDetail;

    private String temperatureGapDetail;

    private String reviewer;

    @Column(nullable = false)
    private LocalDateTime reviewTime;

    private String reviewResult;

    private String remark;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
