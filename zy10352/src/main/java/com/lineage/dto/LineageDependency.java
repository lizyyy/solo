package com.lineage.dto;

import lombok.Data;

@Data
public class LineageDependency {

    private int depth;

    private String dependentApiPath;

    private String dependentApiMethod;

    private String dependentApiName;

    private String dependentField;

    private String description;
}
