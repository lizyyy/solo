package com.example.provenance.model;

import javax.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class ExceptionRequest {
    private String requestId;
    private String requester;
    private String reason;
    private Long requestTimestamp;
    private String approver;
    private Long approvalTimestamp;
    private String approvalComment;
    private Boolean approved;
}
