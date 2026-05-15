package com.metadata.repair.entity;

import com.metadata.repair.enums.PermissionLevel;
import com.metadata.repair.enums.SourceSystem;
import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "attachments")
public class Attachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String fileId;

    private String fileName;

    private String fileType;

    private Long fileSize;

    private String businessNo;

    @Enumerated(EnumType.STRING)
    private SourceSystem sourceSystem;

    @Enumerated(EnumType.STRING)
    private PermissionLevel permissionLevel;

    private String uploader;

    private LocalDateTime uploadTime;

    private String fileHash;

    private String storagePath;

    private Boolean metadataComplete = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

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
