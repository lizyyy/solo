package com.crossborder.approval.model.entity;

import com.crossborder.approval.model.enums.ApprovalResult;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approval_chains")
@EntityListeners(AuditingEntityListener.class)
public class ApprovalChain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private DataAccessApplication application;

    @Column(nullable = false)
    private Integer approvalLevel;

    @Column(nullable = false)
    private String approverId;

    @Column(nullable = false)
    private String approverName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalResult result;

    @Column(length = 1000)
    private String comment;

    private LocalDateTime approvedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
