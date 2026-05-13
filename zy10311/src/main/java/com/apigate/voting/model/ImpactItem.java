package com.apigate.voting.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "impact_items")
public class ImpactItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proposal_id", nullable = false)
    private ChangeProposal proposal;

    @Column(nullable = false)
    private String impactScope;

    @Column(nullable = false)
    private String impactDescription;

    private String affectedService;

    private String affectedEndpoint;

    private String compatibilityLevel;

    @Column(nullable = false)
    private Boolean isNotified = false;

    private LocalDateTime notifiedAt;

    @Column(nullable = false)
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
