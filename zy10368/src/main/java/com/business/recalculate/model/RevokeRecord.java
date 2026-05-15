package com.business.recalculate.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "revoke_record")
public class RevokeRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long batchId;

    @Column(nullable = false)
    private String batchNo;

    @Column(length = 2000)
    private String revokeReason;

    private String revokedBy;

    private LocalDateTime revokedAt;

    private Integer recoveredEventCount;

    @Column(length = 4000)
    private String recoveryDetail;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
