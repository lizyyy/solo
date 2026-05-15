package com.sensitive.operation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sensitive.operation.dto.*;
import com.sensitive.operation.enums.OperationStatus;
import com.sensitive.operation.enums.RiskLevel;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SensitiveOperationApiTest {

    @LocalServerPort
    private int port;

    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
    }

    private String generateId() {
        return "API_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private CreateOperationRequest buildCreateRequest(String id, RiskLevel riskLevel) {
        return CreateOperationRequest.builder()
                .requestId(id)
                .operationType("API_TEST")
                .requesterId("api_user001")
                .requesterName("API申请人")
                .riskLevel(riskLevel)
                .build();
    }

    @Test
    @DisplayName("API - 创建操作成功")
    void createOperationApi() throws Exception {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.LOW);

        given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(request))
                .when()
                .post("/api/operations")
                .then()
                .statusCode(HttpStatus.OK.value())
                .body("code", equalTo(200))
                .body("data.id", equalTo(id))
                .body("data.status", equalTo(OperationStatus.PENDING.name()));
    }

    @Test
    @DisplayName("API - 参数校验失败返回400")
    void createWithInvalidParams() throws Exception {
        CreateOperationRequest request = CreateOperationRequest.builder()
                .requestId("")
                .operationType(null)
                .requesterId("")
                .build();

        given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(request))
                .when()
                .post("/api/operations")
                .then()
                .statusCode(HttpStatus.BAD_REQUEST.value())
                .body("code", equalTo(400));
    }

    @Test
    @DisplayName("API - 完整流程: 创建->确认->执行")
    void fullWorkflowApi() throws Exception {
        String id = generateId();

        given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(buildCreateRequest(id, RiskLevel.HIGH)))
                .when()
                .post("/api/operations")
                .then()
                .statusCode(HttpStatus.OK.value())
                .body("data.status", equalTo(OperationStatus.CONFIRMING.name()));

        given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(ConfirmRequest.builder()
                        .confirmerId("confirmer1")
                        .confirmerName("确认人1")
                        .build()))
                .when()
                .post("/api/operations/{id}/confirm", id)
                .then()
                .statusCode(HttpStatus.OK.value())
                .body("data.status", equalTo(OperationStatus.CONFIRMING.name()));

        String token = given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(ConfirmRequest.builder()
                        .confirmerId("confirmer2")
                        .confirmerName("确认人2")
                        .build()))
                .when()
                .post("/api/operations/{id}/confirm", id)
                .then()
                .statusCode(HttpStatus.OK.value())
                .body("data.status", equalTo(OperationStatus.CONFIRMED.name()))
                .extract()
                .path("data.executionToken");

        given()
                .param("token", token)
                .when()
                .post("/api/operations/{id}/execute", id)
                .then()
                .statusCode(HttpStatus.OK.value())
                .body("data.status", equalTo(OperationStatus.EXECUTED.name()));
    }

    @Test
    @DisplayName("API - 查询不存在的操作返回404")
    void queryNonExistentApi() {
        given()
                .when()
                .get("/api/operations/NON_EXISTENT")
                .then()
                .statusCode(HttpStatus.NOT_FOUND.value());
    }

    @Test
    @DisplayName("API - 重复提交幂等测试")
    void idempotentApiTest() throws Exception {
        String id = generateId();
        CreateOperationRequest request = buildCreateRequest(id, RiskLevel.LOW);

        String firstCreatedAt = given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(request))
                .when()
                .post("/api/operations")
                .then()
                .statusCode(HttpStatus.OK.value())
                .extract()
                .path("data.createdAt");

        String secondCreatedAt = given()
                .contentType(ContentType.JSON)
                .body(objectMapper.writeValueAsString(request))
                .when()
                .post("/api/operations")
                .then()
                .statusCode(HttpStatus.OK.value())
                .extract()
                .path("data.createdAt");

        assert firstCreatedAt.equals(secondCreatedAt);
    }

    @Test
    @DisplayName("API - 导出JSON")
    void exportJsonApi() {
        given()
                .when()
                .get("/api/operations/export/json")
                .then()
                .statusCode(HttpStatus.OK.value())
                .contentType(ContentType.JSON);
    }

    @Test
    @DisplayName("API - 导出CSV")
    void exportCsvApi() {
        given()
                .when()
                .get("/api/operations/export/csv")
                .then()
                .statusCode(HttpStatus.OK.value())
                .contentType(containsString("text/csv"));
    }
}
