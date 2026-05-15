package com.api.slimming.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("slimming_rule")
public class SlimmingRule extends BaseEntity {

    private String ruleNo;

    private Long apiEndpointId;

    private String apiPath;

    private String fieldConfig;

    private String excludeFields;

    private String includeFields;

    private String nestedRules;

    private Long clientSceneId;

    private String sceneCode;

    private Integer status;

    private String version;

    private String previousVersion;

    private LocalDateTime effectiveTime;

    private LocalDateTime expireTime;

    private String createdBy;

    private String remark;

    @TableField(exist = false)
    private List<String> excludeFieldList;

    @TableField(exist = false)
    private List<String> includeFieldList;
}
