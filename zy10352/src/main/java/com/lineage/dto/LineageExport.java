package com.lineage.dto;

import com.lineage.entity.*;
import com.lineage.enums.FieldType;
import com.lineage.enums.LineageStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class LineageExport {

    private Long id;

    private String apiPath;

    private String apiMethod;

    private String apiName;

    private String responseField;

    private String fieldPath;

    private FieldType fieldType;

    private String description;

    private LineageStatus status;

    private String createdBy;

    private LocalDateTime createdAt;

    private List<SourceTable> sourceTables;

    private CalculationRule calculationRule;

    private List<DependentApi> dependentApis;

    private List<LineageDependency> dependencies;

    private List<LineageHistory> history;
}
