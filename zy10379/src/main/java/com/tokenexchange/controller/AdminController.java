package com.tokenexchange.controller;

import com.tokenexchange.dto.*;
import com.tokenexchange.entity.*;
import com.tokenexchange.repository.*;
import com.tokenexchange.service.TokenExchangeService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final UserTokenRepository userTokenRepository;
    private final ShortTokenRepository shortTokenRepository;
    private final ServiceIdentityRepository serviceIdentityRepository;
    private final ExchangeScenarioRepository exchangeScenarioRepository;
    private final TokenExchangeService tokenExchangeService;

    // ==================== User Token 管理 ====================

    @PostMapping("/user-tokens")
    public ResponseEntity<ApiResponse<UserToken>> createUserToken(@Valid @RequestBody Map<String, Object> request) {
        String userId = (String) request.get("userId");
        String scopes = (String) request.get("scopes");
        Integer expireDays = request.get("expireDays") != null ? 
            Integer.parseInt(request.get("expireDays").toString()) : 30;

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "userId 不能为空"));
        }
        if (scopes == null || scopes.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "scopes 不能为空"));
        }

        UserToken userToken = tokenExchangeService.createUserToken(userId, scopes, expireDays);
        log.info("User token created: userId={}", userId);
        return ResponseEntity.ok(ApiResponse.success("用户令牌创建成功", userToken));
    }

    @GetMapping("/user-tokens")
    public ResponseEntity<ApiResponse<List<UserToken>>> getAllUserTokens() {
        List<UserToken> tokens = userTokenRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success("用户令牌列表查询成功", tokens));
    }

    @GetMapping("/user-tokens/{id}")
    public ResponseEntity<ApiResponse<UserToken>> getUserTokenById(@PathVariable Long id) {
        Optional<UserToken> token = userTokenRepository.findById(id);
        if (token.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "用户令牌不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success("用户令牌查询成功", token.get()));
    }

    @GetMapping("/user-tokens/user/{userId}")
    public ResponseEntity<ApiResponse<List<UserToken>>> getUserTokensByUserId(@PathVariable String userId) {
        List<UserToken> tokens = userTokenRepository.findByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success("用户令牌列表查询成功", tokens));
    }

    @PutMapping("/user-tokens/{id}")
    public ResponseEntity<ApiResponse<UserToken>> updateUserToken(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Optional<UserToken> tokenOpt = userTokenRepository.findById(id);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "用户令牌不存在"));
        }

        UserToken token = tokenOpt.get();
        if (request.containsKey("scopes")) {
            token.setScopes((String) request.get("scopes"));
        }
        if (request.containsKey("revoked")) {
            token.setRevoked((Boolean) request.get("revoked"));
        }
        token = userTokenRepository.save(token);
        log.info("User token updated: id={}", id);
        return ResponseEntity.ok(ApiResponse.success("用户令牌更新成功", token));
    }

    @DeleteMapping("/user-tokens/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUserToken(@PathVariable Long id) {
        if (!userTokenRepository.existsById(id)) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "用户令牌不存在"));
        }
        userTokenRepository.deleteById(id);
        log.info("User token deleted: id={}", id);
        return ResponseEntity.ok(ApiResponse.success("用户令牌删除成功", null));
    }

    // ==================== Short Token 管理 ====================

    @GetMapping("/short-tokens")
    public ResponseEntity<ApiResponse<List<ShortToken>>> getAllShortTokens() {
        List<ShortToken> tokens = shortTokenRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success("短期令牌列表查询成功", tokens));
    }

    @GetMapping("/short-tokens/{id}")
    public ResponseEntity<ApiResponse<ShortToken>> getShortTokenById(@PathVariable Long id) {
        Optional<ShortToken> token = shortTokenRepository.findById(id);
        if (token.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "短期令牌不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success("短期令牌查询成功", token.get()));
    }

    @GetMapping("/short-tokens/user/{userId}")
    public ResponseEntity<ApiResponse<List<ShortToken>>> getShortTokensByUserId(@PathVariable String userId) {
        List<ShortToken> tokens = shortTokenRepository.findByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success("用户短期令牌列表查询成功", tokens));
    }

    @GetMapping("/short-tokens/service/{sourceServiceId}/{targetServiceId}")
    public ResponseEntity<ApiResponse<List<ShortToken>>> getShortTokensByService(
            @PathVariable String sourceServiceId,
            @PathVariable String targetServiceId) {
        List<ShortToken> tokens = shortTokenRepository.findBySourceServiceIdAndTargetServiceId(
                sourceServiceId, targetServiceId);
        return ResponseEntity.ok(ApiResponse.success("服务间短期令牌列表查询成功", tokens));
    }

    // ==================== Service Identity 管理 ====================

    @PostMapping("/services")
    public ResponseEntity<ApiResponse<ServiceIdentity>> createService(@Valid @RequestBody Map<String, Object> request) {
        String serviceId = (String) request.get("serviceId");
        String serviceName = (String) request.get("serviceName");
        String description = (String) request.get("description");
        String allowedScopes = (String) request.get("allowedScopes");

        if (serviceId == null || serviceId.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "serviceId 不能为空"));
        }
        if (serviceName == null || serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "serviceName 不能为空"));
        }

        if (serviceIdentityRepository.findByServiceId(serviceId).isPresent()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(409, "服务已存在: " + serviceId));
        }

        ServiceIdentity service = tokenExchangeService.createServiceIdentity(
                serviceId, serviceName, description, allowedScopes);
        log.info("Service identity created: serviceId={}", serviceId);
        return ResponseEntity.ok(ApiResponse.success("服务身份创建成功", service));
    }

    @GetMapping("/services")
    public ResponseEntity<ApiResponse<List<ServiceIdentity>>> getAllServices() {
        List<ServiceIdentity> services = serviceIdentityRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success("服务身份列表查询成功", services));
    }

    @GetMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<ServiceIdentity>> getServiceByServiceId(@PathVariable String serviceId) {
        Optional<ServiceIdentity> service = serviceIdentityRepository.findByServiceId(serviceId);
        if (service.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "服务不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success("服务身份查询成功", service.get()));
    }

    @PutMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<ServiceIdentity>> updateService(
            @PathVariable String serviceId,
            @RequestBody Map<String, Object> request) {
        Optional<ServiceIdentity> serviceOpt = serviceIdentityRepository.findByServiceId(serviceId);
        if (serviceOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "服务不存在"));
        }

        ServiceIdentity service = serviceOpt.get();
        if (request.containsKey("serviceName")) {
            service.setServiceName((String) request.get("serviceName"));
        }
        if (request.containsKey("description")) {
            service.setDescription((String) request.get("description"));
        }
        if (request.containsKey("allowedScopes")) {
            service.setAllowedScopes((String) request.get("allowedScopes"));
        }
        if (request.containsKey("enabled")) {
            service.setEnabled((Boolean) request.get("enabled"));
        }
        service = serviceIdentityRepository.save(service);
        log.info("Service identity updated: serviceId={}", serviceId);
        return ResponseEntity.ok(ApiResponse.success("服务身份更新成功", service));
    }

    @DeleteMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<Void>> deleteService(@PathVariable String serviceId) {
        Optional<ServiceIdentity> serviceOpt = serviceIdentityRepository.findByServiceId(serviceId);
        if (serviceOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "服务不存在"));
        }
        serviceIdentityRepository.delete(serviceOpt.get());
        log.info("Service identity deleted: serviceId={}", serviceId);
        return ResponseEntity.ok(ApiResponse.success("服务身份删除成功", null));
    }

    // ==================== Exchange Scenario 管理 ====================

    @PostMapping("/scenarios")
    public ResponseEntity<ApiResponse<ExchangeScenario>> createScenario(@Valid @RequestBody Map<String, Object> request) {
        String scenarioCode = (String) request.get("scenarioCode");
        String scenarioName = (String) request.get("scenarioName");
        String description = (String) request.get("description");
        String sourceServiceId = (String) request.get("sourceServiceId");
        String targetServiceId = (String) request.get("targetServiceId");
        String allowedScopes = (String) request.get("allowedScopes");
        Integer defaultExpireMinutes = request.get("defaultExpireMinutes") != null ?
                Integer.parseInt(request.get("defaultExpireMinutes").toString()) : 15;

        if (scenarioCode == null || scenarioCode.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "scenarioCode 不能为空"));
        }
        if (scenarioName == null || scenarioName.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "scenarioName 不能为空"));
        }
        if (sourceServiceId == null || sourceServiceId.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "sourceServiceId 不能为空"));
        }
        if (targetServiceId == null || targetServiceId.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(400, "targetServiceId 不能为空"));
        }

        if (exchangeScenarioRepository.findByScenarioCode(scenarioCode).isPresent()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(409, "场景已存在: " + scenarioCode));
        }

        ExchangeScenario scenario = tokenExchangeService.createExchangeScenario(
                scenarioCode, scenarioName, description, sourceServiceId,
                targetServiceId, allowedScopes, defaultExpireMinutes);
        log.info("Exchange scenario created: scenarioCode={}", scenarioCode);
        return ResponseEntity.ok(ApiResponse.success("交换场景创建成功", scenario));
    }

    @GetMapping("/scenarios")
    public ResponseEntity<ApiResponse<List<ExchangeScenario>>> getAllScenarios() {
        List<ExchangeScenario> scenarios = exchangeScenarioRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success("交换场景列表查询成功", scenarios));
    }

    @GetMapping("/scenarios/{scenarioCode}")
    public ResponseEntity<ApiResponse<ExchangeScenario>> getScenarioByCode(@PathVariable String scenarioCode) {
        Optional<ExchangeScenario> scenario = exchangeScenarioRepository.findByScenarioCode(scenarioCode);
        if (scenario.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "场景不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success("交换场景查询成功", scenario.get()));
    }

    @PutMapping("/scenarios/{scenarioCode}")
    public ResponseEntity<ApiResponse<ExchangeScenario>> updateScenario(
            @PathVariable String scenarioCode,
            @RequestBody Map<String, Object> request) {
        Optional<ExchangeScenario> scenarioOpt = exchangeScenarioRepository.findByScenarioCode(scenarioCode);
        if (scenarioOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "场景不存在"));
        }

        ExchangeScenario scenario = scenarioOpt.get();
        if (request.containsKey("scenarioName")) {
            scenario.setScenarioName((String) request.get("scenarioName"));
        }
        if (request.containsKey("description")) {
            scenario.setDescription((String) request.get("description"));
        }
        if (request.containsKey("sourceServiceId")) {
            scenario.setSourceServiceId((String) request.get("sourceServiceId"));
        }
        if (request.containsKey("targetServiceId")) {
            scenario.setTargetServiceId((String) request.get("targetServiceId"));
        }
        if (request.containsKey("allowedScopes")) {
            scenario.setAllowedScopes((String) request.get("allowedScopes"));
        }
        if (request.containsKey("defaultExpireMinutes")) {
            scenario.setDefaultExpireMinutes((Integer) request.get("defaultExpireMinutes"));
        }
        if (request.containsKey("enabled")) {
            scenario.setEnabled((Boolean) request.get("enabled"));
        }
        scenario = exchangeScenarioRepository.save(scenario);
        log.info("Exchange scenario updated: scenarioCode={}", scenarioCode);
        return ResponseEntity.ok(ApiResponse.success("交换场景更新成功", scenario));
    }

    @DeleteMapping("/scenarios/{scenarioCode}")
    public ResponseEntity<ApiResponse<Void>> deleteScenario(@PathVariable String scenarioCode) {
        Optional<ExchangeScenario> scenarioOpt = exchangeScenarioRepository.findByScenarioCode(scenarioCode);
        if (scenarioOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error(404, "场景不存在"));
        }
        exchangeScenarioRepository.delete(scenarioOpt.get());
        log.info("Exchange scenario deleted: scenarioCode={}", scenarioCode);
        return ResponseEntity.ok(ApiResponse.success("交换场景删除成功", null));
    }
}
