package com.version.adapter.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_timeline")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String entityType;

    @Column(nullable = false)
    private Long entityId;

    @Column(nullable = false)
    private String action;

    @Column(columnDefinition = "TEXT")
    private String previousState;

    @Column(columnDefinition = "TEXT")
    private String newState;

    @Column(nullable = false)
    private String performedBy;

    @Column(nullable = false)
    private LocalDateTime performedAt;

    private String remarks;

    @PrePersist
    protected void onCreate() {
        if (performedAt == null) {
            performedAt = LocalDateTime.now();
        }
    }
}
