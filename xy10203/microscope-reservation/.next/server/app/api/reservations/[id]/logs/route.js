"use strict";(()=>{var e={};e.id=252,e.ids=[252],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1017:e=>{e.exports=require("path")},9259:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>u,patchFetch:()=>L,requestAsyncStorage:()=>d,routeModule:()=>N,serverHooks:()=>p,staticGenerationAsyncStorage:()=>c});var T={};t.r(T),t.d(T,{GET:()=>n});var i=t(9303),s=t(8716),E=t(670),o=t(7070),a=t(8070);async function n(e,{params:r}){try{let e=(0,a.Bx)("reservation",r.id);return o.NextResponse.json(e)}catch(e){return console.error("GET logs error:",e),o.NextResponse.json({error:"获取操作日志失败"},{status:500})}}let N=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/reservations/[id]/logs/route",pathname:"/api/reservations/[id]/logs",filename:"route",bundlePath:"app/api/reservations/[id]/logs/route"},resolvedPagePath:"/Users/mac/pro/solo/workspaces/xy10203/microscope-reservation/src/app/api/reservations/[id]/logs/route.ts",nextConfigOutput:"",userland:T}),{requestAsyncStorage:d,staticGenerationAsyncStorage:c,serverHooks:p}=N,u="/api/reservations/[id]/logs/route";function L(){return(0,E.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:c})}},5380:(e,r,t)=>{t.d(r,{Z:()=>c});let T=require("better-sqlite3");var i=t.n(T),s=t(1017),E=t.n(s);let o=require("fs");var a=t.n(o);let n=process.env.DB_PATH||"./data/microscope.db",N=E().dirname(n);a().existsSync(N)||a().mkdirSync(N,{recursive:!0});let d=new(i())(n);d.pragma("journal_mode = WAL"),d.pragma("foreign_keys = ON"),d.exec(`
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
`);let c=d},8070:(e,r,t)=>{t.d(r,{Bx:()=>E,ar:()=>s});var T=t(5380),i=t(644);function s(e){T.Z.prepare(`
    INSERT INTO operation_logs (
      id, entity_type, entity_id, action, old_values, new_values, user_id, timestamp, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run((0,i.Ox)(),e.entityType,e.entityId,e.action,e.oldValues?JSON.stringify(e.oldValues):null,e.newValues?JSON.stringify(e.newValues):null,e.userId||null,(0,i.i2)(),e.note||null)}function E(e,r){return T.Z.prepare(`
    SELECT * FROM operation_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `).all(e,r)}},644:(e,r,t)=>{t.d(r,{Om:()=>a,Ox:()=>E,i2:()=>o});var T=t(9576),i=t(1035),s=t.n(i);function E(){return(0,T.Z)()}function o(){return s()().toISOString()}function a(e,r,t,T){let i=s()(e),E=s()(r),o=s()(t),a=s()(T),n=i.isAfter(o)?i:o,N=E.isBefore(a)?E:a;return n.isBefore(N)?{start:n.toISOString(),end:N.toISOString()}:null}}};var r=require("../../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),T=r.X(0,[948,550],()=>t(9259));module.exports=T})();