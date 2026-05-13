package com.migration.dualwrite.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MigrationField {
    @NotBlank(message = "字段名不能为空")
    private String fieldName;
    private String fieldType;
    private String oldColumnName;
    private String newColumnName;
    private boolean primaryKey;
    private boolean compareEnable = true;
    private Double precisionThreshold;
}
