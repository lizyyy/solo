package com.lineage.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class SourceTableDto {

    @NotBlank(message = "表名不能为空")
    private String tableName;

    private String schemaName;

    @NotBlank(message = "列名不能为空")
    private String columnName;

    private String columnType;

    private String description;

    private String dataSource;
}
