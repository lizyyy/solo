package com.example.readonlywindow.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "conflict_records")
public class ConflictRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String conflictCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "window_id", nullable = false)
    private FreezeWindow freezeWindow;

    @Column(nullable = false)
    private String resourceType;

    @Column(nullable = false)
    private String resourceName;

    @Column(nullable = false)
    private String operationType;

    @Column(length = 4000)
    private String operationDetails;

    private String operator;

    @Column(nullable = false)
    private LocalDateTime detectedAt;

    @Column(length = 2000)
    private String resolution;

    private String resolvedBy;

    private LocalDateTime resolvedAt;

    private boolean resolved;
}
