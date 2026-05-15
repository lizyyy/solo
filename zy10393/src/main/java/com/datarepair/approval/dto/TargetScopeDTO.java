package com.datarepair.approval.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class TargetScopeDTO {

    @NotBlank(message = "范围类型不能为空")
    private String scopeType;

    @NotBlank(message = "表名不能为空")
    private String tableName;

    private String primaryKey;

    private String whereCondition;

    private Long estimatedRows;

    private String columnsAffected;

    private String remark;
}
