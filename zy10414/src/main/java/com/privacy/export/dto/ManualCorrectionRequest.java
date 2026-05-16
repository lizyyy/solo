package com.privacy.export.dto;

import com.privacy.export.enums.ExportScopeCategory;
import javax.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ManualCorrectionRequest {

    @NotBlank(message = "修正人不能为空")
    private String correctedBy;

    private String correctionReason;

    private String newConsentVersionCode;

    private String newConsentSignature;

    private List<ScopeItemRequest> updatedScopeItems;

    private String processingConclusion;
}
