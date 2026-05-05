from datetime import datetime
from models import (
    db, RpcService, RpcMethod, ProtoService, ProtoMethod, ProtoMessage,
    MigrationTask, BadExample
)
from app import app


SAMPLE_RPC_SERVICES_YAML = """
defaults:
  namespace: com.example
  version: v1
  deadline_ms: 30000
  retry_policy:
    max_attempts: 3
    initial_backoff_ms: 100
    max_backoff_ms: 1000
    backoff_multiplier: 2
    retryable_errors:
      - TIMEOUT
      - UNAVAILABLE
      - INTERNAL_ERROR
  metadata:
    - key: Authorization
      description: Bearer token
    - key: X-Request-ID
      description: Request trace ID

services:
  - name: UserService
    description: 用户服务
    methods:
      - name: GetUser
        description: 获取用户信息
        deadline_ms: 10000
        idempotent_key: user_id
        request:
          fields:
            - name: user_id
              type: string
              required: true
              description: 用户唯一标识
            - name: include_details
              type: bool
              required: false
              description: 是否包含详细信息
        response:
          fields:
            - name: user_id
              type: string
              description: 用户ID
            - name: username
              type: string
              description: 用户名
            - name: email
              type: string
              description: 邮箱
            - name: profile
              type: object
              description: 用户资料
              fields:
                - name: avatar_url
                  type: string
                - name: bio
                  type: string
        error_codes:
          - code: NOT_FOUND
            http_code: 404
            description: 用户不存在
          - code: PERMISSION_DENIED
            http_code: 403
            description: 无权访问该用户
        metadata:
          - key: X-User-Context
            description: 用户上下文

      - name: CreateUser
        description: 创建用户
        idempotent_key: request_id
        request:
          fields:
            - name: request_id
              type: string
              required: true
              description: 幂等请求ID
            - name: username
              type: string
              required: true
            - name: email
              type: string
              required: true
            - name: password
              type: string
              required: true
        response:
          fields:
            - name: user_id
              type: string
            - name: created_at
              type: string
        error_codes:
          - code: ALREADY_EXISTS
            http_code: 409
            description: 用户名或邮箱已存在
          - code: INVALID_ARGUMENT
            http_code: 400
            description: 参数无效

  - name: OrderService
    description: 订单服务
    methods:
      - name: GetOrder
        description: 获取订单信息
        idempotent_key: order_id
        request:
          fields:
            - name: order_id
              type: string
              required: true
        response:
          fields:
            - name: order_id
              type: string
            - name: user_id
              type: string
            - name: status
              type: string
            - name: items
              type: array
              item_type: object
              fields:
                - name: product_id
                  type: string
                - name: quantity
                  type: int
                - name: price
                  type: float
            - name: total_amount
              type: float
        error_codes:
          - code: NOT_FOUND
            http_code: 404
            description: 订单不存在
"""


SAMPLE_PROTO_FILE = """
syntax = "proto3";

package com.example.v1;

option go_package = "example.com/api/v1";

message GetUserRequest {
  string user_id = 1;
  bool include_details = 2;
}

message UserProfile {
  string avatar_url = 1;
  string bio = 2;
}

message GetUserResponse {
  string user_id = 1;
  string username = 2;
  string email = 3;
  UserProfile profile = 4;
}

message CreateUserRequest {
  string request_id = 1;
  string username = 2;
  string email = 3;
  string password = 4;
}

message CreateUserResponse {
  string user_id = 1;
  string created_at = 2;
}

message OrderItem {
  string product_id = 1;
  int32 quantity = 2;
  double price = 3;
}

message GetOrderRequest {
  string order_id = 1;
}

message GetOrderResponse {
  string order_id = 1;
  string user_id = 2;
  string status = 3;
  repeated OrderItem items = 4;
  double total_amount = 5;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
}

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (GetOrderResponse);
}
"""


BAD_EXAMPLES = [
    {
        'example_type': 'field_mismatch',
        'name': '字段缺失 - gRPC 缺少必填字段',
        'description': '测试对比器是否能检测到 gRPC 响应缺失老 RPC 中存在的字段',
        'test_data': {
            'legacy': {
                'user_id': '123',
                'username': 'test_user',
                'email': 'test@example.com',
                'profile': {
                    'avatar_url': 'http://example.com/avatar.png',
                    'bio': 'Hello World'
                }
            },
            'grpc': {
                'user_id': '123',
                'username': 'test_user'
            }
        },
        'expected_issues': [
            {'issue_type': 'missing_field'},
            {'issue_type': 'missing_field'}
        ]
    },
    {
        'example_type': 'field_mismatch',
        'name': '类型不匹配 - 字段类型不一致',
        'description': '测试对比器是否能检测到字段类型差异',
        'test_data': {
            'legacy': {
                'user_id': '123',
                'age': 25,
                'is_active': True
            },
            'grpc': {
                'user_id': 123,
                'age': '25',
                'is_active': 'true'
            }
        },
        'expected_issues': [
            {'issue_type': 'type_mismatch'},
            {'issue_type': 'type_mismatch'},
            {'issue_type': 'type_mismatch'}
        ]
    },
    {
        'example_type': 'deadline_mismatch',
        'name': 'Deadline 差异过大',
        'description': '测试对比器是否能检测到超时设置差异过大',
        'test_data': {
            'legacy': {
                'deadline_ms': 5000,
                'elapsed_ms': 100
            },
            'grpc': {
                'deadline_ms': 60000,
                'elapsed_ms': 150
            }
        },
        'expected_issues': [
            {'issue_type': 'deadline_mismatch'}
        ]
    },
    {
        'example_type': 'status_code_mismatch',
        'name': '状态码不匹配 - 成功/失败不一致',
        'description': '测试对比器是否能检测到老 RPC 成功但 gRPC 失败的情况',
        'test_data': {
            'legacy': {
                'success': True,
                'status_code': 200
            },
            'grpc': {
                'success': False,
                'grpc_code': 13,
                'error': {
                    'code': 'INTERNAL',
                    'message': 'Internal error'
                }
            }
        },
        'expected_issues': [
            {'issue_type': 'success_mismatch'}
        ]
    },
    {
        'example_type': 'metadata',
        'name': '元数据缺失 - gRPC 缺少认证头',
        'description': '测试对比器是否能检测到 gRPC 缺少必要的元数据',
        'test_data': {
            'legacy': {
                'metadata': [
                    {'key': 'Authorization', 'value': 'Bearer token123'},
                    {'key': 'X-Request-ID', 'value': 'req-001'}
                ]
            },
            'grpc': {
                'metadata': [
                    {'key': 'X-Request-ID', 'value': 'req-001'}
                ]
            }
        },
        'expected_issues': [
            {'issue_type': 'metadata_missing'}
        ]
    },
    {
        'example_type': 'retry',
        'name': '重试策略不匹配',
        'description': '测试对比器是否能检测到重试策略差异',
        'test_data': {
            'legacy': {
                'retry_policy': {
                    'max_attempts': 5,
                    'initial_backoff_ms': 100,
                    'retryable_errors': ['TIMEOUT', 'UNAVAILABLE']
                }
            },
            'grpc': {
                'retry_policy': {
                    'max_attempts': 2,
                    'initial_backoff': '0.5s',
                    'retryable_status_codes': [4]
                }
            }
        },
        'expected_issues': [
            {'issue_type': 'max_attempts_mismatch'},
            {'issue_type': 'initial_backoff_mismatch'}
        ]
    }
]


def seed_all():
    """导入所有样例数据"""
    with app.app_context():
        result = {}
        
        from parsers import RpcServicesParser, ProtoParser
        
        parser = RpcServicesParser()
        parsed_rpc = parser.parse_content(SAMPLE_RPC_SERVICES_YAML)
        saved_rpc_services = parser.save_to_db(parsed_rpc)
        result['rpc_services'] = [s.name for s in saved_rpc_services]
        
        proto_parser = ProtoParser()
        parsed_proto = proto_parser.parse_content(SAMPLE_PROTO_FILE, 'user_service.proto')
        saved_proto_services = proto_parser.save_to_db(parsed_proto)
        result['proto_services'] = [s.service_name for s in saved_proto_services]
        
        if saved_rpc_services and saved_proto_services:
            rpc_service = saved_rpc_services[0]
            proto_service = saved_proto_services[0]
            
            task = MigrationTask(
                name='用户服务迁移评审 - 样例任务',
                description='这是一个样例任务，用于演示 RPC 到 gRPC 的迁移评审流程',
                rpc_service_id=rpc_service.id,
                proto_service_id=proto_service.id,
                status='pending'
            )
            task.config = {
                'legacy_adapter': {
                    'base_url': 'http://localhost:8080',
                    'timeout_ms': 30000
                },
                'grpc_adapter': {
                    'target': 'localhost:50051'
                },
                'retry_policy': {
                    'max_attempts': 3,
                    'initial_backoff_ms': 100
                },
                'error_mapping': {
                    'mappings': {
                        'NOT_FOUND': 5,
                        'PERMISSION_DENIED': 7,
                        'ALREADY_EXISTS': 6
                    }
                }
            }
            db.session.add(task)
            db.session.commit()
            result['task'] = task.name
        
        for example_data in BAD_EXAMPLES:
            example = BadExample(
                example_type=example_data['example_type'],
                name=example_data['name'],
                description=example_data['description']
            )
            example.test_data = example_data['test_data']
            example.expected_issues = example_data['expected_issues']
            db.session.add(example)
        
        db.session.commit()
        result['bad_examples'] = len(BAD_EXAMPLES)
        
        return result
