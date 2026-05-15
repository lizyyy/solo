package com.apidiff.entity;

import com.apidiff.entity.enums.ConfirmationStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "api_diff_records", indexes = {
    @Index(name = "idx_request_hash", columnList = "requestHash"),
    @Index(name = "idx_api_path", columnList = "apiPath"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiDiffRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String apiPath;

    @Column(nullable = false, length = 10)
    private String httpMethod;

    @Column(columnDefinition = "TEXT")
    private String requestBody;

    @Column(columnDefinition = "TEXT")
    private String requestHeaders;

    @Column(length = 500)
    private String queryParams;

    @Column(nullable = false, length = 64, unique = true)
    private String requestHash;

    @Column(nullable = false, length = 100)
    private String versionA;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String responseA;

    private Integer statusCodeA;

    private Long responseTimeA;

    @Column(nullable = false, length = 100)
    private String versionB;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String responseB;

    private Integer statusCodeB;

    private Long responseTimeB;

    @Column(nullable = false)
    private Boolean hasDifferences;

    private Integer diffCount;

    @Column(length = 1000)
    private String diffSummary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ConfirmationStatus status;

    @Column(length = 2000)
    private String attributionNote;

    @Column(length = 500)
    private String attributedBy;

    private LocalDateTime attributedAt;

    @Column(length = 500)
    private String confirmedBy;

    private LocalDateTime confirmedAt;

    @Column(length = 1000)
    private String tags;

    @OneToMany(mappedBy = "diffRecord", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<DiffField> diffFields = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(length = 500)
    private String createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ConfirmationStatus.PENDING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addDiffField(DiffField diffField) {
        diffFields.add(diffField);
        diffField.setDiffRecord(this);
    }
}
