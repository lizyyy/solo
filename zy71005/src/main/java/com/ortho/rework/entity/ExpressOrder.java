package com.ortho.rework.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "express_orders")
public class ExpressOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String expressNo;

    private String expressCompany;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rework_order_id")
    private ReworkOrder reworkOrder;

    private String sender;

    private String senderPhone;

    private String receiver;

    private String receiverPhone;

    private LocalDateTime sentTime;

    private LocalDateTime receivedTime;

    private String status;

    private Boolean isLost = false;

    private String lostRemark;

    private LocalDateTime lostMarkTime;

    private String lostMarkBy;

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
