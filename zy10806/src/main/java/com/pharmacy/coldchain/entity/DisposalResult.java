package com.pharmacy.coldchain.entity;

import com.pharmacy.coldchain.entity.enums.DisposalType;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "disposal_results")
public class DisposalResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String disposalNo;

    @Column(nullable = false)
    private String orderNo;

    @Column(nullable = false)
    private String batchNo;

    @Column(nullable = false)
    private String storeCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DisposalType disposalType;

    private Integer disposedQuantity;

    private BigDecimal lossAmount;

    private String disposer;

    @Column(nullable = false)
    private LocalDateTime disposalTime;

    private String witness;

    private String disposalResult;

    private String remark;

    private String attachmentUrl;

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
