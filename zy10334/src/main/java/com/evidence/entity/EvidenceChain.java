package com.evidence.entity;

import com.evidence.enums.EvidenceStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "evidence_chain", indexes = {
    @Index(name = "idx_business_no", columnList = "businessNo"),
    @Index(name = "idx_request_id", columnList = "requestId", unique = true),
    @Index(name = "idx_status", columnList = "status")
})
public class EvidenceChain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String businessNo;

    @Column(nullable = false, length = 128, unique = true)
    private String requestId;

    @Column(length = 64)
    private String sourceSystem;

    @Column(length = 64)
    private String targetSystem;

    @Column(length = 128)
    private String apiName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EvidenceStatus status;

    @Column(columnDefinition = "TEXT")
    private String requestBody;

    @Column(columnDefinition = "TEXT")
    private String responseBody;

    @Column(length = 512)
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String evidenceSummary;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(length = 64)
    private String createdBy;

    @Column(length = 64)
    private String updatedBy;

    @Version
    private Integer version;

    @OneToMany(mappedBy = "evidenceChain", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("actionTime ASC")
    @Builder.Default
    private List<EvidenceAction> actions = new ArrayList<>();

    @OneToMany(mappedBy = "evidenceChain", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<EvidenceRemark> remarks = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = EvidenceStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addAction(EvidenceAction action) {
        actions.add(action);
        action.setEvidenceChain(this);
    }

    public void addRemark(EvidenceRemark remark) {
        remarks.add(remark);
        remark.setEvidenceChain(this);
    }
}
