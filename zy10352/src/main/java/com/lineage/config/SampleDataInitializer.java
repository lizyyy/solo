package com.lineage.config;

import com.lineage.dto.*;
import com.lineage.entity.FieldLineage;
import com.lineage.enums.FieldType;
import com.lineage.enums.LineageStatus;
import com.lineage.service.FieldLineageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Slf4j
@Component
@Profile("!test")
@RequiredArgsConstructor
public class SampleDataInitializer implements CommandLineRunner {

    private final FieldLineageService lineageService;

    @Override
    public void run(String... args) {
        log.info("Initializing sample lineage data...");

        try {
            initSuccessFlowSample();
            initProblemFlowSample();
            log.info("Sample data initialization completed");
        } catch (Exception e) {
            log.warn("Sample data may already exist, skipping initialization: {}", e.getMessage());
        }
    }

    private void initSuccessFlowSample() {
        log.info("Creating success flow sample...");

        FieldLineageCreateRequest request1 = createBaseRequest(
                "/api/v1/orders",
                "GET",
                "获取订单列表",
                "totalAmount",
                "data.totalAmount",
                FieldType.DOUBLE,
                "订单总金额",
                "1000.00",
                "user1"
        );

        SourceTableDto sourceTable1 = new SourceTableDto();
        sourceTable1.setTableName("orders");
        sourceTable1.setSchemaName("order_db");
        sourceTable1.setColumnName("amount");
        sourceTable1.setColumnType("decimal(10,2)");
        sourceTable1.setDescription("订单金额");
        sourceTable1.setDataSource("order_master");

        SourceTableDto sourceTable2 = new SourceTableDto();
        sourceTable2.setTableName("order_items");
        sourceTable2.setSchemaName("order_db");
        sourceTable2.setColumnName("price");
        sourceTable2.setColumnType("decimal(10,2)");
        sourceTable2.setDescription("商品单价");
        sourceTable2.setDataSource("order_detail");

        request1.setSourceTables(Arrays.asList(sourceTable1, sourceTable2));

        CalculationRuleDto ruleDto = new CalculationRuleDto();
        ruleDto.setRuleName("订单金额汇总");
        ruleDto.setRuleType("AGGREGATION");
        ruleDto.setRuleExpression("SUM(order_items.price * order_items.quantity) + orders.shipping_fee");
        ruleDto.setDescription("汇总订单商品金额加上运费");
        request1.setCalculationRule(ruleDto);

        FieldLineage lineage1 = lineageService.createLineage(request1);
        log.info("Created success flow lineage, ID: {}, Status: {}", lineage1.getId(), lineage1.getStatus());

        lineageService.validateLineage(lineage1.getId(), "admin");
        FieldLineage validated = lineageService.getLineage(lineage1.getId());
        log.info("Validated success flow lineage, ID: {}, Status: {}", validated.getId(), validated.getStatus());
    }

    private void initProblemFlowSample() {
        log.info("Creating problem flow sample...");

        FieldLineageCreateRequest request1 = createBaseRequest(
                "/api/v1/users",
                "GET",
                "获取用户信息",
                "userName",
                "data.userName",
                FieldType.STRING,
                "用户名称",
                "张三",
                "user2"
        );

        SourceTableDto sourceTable1 = new SourceTableDto();
        sourceTable1.setTableName("users");
        sourceTable1.setSchemaName("user_db");
        sourceTable1.setColumnName("name");
        sourceTable1.setColumnType("varchar(100)");
        sourceTable1.setDescription("用户姓名");
        sourceTable1.setDataSource("user_master");

        request1.setSourceTables(Arrays.asList(sourceTable1));

        DependentApiDto dependentApi1 = new DependentApiDto();
        dependentApi1.setApiPath("/api/v1/orders");
        dependentApi1.setApiMethod("GET");
        dependentApi1.setApiName("获取订单列表");
        dependentApi1.setResponseField("totalAmount");
        dependentApi1.setDescription("依赖订单总金额字段");
        request1.setDependentApis(Arrays.asList(dependentApi1));

        FieldLineage lineage1 = lineageService.createLineage(request1);
        log.info("Created problem flow lineage 1, ID: {}, Status: {}", lineage1.getId(), lineage1.getStatus());

        FieldLineageCreateRequest request2 = createBaseRequest(
                "/api/v1/invalid",
                "GET",
                "无效接口",
                "invalidField",
                null,
                FieldType.STRING,
                "无效字段",
                null,
                "user3"
        );

        FieldLineage lineage2 = lineageService.createLineage(request2);
        log.info("Created problem flow lineage 2, ID: {}, Status: {}", lineage2.getId(), lineage2.getStatus());

        lineageService.validateLineage(lineage2.getId(), "admin");
        FieldLineage validated = lineageService.getLineage(lineage2.getId());
        log.info("Validated problem flow lineage, ID: {}, Status: {}", validated.getId(), validated.getStatus());

        lineageService.updateStatus(lineage2.getId(), LineageStatus.DRAFT, "需要补充来源表信息", "admin");
        FieldLineage updated = lineageService.getLineage(lineage2.getId());
        log.info("Updated problem flow lineage, ID: {}, Status: {}", updated.getId(), updated.getStatus());
    }

    private FieldLineageCreateRequest createBaseRequest(
            String apiPath, String apiMethod, String apiName,
            String responseField, String fieldPath, FieldType fieldType,
            String description, String exampleValue, String createdBy) {

        FieldLineageCreateRequest request = new FieldLineageCreateRequest();
        request.setApiPath(apiPath);
        request.setApiMethod(apiMethod);
        request.setApiName(apiName);
        request.setResponseField(responseField);
        request.setFieldPath(fieldPath);
        request.setFieldType(fieldType);
        request.setDescription(description);
        request.setExampleValue(exampleValue);
        request.setCreatedBy(createdBy);
        return request;
    }
}
