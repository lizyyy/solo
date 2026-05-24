package com.hazardous.waste.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WasteRecordDTO {
    private String recordNo;

    @NotBlank(message = "危废类别不能为空")
    private String category;

    @NotBlank(message = "危废名称不能为空")
    private String wasteName;

    @NotNull(message = "重量不能为空")
    private Double weight;

    private String component;

    private String hazardCharacteristics;

    private String bucketCode;

    private LocalDateTime inTime;

    private String submitter;

    private String remark;
}
