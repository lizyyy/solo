import db from '../config/database';

export class ExportService {
  async 导出补办申请数据(格式: 'json' | 'csv' = 'json'): Promise<any> {
    const 数据 = await this.查询完整申请数据();
    
    if (format === 'csv') {
      return this.生成CSV格式(数据);
    } else {
      return {
        导出时间: new Date().toISOString(),
        数据总数: 数据.length,
        字段说明: this.获取字段说明(),
        数据列表: 数据
      };
    }
  }

  private 查询完整申请数据(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          s.申请编号,
          s.申请日期,
          s.申请状态,
          s.补办原因,
          s.补办原因说明,
          s.遗失地点,
          s.登报声明编号,
          s.申请人联系电话,
          s.申请人通讯地址,
          s.收件方式,
          s.审核人,
          s.审核日期,
          s.审核意见,
          s.驳回原因,
          s.新证书编号,
          x.学员编号,
          x.姓名 AS 学员姓名,
          x.证件类型,
          x.证件号码,
          x.性别,
          x.联系电话 AS 学员联系电话,
          z.原始证书编号,
          z.项目编号,
          p.项目名称,
          p.项目类型,
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
        ORDER BY s.申请日期 DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  private 获取字段说明(): Record<string, string> {
    return {
      申请编号: '补办申请的唯一标识编号',
      申请日期: '提交补办申请的日期',
      申请状态: '当前申请状态（待审核/待处理/已通过/已驳回）',
      补办原因: '补办原因（遗失/损毁/信息变更/其他）',
      补办原因说明: '补办原因的详细说明',
      遗失地点: '证书遗失地点（仅遗失原因需填写）',
      登报声明编号: '遗失声明登报编号（仅遗失原因需提供）',
      申请人联系电话: '申请人当前联系电话',
      申请人通讯地址: '申请人当前通讯地址',
      收件方式: '新证书领取方式（邮寄/自取）',
      审核人: '审核人员姓名',
      审核日期: '审核完成日期',
      审核意见: '审核人员意见',
      驳回原因: '申请被驳回的具体原因',
      新证书编号: '补办后新证书编号',
      学员编号: '学员系统唯一编号',
      学员姓名: '学员真实姓名',
      证件类型: '证件类型（身份证/护照等）',
      证件号码: '证件号码',
      性别: '学员性别',
      学员联系电话: '学员注册时预留的联系电话',
      原始证书编号: '原证书的编号',
      项目编号: '培训项目编号',
      项目名称: '培训项目名称',
      项目类型: '培训项目类型',
      发证机构: '证书颁发机构',
      原证书发证日期: '原始证书的发证日期',
      原发证校区: '原始证书颁发的校区',
      申请校区: '提交补办申请的校区'
    };
  }

  private 生成CSV格式(数据: any[]): string {
    if (数据.length === 0) return '';
    
    const 字段列表 = Object.keys(this.获取字段说明());
    const 表头 = 字段列表.join(',');
    const 行数据 = 数据.map(行 => {
      return 字段列表.map(字段 => {
        const 值 = 行[字段] || '';
        const 转义值 = String(值).replace(/"/g, '""');
        return `"${转义值}"`;
      }).join(',');
    });
    
    return [表头, ...行数据].join('\n');
  }

  async 导出学员证书记录(学员编号: string, format: 'json' | 'csv' = 'json'): Promise<any> {
    const 数据 = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT 
          z.证书编号,
          z.发证日期,
          z.证书状态,
          z.首次发证,
          z.成绩,
          z.备注,
          p.项目编号,
          p.项目名称,
          p.项目类型,
          p.发证机构,
          p.证书有效期,
          c.校区名称 AS 发证校区,
          x.姓名 AS 学员姓名
        FROM 原始证书 z
        LEFT JOIN 培训项目 p ON z.项目编号 = p.项目编号
        LEFT JOIN 校区 c ON z.校区编号 = c.校区编号
        LEFT JOIN 学员 x ON z.学员编号 = x.学员编号
        WHERE z.学员编号 = ?
        ORDER BY z.发证日期 DESC`,
        [学员编号],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (format === 'csv') {
      if (数据.length === 0) return '';
      const 字段列表 = Object.keys(数据[0]);
      const 表头 = 字段列表.join(',');
      const 行数据 = 数据.map(行 => {
        return 字段列表.map(字段 => {
          const 值 = 行[字段] || '';
          const 转义值 = String(值).replace(/"/g, '""');
          return `"${转义值}"`;
        }).join(',');
      });
      return [表头, ...行数据].join('\n');
    } else {
      return {
        导出时间: new Date().toISOString(),
        学员编号,
        学员姓名: 数据[0]?.学员姓名 || '',
        证书总数: 数据.length,
        证书列表: 数据
      };
    }
  }
}

export default new ExportService();
