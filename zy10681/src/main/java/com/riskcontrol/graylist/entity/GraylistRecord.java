package com.riskcontrol.graylist.entity;

import com.riskcontrol.graylist.enums.GraylistStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "graylist_record", indexes = {
    @Index(name = "idx_customer_id", columnList = "customerId"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_expire_time", columnList = "expireTime"),
    @Index(name = "idx_batch_no", columnList = "batchNo")
})
public class GraylistRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String customerId;

    @Column(nullable = false, length = 128)
    private String customerName;

    @Column(nullable = false, length = 512)
    private String listReason;

    @Column(nullable = false)
    private LocalDateTime expireTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private GraylistStatus status;

    @Column(length = 1024)
    private String reviewRemark;

    @Column(length = 64)
    private String reviewer;

    private LocalDateTime reviewTime;

    @Column(length = 64)
    private String batchNo;

    private Boolean isExpiredNotReviewed = false;

    @Column(length = 512)
    private String nextStepHint;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(length = 64)
    private String createdBy;

    @Column(length = 64)
    private String updatedBy;
}
