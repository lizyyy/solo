package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("target_scope")
public class TargetScope extends BaseEntity {

    private Long scriptId;

    private String scopeType;

    private String tableName;

    private String primaryKey;

    private String whereCondition;

    private Long estimatedRows;

    private String columnsAffected;

    private String remark;
}
