package com.apigate.voting.dto;

import com.apigate.voting.model.ProposalStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProposalQueryRequest {
    private String proposalNo;

    private String title;

    private String apiName;

    private ProposalStatus status;

    private String submitterId;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer page = 0;

    private Integer size = 20;
}
