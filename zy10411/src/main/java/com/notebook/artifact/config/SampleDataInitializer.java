package com.notebook.artifact.config;

import com.notebook.artifact.dto.NotebookExecutionRequest;
import com.notebook.artifact.dto.ReviewRequest;
import com.notebook.artifact.dto.StatusUpdateRequest;
import com.notebook.artifact.model.ExecutionStatus;
import com.notebook.artifact.model.NotebookExecution;
import com.notebook.artifact.model.ReviewStatus;
import com.notebook.artifact.service.NotebookExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Map;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class SampleDataInitializer {

    private final NotebookExecutionService executionService;

    @Bean
    public CommandLineRunner initSampleData() {
        return args -> {
            if (executionService.getAllExecutions().isEmpty()) {
                log.info("正在初始化样例数据...");
                initializeSalesForecastSample();
                initializeCustomerSegmentationSample();
                initializeAnomalyDetectionSample();
                log.info("样例数据初始化完成！");
            }
        };
    }

    private void initializeSalesForecastSample() {
        NotebookExecutionRequest request1 = new NotebookExecutionRequest();
        request1.setNotebookIdentifier("sales-forecast-model-v3");
        request1.setNotebookName("销售预测模型 - 季度版本");
        request1.setNotebookPath("/notebooks/sales/forecast_v3.ipynb");
        request1.setExecutedBy("data-scientist-01");
        request1.setParameterDescription("Q3销售预测参数配置");
        request1.setParameters(Map.of(
            "forecast_period", 90,
            "model_type", "XGBoost",
            "learning_rate", 0.08,
            "max_depth", 7,
            "train_test_split", 0.85,
            "seasonality_enabled", true,
            "regions", List.of("华东", "华南", "华北")
        ));

        NotebookExecutionRequest.RuntimeEnvironmentDto envDto1 = 
            new NotebookExecutionRequest.RuntimeEnvironmentDto();
        envDto1.setPythonVersion("3.10.12");
        envDto1.setNotebookKernel("python3-data-science");
        envDto1.setDependencies("xgboost==2.0.0,pandas==2.1.0,numpy==1.24.3,scikit-learn==1.3.0");
        envDto1.setOsInfo("Linux Ubuntu 22.04");
        envDto1.setHardwareInfo("CPU: 8核, RAM: 32GB");
        request1.setRuntimeEnvironment(envDto1);

        NotebookExecutionRequest.OutputArtifactDto artifact1 = 
            new NotebookExecutionRequest.OutputArtifactDto();
        artifact1.setArtifactName("q3_forecast_results.csv");
        artifact1.setArtifactType("csv");
        artifact1.setArtifactPath("/artifacts/sales/q3_forecast_results.csv");
        artifact1.setFileSize(2048576L);
        artifact1.setFileHash("a1b2c3d4e5f67890");
        artifact1.setDescription("Q3销售预测结果数据");

        NotebookExecutionRequest.OutputArtifactDto artifact2 = 
            new NotebookExecutionRequest.OutputArtifactDto();
        artifact2.setArtifactName("forecast_model.pkl");
        artifact2.setArtifactType("model");
        artifact2.setArtifactPath("/artifacts/sales/forecast_model.pkl");
        artifact2.setFileSize(15728640L);
        artifact2.setFileHash("f6e5d4c3b2a10987");
        artifact2.setDescription("训练好的预测模型");

        request1.setOutputArtifacts(List.of(artifact1, artifact2));

        NotebookExecution execution1 = executionService.createExecution(request1);
        
        StatusUpdateRequest statusRequest1 = new StatusUpdateRequest();
        statusRequest1.setStatus(ExecutionStatus.RUNNING);
        statusRequest1.setUpdatedBy("system");
        statusRequest1.setExecutionLog("开始执行Notebook，加载数据...");
        executionService.updateStatus(execution1.getExecutionId(), statusRequest1);

        StatusUpdateRequest statusRequest2 = new StatusUpdateRequest();
        statusRequest2.setStatus(ExecutionStatus.COMPLETED);
        statusRequest2.setUpdatedBy("system");
        statusRequest2.setExecutionLog("执行完成，MAE: 125.5, RMSE: 189.2, R2: 0.89");
        NotebookExecution completedExecution = executionService.updateStatus(
            execution1.getExecutionId(), statusRequest2);

        StatusUpdateRequest statusRequest3 = new StatusUpdateRequest();
        statusRequest3.setStatus(ExecutionStatus.NEEDS_REVIEW);
        statusRequest3.setUpdatedBy("data-scientist-01");
        statusRequest3.setExecutionLog("提交复核，等待审核");
        executionService.updateStatus(completedExecution.getExecutionId(), statusRequest3);

        ReviewRequest reviewRequest = new ReviewRequest();
        reviewRequest.setReviewer("data-lead-01");
        reviewRequest.setStatus(ReviewStatus.APPROVED);
        reviewRequest.setComments("模型指标符合预期，可以用于生产环境");
        reviewRequest.setCorrectionSuggestions("建议在Q4增加节假日特征权重");
        executionService.addReview(completedExecution.getExecutionId(), reviewRequest);
    }

    private void initializeCustomerSegmentationSample() {
        NotebookExecutionRequest request = new NotebookExecutionRequest();
        request.setNotebookIdentifier("customer-segmentation-kmeans");
        request.setNotebookName("客户分群 - K-Means聚类");
        request.setNotebookPath("/notebooks/customer/segmentation.ipynb");
        request.setExecutedBy("data-analyst-02");
        request.setParameterDescription("月度客户分群参数");
        request.setParameters(Map.of(
            "n_clusters", 5,
            "max_iter", 300,
            "random_state", 42,
            "features", List.of("recency", "frequency", "monetary"),
            "scale_features", true,
            "pca_components", 2
        ));

        NotebookExecutionRequest.RuntimeEnvironmentDto envDto = 
            new NotebookExecutionRequest.RuntimeEnvironmentDto();
        envDto.setPythonVersion("3.9.17");
        envDto.setNotebookKernel("python3");
        envDto.setDependencies("scikit-learn==1.2.2,pandas==2.0.3,numpy==1.24.3,matplotlib==3.7.2");
        envDto.setOsInfo("Linux Ubuntu 20.04");
        envDto.setHardwareInfo("CPU: 4核, RAM: 16GB");
        request.setRuntimeEnvironment(envDto);

        NotebookExecutionRequest.OutputArtifactDto artifact = 
            new NotebookExecutionRequest.OutputArtifactDto();
        artifact.setArtifactName("customer_segments.csv");
        artifact.setArtifactType("csv");
        artifact.setArtifactPath("/artifacts/customer/customer_segments.csv");
        artifact.setFileSize(5242880L);
        artifact.setFileHash("x9y8z7w6v5u43210");
        artifact.setDescription("客户分群结果");
        request.setOutputArtifacts(List.of(artifact));

        NotebookExecution execution = executionService.createExecution(request);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest();
        statusRequest.setStatus(ExecutionStatus.RUNNING);
        executionService.updateStatus(execution.getExecutionId(), statusRequest);
    }

    private void initializeAnomalyDetectionSample() {
        NotebookExecutionRequest request = new NotebookExecutionRequest();
        request.setNotebookIdentifier("anomaly-detection-isolation-forest");
        request.setNotebookName("异常检测 - Isolation Forest");
        request.setNotebookPath("/notebooks/fraud/anomaly_detection.ipynb");
        request.setExecutedBy("ml-engineer-03");
        request.setParameterDescription("交易异常检测参数");
        request.setParameters(Map.of(
            "contamination", 0.01,
            "n_estimators", 200,
            "max_samples", "auto",
            "threshold", 0.65
        ));

        NotebookExecutionRequest.RuntimeEnvironmentDto envDto = 
            new NotebookExecutionRequest.RuntimeEnvironmentDto();
        envDto.setPythonVersion("3.11.4");
        envDto.setNotebookKernel("python3-ml");
        envDto.setDependencies("scikit-learn==1.3.0,pandas==2.1.0,numpy==1.25.2");
        envDto.setOsInfo("Linux Ubuntu 22.04");
        envDto.setHardwareInfo("CPU: 16核, RAM: 64GB, GPU: Tesla T4");
        request.setRuntimeEnvironment(envDto);

        executionService.createExecution(request);
    }
}
