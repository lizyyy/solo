package com.encryption.rotation.model.entity;

import com.encryption.rotation.model.enums.VerificationStatus;
import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "verification_records")
public class VerificationRecord {
    @Id
    @GeneratedValue(generator = "uuid")
    @org.hibernate.annotations.GenericGenerator(name = "uuid", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;

    @Column(nullable = false)
    private String batchId;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String tenantId;

    private String verifiedBy;

    @Column(nullable = false)
    private Boolean isSampled = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VerificationStatus status = VerificationStatus.NOT_STARTED;

    @Column(length = 2000)
    private String verificationResult;

    private LocalDateTime verifiedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
