package com.metadata.repair.entity;

import com.metadata.repair.enums.RepairStatus;
import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "repair_batches")
public class RepairBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    private String batchName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepairStatus status;

    private String operator;

    private String description;

    private Integer totalCount = 0;

    private Integer successCount = 0;

    private Integer failedCount = 0;

    private Integer skippedCount = 0;

    @ElementCollection
    @CollectionTable(name = "batch_attachments", joinColumns = @JoinColumn(name = "batch_id"))
    @Column(name = "file_id")
    private List<String> attachmentFileIds = new ArrayList<>();

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
