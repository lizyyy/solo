package com.identity.verification.dto;

import com.identity.verification.model.*;
import com.identity.verification.model.enums.TrustLevel;
import com.identity.verification.model.enums.VerificationStatus;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class VerificationResult {
    private Long taskId;
    private String requestId;
    private VerificationStatus status;
    private String statusDescription;
    private Integer trustScore;
    private TrustLevel trustLevel;
    private Integer conflictCount;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    private List<PersonIdentifier> identifiers;
    private List<ConflictField> conflicts;
    private List<MergeSuggestion> suggestions;
    private List<ConfirmationRecord> confirmations;
}
