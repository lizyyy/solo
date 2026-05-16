package com.dns.preplay.model.dto;

import com.dns.preplay.model.enums.RecordType;
import com.dns.preplay.model.enums.RiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiffResultDTO {

    private Long id;
    private String domainName;
    private RecordType recordType;
    private String expectedTarget;
    private String actualTarget;
    private Boolean hasDifference;
    private Integer expectedTtl;
    private Integer actualTtl;
    private RiskLevel ttlRiskLevel;
    private String ttlRiskReason;
    private String differenceDescription;
}
