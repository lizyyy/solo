package com.ortho.rework.entity;

import com.ortho.rework.enums.ReworkStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rework_orders")
public class ReworkOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String reworkNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private ImpressionBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReworkStatus status;

    @Column(length = 2000)
    private String reworkReason;

    @Column(length = 2000)
    private String technicianNote;

    private LocalDateTime technicianNoteTime;

    private String technicianName;

    @Column(length = 2000)
    private String doctorNote;

    private String doctorConfirmation;

    private LocalDateTime doctorConfirmationTime;

    private String doctorName;

    private LocalDateTime receivedTime;

    private String receivedBy;

    private LocalDateTime inspectionTime;

    private String inspectionResult;

    private String inspectionRemark;

    private String inspectionBy;

    private LocalDateTime processingStartTime;

    private String processingBy;

    private LocalDateTime reviewTime;

    private String reviewResult;

    private String reviewBy;

    private LocalDateTime shippedTime;

    private String shippedBy;

    private LocalDateTime closedTime;

    private String closedBy;

    private String closeReason;

    private Boolean isDuplicate = false;

    private String duplicateRemark;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
