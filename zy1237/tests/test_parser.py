import pytest
import tempfile
import json
import yaml
from pathlib import Path

from asyncio_analyzer.parser import Parser, ParseError


class TestParser:
    @pytest.fixture
    def temp_samples_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            samples_path = Path(tmpdir)
            (samples_path / 'snippets').mkdir()
            yield samples_path

    def test_parse_yaml_valid(self, temp_samples_dir):
        yaml_content = {
            'analysis': {
                'enabled_checks': ['event_loop_blocking'],
                'thresholds': {'blocking_duration_ms': 100}
            }
        }
        
        yaml_file = temp_samples_dir / 'async-plan.yaml'
        yaml_file.write_text(yaml.dump(yaml_content))
        
        parser = Parser(temp_samples_dir)
        result = parser.parse_yaml('async-plan.yaml')
        
        assert result['analysis']['enabled_checks'] == ['event_loop_blocking']

    def test_parse_yaml_invalid(self, temp_samples_dir):
        yaml_file = temp_samples_dir / 'async-plan.yaml'
        yaml_file.write_text('invalid: yaml: content: [')
        
        parser = Parser(temp_samples_dir)
        
        with pytest.raises(ParseError) as exc_info:
            parser.parse_yaml('async-plan.yaml')
        
        assert 'Invalid YAML format' in str(exc_info.value.message)
        assert exc_info.value.file is not None

    def test_parse_yaml_missing_file(self, temp_samples_dir):
        parser = Parser(temp_samples_dir)
        
        with pytest.raises(ParseError) as exc_info:
            parser.parse_yaml('nonexistent.yaml')
        
        assert 'File not found' in str(exc_info.value.message)

    def test_parse_jsonl_valid(self, temp_samples_dir):
        jsonl_content = [
            {'event_type': 'test1', 'timestamp': '2024-01-01'},
            {'event_type': 'test2', 'timestamp': '2024-01-02'},
        ]
        
        jsonl_file = temp_samples_dir / 'events.jsonl'
        lines = [json.dumps(event) for event in jsonl_content]
        jsonl_file.write_text('\n'.join(lines))
        
        parser = Parser(temp_samples_dir)
        result = parser.parse_jsonl('events.jsonl')
        
        assert len(result) == 2
        assert result[0]['event_type'] == 'test1'
        assert result[1]['event_type'] == 'test2'

    def test_parse_jsonl_invalid(self, temp_samples_dir):
        jsonl_file = temp_samples_dir / 'events.jsonl'
        jsonl_file.write_text('{"valid": true}\ninvalid json\n{"another": true}')
        
        parser = Parser(temp_samples_dir)
        
        with pytest.raises(ParseError) as exc_info:
            parser.parse_jsonl('events.jsonl')
        
        assert 'Invalid JSON format' in str(exc_info.value.message)
        assert exc_info.value.line == 2

    def test_parse_jsonl_missing_file(self, temp_samples_dir):
        parser = Parser(temp_samples_dir)
        result = parser.parse_jsonl('nonexistent.jsonl')
        assert result == []

    def test_get_snippets_valid(self, temp_samples_dir):
        snippet_content = '''
import asyncio

async def test():
    await asyncio.sleep(1)
'''
        snippet_file = temp_samples_dir / 'snippets' / 'test.py'
        snippet_file.write_text(snippet_content)
        
        parser = Parser(temp_samples_dir)
        snippets = parser.get_snippets()
        
        assert len(snippets) == 1
        assert snippets[0]['name'] == 'test.py'
        assert 'ast' in snippets[0]

    def test_get_snippets_invalid_syntax(self, temp_samples_dir):
        snippet_content = '''
def broken():
    if True
        print("error")
'''
        snippet_file = temp_samples_dir / 'snippets' / 'broken.py'
        snippet_file.write_text(snippet_content)
        
        parser = Parser(temp_samples_dir)
        
        with pytest.raises(ParseError) as exc_info:
            parser.get_snippets()
        
        assert 'Syntax error' in str(exc_info.value.message)

    def test_get_snippets_empty_dir(self, temp_samples_dir):
        parser = Parser(temp_samples_dir)
        snippets = parser.get_snippets()
        assert snippets == []
