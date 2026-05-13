package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "retention_exception")
@Getter
@Setter
public class RetentionException extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String objectKey;

    @Column(nullable = false)
    private String bucketName;

    @Column(nullable = false)
    private String reason;

    private String reasonCode;

    @Column(nullable = false)
    private LocalDateTime effectiveFrom;

    @Column(nullable = false)
    private LocalDateTime effectiveTo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    private LifecycleRule rule;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Version
    private Long version;
}
