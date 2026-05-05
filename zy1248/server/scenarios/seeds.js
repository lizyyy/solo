const seedScenarios = [
  {
    id: 'cache-hit-scenario',
    name: '缓存命中场景',
    description: '演示浏览器如何使用缓存的资源，返回 200 (from cache)',
    category: 'cache',
    resources: [
      {
        path: '/static/style.css',
        body: 'body { background: white; }',
        contentType: 'text/css',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=31536000',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '第一次请求（缓存未命中）',
        request: {
          method: 'GET',
          url: '/static/style.css',
          headers: {}
        },
        expected: {
          statusCode: 200,
          cacheStatus: 'miss'
        }
      },
      {
        description: '第二次请求（缓存命中）',
        request: {
          method: 'GET',
          url: '/static/style.css',
          headers: {}
        },
        expected: {
          statusCode: 200,
          cacheStatus: 'hit'
        }
      }
    ]
  },
  {
    id: '304-not-modified-scenario',
    name: '304 Not Modified 场景',
    description: '演示缓存过期后如何通过条件请求重新验证，返回 304',
    category: 'cache',
    resources: [
      {
        path: '/api/data.json',
        body: '{"data": "cached content"}',
        contentType: 'application/json',
        etag: '"def456"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=60, must-revalidate',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '第一次请求（缓存未命中）',
        request: {
          method: 'GET',
          url: '/api/data.json',
          headers: {}
        },
        expected: {
          statusCode: 200
        }
      },
      {
        description: '模拟缓存过期后请求（将触发 304）',
        request: {
          method: 'GET',
          url: '/api/data.json',
          headers: {
            'Cache-Control': 'max-age=0'
          }
        },
        expected: {
          statusCode: 304
        }
      }
    ]
  },
  {
    id: '206-partial-content-scenario',
    name: '206 Partial Content 场景',
    description: '演示 Range 请求如何返回部分内容，用于断点续传',
    category: 'range',
    resources: [
      {
        path: '/large-file.bin',
        body: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        contentType: 'application/octet-stream',
        etag: '"ghi789"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '请求前 10 个字节',
        request: {
          method: 'GET',
          url: '/large-file.bin',
          headers: {
            'Range': 'bytes=0-9'
          }
        },
        expected: {
          statusCode: 206,
          contentRange: 'bytes 0-9/36'
        }
      },
      {
        description: '请求最后 5 个字节',
        request: {
          method: 'GET',
          url: '/large-file.bin',
          headers: {
            'Range': 'bytes=-5'
          }
        },
        expected: {
          statusCode: 206
        }
      }
    ]
  },
  {
    id: '301-redirect-scenario',
    name: '301 永久重定向场景',
    description: '演示 301 永久重定向如何影响后续请求',
    category: 'redirect',
    resources: [
      {
        path: '/old-page',
        body: '',
        contentType: 'text/html',
        etag: '"jkl012"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: '',
        redirect: {
          statusCode: 301,
          statusText: 'Moved Permanently',
          location: '/new-page'
        }
      },
      {
        path: '/new-page',
        body: '<h1>Welcome to New Page</h1>',
        contentType: 'text/html',
        etag: '"mno345"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '请求旧页面（将被重定向）',
        request: {
          method: 'GET',
          url: '/old-page',
          headers: {}
        },
        expected: {
          finalStatusCode: 200,
          redirectCount: 1
        }
      }
    ]
  },
  {
    id: '412-precondition-failed-scenario',
    name: '412 Precondition Failed 场景',
    description: '演示 If-Match 条件不满足时返回 412',
    category: 'conditional',
    resources: [
      {
        path: '/api/update',
        body: '{"version": 1}',
        contentType: 'application/json',
        etag: '"pqr678"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '使用错误的 ETag 进行条件更新',
        request: {
          method: 'PUT',
          url: '/api/update',
          headers: {
            'If-Match': '"wrong-etag"'
          },
          body: '{"version": 2}'
        },
        expected: {
          statusCode: 412
        }
      },
      {
        description: '使用正确的 ETag 进行条件更新',
        request: {
          method: 'PUT',
          url: '/api/update',
          headers: {
            'If-Match': '"pqr678"'
          },
          body: '{"version": 2}'
        },
        expected: {
          statusCode: 200
        }
      }
    ]
  },
  {
    id: 'vary-header-scenario',
    name: 'Vary 头场景',
    description: '演示 Vary 头如何影响缓存键的生成',
    category: 'cache',
    resources: [
      {
        path: '/api/content',
        body: '{"format": "json"}',
        contentType: 'application/json',
        etag: '"stu901"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: 'Accept'
      }
    ],
    testRequests: [
      {
        description: '请求 JSON 格式',
        request: {
          method: 'GET',
          url: '/api/content',
          headers: {
            'Accept': 'application/json'
          }
        },
        expected: {
          statusCode: 200
        }
      },
      {
        description: '请求 XML 格式（不同的 Accept 头，应该缓存未命中）',
        request: {
          method: 'GET',
          url: '/api/content',
          headers: {
            'Accept': 'application/xml'
          }
        },
        expected: {
          cacheStatus: 'miss'
        }
      }
    ]
  },
  {
    id: 'cors-preflight-scenario',
    name: 'CORS 预检场景',
    description: '演示跨域请求如何触发预检请求',
    category: 'cors',
    resources: [
      {
        path: '/api/cors-endpoint',
        body: '{"cors": "enabled"}',
        contentType: 'application/json',
        etag: '"vwx234"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '简单请求（不触发预检）',
        request: {
          method: 'GET',
          url: '/api/cors-endpoint',
          headers: {
            'Accept': 'application/json'
          },
          corsConfig: {
            enabled: true,
            allowOrigin: '*'
          }
        },
        expected: {
          statusCode: 200,
          preflight: false
        }
      },
      {
        description: '非简单请求（触发预检）',
        request: {
          method: 'DELETE',
          url: '/api/cors-endpoint',
          headers: {
            'X-Custom-Header': 'value',
            'Content-Type': 'application/json'
          },
          corsConfig: {
            enabled: true,
            allowOrigin: '*',
            allowMethods: 'GET, POST, DELETE',
            allowHeaders: 'X-Custom-Header, Content-Type'
          }
        },
        expected: {
          preflight: true
        }
      }
    ]
  },
  {
    id: 'no-cache-no-store-scenario',
    name: 'no-cache 和 no-store 场景',
    description: '演示 Cache-Control: no-cache 和 no-store 的区别',
    category: 'cache',
    resources: [
      {
        path: '/no-cache-resource',
        body: 'This resource must be revalidated',
        contentType: 'text/plain',
        etag: '"yz1"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: ''
      },
      {
        path: '/no-store-resource',
        body: 'This resource should not be stored',
        contentType: 'text/plain',
        etag: '"ab2"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-store',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '请求 no-cache 资源（会存储但每次都重新验证）',
        request: {
          method: 'GET',
          url: '/no-cache-resource',
          headers: {}
        },
        expected: {
          statusCode: 200
        }
      },
      {
        description: '请求 no-store 资源（不应该被存储）',
        request: {
          method: 'GET',
          url: '/no-store-resource',
          headers: {}
        },
        expected: {
          statusCode: 200,
          cacheStored: false
        }
      }
    ]
  },
  {
    id: 'redirect-chain-scenario',
    name: '重定向链场景',
    description: '演示多层重定向链和循环检测',
    category: 'redirect',
    resources: [
      {
        path: '/level1',
        body: '',
        contentType: 'text/html',
        etag: '"cd3"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: '',
        redirect: {
          statusCode: 302,
          statusText: 'Found',
          location: '/level2'
        }
      },
      {
        path: '/level2',
        body: '',
        contentType: 'text/html',
        etag: '"ef4"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: '',
        redirect: {
          statusCode: 302,
          statusText: 'Found',
          location: '/final'
        }
      },
      {
        path: '/final',
        body: '<h1>Final Destination</h1>',
        contentType: 'text/html',
        etag: '"gh5"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      }
    ],
    testRequests: [
      {
        description: '多层重定向链',
        request: {
          method: 'GET',
          url: '/level1',
          headers: {}
        },
        expected: {
          finalStatusCode: 200,
          redirectCount: 2
        }
      }
    ]
  }
];

module.exports = seedScenarios;
