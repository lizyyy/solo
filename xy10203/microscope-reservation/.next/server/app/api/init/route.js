"use strict";(()=>{var e={};e.id=946,e.ids=[946],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1017:e=>{e.exports=require("path")},401:(e,o,r)=>{r.r(o),r.d(o,{originalPathname:()=>l,patchFetch:()=>I,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>N,staticGenerationAsyncStorage:()=>u});var i={};r.r(i),r.d(i,{GET:()=>E});var a=r(9303),t=r(8716),s=r(670),c=r(7070),T=r(5380),n=r(644);let p=function(){if(T.Z.prepare("SELECT COUNT(*) as count FROM research_groups").get().count>0)return!1;let e=(0,n.i2)(),o=T.Z.prepare(`
    INSERT INTO research_groups (id, name, leader, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);for(let r of[{id:"group-1",name:"分子生物学组",leader:"张教授"},{id:"group-2",name:"细胞生物学组",leader:"李教授"},{id:"group-3",name:"神经科学组",leader:"王教授"}])o.run(r.id,r.name,r.leader,e,e);let r=T.Z.prepare(`
    INSERT INTO users (id, name, email, group_id, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);for(let o of[{id:"user-1",name:"陈小明",email:"chenxm@lab.edu",groupId:"group-1",role:"user"},{id:"user-2",name:"刘小红",email:"liuxh@lab.edu",groupId:"group-1",role:"user"},{id:"user-3",name:"赵小刚",email:"zhaoxg@lab.edu",groupId:"group-2",role:"user"},{id:"user-4",name:"孙小丽",email:"sunxl@lab.edu",groupId:"group-2",role:"user"},{id:"user-5",name:"周小强",email:"zhouxq@lab.edu",groupId:"group-3",role:"user"},{id:"admin-1",name:"实验室管理员",email:"admin@lab.edu",groupId:null,role:"admin"}])r.run(o.id,o.name,o.email,o.groupId,o.role,e);let i=T.Z.prepare(`
    INSERT INTO microscopes (id, name, model, location, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);for(let o of[{id:"scope-1",name:"蔡司 LSM 880 共聚焦",model:"Zeiss LSM 880",location:"B201室-1号台"},{id:"scope-2",name:"尼康 A1R 共聚焦",model:"Nikon A1R",location:"B201室-2号台"},{id:"scope-3",name:"奥林巴斯 FV3000",model:"Olympus FV3000",location:"B202室-1号台"},{id:"scope-4",name:"徕卡 SP8 双光子",model:"Leica SP8",location:"B202室-2号台"}])i.run(o.id,o.name,o.model,o.location,e,e);let a=T.Z.prepare(`
    INSERT INTO accessories (id, microscope_id, name, type, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);for(let o of[{microscopeId:"scope-1",name:"10x 物镜",type:"magnification"},{microscopeId:"scope-1",name:"20x 物镜",type:"magnification"},{microscopeId:"scope-1",name:"40x 油镜",type:"magnification"},{microscopeId:"scope-1",name:"63x 油镜",type:"magnification"},{microscopeId:"scope-1",name:"加热样品台",type:"sample_stage"},{microscopeId:"scope-1",name:"二氧化碳培养台",type:"sample_stage"},{microscopeId:"scope-2",name:"10x 物镜",type:"magnification"},{microscopeId:"scope-2",name:"20x 水镜",type:"magnification"},{microscopeId:"scope-2",name:"40x 水镜",type:"magnification"},{microscopeId:"scope-2",name:"60x 油镜",type:"magnification"},{microscopeId:"scope-2",name:"标准样品台",type:"sample_stage"},{microscopeId:"scope-2",name:"温控样品台",type:"sample_stage"},{microscopeId:"scope-3",name:"10x 物镜",type:"magnification"},{microscopeId:"scope-3",name:"20x 物镜",type:"magnification"},{microscopeId:"scope-3",name:"40x 油镜",type:"magnification"},{microscopeId:"scope-3",name:"100x 油镜",type:"magnification"},{microscopeId:"scope-3",name:"活细胞工作站",type:"sample_stage"},{microscopeId:"scope-4",name:"10x 水镜",type:"magnification"},{microscopeId:"scope-4",name:"25x 水镜",type:"magnification"},{microscopeId:"scope-4",name:"40x 水镜",type:"magnification"},{microscopeId:"scope-4",name:"深层成像样品台",type:"sample_stage"},{microscopeId:"scope-4",name:"动物成像台",type:"sample_stage"}])a.run((0,n.Ox)(),o.microscopeId,o.name,o.type,e,e);return!0};async function E(){try{let e=p();return c.NextResponse.json({success:!0,message:e?"数据库初始化成功，已插入示例数据":"数据库已存在，跳过初始化",seeded:e})}catch(e){return console.error("初始化失败:",e),c.NextResponse.json({success:!1,error:"数据库初始化失败"},{status:500})}}let d=new a.AppRouteRouteModule({definition:{kind:t.x.APP_ROUTE,page:"/api/init/route",pathname:"/api/init",filename:"route",bundlePath:"app/api/init/route"},resolvedPagePath:"/Users/mac/pro/solo/workspaces/xy10203/microscope-reservation/src/app/api/init/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:m,staticGenerationAsyncStorage:u,serverHooks:N}=d,l="/api/init/route";function I(){return(0,s.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:u})}},5380:(e,o,r)=>{r.d(o,{Z:()=>d});let i=require("better-sqlite3");var a=r.n(i),t=r(1017),s=r.n(t);let c=require("fs");var T=r.n(c);let n=process.env.DB_PATH||"./data/microscope.db",p=s().dirname(n);T().existsSync(p)||T().mkdirSync(p,{recursive:!0});let E=new(a())(n);E.pragma("journal_mode = WAL"),E.pragma("foreign_keys = ON"),E.exec(`
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
`);let d=E},644:(e,o,r)=>{r.d(o,{Om:()=>T,Ox:()=>s,i2:()=>c});var i=r(9576),a=r(1035),t=r.n(a);function s(){return(0,i.Z)()}function c(){return t()().toISOString()}function T(e,o,r,i){let a=t()(e),s=t()(o),c=t()(r),T=t()(i),n=a.isAfter(c)?a:c,p=s.isBefore(T)?s:T;return n.isBefore(p)?{start:n.toISOString(),end:p.toISOString()}:null}}};var o=require("../../../webpack-runtime.js");o.C(e);var r=e=>o(o.s=e),i=o.X(0,[948,550],()=>r(401));module.exports=i})();