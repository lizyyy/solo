package com.privacy.export.entity;

import com.privacy.export.enums.ExportRequestStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "export_request")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExportRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String requestNo;

    @Column(nullable = false)
    private String userId;

    private String userName;

    private String userEmail;

    private String userPhone;

    @Column(nullable = false)
    private String consentVersionCode;

    @Column(length = 500)
    private String consentSignature;

    private LocalDateTime consentTimestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExportRequestStatus status;

    @Column(length = 2000)
    private String statusReason;

    @Column(length = 5000)
    private String originalInput;

    @Column(length = 5000)
    private String processingConclusion;

    private String assignedTo;

    private LocalDateTime statusChangedAt;

    private String statusChangedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @OneToMany(mappedBy = "exportRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExportScopeItem> scopeItems = new ArrayList<>();

    @OneToMany(mappedBy = "exportRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ApprovalNode> approvalNodes = new ArrayList<>();

    @OneToOne(mappedBy = "exportRequest", cascade = CascadeType.ALL)
    private PackagingTask packagingTask;

    @OneToOne(mappedBy = "exportRequest", cascade = CascadeType.ALL)
    private DeliveryRecord deliveryRecord;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = ExportRequestStatus.DRAFT;
        }
        statusChangedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
