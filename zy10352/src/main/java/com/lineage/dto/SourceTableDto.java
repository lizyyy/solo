package com.lineage.dto;

import lombok.Data;

@Data
public class SourceTableDto {

    private String tableName;

    private String schemaName;

    private String columnName;

    private String columnType;

    private String description;

    private String dataSource;
}
