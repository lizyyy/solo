package com.performancereview.dto;

import com.performancereview.enums.FileUploadStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileUploadResult {

    private Long id;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private FileUploadStatus status;
    private String parseError;
    private LocalDateTime uploadedAt;
    private Long incidentId;
}
