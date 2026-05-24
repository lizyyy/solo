package com.floodrelief.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "allocation_record")
public class AllocationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String allocationNo;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private Long materialBatchId;

    @Column(nullable = false)
    private Integer quantity;

    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AllocationStatus status;

    private String applicant;

    private String approver;

    private String dispatcher;

    private String receiver;

    private LocalDateTime dispatchedAt;

    private LocalDateTime receivedAt;

    @Column(length = 1000)
    private String receiptEvidence;

    @Column(length = 1000)
    private String rejectReason;

    @Column(length = 1000)
    private String withdrawReason;

    private Boolean manualCorrection = false;

    private String correctedBy;

    private String previousStatus;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum AllocationStatus {
        PENDING,
        APPROVED,
        DISPATCHED,
        RECEIVED,
        REJECTED,
        WITHDRAWN,
        CANCELLED
    }
}
