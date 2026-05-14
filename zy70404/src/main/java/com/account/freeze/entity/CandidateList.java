package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("candidate_list")
public class CandidateList {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String listNo;

    private String listName;

    private String listType;

    private String status;

    private Integer totalCount;

    private Integer confirmedCount;

    private String ruleSnapshot;

    private String operator;

    private String confirmOperator;

    private LocalDateTime confirmTime;

    private LocalDateTime executeTime;

    private String remark;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
