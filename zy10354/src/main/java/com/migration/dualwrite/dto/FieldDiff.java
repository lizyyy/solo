package com.migration.dualwrite.dto;

import com.migration.dualwrite.enums.DiffType;
import lombok.Data;

@Data
public class FieldDiff {
    private String fieldName;
    private DiffType diffType;
    private Object oldValue;
    private Object newValue;
    private String oldValueType;
    private String newValueType;
    private String description;
}
