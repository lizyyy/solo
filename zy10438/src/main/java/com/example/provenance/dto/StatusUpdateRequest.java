package com.example.provenance.dto;

import com.example.provenance.model.ProvenanceStatus;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusUpdateRequest {

    @NotNull(message = "目标状态不能为空")
    private ProvenanceStatus targetStatus;

    private String statusMessage;

    private String operator;

    private String reason;
}
