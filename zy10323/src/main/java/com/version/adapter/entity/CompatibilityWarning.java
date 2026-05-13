package com.version.adapter.entity;

import com.version.adapter.entity.enums.WarningLevel;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compatibility_warning")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompatibilityWarning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long clientVersionId;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private WarningLevel level;

    @Column(nullable = false)
    private String warningCode;

    @Column(nullable = false)
    private String message;

    private String affectedField;

    private String suggestion;

    @Column(nullable = false)
    private Boolean isResolved;

    private String resolvedBy;

    private LocalDateTime resolvedAt;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isResolved == null) {
            isResolved = false;
        }
    }
}
