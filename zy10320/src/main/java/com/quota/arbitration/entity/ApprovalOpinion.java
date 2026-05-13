package com.quota.arbitration.entity;

import com.quota.arbitration.enums.ApprovalResult;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approval_opinion")
public class ApprovalOpinion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long applicationId;

    @Column(nullable = false)
    private String applicationNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalResult result;

    @Column(length = 2000)
    private String opinion;

    @Column(nullable = false)
    private String approver;

    @Column(nullable = false)
    private LocalDateTime approvalTime;

    private Integer approvalLevel;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (approvalTime == null) approvalTime = LocalDateTime.now();
    }
}
