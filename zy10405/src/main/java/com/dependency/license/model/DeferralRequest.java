package com.dependency.license.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "deferral_requests")
public class DeferralRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_id", nullable = false)
    private RepositoryApproval approval;

    @Column(nullable = false)
    private LocalDateTime requestedDate;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String requestedBy;

    @Column(length = 1000)
    private String justification;

    private LocalDateTime reviewDate;

    private String reviewer;

    private Boolean approved;

    @Column(length = 1000)
    private String reviewComment;

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