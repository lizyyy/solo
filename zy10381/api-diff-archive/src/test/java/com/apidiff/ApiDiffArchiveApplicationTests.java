package com.apidiff;

import com.apidiff.dto.*;
import com.apidiff.entity.enums.ConfirmationStatus;
import com.apidiff.service.ApiDiffService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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

    @Test
    void testResponseChangeCreatesNewRecord() {
        ApiDiffRequest request1 = createTestRequest();
        ApiDiffResponse response1 = apiDiffService.createDiffRecord(request1);

        ApiDiffRequest request2 = createTestRequest();
        Map<String, Object> newResponseB = new HashMap<>();
        newResponseB.put("id", "1");
        newResponseB.put("name", "张三");
        newResponseB.put("age", "27");
        newResponseB.put("phone", "13800000000");
        request2.setResponseB(newResponseB);

        ApiDiffResponse response2 = apiDiffService.createDiffRecord(request2);

        assertNotEquals(response1.getId(), response2.getId());
    }

    @Test
    void testGetDiffFieldsByRecordId() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        List<DiffFieldDTO> fields = apiDiffService.getDiffFieldsByRecordId(createResponse.getId());

        assertNotNull(fields);
        assertFalse(fields.isEmpty());
        assertTrue(fields.size() >= 2);
    }

    @Test
    void testUpdateFieldAttribution() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        List<DiffFieldDTO> fields = apiDiffService.getDiffFieldsByRecordId(createResponse.getId());
        DiffFieldDTO field = fields.get(0);

        FieldAttributionRequest attributionRequest = new FieldAttributionRequest();
        attributionRequest.setFieldId(field.getId());
        attributionRequest.setAttributionNote("这是一个预期的字段变更，属于业务调整");
        attributionRequest.setOperatedBy("analyst");
        attributionRequest.setRemark("已与产品确认");

        DiffFieldDTO updatedField = apiDiffService.updateFieldAttribution(createResponse.getId(), attributionRequest);

        assertNotNull(updatedField);
        assertEquals("这是一个预期的字段变更，属于业务调整", updatedField.getAttributionNote());
        assertEquals("analyst", updatedField.getAttributedBy());
        assertNotNull(updatedField.getAttributedAt());
    }

    @Test
    void testBatchUpdateFieldAttribution() {
        ApiDiffRequest request = createTestRequest();
        ApiDiffResponse createResponse = apiDiffService.createDiffRecord(request);

        List<DiffFieldDTO> fields = apiDiffService.getDiffFieldsByRecordId(createResponse.getId());

        BatchFieldAttributionRequest batchRequest = new BatchFieldAttributionRequest();
        batchRequest.setOperatedBy("analyst");
        List<FieldAttributionRequest> fieldRequests = new ArrayList<>();

        for (int i = 0; i < Math.min(2, fields.size()); i++) {
            FieldAttributionRequest fr = new FieldAttributionRequest();
            fr.setFieldId(fields.get(i).getId());
            fr.setAttributionNote("批量归因备注 - 字段" + (i + 1));
            fieldRequests.add(fr);
        }
        batchRequest.setFields(fieldRequests);

        List<DiffFieldDTO> updatedFields = apiDiffService.batchUpdateFieldAttribution(createResponse.getId(), batchRequest);

        assertNotNull(updatedFields);
        assertEquals(2, updatedFields.size());
        assertEquals("analyst", updatedFields.get(0).getAttributedBy());
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
