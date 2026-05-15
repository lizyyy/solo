package com.apidiff;

import com.apidiff.dto.ApiDiffRequest;
import com.apidiff.dto.ApiDiffResponse;
import com.apidiff.dto.StatusUpdateRequest;
import com.apidiff.entity.enums.ConfirmationStatus;
import com.apidiff.service.ApiDiffService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ApiDiffArchiveApplicationTests {

    @Autowired
    private ApiDiffService apiDiffService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void contextLoads() {
        assertNotNull(apiDiffService);
    }

    @Test
    void testCreateDiffRecordWithDifferences() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse response = apiDiffService.createDiffRecord(request);

        assertNotNull(response);
        assertNotNull(response.getId());
        assertTrue(response.getHasDifferences());
        assertTrue(response.getDiffCount() > 0);
        assertEquals(ConfirmationStatus.PENDING, response.getStatus());
    }

    @Test
    void testCreateDiffRecordWithoutDifferences() {
        ApiDiffRequest request = createTestRequest();
        request.setResponseB(request.getResponseA());

        ApiDiffResponse response = apiDiffService.createDiffRecord(request);

        assertNotNull(response);
        assertFalse(response.getHasDifferences());
        assertEquals(0, response.getDiffCount());
    }

    @Test
    void testDuplicateRequest() {
        ApiDiffRequest request1 = createTestRequest();
        ApiDiffRequest request2 = createTestRequest();

        ApiDiffResponse response1 = apiDiffService.createDiffRecord(request1);
        ApiDiffResponse response2 = apiDiffService.createDiffRecord(request2);

        assertEquals(response1.getId(), response2.getId());
    }

    @Test
    void testUpdateStatus() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        StatusUpdateRequest updateRequest = new StatusUpdateRequest();
        updateRequest.setStatus(ConfirmationStatus.CONFIRMED_BUG);
        updateRequest.setAttributionNote("这是一个预期的变更");
        updateRequest.setOperatedBy("tester");
        updateRequest.setRemark("已确认");

        ApiDiffResponse updateResponse = apiDiffService.updateStatus(
                createResponse.getId(), updateRequest);

        assertEquals(ConfirmationStatus.CONFIRMED_BUG, updateResponse.getStatus());
        assertNotNull(updateResponse.getConfirmedBy());
        assertNotNull(updateResponse.getConfirmedAt());
    }

    @Test
    void testGetDiffRecord() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        ApiDiffResponse getResponse = apiDiffService.getDiffRecord(createResponse.getId());

        assertEquals(createResponse.getId(), getResponse.getId());
        assertEquals(createResponse.getApiPath(), getResponse.getApiPath());
        assertNotNull(getResponse.getDiffFields());
    }

    @Test
    void testDeleteDiffRecord() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        assertDoesNotThrow(() -> apiDiffService.deleteDiffRecord(
                createResponse.getId(), "admin"));

        assertThrows(RuntimeException.class, () ->
                apiDiffService.getDiffRecord(createResponse.getId()));
    }

    @Test
    void testGetOperationLogs() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        assertFalse(apiDiffService.getOperationLogs(createResponse.getId()).isEmpty());
    }

    @Test
    void testExportToCsv() {
        ApiDiffRequest request = createTestRequest();
        apiDiffService.createDiffRecord(request);

        byte[] csvData = apiDiffService.exportToCsv(new com.apidiff.dto.DiffQueryRequest());

        assertNotNull(csvData);
        assertTrue(csvData.length > 0);
    }

    private ApiDiffRequest createTestRequest() {
        ApiDiffRequest request = new ApiDiffRequest();
        request.setApiPath("/api/test/" + System.currentTimeMillis());
        request.setHttpMethod("GET");
        request.setCreatedBy("test-user");

        Map<String, String> responseA = new HashMap<>();
        responseA.put("id", "1");
        responseA.put("name", "张三");
        responseA.put("age", "25");
        request.setResponseA(responseA);

        Map<String, String> responseB = new HashMap<>();
        responseB.put("id", "1");
        responseB.put("name", "张三");
        responseB.put("age", "26");
        responseB.put("email", "zhangsan@example.com");
        request.setResponseB(responseB);

        request.setVersionA("v1.0");
        request.setVersionB("v1.1");
        request.setStatusCodeA(200);
        request.setStatusCodeB(200);
        request.setResponseTimeA(100L);
        request.setResponseTimeB(150L);

        return request;
    }
}
