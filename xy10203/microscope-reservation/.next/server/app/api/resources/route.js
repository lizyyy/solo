"use strict";(()=>{var e={};e.id=193,e.ids=[193],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1017:e=>{e.exports=require("path")},2687:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>I,patchFetch:()=>S,requestAsyncStorage:()=>_,routeModule:()=>O,serverHooks:()=>X,staticGenerationAsyncStorage:()=>L});var s={};t.r(s),t.d(s,{GET:()=>R,POST:()=>m});var o=t(9303),i=t(8716),n=t(670),a=t(7070),E=t(5380),T=t(644),c=t(8070);function p(e=!1){return E.Z.prepare(e?"SELECT * FROM microscopes ORDER BY name":"SELECT * FROM microscopes WHERE is_active = 1 ORDER BY name").all()}function u(e,r=!1){return E.Z.prepare(r?"SELECT * FROM accessories WHERE microscope_id = ? ORDER BY type, name":"SELECT * FROM accessories WHERE microscope_id = ? AND is_active = 1 ORDER BY type, name").all(e)}function d(){return E.Z.prepare("SELECT * FROM research_groups ORDER BY name").all()}function N(){return E.Z.prepare("SELECT * FROM users ORDER BY name").all()}let l="system-user";async function R(e){try{let{searchParams:r}=new URL(e.url),t=r.get("type"),s=r.get("microscopeId");if("microscopes"===t){let e=p(!0).map(e=>({...e,accessories:u(e.id,!0)}));return a.NextResponse.json(e)}if("accessories"===t&&s){let e=u(s,!0);return a.NextResponse.json(e)}if("groups"===t){let e=d();return a.NextResponse.json(e)}if("users"===t){let e=N();return a.NextResponse.json(e)}let o=p(),i=d(),n=N();return a.NextResponse.json({microscopes:o,groups:i,users:n})}catch(e){return console.error("GET resources error:",e),a.NextResponse.json({error:"获取资源失败"},{status:500})}}async function m(e){try{let{type:r,...t}=await e.json();if("microscope"===r){if(!t.name)return a.NextResponse.json({error:"显微镜名称不能为空"},{status:400});let e=function(e,r){let t=(0,T.Ox)(),s=(0,T.i2)();return E.Z.prepare(`
    INSERT INTO microscopes (
      id, name, model, location, description, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(t,e.name,e.model||null,e.location||null,e.description||null,s,s),(0,c.ar)({entityType:"microscope",entityId:t,action:"create",newValues:e,userId:r}),E.Z.prepare("SELECT * FROM microscopes WHERE id = ?").get(t)}({name:t.name,model:t.model,location:t.location,description:t.description},l);return a.NextResponse.json(e,{status:201})}if("accessory"===r){if(!t.microscopeId||!t.name||!t.type)return a.NextResponse.json({error:"缺少必要字段"},{status:400});let e=function(e,r){let t=(0,T.Ox)(),s=(0,T.i2)();return E.Z.prepare(`
    INSERT INTO accessories (
      id, microscope_id, name, type, description, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(t,e.microscope_id,e.name,e.type,e.description||null,s,s),(0,c.ar)({entityType:"accessory",entityId:t,action:"create",newValues:e,userId:r}),E.Z.prepare("SELECT * FROM accessories WHERE id = ?").get(t)}({microscope_id:t.microscopeId,name:t.name,type:t.type,description:t.description},l);return a.NextResponse.json(e,{status:201})}if("group"===r){if(!t.name)return a.NextResponse.json({error:"课题组名称不能为空"},{status:400});let e=function(e,r){let t=(0,T.Ox)(),s=(0,T.i2)();return E.Z.prepare(`
    INSERT INTO research_groups (id, name, leader, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(t,e.name,e.leader||null,s,s),(0,c.ar)({entityType:"research_group",entityId:t,action:"create",newValues:e,userId:r}),E.Z.prepare("SELECT * FROM research_groups WHERE id = ?").get(t)}({name:t.name,leader:t.leader},l);return a.NextResponse.json(e,{status:201})}if("user"===r){if(!t.name)return a.NextResponse.json({error:"用户名称不能为空"},{status:400});let e=function(e,r){let t=(0,T.Ox)(),s=(0,T.i2)();return E.Z.prepare(`
    INSERT INTO users (id, name, email, group_id, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(t,e.name,e.email||null,e.group_id||null,e.role,s),(0,c.ar)({entityType:"user",entityId:t,action:"create",newValues:e,userId:r}),E.Z.prepare("SELECT * FROM users WHERE id = ?").get(t)}({name:t.name,email:t.email,group_id:t.groupId,role:t.role||"user"},l);return a.NextResponse.json(e,{status:201})}return a.NextResponse.json({error:"无效的资源类型"},{status:400})}catch(e){return console.error("POST resources error:",e),a.NextResponse.json({error:"创建资源失败"},{status:500})}}let O=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/resources/route",pathname:"/api/resources",filename:"route",bundlePath:"app/api/resources/route"},resolvedPagePath:"/Users/mac/pro/solo/workspaces/xy10203/microscope-reservation/src/app/api/resources/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:_,staticGenerationAsyncStorage:L,serverHooks:X}=O,I="/api/resources/route";function S(){return(0,n.patchFetch)({serverHooks:X,staticGenerationAsyncStorage:L})}},5380:(e,r,t)=>{t.d(r,{Z:()=>u});let s=require("better-sqlite3");var o=t.n(s),i=t(1017),n=t.n(i);let a=require("fs");var E=t.n(a);let T=process.env.DB_PATH||"./data/microscope.db",c=n().dirname(T);E().existsSync(c)||E().mkdirSync(c,{recursive:!0});let p=new(o())(T);p.pragma("journal_mode = WAL"),p.pragma("foreign_keys = ON"),p.exec(`
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
`);let u=p},8070:(e,r,t)=>{t.d(r,{Bx:()=>n,ar:()=>i});var s=t(5380),o=t(644);function i(e){s.Z.prepare(`
    INSERT INTO operation_logs (
      id, entity_type, entity_id, action, old_values, new_values, user_id, timestamp, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run((0,o.Ox)(),e.entityType,e.entityId,e.action,e.oldValues?JSON.stringify(e.oldValues):null,e.newValues?JSON.stringify(e.newValues):null,e.userId||null,(0,o.i2)(),e.note||null)}function n(e,r){return s.Z.prepare(`
    SELECT * FROM operation_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `).all(e,r)}},644:(e,r,t)=>{t.d(r,{Om:()=>E,Ox:()=>n,i2:()=>a});var s=t(9576),o=t(1035),i=t.n(o);function n(){return(0,s.Z)()}function a(){return i()().toISOString()}function E(e,r,t,s){let o=i()(e),n=i()(r),a=i()(t),E=i()(s),T=o.isAfter(a)?o:a,c=n.isBefore(E)?n:E;return T.isBefore(c)?{start:T.toISOString(),end:c.toISOString()}:null}}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[948,550],()=>t(2687));module.exports=s})();