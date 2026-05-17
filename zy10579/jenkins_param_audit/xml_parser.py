import os
from typing import List, Tuple, Optional
from lxml import etree
from lxml.etree import _Element
from .models import (
    JenkinsParameter,
    BuildStep,
    ParseError,
    ParamType,
    JobAuditResult
)


class JenkinsXMLParser:
    DANGEROUS_PATTERNS = [
        ("rm -rf", "递归删除命令"),
        ("sudo", "sudo提权操作"),
        ("chmod 777", "不安全的权限设置"),
        ("> /dev/sd", "直接操作磁盘设备"),
        ("dd if=", "磁盘克隆/覆盖"),
        ("curl.*| bash", "管道执行远程脚本"),
        ("wget.*| bash", "管道执行远程脚本"),
        ("kubectl delete", "K8s资源删除"),
        ("terraform destroy", "Terraform资源销毁"),
        ("aws s3 rm", "AWS S3删除"),
    ]

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.file_lines: List[str] = []
        self.tree: Optional[_Element] = None
        self.line_map: dict = {}

    def _load_file(self) -> None:
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.file_lines = f.readlines()

    def _parse_with_line_numbers(self) -> _Element:
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.parse(self.file_path, parser)
        
        for elem in tree.iter():
            if elem.sourceline is not None:
                self.line_map[id(elem)] = elem.sourceline
        
        return tree.getroot()

    def _get_line_number(self, elem: _Element) -> int:
        return self.line_map.get(id(elem), 0)

    def _get_raw_xml(self, elem: _Element) -> str:
        return etree.tostring(elem, encoding='unicode', pretty_print=True)

    def _extract_param_type(self, elem: _Element) -> ParamType:
        tag = elem.tag
        for param_type in ParamType:
            if param_type.value in tag:
                return param_type
        return ParamType.UNKNOWN

    def _extract_parameter(self, param_elem: _Element) -> JenkinsParameter:
        name_elem = param_elem.find('.//name')
        default_elem = param_elem.find('.//defaultValue')
        desc_elem = param_elem.find('.//description')
        
        name = name_elem.text if name_elem is not None and name_elem.text else "UNKNOWN"
        default_value = default_elem.text if default_elem is not None else None
        description = desc_elem.text if desc_elem is not None else None
        
        param_type = self._extract_param_type(param_elem)
        
        choices = []
        if param_type == ParamType.CHOICE:
            choice_items = param_elem.findall('.//string')
            for item in choice_items:
                if item.text:
                    choices.append(item.text)
        
        line_number = self._get_line_number(param_elem)
        raw_xml = self._get_raw_xml(param_elem)
        
        return JenkinsParameter(
            name=name,
            param_type=param_type,
            default_value=default_value,
            description=description,
            raw_xml=raw_xml,
            line_number=line_number,
            choices=choices
        )

    def _extract_parameters(self, root: _Element) -> List[JenkinsParameter]:
        parameters: List[JenkinsParameter] = []
        
        param_defs = root.xpath('.//parameterDefinitions/*')
        for param_elem in param_defs:
            try:
                param = self._extract_parameter(param_elem)
                parameters.append(param)
            except Exception as e:
                line_number = self._get_line_number(param_elem)
                error = ParseError(
                    file_path=self.file_path,
                    line_number=line_number,
                    error_type="ParameterParseError",
                    message=f"解析参数失败: {str(e)}",
                    raw_content=self._get_raw_xml(param_elem)
                )
                self.parse_errors.append(error)
        
        return parameters

    def _check_dangerous_step(self, step_text: str) -> Tuple[bool, Optional[str]]:
        for pattern, reason in self.DANGEROUS_PATTERNS:
            import re
            if re.search(pattern, step_text, re.IGNORECASE):
                return True, reason
        return False, None

    def _extract_step_params(self, step_text: str, param_names: List[str]) -> List[str]:
        used_params = []
        for param_name in param_names:
            if f'${{{param_name}}}' in step_text or f'${param_name}' in step_text:
                used_params.append(param_name)
        return used_params

    def _extract_build_steps(self, root: _Element, param_names: List[str]) -> List[BuildStep]:
        build_steps: List[BuildStep] = []
        
        builders = root.xpath('.//builders/*')
        for builder in builders:
            try:
                step_type = builder.tag
                raw_xml = self._get_raw_xml(builder)
                line_number = self._get_line_number(builder)
                
                step_text = ' '.join(builder.itertext())
                
                is_dangerous, danger_reason = self._check_dangerous_step(step_text)
                uses_params = self._extract_step_params(step_text, param_names)
                
                build_step = BuildStep(
                    step_type=step_type,
                    raw_xml=raw_xml,
                    line_number=line_number,
                    uses_params=uses_params,
                    is_dangerous=is_dangerous,
                    danger_reason=danger_reason
                )
                build_steps.append(build_step)
            except Exception as e:
                line_number = self._get_line_number(builder)
                error = ParseError(
                    file_path=self.file_path,
                    line_number=line_number,
                    error_type="BuildStepParseError",
                    message=f"解析构建步骤失败: {str(e)}",
                    raw_content=self._get_raw_xml(builder)
                )
                self.parse_errors.append(error)
        
        return build_steps

    def parse(self) -> JobAuditResult:
        self.parse_errors: List[ParseError] = []
        
        self._load_file()
        root = self._parse_with_line_numbers()
        
        job_name = os.path.basename(os.path.dirname(self.file_path))
        if not job_name or job_name == '.':
            job_name = os.path.splitext(os.path.basename(self.file_path))[0]
        
        parameters = self._extract_parameters(root)
        param_names = [p.name for p in parameters]
        
        build_steps = self._extract_build_steps(root, param_names)
        
        result = JobAuditResult(
            job_name=job_name,
            file_path=os.path.abspath(self.file_path),
            parameters=parameters,
            build_steps=build_steps,
            parse_errors=self.parse_errors
        )
        
        return result
