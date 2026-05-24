package com.hotel.lostfound.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SupplementRecordVO {

    private Long id;

    private String supplementType;

    private String supplementContent;

    private String evidenceImageUrls;

    private String operator;

    private LocalDateTime operateTime;

    private String remark;
}
