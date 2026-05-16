package com.statuspage.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ExportResult {
    private String incidentNumber;
    private String title;
    private String contentType;
    private String content;
    private LocalDateTime generatedAt;
    private String fileName;
    private Integer announcementCount;
    private Integer confirmationCount;
}