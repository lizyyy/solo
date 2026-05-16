package com.example.provenance.model;

import javax.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class BuildPipeline {
    private String pipelineId;
    private String pipelineName;
    private String buildNumber;
    private String buildUrl;
    private String buildAgent;
    private Long buildStartTime;
    private Long buildEndTime;
    private String buildStatus;
}
