package com.apidiff.dto;

import com.apidiff.entity.enums.DiffType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DiffFieldDTO {

    private Long id;
    private String fieldPath;
    private DiffType diffType;
    private String expectedValue;
    private String actualValue;
    private String expectedType;
    private String actualType;
    private String attributionNote;
    private String attributedBy;
    private LocalDateTime attributedAt;
    private LocalDateTime createdAt;
}
