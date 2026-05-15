package com.virusscan.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "upload_files", indexes = {
    @Index(name = "idx_file_hash", columnList = "fileHash"),
    @Index(name = "idx_upload_time", columnList = "uploadTime")
})
public class UploadFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String fileId;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false, length = 64)
    private String fileHash;

    @Column(length = 100)
    private String contentType;

    @Column(length = 500)
    private String filePath;

    @Column(length = 100)
    private String uploadedBy;

    @Column(length = 50)
    private String sourceSystem;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}