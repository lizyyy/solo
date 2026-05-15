package com.crossborder.approval.model.entity;

import javax.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "evidence_records")
@EntityListeners(AuditingEntityListener.class)
public class EvidenceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private DataAccessApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id")
    private AccessToken accessToken;

    @Column(nullable = false)
    private String evidenceType;

    @Column(nullable = false, length = 2000)
    private String evidenceContent;

    private String evidenceHash;

    private String collectorId;

    private String collectorName;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime collectedAt;
}
