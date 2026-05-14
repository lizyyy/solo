package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("freeze_rule")
public class FreezeRule {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Integer ruleVersion;

    private String ruleName;

    private String ruleContent;

    private String ruleDesc;

    private String status;

    private LocalDateTime effectiveTime;

    private LocalDateTime expireTime;

    private String operator;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
