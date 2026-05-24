# Gradle 依赖替换报告

**生成时间**: 2026-05-24 23:00:45
**工具版本**: 0.1.0

## 退出码信息

- **退出码**: `0` (SUCCESS)
- **说明**: 执行成功，没有错误或冲突

## 统计信息

| 指标 | 数值 |
|------|------|
| 总依赖数 | 41 |
| 插件数 | 7 |
| 已变更依赖 | 8 |
| 未变更依赖 | 14 |
| 动态版本 | 0 |
| 冲突总数 | 20 |
| 严重冲突 | 0 |
| 错误冲突 | 0 |
| 警告冲突 | 20 |
| 信息冲突 | 0 |

## 冲突详情

### 🟡 Cross Source Conflict

**ID**: `cross-48ed7b1d`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.appcompat:appcompat 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.appcompat:appcompat:1.6.1
    来源: build.gradle
  - androidx.appcompat:appcompat:1.6.1
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-158217bd`

**严重程度**: `WARNING`

**描述**: 依赖 com.google.android.material:material 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.google.android.material:material:1.11.0
    来源: build.gradle
  - com.google.android.material:material:1.11.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-8e97b141`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.constraintlayout:constraintlayout 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.constraintlayout:constraintlayout:2.1.4
    来源: build.gradle
  - androidx.constraintlayout:constraintlayout:2.1.4
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-220d78b9`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.recyclerview:recyclerview 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.recyclerview:recyclerview:1.3.2
    来源: build.gradle
  - androidx.recyclerview:recyclerview:1.3.2
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-6b412611`

**严重程度**: `WARNING`

**描述**: 依赖 org.jetbrains.kotlin:kotlin-stdlib-jdk8 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.20
    来源: build.gradle
  - org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.20
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-9eadf022`

**严重程度**: `WARNING`

**描述**: 依赖 org.jetbrains.kotlinx:kotlinx-coroutines-core 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3
    来源: build.gradle
  - org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-f0bf79f3`

**严重程度**: `WARNING`

**描述**: 依赖 org.jetbrains.kotlinx:kotlinx-coroutines-android 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3
    来源: build.gradle
  - org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-eb919dfe`

**严重程度**: `WARNING`

**描述**: 依赖 com.squareup.retrofit2:retrofit 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.squareup.retrofit2:retrofit:2.9.0
    来源: build.gradle
  - com.squareup.retrofit2:retrofit:2.9.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-3a118dea`

**严重程度**: `WARNING`

**描述**: 依赖 com.squareup.retrofit2:converter-gson 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.squareup.retrofit2:converter-gson:2.9.0
    来源: build.gradle
  - com.squareup.retrofit2:converter-gson:2.9.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-23308402`

**严重程度**: `WARNING`

**描述**: 依赖 com.squareup.okhttp3:okhttp 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.squareup.okhttp3:okhttp:4.12.0
    来源: build.gradle
  - com.squareup.okhttp3:okhttp:4.12.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-814b2826`

**严重程度**: `WARNING`

**描述**: 依赖 com.squareup.okhttp3:logging-interceptor 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.squareup.okhttp3:logging-interceptor:4.12.0
    来源: build.gradle
  - com.squareup.okhttp3:logging-interceptor:4.12.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-0d1be4d7`

**严重程度**: `WARNING`

**描述**: 依赖 com.github.bumptech.glide:glide 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.github.bumptech.glide:glide:4.16.0
    来源: build.gradle
  - com.github.bumptech.glide:glide:4.16.0
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-f9229e4a`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.room:room-runtime 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.room:room-runtime:2.6.1
    来源: build.gradle
  - androidx.room:room-runtime:2.6.1
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-566ddbf7`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.room:room-ktx 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.room:room-ktx:2.6.1
    来源: build.gradle
  - androidx.room:room-ktx:2.6.1
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-80e143e7`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.lifecycle:lifecycle-viewmodel-ktx 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2
    来源: build.gradle
  - androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-64d3fd9d`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.lifecycle:lifecycle-livedata-ktx 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.lifecycle:lifecycle-livedata-ktx:2.6.2
    来源: build.gradle
  - androidx.lifecycle:lifecycle-livedata-ktx:2.6.2
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-9ef515e6`

**严重程度**: `WARNING`

**描述**: 依赖 junit:junit 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - junit:junit:4.13.2
    来源: build.gradle
  - junit:junit:4.13.2
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-91c77381`

**严重程度**: `WARNING`

**描述**: 依赖 androidx.test.espresso:espresso-core 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - androidx.test.espresso:espresso-core:3.5.1
    来源: build.gradle
  - androidx.test.espresso:espresso-core:3.5.1
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-25503207`

**严重程度**: `WARNING`

**描述**: 依赖 com.android.application 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - com.android.application
    来源: build.gradle
  - com.android.application:8.1.4
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

### 🟡 Cross Source Conflict

**ID**: `cross-bd0f1f15`

**严重程度**: `WARNING`

**描述**: 依赖 org.jetbrains.kotlin.android 在多个源中声明: version catalog, build.gradle

**涉及依赖**:

```
  - org.jetbrains.kotlin.android
    来源: build.gradle
  - org.jetbrains.kotlin.android:1.9.20
    来源: libs.versions.toml
```

**建议**: 建议统一在 version catalog 中管理依赖版本

## 替换链追踪

### `org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.0`

```
  原始: org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.0
  → org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.20 [规则: upgrade-kotlin-stdlib]
  最终: org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.20
```

### `com.squareup.okhttp3:okhttp:4.11.0`

```
  原始: com.squareup.okhttp3:okhttp:4.11.0
  → com.squareup.okhttp3:okhttp:4.12.0 [规则: upgrade-okhttp]
  最终: com.squareup.okhttp3:okhttp:4.12.0
```

### `com.squareup.okhttp3:logging-interceptor:4.11.0`

```
  原始: com.squareup.okhttp3:logging-interceptor:4.11.0
  → com.squareup.okhttp3:logging-interceptor:4.12.0 [规则: upgrade-okhttp]
  最终: com.squareup.okhttp3:logging-interceptor:4.12.0
```

### `com.github.bumptech.glide:glide:4.15.1`

```
  原始: com.github.bumptech.glide:glide:4.15.1
  → com.github.bumptech.glide:glide:4.16.0 [规则: upgrade-glide]
  最终: com.github.bumptech.glide:glide:4.16.0
```

### `androidx.room:room-runtime:2.5.2`

```
  原始: androidx.room:room-runtime:2.5.2
  → androidx.room:room-runtime:2.6.1 [规则: upgrade-room]
  最终: androidx.room:room-runtime:2.6.1
```

### `androidx.room:room-ktx:2.5.2`

```
  原始: androidx.room:room-ktx:2.5.2
  → androidx.room:room-ktx:2.6.1 [规则: upgrade-room]
  最终: androidx.room:room-ktx:2.6.1
```

### `androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.1`

```
  原始: androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.1
  → androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2 [规则: upgrade-lifecycle]
  最终: androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2
```

### `androidx.lifecycle:lifecycle-livedata-ktx:2.6.1`

```
  原始: androidx.lifecycle:lifecycle-livedata-ktx:2.6.1
  → androidx.lifecycle:lifecycle-livedata-ktx:2.6.2 [规则: upgrade-lifecycle]
  最终: androidx.lifecycle:lifecycle-livedata-ktx:2.6.2
```

## 生成文件

- `test-reports/dependency_report_20260524_230045.json`

## 输入文件

- `examples/build.gradle`
- `examples/libs.versions.toml`
- `examples/replacement-rules.yaml`
