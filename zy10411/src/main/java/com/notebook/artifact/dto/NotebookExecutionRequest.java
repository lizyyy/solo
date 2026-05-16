package com.notebook.artifact.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class NotebookExecutionRequest {
    @NotBlank(message = "notebookIdentifier不能为空")
    private String notebookIdentifier;

    private String notebookName;

    private String notebookPath;

    private String executedBy;

    @NotNull(message = "parameters不能为空")
    private Map<String, Object> parameters;

    private String parameterDescription;

    @NotNull(message = "runtimeEnvironment不能为空")
    private RuntimeEnvironmentDto runtimeEnvironment;

    private List<OutputArtifactDto> outputArtifacts;

    @Data
    public static class RuntimeEnvironmentDto {
        @NotBlank(message = "pythonVersion不能为空")
        private String pythonVersion;
        private String notebookKernel;
        private String dependencies;
        private String osInfo;
        private String hardwareInfo;
    }

    @Data
    public static class OutputArtifactDto {
        @NotBlank(message = "artifactName不能为空")
        private String artifactName;
        @NotBlank(message = "artifactType不能为空")
        private String artifactType;
        private String artifactPath;
        private Long fileSize;
        private String fileHash;
        private String description;
    }
}
