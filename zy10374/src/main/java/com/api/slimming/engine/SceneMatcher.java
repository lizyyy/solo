package com.api.slimming.engine;

import cn.hutool.core.util.StrUtil;
import com.api.slimming.entity.ClientScene;
import com.api.slimming.entity.SlimmingRule;
import com.api.slimming.mapper.ClientSceneMapper;
import com.api.slimming.mapper.SlimmingRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class SceneMatcher {

    @Autowired
    private SlimmingRuleMapper slimmingRuleMapper;

    @Autowired
    private ClientSceneMapper clientSceneMapper;

    public Optional<SlimmingRule> matchRule(String apiPath, String sceneCode) {
        if (StrUtil.isBlank(apiPath)) {
            return Optional.empty();
        }

        LambdaQueryWrapper<SlimmingRule> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(SlimmingRule::getApiPath, apiPath);
        queryWrapper.eq(SlimmingRule::getStatus, 20);

        if (StrUtil.isNotBlank(sceneCode)) {
            queryWrapper.and(wrapper ->
                    wrapper.eq(SlimmingRule::getSceneCode, sceneCode)
                            .or().isNull(SlimmingRule::getSceneCode)
            );
        }

        queryWrapper.and(wrapper ->
                wrapper.isNull(SlimmingRule::getEffectiveTime)
                        .or().le(SlimmingRule::getEffectiveTime, LocalDateTime.now())
        );

        queryWrapper.and(wrapper ->
                wrapper.isNull(SlimmingRule::getExpireTime)
                        .or().ge(SlimmingRule::getExpireTime, LocalDateTime.now())
        );

        List<SlimmingRule> rules = slimmingRuleMapper.selectList(queryWrapper);

        if (rules.isEmpty()) {
            return Optional.empty();
        }

        if (StrUtil.isNotBlank(sceneCode)) {
            Optional<SlimmingRule> exactMatch = rules.stream()
                    .filter(rule -> sceneCode.equals(rule.getSceneCode()))
                    .max(Comparator.comparing(SlimmingRule::getCreateTime));

            if (exactMatch.isPresent()) {
                return exactMatch;
            }
        }

        return rules.stream()
                .filter(rule -> StrUtil.isBlank(rule.getSceneCode()))
                .max(Comparator.comparing(SlimmingRule::getCreateTime));
    }

    public ClientScene getSceneByCode(String sceneCode) {
        if (StrUtil.isBlank(sceneCode)) {
            return null;
        }

        LambdaQueryWrapper<ClientScene> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(ClientScene::getSceneCode, sceneCode);

        return clientSceneMapper.selectOne(queryWrapper);
    }

    public boolean isSceneValid(String sceneCode) {
        ClientScene scene = getSceneByCode(sceneCode);
        return scene != null;
    }

    public List<SlimmingRule> findRulesByApiPath(String apiPath) {
        LambdaQueryWrapper<SlimmingRule> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(SlimmingRule::getApiPath, apiPath);
        queryWrapper.eq(SlimmingRule::getStatus, 20);

        return slimmingRuleMapper.selectList(queryWrapper);
    }
}
