package com.dns.preplay.model.dto;

import com.dns.preplay.model.enums.RecordType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DnsRecordDTO {

    private Long id;

    @NotBlank(message = "域名不能为空")
    private String domainName;

    @NotNull(message = "记录类型不能为空")
    private RecordType recordType;

    private String oldTarget;

    private String newTarget;

    @NotNull(message = "TTL不能为空")
    @Positive(message = "TTL必须为正数")
    private Integer ttl;

    private Integer expectedTtl;

    private String ttlStrategy;

    private String comment;

    private Boolean isManualCorrected;

    private String originalInput;
}
