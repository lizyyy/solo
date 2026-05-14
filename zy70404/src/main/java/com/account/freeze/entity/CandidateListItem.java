package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("candidate_list_item")
public class CandidateListItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long listId;

    private String listNo;

    private Long batchId;

    private Long batchItemId;

    private String accountNo;

    private String originalStatus;

    private String targetStatus;

    private String status;

    private String confirmOperator;

    private LocalDateTime confirmTime;

    private String reason;

    private String remark;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
