import os
import uuid
from datetime import datetime
from typing import List, Dict, Tuple
import pandas as pd
from werkzeug.utils import secure_filename


class ResumeImporter:
    COLUMN_MAPPING = {
        'name': ['姓名', '名字', 'Name', 'name', 'Candidate Name'],
        'phone': ['手机', '手机号', '电话', 'Phone', 'phone', 'Mobile', 'Contact'],
        'email': ['邮箱', '电子邮件', 'Email', 'email', 'E-mail'],
        'id_number': ['身份证', '身份证号', '证件号', 'ID Number', 'ID', '证件号码'],
        'birth_date': ['生日', '出生日期', '出生年月', 'Birth Date', 'DOB'],
        'gender': ['性别', 'Gender', 'gender'],
        'education': ['学历', '最高学历', 'Education', 'Degree'],
        'school': ['学校', '毕业院校', '院校', 'School', 'University', 'College'],
        'major': ['专业', '所学专业', 'Major', 'Subject'],
        'work_years': ['工作年限', '工作经验', '工龄', 'Work Years', 'Experience'],
        'current_company': ['当前公司', '公司', '现公司', 'Company', 'Current Company'],
        'current_position': ['当前职位', '职位', '现职位', 'Position', 'Current Position'],
        'address': ['地址', '住址', '居住地址', 'Address', 'Location'],
        'expected_position': ['期望职位', '意向职位', '求职意向', 'Expected Position'],
        'expected_salary': ['期望薪资', '薪资要求', 'Expected Salary', 'Salary'],
        'application_time': ['申请时间', '投递时间', 'Application Time', 'Apply Date'],
        'source': ['来源', '招聘来源', '渠道', 'Source', 'Channel'],
        'external_id': ['编号', '简历编号', 'ID', 'Resume ID', 'External ID'],
    }
    
    @staticmethod
    def allowed_file(filename: str) -> bool:
        allowed_extensions = {'csv', 'xlsx', 'xls'}
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    @classmethod
    def read_file(cls, file_path: str) -> pd.DataFrame:
        if file_path.endswith('.csv'):
            try:
                return pd.read_csv(file_path, encoding='utf-8')
            except UnicodeDecodeError:
                return pd.read_csv(file_path, encoding='gbk')
        else:
            return pd.read_excel(file_path)
    
    @classmethod
    def _match_columns(cls, df: pd.DataFrame) -> Dict[str, str]:
        mapping = {}
        df_columns = set(df.columns)
        
        for target_field, possible_names in cls.COLUMN_MAPPING.items():
            for name in possible_names:
                if name in df_columns:
                    mapping[target_field] = name
                    break
                else:
                    for col in df_columns:
                        if name.lower() == col.lower():
                            mapping[target_field] = col
                            break
        
        return mapping
    
    @staticmethod
    def _clean_value(value) -> str:
        if pd.isna(value):
            return ''
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (int, float)):
            if value == int(value):
                return str(int(value))
            return str(value)
        return str(value)
    
    @classmethod
    def process_dataframe(cls, df: pd.DataFrame, batch_id: str) -> Tuple[List[Dict], List[Dict]]:
        mapping = cls._match_columns(df)
        
        success_records = []
        failed_records = []
        
        for idx, row in df.iterrows():
            try:
                record = {
                    'batch_id': batch_id,
                    'name': cls._clean_value(row.get(mapping.get('name', ''), '')),
                    'phone': cls._clean_value(row.get(mapping.get('phone', ''), '')),
                    'email': cls._clean_value(row.get(mapping.get('email', ''), '')),
                    'id_number': cls._clean_value(row.get(mapping.get('id_number', ''), '')),
                    'birth_date': cls._clean_value(row.get(mapping.get('birth_date', ''), '')),
                    'gender': cls._clean_value(row.get(mapping.get('gender', ''), '')),
                    'education': cls._clean_value(row.get(mapping.get('education', ''), '')),
                    'school': cls._clean_value(row.get(mapping.get('school', ''), '')),
                    'major': cls._clean_value(row.get(mapping.get('major', ''), '')),
                    'work_years': cls._clean_value(row.get(mapping.get('work_years', ''), '')),
                    'current_company': cls._clean_value(row.get(mapping.get('current_company', ''), '')),
                    'current_position': cls._clean_value(row.get(mapping.get('current_position', ''), '')),
                    'address': cls._clean_value(row.get(mapping.get('address', ''), '')),
                    'expected_position': cls._clean_value(row.get(mapping.get('expected_position', ''), '')),
                    'expected_salary': cls._clean_value(row.get(mapping.get('expected_salary', ''), '')),
                    'external_id': cls._clean_value(row.get(mapping.get('external_id', ''), '')),
                    'source': cls._clean_value(row.get(mapping.get('source', ''), '')),
                    'raw_data': row.to_dict(),
                }
                
                app_time = row.get(mapping.get('application_time', ''), None)
                if pd.notna(app_time):
                    try:
                        record['application_time'] = pd.to_datetime(app_time).to_pydatetime()
                    except:
                        pass
                
                if not record['name']:
                    raise ValueError('姓名为空')
                
                success_records.append(record)
            except Exception as e:
                failed_records.append({
                    'row_index': idx,
                    'error': str(e),
                    'raw_data': row.to_dict()
                })
        
        return success_records, failed_records
    
    @classmethod
    def import_file(cls, file_path: str, filename: str, upload_folder: str) -> Tuple[str, List[Dict], List[Dict], str]:
        batch_id = datetime.now().strftime('%Y%m%d%H%M%S') + '_' + uuid.uuid4().hex[:8]
        
        secure_name = secure_filename(filename)
        saved_filename = f"{batch_id}_{secure_name}"
        saved_path = os.path.join(upload_folder, saved_filename)
        
        df = cls.read_file(file_path)
        success_records, failed_records = cls.process_dataframe(df, batch_id)
        
        return batch_id, success_records, failed_records, saved_path
