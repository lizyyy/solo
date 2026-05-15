package com.api.slimming.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("rule_history")
public class RuleHistory extends BaseEntity {

    private Long ruleId;

    private String ruleNo;

    private Integer operationType;

    private Integer previousStatus;

    private Integer currentStatus;

    private String operator;

    private String operationRemark;

    private String snapshotBefore;

    private String snapshotAfter;
}
