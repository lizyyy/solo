# Maven Dependency Conflict Report

**Project**: assertj-core  
**Generated**: 2026-05-17 13:54:22  
**Input**: `/Users/lzy/pro/solo/workspaces/zy70572/sample-dependency-tree.txt`

## Summary

| Metric | Value |
|--------|-------|
| Total Dependencies | 39 |
| Unique Artifacts | 35 |
| Conflicts Found | 3 |
| Parse Errors | 0 |

## Conflicts

### [MEDIUM] `org.apache.httpcomponents:httpcore`

- **Resolved Version**: `4.4.15`
- **Conflicting Versions**: `4.4.10`
- **Scopes**: `compile`
- **Mediation Reason**: First declaration wins (depth: 1)

#### Exclusion Suggestions

| From Dependency | Exclude | Reason |
|-----------------|---------|--------|
| `org.apache.httpcomponents:httpasyncclient` | `org.apache.httpcomponents:httpcore` | Conflicts with resolved version 4.4.15 |

#### Maven XML Exclusions

```xml
<!-- Add this exclusion to org.apache.httpcomponents:httpasyncclient -->
<exclusion>
  <groupId>org.apache.httpcomponents</groupId>
  <artifactId>httpcore</artifactId>
</exclusion>

```

### [MEDIUM] `commons-logging:commons-logging`

- **Resolved Version**: `1.2`
- **Conflicting Versions**: `1.1.1`
- **Scopes**: `compile`
- **Mediation Reason**: First declaration wins (depth: 1)

#### Exclusion Suggestions

| From Dependency | Exclude | Reason |
|-----------------|---------|--------|
| `org.apache.httpcomponents:httpasyncclient` | `commons-logging:commons-logging` | Conflicts with resolved version 1.2 |

#### Maven XML Exclusions

```xml
<!-- Add this exclusion to org.apache.httpcomponents:httpasyncclient -->
<exclusion>
  <groupId>commons-logging</groupId>
  <artifactId>commons-logging</artifactId>
</exclusion>

```

### [MEDIUM] `org.springframework:spring-core`

- **Resolved Version**: `5.3.29`
- **Conflicting Versions**: `5.2.0.RELEASE`
- **Scopes**: `compile`
- **Mediation Reason**: Direct dependency declaration

#### Exclusion Suggestions

| From Dependency | Exclude | Reason |
|-----------------|---------|--------|
| `org.springframework:spring-context` | `org.springframework:spring-core` | Conflicts with resolved version 5.3.29 |

#### Maven XML Exclusions

```xml
<!-- Add this exclusion to org.springframework:spring-context -->
<exclusion>
  <groupId>org.springframework</groupId>
  <artifactId>spring-core</artifactId>
</exclusion>

```

