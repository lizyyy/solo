package com.riskcontrol.graylist.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "import_batch", indexes = {
    @Index(name = "idx_batch_no", columnList = "batchNo", unique = true),
    @Index(name = "idx_import_user", columnList = "importUser")
})
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String batchNo;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private Integer totalCount = 0;

    private Integer successCount = 0;

    private Integer conflictCount = 0;

    private Integer invalidCount = 0;

    @Column(length = 64)
    private String importUser;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime importTime;

    @Column(columnDefinition = "TEXT")
    private String errorDetails;
}
