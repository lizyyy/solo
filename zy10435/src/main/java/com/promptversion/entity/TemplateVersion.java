package com.promptversion.entity;

import com.promptversion.enums.VersionStatus;
import lombok.Data;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "template_version")
public class TemplateVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    private String versionNumber;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(precision = 5, scale = 2)
    private BigDecimal trafficPercentage = BigDecimal.ZERO;

    @Column(nullable = false)
    private String publishedBy;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private VersionStatus status = VersionStatus.DRAFT;

    private LocalDateTime publishedAt;

    private LocalDateTime activatedAt;

    private LocalDateTime rolledBackAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @Column(length = 2000)
    private String remark;

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