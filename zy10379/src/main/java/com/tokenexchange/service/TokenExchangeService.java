package com.tokenexchange.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.tokenexchange.dto.*;
import com.tokenexchange.entity.*;
import com.tokenexchange.exception.TokenException;
import com.tokenexchange.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenExchangeService {
    private final UserTokenRepository userTokenRepository;
    private final ShortTokenRepository shortTokenRepository;
    private final ServiceIdentityRepository serviceIdentityRepository;
    private final ExchangeScenarioRepository exchangeScenarioRepository;
    private final TimelineService timelineService;
    private final UsageRecordService usageRecordService;
    private final IdempotencyService idempotencyService;
    private final ObjectMapper objectMapper;

    @Value("${token.exchange.jwt-secret:service-token-exchange-secret-key-2024}")
    private String jwtSecret;

    @Value("${token.exchange.default-short-token-expire-minutes:15}")
    private int defaultShortTokenExpireMinutes;

    @Value("${token.exchange.max-short-token-expire-minutes:60}")
    private int maxShortTokenExpireMinutes;

    private Algorithm getJwtAlgorithm() {
        return Algorithm.HMAC256(jwtSecret);
    }

    @Transactional
    public TokenExchangeResponse exchangeToken(TokenExchangeRequest request, String clientIp, String userAgent) {
        String requestId = request.getRequestId() != null ? request.getRequestId() : idempotencyService.generateRequestId();
        
        Optional<String> cachedResponse = idempotencyService.getCachedResponse(requestId, "TOKEN_EXCHANGE");
        if (cachedResponse.isPresent()) {
            try {
                TokenExchangeResponse response = objectMapper.readValue(cachedResponse.get(), TokenExchangeResponse.class);
                response.setFromCache(true);
                response.setRequestId(requestId);
                log.info("Returning cached response for request: {}", requestId);
                return response;
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse cached response", e);
            }
        }

        UserToken userToken = validateAndGetUserToken(request.getUserToken(), requestId);

        ServiceIdentity sourceService = validateService(request.getSourceServiceId(), requestId);
        ServiceIdentity targetService = validateService(request.getTargetServiceId(), requestId);

        ExchangeScenario scenario = null;
        if (request.getScenarioCode() != null && !request.getScenarioCode().isBlank()) {
            scenario = exchangeScenarioRepository.findByScenarioCodeAndEnabledTrue(request.getScenarioCode())
                    .orElseThrow(() -> TokenException.scenarioNotFound(request.getScenarioCode(), requestId));
        }

        Set<String> grantedScopes = calculateGrantedScopes(userToken.getScopes(), 
                                                            request.getRequestedScopes(), 
                                                            scenario, sourceService, targetService);

        int expireMinutes = calculateExpireMinutes(request.getExpireMinutes(), scenario);
        int maxUseCount = request.getMaxUseCount() != null && request.getMaxUseCount() > 0 ? request.getMaxUseCount() : 1;

        String shortTokenValue = generateShortToken(userToken.getUserId(), request.getSourceServiceId(),
                                                     request.getTargetServiceId(), grantedScopes, expireMinutes);

        ShortToken shortToken = new ShortToken();
        shortToken.setTokenValue(shortTokenValue);
        shortToken.setUserId(userToken.getUserId());
        shortToken.setSourceServiceId(request.getSourceServiceId());
        shortToken.setTargetServiceId(request.getTargetServiceId());
        shortToken.setScenarioCode(request.getScenarioCode());
        shortToken.setScopes(String.join(",", grantedScopes));
        shortToken.setIssuedAt(LocalDateTime.now());
        shortToken.setExpiresAt(LocalDateTime.now().plusMinutes(expireMinutes));
        shortToken.setMaxUseCount(maxUseCount);
        shortToken.setUseCount(0);
        shortToken.setRevoked(false);
        shortTokenRepository.save(shortToken);

        Map<String, Object> exchangeDetails = new HashMap<>();
        exchangeDetails.put("sourceService", request.getSourceServiceId());
        exchangeDetails.put("targetService", request.getTargetServiceId());
        exchangeDetails.put("scenario", request.getScenarioCode());
        exchangeDetails.put("grantedScopes", grantedScopes);
        exchangeDetails.put("expireMinutes", expireMinutes);
        exchangeDetails.put("maxUseCount", maxUseCount);

        timelineService.recordTokenExchanged(request.getUserToken(), shortTokenValue, 
                                              userToken.getUserId(), requestId, exchangeDetails);
        timelineService.recordTokenIssued(shortTokenValue, userToken.getUserId(), 
                                           "SHORT_TOKEN", requestId, exchangeDetails);

        usageRecordService.recordUsage(request.getUserToken(), "USER_TOKEN", userToken.getUserId(),
                                        request.getSourceServiceId(), "TOKEN_EXCHANGE", requestId,
                                        exchangeDetails, clientIp, userAgent, true, null);

        TokenExchangeResponse response = new TokenExchangeResponse();
        response.setShortToken(shortTokenValue);
        response.setUserId(userToken.getUserId());
        response.setSourceServiceId(request.getSourceServiceId());
        response.setTargetServiceId(request.getTargetServiceId());
        response.setScenarioCode(request.getScenarioCode());
        response.setGrantedScopes(String.join(",", grantedScopes));
        response.setIssuedAt(shortToken.getIssuedAt());
        response.setExpiresAt(shortToken.getExpiresAt());
        response.setMaxUseCount(maxUseCount);
        response.setRequestId(requestId);
        response.setFromCache(false);

        idempotencyService.cacheResponse(requestId, "TOKEN_EXCHANGE", response, 60);

        log.info("Token exchange successful: user={}, source={}, target={}", 
                 userToken.getUserId(), request.getSourceServiceId(), request.getTargetServiceId());
        return response;
    }

    @Transactional
    public TokenValidationResponse validateToken(TokenValidationRequest request, String clientIp, String userAgent) {
        String requestId = request.getRequestId() != null ? request.getRequestId() : idempotencyService.generateRequestId();
        
        String token = request.getToken();
        TokenValidationResponse response = new TokenValidationResponse();
        response.setRequestId(requestId);

        Optional<ShortToken> shortTokenOpt = shortTokenRepository.findByTokenValue(token);
        if (shortTokenOpt.isPresent()) {
            return validateShortToken(shortTokenOpt.get(), request, response, clientIp, userAgent);
        }

        Optional<UserToken> userTokenOpt = userTokenRepository.findByTokenValue(token);
        if (userTokenOpt.isPresent()) {
            return validateUserToken(userTokenOpt.get(), request, response, clientIp, userAgent);
        }

        response.setValid(false);
        response.setMessage("无效的令牌");
        timelineService.recordTokenValidated(token, "unknown", "UNKNOWN", false, requestId, null);
        usageRecordService.recordUsage(token, "UNKNOWN", "unknown", request.getServiceId(),
                                        "VALIDATE_TOKEN", requestId, null, clientIp, userAgent, false, "无效的令牌");
        throw TokenException.invalidToken(requestId);
    }

    @Transactional
    public ApiResponse<Void> revokeToken(TokenRevokeRequest request, String clientIp, String userAgent) {
        String requestId = request.getRequestId() != null ? request.getRequestId() : idempotencyService.generateRequestId();

        Optional<ShortToken> shortTokenOpt = shortTokenRepository.findByTokenValue(request.getToken());
        if (shortTokenOpt.isPresent()) {
            ShortToken shortToken = shortTokenOpt.get();
            shortToken.setRevoked(true);
            shortToken.setRevokedAt(LocalDateTime.now());
            shortToken.setRevokeReason(request.getReason());
            shortTokenRepository.save(shortToken);

            Map<String, Object> revokeDetails = new HashMap<>();
            revokeDetails.put("tokenType", "SHORT_TOKEN");
            revokeDetails.put("reason", request.getReason());
            revokeDetails.put("operatorId", request.getOperatorId());

            timelineService.recordTokenRevoked(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                                request.getReason(), request.getOperatorId(), requestId, revokeDetails);
            usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                            shortToken.getTargetServiceId(), "REVOKE_TOKEN", requestId,
                                            revokeDetails, clientIp, userAgent, true, null);

            log.info("Short token revoked: {}", request.getToken());
            return ApiResponse.success("短期令牌已撤销", null);
        }

        Optional<UserToken> userTokenOpt = userTokenRepository.findByTokenValue(request.getToken());
        if (userTokenOpt.isPresent()) {
            UserToken userToken = userTokenOpt.get();
            userToken.setRevoked(true);
            userToken.setRevokedAt(LocalDateTime.now());
            userToken.setRevokeReason(request.getReason());
            userTokenRepository.save(userToken);

            Map<String, Object> revokeDetails = new HashMap<>();
            revokeDetails.put("tokenType", "USER_TOKEN");
            revokeDetails.put("reason", request.getReason());
            revokeDetails.put("operatorId", request.getOperatorId());

            timelineService.recordTokenRevoked(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                                request.getReason(), request.getOperatorId(), requestId, revokeDetails);
            usageRecordService.recordUsage(request.getToken(), "USER_TOKEN", userToken.getUserId(),
                                            null, "REVOKE_TOKEN", requestId,
                                            revokeDetails, clientIp, userAgent, true, null);

            log.info("User token revoked: {}", request.getToken());
            return ApiResponse.success("用户令牌已撤销", null);
        }

        throw TokenException.invalidToken(requestId);
    }

    private UserToken validateAndGetUserToken(String tokenValue, String requestId) {
        UserToken userToken = userTokenRepository.findByTokenValue(tokenValue)
                .orElseThrow(() -> TokenException.invalidToken(requestId));

        if (userToken.getRevoked()) {
            throw TokenException.revokedToken(requestId);
        }
        if (userToken.isExpired()) {
            throw TokenException.expiredToken(requestId);
        }
        return userToken;
    }

    private ServiceIdentity validateService(String serviceId, String requestId) {
        ServiceIdentity service = serviceIdentityRepository.findByServiceId(serviceId)
                .orElseThrow(() -> TokenException.serviceNotFound(serviceId, requestId));

        if (!service.getEnabled()) {
            throw TokenException.serviceDisabled(serviceId, requestId);
        }
        return service;
    }

    private Set<String> calculateGrantedScopes(String originalScopesStr, String requestedScopesStr,
                                                ExchangeScenario scenario, ServiceIdentity sourceService,
                                                ServiceIdentity targetService) {
        Set<String> originalScopes = parseScopes(originalScopesStr);
        Set<String> requestedScopes = parseScopes(requestedScopesStr);
        Set<String> sourceAllowedScopes = parseScopes(sourceService.getAllowedScopes());
        Set<String> targetAllowedScopes = parseScopes(targetService.getAllowedScopes());
        Set<String> scenarioAllowedScopes = scenario != null ? parseScopes(scenario.getAllowedScopes()) : new HashSet<>();

        Set<String> grantedScopes = new HashSet<>(originalScopes);

        if (!requestedScopes.isEmpty()) {
            grantedScopes.retainAll(requestedScopes);
        }

        if (!sourceAllowedScopes.isEmpty()) {
            grantedScopes.retainAll(sourceAllowedScopes);
        }

        if (!targetAllowedScopes.isEmpty()) {
            grantedScopes.retainAll(targetAllowedScopes);
        }

        if (!scenarioAllowedScopes.isEmpty()) {
            grantedScopes.retainAll(scenarioAllowedScopes);
        }

        return grantedScopes;
    }

    private Set<String> parseScopes(String scopesStr) {
        if (scopesStr == null || scopesStr.isBlank()) {
            return new HashSet<>();
        }
        return Arrays.stream(scopesStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private int calculateExpireMinutes(Integer requestedMinutes, ExchangeScenario scenario) {
        int result = defaultShortTokenExpireMinutes;

        if (scenario != null && scenario.getDefaultExpireMinutes() != null) {
            result = scenario.getDefaultExpireMinutes();
        }

        if (requestedMinutes != null && requestedMinutes > 0) {
            result = Math.min(requestedMinutes, maxShortTokenExpireMinutes);
        }

        return result;
    }

    private String generateShortToken(String userId, String sourceServiceId, String targetServiceId,
                                       Set<String> scopes, int expireMinutes) {
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(expireMinutes);
        return JWT.create()
                .withSubject(userId)
                .withClaim("sourceService", sourceServiceId)
                .withClaim("targetService", targetServiceId)
                .withClaim("scopes", new ArrayList<>(scopes))
                .withExpiresAt(Date.from(expiresAt.atZone(ZoneId.systemDefault()).toInstant()))
                .withIssuedAt(new Date())
                .withJWTId(UUID.randomUUID().toString())
                .sign(getJwtAlgorithm());
    }

    private TokenValidationResponse validateShortToken(ShortToken shortToken, TokenValidationRequest request,
                                                        TokenValidationResponse response, String clientIp, String userAgent) {
        String requestId = response.getRequestId();
        response.setTokenType("SHORT_TOKEN");
        response.setUserId(shortToken.getUserId());
        response.setServiceId(shortToken.getTargetServiceId());
        response.setScopes(shortToken.getScopes());
        response.setIssuedAt(shortToken.getIssuedAt());
        response.setExpiresAt(shortToken.getExpiresAt());
        response.setUseCount(shortToken.getUseCount());
        response.setMaxUseCount(shortToken.getMaxUseCount());

        Map<String, Object> validationDetails = new HashMap<>();

        if (shortToken.getRevoked()) {
            response.setValid(false);
            response.setMessage("令牌已撤销");
            validationDetails.put("reason", "revoked");
            timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN", 
                                                  false, requestId, validationDetails);
            usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                            request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                            validationDetails, clientIp, userAgent, false, "令牌已撤销");
            throw TokenException.revokedToken(requestId);
        }

        if (shortToken.isExpired()) {
            response.setValid(false);
            response.setMessage("令牌已过期");
            validationDetails.put("reason", "expired");
            timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                                  false, requestId, validationDetails);
            usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                            request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                            validationDetails, clientIp, userAgent, false, "令牌已过期");
            throw TokenException.expiredToken(requestId);
        }

        if (shortToken.isExhausted()) {
            response.setValid(false);
            response.setMessage("令牌使用次数已耗尽");
            validationDetails.put("reason", "exhausted");
            timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                                  false, requestId, validationDetails);
            usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                            request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                            validationDetails, clientIp, userAgent, false, "令牌使用次数已耗尽");
            throw TokenException.exhaustedToken(requestId);
        }

        if (request.getServiceId() != null && !request.getServiceId().isBlank()) {
            if (!shortToken.getTargetServiceId().equals(request.getServiceId()) &&
                !shortToken.getSourceServiceId().equals(request.getServiceId())) {
                response.setValid(false);
                response.setMessage("令牌不属于此服务");
                validationDetails.put("reason", "wrong_service");
                validationDetails.put("expectedService", request.getServiceId());
                timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                                      false, requestId, validationDetails);
                usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                                request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                                validationDetails, clientIp, userAgent, false, "令牌不属于此服务");
                throw TokenException.insufficientScope(requestId);
            }
        }

        if (request.getRequiredScope() != null && !request.getRequiredScope().isBlank()) {
            Set<String> tokenScopes = parseScopes(shortToken.getScopes());
            if (!tokenScopes.contains(request.getRequiredScope())) {
                response.setValid(false);
                response.setMessage("权限范围不足");
                validationDetails.put("reason", "insufficient_scope");
                validationDetails.put("requiredScope", request.getRequiredScope());
                timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                                      false, requestId, validationDetails);
                usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                                request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                                validationDetails, clientIp, userAgent, false, "权限范围不足");
                throw TokenException.insufficientScope(requestId);
            }
        }

        shortToken.setUseCount(shortToken.getUseCount() + 1);
        shortTokenRepository.save(shortToken);

        response.setValid(true);
        response.setMessage("令牌验证成功");
        response.setUseCount(shortToken.getUseCount());

        validationDetails.put("reason", "success");
        validationDetails.put("newUseCount", shortToken.getUseCount());
        timelineService.recordTokenValidated(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                              true, requestId, validationDetails);
        timelineService.recordTokenUsed(request.getToken(), shortToken.getUserId(), "SHORT_TOKEN",
                                         shortToken.getTargetServiceId(), "VALIDATE_TOKEN", requestId, validationDetails);
        usageRecordService.recordUsage(request.getToken(), "SHORT_TOKEN", shortToken.getUserId(),
                                        request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                        validationDetails, clientIp, userAgent, true, null);

        return response;
    }

    private TokenValidationResponse validateUserToken(UserToken userToken, TokenValidationRequest request,
                                                       TokenValidationResponse response, String clientIp, String userAgent) {
        String requestId = response.getRequestId();
        response.setTokenType("USER_TOKEN");
        response.setUserId(userToken.getUserId());
        response.setScopes(userToken.getScopes());
        response.setIssuedAt(userToken.getIssuedAt());
        response.setExpiresAt(userToken.getExpiresAt());

        Map<String, Object> validationDetails = new HashMap<>();

        if (userToken.getRevoked()) {
            response.setValid(false);
            response.setMessage("令牌已撤销");
            validationDetails.put("reason", "revoked");
            timelineService.recordTokenValidated(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                                  false, requestId, validationDetails);
            usageRecordService.recordUsage(request.getToken(), "USER_TOKEN", userToken.getUserId(),
                                            request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                            validationDetails, clientIp, userAgent, false, "令牌已撤销");
            throw TokenException.revokedToken(requestId);
        }

        if (userToken.isExpired()) {
            response.setValid(false);
            response.setMessage("令牌已过期");
            validationDetails.put("reason", "expired");
            timelineService.recordTokenValidated(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                                  false, requestId, validationDetails);
            usageRecordService.recordUsage(request.getToken(), "USER_TOKEN", userToken.getUserId(),
                                            request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                            validationDetails, clientIp, userAgent, false, "令牌已过期");
            throw TokenException.expiredToken(requestId);
        }

        if (request.getRequiredScope() != null && !request.getRequiredScope().isBlank()) {
            Set<String> tokenScopes = parseScopes(userToken.getScopes());
            if (!tokenScopes.contains(request.getRequiredScope())) {
                response.setValid(false);
                response.setMessage("权限范围不足");
                validationDetails.put("reason", "insufficient_scope");
                validationDetails.put("requiredScope", request.getRequiredScope());
                timelineService.recordTokenValidated(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                                      false, requestId, validationDetails);
                usageRecordService.recordUsage(request.getToken(), "USER_TOKEN", userToken.getUserId(),
                                                request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                                validationDetails, clientIp, userAgent, false, "权限范围不足");
                throw TokenException.insufficientScope(requestId);
            }
        }

        response.setValid(true);
        response.setMessage("令牌验证成功");

        validationDetails.put("reason", "success");
        timelineService.recordTokenValidated(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                              true, requestId, validationDetails);
        timelineService.recordTokenUsed(request.getToken(), userToken.getUserId(), "USER_TOKEN",
                                         request.getServiceId(), "VALIDATE_TOKEN", requestId, validationDetails);
        usageRecordService.recordUsage(request.getToken(), "USER_TOKEN", userToken.getUserId(),
                                        request.getServiceId(), "VALIDATE_TOKEN", requestId,
                                        validationDetails, clientIp, userAgent, true, null);

        return response;
    }

    @Transactional
    public UserToken createUserToken(String userId, String scopes, int expireDays) {
        String tokenValue = JWT.create()
                .withSubject(userId)
                .withClaim("scopes", Arrays.asList(scopes.split(",")))
                .withExpiresAt(Date.from(LocalDateTime.now().plusDays(expireDays)
                        .atZone(ZoneId.systemDefault()).toInstant()))
                .withIssuedAt(new Date())
                .withJWTId(UUID.randomUUID().toString())
                .sign(getJwtAlgorithm());

        UserToken userToken = new UserToken();
        userToken.setTokenValue(tokenValue);
        userToken.setUserId(userId);
        userToken.setScopes(scopes);
        userToken.setIssuedAt(LocalDateTime.now());
        userToken.setExpiresAt(LocalDateTime.now().plusDays(expireDays));
        userToken.setRevoked(false);
        userTokenRepository.save(userToken);

        Map<String, Object> issueDetails = new HashMap<>();
        issueDetails.put("scopes", scopes);
        issueDetails.put("expireDays", expireDays);
        timelineService.recordTokenIssued(tokenValue, userId, "USER_TOKEN", null, issueDetails);

        log.info("User token created: userId={}", userId);
        return userToken;
    }

    @Transactional
    public ServiceIdentity createServiceIdentity(String serviceId, String serviceName,
                                                  String description, String allowedScopes) {
        ServiceIdentity service = new ServiceIdentity();
        service.setServiceId(serviceId);
        service.setServiceName(serviceName);
        service.setDescription(description);
        service.setServiceSecret(UUID.randomUUID().toString());
        service.setAllowedScopes(allowedScopes);
        service.setEnabled(true);
        serviceIdentityRepository.save(service);

        log.info("Service identity created: serviceId={}", serviceId);
        return service;
    }

    @Transactional
    public ExchangeScenario createExchangeScenario(String scenarioCode, String scenarioName,
                                                    String description, String sourceServiceId,
                                                    String targetServiceId, String allowedScopes,
                                                    int defaultExpireMinutes) {
        ExchangeScenario scenario = new ExchangeScenario();
        scenario.setScenarioCode(scenarioCode);
        scenario.setScenarioName(scenarioName);
        scenario.setDescription(description);
        scenario.setSourceServiceId(sourceServiceId);
        scenario.setTargetServiceId(targetServiceId);
        scenario.setAllowedScopes(allowedScopes);
        scenario.setDefaultExpireMinutes(defaultExpireMinutes);
        scenario.setEnabled(true);
        exchangeScenarioRepository.save(scenario);

        log.info("Exchange scenario created: scenarioCode={}", scenarioCode);
        return scenario;
    }
}
