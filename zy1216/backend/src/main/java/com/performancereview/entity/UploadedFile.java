package com.performancereview.entity;

import com.performancereview.enums.FileUploadStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "uploaded_files")
@Data
@EqualsAndHashCode(callSuper = true)
public class UploadedFile extends BaseEntity {

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_type")
    private String fileType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private FileUploadStatus status;

    @Column(name = "parse_error", columnDefinition = "TEXT")
    private String parseError;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;
}
