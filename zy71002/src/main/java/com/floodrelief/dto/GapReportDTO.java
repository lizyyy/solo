package com.floodrelief.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GapReportDTO {
    private Long id;
    private Long shelterId;
    private String shelterName;
    private String materialType;
    private String materialName;
    private Integer requiredQuantity;
    private Integer currentQuantity;
    private Integer gapQuantity;
    private String unit;
    private String priority;
    private String reason;
    private LocalDateTime createdAt;
}
