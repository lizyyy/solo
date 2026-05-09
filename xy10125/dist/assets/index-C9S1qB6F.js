(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&s(l)}).observe(document,{childList:!0,subtree:!0});function e(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(i){if(i.ep)return;i.ep=!0;const n=e(i);fetch(i.href,n)}})();function f(o,t,e,s,i){const n=i*Math.PI/180,l=Math.cos(n),r=Math.sin(n),d=o+e/2,u=t+s/2,h=e/2,a=s/2;return[{x:-h,y:-a},{x:h,y:-a},{x:h,y:a},{x:-h,y:a}].map(x=>({x:d+x.x*l-x.y*r,y:u+x.x*r+x.y*l}))}function I(o){const t=[];for(let e=0;e<o.length;e++){const s=o[e],i=o[(e+1)%o.length],n={x:i.x-s.x,y:i.y-s.y};t.push({x:-n.y,y:n.x})}return t}function B(o){const t=Math.sqrt(o.x*o.x+o.y*o.y);return{x:o.x/t,y:o.y/t}}function L(o,t){let e=1/0,s=-1/0;for(const i of o){const n=i.x*t.x+i.y*t.y;n<e&&(e=n),n>s&&(s=n)}return{min:e,max:s}}function $(o,t){return!(o.max<t.min||t.max<o.min)}function E(o,t){const e=f(o.x,o.y,o.width,o.length,o.angle||0),s=f(t.x,t.y,t.width,t.length,t.angle||0),i=[...I(e),...I(s)];for(const n of i){const l=B(n),r=L(e,l),d=L(s,l);if(!$(r,d))return!1}return!0}function T(o,t){f(t.x,t.y,t.width,t.length,t.angle||0);const e=(t.angle||0)*Math.PI/180,s=Math.cos(-e),i=Math.sin(-e),n=t.x+t.width/2,l=t.y+t.length/2,r=(o.x-n)*s-(o.y-l)*i,d=(o.x-n)*i+(o.y-l)*s,u=t.width/2,h=t.length/2,a=Math.max(-u,Math.min(u,r)),c=Math.max(-h,Math.min(h,d)),x=r-a,g=d-c;return x*x+g*g<o.radius*o.radius}function R(o,t,e){const s=f(e.x,e.y,e.width,e.length,e.angle||0);let i=!0;for(let n=0;n<s.length;n++){const l=s[n],r=s[(n+1)%s.length],d={x:r.x-l.x,y:r.y-l.y},u={x:-d.y,y:d.x},h={x:o-l.x,y:t-l.y};if(u.x*h.x+u.y*h.y<0){i=!1;break}}return i}function P(o){const t=[];for(let e=0;e<o.length;e++)for(let s=e+1;s<o.length;s++){const i=o[e],n=o[s];if(i.type==="turningRadius"||n.type==="turningRadius"){const l=i.type==="turningRadius"?i:n,r=i.type==="turningRadius"?n:i;if(r.type==="turningRadius"){const d=i.x-n.x,u=i.y-n.y;Math.sqrt(d*d+u*u)<i.radius+n.radius&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}else{const d={x:l.x,y:l.y,radius:l.radius};T(d,r.getBounds())&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}}else E(i.getBounds(),n.getBounds())&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}return t}function A(o){const t=[],e=o.filter(i=>i.type==="fireLane"),s=o.filter(i=>i.type==="parking");for(const i of e)for(const n of s)E(i.getBounds(),n.getBounds())&&t.push({type:"fireLane",objectA:i,objectB:n,message:`泊位 ${n.label} 占用消防通道 ${i.label}`});return t}function O(o){const t=[],e=o.filter(i=>i.type==="turningRadius"),s=o.filter(i=>i.type==="parking");for(const i of e)for(const n of s){const l={x:i.x,y:i.y,radius:i.radius};T(l,n.getBounds())&&t.push({type:"turningRadius",objectA:i,objectB:n,message:`泊位 ${n.label} 侵入转弯区域 ${i.label}`})}return t}function F(o,t=null){const e=[];if(e.push(...P(o)),e.push(...A(o)),e.push(...O(o)),t){for(const s of o)if(s.type==="parking"){const i=s.getBounds(),n=f(i.x,i.y,i.width,i.length,i.angle);for(const l of n)if(l.x<t.minX||l.x>t.maxX||l.y<t.minY||l.y>t.maxY){e.push({type:"boundary",object:s,message:`泊位 ${s.label} 超出边界`});break}}}return e}class M{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.scale=50,this.offsetX=0,this.offsetY=0,this.gridSize=5}resize(){const t=this.canvas.getBoundingClientRect();this.canvas.width=t.width*window.devicePixelRatio,this.canvas.height=t.height*window.devicePixelRatio,this.ctx.scale(window.devicePixelRatio,window.devicePixelRatio)}worldToScreen(t,e){return{x:t*this.scale+this.canvas.width/2/window.devicePixelRatio+this.offsetX,y:-e*this.scale+this.canvas.height/2/window.devicePixelRatio+this.offsetY}}screenToWorld(t,e){return{x:(t-this.canvas.width/2/window.devicePixelRatio-this.offsetX)/this.scale,y:-(e-this.canvas.height/2/window.devicePixelRatio-this.offsetY)/this.scale}}drawGrid(){const t=this.canvas.width/window.devicePixelRatio,e=this.canvas.height/window.devicePixelRatio;this.ctx.strokeStyle="#2a3a5a",this.ctx.lineWidth=.5;const s=this.screenToWorld(0,0).x,i=this.screenToWorld(t,0).x,n=this.screenToWorld(0,0).y,l=this.screenToWorld(0,e).y,r=Math.floor(s/this.gridSize)*this.gridSize,d=Math.ceil(i/this.gridSize)*this.gridSize,u=Math.floor(l/this.gridSize)*this.gridSize,h=Math.ceil(n/this.gridSize)*this.gridSize;for(let g=r;g<=d;g+=this.gridSize){const p=this.worldToScreen(g,n),m=this.worldToScreen(g,l);this.ctx.beginPath(),this.ctx.moveTo(p.x,p.y),this.ctx.lineTo(m.x,m.y),this.ctx.stroke()}for(let g=u;g<=h;g+=this.gridSize){const p=this.worldToScreen(s,g),m=this.worldToScreen(i,g);this.ctx.beginPath(),this.ctx.moveTo(p.x,p.y),this.ctx.lineTo(m.x,m.y),this.ctx.stroke()}this.ctx.strokeStyle="#e94560",this.ctx.lineWidth=2;const a=this.worldToScreen(0,0),c=this.worldToScreen(20,0),x=this.worldToScreen(0,20);this.ctx.beginPath(),this.ctx.moveTo(a.x,a.y),this.ctx.lineTo(c.x,c.y),this.ctx.stroke(),this.ctx.beginPath(),this.ctx.moveTo(a.x,a.y),this.ctx.lineTo(x.x,x.y),this.ctx.stroke()}drawParkingSpot(t,e=!1,s=!1){const n=f(t.x,t.y,t.width,t.length,t.angle).map(r=>this.worldToScreen(r.x,r.y));this.ctx.save(),s?(this.ctx.fillStyle="rgba(244, 67, 54, 0.4)",this.ctx.strokeStyle="#f44336"):e?(this.ctx.fillStyle="rgba(76, 175, 80, 0.4)",this.ctx.strokeStyle="#4caf50"):(this.ctx.fillStyle="rgba(33, 150, 243, 0.4)",this.ctx.strokeStyle="#2196f3"),this.ctx.lineWidth=e?3:2,this.ctx.beginPath(),this.ctx.moveTo(n[0].x,n[0].y);for(let r=1;r<n.length;r++)this.ctx.lineTo(n[r].x,n[r].y);this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.fillStyle=s?"#f44336":e?"#fff":"#90caf9",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.textBaseline="middle";const l=this.worldToScreen(t.x+t.width/2,t.y+t.length/2);this.ctx.fillText(t.label,l.x,l.y),this.ctx.restore()}drawFireLane(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=this.worldToScreen(t.x+t.length,t.y);this.ctx.save(),this.ctx.strokeStyle=e?"#ff9800":"#f44336",this.ctx.lineWidth=t.width*this.scale,this.ctx.lineCap="butt",this.ctx.beginPath(),this.ctx.moveTo(s.x,s.y),this.ctx.lineTo(i.x,i.y),this.ctx.stroke(),this.ctx.setLineDash([10,10]),this.ctx.strokeStyle="#fff",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(s.x,s.y),this.ctx.lineTo(i.x,i.y),this.ctx.stroke(),this.ctx.setLineDash([]),this.ctx.fillStyle="#fff",this.ctx.font="12px Arial",this.ctx.textAlign="center";const n=this.worldToScreen(t.x+t.length/2,t.y+t.width/2);this.ctx.fillText(`消防通道 ${t.label}`,n.x,n.y),this.ctx.restore()}drawTurningRadius(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=t.radius*this.scale;this.ctx.save(),this.ctx.fillStyle="rgba(255, 152, 0, 0.2)",this.ctx.strokeStyle=e?"#fff":"#ff9800",this.ctx.lineWidth=2,this.ctx.setLineDash([5,5]),this.ctx.beginPath(),this.ctx.arc(s.x,s.y,i,0,Math.PI*2),this.ctx.fill(),this.ctx.stroke(),this.ctx.setLineDash([]),this.ctx.fillStyle="#ff9800",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.fillText(`转弯 ${t.label}`,s.x,s.y),this.ctx.restore()}drawObstacle(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=t.width*this.scale,n=t.length*this.scale;this.ctx.save(),this.ctx.fillStyle="rgba(158, 158, 158, 0.6)",this.ctx.strokeStyle=e?"#fff":"#9e9e9e",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.rect(s.x,s.y-n,i,n),this.ctx.fill(),this.ctx.stroke(),this.ctx.fillStyle="#fff",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.textBaseline="middle",this.ctx.fillText(t.label,s.x+i/2,s.y-n/2),this.ctx.restore()}drawObjects(t,e=null,s=new Set){for(const i of t){const n=i.id===e,l=s.has(i.id);switch(i.type){case"parking":this.drawParkingSpot(i,n,l);break;case"fireLane":this.drawFireLane(i,n);break;case"turningRadius":this.drawTurningRadius(i,n);break;case"obstacle":this.drawObstacle(i,n);break}}}drawPreview(t,e,s){this.ctx.save(),this.ctx.globalAlpha=.5;const i={x:e.x,y:e.y,width:s.width||2.5,length:s.length||5,angle:s.angle||0,radius:s.radius||6,label:"预览"};switch(t){case"parking":this.drawParkingSpot(i,!0,!1);break;case"fireLane":i.width=4,i.length=10,this.drawFireLane(i,!0);break;case"turningRadius":i.x=e.x,i.y=e.y,this.drawTurningRadius(i,!0);break;case"obstacle":i.width=2,i.length=2,this.drawObstacle(i,!0);break}this.ctx.restore()}clear(){const t=this.canvas.width/window.devicePixelRatio,e=this.canvas.height/window.devicePixelRatio;this.ctx.fillStyle="#0a1929",this.ctx.fillRect(0,0,t,e)}render(t,e=null,s=new Set){this.clear(),this.drawGrid(),this.drawObjects(t,e,s)}}let y=1;class b{constructor(t,e,s=2.5,i=5,n=0){this.id=y++,this.type="parking",this.x=t,this.y=e,this.width=s,this.length=i,this.angle=n,this.label=`P${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:this.angle}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,angle:this.angle,label:this.label}}static fromJSON(t){const e=new b(t.x,t.y,t.width,t.length,t.angle);return e.id=t.id,e.label=t.label,t.id>=y&&(y=t.id+1),e}}class v{constructor(t,e,s=4,i=10){this.id=y++,this.type="fireLane",this.x=t,this.y=e,this.width=s,this.length=i,this.label=`F${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,label:this.label}}static fromJSON(t){const e=new v(t.x,t.y,t.width,t.length);return e.id=t.id,e.label=t.label,t.id>=y&&(y=t.id+1),e}}class w{constructor(t,e,s=6){this.id=y++,this.type="turningRadius",this.x=t,this.y=e,this.radius=s,this.label=`T${this.id}`}getBounds(){return{x:this.x-this.radius,y:this.y-this.radius,width:this.radius*2,length:this.radius*2,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,radius:this.radius,label:this.label}}static fromJSON(t){const e=new w(t.x,t.y,t.radius);return e.id=t.id,e.label=t.label,t.id>=y&&(y=t.id+1),e}}class S{constructor(t,e,s=2,i=2){this.id=y++,this.type="obstacle",this.x=t,this.y=e,this.width=s,this.length=i,this.label=`O${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,label:this.label}}static fromJSON(t){const e=new S(t.x,t.y,t.width,t.length);return e.id=t.id,e.label=t.label,t.id>=y&&(y=t.id+1),e}}function j(o){switch(o.type){case"parking":return b.fromJSON(o);case"fireLane":return v.fromJSON(o);case"turningRadius":return w.fromJSON(o);case"obstacle":return S.fromJSON(o);default:return null}}function k(){y=1}function N(o,t){const e=o.filter(a=>a.type==="parking"),s=o.filter(a=>a.type==="fireLane"),i=o.filter(a=>a.type==="turningRadius"),n=o.filter(a=>a.type==="obstacle"),l=e.reduce((a,c)=>a+c.width*c.length,0),r=s.reduce((a,c)=>a+c.width*c.length,0);let h=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>停车场规划报告</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    h1 { color: #16213e; border-bottom: 3px solid #e94560; padding-bottom: 10px; }
    h2 { color: #0f3460; margin-top: 30px; }
    .summary { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
    .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; flex: 1; min-width: 150px; }
    .summary-card .label { font-size: 14px; color: #666; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #e94560; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #16213e; color: white; }
    tr:hover { background: #f5f5f5; }
    .anomaly-item { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .anomaly-item.warning { background: #fff3e0; border-left-color: #ff9800; }
    .anomaly-item h4 { margin: 0 0 5px 0; }
    .anomaly-item p { margin: 3px 0; color: #555; }
    .success { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>停车场泊位规划报告</h1>
  <p>生成时间: ${new Date().toLocaleString("zh-CN")}</p>
  
  <h2>方案概览</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="label">泊位数量</div>
      <div class="value">${e.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道</div>
      <div class="value">${s.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">转弯区域</div>
      <div class="value">${i.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">障碍物</div>
      <div class="value">${n.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">异常数量</div>
      <div class="value" style="color: ${t.length>0?"#f44336":"#4caf50"}">${t.length}</div>
    </div>
  </div>
  
  <h2>面积统计</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="label">泊位总面积</div>
      <div class="value">${l.toFixed(2)} m²</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道面积</div>
      <div class="value">${r.toFixed(2)} m²</div>
    </div>
  </div>
`;if(e.length>0){h+=`
  <h2>泊位详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>X坐标 (m)</th>
        <th>Y坐标 (m)</th>
        <th>宽度 (m)</th>
        <th>长度 (m)</th>
        <th>角度 (°)</th>
        <th>面积 (m²)</th>
      </tr>
    </thead>
    <tbody>
`;for(const a of e)h+=`
      <tr>
        <td>${a.label}</td>
        <td>${a.x.toFixed(2)}</td>
        <td>${a.y.toFixed(2)}</td>
        <td>${a.width.toFixed(2)}</td>
        <td>${a.length.toFixed(2)}</td>
        <td>${a.angle.toFixed(0)}</td>
        <td>${(a.width*a.length).toFixed(2)}</td>
      </tr>`;h+=`
    </tbody>
  </table>`}if(s.length>0){h+=`
  <h2>消防通道详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>X坐标 (m)</th>
        <th>Y坐标 (m)</th>
        <th>宽度 (m)</th>
        <th>长度 (m)</th>
        <th>面积 (m²)</th>
      </tr>
    </thead>
    <tbody>
`;for(const a of s)h+=`
      <tr>
        <td>${a.label}</td>
        <td>${a.x.toFixed(2)}</td>
        <td>${a.y.toFixed(2)}</td>
        <td>${a.width.toFixed(2)}</td>
        <td>${a.length.toFixed(2)}</td>
        <td>${(a.width*a.length).toFixed(2)}</td>
      </tr>`;h+=`
    </tbody>
  </table>`}if(i.length>0){h+=`
  <h2>转弯区域详情</h2>
  <table>
    <thead>
      <tr>
        <th>编号</th>
        <th>圆心X (m)</th>
        <th>圆心Y (m)</th>
        <th>半径 (m)</th>
      </tr>
    </thead>
    <tbody>
`;for(const a of i)h+=`
      <tr>
        <td>${a.label}</td>
        <td>${a.x.toFixed(2)}</td>
        <td>${a.y.toFixed(2)}</td>
        <td>${a.radius.toFixed(2)}</td>
      </tr>`;h+=`
    </tbody>
  </table>`}if(h+=`
  <h2>异常检测结果</h2>
`,t.length===0)h+=`
  <div class="success">
    <h4>✓ 未检测到异常</h4>
    <p>所有元素布局合规，无碰撞、无消防通道占用、无转弯半径侵入。</p>
  </div>`;else for(const a of t){let c="",x="error";switch(a.type){case"collision":c="对象重叠";break;case"fireLane":c="消防通道占用";break;case"turningRadius":c="转弯区域侵入",x="warning";break;case"boundary":c="超出边界";break}let g=a.message;a.objectA&&a.objectB?g+=` (涉及: ${a.objectA.label}, ${a.objectB.label})`:a.object&&(g+=` (涉及: ${a.object.label})`),h+=`
  <div class="anomaly-item ${x}">
    <h4>【${c}】</h4>
    <p>${g}</p>
  </div>`}return h+=`
</body>
</html>`,h}function C(o,t="parking-report.html"){const e=new Blob([o],{type:"text/html"}),s=URL.createObjectURL(e),i=document.createElement("a");i.href=s,i.download=t,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(s)}function z(o,t="parking-plan.json"){const e={version:"1.0",createdAt:new Date().toISOString(),objects:o.map(l=>l.toJSON())},s=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),i=URL.createObjectURL(s),n=document.createElement("a");n.href=i,n.download=t,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(i)}class D{constructor(){this.canvas=document.getElementById("parking-canvas"),this.renderer=new M(this.canvas),this.objects=[],this.selectedId=null,this.currentTool="select",this.isDragging=!1,this.dragStart={x:0,y:0},this.originalPos={x:0,y:0},this.history=[],this.historyIndex=-1,this.isPlaying=!1,this.playbackSpeed=1,this.playbackIndex=0,this.snapshots=[],this.init()}init(){this.renderer.resize(),this.bindEvents(),this.animate()}bindEvents(){window.addEventListener("resize",()=>{this.renderer.resize(),this.render()}),this.canvas.addEventListener("mousedown",t=>this.handleMouseDown(t)),this.canvas.addEventListener("mousemove",t=>this.handleMouseMove(t)),this.canvas.addEventListener("mouseup",t=>this.handleMouseUp(t)),this.canvas.addEventListener("wheel",t=>this.handleWheel(t)),document.querySelectorAll(".tool-btn").forEach(t=>{t.addEventListener("click",e=>{document.querySelectorAll(".tool-btn").forEach(s=>s.classList.remove("active")),e.target.classList.add("active"),this.currentTool=e.target.dataset.tool,this.selectedId=null})}),document.getElementById("spot-width").addEventListener("input",t=>{const e=parseFloat(t.target.value);if(!isNaN(e)&&this.selectedId){const s=this.objects.find(i=>i.id===this.selectedId);s&&s.type==="parking"&&(s.width=e,this.saveSnapshot(),this.render())}}),document.getElementById("spot-length").addEventListener("input",t=>{const e=parseFloat(t.target.value);if(!isNaN(e)&&this.selectedId){const s=this.objects.find(i=>i.id===this.selectedId);s&&s.type==="parking"&&(s.length=e,this.saveSnapshot(),this.render())}}),document.getElementById("spot-angle").addEventListener("input",t=>{const e=parseFloat(t.target.value);if(!isNaN(e)&&this.selectedId){const s=this.objects.find(i=>i.id===this.selectedId);s&&s.type==="parking"&&(s.angle=e,this.saveSnapshot(),this.render())}}),document.getElementById("btn-save").addEventListener("click",()=>{z(this.objects)}),document.getElementById("btn-load").addEventListener("click",()=>{document.getElementById("file-input").click()}),document.getElementById("file-input").addEventListener("change",t=>{const e=t.target.files[0];if(e){const s=new FileReader;s.onload=i=>{try{const n=JSON.parse(i.target.result);this.loadPlan(n)}catch{alert("文件解析失败")}},s.readAsText(e)}}),document.getElementById("btn-export").addEventListener("click",()=>{const t=this.detectAnomalies(),e=N(this.objects,t);C(e)}),document.getElementById("btn-clear").addEventListener("click",()=>{confirm("确定要清空所有内容吗？")&&(this.objects=[],k(),this.selectedId=null,this.history=[],this.historyIndex=-1,this.saveSnapshot(),this.render())}),document.getElementById("btn-play").addEventListener("click",()=>{this.startPlayback()}),document.getElementById("btn-pause").addEventListener("click",()=>{this.isPlaying=!1}),document.getElementById("btn-reset").addEventListener("click",()=>{this.isPlaying=!1,this.playbackIndex=0,this.snapshots.length>0&&this.restoreSnapshot(this.snapshots[0])}),document.getElementById("playback-speed").addEventListener("input",t=>{this.playbackSpeed=parseFloat(t.target.value)}),document.addEventListener("keydown",t=>{(t.key==="Delete"||t.key==="Backspace")&&this.selectedId&&(this.objects=this.objects.filter(e=>e.id!==this.selectedId),this.selectedId=null,this.saveSnapshot(),this.render())})}handleMouseDown(t){const e=this.canvas.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top,n=this.renderer.screenToWorld(s,i);if(this.currentTool==="select"){const l=this.getObjectAt(s,i);l?(this.selectedId=l.id,this.isDragging=!0,this.dragStart=n,this.originalPos={x:l.x,y:l.y},l.type==="parking"&&(document.getElementById("spot-width").value=l.width,document.getElementById("spot-length").value=l.length,document.getElementById("spot-angle").value=l.angle)):this.selectedId=null,this.render()}else this.addObject(n)}handleMouseMove(t){const e=this.canvas.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top,n=this.renderer.screenToWorld(s,i);if(document.getElementById("coord-info").textContent=`坐标: (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) 米`,this.isDragging&&this.selectedId){const l=this.objects.find(r=>r.id===this.selectedId);if(l){const r=n.x-this.dragStart.x,d=n.y-this.dragStart.y;l.x=this.originalPos.x+r,l.y=this.originalPos.y+d,this.render()}}this.currentTool!=="select"&&(this.renderer.render(this.objects,this.selectedId,this.getAnomalousIds()),this.renderer.drawPreview(this.currentTool,n,this.getSettings()))}handleMouseUp(t){this.isDragging&&this.selectedId&&(this.isDragging=!1,this.saveSnapshot())}handleWheel(t){t.preventDefault();const e=t.deltaY>0?-.1:.1;this.renderer.scale=Math.max(10,Math.min(200,this.renderer.scale*(1+e))),document.getElementById("scale-info").textContent=`比例: 1:${Math.round(50/this.renderer.scale*50)}`,this.render()}addObject(t){const e=this.getSettings();let s;switch(this.currentTool){case"parking":s=new b(t.x,t.y,e.width,e.length,e.angle);break;case"fireLane":s=new v(t.x,t.y,4,10);break;case"turningRadius":s=new w(t.x,t.y,6);break;case"obstacle":s=new S(t.x,t.y,2,2);break}s&&(this.objects.push(s),this.selectedId=s.id,this.saveSnapshot(),this.render())}getSettings(){return{width:parseFloat(document.getElementById("spot-width").value)||2.5,length:parseFloat(document.getElementById("spot-length").value)||5,angle:parseFloat(document.getElementById("spot-angle").value)||0}}getObjectAt(t,e){const s=this.renderer.screenToWorld(t,e);for(let i=this.objects.length-1;i>=0;i--){const n=this.objects[i];if(n.type==="turningRadius"){const l=s.x-n.x,r=s.y-n.y;if(Math.sqrt(l*l+r*r)<=n.radius)return n}else if(R(s.x,s.y,n.getBounds()))return n}return null}detectAnomalies(){return F(this.objects)}getAnomalousIds(){const t=this.detectAnomalies(),e=new Set;for(const s of t)s.objectA&&e.add(s.objectA.id),s.objectB&&e.add(s.objectB.id),s.object&&e.add(s.object.id);return e}updateStats(){const t=this.objects.filter(n=>n.type==="parking").length,e=this.objects.filter(n=>n.type==="fireLane").length,s=this.objects.filter(n=>n.type==="turningRadius").length,i=this.detectAnomalies().length;document.getElementById("stat-spots").textContent=t,document.getElementById("stat-fire-lanes").textContent=e,document.getElementById("stat-turning").textContent=s,document.getElementById("stat-anomalies").textContent=i,this.updateAnomalyList()}updateAnomalyList(){const t=this.detectAnomalies(),e=document.getElementById("anomaly-list");if(t.length===0){e.innerHTML='<p class="no-anomalies">暂无异常</p>';return}let s="";for(const i of t){let n="error",l="";switch(i.type){case"collision":l="对象重叠";break;case"fireLane":l="消防通道占用";break;case"turningRadius":l="转弯区域侵入",n="warning";break;case"boundary":l="超出边界";break}s+=`
        <div class="anomaly-item ${n}">
          <h4>${l}</h4>
          <p>${i.message}</p>
        </div>
      `}e.innerHTML=s}saveSnapshot(){this.snapshots.push(this.objects.map(t=>t.toJSON())),this.playbackIndex=this.snapshots.length-1}restoreSnapshot(t){k(),this.objects=t.map(e=>j(e)),this.selectedId=null,this.render()}startPlayback(){if(this.snapshots.length<2){alert("需要至少两个状态才能回放");return}this.isPlaying=!0,this.playbackIndex=0,this.playbackLoop()}playbackLoop(){if(this.isPlaying){if(this.playbackIndex>=this.snapshots.length){this.isPlaying=!1;return}this.restoreSnapshot(this.snapshots[this.playbackIndex]),this.playbackIndex++,setTimeout(()=>this.playbackLoop(),1e3/this.playbackSpeed)}}loadPlan(t){k(),this.objects=t.objects.map(e=>j(e)).filter(Boolean),this.selectedId=null,this.snapshots=[],this.saveSnapshot(),this.render()}render(){this.renderer.render(this.objects,this.selectedId,this.getAnomalousIds()),this.updateStats()}animate(){this.render(),requestAnimationFrame(()=>this.animate())}}document.addEventListener("DOMContentLoaded",()=>{new D});
