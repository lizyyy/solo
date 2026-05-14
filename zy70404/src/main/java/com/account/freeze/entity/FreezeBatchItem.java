package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "freeze_batch_item", autoResultMap = true)
public class FreezeBatchItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long batchId;

    private String batchNo;

    private String accountNo;

    private String accountName;

    private String phone;

    private String smsContent;

    private LocalDateTime smsSendTime;

    private String status;

    private String failReason;

    private Long evidenceChainId;

    private LocalDateTime freezeTime;

    private String operator;

    private String remark;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> extraInfo;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
