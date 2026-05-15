package com.identity.verification.model;

import com.identity.verification.model.enums.TrustLevel;
import com.identity.verification.model.enums.VerificationStatus;
import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "verification_task")
public class VerificationTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true, length = 100)
    private String requestId;

    @Column(name = "business_type", length = 50)
    private String businessType;

    @Column(length = 200)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private VerificationStatus status;

    @Column(name = "trust_score")
    private Integer trustScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "trust_level", length = 20)
    private TrustLevel trustLevel;

    @Column(name = "conflict_count")
    private Integer conflictCount;

    @Column(name = "final_identity", columnDefinition = "TEXT")
    private String finalIdentity;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = VerificationStatus.CREATED;
        if (conflictCount == null) conflictCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
