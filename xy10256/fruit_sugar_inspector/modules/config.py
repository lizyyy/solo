GRADE_STANDARDS = {
    'apple': {
        'description': '苹果糖度分级标准',
        'grades': {
            '特级': {'min_sugar': 14.0, 'max_sugar': None, 'description': '糖度≥14.0°Brix'},
            '一级': {'min_sugar': 12.0, 'max_sugar': 14.0, 'description': '12.0°Brix ≤ 糖度 < 14.0°Brix'},
            '二级': {'min_sugar': 10.0, 'max_sugar': 12.0, 'description': '10.0°Brix ≤ 糖度 < 12.0°Brix'},
            '等外': {'min_sugar': None, 'max_sugar': 10.0, 'description': '糖度 < 10.0°Brix'}
        },
        'valid_range': {'min': 7.0, 'max': 18.0}
    },
    'pear': {
        'description': '梨糖度分级标准',
        'grades': {
            '特级': {'min_sugar': 13.0, 'max_sugar': None, 'description': '糖度≥13.0°Brix'},
            '一级': {'min_sugar': 11.0, 'max_sugar': 13.0, 'description': '11.0°Brix ≤ 糖度 < 13.0°Brix'},
            '二级': {'min_sugar': 9.0, 'max_sugar': 11.0, 'description': '9.0°Brix ≤ 糖度 < 11.0°Brix'},
            '等外': {'min_sugar': None, 'max_sugar': 9.0, 'description': '糖度 < 9.0°Brix'}
        },
        'valid_range': {'min': 6.0, 'max': 17.0}
    },
    'orange': {
        'description': '柑橘糖度分级标准',
        'grades': {
            '特级': {'min_sugar': 12.0, 'max_sugar': None, 'description': '糖度≥12.0°Brix'},
            '一级': {'min_sugar': 10.0, 'max_sugar': 12.0, 'description': '10.0°Brix ≤ 糖度 < 12.0°Brix'},
            '二级': {'min_sugar': 8.5, 'max_sugar': 10.0, 'description': '8.5°Brix ≤ 糖度 < 10.0°Brix'},
            '等外': {'min_sugar': None, 'max_sugar': 8.5, 'description': '糖度 < 8.5°Brix'}
        },
        'valid_range': {'min': 5.0, 'max': 16.0}
    }
}

SAMPLING_RULES = {
    'min_sample_count': 30,
    'recommended_sample_count': 50,
    'sample_ratio': 0.05,
    'min_batch_size': 500,
    'confidence_threshold': 0.95,
    'batch_mix_threshold': 0.15,
    'grade_controversy_threshold': 0.08
}

CONFIG = {
    'output_dir': 'data/output',
    'sample_dir': 'data/samples',
    'file_format': 'json',
    'report_format': 'txt'
}
