package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.IdType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ClaimRecordVO {

    private Long id;

    private String claimantName;

    private String claimantPhone;

    private IdType idType;

    private String idNumber;

    private String relation;

    private boolean identificationVerified;

    private boolean itemDescriptionMatched;

    private boolean approved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String handledBy;

    private LocalDateTime claimTime;
}
