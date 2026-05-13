package com.lineage.dto;

import lombok.Data;

@Data
public class DependentApiDto {

    private String apiPath;

    private String apiMethod;

    private String apiName;

    private String responseField;

    private String description;
}
