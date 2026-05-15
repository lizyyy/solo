package com.crossborder.approval.model.entity;

import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.model.enums.RegionType;
import javax.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "data_access_applications")
@EntityListeners(AuditingEntityListener.class)
public class DataAccessApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String applicationNo;

    @Column(nullable = false)
    private String applicantId;

    @Column(nullable = false)
    private String applicantName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "data_domain_id", nullable = false)
    private DataDomain dataDomain;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RegionType targetRegion;

    @Column(nullable = false, length = 2000)
    private String accessReason;

    private LocalDateTime accessStartTime;

    private LocalDateTime accessEndTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status;

    @Column(length = 1000)
    private String rejectReason;

    private Integer currentApprovalLevel = 0;

    private Boolean regionValidated = false;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
