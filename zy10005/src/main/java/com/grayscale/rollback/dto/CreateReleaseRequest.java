package com.grayscale.rollback.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateReleaseRequest {
    
    private String serviceName;
    private String currentVersion;
    private String targetVersion;
    private Integer totalInstances;
    private String metadata;
    private String operator;
}
