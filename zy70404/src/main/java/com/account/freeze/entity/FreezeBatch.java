package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("freeze_batch")
public class FreezeBatch {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String batchNo;

    private String batchName;

    private String batchType;

    private String status;

    private Integer ruleVersion;

    private Integer totalCount;

    private Integer successCount;

    private Integer failCount;

    private String inputHash;

    private String operator;

    private String remark;

    private LocalDateTime previewTime;

    private LocalDateTime executeTime;

    private LocalDateTime finishTime;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
