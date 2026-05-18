package com.riskcontrol.graylist.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ImportResultDTO {
    private String batchNo;
    private String fileName;
    private Integer totalCount;
    private Integer successCount;
    private Integer conflictCount;
    private Integer invalidCount;
    private String importUser;
    private LocalDateTime importTime;
    private List<ImportDetailDTO> details;

    @Data
    public static class ImportDetailDTO {
        private Integer rowNumber;
        private String customerId;
        private String customerName;
        private String resultType;
        private String resultDescription;
        private String errorMessage;
    }
}
