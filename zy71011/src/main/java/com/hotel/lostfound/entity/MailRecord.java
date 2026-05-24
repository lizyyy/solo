package com.hotel.lostfound.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "mail_records")
public class MailRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false)
    private LostItem lostItem;

    @Column(nullable = false, length = 100)
    private String receiverName;

    @Column(nullable = false, length = 50)
    private String receiverPhone;

    @Column(nullable = false, length = 500)
    private String receiverAddress;

    @Column(nullable = false, length = 100)
    private String courierCompany;

    @Column(nullable = false, length = 50)
    private String trackingNumber;

    @Column(precision = 8, scale = 2)
    private BigDecimal postage;

    private boolean postagePaid;

    @Column(length = 500)
    private String itemProofImageUrls;

    @Column(length = 500)
    private String shippingProofImageUrls;

    @Column(nullable = false, length = 50)
    private String handledBy;

    @Column(nullable = false)
    private LocalDateTime shippedAt;

    private LocalDateTime deliveredAt;

    private boolean signedReceived;

    @Column(length = 500)
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;
}
