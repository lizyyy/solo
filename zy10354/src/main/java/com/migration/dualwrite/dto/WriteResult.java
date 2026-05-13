package com.migration.dualwrite.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class WriteResult {
    private Boolean success;
    private LocalDateTime writeTime;
    private Long costMs;
    private Map<String, Object> writtenData;
    private String primaryKeyValue;
    private Integer affectedRows;
    private String errorCode;
    private String errorMessage;
}
