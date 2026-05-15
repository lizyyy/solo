package com.virusscan.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "release_certificates", indexes = {
    @Index(name = "idx_certificate_file_id", columnList = "fileId"),
    @Index(name = "idx_certificate_time", columnList = "releaseTime")
})
public class ReleaseCertificate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String certificateId;

    @Column(nullable = false, length = 64)
    private String fileId;

    @Column(nullable = false, length = 64)
    private String taskId;

    @Column(nullable = false, length = 64)
    private String quarantineId;

    @Column(nullable = false)
    private String fileName;

    @Column(length = 1000)
    private String releaseReason;

    @Column(nullable = false, length = 100)
    private String releasedBy;

    @Column(length = 500)
    private String approverSignature;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime releaseTime;
}