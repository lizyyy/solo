package com.privacy.export.entity;

import com.privacy.export.enums.ApprovalNodeType;
import com.privacy.export.enums.ExportRequestStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approval_node")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_request_id", nullable = false)
    private ExportRequest exportRequest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalNodeType nodeType;

    @Column(nullable = false)
    private String nodeName;

    private Integer sequence;

    @Enumerated(EnumType.STRING)
    private ExportRequestStatus targetStatus;

    @Enumerated(EnumType.STRING)
    private ExportRequestStatus rejectStatus;

    @Column(length = 2000)
    private String approvalCriteria;

    private String assignedRole;

    private String assignedUser;

    @Column(nullable = false)
    private Boolean isCompleted;

    private Boolean isApproved;

    @Column(length = 5000)
    private String approvalComments;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String completedBy;

    @Column(length = 5000)
    private String originalInputSnapshot;

    @Column(length = 5000)
    private String processingResult;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isCompleted == null) {
            isCompleted = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
