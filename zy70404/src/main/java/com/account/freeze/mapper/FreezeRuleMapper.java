package com.account.freeze.mapper;

import com.account.freeze.entity.FreezeRule;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface FreezeRuleMapper extends BaseMapper<FreezeRule> {

    @Select("SELECT MAX(rule_version) FROM freeze_rule WHERE status = 'ACTIVE' AND deleted = 0")
    Integer getMaxActiveVersion();

    @Select("SELECT * FROM freeze_rule WHERE rule_version = #{version} AND deleted = 0 LIMIT 1")
    FreezeRule selectByVersion(@Param("version") Integer version);
}
