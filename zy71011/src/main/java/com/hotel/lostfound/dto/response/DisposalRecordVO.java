package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.DisposalType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DisposalRecordVO {

    private Long id;

    private DisposalType disposalType;

    private String appliedBy;

    private LocalDateTime appliedAt;

    private String applyReason;

    private boolean managerApproved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String evidenceImageUrls;

    private String handledBy;

    private LocalDateTime disposedAt;

    private String disposalDetail;
}
