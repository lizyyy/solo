package com.dns.preplay.util;

import com.dns.preplay.model.dto.DiffResultDTO;
import com.dns.preplay.model.dto.DnsRecordDTO;
import com.dns.preplay.model.dto.PreplayResponse;
import com.dns.preplay.model.entity.DiffResult;
import com.dns.preplay.model.entity.DnsPreplay;
import com.dns.preplay.model.entity.DnsRecord;

import java.util.List;
import java.util.stream.Collectors;

public class DtoConverter {

    private DtoConverter() {
    }

    public static DnsRecordDTO toRecordDTO(DnsRecord record) {
        if (record == null) {
            return null;
        }
        return DnsRecordDTO.builder()
                .id(record.getId())
                .domainName(record.getDomainName())
                .recordType(record.getRecordType())
                .oldTarget(record.getOldTarget())
                .newTarget(record.getNewTarget())
                .ttl(record.getTtl())
                .expectedTtl(record.getExpectedTtl())
                .ttlStrategy(record.getTtlStrategy())
                .comment(record.getComment())
                .isManualCorrected(record.getIsManualCorrected())
                .originalInput(record.getOriginalInput())
                .build();
    }

    public static DnsRecord toRecordEntity(DnsRecordDTO dto) {
        if (dto == null) {
            return null;
        }
        return DnsRecord.builder()
                .id(dto.getId())
                .domainName(dto.getDomainName())
                .recordType(dto.getRecordType())
                .oldTarget(dto.getOldTarget())
                .newTarget(dto.getNewTarget())
                .ttl(dto.getTtl())
                .expectedTtl(dto.getExpectedTtl())
                .ttlStrategy(dto.getTtlStrategy())
                .comment(dto.getComment())
                .isManualCorrected(dto.getIsManualCorrected())
                .originalInput(dto.getOriginalInput())
                .build();
    }

    public static DiffResultDTO toDiffResultDTO(DiffResult diff) {
        if (diff == null) {
            return null;
        }
        return DiffResultDTO.builder()
                .id(diff.getId())
                .domainName(diff.getDomainName())
                .recordType(diff.getRecordType())
                .expectedTarget(diff.getExpectedTarget())
                .actualTarget(diff.getActualTarget())
                .hasDifference(diff.getHasDifference())
                .expectedTtl(diff.getExpectedTtl())
                .actualTtl(diff.getActualTtl())
                .ttlRiskLevel(diff.getTtlRiskLevel())
                .ttlRiskReason(diff.getTtlRiskReason())
                .differenceDescription(diff.getDifferenceDescription())
                .build();
    }

    public static PreplayResponse toPreplayResponse(DnsPreplay preplay) {
        if (preplay == null) {
            return null;
        }
        List<DnsRecordDTO> recordDTOs = preplay.getRecords().stream()
                .map(DtoConverter::toRecordDTO)
                .collect(Collectors.toList());
        List<DiffResultDTO> diffDTOs = preplay.getDiffResults().stream()
                .map(DtoConverter::toDiffResultDTO)
                .collect(Collectors.toList());

        return PreplayResponse.builder()
                .id(preplay.getId())
                .preplayName(preplay.getPreplayName())
                .description(preplay.getDescription())
                .status(preplay.getStatus())
                .overallRiskLevel(preplay.getOverallRiskLevel())
                .conclusion(preplay.getConclusion())
                .rollbackNotes(preplay.getRollbackNotes())
                .createdBy(preplay.getCreatedBy())
                .errorDetails(preplay.getErrorDetails())
                .createdAt(preplay.getCreatedAt())
                .updatedAt(preplay.getUpdatedAt())
                .completedAt(preplay.getCompletedAt())
                .records(recordDTOs)
                .diffResults(diffDTOs)
                .build();
    }
}
