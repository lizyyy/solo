"use strict";(()=>{var e={};e.id=984,e.ids=[984],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1017:e=>{e.exports=require("path")},4553:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>w,patchFetch:()=>U,requestAsyncStorage:()=>S,routeModule:()=>X,serverHooks:()=>A,staticGenerationAsyncStorage:()=>h});var s={};t.r(s),t.d(s,{DELETE:()=>y,GET:()=>g,POST:()=>L,PUT:()=>v});var o=t(9303),i=t(8716),a=t(670),n=t(7070),c=t(5380),u=t(644);let p=["pending","approved","completed"];function d(e,r,t,s,o){let i=[],a=c.Z.prepare(`
    SELECT r.id, r.start_time, r.end_time, r.purpose, r.status,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE r.microscope_id = ?
      AND r.status IN (${p.map(()=>"?").join(",")})
      ${o?"AND r.id != ?":""}
  `),n=[e,...p];for(let r of(o&&n.push(o),a.all(...n))){let o=(0,u.Om)(t,s,r.start_time,r.end_time);o&&i.push({type:"microscope",resourceId:e,resourceName:r.microscope_name,conflictingReservationId:r.id,conflictingReservationTitle:`[${r.group_name}] ${r.user_name} - ${r.purpose.substring(0,30)}`,overlappingTime:o})}if(r.length>0){let e=c.Z.prepare(`
      SELECT r.id, r.start_time, r.end_time, r.purpose, r.status,
             a.id as accessory_id,
             a.name as accessory_name,
             u.name as user_name,
             g.name as group_name
      FROM reservations r
      JOIN reservation_accessories ra ON r.id = ra.reservation_id
      JOIN accessories a ON ra.accessory_id = a.id
      JOIN users u ON r.user_id = u.id
      JOIN research_groups g ON r.group_id = g.id
      WHERE a.id IN (${r.map(()=>"?").join(",")})
        AND r.status IN (${p.map(()=>"?").join(",")})
        ${o?"AND r.id != ?":""}
    `),a=[...r,...p];for(let r of(o&&a.push(o),e.all(...a))){let e=(0,u.Om)(t,s,r.start_time,r.end_time);e&&i.push({type:"accessory",resourceId:r.accessory_id,resourceName:r.accessory_name,conflictingReservationId:r.id,conflictingReservationTitle:`[${r.group_name}] ${r.user_name} - ${r.purpose.substring(0,30)}`,overlappingTime:e})}}return{hasConflict:i.length>0,conflicts:i}}var T=t(8070);class E extends Error{constructor(e){super(e),this.name="ReservationError"}}class l extends E{constructor(e,r){super(e),this.name="ConflictError",this.conflicts=r}}class N extends E{constructor(e){super(e),this.name="StateTransitionError"}}function m(e,r){let t=new Date(e),s=new Date(r);if(isNaN(t.getTime()))throw new E("开始时间格式无效");if(isNaN(s.getTime()))throw new E("结束时间格式无效");if(t>=s)throw new E("结束时间必须晚于开始时间");if(s.getTime()-t.getTime()<18e5)throw new E("预约时长至少为30分钟");if(s.getTime()-t.getTime()>864e5)throw new E("单次预约不能超过24小时")}function _(e){return c.Z.prepare(`
    SELECT * FROM reservations WHERE id = ?
  `).get(e)}function O(e){return c.Z.prepare(`
    SELECT a.* FROM accessories a
    JOIN reservation_accessories ra ON a.id = ra.accessory_id
    WHERE ra.reservation_id = ?
  `).all(e)}function I(e){let r=c.Z.prepare(`
    SELECT r.*,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE r.id = ?
  `).get(e);if(!r)return;let t=O(e);return{...r,accessories:t}}function R(e){return({draft:"草稿",pending:"待审批",approved:"已批准",rejected:"已拒绝",cancelled:"已取消",completed:"已完成"})[e]}let f="system-user";async function g(e){try{let{searchParams:r}=new URL(e.url),t={},s=r.get("status");s&&(t.status=s);let o=r.get("microscopeId");o&&(t.microscopeId=o);let i=r.get("groupId");i&&(t.groupId=i);let a=r.get("startDate");a&&(t.startDate=a);let u=r.get("endDate");u&&(t.endDate=u);let p=r.get("id");if(p){let e=I(p);if(!e)return n.NextResponse.json({error:"预约不存在"},{status:404});return n.NextResponse.json(e)}let d=function(e){let r=`
    SELECT r.*,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE 1=1
  `,t=[];return e?.status&&(r+=" AND r.status = ?",t.push(e.status)),e?.microscopeId&&(r+=" AND r.microscope_id = ?",t.push(e.microscopeId)),e?.groupId&&(r+=" AND r.group_id = ?",t.push(e.groupId)),e?.startDate&&(r+=" AND date(r.start_time) >= date(?)",t.push(e.startDate)),e?.endDate&&(r+=" AND date(r.start_time) <= date(?)",t.push(e.endDate)),r+=" ORDER BY r.start_time DESC",c.Z.prepare(r).all(...t).map(e=>({...e,accessories:O(e.id)}))}(t);return n.NextResponse.json(d)}catch(e){return console.error("GET reservations error:",e),n.NextResponse.json({error:"获取预约列表失败"},{status:500})}}async function L(e){try{let{action:r,...t}=await e.json();if("check-conflict"===r){let{microscopeId:e,accessoryIds:r,startTime:s,endTime:o,excludeReservationId:i}=t;if(!e||!s||!o)return n.NextResponse.json({error:"缺少必要参数"},{status:400});let a=d(e,r||[],s,o,i);return n.NextResponse.json(a)}let{microscopeId:s,userId:o,groupId:i,startTime:a,endTime:p,purpose:E,accessoryIds:N}=t;if(!s||!o||!i||!a||!p||!E)return n.NextResponse.json({error:"缺少必要字段"},{status:400});let _=function(e,r){m(e.startTime,e.endTime);let t=d(e.microscopeId,e.accessoryIds,e.startTime,e.endTime);if(t.hasConflict)throw new l(`发现 ${t.conflicts.length} 个资源冲突`,t.conflicts);let s=(0,u.Ox)(),o=(0,u.i2)();return c.Z.transaction(()=>{c.Z.prepare(`
      INSERT INTO reservations (
        id, microscope_id, user_id, group_id, start_time, end_time,
        purpose, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,e.microscopeId,e.userId,e.groupId,e.startTime,e.endTime,e.purpose,"pending",o,o);let r=c.Z.prepare(`
      INSERT INTO reservation_accessories (id, reservation_id, accessory_id, created_at)
      VALUES (?, ?, ?, ?)
    `);for(let t of e.accessoryIds)r.run((0,u.Ox)(),s,t,o)})(),(0,T.ar)({entityType:"reservation",entityId:s,action:"create",newValues:{microscopeId:e.microscopeId,userId:e.userId,groupId:e.groupId,startTime:e.startTime,endTime:e.endTime,purpose:e.purpose,accessoryIds:e.accessoryIds},userId:r}),I(s)}({microscopeId:s,userId:o,groupId:i,startTime:a,endTime:p,purpose:E,accessoryIds:N||[]},f);return n.NextResponse.json(_,{status:201})}catch(e){if(console.error("POST reservation error:",e),e instanceof l)return n.NextResponse.json({error:e.message,errorType:"ConflictError",conflicts:e.conflicts},{status:409});if(e instanceof N)return n.NextResponse.json({error:e.message,errorType:"StateTransitionError"},{status:400});if(e instanceof E)return n.NextResponse.json({error:e.message},{status:400});return n.NextResponse.json({error:"创建预约失败"},{status:500})}}async function v(e){try{let r;let{id:t,action:s,...o}=await e.json();if(!t)return n.NextResponse.json({error:"缺少预约ID"},{status:400});if("approve"===s)r=function(e,r,t){let s=_(e);if(!s)throw new E("预约记录不存在");if("pending"!==s.status)throw new N(`只有"待审批"状态的预约才能批准`);let o=d(s.microscope_id,O(e).map(e=>e.id),s.start_time,s.end_time,e);if(o.hasConflict)throw new l(`审批时发现 ${o.conflicts.length} 个资源冲突`,o.conflicts);let i=(0,u.i2)();return c.Z.prepare(`
    UPDATE reservations SET 
      status = ?, approved_at = ?, approved_by = ?, updated_at = ? 
    WHERE id = ?
  `).run("approved",i,r,i,e),(0,T.ar)({entityType:"reservation",entityId:e,action:"approve",oldValues:{status:s.status},newValues:{status:"approved",approvedBy:r},userId:r,note:t}),I(e)}(t,f,o.note);else if("reject"===s){if(!o.reason)return n.NextResponse.json({error:"请填写拒绝原因"},{status:400});r=function(e,r,t){let s=_(e);if(!s)throw new E("预约记录不存在");if("pending"!==s.status)throw new N(`只有"待审批"状态的预约才能拒绝`);let o=(0,u.i2)();return c.Z.prepare(`
    UPDATE reservations SET 
      status = ?, rejected_at = ?, rejection_reason = ?, updated_at = ? 
    WHERE id = ?
  `).run("rejected",o,t,o,e),(0,T.ar)({entityType:"reservation",entityId:e,action:"reject",oldValues:{status:s.status},newValues:{status:"rejected",reason:t},userId:r}),I(e)}(t,f,o.reason)}else r="cancel"===s?function(e,r,t){let s=_(e);if(!s)throw new E("预约记录不存在");if("rejected"===s.status||"cancelled"===s.status)throw new N(`该预约已处于"${R(s.status)}"状态，无需取消`);let o=(0,u.i2)();return c.Z.prepare(`
    UPDATE reservations SET 
      status = ?, cancelled_at = ?, updated_at = ? 
    WHERE id = ?
  `).run("cancelled",o,o,e),(0,T.ar)({entityType:"reservation",entityId:e,action:"cancel",oldValues:{status:s.status},newValues:{status:"cancelled",reason:t},userId:r}),I(e)}(t,f,o.reason):function(e,r,t){let s=_(e);if(!s)throw new E("预约记录不存在");if("approved"===s.status||"rejected"===s.status||"cancelled"===s.status)throw new N(`状态为"${R(s.status)}"的预约不能修改`);let o=r.startTime||s.start_time,i=r.endTime||s.end_time,a=r.accessoryIds||O(e).map(e=>e.id);m(o,i);let n=d(s.microscope_id,a,o,i,e);if(n.hasConflict)throw new l(`修改后发现 ${n.conflicts.length} 个资源冲突`,n.conflicts);let p=(0,u.i2)(),f={...s};return c.Z.transaction(()=>{let t=[],s=[];if(r.startTime&&(t.push("start_time = ?"),s.push(r.startTime)),r.endTime&&(t.push("end_time = ?"),s.push(r.endTime)),void 0!==r.purpose&&(t.push("purpose = ?"),s.push(r.purpose)),t.push("updated_at = ?"),s.push(p),s.push(e),t.length>1&&c.Z.prepare(`
        UPDATE reservations SET ${t.join(", ")} WHERE id = ?
      `).run(...s),r.accessoryIds){c.Z.prepare(`
        DELETE FROM reservation_accessories WHERE reservation_id = ?
      `).run(e);let t=c.Z.prepare(`
        INSERT INTO reservation_accessories (id, reservation_id, accessory_id, created_at)
        VALUES (?, ?, ?, ?)
      `);for(let s of r.accessoryIds)t.run((0,u.Ox)(),e,s,p)}})(),(0,T.ar)({entityType:"reservation",entityId:e,action:"update",oldValues:f,newValues:r,userId:t}),I(e)}(t,o,f);return n.NextResponse.json(r)}catch(e){if(console.error("PUT reservation error:",e),e instanceof l)return n.NextResponse.json({error:e.message,errorType:"ConflictError",conflicts:e.conflicts},{status:409});if(e instanceof N)return n.NextResponse.json({error:e.message,errorType:"StateTransitionError"},{status:400});if(e instanceof E)return n.NextResponse.json({error:e.message},{status:400});return n.NextResponse.json({error:"更新预约失败"},{status:500})}}async function y(e){try{let{searchParams:r}=new URL(e.url),t=r.get("id");if(!t)return n.NextResponse.json({error:"缺少预约ID"},{status:400});return function(e,r){let t=_(e);if(t){if("approved"===t.status)throw new N("已批准的预约不能删除，请先取消");c.Z.prepare("DELETE FROM reservations WHERE id = ?").run(e),(0,T.ar)({entityType:"reservation",entityId:e,action:"delete",oldValues:t,userId:r})}}(t,f),n.NextResponse.json({success:!0})}catch(e){if(console.error("DELETE reservation error:",e),e instanceof N)return n.NextResponse.json({error:e.message,errorType:"StateTransitionError"},{status:400});return n.NextResponse.json({error:"删除预约失败"},{status:500})}}let X=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/reservations/route",pathname:"/api/reservations",filename:"route",bundlePath:"app/api/reservations/route"},resolvedPagePath:"/Users/mac/pro/solo/workspaces/xy10203/microscope-reservation/src/app/api/reservations/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:S,staticGenerationAsyncStorage:h,serverHooks:A}=X,w="/api/reservations/route";function U(){return(0,a.patchFetch)({serverHooks:A,staticGenerationAsyncStorage:h})}},5380:(e,r,t)=>{t.d(r,{Z:()=>T});let s=require("better-sqlite3");var o=t.n(s),i=t(1017),a=t.n(i);let n=require("fs");var c=t.n(n);let u=process.env.DB_PATH||"./data/microscope.db",p=a().dirname(u);c().existsSync(p)||c().mkdirSync(p,{recursive:!0});let d=new(o())(u);d.pragma("journal_mode = WAL"),d.pragma("foreign_keys = ON"),d.exec(`
  CREATE TABLE IF NOT EXISTS microscopes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    location TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS accessories (
    id TEXT PRIMARY KEY,
    microscope_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (microscope_id) REFERENCES microscopes(id)
  );

  CREATE TABLE IF NOT EXISTS research_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    leader TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    group_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES research_groups(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    microscope_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT,
    approved_at TEXT,
    rejected_at TEXT,
    cancelled_at TEXT,
    approved_by TEXT,
    rejection_reason TEXT,
    FOREIGN KEY (microscope_id) REFERENCES microscopes(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES research_groups(id)
  );

  CREATE TABLE IF NOT EXISTS reservation_accessories (
    id TEXT PRIMARY KEY,
    reservation_id TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    user_id TEXT,
    timestamp TEXT NOT NULL,
    note TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(start_time, end_time);
  CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
  CREATE INDEX IF NOT EXISTS idx_reservations_microscope ON reservations(microscope_id);
  CREATE INDEX IF NOT EXISTS idx_accessories_microscope ON accessories(microscope_id);
  CREATE INDEX IF NOT EXISTS idx_logs_entity ON operation_logs(entity_type, entity_id);
`);let T=d},8070:(e,r,t)=>{t.d(r,{Bx:()=>a,ar:()=>i});var s=t(5380),o=t(644);function i(e){s.Z.prepare(`
    INSERT INTO operation_logs (
      id, entity_type, entity_id, action, old_values, new_values, user_id, timestamp, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run((0,o.Ox)(),e.entityType,e.entityId,e.action,e.oldValues?JSON.stringify(e.oldValues):null,e.newValues?JSON.stringify(e.newValues):null,e.userId||null,(0,o.i2)(),e.note||null)}function a(e,r){return s.Z.prepare(`
    SELECT * FROM operation_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `).all(e,r)}},644:(e,r,t)=>{t.d(r,{Om:()=>c,Ox:()=>a,i2:()=>n});var s=t(9576),o=t(1035),i=t.n(o);function a(){return(0,s.Z)()}function n(){return i()().toISOString()}function c(e,r,t,s){let o=i()(e),a=i()(r),n=i()(t),c=i()(s),u=o.isAfter(n)?o:n,p=a.isBefore(c)?a:c;return u.isBefore(p)?{start:u.toISOString(),end:p.toISOString()}:null}}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[948,550],()=>t(4553));module.exports=s})();