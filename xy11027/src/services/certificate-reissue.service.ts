import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { 补办申请, 创建补办申请请求, 审核申请请求, 业务异常, 申请状态 } from '../types';

export class CertificateReissueService {
  
  private async 查找学员(学员编号?: string, 证件类型?: string, 证件号码?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (学员编号) {
        db.get('SELECT * FROM 学员 WHERE 学员编号 = ?', [学员编号], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      } else if (证件类型 && 证件号码) {
        db.get('SELECT * FROM 学员 WHERE 证件类型 = ? AND 证件号码 = ?', [证件类型, 证件号码], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      } else {
        resolve(null);
      }
    });
  }

  private async 查找原始证书(证书编号: string): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM 原始证书 WHERE 证书编号 = ?', [证书编号], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private async 查找校区(校区编号: string): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM 校区 WHERE 校区编号 = ?', [校区编号], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private async 检测重复申请(学员编号: string, 原始证书编号: string): Promise<{ 存在重复: boolean; 重复申请?: any; 异常类型?: string }> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM 补办申请 
         WHERE 学员编号 = ? 
         AND 原始证书编号 = ? 
         AND 申请状态 IN ('待审核', '待处理', '已通过')`,
        [学员编号, 原始证书编号],
        (err, rows) => {
          if (err) reject(err);
          else if (rows.length > 0) {
            resolve({ 存在重复: true, 重复申请: rows[0], 异常类型: '同一证书重复申请' });
          } else {
            resolve({ 存在重复: false });
          }
        }
      );
    });
  }

  private async 检测多校区重复申请(学员编号: string): Promise<{ 存在多校区: boolean; 校区列表?: string[]; 申请列表?: any[] }> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT s.申请校区编号, c.校区名称, s.申请编号, s.申请状态, s.申请日期
         FROM 补办申请 s
         LEFT JOIN 校区 c ON s.申请校区编号 = c.校区编号
         WHERE s.学员编号 = ? 
         AND s.申请状态 IN ('待审核', '待处理')
         ORDER BY s.申请日期 DESC`,
        [学员编号],
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            const 校区集合 = new Set(rows.map(r => r.申请校区编号));
            if (校区集合.size > 1) {
              resolve({
                存在多校区: true,
                校区列表: Array.from(校区集合),
                申请列表: rows
              });
            } else {
              resolve({ 存在多校区: false });
            }
          }
        }
      );
    });
  }

  private async 校验补办登记一致性(学员: any, 证书: any, 请求: 创建补办申请请求): Promise<{ 一致: boolean; 不一致字段?: string[]; 详情?: any }> {
    const 不一致字段: string[] = [];
    const 详情: any = {};

    if (学员.学员编号 !== 证书.学员编号) {
      不一致字段.push('学员归属');
      详情.学员归属 = `申请学员[${学员.姓名}]与证书归属学员不一致`;
    }

    if (请求.申请人联系电话 && !/^1[3-9]\d{9}$/.test(请求.申请人联系电话)) {
      不一致字段.push('联系电话格式');
      详情.联系电话格式 = '申请人联系电话格式不正确，应为11位手机号';
    }

    if (请求.补办原因 === '遗失' && !请求.登报声明编号) {
      不一致字段.push('遗失声明');
      详情.遗失声明 = '证书遗失补办需提供登报声明编号';
    }

    if (请求.补办原因 === '信息变更' && !请求.补办原因说明) {
      不一致字段.push('变更说明');
      详情.变更说明 = '信息变更补办需详细说明变更内容';
    }

    return {
      一致: 不一致字段.length === 0,
      不一致字段,
      详情
    };
  }

  private 记录操作日志(申请编号: string, 操作类型: string, 操作人: string, 操作详情: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const 日志编号 = `LOG${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
      db.run(
        `INSERT INTO 操作日志 (日志编号, 申请编号, 操作类型, 操作人, 操作详情)
         VALUES (?, ?, ?, ?, ?)`,
        [日志编号, 申请编号, 操作类型, 操作人, 操作详情],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async 创建补办申请(请求: 创建补办申请请求): Promise<{ 成功: boolean; 数据?: any; 错误?: 业务异常 }> {
    try {
      const 学员 = await this.查找学员(请求.学员编号, 请求.证件类型, 请求.证件号码);
      if (!学员) {
        return {
          成功: false,
          错误: {
            错误代码: 'STUDENT_NOT_FOUND',
            错误消息: '未找到学员信息',
            错误详情: '根据提供的学员编号或证件信息无法找到对应的学员记录',
            建议操作: '请核对学员编号和证件信息，或先办理学员注册手续'
          }
        };
      }

      const 原始证书 = await this.查找原始证书(请求.原始证书编号);
      if (!原始证书) {
        return {
          成功: false,
          错误: {
            错误代码: 'CERTIFICATE_NOT_FOUND',
            错误消息: '未找到原始证书信息',
            错误详情: `证书编号[${请求.原始证书编号}]不存在`,
            建议操作: '请核对原始证书编号，确保证书信息正确'
          }
        };
      }

      if (原始证书.证书状态 !== '有效') {
        return {
          成功: false,
          错误: {
            错误代码: 'CERTIFICATE_INVALID',
            错误消息: '原始证书状态异常',
            错误详情: `该证书当前状态为[${原始证书.证书状态}]，不允许补办`,
            建议操作: '请联系证书管理部门核实证书状态'
          }
        };
      }

      const 校区 = await this.查找校区(请求.申请校区编号);
      if (!校区) {
        return {
          成功: false,
          错误: {
            错误代码: 'CAMPUS_NOT_FOUND',
            错误消息: '申请校区不存在',
            错误详情: `校区编号[${请求.申请校区编号}]不存在`,
            建议操作: '请选择正确的申请校区'
          }
        };
      }

      const 重复检测结果 = await this.检测重复申请(学员.学员编号, 原始证书.证书编号);
      if (重复检测结果.存在重复) {
        return {
          成功: false,
          错误: {
            错误代码: 'DUPLICATE_APPLICATION',
            错误消息: '存在未完成的补办申请',
            错误详情: `该证书已有${重复检测结果.异常类型}，申请编号[${重复检测结果.重复申请?.申请编号}]，状态[${重复检测结果.重复申请?.申请状态}]`,
            建议操作: '请等待现有申请处理完成，或联系管理员撤销重复申请'
          }
        };
      }

      const 一致性校验 = await this.校验补办登记一致性(学员, 原始证书, 请求);
      const 多校区检测 = await this.检测多校区重复申请(学员.学员编号);

      let 最终状态: 申请状态 = '待审核';
      let 待处理原因 = '';

      if (!一致性校验.一致) {
        最终状态 = '待处理';
        待处理原因 = `材料不完整: ${一致性校验.不一致字段?.join('、')}`;
      }

      if (多校区检测.存在多校区) {
        最终状态 = '待处理';
        待处理原因 = 待处理原因 
          ? `${待处理原因}; 存在多校区同时申请: ${多校区检测.校区列表?.join('、')}`
          : `存在多校区同时申请: ${多校区检测.校区列表?.join('、')}`;
      }

      const 申请编号 = `SQ${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
      const 申请日期 = new Date().toISOString().split('T')[0];

      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO 补办申请 (
            申请编号, 学员编号, 原始证书编号, 申请校区编号, 申请日期,
            补办原因, 补办原因说明, 遗失地点, 登报声明编号,
            申请人联系电话, 申请人通讯地址, 收件方式, 申请状态, 驳回原因
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            申请编号, 学员.学员编号, 原始证书.证书编号, 校区.校区编号, 申请日期,
            请求.补办原因, 请求.补办原因说明 || null, 请求.遗失地点 || null, 请求.登报声明编号 || null,
            请求.申请人联系电话 || null, 请求.申请人通讯地址 || null, 请求.收件方式 || null,
            最终状态, 待处理原因 || null
          ],
          async (err) => {
            if (err) {
              reject(err);
            } else {
              await this.记录操作日志(申请编号, '创建申请', '系统', `补办申请创建成功，状态: ${最终状态}`);
              
              const 响应数据 = {
                申请编号,
                申请状态: 最终状态,
                申请日期,
                学员姓名: 学员.姓名,
                证书编号: 原始证书.证书编号,
                申请校区: 校区.校区名称
              };

              if (最终状态 === '待处理') {
                resolve({
                  成功: true,
                  数据: {
                    ...响应数据,
                    待处理原因,
                    处理建议: 多校区检测.存在多校区 
                      ? '请联系各校区协调处理，避免重复发证' 
                      : '请补充完善相关材料后提交审核'
                  }
                });
              } else {
                resolve({ 成功: true, 数据: 响应数据 });
              }
            }
          }
        );
      });
    } catch (error: any) {
      return {
        成功: false,
        错误: {
          错误代码: 'SYSTEM_ERROR',
          错误消息: '系统异常',
          错误详情: error.message,
          建议操作: '请稍后重试，或联系技术支持'
        }
      };
    }
  }

  async 审核补办申请(请求: 审核申请请求): Promise<{ 成功: boolean; 数据?: any; 错误?: 业务异常 }> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM 补办申请 WHERE 申请编号 = ?', [请求.申请编号], async (err, 申请: any) => {
        if (err) {
          reject(err);
        } else if (!申请) {
          resolve({
            成功: false,
            错误: {
              错误代码: 'APPLICATION_NOT_FOUND',
              错误消息: '申请不存在',
              错误详情: `申请编号[${请求.申请编号}]不存在`,
              建议操作: '请核对申请编号'
            }
          });
        } else if (申请.申请状态 !== '待审核' && 申请.申请状态 !== '待处理') {
          resolve({
            成功: false,
            错误: {
              错误代码: 'INVALID_STATUS',
              错误消息: '申请状态不允许审核',
              错误详情: `当前申请状态为[${申请.申请状态}]，仅待审核或待处理状态可审核`,
              建议操作: '请确认申请状态是否正确'
            }
          });
        } else {
          let 新状态: 申请状态;
          let 新证书编号: string | null = null;
          let 操作详情 = '';

          if (请求.审核结果 === '通过') {
            新状态 = '已通过';
            新证书编号 = `ZS${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
            操作详情 = `审核通过，新证书编号: ${新证书编号}`;

            await new Promise<void>((res) => {
              db.run(
                `INSERT INTO 原始证书 (
                  证书编号, 学员编号, 项目编号, 校区编号, 培训开始日期,
                  培训结束日期, 发证日期, 成绩, 证书状态, 首次发证, 备注
                ) SELECT ?, 学员编号, 项目编号, 校区编号, 培训开始日期,
                  培训结束日期, ?, 成绩, '有效', 0, '补办证书'
                FROM 原始证书 WHERE 证书编号 = ?`,
                [新证书编号, new Date().toISOString().split('T')[0], 申请.原始证书编号],
                (err) => res()
              );
            });
          } else if (请求.审核结果 === '驳回') {
            新状态 = '已驳回';
            操作详情 = `审核驳回，原因: ${请求.驳回原因 || '未说明'}`;
          } else {
            新状态 = '待处理';
            操作详情 = `设置为待处理，意见: ${请求.审核意见 || '未说明'}`;
          }

          db.run(
            `UPDATE 补办申请 
             SET 申请状态 = ?, 审核人 = ?, 审核日期 = ?, 审核意见 = ?, 驳回原因 = ?, 新证书编号 = ?
             WHERE 申请编号 = ?`,
            [
              新状态, 请求.审核人, new Date().toISOString().split('T')[0],
              请求.审核意见 || null, 请求.驳回原因 || null, 新证书编号, 请求.申请编号
            ],
            async (err) => {
              if (err) {
                reject(err);
              } else {
                await this.记录操作日志(请求.申请编号, '审核申请', 请求.审核人, 操作详情);
                resolve({
                  成功: true,
                  数据: {
                    申请编号: 请求.申请编号,
                    申请状态: 新状态,
                    审核人: 请求.审核人,
                    审核日期: new Date().toISOString().split('T')[0],
                    新证书编号
                  }
                });
              }
            }
          );
        }
      });
    });
  }

  async 查询申请列表(查询条件?: { 学员编号?: string; 申请状态?: string; 校区编号?: string }): Promise<any[]> {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          s.申请编号,
          s.申请日期,
          s.申请状态,
          x.姓名 AS 学员姓名,
          x.证件号码,
          z.项目编号,
          p.项目名称,
          c.校区名称 AS 申请校区,
          s.补办原因,
          s.补办原因说明,
          s.审核人,
          s.审核日期,
          s.驳回原因,
          s.新证书编号
        FROM 补办申请 s
        LEFT JOIN 学员 x ON s.学员编号 = x.学员编号
        LEFT JOIN 原始证书 z ON s.原始证书编号 = z.证书编号
        LEFT JOIN 培训项目 p ON z.项目编号 = p.项目编号
        LEFT JOIN 校区 c ON s.申请校区编号 = c.校区编号
        WHERE 1=1
      `;
      const params: any[] = [];

      if (查询条件?.学员编号) {
        sql += ` AND s.学员编号 = ?`;
        params.push(查询条件.学员编号);
      }
      if (查询条件?.申请状态) {
        sql += ` AND s.申请状态 = ?`;
        params.push(查询条件.申请状态);
      }
      if (查询条件?.校区编号) {
        sql += ` AND s.申请校区编号 = ?`;
        params.push(查询条件.校区编号);
      }

      sql += ` ORDER BY s.申请日期 DESC, s.创建时间 DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async 获取申请详情(申请编号: string): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          s.*,
          x.姓名 AS 学员姓名,
          x.证件类型,
          x.证件号码,
          x.联系电话 AS 学员联系电话,
          z.项目编号,
          p.项目名称,
          p.发证机构,
          z.发证日期 AS 原证书发证日期,
          c1.校区名称 AS 原发证校区,
          c2.校区名称 AS 申请校区
        FROM 补办申请 s
        LEFT JOIN 学员 x ON s.学员编号 = x.学员编号
        LEFT JOIN 原始证书 z ON s.原始证书编号 = z.证书编号
        LEFT JOIN 培训项目 p ON z.项目编号 = p.项目编号
        LEFT JOIN 校区 c1 ON z.校区编号 = c1.校区编号
        LEFT JOIN 校区 c2 ON s.申请校区编号 = c2.校区编号
        WHERE s.申请编号 = ?`,
        [申请编号],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

export default new CertificateReissueService();
