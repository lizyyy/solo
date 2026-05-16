package com.dns.preplay.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualCorrectionRequest {

    @NotEmpty(message = "修正记录不能为空")
    @Valid
    private List<DnsRecordDTO> correctedRecords;

    private String correctionReason;
}
