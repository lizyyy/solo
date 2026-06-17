# 塔吊维保阈值预警

这是一个 FastAPI 计算服务，用来把塔吊维保里的阈值预警、维修照片、补录备注、采样断档和导出变化串成可追溯的工作流。

## 能力范围

- 保留“维修照片/旧截图/补录备注”和具体异常点的关系。
- 计算失败时不丢记录，明确卡在公式、单位、阈值还是采样断档。
- 识别“平均值正常但峰值超阈值”的风险，并要求补证据。
- 采样断档时暂停最终报告，把疑点、来源和暂缓原因放到同一个待办包。
- 补录备注后生成导出差异，说明状态、结论和证据链怎么变了。
- 给项目助理输出可执行工作清单，给主管输出证据缺口看板。

## 运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn tower_warning.api:app --reload
```

打开 `http://127.0.0.1:8000/docs` 查看接口。

## 快速验证

```bash
pytest
```

## 关键接口

- `GET /records`：查看内置样例记录的计算状态。
- `POST /records/analyze`：提交一条维保记录并获得判定。
- `POST /records/{record_id}/evidence`：追加维修照片、旧截图或补录备注。
- `POST /records/{record_id}/remarks`：补录备注并返回导出变化。
- `GET /assistant/worklist`：项目助理小林的补料/放行清单。
- `GET /supervisor/evidence-gaps`：运营主管的证据缺口汇总。
- `GET /exports/{record_id}/preview`：查看报告导出预览。
