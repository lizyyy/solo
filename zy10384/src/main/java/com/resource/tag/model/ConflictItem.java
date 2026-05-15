package com.resource.tag.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "conflict_items")
public class ConflictItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String tagKey;

    @Column(columnDefinition = "TEXT")
    private String conflictingValues;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ConflictResolution resolution;

    private String resolvedBy;

    private String resolvedValue;

    private LocalDateTime resolvedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum ConflictResolution {
        PENDING,
        PARENT_WINS,
        CHILD_WINS,
        MANUAL_OVERRIDE,
        SKIP
    }
}
