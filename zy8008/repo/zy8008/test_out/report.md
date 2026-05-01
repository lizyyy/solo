# 崩溃日志分析报告

生成时间: 2026-05-01 20:10:57

## 构建信息

- **app_name**: MyApp
- **version_name**: 2.3.1
- **version_code**: 20301
- **build_type**: release
- **flavor**: production
- **platform**: android
- **build_time**: 2024-01-15T10:30:00Z
- **git_commit**: a1b2c3d4e5f6
- **git_branch**: release/2.3.1
- **sdk_version**: 34
- **min_sdk_version**: 24
- **target_sdk_version**: 34
- **proguard_mapping**: ./mapping.txt
- **symbols_file**: ./symbols.zip
- **package_name**: com.example.myapp
- **application_id**: com.example.myapp
- **signing_config**: release
- **abi_filters**: ['armeabi-v7a', 'arm64-v8a', 'x86_64']
- **build_features**: {'minify_enabled': True, 'r8_enabled': True, 'debuggable': False}

## 概览

- 总日志条目数: 21
- 崩溃分组数: 3
- 可疑堆栈数: 3
- 时间线事件数: 3

## 崩溃分组概览

| 分组ID | 异常类型 | 出现次数 | 首次出现 | 最后出现 |
|--------|----------|----------|----------|----------|
| d910d29cd9ba | ArrayIndexOutOfBoundsException | 1 | - | - |
| 6e0443a38c75 | java.lang.NullPointerException | 1 | 01-15 14:32 | 01-15 14:32 |
| 184aaef4f933 | java.net.SocketTimeoutExceptio | 1 | 01-15 14:34 | 01-15 14:34 |

## 可疑堆栈摘要

| 排名 | 置信度 | 异常类型 | 出现次数 | 签名 |
|------|--------|----------|----------|------|
| 1 | 50% | ArrayIndexOutOfBound | 1 | ArrayIndexOutOfBoundsException|java.util.ArrayList... |
| 2 | 50% | java.net.SocketTimeo | 1 | java.net.SocketTimeoutException|okhttp3.internal.h... |
| 3 | 30% | java.lang.NullPointe | 1 | java.lang.NullPointerException |

### 可疑堆栈 #1

- **置信度**: 50%
- **异常类型**: ArrayIndexOutOfBoundsException
- **出现次数**: 1

**关键帧**:


**示例堆栈**:

```

```

### 可疑堆栈 #2

- **置信度**: 50%
- **异常类型**: java.net.SocketTimeoutException
- **出现次数**: 1

**关键帧**:

  1. at okhttp3.internal.http2.Http2Stream$StreamTimeout.newTimeoutException(Http2Stream.java:678)
  2. at okhttp3.internal.http2.Http2Stream$StreamTimeout.exitAndThrowIfTimedOut(Http2Stream.java:686)
  3. at okhttp3.internal.http2.Http2Stream.takeResponseHeaders(Http2Stream.java:203)
  4. at com.example.myapp.network.ApiClient.makeRequest(ApiClient.java:123)

**示例堆栈**:

```
    at okhttp3.internal.http2.Http2Stream$StreamTimeout.newTimeoutException(Http2Stream.java:678)
    at okhttp3.internal.http2.Http2Stream$StreamTimeout.exitAndThrowIfTimedOut(Http2Stream.java:686)
    at okhttp3.internal.http2.Http2Stream.takeResponseHeaders(Http2Stream.java:203)
    at com.example.myapp.network.ApiClient.makeRequest(ApiClient.java:123)
```

### 可疑堆栈 #3

- **置信度**: 30%
- **异常类型**: java.lang.NullPointerException
- **出现次数**: 1

**关键帧**:

  1. 2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.String java.lang.Object.toString()' on a null object reference
  2. 2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at com.example.myapp.ui.MainActivity$3.onBindViewHolder(MainActivity.java:156)
  3. 2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Adapter.onBindViewHolder(RecyclerView.java:7065)
  4. 2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Adapter.bindViewHolder(RecyclerView.java:7107)
  5. 2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Recycler.tryGetViewHolderForPositionByDeadline(RecyclerView.java:6366)

**示例堆栈**:

```
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.String java.lang.Object.toString()' on a null object reference
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at com.example.myapp.ui.MainActivity$3.onBindViewHolder(MainActivity.java:156)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Adapter.onBindViewHolder(RecyclerView.java:7065)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Adapter.bindViewHolder(RecyclerView.java:7107)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Recycler.tryGetViewHolderForPositionByDeadline(RecyclerView.java:6366)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at androidx.recyclerview.widget.RecyclerView$Recycler.getViewForPosition(RecyclerView.java:6219)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at android.view.Choreographer$FrameDisplayEventReceiver.run(Choreographer.java:1035)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at android.os.Handler.handleCallback(Handler.java:883)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at android.os.Looper.loop(Looper.java:214)
2024-01-15 14:32:50.567 1234 9012 E AndroidRuntime: 	at android.app.ActivityThread.main(ActivityThread.java:7356)
```

## 崩溃时间线

| 时间 | 异常类型 | 消息 | 来源 |
|------|----------|------|------|
| - | ArrayIndexOutOfBound | length=5; index=5 | /Users/lzy/pro/soloc |
| 2024-01-15 14:32:50 | java.lang.NullPointe | Attempt to invoke virtual method 'java.lang.String... | /Users/lzy/pro/soloc |
| 2024-01-15 14:34:45 | java.net.SocketTimeo | timeout | /Users/lzy/pro/soloc |

---

*此报告由 crashlog-tool 自动生成*