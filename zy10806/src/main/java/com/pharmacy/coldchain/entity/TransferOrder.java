package com.pharmacy.coldchain.entity;

import com.pharmacy.coldchain.entity.enums.TransferStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "transfer_orders")
public class TransferOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String orderNo;

    @Column(nullable = false)
    private String outboundStoreCode;

    @Column(nullable = false)
    private String inboundStoreCode;

    @Column(nullable = false)
    private String batchNo;

    @Column(nullable = false)
    private Integer quantity;

    private String cabinetCode;

    private LocalDateTime outboundTime;

    private LocalDateTime expectedArrivalTime;

    private LocalDateTime actualArrivalTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferStatus status;

    private String remark;

    private String operator;

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
