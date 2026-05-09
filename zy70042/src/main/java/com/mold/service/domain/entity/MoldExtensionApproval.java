package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "mold_extension_approval", indexes = {
    @Index(name = "idx_approval_mold", columnList = "moldId"),
    @Index(name = "idx_approval_status", columnList = "status")
})
@Data
public class MoldExtensionApproval {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String approvalNo;
    
    @Column(nullable = false)
    private Long moldId;
    
    @Column(nullable = false, length = 50)
    private String moldCode;
    
    @Column(length = 100)
    private String moldName;
    
    @Column(nullable = false)
    private Long originalStrokes;
    
    @Column(nullable = false)
    private Long originalThreshold;
    
    @Column(nullable = false)
    private Long extensionStrokes;
    
    @Column(nullable = false)
    private Long newThreshold;
    
    @Column(nullable = false, length = 500)
    private String reason;
    
    @Column(length = 200)
    private String productionLine;
    
    @Column(length = 200)
    private String productCode;
    
    @Column(nullable = false)
    private LocalDateTime requestTime;
    
    @Column(length = 100)
    private String requester;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ApprovalStatus status;
    
    @Column(length = 500)
    private String approveRemark;
    
    @Column
    private LocalDateTime approveTime;
    
    @Column(length = 100)
    private String approver;
    
    @Column
    private Long relatedTaskId;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Version
    private Long version;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ApprovalStatus.PENDING;
        }
        if (requestTime == null) {
            requestTime = LocalDateTime.now();
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum ApprovalStatus {
        PENDING,
        APPROVED,
        REJECTED,
        CANCELLED,
        EXPIRED
    }
}
