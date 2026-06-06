package com.pharmacy.coldchain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "drug_batches")
public class DrugBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String batchNo;

    @Column(nullable = false)
    private String drugCode;

    @Column(nullable = false)
    private String drugName;

    private String specification;

    private String manufacturer;

    @Column(nullable = false)
    private LocalDateTime productionDate;

    @Column(nullable = false)
    private LocalDateTime expiryDate;

    @Column(nullable = false)
    private BigDecimal minTemperature;

    @Column(nullable = false)
    private BigDecimal maxTemperature;

    private Integer quantity;

    private BigDecimal unitPrice;

    @Column(nullable = false)
    private String currentStoreCode;

    @Column(nullable = false)
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
