import re
import json
from typing import List, Dict, Any, Tuple
from app import models


class PostmanParser:
    def __init__(self):
        self.assertion_patterns = [
            r'pm\.test\s*\(',
            r'tests\s*\[',
            r'pm\.expect\s*\(',
            r'responseBody\.hasOwnProperty',
            r'pm\.response\.to\.have\.status',
            r'pm\.response\.json\(\)',
        ]
        self.variable_pattern = r'\{\{(\w+)\}\}'

    def parse_collection(self, collection_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        collection_info = {
            'name': collection_data.get('info', {}).get('name', ''),
            'postman_id': collection_data.get('info', {}).get('_postman_id', ''),
            'schema_version': collection_data.get('info', {}).get('schema', ''),
            'raw_content': collection_data
        }

        requests = []
        self._traverse_items(collection_data.get('item', []), '', requests)

        return collection_info, requests

    def _traverse_items(self, items: List[Dict[str, Any]], folder_path: str, requests: List[Dict[str, Any]]):
        for item in items:
            if 'item' in item:
                new_folder = f"{folder_path}/{item.get('name', '')}" if folder_path else item.get('name', '')
                self._traverse_items(item['item'], new_folder, requests)
            else:
                request_data = self._parse_request(item, folder_path)
                if request_data:
                    requests.append(request_data)

    def _parse_request(self, item: Dict[str, Any], folder_path: str) -> Dict[str, Any]:
        request = item.get('request', {})
        url_info = request.get('url', {})

        if isinstance(url_info, str):
            url_str = url_info
            path = url_str
        else:
            url_str = url_info.get('raw', '')
            path_parts = url_info.get('path', [])
            path = '/'.join(path_parts) if isinstance(path_parts, list) else str(path_parts)

        assertions = self._extract_assertions(item)
        examples = self._extract_examples(item)
        variables = self._extract_variables(item)

        return {
            'name': item.get('name', ''),
            'method': request.get('method', ''),
            'url': url_str,
            'path': path,
            'folder_path': folder_path,
            'has_assertions': len(assertions) > 0,
            'has_examples': len(examples) > 0,
            'assertion_count': len(assertions),
            'example_count': len(examples),
            'assertions': assertions,
            'examples': examples,
            'variables': variables,
            'raw_request': item
        }

    def _extract_assertions(self, item: Dict[str, Any]) -> List[Dict[str, Any]]:
        assertions = []
        events = item.get('event', [])

        for event in events:
            if event.get('listen') == 'test':
                script = event.get('script', {})
                exec_content = script.get('exec', [])

                if isinstance(exec_content, list):
                    content = '\n'.join(exec_content)
                else:
                    content = str(exec_content)

                lines = content.split('\n')
                for line_num, line in enumerate(lines, 1):
                    for pattern in self.assertion_patterns:
                        if re.search(pattern, line):
                            assertions.append({
                                'type': self._classify_assertion(line),
                                'content': line.strip(),
                                'line_number': line_num,
                                'is_valid': True
                            })
                            break

        return assertions

    def _classify_assertion(self, line: str) -> str:
        if 'status' in line.lower():
            return 'status_code'
        elif 'json' in line.lower():
            return 'json_schema'
        elif 'time' in line.lower():
            return 'response_time'
        elif 'header' in line.lower():
            return 'header'
        elif 'body' in line.lower() or 'responseBody' in line:
            return 'body_content'
        else:
            return 'other'

    def _extract_examples(self, item: Dict[str, Any]) -> List[Dict[str, Any]]:
        examples = []
        responses = item.get('response', [])

        for resp in responses:
            original_request = resp.get('originalRequest', {})
            if isinstance(original_request, dict):
                method = original_request.get('method', '')
            else:
                method = ''

            body = resp.get('body', '')
            if isinstance(body, dict):
                body_str = json.dumps(body, ensure_ascii=False)
            else:
                body_str = str(body)

            examples.append({
                'name': resp.get('name', ''),
                'status_code': resp.get('code', 0),
                'content_type': resp.get('_postman_previewlanguage', ''),
                'body': body_str,
                'raw_example': resp
            })

        return examples

    def _extract_variables(self, item: Dict[str, Any]) -> List[Dict[str, Any]]:
        variables = []
        request = item.get('request', {})

        url_str = ''
        url_info = request.get('url', {})
        if isinstance(url_info, str):
            url_str = url_info
        else:
            url_str = url_info.get('raw', '')

        self._find_variables_in_text(url_str, 'url', variables)

        headers = request.get('header', [])
        for header in headers:
            if isinstance(header, dict):
                self._find_variables_in_text(header.get('value', ''), 'header', variables)

        body = request.get('body', {})
        if isinstance(body, dict):
            body_raw = body.get('raw', '')
            self._find_variables_in_text(body_raw, 'body', variables)

        events = item.get('event', [])
        for event in events:
            script = event.get('script', {})
            exec_content = script.get('exec', [])
            if isinstance(exec_content, list):
                content = '\n'.join(exec_content)
            else:
                content = str(exec_content)
            self._find_variables_in_text(content, 'script', variables)

        return variables

    def _find_variables_in_text(self, text: str, context: str, variables: List[Dict[str, Any]]):
        if not text:
            return

        lines = text.split('\n')
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(self.variable_pattern, line)
            for var_name in matches:
                variables.append({
                    'name': var_name,
                    'context': context,
                    'line_number': line_num,
                    'is_resolved': False
                })
