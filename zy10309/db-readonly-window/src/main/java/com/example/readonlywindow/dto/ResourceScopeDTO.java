package com.example.readonlywindow.dto;

import lombok.Data;

@Data
public class ResourceScopeDTO {
    private String resourceType;
    private String resourceName;
    private String schemaName;
    private String tableName;
}
