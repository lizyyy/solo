package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import com.object.lifecycle.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "deletion_candidate")
@Getter
@Setter
public class DeletionCandidate extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String objectKey;

    @Column(nullable = false)
    private String bucketName;

    private Long objectSize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id", nullable = false)
    private LifecycleRule rule;

    private LocalDateTime lastModifiedDate;

    private LocalDateTime scheduledDeletionDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.PENDING;

    private LocalDateTime deletionTime;

    private String errorMessage;

    @Column(nullable = false)
    private Boolean hasException = false;

    @Version
    private Long version;
}
