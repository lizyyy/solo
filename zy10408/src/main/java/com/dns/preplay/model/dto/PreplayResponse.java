package com.dns.preplay.model.dto;

import com.dns.preplay.model.enums.PreplayStatus;
import com.dns.preplay.model.enums.RiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreplayResponse {

    private Long id;
    private String preplayName;
    private String description;
    private PreplayStatus status;
    private RiskLevel overallRiskLevel;
    private String conclusion;
    private String rollbackNotes;
    private String createdBy;
    private String errorDetails;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
    private List<DnsRecordDTO> records;
    private List<DiffResultDTO> diffResults;
}
