package com.cache.orchestrator.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Slf4j
@Service
public class KeyResolverService {

    public List<String> resolveKeyPattern(String keyPattern) {
        log.debug("解析键模式: {}", keyPattern);
        
        List<String> resolvedKeys = new ArrayList<>();
        
        if (keyPattern.contains("*")) {
            resolvedKeys = resolveWildcardPattern(keyPattern);
        } else if (keyPattern.contains("[") && keyPattern.contains("]")) {
            resolvedKeys = resolveRangePattern(keyPattern);
        } else {
            resolvedKeys.add(keyPattern);
        }
        
        log.info("键模式 {} 解析出 {} 个键", keyPattern, resolvedKeys.size());
        return resolvedKeys;
    }

    private List<String> resolveWildcardPattern(String pattern) {
        List<String> keys = new ArrayList<>();
        
        String basePattern = pattern.replace("*", "");
        
        for (int i = 1; i <= 10; i++) {
            keys.add(basePattern + i);
        }
        
        if (keys.isEmpty()) {
            keys.add(pattern);
        }
        
        return keys;
    }

    private List<String> resolveRangePattern(String pattern) {
        List<String> keys = new ArrayList<>();
        
        Pattern rangePattern = Pattern.compile("\\[(\\d+)-(\\d+)\\]");
        java.util.regex.Matcher matcher = rangePattern.matcher(pattern);
        
        if (matcher.find()) {
            int start = Integer.parseInt(matcher.group(1));
            int end = Integer.parseInt(matcher.group(2));
            String prefix = pattern.substring(0, matcher.start());
            String suffix = pattern.substring(matcher.end());
            
            for (int i = start; i <= end; i++) {
                keys.add(prefix + i + suffix);
            }
        } else {
            keys.add(pattern);
        }
        
        return keys;
    }

    public boolean validateKeyPattern(String keyPattern) {
        if (keyPattern == null || keyPattern.trim().isEmpty()) {
            return false;
        }
        
        if (keyPattern.length() > 255) {
            return false;
        }
        
        if (keyPattern.chars().filter(ch -> ch == '*').count() > 2) {
            return false;
        }
        
        return true;
    }
}
