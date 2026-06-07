import pandas as pd
import os
import json
from app import app, db, ManualJudgment, VersionHistory, ImportBatch

def create_sample_excel(file_path, model_version='v1.0', add_remark=False):
    data = [
        {
            '样本编号': 'S001',
            '模型版本': model_version,
            '提示词版本': '',
            '原始回答': '您好，请问有什么可以帮您？',
            '人工改判回答': '您好！我是智能客服，很高兴为您服务。请问有什么可以帮助您的？',
            '人工改动说明': '增加了问候语的友好度',
            '备注': '提示词版本待小孟确认' if add_remark else ''
        },
        {
            '样本编号': 'S002',
            '模型版本': model_version,
            '提示词版本': '',
            '原始回答': '退款需要3-5个工作日',
            '人工改判回答': '您好，退款申请提交后，我们会在3-5个工作日内处理完成，款项将原路退回。',
            '人工改动说明': '补充了退款路径说明',
            '备注': '这个样本需要注意边界情况' if add_remark else ''
        },
        {
            '样本编号': 'S003',
            '模型版本': model_version,
            '提示词版本': '',
            '原始回答': '请联系客服',
            '人工改判回答': '如遇问题，请您拨打客服热线400-888-8888，工作时间9:00-18:00。',
            '人工改动说明': '补充了客服电话和工作时间',
            '备注': ''
        }
    ]
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    print(f"✅ 已创建示例文件: {file_path}")
    return file_path

def test_full_workflow():
    print("\n" + "="*60)
    print("🧪 机器人话术版本仓库 - 完整功能测试")
    print("="*60)

    with app.app_context():
        db.create_all()
        
        ManualJudgment.query.delete()
        VersionHistory.query.delete()
        ImportBatch.query.delete()
        db.session.commit()

        test_dir = 'test_data'
        os.makedirs(test_dir, exist_ok=True)

        print("\n📌 测试1：第一次导入人工改判表（步骤1）")
        print("-" * 60)
        file1 = create_sample_excel(f'{test_dir}/batch01_v1.xlsx', model_version='v1.0')
        
        with app.test_client() as client:
            with open(file1, 'rb') as f:
                data = {
                    'file': (f, 'batch01_v1.xlsx'),
                    'batch_id': 'BATCH001',
                    'imported_by': '小孟'
                }
                resp = client.post('/api/import', data=data, content_type='multipart/form-data')
                result = resp.json
                print(f"   导入结果: 总计{result['total']}条, 新增{result['new']}条, 更新{result['updated']}条, 重复{result['duplicate']}条")
                assert result['total'] == 3
                assert result['new'] == 3
        
        records = ManualJudgment.query.filter_by(is_latest=True).all()
        print(f"   数据库记录数: {len(records)}")
        for r in records:
            print(f"   - 行号{r.original_row_number}: 样本{r.sample_id}, 模型{r.model_version}, 工作流{r.workflow_step}")

        print("\n📌 测试2：重复导入同一批表（验证不翻倍）")
        print("-" * 60)
        with app.test_client() as client:
            with open(file1, 'rb') as f:
                data = {
                    'file': (f, 'batch01_v1.xlsx'),
                    'batch_id': 'BATCH001',
                    'imported_by': '小孟'
                }
                resp = client.post('/api/import', data=data, content_type='multipart/form-data')
                result = resp.json
                print(f"   导入结果: 总计{result['total']}条, 新增{result['new']}条, 更新{result['updated']}条, 重复{result['duplicate']}条")
                assert result['duplicate'] == 3, "应该检测到3条重复数据"
        
        records = ManualJudgment.query.filter_by(is_latest=True).all()
        print(f"   数据库记录数（应该还是3条）: {len(records)}")
        assert len(records) == 3, "重复导入不应增加记录数"

        print("\n📌 测试3：小孟修改一条备注（验证版本历史）")
        print("-" * 60)
        record_s001 = ManualJudgment.query.filter_by(sample_id='S001', is_latest=True).first()
        print(f"   修改前备注: {record_s001.remarks}")
        
        with app.test_client() as client:
            resp = client.post(f'/api/record/{record_s001.id}/update_remark',
                json={'remarks': '提示词版本已确认为v2.1，这个样本表现很好', 'changed_by': '小孟'})
            print(f"   修改结果: {resp.json}")
        
        record_s001_new = ManualJudgment.query.filter_by(sample_id='S001', is_latest=True).first()
        print(f"   修改后备注: {record_s001_new.remarks}")
        
        versions = VersionHistory.query.filter_by(manual_judgment_id=record_s001.id).all()
        print(f"   版本历史记录数: {len(versions)}")
        for v in versions:
            print(f"   - 版本{v.version_number}: {v.field_name} 由 {v.changed_by} 修改")
            print(f"     旧值: {v.old_value}")
            print(f"     新值: {v.new_value}")
        assert len(versions) >= 1, "应该生成版本历史"

        print("\n📌 测试4：小孟补看提示词版本号（步骤2）")
        print("-" * 60)
        record_s002 = ManualJudgment.query.filter_by(sample_id='S002', is_latest=True).first()
        print(f"   补全前提示词版本: {record_s002.prompt_version}")
        print(f"   工作流状态: {record_s002.workflow_step}")
        
        with app.test_client() as client:
            resp = client.post(f'/api/record/{record_s002.id}/update_prompt_version',
                json={'prompt_version': 'prompt_v3.2', 'changed_by': '小孟'})
            print(f"   更新结果: {resp.json}")
        
        record_s002_new = ManualJudgment.query.filter_by(sample_id='S002', is_latest=True).first()
        print(f"   补全后提示词版本: {record_s002_new.prompt_version}")
        print(f"   工作流状态: {record_s002_new.workflow_step}")
        assert record_s002_new.workflow_step == 'step2_prompt_updated', "工作流应推进到步骤2"

        print("\n📌 测试5：模型版本换了但样本编号没变（边界规则触发）")
        print("-" * 60)
        file2 = create_sample_excel(f'{test_dir}/batch01_v2.xlsx', model_version='v2.0')
        
        with app.test_client() as client:
            with open(file2, 'rb') as f:
                data = {
                    'file': (f, 'batch01_v2.xlsx'),
                    'batch_id': 'BATCH001',
                    'imported_by': '小孟'
                }
                resp = client.post('/api/import', data=data, content_type='multipart/form-data')
                result = resp.json
                print(f"   导入结果: 总计{result['total']}条, 新增{result['new']}条, 更新{result['updated']}条, 重复{result['duplicate']}条")
                assert result['updated'] == 3, "应该更新3条记录"
        
        needs_review = ManualJudgment.query.filter_by(boundary_status='needs_review', is_latest=True).all()
        print(f"   触发边界规则待复核的记录数: {len(needs_review)}")
        for r in needs_review:
            print(f"   - 样本{r.sample_id}: {r.boundary_note}")
            print(f"     边界状态: {r.boundary_status}")
            print(f"     处理状态: {r.processing_status}")
        assert len(needs_review) == 3, "3条记录都应触发边界规则"

        print("\n📌 测试6：运营复核人复核（步骤3）")
        print("-" * 60)
        record_to_review = needs_review[0]
        print(f"   复核前 - 样本{record_to_review.sample_id}: 边界状态={record_to_review.boundary_status}")
        
        with app.test_client() as client:
            resp = client.post(f'/api/record/{record_to_review.id}/review',
                json={'action': 'approve', 'reviewer': '运营复核人', 'note': '确认模型升级正常，样本编号无误'})
            print(f"   复核结果: {resp.json}")
        
        record_reviewed = ManualJudgment.query.get(record_to_review.id)
        print(f"   复核后 - 样本{record_reviewed.sample_id}: 边界状态={record_reviewed.boundary_status}")
        print(f"   工作流状态: {record_reviewed.workflow_step}")
        print(f"   复核人: {record_reviewed.reviewer}")
        assert record_reviewed.boundary_status == 'normal', "复核通过后边界状态应为正常"
        assert record_reviewed.workflow_step == 'step3_reviewed', "工作流应推进到步骤3"

        print("\n📌 测试7：统计数据验证")
        print("-" * 60)
        with app.test_client() as client:
            resp = client.get('/api/statistics')
            stats = resp.json
            print(f"   总记录数: {stats['total']}")
            print(f"   待运营复核: {stats['needs_review']}")
            print(f"   步骤1: {stats['workflow_steps']['step1_imported']}")
            print(f"   步骤2: {stats['workflow_steps']['step2_prompt_updated']}")
            print(f"   步骤3: {stats['workflow_steps']['step3_reviewed']}")

        print("\n📌 测试8：导出数据验证（含所有原始字段）")
        print("-" * 60)
        with app.test_client() as client:
            resp = client.get('/api/export/BATCH001')
            assert resp.status_code == 200
            print(f"   导出成功，文件大小: {len(resp.data)} bytes")
            output_file = f'{test_dir}/export_test.xlsx'
            with open(output_file, 'wb') as f:
                f.write(resp.data)
            df_export = pd.read_excel(output_file)
            print(f"   导出列名: {list(df_export.columns)}")
            print(f"   导出行数: {len(df_export)}")
            assert '原始行号' in df_export.columns, "应包含原始行号"
            assert '人工改动说明' in df_export.columns, "应包含人工改动说明"
            assert '备注' in df_export.columns, "应包含备注"
            assert '边界状态' in df_export.columns, "应包含边界状态"

        print("\n" + "="*60)
        print("🎉 所有测试通过！核心功能验证完成：")
        print("="*60)
        print("✅ 原始行号、人工改动、备注全部保留")
        print("✅ 重复导入不翻倍")
        print("✅ 修改备注保留版本历史（改前改后可见）")
        print("✅ 三步工作流正常流转")
        print("✅ 模型版本变样本号不变时触发边界规则，待运营复核")
        print("✅ 导出数据包含所有证据字段")
        print("\n💡 现在可以运行 `python app.py` 启动Web界面查看效果")

if __name__ == '__main__':
    test_full_workflow()
