package com.dns.preplay.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePreplayRequest {

    @NotBlank(message = "预演名称不能为空")
    private String preplayName;

    private String description;

    private String createdBy;

    @NotEmpty(message = "DNS记录列表不能为空")
    @Valid
    private List<DnsRecordDTO> records;
}
