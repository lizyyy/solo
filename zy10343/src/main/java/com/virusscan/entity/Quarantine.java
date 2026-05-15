package com.virusscan.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "quarantines", indexes = {
    @Index(name = "idx_quarantine_file_id", columnList = "fileId"),
    @Index(name = "idx_quarantine_time", columnList = "quarantineTime")
})
public class Quarantine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String quarantineId;

    @Column(nullable = false, length = 64)
    private String fileId;

    @Column(nullable = false, length = 64)
    private String taskId;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false, length = 500)
    private String quarantinePath;

    @Column(length = 1000)
    private String virusReason;

    @Column(length = 100)
    private String quarantinedBy;

    private Boolean isReleased = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime quarantineTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}