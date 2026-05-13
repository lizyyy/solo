package com.apigate.voting.dto;

import com.apigate.voting.model.VoteResult;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class VoteRequest {
    @NotNull(message = "投票结果不能为空")
    private VoteResult result;

    @NotBlank(message = "投票人ID不能为空")
    private String voterId;

    private String comment;
}
