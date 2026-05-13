package com.lineage.entity;

import com.lineage.enums.LineageStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "lineage_history")
public class LineageHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lineage_id", nullable = false)
    private Long lineageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status")
    private LineageStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false)
    private LineageStatus newStatus;

    @Column(name = "change_type", nullable = false)
    private String changeType;

    @Column(name = "change_description", columnDefinition = "TEXT")
    private String changeDescription;

    @Column(name = "operator", nullable = false)
    private String operator;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
