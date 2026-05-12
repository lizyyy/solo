(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function e(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(i){if(i.ep)return;i.ep=!0;const n=e(i);fetch(i.href,n)}})();function f(a,t,e,s,i){const n=i*Math.PI/180,o=Math.cos(n),r=Math.sin(n),h=a+e/2,y=t+s/2,u=e/2,d=s/2;return[{x:-u,y:-d},{x:u,y:-d},{x:u,y:d},{x:-u,y:d}].map(c=>({x:h+c.x*o-c.y*r,y:y+c.x*r+c.y*o}))}function B(a){const t=[];for(let e=0;e<a.length;e++){const s=a[e],i=a[(e+1)%a.length],n={x:i.x-s.x,y:i.y-s.y};t.push({x:-n.y,y:n.x})}return t}function $(a){const t=Math.sqrt(a.x*a.x+a.y*a.y);return{x:a.x/t,y:a.y/t}}function I(a,t){let e=1/0,s=-1/0;for(const i of a){const n=i.x*t.x+i.y*t.y;n<e&&(e=n),n>s&&(s=n)}return{min:e,max:s}}function j(a,t){return!(a.max<t.min||t.max<a.min)}function L(a,t){const e=f(a.x,a.y,a.width,a.length,a.angle||0),s=f(t.x,t.y,t.width,t.length,t.angle||0),i=[...B(e),...B(s)];for(const n of i){const o=$(n),r=I(e,o),h=I(s,o);if(!j(r,h))return!1}return!0}function T(a,t){f(t.x,t.y,t.width,t.length,t.angle||0);const e=(t.angle||0)*Math.PI/180,s=Math.cos(-e),i=Math.sin(-e),n=t.x+t.width/2,o=t.y+t.length/2,r=(a.x-n)*s-(a.y-o)*i,h=(a.x-n)*i+(a.y-o)*s,y=t.width/2,u=t.length/2,d=Math.max(-y,Math.min(y,r)),l=Math.max(-u,Math.min(u,h)),c=r-d,x=h-l;return c*c+x*x<a.radius*a.radius}function R(a,t,e){const s=f(e.x,e.y,e.width,e.length,e.angle||0);let i=!0;for(let n=0;n<s.length;n++){const o=s[n],r=s[(n+1)%s.length],h={x:r.x-o.x,y:r.y-o.y},y={x:-h.y,y:h.x},u={x:a-o.x,y:t-o.y};if(y.x*u.x+y.y*u.y<0){i=!1;break}}return i}function P(a){const t=[];for(let e=0;e<a.length;e++)for(let s=e+1;s<a.length;s++){const i=a[e],n=a[s];if(i.type==="turningRadius"||n.type==="turningRadius"){const o=i.type==="turningRadius"?i:n,r=i.type==="turningRadius"?n:i;if(r.type==="turningRadius"){const h=i.x-n.x,y=i.y-n.y;Math.sqrt(h*h+y*y)<i.radius+n.radius&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}else{const h={x:o.x,y:o.y,radius:o.radius};T(h,r.getBounds())&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}}else L(i.getBounds(),n.getBounds())&&t.push({type:"collision",objectA:i,objectB:n,message:`${i.label} 与 ${n.label} 重叠`})}return t}function F(a){const t=[],e=a.filter(i=>i.type==="fireLane"),s=a.filter(i=>i.type==="parking");for(const i of e)for(const n of s)L(i.getBounds(),n.getBounds())&&t.push({type:"fireLane",objectA:i,objectB:n,message:`泊位 ${n.label} 占用消防通道 ${i.label}`});return t}function A(a){const t=[],e=a.filter(i=>i.type==="turningRadius"),s=a.filter(i=>i.type==="parking");for(const i of e)for(const n of s){const o={x:i.x,y:i.y,radius:i.radius};T(o,n.getBounds())&&t.push({type:"turningRadius",objectA:i,objectB:n,message:`泊位 ${n.label} 侵入转弯区域 ${i.label}`})}return t}function Y(a,t=null){const e=[];if(e.push(...P(a)),e.push(...F(a)),e.push(...A(a)),t){for(const s of a)if(s.type==="parking"){const i=s.getBounds(),n=f(i.x,i.y,i.width,i.length,i.angle);for(const o of n)if(o.x<t.minX||o.x>t.maxX||o.y<t.minY||o.y>t.maxY){e.push({type:"boundary",object:s,message:`泊位 ${s.label} 超出边界`});break}}}return e}class O{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.scale=50,this.offsetX=0,this.offsetY=0,this.gridSize=5}resize(){const t=this.canvas.getBoundingClientRect();this.canvas.width=t.width*window.devicePixelRatio,this.canvas.height=t.height*window.devicePixelRatio,this.ctx.scale(window.devicePixelRatio,window.devicePixelRatio)}worldToScreen(t,e){return{x:t*this.scale+this.canvas.width/2/window.devicePixelRatio+this.offsetX,y:-e*this.scale+this.canvas.height/2/window.devicePixelRatio+this.offsetY}}screenToWorld(t,e){return{x:(t-this.canvas.width/2/window.devicePixelRatio-this.offsetX)/this.scale,y:-(e-this.canvas.height/2/window.devicePixelRatio-this.offsetY)/this.scale}}drawGrid(){const t=this.canvas.width/window.devicePixelRatio,e=this.canvas.height/window.devicePixelRatio;this.ctx.strokeStyle="#2a3a5a",this.ctx.lineWidth=.5;const s=this.screenToWorld(0,0).x,i=this.screenToWorld(t,0).x,n=this.screenToWorld(0,0).y,o=this.screenToWorld(0,e).y,r=Math.floor(s/this.gridSize)*this.gridSize,h=Math.ceil(i/this.gridSize)*this.gridSize,y=Math.floor(o/this.gridSize)*this.gridSize,u=Math.ceil(n/this.gridSize)*this.gridSize;for(let x=r;x<=h;x+=this.gridSize){const m=this.worldToScreen(x,n),b=this.worldToScreen(x,o);this.ctx.beginPath(),this.ctx.moveTo(m.x,m.y),this.ctx.lineTo(b.x,b.y),this.ctx.stroke()}for(let x=y;x<=u;x+=this.gridSize){const m=this.worldToScreen(s,x),b=this.worldToScreen(i,x);this.ctx.beginPath(),this.ctx.moveTo(m.x,m.y),this.ctx.lineTo(b.x,b.y),this.ctx.stroke()}this.ctx.strokeStyle="#e94560",this.ctx.lineWidth=2;const d=this.worldToScreen(0,0),l=this.worldToScreen(20,0),c=this.worldToScreen(0,20);this.ctx.beginPath(),this.ctx.moveTo(d.x,d.y),this.ctx.lineTo(l.x,l.y),this.ctx.stroke(),this.ctx.beginPath(),this.ctx.moveTo(d.x,d.y),this.ctx.lineTo(c.x,c.y),this.ctx.stroke()}drawBoundary(t){if(!t)return;const{minX:e,maxX:s,minY:i,maxY:n}=t,o=[this.worldToScreen(e,n),this.worldToScreen(s,n),this.worldToScreen(s,i),this.worldToScreen(e,i)];this.ctx.save(),this.ctx.fillStyle="rgba(76, 175, 80, 0.05)",this.ctx.beginPath(),this.ctx.moveTo(o[0].x,o[0].y);for(let d=1;d<o.length;d++)this.ctx.lineTo(o[d].x,o[d].y);this.ctx.closePath(),this.ctx.fill(),this.ctx.strokeStyle="#4caf50",this.ctx.lineWidth=3,this.ctx.setLineDash([8,4]),this.ctx.beginPath(),this.ctx.moveTo(o[0].x,o[0].y);for(let d=1;d<o.length;d++)this.ctx.lineTo(o[d].x,o[d].y);this.ctx.closePath(),this.ctx.stroke(),this.ctx.setLineDash([]),this.ctx.fillStyle="#4caf50",this.ctx.font="11px Arial",this.ctx.textAlign="center";const r=this.worldToScreen((e+s)/2,n);this.ctx.fillText(`边界 Y: ${n}m`,r.x,r.y-10);const h=this.worldToScreen((e+s)/2,i);this.ctx.fillText(`边界 Y: ${i}m`,h.x,h.y+15),this.ctx.textAlign="left";const y=this.worldToScreen(e,(i+n)/2);this.ctx.fillText(`X: ${e}m`,y.x+5,y.y),this.ctx.textAlign="right";const u=this.worldToScreen(s,(i+n)/2);this.ctx.fillText(`X: ${s}m`,u.x-5,u.y),this.ctx.restore()}drawParkingSpot(t,e=!1,s=!1){const n=f(t.x,t.y,t.width,t.length,t.angle).map(r=>this.worldToScreen(r.x,r.y));this.ctx.save(),s?(this.ctx.fillStyle="rgba(244, 67, 54, 0.4)",this.ctx.strokeStyle="#f44336"):e?(this.ctx.fillStyle="rgba(76, 175, 80, 0.4)",this.ctx.strokeStyle="#4caf50"):(this.ctx.fillStyle="rgba(33, 150, 243, 0.4)",this.ctx.strokeStyle="#2196f3"),this.ctx.lineWidth=e?3:2,this.ctx.beginPath(),this.ctx.moveTo(n[0].x,n[0].y);for(let r=1;r<n.length;r++)this.ctx.lineTo(n[r].x,n[r].y);this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.fillStyle=s?"#f44336":e?"#fff":"#90caf9",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.textBaseline="middle";const o=this.worldToScreen(t.x+t.width/2,t.y+t.length/2);this.ctx.fillText(t.label,o.x,o.y),this.ctx.restore()}drawFireLane(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=this.worldToScreen(t.x+t.length,t.y);this.ctx.save(),this.ctx.strokeStyle=e?"#ff9800":"#f44336",this.ctx.lineWidth=t.width*this.scale,this.ctx.lineCap="butt",this.ctx.beginPath(),this.ctx.moveTo(s.x,s.y),this.ctx.lineTo(i.x,i.y),this.ctx.stroke(),this.ctx.setLineDash([10,10]),this.ctx.strokeStyle="#fff",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(s.x,s.y),this.ctx.lineTo(i.x,i.y),this.ctx.stroke(),this.ctx.setLineDash([]),this.ctx.fillStyle="#fff",this.ctx.font="12px Arial",this.ctx.textAlign="center";const n=this.worldToScreen(t.x+t.length/2,t.y+t.width/2);this.ctx.fillText(`消防通道 ${t.label}`,n.x,n.y),this.ctx.restore()}drawTurningRadius(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=t.radius*this.scale;this.ctx.save(),this.ctx.fillStyle="rgba(255, 152, 0, 0.2)",this.ctx.strokeStyle=e?"#fff":"#ff9800",this.ctx.lineWidth=2,this.ctx.setLineDash([5,5]),this.ctx.beginPath(),this.ctx.arc(s.x,s.y,i,0,Math.PI*2),this.ctx.fill(),this.ctx.stroke(),this.ctx.setLineDash([]),this.ctx.fillStyle="#ff9800",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.fillText(`转弯 ${t.label}`,s.x,s.y),this.ctx.restore()}drawObstacle(t,e=!1){const s=this.worldToScreen(t.x,t.y),i=t.width*this.scale,n=t.length*this.scale;this.ctx.save(),this.ctx.fillStyle="rgba(158, 158, 158, 0.6)",this.ctx.strokeStyle=e?"#fff":"#9e9e9e",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.rect(s.x,s.y-n,i,n),this.ctx.fill(),this.ctx.stroke(),this.ctx.fillStyle="#fff",this.ctx.font="12px Arial",this.ctx.textAlign="center",this.ctx.textBaseline="middle",this.ctx.fillText(t.label,s.x+i/2,s.y-n/2),this.ctx.restore()}drawObjects(t,e=null,s=new Set){for(const i of t){const n=i.id===e,o=s.has(i.id);switch(i.type){case"parking":this.drawParkingSpot(i,n,o);break;case"fireLane":this.drawFireLane(i,n);break;case"turningRadius":this.drawTurningRadius(i,n);break;case"obstacle":this.drawObstacle(i,n);break}}}drawPreview(t,e,s){this.ctx.save(),this.ctx.globalAlpha=.5;const i={x:e.x,y:e.y,width:s.width||2.5,length:s.length||5,angle:s.angle||0,radius:s.radius||6,label:"预览"};switch(t){case"parking":this.drawParkingSpot(i,!0,!1);break;case"fireLane":i.width=4,i.length=10,this.drawFireLane(i,!0);break;case"turningRadius":i.x=e.x,i.y=e.y,this.drawTurningRadius(i,!0);break;case"obstacle":i.width=2,i.length=2,this.drawObstacle(i,!0);break}this.ctx.restore()}clear(){const t=this.canvas.width/window.devicePixelRatio,e=this.canvas.height/window.devicePixelRatio;this.ctx.fillStyle="#0a1929",this.ctx.fillRect(0,0,t,e)}render(t,e=null,s=new Set,i=null){this.clear(),this.drawGrid(),this.drawBoundary(i),this.drawObjects(t,e,s)}}let g=1;class p{constructor(t,e,s=2.5,i=5,n=0){this.id=g++,this.type="parking",this.x=t,this.y=e,this.width=s,this.length=i,this.angle=n,this.label=`P${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:this.angle}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,angle:this.angle,label:this.label}}static fromJSON(t){const e=new p(t.x,t.y,t.width,t.length,t.angle);return e.id=t.id,e.label=t.label,t.id>=g&&(g=t.id+1),e}}class v{constructor(t,e,s=4,i=10){this.id=g++,this.type="fireLane",this.x=t,this.y=e,this.width=s,this.length=i,this.label=`F${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,label:this.label}}static fromJSON(t){const e=new v(t.x,t.y,t.width,t.length);return e.id=t.id,e.label=t.label,t.id>=g&&(g=t.id+1),e}}class w{constructor(t,e,s=6){this.id=g++,this.type="turningRadius",this.x=t,this.y=e,this.radius=s,this.label=`T${this.id}`}getBounds(){return{x:this.x-this.radius,y:this.y-this.radius,width:this.radius*2,length:this.radius*2,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,radius:this.radius,label:this.label}}static fromJSON(t){const e=new w(t.x,t.y,t.radius);return e.id=t.id,e.label=t.label,t.id>=g&&(g=t.id+1),e}}class S{constructor(t,e,s=2,i=2){this.id=g++,this.type="obstacle",this.x=t,this.y=e,this.width=s,this.length=i,this.label=`O${this.id}`}getBounds(){return{x:this.x,y:this.y,width:this.width,length:this.length,angle:0}}toJSON(){return{id:this.id,type:this.type,x:this.x,y:this.y,width:this.width,length:this.length,label:this.label}}static fromJSON(t){const e=new S(t.x,t.y,t.width,t.length);return e.id=t.id,e.label=t.label,t.id>=g&&(g=t.id+1),e}}function E(a){switch(a.type){case"parking":return p.fromJSON(a);case"fireLane":return v.fromJSON(a);case"turningRadius":return w.fromJSON(a);case"obstacle":return S.fromJSON(a);default:return null}}function k(){g=1}function X(a,t,e=null){const s=a.filter(l=>l.type==="parking"),i=a.filter(l=>l.type==="fireLane"),n=a.filter(l=>l.type==="turningRadius"),o=a.filter(l=>l.type==="obstacle"),r=s.reduce((l,c)=>l+c.width*c.length,0),h=i.reduce((l,c)=>l+c.width*c.length,0);let d=`<!DOCTYPE html>
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
      <div class="value">${s.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道</div>
      <div class="value">${i.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">转弯区域</div>
      <div class="value">${n.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">障碍物</div>
      <div class="value">${o.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">异常数量</div>
      <div class="value" style="color: ${t.length>0?"#f44336":"#4caf50"}">${t.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">边界校验</div>
      <div class="value" style="color: ${e?"#4caf50":"#9e9e9e"}">${e?"已启用":"未启用"}</div>
    </div>
  </div>
`;if(e&&(d+=`
  <h2>边界信息</h2>
  <table>
    <thead>
      <tr>
        <th>参数</th>
        <th>值 (米)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>左边界 X</td><td>${e.minX.toFixed(2)}</td></tr>
      <tr><td>右边界 X</td><td>${e.maxX.toFixed(2)}</td></tr>
      <tr><td>下边界 Y</td><td>${e.minY.toFixed(2)}</td></tr>
      <tr><td>上边界 Y</td><td>${e.maxY.toFixed(2)}</td></tr>
      <tr><td>边界宽度</td><td>${(e.maxX-e.minX).toFixed(2)} m</td></tr>
      <tr><td>边界高度</td><td>${(e.maxY-e.minY).toFixed(2)} m</td></tr>
    </tbody>
  </table>
`),d+=`
  <h2>面积统计</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="label">泊位总面积</div>
      <div class="value">${r.toFixed(2)} m²</div>
    </div>
    <div class="summary-card">
      <div class="label">消防通道面积</div>
      <div class="value">${h.toFixed(2)} m²</div>
    </div>
  </div>
`,s.length>0){d+=`
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
`;for(const l of s)d+=`
      <tr>
        <td>${l.label}</td>
        <td>${l.x.toFixed(2)}</td>
        <td>${l.y.toFixed(2)}</td>
        <td>${l.width.toFixed(2)}</td>
        <td>${l.length.toFixed(2)}</td>
        <td>${l.angle.toFixed(0)}</td>
        <td>${(l.width*l.length).toFixed(2)}</td>
      </tr>`;d+=`
    </tbody>
  </table>`}if(i.length>0){d+=`
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
`;for(const l of i)d+=`
      <tr>
        <td>${l.label}</td>
        <td>${l.x.toFixed(2)}</td>
        <td>${l.y.toFixed(2)}</td>
        <td>${l.width.toFixed(2)}</td>
        <td>${l.length.toFixed(2)}</td>
        <td>${(l.width*l.length).toFixed(2)}</td>
      </tr>`;d+=`
    </tbody>
  </table>`}if(n.length>0){d+=`
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
`;for(const l of n)d+=`
      <tr>
        <td>${l.label}</td>
        <td>${l.x.toFixed(2)}</td>
        <td>${l.y.toFixed(2)}</td>
        <td>${l.radius.toFixed(2)}</td>
      </tr>`;d+=`
    </tbody>
  </table>`}if(d+=`
  <h2>异常检测结果</h2>
`,t.length===0)d+=`
  <div class="success">
    <h4>✓ 未检测到异常</h4>
    <p>所有元素布局合规，无碰撞、无消防通道占用、无转弯半径侵入。</p>
  </div>`;else for(const l of t){let c="",x="error";switch(l.type){case"collision":c="对象重叠";break;case"fireLane":c="消防通道占用";break;case"turningRadius":c="转弯区域侵入",x="warning";break;case"boundary":c="超出边界";break}let m=l.message;l.objectA&&l.objectB?m+=` (涉及: ${l.objectA.label}, ${l.objectB.label})`:l.object&&(m+=` (涉及: ${l.object.label})`),d+=`
  <div class="anomaly-item ${x}">
    <h4>【${c}】</h4>
    <p>${m}</p>
  </div>`}return d+=`
</body>
</html>`,d}function M(a,t="parking-report.html"){const e=new Blob([a],{type:"text/html"}),s=URL.createObjectURL(e),i=document.createElement("a");i.href=s,i.download=t,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(s)}function N(a,t=null,e="parking-plan.json"){const s={version:"1.1",createdAt:new Date().toISOString(),objects:a.map(r=>r.toJSON()),boundary:t},i=new Blob([JSON.stringify(s,null,2)],{type:"application/json"}),n=URL.createObjectURL(i),o=document.createElement("a");o.href=n,o.download=e,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(n)}class C{constructor(){this.canvas=document.getElementById("parking-canvas"),this.renderer=new O(this.canvas),this.objects=[],this.selectedId=null,this.currentTool="select",this.isDragging=!1,this.dragStart={x:0,y:0},this.originalPos={x:0,y:0},this.history=[],this.historyIndex=-1,this.isPlaying=!1,this.playbackSpeed=1,this.playbackIndex=0,this.snapshots=[],this.boundary=null,this.defaultBoundary={minX:-30,maxX:30,minY:-30,maxY:30},this.init()}init(){this.renderer.resize(),this.bindEvents(),this.animate()}bindEvents(){window.addEventListener("resize",()=>{this.renderer.resize(),this.render()}),this.canvas.addEventListener("mousedown",e=>this.handleMouseDown(e)),this.canvas.addEventListener("mousemove",e=>this.handleMouseMove(e)),this.canvas.addEventListener("mouseup",e=>this.handleMouseUp(e)),this.canvas.addEventListener("wheel",e=>this.handleWheel(e)),document.querySelectorAll(".tool-btn").forEach(e=>{e.addEventListener("click",s=>{document.querySelectorAll(".tool-btn").forEach(i=>i.classList.remove("active")),s.target.classList.add("active"),this.currentTool=s.target.dataset.tool,this.selectedId=null})}),document.getElementById("spot-width").addEventListener("input",e=>{const s=parseFloat(e.target.value);if(!isNaN(s)&&this.selectedId){const i=this.objects.find(n=>n.id===this.selectedId);i&&i.type==="parking"&&(i.width=s,this.saveSnapshot(),this.render())}}),document.getElementById("spot-length").addEventListener("input",e=>{const s=parseFloat(e.target.value);if(!isNaN(s)&&this.selectedId){const i=this.objects.find(n=>n.id===this.selectedId);i&&i.type==="parking"&&(i.length=s,this.saveSnapshot(),this.render())}}),document.getElementById("spot-angle").addEventListener("input",e=>{const s=parseFloat(e.target.value);if(!isNaN(s)&&this.selectedId){const i=this.objects.find(n=>n.id===this.selectedId);i&&i.type==="parking"&&(i.angle=s,this.saveSnapshot(),this.render())}}),document.getElementById("btn-save").addEventListener("click",()=>{N(this.objects,this.boundary)}),document.getElementById("btn-load").addEventListener("click",()=>{document.getElementById("file-input").click()}),document.getElementById("file-input").addEventListener("change",e=>{const s=e.target.files[0];if(s){const i=new FileReader;i.onload=n=>{try{const o=JSON.parse(n.target.result);this.loadPlan(o)}catch{alert("文件解析失败")}},i.readAsText(s)}}),document.getElementById("btn-export").addEventListener("click",()=>{const e=this.detectAnomalies(),s=X(this.objects,e,this.boundary);M(s)}),document.getElementById("btn-clear").addEventListener("click",()=>{confirm("确定要清空所有内容吗？")&&(this.objects=[],k(),this.selectedId=null,this.history=[],this.historyIndex=-1,this.boundary=null,document.getElementById("boundary-enabled").checked=!1,this.saveSnapshot(),this.render())}),document.getElementById("btn-play").addEventListener("click",()=>{this.startPlayback()}),document.getElementById("btn-pause").addEventListener("click",()=>{this.isPlaying=!1}),document.getElementById("btn-reset").addEventListener("click",()=>{this.isPlaying=!1,this.playbackIndex=0,this.snapshots.length>0&&this.restoreSnapshot(this.snapshots[0])}),document.getElementById("playback-speed").addEventListener("input",e=>{this.playbackSpeed=parseFloat(e.target.value)}),document.addEventListener("keydown",e=>{(e.key==="Delete"||e.key==="Backspace")&&this.selectedId&&(this.objects=this.objects.filter(s=>s.id!==this.selectedId),this.selectedId=null,this.saveSnapshot(),this.render())}),document.getElementById("boundary-enabled").addEventListener("change",e=>{e.target.checked?this.boundary=this.getBoundaryFromInputs():this.boundary=null,this.saveSnapshot(),this.render()}),["boundary-min-x","boundary-max-x","boundary-min-y","boundary-max-y"].forEach(e=>{document.getElementById(e).addEventListener("input",s=>{if(document.getElementById("boundary-enabled").checked){const n=this.getBoundaryFromInputs();n.minX<n.maxX&&n.minY<n.maxY&&(this.boundary=n,this.saveSnapshot(),this.render())}})}),document.getElementById("btn-reset-boundary").addEventListener("click",()=>{document.getElementById("boundary-min-x").value=this.defaultBoundary.minX,document.getElementById("boundary-max-x").value=this.defaultBoundary.maxX,document.getElementById("boundary-min-y").value=this.defaultBoundary.minY,document.getElementById("boundary-max-y").value=this.defaultBoundary.maxY,document.getElementById("boundary-enabled").checked&&(this.boundary={...this.defaultBoundary},this.saveSnapshot(),this.render())})}handleMouseDown(t){const e=this.canvas.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top,n=this.renderer.screenToWorld(s,i);if(this.currentTool==="select"){const o=this.getObjectAt(s,i);o?(this.selectedId=o.id,this.isDragging=!0,this.dragStart=n,this.originalPos={x:o.x,y:o.y},o.type==="parking"&&(document.getElementById("spot-width").value=o.width,document.getElementById("spot-length").value=o.length,document.getElementById("spot-angle").value=o.angle)):this.selectedId=null,this.render()}else this.addObject(n)}handleMouseMove(t){const e=this.canvas.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top,n=this.renderer.screenToWorld(s,i);if(document.getElementById("coord-info").textContent=`坐标: (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) 米`,this.isDragging&&this.selectedId){const o=this.objects.find(r=>r.id===this.selectedId);if(o){const r=n.x-this.dragStart.x,h=n.y-this.dragStart.y;o.x=this.originalPos.x+r,o.y=this.originalPos.y+h,this.render()}}this.currentTool!=="select"&&(this.renderer.render(this.objects,this.selectedId,this.getAnomalousIds(),this.boundary),this.renderer.drawPreview(this.currentTool,n,this.getSettings()))}handleMouseUp(t){this.isDragging&&this.selectedId&&(this.isDragging=!1,this.saveSnapshot())}handleWheel(t){t.preventDefault();const e=t.deltaY>0?-.1:.1;this.renderer.scale=Math.max(10,Math.min(200,this.renderer.scale*(1+e))),document.getElementById("scale-info").textContent=`比例: 1:${Math.round(50/this.renderer.scale*50)}`,this.render()}addObject(t){const e=this.getSettings();let s;switch(this.currentTool){case"parking":s=new p(t.x,t.y,e.width,e.length,e.angle);break;case"fireLane":s=new v(t.x,t.y,4,10);break;case"turningRadius":s=new w(t.x,t.y,6);break;case"obstacle":s=new S(t.x,t.y,2,2);break}s&&(this.objects.push(s),this.selectedId=s.id,this.saveSnapshot(),this.render())}getSettings(){return{width:parseFloat(document.getElementById("spot-width").value)||2.5,length:parseFloat(document.getElementById("spot-length").value)||5,angle:parseFloat(document.getElementById("spot-angle").value)||0}}getObjectAt(t,e){const s=this.renderer.screenToWorld(t,e);for(let i=this.objects.length-1;i>=0;i--){const n=this.objects[i];if(n.type==="turningRadius"){const o=s.x-n.x,r=s.y-n.y;if(Math.sqrt(o*o+r*r)<=n.radius)return n}else if(R(s.x,s.y,n.getBounds()))return n}return null}detectAnomalies(){return Y(this.objects,this.boundary)}getBoundaryFromInputs(){return{minX:parseFloat(document.getElementById("boundary-min-x").value)||this.defaultBoundary.minX,maxX:parseFloat(document.getElementById("boundary-max-x").value)||this.defaultBoundary.maxX,minY:parseFloat(document.getElementById("boundary-min-y").value)||this.defaultBoundary.minY,maxY:parseFloat(document.getElementById("boundary-max-y").value)||this.defaultBoundary.maxY}}getAnomalousIds(){const t=this.detectAnomalies(),e=new Set;for(const s of t)s.objectA&&e.add(s.objectA.id),s.objectB&&e.add(s.objectB.id),s.object&&e.add(s.object.id);return e}updateStats(){const t=this.objects.filter(n=>n.type==="parking").length,e=this.objects.filter(n=>n.type==="fireLane").length,s=this.objects.filter(n=>n.type==="turningRadius").length,i=this.detectAnomalies().length;document.getElementById("stat-spots").textContent=t,document.getElementById("stat-fire-lanes").textContent=e,document.getElementById("stat-turning").textContent=s,document.getElementById("stat-anomalies").textContent=i,this.updateAnomalyList()}updateAnomalyList(){const t=this.detectAnomalies(),e=document.getElementById("anomaly-list");if(t.length===0){e.innerHTML='<p class="no-anomalies">暂无异常</p>';return}let s="";for(const i of t){let n="error",o="";switch(i.type){case"collision":o="对象重叠";break;case"fireLane":o="消防通道占用";break;case"turningRadius":o="转弯区域侵入",n="warning";break;case"boundary":o="超出边界";break}s+=`
        <div class="anomaly-item ${n}">
          <h4>${o}</h4>
          <p>${i.message}</p>
        </div>
      `}e.innerHTML=s}saveSnapshot(){this.snapshots.push({objects:this.objects.map(t=>t.toJSON()),boundary:this.boundary?{...this.boundary}:null}),this.playbackIndex=this.snapshots.length-1}restoreSnapshot(t){k(),this.objects=t.objects.map(e=>E(e)),this.selectedId=null,this.boundary=t.boundary?{...t.boundary}:null,this.boundary?(document.getElementById("boundary-enabled").checked=!0,document.getElementById("boundary-min-x").value=this.boundary.minX,document.getElementById("boundary-max-x").value=this.boundary.maxX,document.getElementById("boundary-min-y").value=this.boundary.minY,document.getElementById("boundary-max-y").value=this.boundary.maxY):document.getElementById("boundary-enabled").checked=!1,this.render()}startPlayback(){if(this.snapshots.length<2){alert("需要至少两个状态才能回放");return}this.isPlaying=!0,this.playbackIndex=0,this.playbackLoop()}playbackLoop(){if(this.isPlaying){if(this.playbackIndex>=this.snapshots.length){this.isPlaying=!1;return}this.restoreSnapshot(this.snapshots[this.playbackIndex]),this.playbackIndex++,setTimeout(()=>this.playbackLoop(),1e3/this.playbackSpeed)}}loadPlan(t){k(),this.objects=t.objects.map(e=>E(e)).filter(Boolean),this.selectedId=null,this.boundary=t.boundary||null,this.boundary?(document.getElementById("boundary-enabled").checked=!0,document.getElementById("boundary-min-x").value=this.boundary.minX,document.getElementById("boundary-max-x").value=this.boundary.maxX,document.getElementById("boundary-min-y").value=this.boundary.minY,document.getElementById("boundary-max-y").value=this.boundary.maxY):document.getElementById("boundary-enabled").checked=!1,this.snapshots=[],this.saveSnapshot(),this.render()}render(){this.renderer.render(this.objects,this.selectedId,this.getAnomalousIds(),this.boundary),this.updateStats()}animate(){this.render(),requestAnimationFrame(()=>this.animate())}}document.addEventListener("DOMContentLoaded",()=>{new C});
