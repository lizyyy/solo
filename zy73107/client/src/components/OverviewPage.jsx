import React, { useState, useEffect } from 'react';
import api, { endpoints } from '../api';
import { StatCard, ContributionRow, Badge, QuoteBox, CollisionCard, InfoGrid, EmptyState } from './common';
import DecisionsPanel from './DecisionsPanel';

export default function OverviewPage({ onJumpMaterial }) {
  const [data, setData] = useState(null);
  const [anomaly, setAnomaly] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [sum, dec, anomalyRes] = await Promise.all([
        api.get(endpoints.summary),
        api.get(endpoints.summaryDecisions),
        api.get(endpoints.summaryAnomaly)
      ]);
      setData(sum.data);
      setAnomaly(anomalyRes.data);
      setDecisions(dec.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading">正在汇总数据...</div>;
  if (!data) return <EmptyState title="无数据" desc="请先初始化数据或导入会议纪要" />;

  const { summary, anomalyMaterials, detailBreakdown } = data;
  const sc = summary.statusCount || {};

  return (
    <div>
      <div className="stats-grid">
        <StatCard variant="primary" value={summary.materialsTotal} label="材料总数"
          note="全部材料记录" />
        <StatCard variant="warning" value={sc.pending || 0} label="待复核"
          note={`占比 ${summary.materialsTotal ? Math.round((sc.pending||0)/summary.materialsTotal*100):0}%`} />
        <StatCard variant="danger" value={summary.collision.unresolved} label="未解决碰撞点"
          note={`严重 ${summary.collision.bySeverity.critical} / 警告 ${summary.collision.bySeverity.warning}`} />
        <StatCard variant="success" value={summary.anomalyCount} label="异常材料"
          note="需补材料+有碰撞待处理" />
        <StatCard variant="info" value={summary.meetingMinutes.total} label="会议纪要"
          note={`${summary.meetingMinutes.processedItems}/${summary.meetingMinutes.totalItems} 条已处理`} />
      </div>

      <div className="card mb-2">
        <div className="card-header">汇总明细联动</div>
        <div className="card-body">
          <div className="fs-12 mb-2" style={{color:'var(--text-muted)'}}>
            生成时间：{summary.generatedAt}</div>
          {Object.entries(detailBreakdown || {}).map(([label, info]) => (
            <ContributionRow
              key={label}
              label={label} value={info.value}
              breakdown={info.contribution}
              source={info.source}
            />
          ))}
        </div>
      </div>

      <div className="card" style={{marginTop: 16}}>
        <div className="card-header">异常明细（点下面每条都能看到拉动结果</div>
        <div className="card-body">
          {anomalyMaterials?.length === 0 ? (
            <EmptyState title="无异常材料" desc="所有材料状态正常" />
          ) : (
            <table>
            <thead>
              <tr>
                <th>材料编号</th>
                <th>名称</th>
                <th>状态</th>
                <th>异常原因（就是拉动汇总的来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {anomalyMaterials.map(a => (
                <tr key={a.materialId}>
                  <td><span className="font-mono">{a.materialNo}</span></td>
                  <td style={{fontWeight:500}}>{a.name}</td>
                  <td><span className={`badge ${a.status==='need_supplement'?'badge-warning':'badge-default'}`}>{a.statusLabel}</span></td>
                  <td>
                    <div className="fs-12" style={{lineHeight:1.7}}>
                      <strong>拉动原因：{a.reason}</strong>
                      <div className="mt-1">
                        {(a.unresolvedCollisions || []).map(c => (
                          <div key={c.id}>
                          <div className="flex gap-2 items-center mt-1">
                            <span className={`badge ${c.severity==='critical'?'badge-danger':c.severity==='warning'?'badge-warning':'badge-info'}`}>
                              {c.type}</span>
                            <span className="fs-12">{c.location}</span>
                          </div>
                          <QuoteBox text={c.originalQuote} source={c.sourceRef} />
                        </div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => onJumpMaterial && onJumpMaterial(a)}>进入复核</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <div style={{marginTop: 20}}>
        <div className="card-header mb-0">
          <div className="card-header">复核决策建议（结构工程师老叶专用输出）</div>
        </div>
        <div className="card-body">
          <DecisionsPanel
            decisions={decisions}
            onRefresh={load}
            onReviewMaterial={onJumpMaterial}
          />
        </div>
      </div>
    </div>
  );
}
