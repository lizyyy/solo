(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(i){if(i.ep)return;i.ep=!0;const r=e(i);fetch(i.href,r)}})();/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Cr="160",kn={ROTATE:0,DOLLY:1,PAN:2},Vn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Ml=0,$r=1,Sl=2,Do=1,Io=2,en=3,Mn=0,Te=1,Oe=2,gn=0,fi=1,qr=2,jr=3,Yr=4,yl=5,Pn=100,El=101,bl=102,Kr=103,Zr=104,Tl=200,Al=201,wl=202,Rl=203,_r=204,vr=205,Cl=206,Pl=207,Ll=208,Dl=209,Il=210,Ul=211,Nl=212,Fl=213,Ol=214,Bl=0,zl=1,Hl=2,ms=3,kl=4,Vl=5,Gl=6,Wl=7,Uo=0,Xl=1,$l=2,_n=0,ql=1,jl=2,Yl=3,No=4,Kl=5,Zl=6,Fo=300,_i=301,vi=302,xr=303,Mr=304,ys=306,Sr=1e3,Xe=1001,yr=1002,ye=1003,Jr=1004,Us=1005,Ue=1006,Jl=1007,Ui=1008,vn=1009,Ql=1010,tc=1011,Pr=1012,Oo=1013,fn=1014,pn=1015,Ni=1016,Bo=1017,zo=1018,In=1020,ec=1021,$e=1023,nc=1024,ic=1025,Un=1026,xi=1027,sc=1028,Ho=1029,rc=1030,ko=1031,Vo=1033,Ns=33776,Fs=33777,Os=33778,Bs=33779,Qr=35840,ta=35841,ea=35842,na=35843,Go=36196,ia=37492,sa=37496,ra=37808,aa=37809,oa=37810,la=37811,ca=37812,da=37813,ha=37814,ua=37815,fa=37816,pa=37817,ma=37818,ga=37819,_a=37820,va=37821,zs=36492,xa=36494,Ma=36495,ac=36283,Sa=36284,ya=36285,Ea=36286,Wo=3e3,Nn=3001,oc=3200,lc=3201,Xo=0,cc=1,Be="",pe="srgb",an="srgb-linear",Lr="display-p3",Es="display-p3-linear",gs="linear",Zt="srgb",_s="rec709",vs="p3",Gn=7680,ba=519,dc=512,hc=513,uc=514,$o=515,fc=516,pc=517,mc=518,gc=519,Er=35044,Ta="300 es",br=1035,rn=2e3,xs=2001;class zn{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,t);t.target=null}}}const ve=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],fs=Math.PI/180,Tr=180/Math.PI;function xn(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(ve[s&255]+ve[s>>8&255]+ve[s>>16&255]+ve[s>>24&255]+"-"+ve[t&255]+ve[t>>8&255]+"-"+ve[t>>16&15|64]+ve[t>>24&255]+"-"+ve[e&63|128]+ve[e>>8&255]+"-"+ve[e>>16&255]+ve[e>>24&255]+ve[n&255]+ve[n>>8&255]+ve[n>>16&255]+ve[n>>24&255]).toLowerCase()}function Ee(s,t,e){return Math.max(t,Math.min(e,s))}function _c(s,t){return(s%t+t)%t}function Hs(s,t,e){return(1-e)*s+e*t}function Aa(s){return(s&s-1)===0&&s!==0}function Ar(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function nn(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Yt(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}const vc={DEG2RAD:fs};class Et{constructor(t=0,e=0){Et.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Ee(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*i+t.x,this.y=r*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Vt{constructor(t,e,n,i,r,a,o,l,c){Vt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c)}set(t,e,n,i,r,a,o,l,c){const d=this.elements;return d[0]=t,d[1]=i,d[2]=o,d[3]=e,d[4]=r,d[5]=l,d[6]=n,d[7]=a,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],d=n[4],u=n[7],p=n[2],m=n[5],g=n[8],_=i[0],f=i[3],h=i[6],E=i[1],x=i[4],T=i[7],D=i[2],R=i[5],w=i[8];return r[0]=a*_+o*E+l*D,r[3]=a*f+o*x+l*R,r[6]=a*h+o*T+l*w,r[1]=c*_+d*E+u*D,r[4]=c*f+d*x+u*R,r[7]=c*h+d*T+u*w,r[2]=p*_+m*E+g*D,r[5]=p*f+m*x+g*R,r[8]=p*h+m*T+g*w,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],d=t[8];return e*a*d-e*o*c-n*r*d+n*o*l+i*r*c-i*a*l}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],d=t[8],u=d*a-o*c,p=o*l-d*r,m=c*r-a*l,g=e*u+n*p+i*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*c-d*n)*_,t[2]=(o*n-i*a)*_,t[3]=p*_,t[4]=(d*e-i*l)*_,t[5]=(i*r-o*e)*_,t[6]=m*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-i*c,i*l,-i*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(ks.makeScale(t,e)),this}rotate(t){return this.premultiply(ks.makeRotation(-t)),this}translate(t,e){return this.premultiply(ks.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const ks=new Vt;function qo(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function Ms(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function xc(){const s=Ms("canvas");return s.style.display="block",s}const wa={};function Li(s){s in wa||(wa[s]=!0,console.warn(s))}const Ra=new Vt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),Ca=new Vt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),Hi={[an]:{transfer:gs,primaries:_s,toReference:s=>s,fromReference:s=>s},[pe]:{transfer:Zt,primaries:_s,toReference:s=>s.convertSRGBToLinear(),fromReference:s=>s.convertLinearToSRGB()},[Es]:{transfer:gs,primaries:vs,toReference:s=>s.applyMatrix3(Ca),fromReference:s=>s.applyMatrix3(Ra)},[Lr]:{transfer:Zt,primaries:vs,toReference:s=>s.convertSRGBToLinear().applyMatrix3(Ca),fromReference:s=>s.applyMatrix3(Ra).convertLinearToSRGB()}},Mc=new Set([an,Es]),jt={enabled:!0,_workingColorSpace:an,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(s){if(!Mc.has(s))throw new Error(`Unsupported working color space, "${s}".`);this._workingColorSpace=s},convert:function(s,t,e){if(this.enabled===!1||t===e||!t||!e)return s;const n=Hi[t].toReference,i=Hi[e].fromReference;return i(n(s))},fromWorkingColorSpace:function(s,t){return this.convert(s,this._workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this._workingColorSpace)},getPrimaries:function(s){return Hi[s].primaries},getTransfer:function(s){return s===Be?gs:Hi[s].transfer}};function pi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Vs(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let Wn;class jo{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Wn===void 0&&(Wn=Ms("canvas")),Wn.width=t.width,Wn.height=t.height;const n=Wn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Wn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Ms("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=pi(r[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(pi(e[n]/255)*255):e[n]=pi(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Sc=0;class Yo{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Sc++}),this.uuid=xn(),this.data=t,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(Gs(i[a].image)):r.push(Gs(i[a]))}else r=Gs(i);n.url=r}return e||(t.images[this.uuid]=n),n}}function Gs(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?jo.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let yc=0;class Ae extends zn{constructor(t=Ae.DEFAULT_IMAGE,e=Ae.DEFAULT_MAPPING,n=Xe,i=Xe,r=Ue,a=Ui,o=$e,l=vn,c=Ae.DEFAULT_ANISOTROPY,d=Be){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:yc++}),this.uuid=xn(),this.name="",this.source=new Yo(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Et(0,0),this.repeat=new Et(1,1),this.center=new Et(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Vt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof d=="string"?this.colorSpace=d:(Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=d===Nn?pe:Be),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Fo)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Sr:t.x=t.x-Math.floor(t.x);break;case Xe:t.x=t.x<0?0:1;break;case yr:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Sr:t.y=t.y-Math.floor(t.y);break;case Xe:t.y=t.y<0?0:1;break;case yr:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===pe?Nn:Wo}set encoding(t){Li("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=t===Nn?pe:Be}}Ae.DEFAULT_IMAGE=null;Ae.DEFAULT_MAPPING=Fo;Ae.DEFAULT_ANISOTROPY=1;class me{constructor(t=0,e=0,n=0,i=1){me.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*r,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,r;const l=t.elements,c=l[0],d=l[4],u=l[8],p=l[1],m=l[5],g=l[9],_=l[2],f=l[6],h=l[10];if(Math.abs(d-p)<.01&&Math.abs(u-_)<.01&&Math.abs(g-f)<.01){if(Math.abs(d+p)<.1&&Math.abs(u+_)<.1&&Math.abs(g+f)<.1&&Math.abs(c+m+h-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const x=(c+1)/2,T=(m+1)/2,D=(h+1)/2,R=(d+p)/4,w=(u+_)/4,W=(g+f)/4;return x>T&&x>D?x<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(x),i=R/n,r=w/n):T>D?T<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(T),n=R/i,r=W/i):D<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(D),n=w/r,i=W/r),this.set(n,i,r,e),this}let E=Math.sqrt((f-g)*(f-g)+(u-_)*(u-_)+(p-d)*(p-d));return Math.abs(E)<.001&&(E=1),this.x=(f-g)/E,this.y=(u-_)/E,this.z=(p-d)/E,this.w=Math.acos((c+m+h-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Ec extends zn{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new me(0,0,t,e),this.scissorTest=!1,this.viewport=new me(0,0,t,e);const i={width:t,height:e,depth:1};n.encoding!==void 0&&(Li("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===Nn?pe:Be),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ue,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Ae(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(t,e,n=1){(this.width!==t||this.height!==e||this.depth!==n)&&(this.width=t,this.height=e,this.depth=n,this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.texture=t.texture.clone(),this.texture.isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Yo(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Fn extends Ec{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Ko extends Ae{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=ye,this.minFilter=ye,this.wrapR=Xe,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class bc extends Ae{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=ye,this.minFilter=ye,this.wrapR=Xe,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class On{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,r,a,o){let l=n[i+0],c=n[i+1],d=n[i+2],u=n[i+3];const p=r[a+0],m=r[a+1],g=r[a+2],_=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=d,t[e+3]=u;return}if(o===1){t[e+0]=p,t[e+1]=m,t[e+2]=g,t[e+3]=_;return}if(u!==_||l!==p||c!==m||d!==g){let f=1-o;const h=l*p+c*m+d*g+u*_,E=h>=0?1:-1,x=1-h*h;if(x>Number.EPSILON){const D=Math.sqrt(x),R=Math.atan2(D,h*E);f=Math.sin(f*R)/D,o=Math.sin(o*R)/D}const T=o*E;if(l=l*f+p*T,c=c*f+m*T,d=d*f+g*T,u=u*f+_*T,f===1-o){const D=1/Math.sqrt(l*l+c*c+d*d+u*u);l*=D,c*=D,d*=D,u*=D}}t[e]=l,t[e+1]=c,t[e+2]=d,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,r,a){const o=n[i],l=n[i+1],c=n[i+2],d=n[i+3],u=r[a],p=r[a+1],m=r[a+2],g=r[a+3];return t[e]=o*g+d*u+l*m-c*p,t[e+1]=l*g+d*p+c*u-o*m,t[e+2]=c*g+d*m+o*p-l*u,t[e+3]=d*g-o*u-l*p-c*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),d=o(i/2),u=o(r/2),p=l(n/2),m=l(i/2),g=l(r/2);switch(a){case"XYZ":this._x=p*d*u+c*m*g,this._y=c*m*u-p*d*g,this._z=c*d*g+p*m*u,this._w=c*d*u-p*m*g;break;case"YXZ":this._x=p*d*u+c*m*g,this._y=c*m*u-p*d*g,this._z=c*d*g-p*m*u,this._w=c*d*u+p*m*g;break;case"ZXY":this._x=p*d*u-c*m*g,this._y=c*m*u+p*d*g,this._z=c*d*g+p*m*u,this._w=c*d*u-p*m*g;break;case"ZYX":this._x=p*d*u-c*m*g,this._y=c*m*u+p*d*g,this._z=c*d*g-p*m*u,this._w=c*d*u+p*m*g;break;case"YZX":this._x=p*d*u+c*m*g,this._y=c*m*u+p*d*g,this._z=c*d*g-p*m*u,this._w=c*d*u-p*m*g;break;case"XZY":this._x=p*d*u-c*m*g,this._y=c*m*u-p*d*g,this._z=c*d*g+p*m*u,this._w=c*d*u+p*m*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],d=e[6],u=e[10],p=n+o+u;if(p>0){const m=.5/Math.sqrt(p+1);this._w=.25/m,this._x=(d-l)*m,this._y=(r-c)*m,this._z=(a-i)*m}else if(n>o&&n>u){const m=2*Math.sqrt(1+n-o-u);this._w=(d-l)/m,this._x=.25*m,this._y=(i+a)/m,this._z=(r+c)/m}else if(o>u){const m=2*Math.sqrt(1+o-n-u);this._w=(r-c)/m,this._x=(i+a)/m,this._y=.25*m,this._z=(l+d)/m}else{const m=2*Math.sqrt(1+u-n-o);this._w=(a-i)/m,this._x=(r+c)/m,this._y=(l+d)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Ee(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,d=e._w;return this._x=n*d+a*o+i*c-r*l,this._y=i*d+a*l+r*o-n*c,this._z=r*d+a*c+n*l-i*o,this._w=a*d-n*o-i*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,r=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const m=1-e;return this._w=m*a+e*this._w,this._x=m*n+e*this._x,this._y=m*i+e*this._y,this._z=m*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),d=Math.atan2(c,o),u=Math.sin((1-e)*d)/c,p=Math.sin(e*d)/c;return this._w=a*u+this._w*p,this._x=n*u+this._x*p,this._y=i*u+this._y*p,this._z=r*u+this._z*p,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=Math.random(),e=Math.sqrt(1-t),n=Math.sqrt(t),i=2*Math.PI*Math.random(),r=2*Math.PI*Math.random();return this.set(e*Math.cos(i),n*Math.sin(r),n*Math.cos(r),e*Math.sin(i))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{constructor(t=0,e=0,n=0){L.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Pa.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Pa.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*i,this.y=r[1]*e+r[4]*n+r[7]*i,this.z=r[2]*e+r[5]*n+r[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*i-o*n),d=2*(o*e-r*i),u=2*(r*n-a*e);return this.x=e+l*c+a*u-o*d,this.y=n+l*d+o*c-r*u,this.z=i+l*u+r*d-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*i,this.y=r[1]*e+r[5]*n+r[9]*i,this.z=r[2]*e+r[6]*n+r[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=i*l-r*o,this.y=r*a-n*l,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ws.copy(this).projectOnVector(t),this.sub(Ws)}reflect(t){return this.sub(Ws.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Ee(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=(Math.random()-.5)*2,e=Math.random()*Math.PI*2,n=Math.sqrt(1-t**2);return this.x=n*Math.cos(e),this.y=n*Math.sin(e),this.z=t,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ws=new L,Pa=new On;class Oi{constructor(t=new L(1/0,1/0,1/0),e=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(He.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(He.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=He.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,He):He.fromBufferAttribute(r,a),He.applyMatrix4(t.matrixWorld),this.expandByPoint(He);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ki.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ki.copy(n.boundingBox)),ki.applyMatrix4(t.matrixWorld),this.union(ki)}const i=t.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],e);return this}containsPoint(t){return!(t.x<this.min.x||t.x>this.max.x||t.y<this.min.y||t.y>this.max.y||t.z<this.min.z||t.z>this.max.z)}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return!(t.max.x<this.min.x||t.min.x>this.max.x||t.max.y<this.min.y||t.min.y>this.max.y||t.max.z<this.min.z||t.min.z>this.max.z)}intersectsSphere(t){return this.clampPoint(t.center,He),He.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ei),Vi.subVectors(this.max,Ei),Xn.subVectors(t.a,Ei),$n.subVectors(t.b,Ei),qn.subVectors(t.c,Ei),on.subVectors($n,Xn),ln.subVectors(qn,$n),En.subVectors(Xn,qn);let e=[0,-on.z,on.y,0,-ln.z,ln.y,0,-En.z,En.y,on.z,0,-on.x,ln.z,0,-ln.x,En.z,0,-En.x,-on.y,on.x,0,-ln.y,ln.x,0,-En.y,En.x,0];return!Xs(e,Xn,$n,qn,Vi)||(e=[1,0,0,0,1,0,0,0,1],!Xs(e,Xn,$n,qn,Vi))?!1:(Gi.crossVectors(on,ln),e=[Gi.x,Gi.y,Gi.z],Xs(e,Xn,$n,qn,Vi))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,He).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(He).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Ke[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Ke[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Ke[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Ke[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Ke[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Ke[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Ke[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Ke[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Ke),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const Ke=[new L,new L,new L,new L,new L,new L,new L,new L],He=new L,ki=new Oi,Xn=new L,$n=new L,qn=new L,on=new L,ln=new L,En=new L,Ei=new L,Vi=new L,Gi=new L,bn=new L;function Xs(s,t,e,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){bn.fromArray(s,r);const o=i.x*Math.abs(bn.x)+i.y*Math.abs(bn.y)+i.z*Math.abs(bn.z),l=t.dot(bn),c=e.dot(bn),d=n.dot(bn);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>o)return!1}return!0}const Tc=new Oi,bi=new L,$s=new L;class bs{constructor(t=new L,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Tc.setFromPoints(t).getCenter(n);let i=0;for(let r=0,a=t.length;r<a;r++)i=Math.max(i,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;bi.subVectors(t,this.center);const e=bi.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(bi,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):($s.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(bi.copy(t.center).add($s)),this.expandByPoint(bi.copy(t.center).sub($s))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Ze=new L,qs=new L,Wi=new L,cn=new L,js=new L,Xi=new L,Ys=new L;class Ts{constructor(t=new L,e=new L(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Ze)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Ze.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Ze.copy(this.origin).addScaledVector(this.direction,e),Ze.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){qs.copy(t).add(e).multiplyScalar(.5),Wi.copy(e).sub(t).normalize(),cn.copy(this.origin).sub(qs);const r=t.distanceTo(e)*.5,a=-this.direction.dot(Wi),o=cn.dot(this.direction),l=-cn.dot(Wi),c=cn.lengthSq(),d=Math.abs(1-a*a);let u,p,m,g;if(d>0)if(u=a*l-o,p=a*o-l,g=r*d,u>=0)if(p>=-g)if(p<=g){const _=1/d;u*=_,p*=_,m=u*(u+a*p+2*o)+p*(a*u+p+2*l)+c}else p=r,u=Math.max(0,-(a*p+o)),m=-u*u+p*(p+2*l)+c;else p=-r,u=Math.max(0,-(a*p+o)),m=-u*u+p*(p+2*l)+c;else p<=-g?(u=Math.max(0,-(-a*r+o)),p=u>0?-r:Math.min(Math.max(-r,-l),r),m=-u*u+p*(p+2*l)+c):p<=g?(u=0,p=Math.min(Math.max(-r,-l),r),m=p*(p+2*l)+c):(u=Math.max(0,-(a*r+o)),p=u>0?r:Math.min(Math.max(-r,-l),r),m=-u*u+p*(p+2*l)+c);else p=a>0?-r:r,u=Math.max(0,-(a*p+o)),m=-u*u+p*(p+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(qs).addScaledVector(Wi,p),m}intersectSphere(t,e){Ze.subVectors(t.center,this.origin);const n=Ze.dot(this.direction),i=Ze.dot(Ze)-n*n,r=t.radius*t.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,r,a,o,l;const c=1/this.direction.x,d=1/this.direction.y,u=1/this.direction.z,p=this.origin;return c>=0?(n=(t.min.x-p.x)*c,i=(t.max.x-p.x)*c):(n=(t.max.x-p.x)*c,i=(t.min.x-p.x)*c),d>=0?(r=(t.min.y-p.y)*d,a=(t.max.y-p.y)*d):(r=(t.max.y-p.y)*d,a=(t.min.y-p.y)*d),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-p.z)*u,l=(t.max.z-p.z)*u):(o=(t.max.z-p.z)*u,l=(t.min.z-p.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,Ze)!==null}intersectTriangle(t,e,n,i,r){js.subVectors(e,t),Xi.subVectors(n,t),Ys.crossVectors(js,Xi);let a=this.direction.dot(Ys),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;cn.subVectors(this.origin,t);const l=o*this.direction.dot(Xi.crossVectors(cn,Xi));if(l<0)return null;const c=o*this.direction.dot(js.cross(cn));if(c<0||l+c>a)return null;const d=-o*cn.dot(Ys);return d<0?null:this.at(d/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class re{constructor(t,e,n,i,r,a,o,l,c,d,u,p,m,g,_,f){re.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,r,a,o,l,c,d,u,p,m,g,_,f)}set(t,e,n,i,r,a,o,l,c,d,u,p,m,g,_,f){const h=this.elements;return h[0]=t,h[4]=e,h[8]=n,h[12]=i,h[1]=r,h[5]=a,h[9]=o,h[13]=l,h[2]=c,h[6]=d,h[10]=u,h[14]=p,h[3]=m,h[7]=g,h[11]=_,h[15]=f,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new re().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/jn.setFromMatrixColumn(t,0).length(),r=1/jn.setFromMatrixColumn(t,1).length(),a=1/jn.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),d=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const p=a*d,m=a*u,g=o*d,_=o*u;e[0]=l*d,e[4]=-l*u,e[8]=c,e[1]=m+g*c,e[5]=p-_*c,e[9]=-o*l,e[2]=_-p*c,e[6]=g+m*c,e[10]=a*l}else if(t.order==="YXZ"){const p=l*d,m=l*u,g=c*d,_=c*u;e[0]=p+_*o,e[4]=g*o-m,e[8]=a*c,e[1]=a*u,e[5]=a*d,e[9]=-o,e[2]=m*o-g,e[6]=_+p*o,e[10]=a*l}else if(t.order==="ZXY"){const p=l*d,m=l*u,g=c*d,_=c*u;e[0]=p-_*o,e[4]=-a*u,e[8]=g+m*o,e[1]=m+g*o,e[5]=a*d,e[9]=_-p*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const p=a*d,m=a*u,g=o*d,_=o*u;e[0]=l*d,e[4]=g*c-m,e[8]=p*c+_,e[1]=l*u,e[5]=_*c+p,e[9]=m*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const p=a*l,m=a*c,g=o*l,_=o*c;e[0]=l*d,e[4]=_-p*u,e[8]=g*u+m,e[1]=u,e[5]=a*d,e[9]=-o*d,e[2]=-c*d,e[6]=m*u+g,e[10]=p-_*u}else if(t.order==="XZY"){const p=a*l,m=a*c,g=o*l,_=o*c;e[0]=l*d,e[4]=-u,e[8]=c*d,e[1]=p*u+_,e[5]=a*d,e[9]=m*u-g,e[2]=g*u-m,e[6]=o*d,e[10]=_*u+p}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Ac,t,wc)}lookAt(t,e,n){const i=this.elements;return Ce.subVectors(t,e),Ce.lengthSq()===0&&(Ce.z=1),Ce.normalize(),dn.crossVectors(n,Ce),dn.lengthSq()===0&&(Math.abs(n.z)===1?Ce.x+=1e-4:Ce.z+=1e-4,Ce.normalize(),dn.crossVectors(n,Ce)),dn.normalize(),$i.crossVectors(Ce,dn),i[0]=dn.x,i[4]=$i.x,i[8]=Ce.x,i[1]=dn.y,i[5]=$i.y,i[9]=Ce.y,i[2]=dn.z,i[6]=$i.z,i[10]=Ce.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],d=n[1],u=n[5],p=n[9],m=n[13],g=n[2],_=n[6],f=n[10],h=n[14],E=n[3],x=n[7],T=n[11],D=n[15],R=i[0],w=i[4],W=i[8],S=i[12],b=i[1],k=i[5],V=i[9],Q=i[13],P=i[2],F=i[6],H=i[10],q=i[14],X=i[3],$=i[7],j=i[11],st=i[15];return r[0]=a*R+o*b+l*P+c*X,r[4]=a*w+o*k+l*F+c*$,r[8]=a*W+o*V+l*H+c*j,r[12]=a*S+o*Q+l*q+c*st,r[1]=d*R+u*b+p*P+m*X,r[5]=d*w+u*k+p*F+m*$,r[9]=d*W+u*V+p*H+m*j,r[13]=d*S+u*Q+p*q+m*st,r[2]=g*R+_*b+f*P+h*X,r[6]=g*w+_*k+f*F+h*$,r[10]=g*W+_*V+f*H+h*j,r[14]=g*S+_*Q+f*q+h*st,r[3]=E*R+x*b+T*P+D*X,r[7]=E*w+x*k+T*F+D*$,r[11]=E*W+x*V+T*H+D*j,r[15]=E*S+x*Q+T*q+D*st,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],d=t[2],u=t[6],p=t[10],m=t[14],g=t[3],_=t[7],f=t[11],h=t[15];return g*(+r*l*u-i*c*u-r*o*p+n*c*p+i*o*m-n*l*m)+_*(+e*l*m-e*c*p+r*a*p-i*a*m+i*c*d-r*l*d)+f*(+e*c*u-e*o*m-r*a*u+n*a*m+r*o*d-n*c*d)+h*(-i*o*d-e*l*u+e*o*p+i*a*u-n*a*p+n*l*d)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],d=t[8],u=t[9],p=t[10],m=t[11],g=t[12],_=t[13],f=t[14],h=t[15],E=u*f*c-_*p*c+_*l*m-o*f*m-u*l*h+o*p*h,x=g*p*c-d*f*c-g*l*m+a*f*m+d*l*h-a*p*h,T=d*_*c-g*u*c+g*o*m-a*_*m-d*o*h+a*u*h,D=g*u*l-d*_*l-g*o*p+a*_*p+d*o*f-a*u*f,R=e*E+n*x+i*T+r*D;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const w=1/R;return t[0]=E*w,t[1]=(_*p*r-u*f*r-_*i*m+n*f*m+u*i*h-n*p*h)*w,t[2]=(o*f*r-_*l*r+_*i*c-n*f*c-o*i*h+n*l*h)*w,t[3]=(u*l*r-o*p*r-u*i*c+n*p*c+o*i*m-n*l*m)*w,t[4]=x*w,t[5]=(d*f*r-g*p*r+g*i*m-e*f*m-d*i*h+e*p*h)*w,t[6]=(g*l*r-a*f*r-g*i*c+e*f*c+a*i*h-e*l*h)*w,t[7]=(a*p*r-d*l*r+d*i*c-e*p*c-a*i*m+e*l*m)*w,t[8]=T*w,t[9]=(g*u*r-d*_*r-g*n*m+e*_*m+d*n*h-e*u*h)*w,t[10]=(a*_*r-g*o*r+g*n*c-e*_*c-a*n*h+e*o*h)*w,t[11]=(d*o*r-a*u*r-d*n*c+e*u*c+a*n*m-e*o*m)*w,t[12]=D*w,t[13]=(d*_*i-g*u*i+g*n*p-e*_*p-d*n*f+e*u*f)*w,t[14]=(g*o*i-a*_*i-g*n*l+e*_*l+a*n*f-e*o*f)*w,t[15]=(a*u*i-d*o*i+d*n*l-e*u*l-a*n*p+e*o*p)*w,this}scale(t){const e=this.elements,n=t.x,i=t.y,r=t.z;return e[0]*=n,e[4]*=i,e[8]*=r,e[1]*=n,e[5]*=i,e[9]*=r,e[2]*=n,e[6]*=i,e[10]*=r,e[3]*=n,e[7]*=i,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,d=r*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,d*o+n,d*l-i*a,0,c*l-i*o,d*l+i*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,r,a){return this.set(1,n,r,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,d=a+a,u=o+o,p=r*c,m=r*d,g=r*u,_=a*d,f=a*u,h=o*u,E=l*c,x=l*d,T=l*u,D=n.x,R=n.y,w=n.z;return i[0]=(1-(_+h))*D,i[1]=(m+T)*D,i[2]=(g-x)*D,i[3]=0,i[4]=(m-T)*R,i[5]=(1-(p+h))*R,i[6]=(f+E)*R,i[7]=0,i[8]=(g+x)*w,i[9]=(f-E)*w,i[10]=(1-(p+_))*w,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let r=jn.set(i[0],i[1],i[2]).length();const a=jn.set(i[4],i[5],i[6]).length(),o=jn.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),t.x=i[12],t.y=i[13],t.z=i[14],ke.copy(this);const c=1/r,d=1/a,u=1/o;return ke.elements[0]*=c,ke.elements[1]*=c,ke.elements[2]*=c,ke.elements[4]*=d,ke.elements[5]*=d,ke.elements[6]*=d,ke.elements[8]*=u,ke.elements[9]*=u,ke.elements[10]*=u,e.setFromRotationMatrix(ke),n.x=r,n.y=a,n.z=o,this}makePerspective(t,e,n,i,r,a,o=rn){const l=this.elements,c=2*r/(e-t),d=2*r/(n-i),u=(e+t)/(e-t),p=(n+i)/(n-i);let m,g;if(o===rn)m=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===xs)m=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=d,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,i,r,a,o=rn){const l=this.elements,c=1/(e-t),d=1/(n-i),u=1/(a-r),p=(e+t)*c,m=(n+i)*d;let g,_;if(o===rn)g=(a+r)*u,_=-2*u;else if(o===xs)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-p,l[1]=0,l[5]=2*d,l[9]=0,l[13]=-m,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const jn=new L,ke=new re,Ac=new L(0,0,0),wc=new L(1,1,1),dn=new L,$i=new L,Ce=new L,La=new re,Da=new On;class As{constructor(t=0,e=0,n=0,i=As.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,r=i[0],a=i[4],o=i[8],l=i[1],c=i[5],d=i[9],u=i[2],p=i[6],m=i[10];switch(e){case"XYZ":this._y=Math.asin(Ee(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-d,m),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(p,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ee(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(o,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ee(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-u,m),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Ee(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(p,m),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Ee(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,m));break;case"XZY":this._z=Math.asin(-Ee(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(p,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-d,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return La.makeRotationFromQuaternion(t),this.setFromRotationMatrix(La,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Da.setFromEuler(this),this.setFromQuaternion(Da,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}As.DEFAULT_ORDER="XYZ";class Dr{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Rc=0;const Ia=new L,Yn=new On,Je=new re,qi=new L,Ti=new L,Cc=new L,Pc=new On,Ua=new L(1,0,0),Na=new L(0,1,0),Fa=new L(0,0,1),Lc={type:"added"},Dc={type:"removed"};class ce extends zn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Rc++}),this.uuid=xn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ce.DEFAULT_UP.clone();const t=new L,e=new As,n=new On,i=new L(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new re},normalMatrix:{value:new Vt}}),this.matrix=new re,this.matrixWorld=new re,this.matrixAutoUpdate=ce.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ce.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Dr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Yn.setFromAxisAngle(t,e),this.quaternion.multiply(Yn),this}rotateOnWorldAxis(t,e){return Yn.setFromAxisAngle(t,e),this.quaternion.premultiply(Yn),this}rotateX(t){return this.rotateOnAxis(Ua,t)}rotateY(t){return this.rotateOnAxis(Na,t)}rotateZ(t){return this.rotateOnAxis(Fa,t)}translateOnAxis(t,e){return Ia.copy(t).applyQuaternion(this.quaternion),this.position.add(Ia.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ua,t)}translateY(t){return this.translateOnAxis(Na,t)}translateZ(t){return this.translateOnAxis(Fa,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Je.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?qi.copy(t):qi.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Ti.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Je.lookAt(Ti,qi,this.up):Je.lookAt(qi,Ti,this.up),this.quaternion.setFromRotationMatrix(Je),i&&(Je.extractRotation(i.matrixWorld),Yn.setFromRotationMatrix(Je),this.quaternion.premultiply(Yn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.parent!==null&&t.parent.remove(t),t.parent=this,this.children.push(t),t.dispatchEvent(Lc)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Dc)),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Je.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Je.multiply(t.parent.matrixWorld)),t.applyMatrix4(Je),this.add(t),t.updateWorldMatrix(!1,!0),this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ti,t,Cc),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ti,Pc,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++){const r=e[n];(r.matrixWorldAutoUpdate===!0||t===!0)&&r.updateMatrixWorld(t)}}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++){const o=i[r];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),i.maxGeometryCount=this._maxGeometryCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));i.material=o}else i.material=r(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),d=a(t.images),u=a(t.shapes),p=a(t.skeletons),m=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),d.length>0&&(n.images=d),u.length>0&&(n.shapes=u),p.length>0&&(n.skeletons=p),m.length>0&&(n.animations=m),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const l=[];for(const c in o){const d=o[c];delete d.metadata,l.push(d)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}ce.DEFAULT_UP=new L(0,1,0);ce.DEFAULT_MATRIX_AUTO_UPDATE=!0;ce.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Ve=new L,Qe=new L,Ks=new L,tn=new L,Kn=new L,Zn=new L,Oa=new L,Zs=new L,Js=new L,Qs=new L;let ji=!1;class Ne{constructor(t=new L,e=new L,n=new L){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Ve.subVectors(t,e),i.cross(Ve);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(t,e,n,i,r){Ve.subVectors(i,e),Qe.subVectors(n,e),Ks.subVectors(t,e);const a=Ve.dot(Ve),o=Ve.dot(Qe),l=Ve.dot(Ks),c=Qe.dot(Qe),d=Qe.dot(Ks),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const p=1/u,m=(c*l-o*d)*p,g=(a*d-o*l)*p;return r.set(1-m-g,g,m)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,tn)===null?!1:tn.x>=0&&tn.y>=0&&tn.x+tn.y<=1}static getUV(t,e,n,i,r,a,o,l){return ji===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),ji=!0),this.getInterpolation(t,e,n,i,r,a,o,l)}static getInterpolation(t,e,n,i,r,a,o,l){return this.getBarycoord(t,e,n,i,tn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,tn.x),l.addScaledVector(a,tn.y),l.addScaledVector(o,tn.z),l)}static isFrontFacing(t,e,n,i){return Ve.subVectors(n,e),Qe.subVectors(t,e),Ve.cross(Qe).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ve.subVectors(this.c,this.b),Qe.subVectors(this.a,this.b),Ve.cross(Qe).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ne.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ne.getBarycoord(t,this.a,this.b,this.c,e)}getUV(t,e,n,i,r){return ji===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),ji=!0),Ne.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}getInterpolation(t,e,n,i,r){return Ne.getInterpolation(t,this.a,this.b,this.c,e,n,i,r)}containsPoint(t){return Ne.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ne.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,r=this.c;let a,o;Kn.subVectors(i,n),Zn.subVectors(r,n),Zs.subVectors(t,n);const l=Kn.dot(Zs),c=Zn.dot(Zs);if(l<=0&&c<=0)return e.copy(n);Js.subVectors(t,i);const d=Kn.dot(Js),u=Zn.dot(Js);if(d>=0&&u<=d)return e.copy(i);const p=l*u-d*c;if(p<=0&&l>=0&&d<=0)return a=l/(l-d),e.copy(n).addScaledVector(Kn,a);Qs.subVectors(t,r);const m=Kn.dot(Qs),g=Zn.dot(Qs);if(g>=0&&m<=g)return e.copy(r);const _=m*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(Zn,o);const f=d*g-m*u;if(f<=0&&u-d>=0&&m-g>=0)return Oa.subVectors(r,i),o=(u-d)/(u-d+(m-g)),e.copy(i).addScaledVector(Oa,o);const h=1/(f+_+p);return a=_*h,o=p*h,e.copy(n).addScaledVector(Kn,a).addScaledVector(Zn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Zo={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},hn={h:0,s:0,l:0},Yi={h:0,s:0,l:0};function tr(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Bt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=pe){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,jt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=jt.workingColorSpace){return this.r=t,this.g=e,this.b=n,jt.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=jt.workingColorSpace){if(t=_c(t,1),e=Ee(e,0,1),n=Ee(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=tr(a,r,t+1/3),this.g=tr(a,r,t),this.b=tr(a,r,t-1/3)}return jt.toWorkingColorSpace(this,i),this}setStyle(t,e=pe){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=pe){const n=Zo[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=pi(t.r),this.g=pi(t.g),this.b=pi(t.b),this}copyLinearToSRGB(t){return this.r=Vs(t.r),this.g=Vs(t.g),this.b=Vs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=pe){return jt.fromWorkingColorSpace(xe.copy(this),t),Math.round(Ee(xe.r*255,0,255))*65536+Math.round(Ee(xe.g*255,0,255))*256+Math.round(Ee(xe.b*255,0,255))}getHexString(t=pe){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=jt.workingColorSpace){jt.fromWorkingColorSpace(xe.copy(this),e);const n=xe.r,i=xe.g,r=xe.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let l,c;const d=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=d<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-r)/u+(i<r?6:0);break;case i:l=(r-n)/u+2;break;case r:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=d,t}getRGB(t,e=jt.workingColorSpace){return jt.fromWorkingColorSpace(xe.copy(this),e),t.r=xe.r,t.g=xe.g,t.b=xe.b,t}getStyle(t=pe){jt.fromWorkingColorSpace(xe.copy(this),t);const e=xe.r,n=xe.g,i=xe.b;return t!==pe?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(hn),this.setHSL(hn.h+t,hn.s+e,hn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(hn),t.getHSL(Yi);const n=Hs(hn.h,Yi.h,e),i=Hs(hn.s,Yi.s,e),r=Hs(hn.l,Yi.l,e);return this.setHSL(n,i,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*i,this.g=r[1]*e+r[4]*n+r[7]*i,this.b=r[2]*e+r[5]*n+r[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const xe=new Bt;Bt.NAMES=Zo;let Ic=0;class Hn extends zn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ic++}),this.uuid=xn(),this.name="",this.type="Material",this.blending=fi,this.side=Mn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=_r,this.blendDst=vr,this.blendEquation=Pn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Bt(0,0,0),this.blendAlpha=0,this.depthFunc=ms,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ba,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Gn,this.stencilZFail=Gn,this.stencilZPass=Gn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==fi&&(n.blending=this.blending),this.side!==Mn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==_r&&(n.blendSrc=this.blendSrc),this.blendDst!==vr&&(n.blendDst=this.blendDst),this.blendEquation!==Pn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==ms&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ba&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Gn&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Gn&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Gn&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=i(t.textures),a=i(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class mn extends Hn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Bt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Uo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const oe=new L,Ki=new Et;class ze{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Er,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=pn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Ki.fromBufferAttribute(this,e),Ki.applyMatrix3(t),this.setXY(e,Ki.x,Ki.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)oe.fromBufferAttribute(this,e),oe.applyMatrix3(t),this.setXYZ(e,oe.x,oe.y,oe.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)oe.fromBufferAttribute(this,e),oe.applyMatrix4(t),this.setXYZ(e,oe.x,oe.y,oe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)oe.fromBufferAttribute(this,e),oe.applyNormalMatrix(t),this.setXYZ(e,oe.x,oe.y,oe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)oe.fromBufferAttribute(this,e),oe.transformDirection(t),this.setXYZ(e,oe.x,oe.y,oe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=nn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Yt(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=nn(e,this.array)),e}setX(t,e){return this.normalized&&(e=Yt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=nn(e,this.array)),e}setY(t,e){return this.normalized&&(e=Yt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=nn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Yt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=nn(e,this.array)),e}setW(t,e){return this.normalized&&(e=Yt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array),i=Yt(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t*=this.itemSize,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array),i=Yt(i,this.array),r=Yt(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Er&&(t.usage=this.usage),t}}class Jo extends ze{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class Qo extends ze{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class le extends ze{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Uc=0;const Ie=new re,er=new ce,Jn=new L,Pe=new Oi,Ai=new Oi,fe=new L;class we extends zn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Uc++}),this.uuid=xn(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(qo(t)?Qo:Jo)(t,1):this.index=t,this}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Vt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ie.makeRotationFromQuaternion(t),this.applyMatrix4(Ie),this}rotateX(t){return Ie.makeRotationX(t),this.applyMatrix4(Ie),this}rotateY(t){return Ie.makeRotationY(t),this.applyMatrix4(Ie),this}rotateZ(t){return Ie.makeRotationZ(t),this.applyMatrix4(Ie),this}translate(t,e,n){return Ie.makeTranslation(t,e,n),this.applyMatrix4(Ie),this}scale(t,e,n){return Ie.makeScale(t,e,n),this.applyMatrix4(Ie),this}lookAt(t){return er.lookAt(t),er.updateMatrix(),this.applyMatrix4(er.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Jn).negate(),this.translate(Jn.x,Jn.y,Jn.z),this}setFromPoints(t){const e=[];for(let n=0,i=t.length;n<i;n++){const r=t[n];e.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new le(e,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Oi);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const r=e[n];Pe.setFromBufferAttribute(r),this.morphTargetsRelative?(fe.addVectors(this.boundingBox.min,Pe.min),this.boundingBox.expandByPoint(fe),fe.addVectors(this.boundingBox.max,Pe.max),this.boundingBox.expandByPoint(fe)):(this.boundingBox.expandByPoint(Pe.min),this.boundingBox.expandByPoint(Pe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new bs);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new L,1/0);return}if(t){const n=this.boundingSphere.center;if(Pe.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];Ai.setFromBufferAttribute(o),this.morphTargetsRelative?(fe.addVectors(Pe.min,Ai.min),Pe.expandByPoint(fe),fe.addVectors(Pe.max,Ai.max),Pe.expandByPoint(fe)):(Pe.expandByPoint(Ai.min),Pe.expandByPoint(Ai.max))}Pe.getCenter(n);let i=0;for(let r=0,a=t.count;r<a;r++)fe.fromBufferAttribute(t,r),i=Math.max(i,n.distanceToSquared(fe));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,d=o.count;c<d;c++)fe.fromBufferAttribute(o,c),l&&(Jn.fromBufferAttribute(t,c),fe.add(Jn)),i=Math.max(i,n.distanceToSquared(fe))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.array,i=e.position.array,r=e.normal.array,a=e.uv.array,o=i.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new ze(new Float32Array(4*o),4));const l=this.getAttribute("tangent").array,c=[],d=[];for(let b=0;b<o;b++)c[b]=new L,d[b]=new L;const u=new L,p=new L,m=new L,g=new Et,_=new Et,f=new Et,h=new L,E=new L;function x(b,k,V){u.fromArray(i,b*3),p.fromArray(i,k*3),m.fromArray(i,V*3),g.fromArray(a,b*2),_.fromArray(a,k*2),f.fromArray(a,V*2),p.sub(u),m.sub(u),_.sub(g),f.sub(g);const Q=1/(_.x*f.y-f.x*_.y);isFinite(Q)&&(h.copy(p).multiplyScalar(f.y).addScaledVector(m,-_.y).multiplyScalar(Q),E.copy(m).multiplyScalar(_.x).addScaledVector(p,-f.x).multiplyScalar(Q),c[b].add(h),c[k].add(h),c[V].add(h),d[b].add(E),d[k].add(E),d[V].add(E))}let T=this.groups;T.length===0&&(T=[{start:0,count:n.length}]);for(let b=0,k=T.length;b<k;++b){const V=T[b],Q=V.start,P=V.count;for(let F=Q,H=Q+P;F<H;F+=3)x(n[F+0],n[F+1],n[F+2])}const D=new L,R=new L,w=new L,W=new L;function S(b){w.fromArray(r,b*3),W.copy(w);const k=c[b];D.copy(k),D.sub(w.multiplyScalar(w.dot(k))).normalize(),R.crossVectors(W,k);const Q=R.dot(d[b])<0?-1:1;l[b*4]=D.x,l[b*4+1]=D.y,l[b*4+2]=D.z,l[b*4+3]=Q}for(let b=0,k=T.length;b<k;++b){const V=T[b],Q=V.start,P=V.count;for(let F=Q,H=Q+P;F<H;F+=3)S(n[F+0]),S(n[F+1]),S(n[F+2])}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new ze(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let p=0,m=n.count;p<m;p++)n.setXYZ(p,0,0,0);const i=new L,r=new L,a=new L,o=new L,l=new L,c=new L,d=new L,u=new L;if(t)for(let p=0,m=t.count;p<m;p+=3){const g=t.getX(p+0),_=t.getX(p+1),f=t.getX(p+2);i.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,f),d.subVectors(a,r),u.subVectors(i,r),d.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,f),o.add(d),l.add(d),c.add(d),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(f,c.x,c.y,c.z)}else for(let p=0,m=e.count;p<m;p+=3)i.fromBufferAttribute(e,p+0),r.fromBufferAttribute(e,p+1),a.fromBufferAttribute(e,p+2),d.subVectors(a,r),u.subVectors(i,r),d.cross(u),n.setXYZ(p+0,d.x,d.y,d.z),n.setXYZ(p+1,d.x,d.y,d.z),n.setXYZ(p+2,d.x,d.y,d.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)fe.fromBufferAttribute(t,e),fe.normalize(),t.setXYZ(e,fe.x,fe.y,fe.z)}toNonIndexed(){function t(o,l){const c=o.array,d=o.itemSize,u=o.normalized,p=new c.constructor(l.length*d);let m=0,g=0;for(let _=0,f=l.length;_<f;_++){o.isInterleavedBufferAttribute?m=l[_]*o.data.stride+o.offset:m=l[_]*d;for(let h=0;h<d;h++)p[g++]=c[m++]}return new ze(p,d,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new we,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=t(l,n);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let d=0,u=c.length;d<u;d++){const p=c[d],m=t(p,n);l.push(m)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const i={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],d=[];for(let u=0,p=c.length;u<p;u++){const m=c[u];d.push(m.toJSON(t.data))}d.length>0&&(i[l]=d,r=!0)}r&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const c in i){const d=i[c];this.setAttribute(c,d.clone(e))}const r=t.morphAttributes;for(const c in r){const d=[],u=r[c];for(let p=0,m=u.length;p<m;p++)d.push(u[p].clone(e));this.morphAttributes[c]=d}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,d=a.length;c<d;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Ba=new re,Tn=new Ts,Zi=new bs,za=new L,Qn=new L,ti=new L,ei=new L,nr=new L,Ji=new L,Qi=new Et,ts=new Et,es=new Et,Ha=new L,ka=new L,Va=new L,ns=new L,is=new L;class Jt extends ce{constructor(t=new we,e=new mn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(r&&o){Ji.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const d=o[l],u=r[l];d!==0&&(nr.fromBufferAttribute(u,t),a?Ji.addScaledVector(nr,d):Ji.addScaledVector(nr.sub(e),d))}e.add(Ji)}return e}raycast(t,e){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Zi.copy(n.boundingSphere),Zi.applyMatrix4(r),Tn.copy(t.ray).recast(t.near),!(Zi.containsPoint(Tn.origin)===!1&&(Tn.intersectSphere(Zi,za)===null||Tn.origin.distanceToSquared(za)>(t.far-t.near)**2))&&(Ba.copy(r).invert(),Tn.copy(t.ray).applyMatrix4(Ba),!(n.boundingBox!==null&&Tn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Tn)))}_computeIntersections(t,e,n){let i;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,d=r.attributes.uv1,u=r.attributes.normal,p=r.groups,m=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=p.length;g<_;g++){const f=p[g],h=a[f.materialIndex],E=Math.max(f.start,m.start),x=Math.min(o.count,Math.min(f.start+f.count,m.start+m.count));for(let T=E,D=x;T<D;T+=3){const R=o.getX(T),w=o.getX(T+1),W=o.getX(T+2);i=ss(this,h,t,n,c,d,u,R,w,W),i&&(i.faceIndex=Math.floor(T/3),i.face.materialIndex=f.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(o.count,m.start+m.count);for(let f=g,h=_;f<h;f+=3){const E=o.getX(f),x=o.getX(f+1),T=o.getX(f+2);i=ss(this,a,t,n,c,d,u,E,x,T),i&&(i.faceIndex=Math.floor(f/3),e.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=p.length;g<_;g++){const f=p[g],h=a[f.materialIndex],E=Math.max(f.start,m.start),x=Math.min(l.count,Math.min(f.start+f.count,m.start+m.count));for(let T=E,D=x;T<D;T+=3){const R=T,w=T+1,W=T+2;i=ss(this,h,t,n,c,d,u,R,w,W),i&&(i.faceIndex=Math.floor(T/3),i.face.materialIndex=f.materialIndex,e.push(i))}}else{const g=Math.max(0,m.start),_=Math.min(l.count,m.start+m.count);for(let f=g,h=_;f<h;f+=3){const E=f,x=f+1,T=f+2;i=ss(this,a,t,n,c,d,u,E,x,T),i&&(i.faceIndex=Math.floor(f/3),e.push(i))}}}}function Nc(s,t,e,n,i,r,a,o){let l;if(t.side===Te?l=n.intersectTriangle(a,r,i,!0,o):l=n.intersectTriangle(i,r,a,t.side===Mn,o),l===null)return null;is.copy(o),is.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(is);return c<e.near||c>e.far?null:{distance:c,point:is.clone(),object:s}}function ss(s,t,e,n,i,r,a,o,l,c){s.getVertexPosition(o,Qn),s.getVertexPosition(l,ti),s.getVertexPosition(c,ei);const d=Nc(s,t,e,n,Qn,ti,ei,ns);if(d){i&&(Qi.fromBufferAttribute(i,o),ts.fromBufferAttribute(i,l),es.fromBufferAttribute(i,c),d.uv=Ne.getInterpolation(ns,Qn,ti,ei,Qi,ts,es,new Et)),r&&(Qi.fromBufferAttribute(r,o),ts.fromBufferAttribute(r,l),es.fromBufferAttribute(r,c),d.uv1=Ne.getInterpolation(ns,Qn,ti,ei,Qi,ts,es,new Et),d.uv2=d.uv1),a&&(Ha.fromBufferAttribute(a,o),ka.fromBufferAttribute(a,l),Va.fromBufferAttribute(a,c),d.normal=Ne.getInterpolation(ns,Qn,ti,ei,Ha,ka,Va,new L),d.normal.dot(n.direction)>0&&d.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new L,materialIndex:0};Ne.getNormal(Qn,ti,ei,u.normal),d.face=u}return d}class We extends we{constructor(t=1,e=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],d=[],u=[];let p=0,m=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,r,4),g("x","y","z",-1,-1,t,e,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new le(c,3)),this.setAttribute("normal",new le(d,3)),this.setAttribute("uv",new le(u,2));function g(_,f,h,E,x,T,D,R,w,W,S){const b=T/w,k=D/W,V=T/2,Q=D/2,P=R/2,F=w+1,H=W+1;let q=0,X=0;const $=new L;for(let j=0;j<H;j++){const st=j*k-Q;for(let rt=0;rt<F;rt++){const G=rt*b-V;$[_]=G*E,$[f]=st*x,$[h]=P,c.push($.x,$.y,$.z),$[_]=0,$[f]=0,$[h]=R>0?1:-1,d.push($.x,$.y,$.z),u.push(rt/w),u.push(1-j/W),q+=1}}for(let j=0;j<W;j++)for(let st=0;st<w;st++){const rt=p+st+F*j,G=p+st+F*(j+1),Y=p+(st+1)+F*(j+1),ct=p+(st+1)+F*j;l.push(rt,G,ct),l.push(G,Y,ct),X+=6}o.addGroup(m,X,S),m+=X,p+=q}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new We(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Mi(s){const t={};for(const e in s){t[e]={};for(const n in s[e]){const i=s[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Se(s){const t={};for(let e=0;e<s.length;e++){const n=Mi(s[e]);for(const i in n)t[i]=n[i]}return t}function Fc(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function tl(s){return s.getRenderTarget()===null?s.outputColorSpace:jt.workingColorSpace}const Oc={clone:Mi,merge:Se};var Bc=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,zc=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Bn extends Hn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Bc,this.fragmentShader=zc,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Mi(t.uniforms),this.uniformsGroups=Fc(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class el extends ce{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new re,this.projectionMatrix=new re,this.projectionMatrixInverse=new re,this.coordinateSystem=rn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class Fe extends el{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Tr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(fs*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Tr*2*Math.atan(Math.tan(fs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(t,e,n,i,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(fs*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*i/l,e-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const ni=-90,ii=1;class Hc extends ce{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Fe(ni,ii,t,e);i.layers=this.layers,this.add(i);const r=new Fe(ni,ii,t,e);r.layers=this.layers,this.add(r);const a=new Fe(ni,ii,t,e);a.layers=this.layers,this.add(a);const o=new Fe(ni,ii,t,e);o.layers=this.layers,this.add(o);const l=new Fe(ni,ii,t,e);l.layers=this.layers,this.add(l);const c=new Fe(ni,ii,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===rn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===xs)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,d]=this.children,u=t.getRenderTarget(),p=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,r),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,l),t.setRenderTarget(n,4,i),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,d),t.setRenderTarget(u,p,m),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class nl extends Ae{constructor(t,e,n,i,r,a,o,l,c,d){t=t!==void 0?t:[],e=e!==void 0?e:_i,super(t,e,n,i,r,a,o,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class kc extends Fn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];e.encoding!==void 0&&(Li("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),e.colorSpace=e.encoding===Nn?pe:Be),this.texture=new nl(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Ue}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new We(5,5,5),r=new Bn({name:"CubemapFromEquirect",uniforms:Mi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Te,blending:gn});r.uniforms.tEquirect.value=e;const a=new Jt(i,r),o=e.minFilter;return e.minFilter===Ui&&(e.minFilter=Ue),new Hc(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,n,i){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(r)}}const ir=new L,Vc=new L,Gc=new Vt;class un{constructor(t=new L(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=ir.subVectors(n,e).cross(Vc.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(ir),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Gc.getNormalMatrix(t),i=this.coplanarPoint(ir).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const An=new bs,rs=new L;class Ir{constructor(t=new un,e=new un,n=new un,i=new un,r=new un,a=new un){this.planes=[t,e,n,i,r,a]}set(t,e,n,i,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=rn){const n=this.planes,i=t.elements,r=i[0],a=i[1],o=i[2],l=i[3],c=i[4],d=i[5],u=i[6],p=i[7],m=i[8],g=i[9],_=i[10],f=i[11],h=i[12],E=i[13],x=i[14],T=i[15];if(n[0].setComponents(l-r,p-c,f-m,T-h).normalize(),n[1].setComponents(l+r,p+c,f+m,T+h).normalize(),n[2].setComponents(l+a,p+d,f+g,T+E).normalize(),n[3].setComponents(l-a,p-d,f-g,T-E).normalize(),n[4].setComponents(l-o,p-u,f-_,T-x).normalize(),e===rn)n[5].setComponents(l+o,p+u,f+_,T+x).normalize();else if(e===xs)n[5].setComponents(o,u,_,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),An.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),An.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(An)}intersectsSprite(t){return An.center.set(0,0,0),An.radius=.7071067811865476,An.applyMatrix4(t.matrixWorld),this.intersectsSphere(An)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(rs.x=i.normal.x>0?t.max.x:t.min.x,rs.y=i.normal.y>0?t.max.y:t.min.y,rs.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(rs)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function il(){let s=null,t=!1,e=null,n=null;function i(r,a){e(r,a),n=s.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=s.requestAnimationFrame(i),t=!0)},stop:function(){s.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function Wc(s,t){const e=t.isWebGL2,n=new WeakMap;function i(c,d){const u=c.array,p=c.usage,m=u.byteLength,g=s.createBuffer();s.bindBuffer(d,g),s.bufferData(d,u,p),c.onUploadCallback();let _;if(u instanceof Float32Array)_=s.FLOAT;else if(u instanceof Uint16Array)if(c.isFloat16BufferAttribute)if(e)_=s.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else _=s.UNSIGNED_SHORT;else if(u instanceof Int16Array)_=s.SHORT;else if(u instanceof Uint32Array)_=s.UNSIGNED_INT;else if(u instanceof Int32Array)_=s.INT;else if(u instanceof Int8Array)_=s.BYTE;else if(u instanceof Uint8Array)_=s.UNSIGNED_BYTE;else if(u instanceof Uint8ClampedArray)_=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+u);return{buffer:g,type:_,bytesPerElement:u.BYTES_PER_ELEMENT,version:c.version,size:m}}function r(c,d,u){const p=d.array,m=d._updateRange,g=d.updateRanges;if(s.bindBuffer(u,c),m.count===-1&&g.length===0&&s.bufferSubData(u,0,p),g.length!==0){for(let _=0,f=g.length;_<f;_++){const h=g[_];e?s.bufferSubData(u,h.start*p.BYTES_PER_ELEMENT,p,h.start,h.count):s.bufferSubData(u,h.start*p.BYTES_PER_ELEMENT,p.subarray(h.start,h.start+h.count))}d.clearUpdateRanges()}m.count!==-1&&(e?s.bufferSubData(u,m.offset*p.BYTES_PER_ELEMENT,p,m.offset,m.count):s.bufferSubData(u,m.offset*p.BYTES_PER_ELEMENT,p.subarray(m.offset,m.offset+m.count)),m.count=-1),d.onUploadCallback()}function a(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function o(c){c.isInterleavedBufferAttribute&&(c=c.data);const d=n.get(c);d&&(s.deleteBuffer(d.buffer),n.delete(c))}function l(c,d){if(c.isGLBufferAttribute){const p=n.get(c);(!p||p.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);const u=n.get(c);if(u===void 0)n.set(c,i(c,d));else if(u.version<c.version){if(u.size!==c.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");r(u.buffer,c,d),u.version=c.version}}return{get:a,remove:o,update:l}}class mi extends we{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(i),c=o+1,d=l+1,u=t/o,p=e/l,m=[],g=[],_=[],f=[];for(let h=0;h<d;h++){const E=h*p-a;for(let x=0;x<c;x++){const T=x*u-r;g.push(T,-E,0),_.push(0,0,1),f.push(x/o),f.push(1-h/l)}}for(let h=0;h<l;h++)for(let E=0;E<o;E++){const x=E+c*h,T=E+c*(h+1),D=E+1+c*(h+1),R=E+1+c*h;m.push(x,T,R),m.push(T,D,R)}this.setIndex(m),this.setAttribute("position",new le(g,3)),this.setAttribute("normal",new le(_,3)),this.setAttribute("uv",new le(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new mi(t.width,t.height,t.widthSegments,t.heightSegments)}}var Xc=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,$c=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,qc=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,jc=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Yc=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,Kc=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Zc=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Jc=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Qc=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,td=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,ed=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,nd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,id=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,sd=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,rd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,ad=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,od=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,ld=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,cd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,dd=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,hd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,ud=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,fd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,pd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,md=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,gd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,_d=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,vd=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,xd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Md=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Sd="gl_FragColor = linearToOutputTexel( gl_FragColor );",yd=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,Ed=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,bd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Td=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ad=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,wd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Rd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Cd=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Pd=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Ld=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Dd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Id=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,Ud=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Nd=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Fd=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Od=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Bd=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,zd=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Hd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,kd=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Vd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Gd=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Wd=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Xd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,$d=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,qd=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,jd=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Yd=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Kd=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Zd=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Jd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Qd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,th=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,eh=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,nh=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,ih=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,sh=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,rh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,ah=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,oh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,lh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,ch=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,dh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,hh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,uh=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,fh=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,ph=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,mh=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,gh=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,_h=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,vh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,xh=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Mh=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Sh=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,yh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Eh=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,bh=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Th=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Ah=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,wh=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Rh=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Ch=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Ph=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Lh=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Dh=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Ih=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Uh=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Nh=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Fh=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Oh=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Bh=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,zh=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Hh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,kh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Vh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Gh=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Wh=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Xh=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,$h=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,qh=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,jh=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Yh=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Kh=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Zh=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,Jh=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Qh=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,tu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,eu=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,nu=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,iu=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,su=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,ru=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,au=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ou=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lu=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,cu=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,du=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,hu=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,uu=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,fu=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pu=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,mu=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gu=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_u=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vu=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,xu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Mu=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Su=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,yu=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Eu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ot={alphahash_fragment:Xc,alphahash_pars_fragment:$c,alphamap_fragment:qc,alphamap_pars_fragment:jc,alphatest_fragment:Yc,alphatest_pars_fragment:Kc,aomap_fragment:Zc,aomap_pars_fragment:Jc,batching_pars_vertex:Qc,batching_vertex:td,begin_vertex:ed,beginnormal_vertex:nd,bsdfs:id,iridescence_fragment:sd,bumpmap_pars_fragment:rd,clipping_planes_fragment:ad,clipping_planes_pars_fragment:od,clipping_planes_pars_vertex:ld,clipping_planes_vertex:cd,color_fragment:dd,color_pars_fragment:hd,color_pars_vertex:ud,color_vertex:fd,common:pd,cube_uv_reflection_fragment:md,defaultnormal_vertex:gd,displacementmap_pars_vertex:_d,displacementmap_vertex:vd,emissivemap_fragment:xd,emissivemap_pars_fragment:Md,colorspace_fragment:Sd,colorspace_pars_fragment:yd,envmap_fragment:Ed,envmap_common_pars_fragment:bd,envmap_pars_fragment:Td,envmap_pars_vertex:Ad,envmap_physical_pars_fragment:Bd,envmap_vertex:wd,fog_vertex:Rd,fog_pars_vertex:Cd,fog_fragment:Pd,fog_pars_fragment:Ld,gradientmap_pars_fragment:Dd,lightmap_fragment:Id,lightmap_pars_fragment:Ud,lights_lambert_fragment:Nd,lights_lambert_pars_fragment:Fd,lights_pars_begin:Od,lights_toon_fragment:zd,lights_toon_pars_fragment:Hd,lights_phong_fragment:kd,lights_phong_pars_fragment:Vd,lights_physical_fragment:Gd,lights_physical_pars_fragment:Wd,lights_fragment_begin:Xd,lights_fragment_maps:$d,lights_fragment_end:qd,logdepthbuf_fragment:jd,logdepthbuf_pars_fragment:Yd,logdepthbuf_pars_vertex:Kd,logdepthbuf_vertex:Zd,map_fragment:Jd,map_pars_fragment:Qd,map_particle_fragment:th,map_particle_pars_fragment:eh,metalnessmap_fragment:nh,metalnessmap_pars_fragment:ih,morphcolor_vertex:sh,morphnormal_vertex:rh,morphtarget_pars_vertex:ah,morphtarget_vertex:oh,normal_fragment_begin:lh,normal_fragment_maps:ch,normal_pars_fragment:dh,normal_pars_vertex:hh,normal_vertex:uh,normalmap_pars_fragment:fh,clearcoat_normal_fragment_begin:ph,clearcoat_normal_fragment_maps:mh,clearcoat_pars_fragment:gh,iridescence_pars_fragment:_h,opaque_fragment:vh,packing:xh,premultiplied_alpha_fragment:Mh,project_vertex:Sh,dithering_fragment:yh,dithering_pars_fragment:Eh,roughnessmap_fragment:bh,roughnessmap_pars_fragment:Th,shadowmap_pars_fragment:Ah,shadowmap_pars_vertex:wh,shadowmap_vertex:Rh,shadowmask_pars_fragment:Ch,skinbase_vertex:Ph,skinning_pars_vertex:Lh,skinning_vertex:Dh,skinnormal_vertex:Ih,specularmap_fragment:Uh,specularmap_pars_fragment:Nh,tonemapping_fragment:Fh,tonemapping_pars_fragment:Oh,transmission_fragment:Bh,transmission_pars_fragment:zh,uv_pars_fragment:Hh,uv_pars_vertex:kh,uv_vertex:Vh,worldpos_vertex:Gh,background_vert:Wh,background_frag:Xh,backgroundCube_vert:$h,backgroundCube_frag:qh,cube_vert:jh,cube_frag:Yh,depth_vert:Kh,depth_frag:Zh,distanceRGBA_vert:Jh,distanceRGBA_frag:Qh,equirect_vert:tu,equirect_frag:eu,linedashed_vert:nu,linedashed_frag:iu,meshbasic_vert:su,meshbasic_frag:ru,meshlambert_vert:au,meshlambert_frag:ou,meshmatcap_vert:lu,meshmatcap_frag:cu,meshnormal_vert:du,meshnormal_frag:hu,meshphong_vert:uu,meshphong_frag:fu,meshphysical_vert:pu,meshphysical_frag:mu,meshtoon_vert:gu,meshtoon_frag:_u,points_vert:vu,points_frag:xu,shadow_vert:Mu,shadow_frag:Su,sprite_vert:yu,sprite_frag:Eu},at={common:{diffuse:{value:new Bt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Vt}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Vt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Vt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Vt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Vt},normalScale:{value:new Et(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Vt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Vt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Vt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Vt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Bt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Bt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0},uvTransform:{value:new Vt}},sprite:{diffuse:{value:new Bt(16777215)},opacity:{value:1},center:{value:new Et(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}}},je={basic:{uniforms:Se([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.fog]),vertexShader:Ot.meshbasic_vert,fragmentShader:Ot.meshbasic_frag},lambert:{uniforms:Se([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.fog,at.lights,{emissive:{value:new Bt(0)}}]),vertexShader:Ot.meshlambert_vert,fragmentShader:Ot.meshlambert_frag},phong:{uniforms:Se([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.fog,at.lights,{emissive:{value:new Bt(0)},specular:{value:new Bt(1118481)},shininess:{value:30}}]),vertexShader:Ot.meshphong_vert,fragmentShader:Ot.meshphong_frag},standard:{uniforms:Se([at.common,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.roughnessmap,at.metalnessmap,at.fog,at.lights,{emissive:{value:new Bt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag},toon:{uniforms:Se([at.common,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.gradientmap,at.fog,at.lights,{emissive:{value:new Bt(0)}}]),vertexShader:Ot.meshtoon_vert,fragmentShader:Ot.meshtoon_frag},matcap:{uniforms:Se([at.common,at.bumpmap,at.normalmap,at.displacementmap,at.fog,{matcap:{value:null}}]),vertexShader:Ot.meshmatcap_vert,fragmentShader:Ot.meshmatcap_frag},points:{uniforms:Se([at.points,at.fog]),vertexShader:Ot.points_vert,fragmentShader:Ot.points_frag},dashed:{uniforms:Se([at.common,at.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ot.linedashed_vert,fragmentShader:Ot.linedashed_frag},depth:{uniforms:Se([at.common,at.displacementmap]),vertexShader:Ot.depth_vert,fragmentShader:Ot.depth_frag},normal:{uniforms:Se([at.common,at.bumpmap,at.normalmap,at.displacementmap,{opacity:{value:1}}]),vertexShader:Ot.meshnormal_vert,fragmentShader:Ot.meshnormal_frag},sprite:{uniforms:Se([at.sprite,at.fog]),vertexShader:Ot.sprite_vert,fragmentShader:Ot.sprite_frag},background:{uniforms:{uvTransform:{value:new Vt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ot.background_vert,fragmentShader:Ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Ot.backgroundCube_vert,fragmentShader:Ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ot.cube_vert,fragmentShader:Ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ot.equirect_vert,fragmentShader:Ot.equirect_frag},distanceRGBA:{uniforms:Se([at.common,at.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ot.distanceRGBA_vert,fragmentShader:Ot.distanceRGBA_frag},shadow:{uniforms:Se([at.lights,at.fog,{color:{value:new Bt(0)},opacity:{value:1}}]),vertexShader:Ot.shadow_vert,fragmentShader:Ot.shadow_frag}};je.physical={uniforms:Se([je.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Vt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Vt},clearcoatNormalScale:{value:new Et(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Vt},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Vt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Vt},sheen:{value:0},sheenColor:{value:new Bt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Vt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Vt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Vt},transmissionSamplerSize:{value:new Et},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Vt},attenuationDistance:{value:0},attenuationColor:{value:new Bt(0)},specularColor:{value:new Bt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Vt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Vt},anisotropyVector:{value:new Et},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Vt}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag};const as={r:0,b:0,g:0};function bu(s,t,e,n,i,r,a){const o=new Bt(0);let l=r===!0?0:1,c,d,u=null,p=0,m=null;function g(f,h){let E=!1,x=h.isScene===!0?h.background:null;x&&x.isTexture&&(x=(h.backgroundBlurriness>0?e:t).get(x)),x===null?_(o,l):x&&x.isColor&&(_(x,1),E=!0);const T=s.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,a):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(s.autoClear||E)&&s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil),x&&(x.isCubeTexture||x.mapping===ys)?(d===void 0&&(d=new Jt(new We(1,1,1),new Bn({name:"BackgroundCubeMaterial",uniforms:Mi(je.backgroundCube.uniforms),vertexShader:je.backgroundCube.vertexShader,fragmentShader:je.backgroundCube.fragmentShader,side:Te,depthTest:!1,depthWrite:!1,fog:!1})),d.geometry.deleteAttribute("normal"),d.geometry.deleteAttribute("uv"),d.onBeforeRender=function(D,R,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(d.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(d)),d.material.uniforms.envMap.value=x,d.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,d.material.uniforms.backgroundBlurriness.value=h.backgroundBlurriness,d.material.uniforms.backgroundIntensity.value=h.backgroundIntensity,d.material.toneMapped=jt.getTransfer(x.colorSpace)!==Zt,(u!==x||p!==x.version||m!==s.toneMapping)&&(d.material.needsUpdate=!0,u=x,p=x.version,m=s.toneMapping),d.layers.enableAll(),f.unshift(d,d.geometry,d.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new Jt(new mi(2,2),new Bn({name:"BackgroundMaterial",uniforms:Mi(je.background.uniforms),vertexShader:je.background.vertexShader,fragmentShader:je.background.fragmentShader,side:Mn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=h.backgroundIntensity,c.material.toneMapped=jt.getTransfer(x.colorSpace)!==Zt,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(u!==x||p!==x.version||m!==s.toneMapping)&&(c.material.needsUpdate=!0,u=x,p=x.version,m=s.toneMapping),c.layers.enableAll(),f.unshift(c,c.geometry,c.material,0,0,null))}function _(f,h){f.getRGB(as,tl(s)),n.buffers.color.setClear(as.r,as.g,as.b,h,a)}return{getClearColor:function(){return o},setClearColor:function(f,h=1){o.set(f),l=h,_(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(f){l=f,_(o,l)},render:g}}function Tu(s,t,e,n){const i=s.getParameter(s.MAX_VERTEX_ATTRIBS),r=n.isWebGL2?null:t.get("OES_vertex_array_object"),a=n.isWebGL2||r!==null,o={},l=f(null);let c=l,d=!1;function u(P,F,H,q,X){let $=!1;if(a){const j=_(q,H,F);c!==j&&(c=j,m(c.object)),$=h(P,q,H,X),$&&E(P,q,H,X)}else{const j=F.wireframe===!0;(c.geometry!==q.id||c.program!==H.id||c.wireframe!==j)&&(c.geometry=q.id,c.program=H.id,c.wireframe=j,$=!0)}X!==null&&e.update(X,s.ELEMENT_ARRAY_BUFFER),($||d)&&(d=!1,W(P,F,H,q),X!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(X).buffer))}function p(){return n.isWebGL2?s.createVertexArray():r.createVertexArrayOES()}function m(P){return n.isWebGL2?s.bindVertexArray(P):r.bindVertexArrayOES(P)}function g(P){return n.isWebGL2?s.deleteVertexArray(P):r.deleteVertexArrayOES(P)}function _(P,F,H){const q=H.wireframe===!0;let X=o[P.id];X===void 0&&(X={},o[P.id]=X);let $=X[F.id];$===void 0&&($={},X[F.id]=$);let j=$[q];return j===void 0&&(j=f(p()),$[q]=j),j}function f(P){const F=[],H=[],q=[];for(let X=0;X<i;X++)F[X]=0,H[X]=0,q[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:H,attributeDivisors:q,object:P,attributes:{},index:null}}function h(P,F,H,q){const X=c.attributes,$=F.attributes;let j=0;const st=H.getAttributes();for(const rt in st)if(st[rt].location>=0){const Y=X[rt];let ct=$[rt];if(ct===void 0&&(rt==="instanceMatrix"&&P.instanceMatrix&&(ct=P.instanceMatrix),rt==="instanceColor"&&P.instanceColor&&(ct=P.instanceColor)),Y===void 0||Y.attribute!==ct||ct&&Y.data!==ct.data)return!0;j++}return c.attributesNum!==j||c.index!==q}function E(P,F,H,q){const X={},$=F.attributes;let j=0;const st=H.getAttributes();for(const rt in st)if(st[rt].location>=0){let Y=$[rt];Y===void 0&&(rt==="instanceMatrix"&&P.instanceMatrix&&(Y=P.instanceMatrix),rt==="instanceColor"&&P.instanceColor&&(Y=P.instanceColor));const ct={};ct.attribute=Y,Y&&Y.data&&(ct.data=Y.data),X[rt]=ct,j++}c.attributes=X,c.attributesNum=j,c.index=q}function x(){const P=c.newAttributes;for(let F=0,H=P.length;F<H;F++)P[F]=0}function T(P){D(P,0)}function D(P,F){const H=c.newAttributes,q=c.enabledAttributes,X=c.attributeDivisors;H[P]=1,q[P]===0&&(s.enableVertexAttribArray(P),q[P]=1),X[P]!==F&&((n.isWebGL2?s:t.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](P,F),X[P]=F)}function R(){const P=c.newAttributes,F=c.enabledAttributes;for(let H=0,q=F.length;H<q;H++)F[H]!==P[H]&&(s.disableVertexAttribArray(H),F[H]=0)}function w(P,F,H,q,X,$,j){j===!0?s.vertexAttribIPointer(P,F,H,X,$):s.vertexAttribPointer(P,F,H,q,X,$)}function W(P,F,H,q){if(n.isWebGL2===!1&&(P.isInstancedMesh||q.isInstancedBufferGeometry)&&t.get("ANGLE_instanced_arrays")===null)return;x();const X=q.attributes,$=H.getAttributes(),j=F.defaultAttributeValues;for(const st in $){const rt=$[st];if(rt.location>=0){let G=X[st];if(G===void 0&&(st==="instanceMatrix"&&P.instanceMatrix&&(G=P.instanceMatrix),st==="instanceColor"&&P.instanceColor&&(G=P.instanceColor)),G!==void 0){const Y=G.normalized,ct=G.itemSize,vt=e.get(G);if(vt===void 0)continue;const gt=vt.buffer,Lt=vt.type,Dt=vt.bytesPerElement,Tt=n.isWebGL2===!0&&(Lt===s.INT||Lt===s.UNSIGNED_INT||G.gpuType===Oo);if(G.isInterleavedBufferAttribute){const Gt=G.data,N=Gt.stride,ge=G.offset;if(Gt.isInstancedInterleavedBuffer){for(let St=0;St<rt.locationSize;St++)D(rt.location+St,Gt.meshPerAttribute);P.isInstancedMesh!==!0&&q._maxInstanceCount===void 0&&(q._maxInstanceCount=Gt.meshPerAttribute*Gt.count)}else for(let St=0;St<rt.locationSize;St++)T(rt.location+St);s.bindBuffer(s.ARRAY_BUFFER,gt);for(let St=0;St<rt.locationSize;St++)w(rt.location+St,ct/rt.locationSize,Lt,Y,N*Dt,(ge+ct/rt.locationSize*St)*Dt,Tt)}else{if(G.isInstancedBufferAttribute){for(let Gt=0;Gt<rt.locationSize;Gt++)D(rt.location+Gt,G.meshPerAttribute);P.isInstancedMesh!==!0&&q._maxInstanceCount===void 0&&(q._maxInstanceCount=G.meshPerAttribute*G.count)}else for(let Gt=0;Gt<rt.locationSize;Gt++)T(rt.location+Gt);s.bindBuffer(s.ARRAY_BUFFER,gt);for(let Gt=0;Gt<rt.locationSize;Gt++)w(rt.location+Gt,ct/rt.locationSize,Lt,Y,ct*Dt,ct/rt.locationSize*Gt*Dt,Tt)}}else if(j!==void 0){const Y=j[st];if(Y!==void 0)switch(Y.length){case 2:s.vertexAttrib2fv(rt.location,Y);break;case 3:s.vertexAttrib3fv(rt.location,Y);break;case 4:s.vertexAttrib4fv(rt.location,Y);break;default:s.vertexAttrib1fv(rt.location,Y)}}}}R()}function S(){V();for(const P in o){const F=o[P];for(const H in F){const q=F[H];for(const X in q)g(q[X].object),delete q[X];delete F[H]}delete o[P]}}function b(P){if(o[P.id]===void 0)return;const F=o[P.id];for(const H in F){const q=F[H];for(const X in q)g(q[X].object),delete q[X];delete F[H]}delete o[P.id]}function k(P){for(const F in o){const H=o[F];if(H[P.id]===void 0)continue;const q=H[P.id];for(const X in q)g(q[X].object),delete q[X];delete H[P.id]}}function V(){Q(),d=!0,c!==l&&(c=l,m(c.object))}function Q(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:V,resetDefaultState:Q,dispose:S,releaseStatesOfGeometry:b,releaseStatesOfProgram:k,initAttributes:x,enableAttribute:T,disableUnusedAttributes:R}}function Au(s,t,e,n){const i=n.isWebGL2;let r;function a(d){r=d}function o(d,u){s.drawArrays(r,d,u),e.update(u,r,1)}function l(d,u,p){if(p===0)return;let m,g;if(i)m=s,g="drawArraysInstanced";else if(m=t.get("ANGLE_instanced_arrays"),g="drawArraysInstancedANGLE",m===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[g](r,d,u,p),e.update(u,r,p)}function c(d,u,p){if(p===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let g=0;g<p;g++)this.render(d[g],u[g]);else{m.multiDrawArraysWEBGL(r,d,0,u,0,p);let g=0;for(let _=0;_<p;_++)g+=u[_];e.update(g,r,1)}}this.setMode=a,this.render=o,this.renderInstances=l,this.renderMultiDraw=c}function wu(s,t,e){let n;function i(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const w=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function r(w){if(w==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const a=typeof WebGL2RenderingContext<"u"&&s.constructor.name==="WebGL2RenderingContext";let o=e.precision!==void 0?e.precision:"highp";const l=r(o);l!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",l,"instead."),o=l);const c=a||t.has("WEBGL_draw_buffers"),d=e.logarithmicDepthBuffer===!0,u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),_=s.getParameter(s.MAX_VERTEX_ATTRIBS),f=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),h=s.getParameter(s.MAX_VARYING_VECTORS),E=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),x=p>0,T=a||t.has("OES_texture_float"),D=x&&T,R=a?s.getParameter(s.MAX_SAMPLES):0;return{isWebGL2:a,drawBuffers:c,getMaxAnisotropy:i,getMaxPrecision:r,precision:o,logarithmicDepthBuffer:d,maxTextures:u,maxVertexTextures:p,maxTextureSize:m,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:f,maxVaryings:h,maxFragmentUniforms:E,vertexTextures:x,floatFragmentTextures:T,floatVertexTextures:D,maxSamples:R}}function Ru(s){const t=this;let e=null,n=0,i=!1,r=!1;const a=new un,o=new Vt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,p){const m=u.length!==0||p||n!==0||i;return i=p,n=u.length,m},this.beginShadows=function(){r=!0,d(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,p){e=d(u,p,0)},this.setState=function(u,p,m){const g=u.clippingPlanes,_=u.clipIntersection,f=u.clipShadows,h=s.get(u);if(!i||g===null||g.length===0||r&&!f)r?d(null):c();else{const E=r?0:n,x=E*4;let T=h.clippingState||null;l.value=T,T=d(g,p,x,m);for(let D=0;D!==x;++D)T[D]=e[D];h.clippingState=T,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function d(u,p,m,g){const _=u!==null?u.length:0;let f=null;if(_!==0){if(f=l.value,g!==!0||f===null){const h=m+_*4,E=p.matrixWorldInverse;o.getNormalMatrix(E),(f===null||f.length<h)&&(f=new Float32Array(h));for(let x=0,T=m;x!==_;++x,T+=4)a.copy(u[x]).applyMatrix4(E,o),a.normal.toArray(f,T),f[T+3]=a.constant}l.value=f,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,f}}function Cu(s){let t=new WeakMap;function e(a,o){return o===xr?a.mapping=_i:o===Mr&&(a.mapping=vi),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===xr||o===Mr)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new kc(l.height/2);return c.fromEquirectangularTexture(s,a),t.set(a,c),a.addEventListener("dispose",i),e(c.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class sl extends el{constructor(t=-1,e=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-t,a=n+t,o=i+e,l=i-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=d*this.view.offsetY,l=o-d*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const hi=4,Ga=[.125,.215,.35,.446,.526,.582],Ln=20,sr=new sl,Wa=new Bt;let rr=null,ar=0,or=0;const Cn=(1+Math.sqrt(5))/2,si=1/Cn,Xa=[new L(1,1,1),new L(-1,1,1),new L(1,1,-1),new L(-1,1,-1),new L(0,Cn,si),new L(0,Cn,-si),new L(si,0,Cn),new L(-si,0,Cn),new L(Cn,si,0),new L(-Cn,si,0)];class $a{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){rr=this._renderer.getRenderTarget(),ar=this._renderer.getActiveCubeFace(),or=this._renderer.getActiveMipmapLevel(),this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,i,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ya(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ja(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(rr,ar,or),t.scissorTest=!1,os(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===_i||t.mapping===vi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),rr=this._renderer.getRenderTarget(),ar=this._renderer.getActiveCubeFace(),or=this._renderer.getActiveMipmapLevel();const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Ue,minFilter:Ue,generateMipmaps:!1,type:Ni,format:$e,colorSpace:an,depthBuffer:!1},i=qa(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=qa(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Pu(r)),this._blurMaterial=Lu(r,t,e)}return i}_compileMaterial(t){const e=new Jt(this._lodPlanes[0],t);this._renderer.compile(e,sr)}_sceneToCubeUV(t,e,n,i){const o=new Fe(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,p=d.toneMapping;d.getClearColor(Wa),d.toneMapping=_n,d.autoClear=!1;const m=new mn({name:"PMREM.Background",side:Te,depthWrite:!1,depthTest:!1}),g=new Jt(new We,m);let _=!1;const f=t.background;f?f.isColor&&(m.color.copy(f),t.background=null,_=!0):(m.color.copy(Wa),_=!0);for(let h=0;h<6;h++){const E=h%3;E===0?(o.up.set(0,l[h],0),o.lookAt(c[h],0,0)):E===1?(o.up.set(0,0,l[h]),o.lookAt(0,c[h],0)):(o.up.set(0,l[h],0),o.lookAt(0,0,c[h]));const x=this._cubeSize;os(i,E*x,h>2?x:0,x,x),d.setRenderTarget(i),_&&d.render(g,o),d.render(t,o)}g.geometry.dispose(),g.material.dispose(),d.toneMapping=p,d.autoClear=u,t.background=f}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===_i||t.mapping===vi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ya()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ja());const r=i?this._cubemapMaterial:this._equirectMaterial,a=new Jt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;os(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,sr)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;for(let i=1;i<this._lodPlanes.length;i++){const r=Math.sqrt(this._sigmas[i]*this._sigmas[i]-this._sigmas[i-1]*this._sigmas[i-1]),a=Xa[(i-1)%Xa.length];this._blur(t,i-1,i,r,a)}e.autoClear=n}_blur(t,e,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",r),this._halfBlur(a,t,n,n,i,"longitudinal",r)}_halfBlur(t,e,n,i,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const d=3,u=new Jt(this._lodPlanes[i],c),p=c.uniforms,m=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*Ln-1),_=r/g,f=isFinite(r)?1+Math.floor(d*_):Ln;f>Ln&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${f} samples when the maximum is set to ${Ln}`);const h=[];let E=0;for(let w=0;w<Ln;++w){const W=w/_,S=Math.exp(-W*W/2);h.push(S),w===0?E+=S:w<f&&(E+=2*S)}for(let w=0;w<h.length;w++)h[w]=h[w]/E;p.envMap.value=t.texture,p.samples.value=f,p.weights.value=h,p.latitudinal.value=a==="latitudinal",o&&(p.poleAxis.value=o);const{_lodMax:x}=this;p.dTheta.value=g,p.mipInt.value=x-n;const T=this._sizeLods[i],D=3*T*(i>x-hi?i-x+hi:0),R=4*(this._cubeSize-T);os(e,D,R,3*T,2*T),l.setRenderTarget(e),l.render(u,sr)}}function Pu(s){const t=[],e=[],n=[];let i=s;const r=s-hi+1+Ga.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>s-hi?l=Ga[a-s+hi-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),d=-c,u=1+c,p=[d,d,u,d,u,u,d,d,u,u,d,u],m=6,g=6,_=3,f=2,h=1,E=new Float32Array(_*g*m),x=new Float32Array(f*g*m),T=new Float32Array(h*g*m);for(let R=0;R<m;R++){const w=R%3*2/3-1,W=R>2?0:-1,S=[w,W,0,w+2/3,W,0,w+2/3,W+1,0,w,W,0,w+2/3,W+1,0,w,W+1,0];E.set(S,_*g*R),x.set(p,f*g*R);const b=[R,R,R,R,R,R];T.set(b,h*g*R)}const D=new we;D.setAttribute("position",new ze(E,_)),D.setAttribute("uv",new ze(x,f)),D.setAttribute("faceIndex",new ze(T,h)),t.push(D),i>hi&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function qa(s,t,e){const n=new Fn(s,t,e);return n.texture.mapping=ys,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function os(s,t,e,n,i){s.viewport.set(t,e,n,i),s.scissor.set(t,e,n,i)}function Lu(s,t,e){const n=new Float32Array(Ln),i=new L(0,1,0);return new Bn({name:"SphericalGaussianBlur",defines:{n:Ln,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Ur(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function ja(){return new Bn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ur(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function Ya(){return new Bn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ur(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function Ur(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Du(s){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===xr||l===Mr,d=l===_i||l===vi;if(c||d)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let u=t.get(o);return e===null&&(e=new $a(s)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),t.set(o,u),u.texture}else{if(t.has(o))return t.get(o).texture;{const u=o.image;if(c&&u&&u.height>0||d&&u&&i(u)){e===null&&(e=new $a(s));const p=c?e.fromEquirectangular(o):e.fromCubemap(o);return t.set(o,p),o.addEventListener("dispose",r),p.texture}else return null}}}return o}function i(o){let l=0;const c=6;for(let d=0;d<c;d++)o[d]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function Iu(s){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(n){n.isWebGL2?(e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance")):(e("WEBGL_depth_texture"),e("OES_texture_float"),e("OES_texture_half_float"),e("OES_texture_half_float_linear"),e("OES_standard_derivatives"),e("OES_element_index_uint"),e("OES_vertex_array_object"),e("ANGLE_instanced_arrays")),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture")},get:function(n){const i=e(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function Uu(s,t,e,n){const i={},r=new WeakMap;function a(u){const p=u.target;p.index!==null&&t.remove(p.index);for(const g in p.attributes)t.remove(p.attributes[g]);for(const g in p.morphAttributes){const _=p.morphAttributes[g];for(let f=0,h=_.length;f<h;f++)t.remove(_[f])}p.removeEventListener("dispose",a),delete i[p.id];const m=r.get(p);m&&(t.remove(m),r.delete(p)),n.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,e.memory.geometries--}function o(u,p){return i[p.id]===!0||(p.addEventListener("dispose",a),i[p.id]=!0,e.memory.geometries++),p}function l(u){const p=u.attributes;for(const g in p)t.update(p[g],s.ARRAY_BUFFER);const m=u.morphAttributes;for(const g in m){const _=m[g];for(let f=0,h=_.length;f<h;f++)t.update(_[f],s.ARRAY_BUFFER)}}function c(u){const p=[],m=u.index,g=u.attributes.position;let _=0;if(m!==null){const E=m.array;_=m.version;for(let x=0,T=E.length;x<T;x+=3){const D=E[x+0],R=E[x+1],w=E[x+2];p.push(D,R,R,w,w,D)}}else if(g!==void 0){const E=g.array;_=g.version;for(let x=0,T=E.length/3-1;x<T;x+=3){const D=x+0,R=x+1,w=x+2;p.push(D,R,R,w,w,D)}}else return;const f=new(qo(p)?Qo:Jo)(p,1);f.version=_;const h=r.get(u);h&&t.remove(h),r.set(u,f)}function d(u){const p=r.get(u);if(p){const m=u.index;m!==null&&p.version<m.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:d}}function Nu(s,t,e,n){const i=n.isWebGL2;let r;function a(m){r=m}let o,l;function c(m){o=m.type,l=m.bytesPerElement}function d(m,g){s.drawElements(r,g,o,m*l),e.update(g,r,1)}function u(m,g,_){if(_===0)return;let f,h;if(i)f=s,h="drawElementsInstanced";else if(f=t.get("ANGLE_instanced_arrays"),h="drawElementsInstancedANGLE",f===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}f[h](r,g,o,m*l,_),e.update(g,r,_)}function p(m,g,_){if(_===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let h=0;h<_;h++)this.render(m[h]/l,g[h]);else{f.multiDrawElementsWEBGL(r,g,0,o,m,0,_);let h=0;for(let E=0;E<_;E++)h+=g[E];e.update(h,r,1)}}this.setMode=a,this.setIndex=c,this.render=d,this.renderInstances=u,this.renderMultiDraw=p}function Fu(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function Ou(s,t){return s[0]-t[0]}function Bu(s,t){return Math.abs(t[1])-Math.abs(s[1])}function zu(s,t,e){const n={},i=new Float32Array(8),r=new WeakMap,a=new me,o=[];for(let c=0;c<8;c++)o[c]=[c,0];function l(c,d,u){const p=c.morphTargetInfluences;if(t.isWebGL2===!0){const g=d.morphAttributes.position||d.morphAttributes.normal||d.morphAttributes.color,_=g!==void 0?g.length:0;let f=r.get(d);if(f===void 0||f.count!==_){let F=function(){Q.dispose(),r.delete(d),d.removeEventListener("dispose",F)};var m=F;f!==void 0&&f.texture.dispose();const x=d.morphAttributes.position!==void 0,T=d.morphAttributes.normal!==void 0,D=d.morphAttributes.color!==void 0,R=d.morphAttributes.position||[],w=d.morphAttributes.normal||[],W=d.morphAttributes.color||[];let S=0;x===!0&&(S=1),T===!0&&(S=2),D===!0&&(S=3);let b=d.attributes.position.count*S,k=1;b>t.maxTextureSize&&(k=Math.ceil(b/t.maxTextureSize),b=t.maxTextureSize);const V=new Float32Array(b*k*4*_),Q=new Ko(V,b,k,_);Q.type=pn,Q.needsUpdate=!0;const P=S*4;for(let H=0;H<_;H++){const q=R[H],X=w[H],$=W[H],j=b*k*4*H;for(let st=0;st<q.count;st++){const rt=st*P;x===!0&&(a.fromBufferAttribute(q,st),V[j+rt+0]=a.x,V[j+rt+1]=a.y,V[j+rt+2]=a.z,V[j+rt+3]=0),T===!0&&(a.fromBufferAttribute(X,st),V[j+rt+4]=a.x,V[j+rt+5]=a.y,V[j+rt+6]=a.z,V[j+rt+7]=0),D===!0&&(a.fromBufferAttribute($,st),V[j+rt+8]=a.x,V[j+rt+9]=a.y,V[j+rt+10]=a.z,V[j+rt+11]=$.itemSize===4?a.w:1)}}f={count:_,texture:Q,size:new Et(b,k)},r.set(d,f),d.addEventListener("dispose",F)}let h=0;for(let x=0;x<p.length;x++)h+=p[x];const E=d.morphTargetsRelative?1:1-h;u.getUniforms().setValue(s,"morphTargetBaseInfluence",E),u.getUniforms().setValue(s,"morphTargetInfluences",p),u.getUniforms().setValue(s,"morphTargetsTexture",f.texture,e),u.getUniforms().setValue(s,"morphTargetsTextureSize",f.size)}else{const g=p===void 0?0:p.length;let _=n[d.id];if(_===void 0||_.length!==g){_=[];for(let T=0;T<g;T++)_[T]=[T,0];n[d.id]=_}for(let T=0;T<g;T++){const D=_[T];D[0]=T,D[1]=p[T]}_.sort(Bu);for(let T=0;T<8;T++)T<g&&_[T][1]?(o[T][0]=_[T][0],o[T][1]=_[T][1]):(o[T][0]=Number.MAX_SAFE_INTEGER,o[T][1]=0);o.sort(Ou);const f=d.morphAttributes.position,h=d.morphAttributes.normal;let E=0;for(let T=0;T<8;T++){const D=o[T],R=D[0],w=D[1];R!==Number.MAX_SAFE_INTEGER&&w?(f&&d.getAttribute("morphTarget"+T)!==f[R]&&d.setAttribute("morphTarget"+T,f[R]),h&&d.getAttribute("morphNormal"+T)!==h[R]&&d.setAttribute("morphNormal"+T,h[R]),i[T]=w,E+=w):(f&&d.hasAttribute("morphTarget"+T)===!0&&d.deleteAttribute("morphTarget"+T),h&&d.hasAttribute("morphNormal"+T)===!0&&d.deleteAttribute("morphNormal"+T),i[T]=0)}const x=d.morphTargetsRelative?1:1-E;u.getUniforms().setValue(s,"morphTargetBaseInfluence",x),u.getUniforms().setValue(s,"morphTargetInfluences",i)}}return{update:l}}function Hu(s,t,e,n){let i=new WeakMap;function r(l){const c=n.render.frame,d=l.geometry,u=t.get(l,d);if(i.get(u)!==c&&(t.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(e.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,s.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){const p=l.skeleton;i.get(p)!==c&&(p.update(),i.set(p,c))}return u}function a(){i=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class rl extends Ae{constructor(t,e,n,i,r,a,o,l,c,d){if(d=d!==void 0?d:Un,d!==Un&&d!==xi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&d===Un&&(n=fn),n===void 0&&d===xi&&(n=In),super(null,i,r,a,o,l,d,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:ye,this.minFilter=l!==void 0?l:ye,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const al=new Ae,ol=new rl(1,1);ol.compareFunction=$o;const ll=new Ko,cl=new bc,dl=new nl,Ka=[],Za=[],Ja=new Float32Array(16),Qa=new Float32Array(9),to=new Float32Array(4);function Si(s,t,e){const n=s[0];if(n<=0||n>0)return s;const i=t*e;let r=Ka[i];if(r===void 0&&(r=new Float32Array(i),Ka[i]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function de(s,t){if(s.length!==t.length)return!1;for(let e=0,n=s.length;e<n;e++)if(s[e]!==t[e])return!1;return!0}function he(s,t){for(let e=0,n=t.length;e<n;e++)s[e]=t[e]}function ws(s,t){let e=Za[t];e===void 0&&(e=new Int32Array(t),Za[t]=e);for(let n=0;n!==t;++n)e[n]=s.allocateTextureUnit();return e}function ku(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function Vu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2fv(this.addr,t),he(e,t)}}function Gu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(de(e,t))return;s.uniform3fv(this.addr,t),he(e,t)}}function Wu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4fv(this.addr,t),he(e,t)}}function Xu(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),he(e,t)}else{if(de(e,n))return;to.set(n),s.uniformMatrix2fv(this.addr,!1,to),he(e,n)}}function $u(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),he(e,t)}else{if(de(e,n))return;Qa.set(n),s.uniformMatrix3fv(this.addr,!1,Qa),he(e,n)}}function qu(s,t){const e=this.cache,n=t.elements;if(n===void 0){if(de(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),he(e,t)}else{if(de(e,n))return;Ja.set(n),s.uniformMatrix4fv(this.addr,!1,Ja),he(e,n)}}function ju(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Yu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2iv(this.addr,t),he(e,t)}}function Ku(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(de(e,t))return;s.uniform3iv(this.addr,t),he(e,t)}}function Zu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4iv(this.addr,t),he(e,t)}}function Ju(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Qu(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(de(e,t))return;s.uniform2uiv(this.addr,t),he(e,t)}}function tf(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(de(e,t))return;s.uniform3uiv(this.addr,t),he(e,t)}}function ef(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(de(e,t))return;s.uniform4uiv(this.addr,t),he(e,t)}}function nf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);const r=this.type===s.SAMPLER_2D_SHADOW?ol:al;e.setTexture2D(t||r,i)}function sf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||cl,i)}function rf(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||dl,i)}function af(s,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||ll,i)}function of(s){switch(s){case 5126:return ku;case 35664:return Vu;case 35665:return Gu;case 35666:return Wu;case 35674:return Xu;case 35675:return $u;case 35676:return qu;case 5124:case 35670:return ju;case 35667:case 35671:return Yu;case 35668:case 35672:return Ku;case 35669:case 35673:return Zu;case 5125:return Ju;case 36294:return Qu;case 36295:return tf;case 36296:return ef;case 35678:case 36198:case 36298:case 36306:case 35682:return nf;case 35679:case 36299:case 36307:return sf;case 35680:case 36300:case 36308:case 36293:return rf;case 36289:case 36303:case 36311:case 36292:return af}}function lf(s,t){s.uniform1fv(this.addr,t)}function cf(s,t){const e=Si(t,this.size,2);s.uniform2fv(this.addr,e)}function df(s,t){const e=Si(t,this.size,3);s.uniform3fv(this.addr,e)}function hf(s,t){const e=Si(t,this.size,4);s.uniform4fv(this.addr,e)}function uf(s,t){const e=Si(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function ff(s,t){const e=Si(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function pf(s,t){const e=Si(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function mf(s,t){s.uniform1iv(this.addr,t)}function gf(s,t){s.uniform2iv(this.addr,t)}function _f(s,t){s.uniform3iv(this.addr,t)}function vf(s,t){s.uniform4iv(this.addr,t)}function xf(s,t){s.uniform1uiv(this.addr,t)}function Mf(s,t){s.uniform2uiv(this.addr,t)}function Sf(s,t){s.uniform3uiv(this.addr,t)}function yf(s,t){s.uniform4uiv(this.addr,t)}function Ef(s,t,e){const n=this.cache,i=t.length,r=ws(e,i);de(n,r)||(s.uniform1iv(this.addr,r),he(n,r));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||al,r[a])}function bf(s,t,e){const n=this.cache,i=t.length,r=ws(e,i);de(n,r)||(s.uniform1iv(this.addr,r),he(n,r));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||cl,r[a])}function Tf(s,t,e){const n=this.cache,i=t.length,r=ws(e,i);de(n,r)||(s.uniform1iv(this.addr,r),he(n,r));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||dl,r[a])}function Af(s,t,e){const n=this.cache,i=t.length,r=ws(e,i);de(n,r)||(s.uniform1iv(this.addr,r),he(n,r));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||ll,r[a])}function wf(s){switch(s){case 5126:return lf;case 35664:return cf;case 35665:return df;case 35666:return hf;case 35674:return uf;case 35675:return ff;case 35676:return pf;case 5124:case 35670:return mf;case 35667:case 35671:return gf;case 35668:case 35672:return _f;case 35669:case 35673:return vf;case 5125:return xf;case 36294:return Mf;case 36295:return Sf;case 36296:return yf;case 35678:case 36198:case 36298:case 36306:case 35682:return Ef;case 35679:case 36299:case 36307:return bf;case 35680:case 36300:case 36308:case 36293:return Tf;case 36289:case 36303:case 36311:case 36292:return Af}}class Rf{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=of(e.type)}}class Cf{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=wf(e.type)}}class Pf{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(t,e[o.id],n)}}}const lr=/(\w+)(\])?(\[|\.)?/g;function eo(s,t){s.seq.push(t),s.map[t.id]=t}function Lf(s,t,e){const n=s.name,i=n.length;for(lr.lastIndex=0;;){const r=lr.exec(n),a=lr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){eo(e,c===void 0?new Rf(o,s,t):new Cf(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new Pf(o),eo(e,u)),e=u}}}class ps{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const r=t.getActiveUniform(e,i),a=t.getUniformLocation(e,r.name);Lf(r,a,this)}}setValue(t,e,n,i){const r=this.map[e];r!==void 0&&r.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,r=t.length;i!==r;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function no(s,t,e){const n=s.createShader(t);return s.shaderSource(n,e),s.compileShader(n),n}const Df=37297;let If=0;function Uf(s,t){const e=s.split(`
`),n=[],i=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}function Nf(s){const t=jt.getPrimaries(jt.workingColorSpace),e=jt.getPrimaries(s);let n;switch(t===e?n="":t===vs&&e===_s?n="LinearDisplayP3ToLinearSRGB":t===_s&&e===vs&&(n="LinearSRGBToLinearDisplayP3"),s){case an:case Es:return[n,"LinearTransferOETF"];case pe:case Lr:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",s),[n,"LinearTransferOETF"]}}function io(s,t,e){const n=s.getShaderParameter(t,s.COMPILE_STATUS),i=s.getShaderInfoLog(t).trim();if(n&&i==="")return"";const r=/ERROR: 0:(\d+)/.exec(i);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+i+`

`+Uf(s.getShaderSource(t),a)}else return i}function Ff(s,t){const e=Nf(t);return`vec4 ${s}( vec4 value ) { return ${e[0]}( ${e[1]}( value ) ); }`}function Of(s,t){let e;switch(t){case ql:e="Linear";break;case jl:e="Reinhard";break;case Yl:e="OptimizedCineon";break;case No:e="ACESFilmic";break;case Zl:e="AgX";break;case Kl:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}function Bf(s){return[s.extensionDerivatives||s.envMapCubeUVHeight||s.bumpMap||s.normalMapTangentSpace||s.clearcoatNormalMap||s.flatShading||s.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(s.extensionFragDepth||s.logarithmicDepthBuffer)&&s.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",s.extensionDrawBuffers&&s.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(s.extensionShaderTextureLOD||s.envMap||s.transmission)&&s.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ui).join(`
`)}function zf(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(ui).join(`
`)}function Hf(s){const t=[];for(const e in s){const n=s[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function kf(s,t){const e={},n=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(t,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function ui(s){return s!==""}function so(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function ro(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Vf=/^[ \t]*#include +<([\w\d./]+)>/gm;function wr(s){return s.replace(Vf,Wf)}const Gf=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function Wf(s,t){let e=Ot[t];if(e===void 0){const n=Gf.get(t);if(n!==void 0)e=Ot[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return wr(e)}const Xf=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ao(s){return s.replace(Xf,$f)}function $f(s,t,e,n){let i="";for(let r=parseInt(t);r<parseInt(e);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function oo(s){let t="precision "+s.precision+` float;
precision `+s.precision+" int;";return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function qf(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Do?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===Io?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===en&&(t="SHADOWMAP_TYPE_VSM"),t}function jf(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case _i:case vi:t="ENVMAP_TYPE_CUBE";break;case ys:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Yf(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case vi:t="ENVMAP_MODE_REFRACTION";break}return t}function Kf(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case Uo:t="ENVMAP_BLENDING_MULTIPLY";break;case Xl:t="ENVMAP_BLENDING_MIX";break;case $l:t="ENVMAP_BLENDING_ADD";break}return t}function Zf(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function Jf(s,t,e,n){const i=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=qf(e),c=jf(e),d=Yf(e),u=Kf(e),p=Zf(e),m=e.isWebGL2?"":Bf(e),g=zf(e),_=Hf(r),f=i.createProgram();let h,E,x=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(h=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(ui).join(`
`),h.length>0&&(h+=`
`),E=[m,"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_].filter(ui).join(`
`),E.length>0&&(E+=`
`)):(h=[oo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+d:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors&&e.isWebGL2?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0&&e.isWebGL2?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ui).join(`
`),E=[m,oo(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,_,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+d:"",e.envMap?"#define "+u:"",p?"#define CUBEUV_TEXEL_WIDTH "+p.texelWidth:"",p?"#define CUBEUV_TEXEL_HEIGHT "+p.texelHeight:"",p?"#define CUBEUV_MAX_MIP "+p.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.useLegacyLights?"#define LEGACY_LIGHTS":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==_n?"#define TONE_MAPPING":"",e.toneMapping!==_n?Ot.tonemapping_pars_fragment:"",e.toneMapping!==_n?Of("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ot.colorspace_pars_fragment,Ff("linearToOutputTexel",e.outputColorSpace),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ui).join(`
`)),a=wr(a),a=so(a,e),a=ro(a,e),o=wr(o),o=so(o,e),o=ro(o,e),a=ao(a),o=ao(o),e.isWebGL2&&e.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,h=[g,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+h,E=["precision mediump sampler2DArray;","#define varying in",e.glslVersion===Ta?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Ta?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+E);const T=x+h+a,D=x+E+o,R=no(i,i.VERTEX_SHADER,T),w=no(i,i.FRAGMENT_SHADER,D);i.attachShader(f,R),i.attachShader(f,w),e.index0AttributeName!==void 0?i.bindAttribLocation(f,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(f,0,"position"),i.linkProgram(f);function W(V){if(s.debug.checkShaderErrors){const Q=i.getProgramInfoLog(f).trim(),P=i.getShaderInfoLog(R).trim(),F=i.getShaderInfoLog(w).trim();let H=!0,q=!0;if(i.getProgramParameter(f,i.LINK_STATUS)===!1)if(H=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,f,R,w);else{const X=io(i,R,"vertex"),$=io(i,w,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(f,i.VALIDATE_STATUS)+`

Program Info Log: `+Q+`
`+X+`
`+$)}else Q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Q):(P===""||F==="")&&(q=!1);q&&(V.diagnostics={runnable:H,programLog:Q,vertexShader:{log:P,prefix:h},fragmentShader:{log:F,prefix:E}})}i.deleteShader(R),i.deleteShader(w),S=new ps(i,f),b=kf(i,f)}let S;this.getUniforms=function(){return S===void 0&&W(this),S};let b;this.getAttributes=function(){return b===void 0&&W(this),b};let k=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return k===!1&&(k=i.getProgramParameter(f,Df)),k},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(f),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=If++,this.cacheKey=t,this.usedTimes=1,this.program=f,this.vertexShader=R,this.fragmentShader=w,this}let Qf=0;class tp{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new ep(t),e.set(t,n)),n}}class ep{constructor(t){this.id=Qf++,this.code=t,this.usedTimes=0}}function np(s,t,e,n,i,r,a){const o=new Dr,l=new tp,c=[],d=i.isWebGL2,u=i.logarithmicDepthBuffer,p=i.vertexTextures;let m=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(S){return S===0?"uv":`uv${S}`}function f(S,b,k,V,Q){const P=V.fog,F=Q.geometry,H=S.isMeshStandardMaterial?V.environment:null,q=(S.isMeshStandardMaterial?e:t).get(S.envMap||H),X=q&&q.mapping===ys?q.image.height:null,$=g[S.type];S.precision!==null&&(m=i.getMaxPrecision(S.precision),m!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",m,"instead."));const j=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,st=j!==void 0?j.length:0;let rt=0;F.morphAttributes.position!==void 0&&(rt=1),F.morphAttributes.normal!==void 0&&(rt=2),F.morphAttributes.color!==void 0&&(rt=3);let G,Y,ct,vt;if($){const ne=je[$];G=ne.vertexShader,Y=ne.fragmentShader}else G=S.vertexShader,Y=S.fragmentShader,l.update(S),ct=l.getVertexShaderID(S),vt=l.getFragmentShaderID(S);const gt=s.getRenderTarget(),Lt=Q.isInstancedMesh===!0,Dt=Q.isBatchedMesh===!0,Tt=!!S.map,Gt=!!S.matcap,N=!!q,ge=!!S.aoMap,St=!!S.lightMap,Rt=!!S.bumpMap,pt=!!S.normalMap,Kt=!!S.displacementMap,Ut=!!S.emissiveMap,y=!!S.metalnessMap,v=!!S.roughnessMap,U=S.anisotropy>0,tt=S.clearcoat>0,Z=S.iridescence>0,et=S.sheen>0,mt=S.transmission>0,lt=U&&!!S.anisotropyMap,ft=tt&&!!S.clearcoatMap,bt=tt&&!!S.clearcoatNormalMap,Nt=tt&&!!S.clearcoatRoughnessMap,K=Z&&!!S.iridescenceMap,qt=Z&&!!S.iridescenceThicknessMap,zt=et&&!!S.sheenColorMap,Ct=et&&!!S.sheenRoughnessMap,Mt=!!S.specularMap,dt=!!S.specularColorMap,A=!!S.specularIntensityMap,nt=mt&&!!S.transmissionMap,_t=mt&&!!S.thicknessMap,ut=!!S.gradientMap,J=!!S.alphaMap,C=S.alphaTest>0,it=!!S.alphaHash,ot=!!S.extensions,At=!!F.attributes.uv1,yt=!!F.attributes.uv2,Wt=!!F.attributes.uv3;let Xt=_n;return S.toneMapped&&(gt===null||gt.isXRRenderTarget===!0)&&(Xt=s.toneMapping),{isWebGL2:d,shaderID:$,shaderType:S.type,shaderName:S.name,vertexShader:G,fragmentShader:Y,defines:S.defines,customVertexShaderID:ct,customFragmentShaderID:vt,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:m,batching:Dt,instancing:Lt,instancingColor:Lt&&Q.instanceColor!==null,supportsVertexTextures:p,outputColorSpace:gt===null?s.outputColorSpace:gt.isXRRenderTarget===!0?gt.texture.colorSpace:an,map:Tt,matcap:Gt,envMap:N,envMapMode:N&&q.mapping,envMapCubeUVHeight:X,aoMap:ge,lightMap:St,bumpMap:Rt,normalMap:pt,displacementMap:p&&Kt,emissiveMap:Ut,normalMapObjectSpace:pt&&S.normalMapType===cc,normalMapTangentSpace:pt&&S.normalMapType===Xo,metalnessMap:y,roughnessMap:v,anisotropy:U,anisotropyMap:lt,clearcoat:tt,clearcoatMap:ft,clearcoatNormalMap:bt,clearcoatRoughnessMap:Nt,iridescence:Z,iridescenceMap:K,iridescenceThicknessMap:qt,sheen:et,sheenColorMap:zt,sheenRoughnessMap:Ct,specularMap:Mt,specularColorMap:dt,specularIntensityMap:A,transmission:mt,transmissionMap:nt,thicknessMap:_t,gradientMap:ut,opaque:S.transparent===!1&&S.blending===fi,alphaMap:J,alphaTest:C,alphaHash:it,combine:S.combine,mapUv:Tt&&_(S.map.channel),aoMapUv:ge&&_(S.aoMap.channel),lightMapUv:St&&_(S.lightMap.channel),bumpMapUv:Rt&&_(S.bumpMap.channel),normalMapUv:pt&&_(S.normalMap.channel),displacementMapUv:Kt&&_(S.displacementMap.channel),emissiveMapUv:Ut&&_(S.emissiveMap.channel),metalnessMapUv:y&&_(S.metalnessMap.channel),roughnessMapUv:v&&_(S.roughnessMap.channel),anisotropyMapUv:lt&&_(S.anisotropyMap.channel),clearcoatMapUv:ft&&_(S.clearcoatMap.channel),clearcoatNormalMapUv:bt&&_(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Nt&&_(S.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&_(S.iridescenceMap.channel),iridescenceThicknessMapUv:qt&&_(S.iridescenceThicknessMap.channel),sheenColorMapUv:zt&&_(S.sheenColorMap.channel),sheenRoughnessMapUv:Ct&&_(S.sheenRoughnessMap.channel),specularMapUv:Mt&&_(S.specularMap.channel),specularColorMapUv:dt&&_(S.specularColorMap.channel),specularIntensityMapUv:A&&_(S.specularIntensityMap.channel),transmissionMapUv:nt&&_(S.transmissionMap.channel),thicknessMapUv:_t&&_(S.thicknessMap.channel),alphaMapUv:J&&_(S.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(pt||U),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,vertexUv1s:At,vertexUv2s:yt,vertexUv3s:Wt,pointsUvs:Q.isPoints===!0&&!!F.attributes.uv&&(Tt||J),fog:!!P,useFog:S.fog===!0,fogExp2:P&&P.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:u,skinning:Q.isSkinnedMesh===!0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:st,morphTextureStride:rt,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:S.dithering,shadowMapEnabled:s.shadowMap.enabled&&k.length>0,shadowMapType:s.shadowMap.type,toneMapping:Xt,useLegacyLights:s._useLegacyLights,decodeVideoTexture:Tt&&S.map.isVideoTexture===!0&&jt.getTransfer(S.map.colorSpace)===Zt,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===Oe,flipSided:S.side===Te,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionDerivatives:ot&&S.extensions.derivatives===!0,extensionFragDepth:ot&&S.extensions.fragDepth===!0,extensionDrawBuffers:ot&&S.extensions.drawBuffers===!0,extensionShaderTextureLOD:ot&&S.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ot&&S.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:d||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:d||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:d||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()}}function h(S){const b=[];if(S.shaderID?b.push(S.shaderID):(b.push(S.customVertexShaderID),b.push(S.customFragmentShaderID)),S.defines!==void 0)for(const k in S.defines)b.push(k),b.push(S.defines[k]);return S.isRawShaderMaterial===!1&&(E(b,S),x(b,S),b.push(s.outputColorSpace)),b.push(S.customProgramCacheKey),b.join()}function E(S,b){S.push(b.precision),S.push(b.outputColorSpace),S.push(b.envMapMode),S.push(b.envMapCubeUVHeight),S.push(b.mapUv),S.push(b.alphaMapUv),S.push(b.lightMapUv),S.push(b.aoMapUv),S.push(b.bumpMapUv),S.push(b.normalMapUv),S.push(b.displacementMapUv),S.push(b.emissiveMapUv),S.push(b.metalnessMapUv),S.push(b.roughnessMapUv),S.push(b.anisotropyMapUv),S.push(b.clearcoatMapUv),S.push(b.clearcoatNormalMapUv),S.push(b.clearcoatRoughnessMapUv),S.push(b.iridescenceMapUv),S.push(b.iridescenceThicknessMapUv),S.push(b.sheenColorMapUv),S.push(b.sheenRoughnessMapUv),S.push(b.specularMapUv),S.push(b.specularColorMapUv),S.push(b.specularIntensityMapUv),S.push(b.transmissionMapUv),S.push(b.thicknessMapUv),S.push(b.combine),S.push(b.fogExp2),S.push(b.sizeAttenuation),S.push(b.morphTargetsCount),S.push(b.morphAttributeCount),S.push(b.numDirLights),S.push(b.numPointLights),S.push(b.numSpotLights),S.push(b.numSpotLightMaps),S.push(b.numHemiLights),S.push(b.numRectAreaLights),S.push(b.numDirLightShadows),S.push(b.numPointLightShadows),S.push(b.numSpotLightShadows),S.push(b.numSpotLightShadowsWithMaps),S.push(b.numLightProbes),S.push(b.shadowMapType),S.push(b.toneMapping),S.push(b.numClippingPlanes),S.push(b.numClipIntersection),S.push(b.depthPacking)}function x(S,b){o.disableAll(),b.isWebGL2&&o.enable(0),b.supportsVertexTextures&&o.enable(1),b.instancing&&o.enable(2),b.instancingColor&&o.enable(3),b.matcap&&o.enable(4),b.envMap&&o.enable(5),b.normalMapObjectSpace&&o.enable(6),b.normalMapTangentSpace&&o.enable(7),b.clearcoat&&o.enable(8),b.iridescence&&o.enable(9),b.alphaTest&&o.enable(10),b.vertexColors&&o.enable(11),b.vertexAlphas&&o.enable(12),b.vertexUv1s&&o.enable(13),b.vertexUv2s&&o.enable(14),b.vertexUv3s&&o.enable(15),b.vertexTangents&&o.enable(16),b.anisotropy&&o.enable(17),b.alphaHash&&o.enable(18),b.batching&&o.enable(19),S.push(o.mask),o.disableAll(),b.fog&&o.enable(0),b.useFog&&o.enable(1),b.flatShading&&o.enable(2),b.logarithmicDepthBuffer&&o.enable(3),b.skinning&&o.enable(4),b.morphTargets&&o.enable(5),b.morphNormals&&o.enable(6),b.morphColors&&o.enable(7),b.premultipliedAlpha&&o.enable(8),b.shadowMapEnabled&&o.enable(9),b.useLegacyLights&&o.enable(10),b.doubleSided&&o.enable(11),b.flipSided&&o.enable(12),b.useDepthPacking&&o.enable(13),b.dithering&&o.enable(14),b.transmission&&o.enable(15),b.sheen&&o.enable(16),b.opaque&&o.enable(17),b.pointsUvs&&o.enable(18),b.decodeVideoTexture&&o.enable(19),S.push(o.mask)}function T(S){const b=g[S.type];let k;if(b){const V=je[b];k=Oc.clone(V.uniforms)}else k=S.uniforms;return k}function D(S,b){let k;for(let V=0,Q=c.length;V<Q;V++){const P=c[V];if(P.cacheKey===b){k=P,++k.usedTimes;break}}return k===void 0&&(k=new Jf(s,b,S,r),c.push(k)),k}function R(S){if(--S.usedTimes===0){const b=c.indexOf(S);c[b]=c[c.length-1],c.pop(),S.destroy()}}function w(S){l.remove(S)}function W(){l.dispose()}return{getParameters:f,getProgramCacheKey:h,getUniforms:T,acquireProgram:D,releaseProgram:R,releaseShaderCache:w,programs:c,dispose:W}}function ip(){let s=new WeakMap;function t(r){let a=s.get(r);return a===void 0&&(a={},s.set(r,a)),a}function e(r){s.delete(r)}function n(r,a,o){s.get(r)[a]=o}function i(){s=new WeakMap}return{get:t,remove:e,update:n,dispose:i}}function sp(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function lo(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function co(){const s=[];let t=0;const e=[],n=[],i=[];function r(){t=0,e.length=0,n.length=0,i.length=0}function a(u,p,m,g,_,f){let h=s[t];return h===void 0?(h={id:u.id,object:u,geometry:p,material:m,groupOrder:g,renderOrder:u.renderOrder,z:_,group:f},s[t]=h):(h.id=u.id,h.object=u,h.geometry=p,h.material=m,h.groupOrder=g,h.renderOrder=u.renderOrder,h.z=_,h.group=f),t++,h}function o(u,p,m,g,_,f){const h=a(u,p,m,g,_,f);m.transmission>0?n.push(h):m.transparent===!0?i.push(h):e.push(h)}function l(u,p,m,g,_,f){const h=a(u,p,m,g,_,f);m.transmission>0?n.unshift(h):m.transparent===!0?i.unshift(h):e.unshift(h)}function c(u,p){e.length>1&&e.sort(u||sp),n.length>1&&n.sort(p||lo),i.length>1&&i.sort(p||lo)}function d(){for(let u=t,p=s.length;u<p;u++){const m=s[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:i,init:r,push:o,unshift:l,finish:d,sort:c}}function rp(){let s=new WeakMap;function t(n,i){const r=s.get(n);let a;return r===void 0?(a=new co,s.set(n,[a])):i>=r.length?(a=new co,r.push(a)):a=r[i],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function ap(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new L,color:new Bt};break;case"SpotLight":e={position:new L,direction:new L,color:new Bt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new L,color:new Bt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new L,skyColor:new Bt,groundColor:new Bt};break;case"RectAreaLight":e={color:new Bt,position:new L,halfWidth:new L,halfHeight:new L};break}return s[t.id]=e,e}}}function op(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Et};break;case"SpotLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Et};break;case"PointLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Et,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let lp=0;function cp(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function dp(s,t){const e=new ap,n=op(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let d=0;d<9;d++)i.probe.push(new L);const r=new L,a=new re,o=new re;function l(d,u){let p=0,m=0,g=0;for(let V=0;V<9;V++)i.probe[V].set(0,0,0);let _=0,f=0,h=0,E=0,x=0,T=0,D=0,R=0,w=0,W=0,S=0;d.sort(cp);const b=u===!0?Math.PI:1;for(let V=0,Q=d.length;V<Q;V++){const P=d[V],F=P.color,H=P.intensity,q=P.distance,X=P.shadow&&P.shadow.map?P.shadow.map.texture:null;if(P.isAmbientLight)p+=F.r*H*b,m+=F.g*H*b,g+=F.b*H*b;else if(P.isLightProbe){for(let $=0;$<9;$++)i.probe[$].addScaledVector(P.sh.coefficients[$],H);S++}else if(P.isDirectionalLight){const $=e.get(P);if($.color.copy(P.color).multiplyScalar(P.intensity*b),P.castShadow){const j=P.shadow,st=n.get(P);st.shadowBias=j.bias,st.shadowNormalBias=j.normalBias,st.shadowRadius=j.radius,st.shadowMapSize=j.mapSize,i.directionalShadow[_]=st,i.directionalShadowMap[_]=X,i.directionalShadowMatrix[_]=P.shadow.matrix,T++}i.directional[_]=$,_++}else if(P.isSpotLight){const $=e.get(P);$.position.setFromMatrixPosition(P.matrixWorld),$.color.copy(F).multiplyScalar(H*b),$.distance=q,$.coneCos=Math.cos(P.angle),$.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),$.decay=P.decay,i.spot[h]=$;const j=P.shadow;if(P.map&&(i.spotLightMap[w]=P.map,w++,j.updateMatrices(P),P.castShadow&&W++),i.spotLightMatrix[h]=j.matrix,P.castShadow){const st=n.get(P);st.shadowBias=j.bias,st.shadowNormalBias=j.normalBias,st.shadowRadius=j.radius,st.shadowMapSize=j.mapSize,i.spotShadow[h]=st,i.spotShadowMap[h]=X,R++}h++}else if(P.isRectAreaLight){const $=e.get(P);$.color.copy(F).multiplyScalar(H),$.halfWidth.set(P.width*.5,0,0),$.halfHeight.set(0,P.height*.5,0),i.rectArea[E]=$,E++}else if(P.isPointLight){const $=e.get(P);if($.color.copy(P.color).multiplyScalar(P.intensity*b),$.distance=P.distance,$.decay=P.decay,P.castShadow){const j=P.shadow,st=n.get(P);st.shadowBias=j.bias,st.shadowNormalBias=j.normalBias,st.shadowRadius=j.radius,st.shadowMapSize=j.mapSize,st.shadowCameraNear=j.camera.near,st.shadowCameraFar=j.camera.far,i.pointShadow[f]=st,i.pointShadowMap[f]=X,i.pointShadowMatrix[f]=P.shadow.matrix,D++}i.point[f]=$,f++}else if(P.isHemisphereLight){const $=e.get(P);$.skyColor.copy(P.color).multiplyScalar(H*b),$.groundColor.copy(P.groundColor).multiplyScalar(H*b),i.hemi[x]=$,x++}}E>0&&(t.isWebGL2?s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=at.LTC_FLOAT_1,i.rectAreaLTC2=at.LTC_FLOAT_2):(i.rectAreaLTC1=at.LTC_HALF_1,i.rectAreaLTC2=at.LTC_HALF_2):s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=at.LTC_FLOAT_1,i.rectAreaLTC2=at.LTC_FLOAT_2):s.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=at.LTC_HALF_1,i.rectAreaLTC2=at.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=p,i.ambient[1]=m,i.ambient[2]=g;const k=i.hash;(k.directionalLength!==_||k.pointLength!==f||k.spotLength!==h||k.rectAreaLength!==E||k.hemiLength!==x||k.numDirectionalShadows!==T||k.numPointShadows!==D||k.numSpotShadows!==R||k.numSpotMaps!==w||k.numLightProbes!==S)&&(i.directional.length=_,i.spot.length=h,i.rectArea.length=E,i.point.length=f,i.hemi.length=x,i.directionalShadow.length=T,i.directionalShadowMap.length=T,i.pointShadow.length=D,i.pointShadowMap.length=D,i.spotShadow.length=R,i.spotShadowMap.length=R,i.directionalShadowMatrix.length=T,i.pointShadowMatrix.length=D,i.spotLightMatrix.length=R+w-W,i.spotLightMap.length=w,i.numSpotLightShadowsWithMaps=W,i.numLightProbes=S,k.directionalLength=_,k.pointLength=f,k.spotLength=h,k.rectAreaLength=E,k.hemiLength=x,k.numDirectionalShadows=T,k.numPointShadows=D,k.numSpotShadows=R,k.numSpotMaps=w,k.numLightProbes=S,i.version=lp++)}function c(d,u){let p=0,m=0,g=0,_=0,f=0;const h=u.matrixWorldInverse;for(let E=0,x=d.length;E<x;E++){const T=d[E];if(T.isDirectionalLight){const D=i.directional[p];D.direction.setFromMatrixPosition(T.matrixWorld),r.setFromMatrixPosition(T.target.matrixWorld),D.direction.sub(r),D.direction.transformDirection(h),p++}else if(T.isSpotLight){const D=i.spot[g];D.position.setFromMatrixPosition(T.matrixWorld),D.position.applyMatrix4(h),D.direction.setFromMatrixPosition(T.matrixWorld),r.setFromMatrixPosition(T.target.matrixWorld),D.direction.sub(r),D.direction.transformDirection(h),g++}else if(T.isRectAreaLight){const D=i.rectArea[_];D.position.setFromMatrixPosition(T.matrixWorld),D.position.applyMatrix4(h),o.identity(),a.copy(T.matrixWorld),a.premultiply(h),o.extractRotation(a),D.halfWidth.set(T.width*.5,0,0),D.halfHeight.set(0,T.height*.5,0),D.halfWidth.applyMatrix4(o),D.halfHeight.applyMatrix4(o),_++}else if(T.isPointLight){const D=i.point[m];D.position.setFromMatrixPosition(T.matrixWorld),D.position.applyMatrix4(h),m++}else if(T.isHemisphereLight){const D=i.hemi[f];D.direction.setFromMatrixPosition(T.matrixWorld),D.direction.transformDirection(h),f++}}}return{setup:l,setupView:c,state:i}}function ho(s,t){const e=new dp(s,t),n=[],i=[];function r(){n.length=0,i.length=0}function a(u){n.push(u)}function o(u){i.push(u)}function l(u){e.setup(n,u)}function c(u){e.setupView(n,u)}return{init:r,state:{lightsArray:n,shadowsArray:i,lights:e},setupLights:l,setupLightsView:c,pushLight:a,pushShadow:o}}function hp(s,t){let e=new WeakMap;function n(r,a=0){const o=e.get(r);let l;return o===void 0?(l=new ho(s,t),e.set(r,[l])):a>=o.length?(l=new ho(s,t),o.push(l)):l=o[a],l}function i(){e=new WeakMap}return{get:n,dispose:i}}class up extends Hn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=oc,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class fp extends Hn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const pp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,mp=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function gp(s,t,e){let n=new Ir;const i=new Et,r=new Et,a=new me,o=new up({depthPacking:lc}),l=new fp,c={},d=e.maxTextureSize,u={[Mn]:Te,[Te]:Mn,[Oe]:Oe},p=new Bn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Et},radius:{value:4}},vertexShader:pp,fragmentShader:mp}),m=p.clone();m.defines.HORIZONTAL_PASS=1;const g=new we;g.setAttribute("position",new ze(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new Jt(g,p),f=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Do;let h=this.type;this.render=function(R,w,W){if(f.enabled===!1||f.autoUpdate===!1&&f.needsUpdate===!1||R.length===0)return;const S=s.getRenderTarget(),b=s.getActiveCubeFace(),k=s.getActiveMipmapLevel(),V=s.state;V.setBlending(gn),V.buffers.color.setClear(1,1,1,1),V.buffers.depth.setTest(!0),V.setScissorTest(!1);const Q=h!==en&&this.type===en,P=h===en&&this.type!==en;for(let F=0,H=R.length;F<H;F++){const q=R[F],X=q.shadow;if(X===void 0){console.warn("THREE.WebGLShadowMap:",q,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;i.copy(X.mapSize);const $=X.getFrameExtents();if(i.multiply($),r.copy(X.mapSize),(i.x>d||i.y>d)&&(i.x>d&&(r.x=Math.floor(d/$.x),i.x=r.x*$.x,X.mapSize.x=r.x),i.y>d&&(r.y=Math.floor(d/$.y),i.y=r.y*$.y,X.mapSize.y=r.y)),X.map===null||Q===!0||P===!0){const st=this.type!==en?{minFilter:ye,magFilter:ye}:{};X.map!==null&&X.map.dispose(),X.map=new Fn(i.x,i.y,st),X.map.texture.name=q.name+".shadowMap",X.camera.updateProjectionMatrix()}s.setRenderTarget(X.map),s.clear();const j=X.getViewportCount();for(let st=0;st<j;st++){const rt=X.getViewport(st);a.set(r.x*rt.x,r.y*rt.y,r.x*rt.z,r.y*rt.w),V.viewport(a),X.updateMatrices(q,st),n=X.getFrustum(),T(w,W,X.camera,q,this.type)}X.isPointLightShadow!==!0&&this.type===en&&E(X,W),X.needsUpdate=!1}h=this.type,f.needsUpdate=!1,s.setRenderTarget(S,b,k)};function E(R,w){const W=t.update(_);p.defines.VSM_SAMPLES!==R.blurSamples&&(p.defines.VSM_SAMPLES=R.blurSamples,m.defines.VSM_SAMPLES=R.blurSamples,p.needsUpdate=!0,m.needsUpdate=!0),R.mapPass===null&&(R.mapPass=new Fn(i.x,i.y)),p.uniforms.shadow_pass.value=R.map.texture,p.uniforms.resolution.value=R.mapSize,p.uniforms.radius.value=R.radius,s.setRenderTarget(R.mapPass),s.clear(),s.renderBufferDirect(w,null,W,p,_,null),m.uniforms.shadow_pass.value=R.mapPass.texture,m.uniforms.resolution.value=R.mapSize,m.uniforms.radius.value=R.radius,s.setRenderTarget(R.map),s.clear(),s.renderBufferDirect(w,null,W,m,_,null)}function x(R,w,W,S){let b=null;const k=W.isPointLight===!0?R.customDistanceMaterial:R.customDepthMaterial;if(k!==void 0)b=k;else if(b=W.isPointLight===!0?l:o,s.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0){const V=b.uuid,Q=w.uuid;let P=c[V];P===void 0&&(P={},c[V]=P);let F=P[Q];F===void 0&&(F=b.clone(),P[Q]=F,w.addEventListener("dispose",D)),b=F}if(b.visible=w.visible,b.wireframe=w.wireframe,S===en?b.side=w.shadowSide!==null?w.shadowSide:w.side:b.side=w.shadowSide!==null?w.shadowSide:u[w.side],b.alphaMap=w.alphaMap,b.alphaTest=w.alphaTest,b.map=w.map,b.clipShadows=w.clipShadows,b.clippingPlanes=w.clippingPlanes,b.clipIntersection=w.clipIntersection,b.displacementMap=w.displacementMap,b.displacementScale=w.displacementScale,b.displacementBias=w.displacementBias,b.wireframeLinewidth=w.wireframeLinewidth,b.linewidth=w.linewidth,W.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const V=s.properties.get(b);V.light=W}return b}function T(R,w,W,S,b){if(R.visible===!1)return;if(R.layers.test(w.layers)&&(R.isMesh||R.isLine||R.isPoints)&&(R.castShadow||R.receiveShadow&&b===en)&&(!R.frustumCulled||n.intersectsObject(R))){R.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,R.matrixWorld);const Q=t.update(R),P=R.material;if(Array.isArray(P)){const F=Q.groups;for(let H=0,q=F.length;H<q;H++){const X=F[H],$=P[X.materialIndex];if($&&$.visible){const j=x(R,$,S,b);R.onBeforeShadow(s,R,w,W,Q,j,X),s.renderBufferDirect(W,null,Q,j,R,X),R.onAfterShadow(s,R,w,W,Q,j,X)}}}else if(P.visible){const F=x(R,P,S,b);R.onBeforeShadow(s,R,w,W,Q,F,null),s.renderBufferDirect(W,null,Q,F,R,null),R.onAfterShadow(s,R,w,W,Q,F,null)}}const V=R.children;for(let Q=0,P=V.length;Q<P;Q++)T(V[Q],w,W,S,b)}function D(R){R.target.removeEventListener("dispose",D);for(const W in c){const S=c[W],b=R.target.uuid;b in S&&(S[b].dispose(),delete S[b])}}}function _p(s,t,e){const n=e.isWebGL2;function i(){let C=!1;const it=new me;let ot=null;const At=new me(0,0,0,0);return{setMask:function(yt){ot!==yt&&!C&&(s.colorMask(yt,yt,yt,yt),ot=yt)},setLocked:function(yt){C=yt},setClear:function(yt,Wt,Xt,te,ne){ne===!0&&(yt*=te,Wt*=te,Xt*=te),it.set(yt,Wt,Xt,te),At.equals(it)===!1&&(s.clearColor(yt,Wt,Xt,te),At.copy(it))},reset:function(){C=!1,ot=null,At.set(-1,0,0,0)}}}function r(){let C=!1,it=null,ot=null,At=null;return{setTest:function(yt){yt?Dt(s.DEPTH_TEST):Tt(s.DEPTH_TEST)},setMask:function(yt){it!==yt&&!C&&(s.depthMask(yt),it=yt)},setFunc:function(yt){if(ot!==yt){switch(yt){case Bl:s.depthFunc(s.NEVER);break;case zl:s.depthFunc(s.ALWAYS);break;case Hl:s.depthFunc(s.LESS);break;case ms:s.depthFunc(s.LEQUAL);break;case kl:s.depthFunc(s.EQUAL);break;case Vl:s.depthFunc(s.GEQUAL);break;case Gl:s.depthFunc(s.GREATER);break;case Wl:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ot=yt}},setLocked:function(yt){C=yt},setClear:function(yt){At!==yt&&(s.clearDepth(yt),At=yt)},reset:function(){C=!1,it=null,ot=null,At=null}}}function a(){let C=!1,it=null,ot=null,At=null,yt=null,Wt=null,Xt=null,te=null,ne=null;return{setTest:function($t){C||($t?Dt(s.STENCIL_TEST):Tt(s.STENCIL_TEST))},setMask:function($t){it!==$t&&!C&&(s.stencilMask($t),it=$t)},setFunc:function($t,ae,qe){(ot!==$t||At!==ae||yt!==qe)&&(s.stencilFunc($t,ae,qe),ot=$t,At=ae,yt=qe)},setOp:function($t,ae,qe){(Wt!==$t||Xt!==ae||te!==qe)&&(s.stencilOp($t,ae,qe),Wt=$t,Xt=ae,te=qe)},setLocked:function($t){C=$t},setClear:function($t){ne!==$t&&(s.clearStencil($t),ne=$t)},reset:function(){C=!1,it=null,ot=null,At=null,yt=null,Wt=null,Xt=null,te=null,ne=null}}}const o=new i,l=new r,c=new a,d=new WeakMap,u=new WeakMap;let p={},m={},g=new WeakMap,_=[],f=null,h=!1,E=null,x=null,T=null,D=null,R=null,w=null,W=null,S=new Bt(0,0,0),b=0,k=!1,V=null,Q=null,P=null,F=null,H=null;const q=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,$=0;const j=s.getParameter(s.VERSION);j.indexOf("WebGL")!==-1?($=parseFloat(/^WebGL (\d)/.exec(j)[1]),X=$>=1):j.indexOf("OpenGL ES")!==-1&&($=parseFloat(/^OpenGL ES (\d)/.exec(j)[1]),X=$>=2);let st=null,rt={};const G=s.getParameter(s.SCISSOR_BOX),Y=s.getParameter(s.VIEWPORT),ct=new me().fromArray(G),vt=new me().fromArray(Y);function gt(C,it,ot,At){const yt=new Uint8Array(4),Wt=s.createTexture();s.bindTexture(C,Wt),s.texParameteri(C,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(C,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Xt=0;Xt<ot;Xt++)n&&(C===s.TEXTURE_3D||C===s.TEXTURE_2D_ARRAY)?s.texImage3D(it,0,s.RGBA,1,1,At,0,s.RGBA,s.UNSIGNED_BYTE,yt):s.texImage2D(it+Xt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,yt);return Wt}const Lt={};Lt[s.TEXTURE_2D]=gt(s.TEXTURE_2D,s.TEXTURE_2D,1),Lt[s.TEXTURE_CUBE_MAP]=gt(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(Lt[s.TEXTURE_2D_ARRAY]=gt(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Lt[s.TEXTURE_3D]=gt(s.TEXTURE_3D,s.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Dt(s.DEPTH_TEST),l.setFunc(ms),Ut(!1),y($r),Dt(s.CULL_FACE),pt(gn);function Dt(C){p[C]!==!0&&(s.enable(C),p[C]=!0)}function Tt(C){p[C]!==!1&&(s.disable(C),p[C]=!1)}function Gt(C,it){return m[C]!==it?(s.bindFramebuffer(C,it),m[C]=it,n&&(C===s.DRAW_FRAMEBUFFER&&(m[s.FRAMEBUFFER]=it),C===s.FRAMEBUFFER&&(m[s.DRAW_FRAMEBUFFER]=it)),!0):!1}function N(C,it){let ot=_,At=!1;if(C)if(ot=g.get(it),ot===void 0&&(ot=[],g.set(it,ot)),C.isWebGLMultipleRenderTargets){const yt=C.texture;if(ot.length!==yt.length||ot[0]!==s.COLOR_ATTACHMENT0){for(let Wt=0,Xt=yt.length;Wt<Xt;Wt++)ot[Wt]=s.COLOR_ATTACHMENT0+Wt;ot.length=yt.length,At=!0}}else ot[0]!==s.COLOR_ATTACHMENT0&&(ot[0]=s.COLOR_ATTACHMENT0,At=!0);else ot[0]!==s.BACK&&(ot[0]=s.BACK,At=!0);At&&(e.isWebGL2?s.drawBuffers(ot):t.get("WEBGL_draw_buffers").drawBuffersWEBGL(ot))}function ge(C){return f!==C?(s.useProgram(C),f=C,!0):!1}const St={[Pn]:s.FUNC_ADD,[El]:s.FUNC_SUBTRACT,[bl]:s.FUNC_REVERSE_SUBTRACT};if(n)St[Kr]=s.MIN,St[Zr]=s.MAX;else{const C=t.get("EXT_blend_minmax");C!==null&&(St[Kr]=C.MIN_EXT,St[Zr]=C.MAX_EXT)}const Rt={[Tl]:s.ZERO,[Al]:s.ONE,[wl]:s.SRC_COLOR,[_r]:s.SRC_ALPHA,[Il]:s.SRC_ALPHA_SATURATE,[Ll]:s.DST_COLOR,[Cl]:s.DST_ALPHA,[Rl]:s.ONE_MINUS_SRC_COLOR,[vr]:s.ONE_MINUS_SRC_ALPHA,[Dl]:s.ONE_MINUS_DST_COLOR,[Pl]:s.ONE_MINUS_DST_ALPHA,[Ul]:s.CONSTANT_COLOR,[Nl]:s.ONE_MINUS_CONSTANT_COLOR,[Fl]:s.CONSTANT_ALPHA,[Ol]:s.ONE_MINUS_CONSTANT_ALPHA};function pt(C,it,ot,At,yt,Wt,Xt,te,ne,$t){if(C===gn){h===!0&&(Tt(s.BLEND),h=!1);return}if(h===!1&&(Dt(s.BLEND),h=!0),C!==yl){if(C!==E||$t!==k){if((x!==Pn||R!==Pn)&&(s.blendEquation(s.FUNC_ADD),x=Pn,R=Pn),$t)switch(C){case fi:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case qr:s.blendFunc(s.ONE,s.ONE);break;case jr:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Yr:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",C);break}else switch(C){case fi:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case qr:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case jr:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Yr:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",C);break}T=null,D=null,w=null,W=null,S.set(0,0,0),b=0,E=C,k=$t}return}yt=yt||it,Wt=Wt||ot,Xt=Xt||At,(it!==x||yt!==R)&&(s.blendEquationSeparate(St[it],St[yt]),x=it,R=yt),(ot!==T||At!==D||Wt!==w||Xt!==W)&&(s.blendFuncSeparate(Rt[ot],Rt[At],Rt[Wt],Rt[Xt]),T=ot,D=At,w=Wt,W=Xt),(te.equals(S)===!1||ne!==b)&&(s.blendColor(te.r,te.g,te.b,ne),S.copy(te),b=ne),E=C,k=!1}function Kt(C,it){C.side===Oe?Tt(s.CULL_FACE):Dt(s.CULL_FACE);let ot=C.side===Te;it&&(ot=!ot),Ut(ot),C.blending===fi&&C.transparent===!1?pt(gn):pt(C.blending,C.blendEquation,C.blendSrc,C.blendDst,C.blendEquationAlpha,C.blendSrcAlpha,C.blendDstAlpha,C.blendColor,C.blendAlpha,C.premultipliedAlpha),l.setFunc(C.depthFunc),l.setTest(C.depthTest),l.setMask(C.depthWrite),o.setMask(C.colorWrite);const At=C.stencilWrite;c.setTest(At),At&&(c.setMask(C.stencilWriteMask),c.setFunc(C.stencilFunc,C.stencilRef,C.stencilFuncMask),c.setOp(C.stencilFail,C.stencilZFail,C.stencilZPass)),U(C.polygonOffset,C.polygonOffsetFactor,C.polygonOffsetUnits),C.alphaToCoverage===!0?Dt(s.SAMPLE_ALPHA_TO_COVERAGE):Tt(s.SAMPLE_ALPHA_TO_COVERAGE)}function Ut(C){V!==C&&(C?s.frontFace(s.CW):s.frontFace(s.CCW),V=C)}function y(C){C!==Ml?(Dt(s.CULL_FACE),C!==Q&&(C===$r?s.cullFace(s.BACK):C===Sl?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):Tt(s.CULL_FACE),Q=C}function v(C){C!==P&&(X&&s.lineWidth(C),P=C)}function U(C,it,ot){C?(Dt(s.POLYGON_OFFSET_FILL),(F!==it||H!==ot)&&(s.polygonOffset(it,ot),F=it,H=ot)):Tt(s.POLYGON_OFFSET_FILL)}function tt(C){C?Dt(s.SCISSOR_TEST):Tt(s.SCISSOR_TEST)}function Z(C){C===void 0&&(C=s.TEXTURE0+q-1),st!==C&&(s.activeTexture(C),st=C)}function et(C,it,ot){ot===void 0&&(st===null?ot=s.TEXTURE0+q-1:ot=st);let At=rt[ot];At===void 0&&(At={type:void 0,texture:void 0},rt[ot]=At),(At.type!==C||At.texture!==it)&&(st!==ot&&(s.activeTexture(ot),st=ot),s.bindTexture(C,it||Lt[C]),At.type=C,At.texture=it)}function mt(){const C=rt[st];C!==void 0&&C.type!==void 0&&(s.bindTexture(C.type,null),C.type=void 0,C.texture=void 0)}function lt(){try{s.compressedTexImage2D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function ft(){try{s.compressedTexImage3D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function bt(){try{s.texSubImage2D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function Nt(){try{s.texSubImage3D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function K(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function qt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function zt(){try{s.texStorage2D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function Ct(){try{s.texStorage3D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function Mt(){try{s.texImage2D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function dt(){try{s.texImage3D.apply(s,arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function A(C){ct.equals(C)===!1&&(s.scissor(C.x,C.y,C.z,C.w),ct.copy(C))}function nt(C){vt.equals(C)===!1&&(s.viewport(C.x,C.y,C.z,C.w),vt.copy(C))}function _t(C,it){let ot=u.get(it);ot===void 0&&(ot=new WeakMap,u.set(it,ot));let At=ot.get(C);At===void 0&&(At=s.getUniformBlockIndex(it,C.name),ot.set(C,At))}function ut(C,it){const At=u.get(it).get(C);d.get(it)!==At&&(s.uniformBlockBinding(it,At,C.__bindingPointIndex),d.set(it,At))}function J(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),n===!0&&(s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null)),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),p={},st=null,rt={},m={},g=new WeakMap,_=[],f=null,h=!1,E=null,x=null,T=null,D=null,R=null,w=null,W=null,S=new Bt(0,0,0),b=0,k=!1,V=null,Q=null,P=null,F=null,H=null,ct.set(0,0,s.canvas.width,s.canvas.height),vt.set(0,0,s.canvas.width,s.canvas.height),o.reset(),l.reset(),c.reset()}return{buffers:{color:o,depth:l,stencil:c},enable:Dt,disable:Tt,bindFramebuffer:Gt,drawBuffers:N,useProgram:ge,setBlending:pt,setMaterial:Kt,setFlipSided:Ut,setCullFace:y,setLineWidth:v,setPolygonOffset:U,setScissorTest:tt,activeTexture:Z,bindTexture:et,unbindTexture:mt,compressedTexImage2D:lt,compressedTexImage3D:ft,texImage2D:Mt,texImage3D:dt,updateUBOMapping:_t,uniformBlockBinding:ut,texStorage2D:zt,texStorage3D:Ct,texSubImage2D:bt,texSubImage3D:Nt,compressedTexSubImage2D:K,compressedTexSubImage3D:qt,scissor:A,viewport:nt,reset:J}}function vp(s,t,e,n,i,r,a){const o=i.isWebGL2,l=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),d=new WeakMap;let u;const p=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(y,v){return m?new OffscreenCanvas(y,v):Ms("canvas")}function _(y,v,U,tt){let Z=1;if((y.width>tt||y.height>tt)&&(Z=tt/Math.max(y.width,y.height)),Z<1||v===!0)if(typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&y instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&y instanceof ImageBitmap){const et=v?Ar:Math.floor,mt=et(Z*y.width),lt=et(Z*y.height);u===void 0&&(u=g(mt,lt));const ft=U?g(mt,lt):u;return ft.width=mt,ft.height=lt,ft.getContext("2d").drawImage(y,0,0,mt,lt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+y.width+"x"+y.height+") to ("+mt+"x"+lt+")."),ft}else return"data"in y&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+y.width+"x"+y.height+")."),y;return y}function f(y){return Aa(y.width)&&Aa(y.height)}function h(y){return o?!1:y.wrapS!==Xe||y.wrapT!==Xe||y.minFilter!==ye&&y.minFilter!==Ue}function E(y,v){return y.generateMipmaps&&v&&y.minFilter!==ye&&y.minFilter!==Ue}function x(y){s.generateMipmap(y)}function T(y,v,U,tt,Z=!1){if(o===!1)return v;if(y!==null){if(s[y]!==void 0)return s[y];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+y+"'")}let et=v;if(v===s.RED&&(U===s.FLOAT&&(et=s.R32F),U===s.HALF_FLOAT&&(et=s.R16F),U===s.UNSIGNED_BYTE&&(et=s.R8)),v===s.RED_INTEGER&&(U===s.UNSIGNED_BYTE&&(et=s.R8UI),U===s.UNSIGNED_SHORT&&(et=s.R16UI),U===s.UNSIGNED_INT&&(et=s.R32UI),U===s.BYTE&&(et=s.R8I),U===s.SHORT&&(et=s.R16I),U===s.INT&&(et=s.R32I)),v===s.RG&&(U===s.FLOAT&&(et=s.RG32F),U===s.HALF_FLOAT&&(et=s.RG16F),U===s.UNSIGNED_BYTE&&(et=s.RG8)),v===s.RGBA){const mt=Z?gs:jt.getTransfer(tt);U===s.FLOAT&&(et=s.RGBA32F),U===s.HALF_FLOAT&&(et=s.RGBA16F),U===s.UNSIGNED_BYTE&&(et=mt===Zt?s.SRGB8_ALPHA8:s.RGBA8),U===s.UNSIGNED_SHORT_4_4_4_4&&(et=s.RGBA4),U===s.UNSIGNED_SHORT_5_5_5_1&&(et=s.RGB5_A1)}return(et===s.R16F||et===s.R32F||et===s.RG16F||et===s.RG32F||et===s.RGBA16F||et===s.RGBA32F)&&t.get("EXT_color_buffer_float"),et}function D(y,v,U){return E(y,U)===!0||y.isFramebufferTexture&&y.minFilter!==ye&&y.minFilter!==Ue?Math.log2(Math.max(v.width,v.height))+1:y.mipmaps!==void 0&&y.mipmaps.length>0?y.mipmaps.length:y.isCompressedTexture&&Array.isArray(y.image)?v.mipmaps.length:1}function R(y){return y===ye||y===Jr||y===Us?s.NEAREST:s.LINEAR}function w(y){const v=y.target;v.removeEventListener("dispose",w),S(v),v.isVideoTexture&&d.delete(v)}function W(y){const v=y.target;v.removeEventListener("dispose",W),k(v)}function S(y){const v=n.get(y);if(v.__webglInit===void 0)return;const U=y.source,tt=p.get(U);if(tt){const Z=tt[v.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&b(y),Object.keys(tt).length===0&&p.delete(U)}n.remove(y)}function b(y){const v=n.get(y);s.deleteTexture(v.__webglTexture);const U=y.source,tt=p.get(U);delete tt[v.__cacheKey],a.memory.textures--}function k(y){const v=y.texture,U=n.get(y),tt=n.get(v);if(tt.__webglTexture!==void 0&&(s.deleteTexture(tt.__webglTexture),a.memory.textures--),y.depthTexture&&y.depthTexture.dispose(),y.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(U.__webglFramebuffer[Z]))for(let et=0;et<U.__webglFramebuffer[Z].length;et++)s.deleteFramebuffer(U.__webglFramebuffer[Z][et]);else s.deleteFramebuffer(U.__webglFramebuffer[Z]);U.__webglDepthbuffer&&s.deleteRenderbuffer(U.__webglDepthbuffer[Z])}else{if(Array.isArray(U.__webglFramebuffer))for(let Z=0;Z<U.__webglFramebuffer.length;Z++)s.deleteFramebuffer(U.__webglFramebuffer[Z]);else s.deleteFramebuffer(U.__webglFramebuffer);if(U.__webglDepthbuffer&&s.deleteRenderbuffer(U.__webglDepthbuffer),U.__webglMultisampledFramebuffer&&s.deleteFramebuffer(U.__webglMultisampledFramebuffer),U.__webglColorRenderbuffer)for(let Z=0;Z<U.__webglColorRenderbuffer.length;Z++)U.__webglColorRenderbuffer[Z]&&s.deleteRenderbuffer(U.__webglColorRenderbuffer[Z]);U.__webglDepthRenderbuffer&&s.deleteRenderbuffer(U.__webglDepthRenderbuffer)}if(y.isWebGLMultipleRenderTargets)for(let Z=0,et=v.length;Z<et;Z++){const mt=n.get(v[Z]);mt.__webglTexture&&(s.deleteTexture(mt.__webglTexture),a.memory.textures--),n.remove(v[Z])}n.remove(v),n.remove(y)}let V=0;function Q(){V=0}function P(){const y=V;return y>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+y+" texture units while this GPU supports only "+i.maxTextures),V+=1,y}function F(y){const v=[];return v.push(y.wrapS),v.push(y.wrapT),v.push(y.wrapR||0),v.push(y.magFilter),v.push(y.minFilter),v.push(y.anisotropy),v.push(y.internalFormat),v.push(y.format),v.push(y.type),v.push(y.generateMipmaps),v.push(y.premultiplyAlpha),v.push(y.flipY),v.push(y.unpackAlignment),v.push(y.colorSpace),v.join()}function H(y,v){const U=n.get(y);if(y.isVideoTexture&&Kt(y),y.isRenderTargetTexture===!1&&y.version>0&&U.__version!==y.version){const tt=y.image;if(tt===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(tt.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{ct(U,y,v);return}}e.bindTexture(s.TEXTURE_2D,U.__webglTexture,s.TEXTURE0+v)}function q(y,v){const U=n.get(y);if(y.version>0&&U.__version!==y.version){ct(U,y,v);return}e.bindTexture(s.TEXTURE_2D_ARRAY,U.__webglTexture,s.TEXTURE0+v)}function X(y,v){const U=n.get(y);if(y.version>0&&U.__version!==y.version){ct(U,y,v);return}e.bindTexture(s.TEXTURE_3D,U.__webglTexture,s.TEXTURE0+v)}function $(y,v){const U=n.get(y);if(y.version>0&&U.__version!==y.version){vt(U,y,v);return}e.bindTexture(s.TEXTURE_CUBE_MAP,U.__webglTexture,s.TEXTURE0+v)}const j={[Sr]:s.REPEAT,[Xe]:s.CLAMP_TO_EDGE,[yr]:s.MIRRORED_REPEAT},st={[ye]:s.NEAREST,[Jr]:s.NEAREST_MIPMAP_NEAREST,[Us]:s.NEAREST_MIPMAP_LINEAR,[Ue]:s.LINEAR,[Jl]:s.LINEAR_MIPMAP_NEAREST,[Ui]:s.LINEAR_MIPMAP_LINEAR},rt={[dc]:s.NEVER,[gc]:s.ALWAYS,[hc]:s.LESS,[$o]:s.LEQUAL,[uc]:s.EQUAL,[mc]:s.GEQUAL,[fc]:s.GREATER,[pc]:s.NOTEQUAL};function G(y,v,U){if(U?(s.texParameteri(y,s.TEXTURE_WRAP_S,j[v.wrapS]),s.texParameteri(y,s.TEXTURE_WRAP_T,j[v.wrapT]),(y===s.TEXTURE_3D||y===s.TEXTURE_2D_ARRAY)&&s.texParameteri(y,s.TEXTURE_WRAP_R,j[v.wrapR]),s.texParameteri(y,s.TEXTURE_MAG_FILTER,st[v.magFilter]),s.texParameteri(y,s.TEXTURE_MIN_FILTER,st[v.minFilter])):(s.texParameteri(y,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(y,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),(y===s.TEXTURE_3D||y===s.TEXTURE_2D_ARRAY)&&s.texParameteri(y,s.TEXTURE_WRAP_R,s.CLAMP_TO_EDGE),(v.wrapS!==Xe||v.wrapT!==Xe)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),s.texParameteri(y,s.TEXTURE_MAG_FILTER,R(v.magFilter)),s.texParameteri(y,s.TEXTURE_MIN_FILTER,R(v.minFilter)),v.minFilter!==ye&&v.minFilter!==Ue&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),v.compareFunction&&(s.texParameteri(y,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(y,s.TEXTURE_COMPARE_FUNC,rt[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){const tt=t.get("EXT_texture_filter_anisotropic");if(v.magFilter===ye||v.minFilter!==Us&&v.minFilter!==Ui||v.type===pn&&t.has("OES_texture_float_linear")===!1||o===!1&&v.type===Ni&&t.has("OES_texture_half_float_linear")===!1)return;(v.anisotropy>1||n.get(v).__currentAnisotropy)&&(s.texParameterf(y,tt.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,i.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy)}}function Y(y,v){let U=!1;y.__webglInit===void 0&&(y.__webglInit=!0,v.addEventListener("dispose",w));const tt=v.source;let Z=p.get(tt);Z===void 0&&(Z={},p.set(tt,Z));const et=F(v);if(et!==y.__cacheKey){Z[et]===void 0&&(Z[et]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,U=!0),Z[et].usedTimes++;const mt=Z[y.__cacheKey];mt!==void 0&&(Z[y.__cacheKey].usedTimes--,mt.usedTimes===0&&b(v)),y.__cacheKey=et,y.__webglTexture=Z[et].texture}return U}function ct(y,v,U){let tt=s.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(tt=s.TEXTURE_2D_ARRAY),v.isData3DTexture&&(tt=s.TEXTURE_3D);const Z=Y(y,v),et=v.source;e.bindTexture(tt,y.__webglTexture,s.TEXTURE0+U);const mt=n.get(et);if(et.version!==mt.__version||Z===!0){e.activeTexture(s.TEXTURE0+U);const lt=jt.getPrimaries(jt.workingColorSpace),ft=v.colorSpace===Be?null:jt.getPrimaries(v.colorSpace),bt=v.colorSpace===Be||lt===ft?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,bt);const Nt=h(v)&&f(v.image)===!1;let K=_(v.image,Nt,!1,i.maxTextureSize);K=Ut(v,K);const qt=f(K)||o,zt=r.convert(v.format,v.colorSpace);let Ct=r.convert(v.type),Mt=T(v.internalFormat,zt,Ct,v.colorSpace,v.isVideoTexture);G(tt,v,qt);let dt;const A=v.mipmaps,nt=o&&v.isVideoTexture!==!0&&Mt!==Go,_t=mt.__version===void 0||Z===!0,ut=D(v,K,qt);if(v.isDepthTexture)Mt=s.DEPTH_COMPONENT,o?v.type===pn?Mt=s.DEPTH_COMPONENT32F:v.type===fn?Mt=s.DEPTH_COMPONENT24:v.type===In?Mt=s.DEPTH24_STENCIL8:Mt=s.DEPTH_COMPONENT16:v.type===pn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),v.format===Un&&Mt===s.DEPTH_COMPONENT&&v.type!==Pr&&v.type!==fn&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),v.type=fn,Ct=r.convert(v.type)),v.format===xi&&Mt===s.DEPTH_COMPONENT&&(Mt=s.DEPTH_STENCIL,v.type!==In&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),v.type=In,Ct=r.convert(v.type))),_t&&(nt?e.texStorage2D(s.TEXTURE_2D,1,Mt,K.width,K.height):e.texImage2D(s.TEXTURE_2D,0,Mt,K.width,K.height,0,zt,Ct,null));else if(v.isDataTexture)if(A.length>0&&qt){nt&&_t&&e.texStorage2D(s.TEXTURE_2D,ut,Mt,A[0].width,A[0].height);for(let J=0,C=A.length;J<C;J++)dt=A[J],nt?e.texSubImage2D(s.TEXTURE_2D,J,0,0,dt.width,dt.height,zt,Ct,dt.data):e.texImage2D(s.TEXTURE_2D,J,Mt,dt.width,dt.height,0,zt,Ct,dt.data);v.generateMipmaps=!1}else nt?(_t&&e.texStorage2D(s.TEXTURE_2D,ut,Mt,K.width,K.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,K.width,K.height,zt,Ct,K.data)):e.texImage2D(s.TEXTURE_2D,0,Mt,K.width,K.height,0,zt,Ct,K.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){nt&&_t&&e.texStorage3D(s.TEXTURE_2D_ARRAY,ut,Mt,A[0].width,A[0].height,K.depth);for(let J=0,C=A.length;J<C;J++)dt=A[J],v.format!==$e?zt!==null?nt?e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,J,0,0,0,dt.width,dt.height,K.depth,zt,dt.data,0,0):e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,J,Mt,dt.width,dt.height,K.depth,0,dt.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):nt?e.texSubImage3D(s.TEXTURE_2D_ARRAY,J,0,0,0,dt.width,dt.height,K.depth,zt,Ct,dt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,J,Mt,dt.width,dt.height,K.depth,0,zt,Ct,dt.data)}else{nt&&_t&&e.texStorage2D(s.TEXTURE_2D,ut,Mt,A[0].width,A[0].height);for(let J=0,C=A.length;J<C;J++)dt=A[J],v.format!==$e?zt!==null?nt?e.compressedTexSubImage2D(s.TEXTURE_2D,J,0,0,dt.width,dt.height,zt,dt.data):e.compressedTexImage2D(s.TEXTURE_2D,J,Mt,dt.width,dt.height,0,dt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):nt?e.texSubImage2D(s.TEXTURE_2D,J,0,0,dt.width,dt.height,zt,Ct,dt.data):e.texImage2D(s.TEXTURE_2D,J,Mt,dt.width,dt.height,0,zt,Ct,dt.data)}else if(v.isDataArrayTexture)nt?(_t&&e.texStorage3D(s.TEXTURE_2D_ARRAY,ut,Mt,K.width,K.height,K.depth),e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,zt,Ct,K.data)):e.texImage3D(s.TEXTURE_2D_ARRAY,0,Mt,K.width,K.height,K.depth,0,zt,Ct,K.data);else if(v.isData3DTexture)nt?(_t&&e.texStorage3D(s.TEXTURE_3D,ut,Mt,K.width,K.height,K.depth),e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,zt,Ct,K.data)):e.texImage3D(s.TEXTURE_3D,0,Mt,K.width,K.height,K.depth,0,zt,Ct,K.data);else if(v.isFramebufferTexture){if(_t)if(nt)e.texStorage2D(s.TEXTURE_2D,ut,Mt,K.width,K.height);else{let J=K.width,C=K.height;for(let it=0;it<ut;it++)e.texImage2D(s.TEXTURE_2D,it,Mt,J,C,0,zt,Ct,null),J>>=1,C>>=1}}else if(A.length>0&&qt){nt&&_t&&e.texStorage2D(s.TEXTURE_2D,ut,Mt,A[0].width,A[0].height);for(let J=0,C=A.length;J<C;J++)dt=A[J],nt?e.texSubImage2D(s.TEXTURE_2D,J,0,0,zt,Ct,dt):e.texImage2D(s.TEXTURE_2D,J,Mt,zt,Ct,dt);v.generateMipmaps=!1}else nt?(_t&&e.texStorage2D(s.TEXTURE_2D,ut,Mt,K.width,K.height),e.texSubImage2D(s.TEXTURE_2D,0,0,0,zt,Ct,K)):e.texImage2D(s.TEXTURE_2D,0,Mt,zt,Ct,K);E(v,qt)&&x(tt),mt.__version=et.version,v.onUpdate&&v.onUpdate(v)}y.__version=v.version}function vt(y,v,U){if(v.image.length!==6)return;const tt=Y(y,v),Z=v.source;e.bindTexture(s.TEXTURE_CUBE_MAP,y.__webglTexture,s.TEXTURE0+U);const et=n.get(Z);if(Z.version!==et.__version||tt===!0){e.activeTexture(s.TEXTURE0+U);const mt=jt.getPrimaries(jt.workingColorSpace),lt=v.colorSpace===Be?null:jt.getPrimaries(v.colorSpace),ft=v.colorSpace===Be||mt===lt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,ft);const bt=v.isCompressedTexture||v.image[0].isCompressedTexture,Nt=v.image[0]&&v.image[0].isDataTexture,K=[];for(let J=0;J<6;J++)!bt&&!Nt?K[J]=_(v.image[J],!1,!0,i.maxCubemapSize):K[J]=Nt?v.image[J].image:v.image[J],K[J]=Ut(v,K[J]);const qt=K[0],zt=f(qt)||o,Ct=r.convert(v.format,v.colorSpace),Mt=r.convert(v.type),dt=T(v.internalFormat,Ct,Mt,v.colorSpace),A=o&&v.isVideoTexture!==!0,nt=et.__version===void 0||tt===!0;let _t=D(v,qt,zt);G(s.TEXTURE_CUBE_MAP,v,zt);let ut;if(bt){A&&nt&&e.texStorage2D(s.TEXTURE_CUBE_MAP,_t,dt,qt.width,qt.height);for(let J=0;J<6;J++){ut=K[J].mipmaps;for(let C=0;C<ut.length;C++){const it=ut[C];v.format!==$e?Ct!==null?A?e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C,0,0,it.width,it.height,Ct,it.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C,dt,it.width,it.height,0,it.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):A?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C,0,0,it.width,it.height,Ct,Mt,it.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C,dt,it.width,it.height,0,Ct,Mt,it.data)}}}else{ut=v.mipmaps,A&&nt&&(ut.length>0&&_t++,e.texStorage2D(s.TEXTURE_CUBE_MAP,_t,dt,K[0].width,K[0].height));for(let J=0;J<6;J++)if(Nt){A?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,K[J].width,K[J].height,Ct,Mt,K[J].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,dt,K[J].width,K[J].height,0,Ct,Mt,K[J].data);for(let C=0;C<ut.length;C++){const ot=ut[C].image[J].image;A?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C+1,0,0,ot.width,ot.height,Ct,Mt,ot.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C+1,dt,ot.width,ot.height,0,Ct,Mt,ot.data)}}else{A?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,Ct,Mt,K[J]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,dt,Ct,Mt,K[J]);for(let C=0;C<ut.length;C++){const it=ut[C];A?e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C+1,0,0,Ct,Mt,it.image[J]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,C+1,dt,Ct,Mt,it.image[J])}}}E(v,zt)&&x(s.TEXTURE_CUBE_MAP),et.__version=Z.version,v.onUpdate&&v.onUpdate(v)}y.__version=v.version}function gt(y,v,U,tt,Z,et){const mt=r.convert(U.format,U.colorSpace),lt=r.convert(U.type),ft=T(U.internalFormat,mt,lt,U.colorSpace);if(!n.get(v).__hasExternalTextures){const Nt=Math.max(1,v.width>>et),K=Math.max(1,v.height>>et);Z===s.TEXTURE_3D||Z===s.TEXTURE_2D_ARRAY?e.texImage3D(Z,et,ft,Nt,K,v.depth,0,mt,lt,null):e.texImage2D(Z,et,ft,Nt,K,0,mt,lt,null)}e.bindFramebuffer(s.FRAMEBUFFER,y),pt(v)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,tt,Z,n.get(U).__webglTexture,0,Rt(v)):(Z===s.TEXTURE_2D||Z>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,tt,Z,n.get(U).__webglTexture,et),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Lt(y,v,U){if(s.bindRenderbuffer(s.RENDERBUFFER,y),v.depthBuffer&&!v.stencilBuffer){let tt=o===!0?s.DEPTH_COMPONENT24:s.DEPTH_COMPONENT16;if(U||pt(v)){const Z=v.depthTexture;Z&&Z.isDepthTexture&&(Z.type===pn?tt=s.DEPTH_COMPONENT32F:Z.type===fn&&(tt=s.DEPTH_COMPONENT24));const et=Rt(v);pt(v)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,et,tt,v.width,v.height):s.renderbufferStorageMultisample(s.RENDERBUFFER,et,tt,v.width,v.height)}else s.renderbufferStorage(s.RENDERBUFFER,tt,v.width,v.height);s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.RENDERBUFFER,y)}else if(v.depthBuffer&&v.stencilBuffer){const tt=Rt(v);U&&pt(v)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,tt,s.DEPTH24_STENCIL8,v.width,v.height):pt(v)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,tt,s.DEPTH24_STENCIL8,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,s.DEPTH_STENCIL,v.width,v.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.RENDERBUFFER,y)}else{const tt=v.isWebGLMultipleRenderTargets===!0?v.texture:[v.texture];for(let Z=0;Z<tt.length;Z++){const et=tt[Z],mt=r.convert(et.format,et.colorSpace),lt=r.convert(et.type),ft=T(et.internalFormat,mt,lt,et.colorSpace),bt=Rt(v);U&&pt(v)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,bt,ft,v.width,v.height):pt(v)?l.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,bt,ft,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,ft,v.width,v.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Dt(y,v){if(v&&v.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,y),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(v.depthTexture).__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),H(v.depthTexture,0);const tt=n.get(v.depthTexture).__webglTexture,Z=Rt(v);if(v.depthTexture.format===Un)pt(v)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,tt,0,Z):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,tt,0);else if(v.depthTexture.format===xi)pt(v)?l.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,tt,0,Z):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,tt,0);else throw new Error("Unknown depthTexture format")}function Tt(y){const v=n.get(y),U=y.isWebGLCubeRenderTarget===!0;if(y.depthTexture&&!v.__autoAllocateDepthBuffer){if(U)throw new Error("target.depthTexture not supported in Cube render targets");Dt(v.__webglFramebuffer,y)}else if(U){v.__webglDepthbuffer=[];for(let tt=0;tt<6;tt++)e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[tt]),v.__webglDepthbuffer[tt]=s.createRenderbuffer(),Lt(v.__webglDepthbuffer[tt],y,!1)}else e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer=s.createRenderbuffer(),Lt(v.__webglDepthbuffer,y,!1);e.bindFramebuffer(s.FRAMEBUFFER,null)}function Gt(y,v,U){const tt=n.get(y);v!==void 0&&gt(tt.__webglFramebuffer,y,y.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),U!==void 0&&Tt(y)}function N(y){const v=y.texture,U=n.get(y),tt=n.get(v);y.addEventListener("dispose",W),y.isWebGLMultipleRenderTargets!==!0&&(tt.__webglTexture===void 0&&(tt.__webglTexture=s.createTexture()),tt.__version=v.version,a.memory.textures++);const Z=y.isWebGLCubeRenderTarget===!0,et=y.isWebGLMultipleRenderTargets===!0,mt=f(y)||o;if(Z){U.__webglFramebuffer=[];for(let lt=0;lt<6;lt++)if(o&&v.mipmaps&&v.mipmaps.length>0){U.__webglFramebuffer[lt]=[];for(let ft=0;ft<v.mipmaps.length;ft++)U.__webglFramebuffer[lt][ft]=s.createFramebuffer()}else U.__webglFramebuffer[lt]=s.createFramebuffer()}else{if(o&&v.mipmaps&&v.mipmaps.length>0){U.__webglFramebuffer=[];for(let lt=0;lt<v.mipmaps.length;lt++)U.__webglFramebuffer[lt]=s.createFramebuffer()}else U.__webglFramebuffer=s.createFramebuffer();if(et)if(i.drawBuffers){const lt=y.texture;for(let ft=0,bt=lt.length;ft<bt;ft++){const Nt=n.get(lt[ft]);Nt.__webglTexture===void 0&&(Nt.__webglTexture=s.createTexture(),a.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&y.samples>0&&pt(y)===!1){const lt=et?v:[v];U.__webglMultisampledFramebuffer=s.createFramebuffer(),U.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let ft=0;ft<lt.length;ft++){const bt=lt[ft];U.__webglColorRenderbuffer[ft]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,U.__webglColorRenderbuffer[ft]);const Nt=r.convert(bt.format,bt.colorSpace),K=r.convert(bt.type),qt=T(bt.internalFormat,Nt,K,bt.colorSpace,y.isXRRenderTarget===!0),zt=Rt(y);s.renderbufferStorageMultisample(s.RENDERBUFFER,zt,qt,y.width,y.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ft,s.RENDERBUFFER,U.__webglColorRenderbuffer[ft])}s.bindRenderbuffer(s.RENDERBUFFER,null),y.depthBuffer&&(U.__webglDepthRenderbuffer=s.createRenderbuffer(),Lt(U.__webglDepthRenderbuffer,y,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(Z){e.bindTexture(s.TEXTURE_CUBE_MAP,tt.__webglTexture),G(s.TEXTURE_CUBE_MAP,v,mt);for(let lt=0;lt<6;lt++)if(o&&v.mipmaps&&v.mipmaps.length>0)for(let ft=0;ft<v.mipmaps.length;ft++)gt(U.__webglFramebuffer[lt][ft],y,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,ft);else gt(U.__webglFramebuffer[lt],y,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0);E(v,mt)&&x(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(et){const lt=y.texture;for(let ft=0,bt=lt.length;ft<bt;ft++){const Nt=lt[ft],K=n.get(Nt);e.bindTexture(s.TEXTURE_2D,K.__webglTexture),G(s.TEXTURE_2D,Nt,mt),gt(U.__webglFramebuffer,y,Nt,s.COLOR_ATTACHMENT0+ft,s.TEXTURE_2D,0),E(Nt,mt)&&x(s.TEXTURE_2D)}e.unbindTexture()}else{let lt=s.TEXTURE_2D;if((y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(o?lt=y.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),e.bindTexture(lt,tt.__webglTexture),G(lt,v,mt),o&&v.mipmaps&&v.mipmaps.length>0)for(let ft=0;ft<v.mipmaps.length;ft++)gt(U.__webglFramebuffer[ft],y,v,s.COLOR_ATTACHMENT0,lt,ft);else gt(U.__webglFramebuffer,y,v,s.COLOR_ATTACHMENT0,lt,0);E(v,mt)&&x(lt),e.unbindTexture()}y.depthBuffer&&Tt(y)}function ge(y){const v=f(y)||o,U=y.isWebGLMultipleRenderTargets===!0?y.texture:[y.texture];for(let tt=0,Z=U.length;tt<Z;tt++){const et=U[tt];if(E(et,v)){const mt=y.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:s.TEXTURE_2D,lt=n.get(et).__webglTexture;e.bindTexture(mt,lt),x(mt),e.unbindTexture()}}}function St(y){if(o&&y.samples>0&&pt(y)===!1){const v=y.isWebGLMultipleRenderTargets?y.texture:[y.texture],U=y.width,tt=y.height;let Z=s.COLOR_BUFFER_BIT;const et=[],mt=y.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,lt=n.get(y),ft=y.isWebGLMultipleRenderTargets===!0;if(ft)for(let bt=0;bt<v.length;bt++)e.bindFramebuffer(s.FRAMEBUFFER,lt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,lt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,lt.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,lt.__webglFramebuffer);for(let bt=0;bt<v.length;bt++){et.push(s.COLOR_ATTACHMENT0+bt),y.depthBuffer&&et.push(mt);const Nt=lt.__ignoreDepthValues!==void 0?lt.__ignoreDepthValues:!1;if(Nt===!1&&(y.depthBuffer&&(Z|=s.DEPTH_BUFFER_BIT),y.stencilBuffer&&(Z|=s.STENCIL_BUFFER_BIT)),ft&&s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,lt.__webglColorRenderbuffer[bt]),Nt===!0&&(s.invalidateFramebuffer(s.READ_FRAMEBUFFER,[mt]),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[mt])),ft){const K=n.get(v[bt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,K,0)}s.blitFramebuffer(0,0,U,tt,0,0,U,tt,Z,s.NEAREST),c&&s.invalidateFramebuffer(s.READ_FRAMEBUFFER,et)}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),ft)for(let bt=0;bt<v.length;bt++){e.bindFramebuffer(s.FRAMEBUFFER,lt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.RENDERBUFFER,lt.__webglColorRenderbuffer[bt]);const Nt=n.get(v[bt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,lt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+bt,s.TEXTURE_2D,Nt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,lt.__webglMultisampledFramebuffer)}}function Rt(y){return Math.min(i.maxSamples,y.samples)}function pt(y){const v=n.get(y);return o&&y.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function Kt(y){const v=a.render.frame;d.get(y)!==v&&(d.set(y,v),y.update())}function Ut(y,v){const U=y.colorSpace,tt=y.format,Z=y.type;return y.isCompressedTexture===!0||y.isVideoTexture===!0||y.format===br||U!==an&&U!==Be&&(jt.getTransfer(U)===Zt?o===!1?t.has("EXT_sRGB")===!0&&tt===$e?(y.format=br,y.minFilter=Ue,y.generateMipmaps=!1):v=jo.sRGBToLinear(v):(tt!==$e||Z!==vn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",U)),v}this.allocateTextureUnit=P,this.resetTextureUnits=Q,this.setTexture2D=H,this.setTexture2DArray=q,this.setTexture3D=X,this.setTextureCube=$,this.rebindTextures=Gt,this.setupRenderTarget=N,this.updateRenderTargetMipmap=ge,this.updateMultisampleRenderTarget=St,this.setupDepthRenderbuffer=Tt,this.setupFrameBufferTexture=gt,this.useMultisampledRTT=pt}function xp(s,t,e){const n=e.isWebGL2;function i(r,a=Be){let o;const l=jt.getTransfer(a);if(r===vn)return s.UNSIGNED_BYTE;if(r===Bo)return s.UNSIGNED_SHORT_4_4_4_4;if(r===zo)return s.UNSIGNED_SHORT_5_5_5_1;if(r===Ql)return s.BYTE;if(r===tc)return s.SHORT;if(r===Pr)return s.UNSIGNED_SHORT;if(r===Oo)return s.INT;if(r===fn)return s.UNSIGNED_INT;if(r===pn)return s.FLOAT;if(r===Ni)return n?s.HALF_FLOAT:(o=t.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(r===ec)return s.ALPHA;if(r===$e)return s.RGBA;if(r===nc)return s.LUMINANCE;if(r===ic)return s.LUMINANCE_ALPHA;if(r===Un)return s.DEPTH_COMPONENT;if(r===xi)return s.DEPTH_STENCIL;if(r===br)return o=t.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(r===sc)return s.RED;if(r===Ho)return s.RED_INTEGER;if(r===rc)return s.RG;if(r===ko)return s.RG_INTEGER;if(r===Vo)return s.RGBA_INTEGER;if(r===Ns||r===Fs||r===Os||r===Bs)if(l===Zt)if(o=t.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(r===Ns)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(r===Fs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(r===Os)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(r===Bs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=t.get("WEBGL_compressed_texture_s3tc"),o!==null){if(r===Ns)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(r===Fs)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(r===Os)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(r===Bs)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(r===Qr||r===ta||r===ea||r===na)if(o=t.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(r===Qr)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(r===ta)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(r===ea)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(r===na)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(r===Go)return o=t.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(r===ia||r===sa)if(o=t.get("WEBGL_compressed_texture_etc"),o!==null){if(r===ia)return l===Zt?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(r===sa)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(r===ra||r===aa||r===oa||r===la||r===ca||r===da||r===ha||r===ua||r===fa||r===pa||r===ma||r===ga||r===_a||r===va)if(o=t.get("WEBGL_compressed_texture_astc"),o!==null){if(r===ra)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(r===aa)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(r===oa)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(r===la)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(r===ca)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(r===da)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(r===ha)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(r===ua)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(r===fa)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(r===pa)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(r===ma)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(r===ga)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(r===_a)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(r===va)return l===Zt?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(r===zs||r===xa||r===Ma)if(o=t.get("EXT_texture_compression_bptc"),o!==null){if(r===zs)return l===Zt?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(r===xa)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(r===Ma)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(r===ac||r===Sa||r===ya||r===Ea)if(o=t.get("EXT_texture_compression_rgtc"),o!==null){if(r===zs)return o.COMPRESSED_RED_RGTC1_EXT;if(r===Sa)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(r===ya)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(r===Ea)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return r===In?n?s.UNSIGNED_INT_24_8:(o=t.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):s[r]!==void 0?s[r]:null}return{convert:i}}class Mp extends Fe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Dn extends ce{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Sp={type:"move"};class cr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Dn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Dn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Dn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const _ of t.hand.values()){const f=e.getJointPose(_,n),h=this._getHandJoint(c,_);f!==null&&(h.matrix.fromArray(f.transform.matrix),h.matrix.decompose(h.position,h.rotation,h.scale),h.matrixWorldNeedsUpdate=!0,h.jointRadius=f.radius),h.visible=f!==null}const d=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],p=d.position.distanceTo(u.position),m=.02,g=.005;c.inputState.pinching&&p>m+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&p<=m-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Sp)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Dn;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class yp extends zn{constructor(t,e){super();const n=this;let i=null,r=1,a=null,o="local-floor",l=1,c=null,d=null,u=null,p=null,m=null,g=null;const _=e.getContextAttributes();let f=null,h=null;const E=[],x=[],T=new Et;let D=null;const R=new Fe;R.layers.enable(1),R.viewport=new me;const w=new Fe;w.layers.enable(2),w.viewport=new me;const W=[R,w],S=new Mp;S.layers.enable(1),S.layers.enable(2);let b=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(G){let Y=E[G];return Y===void 0&&(Y=new cr,E[G]=Y),Y.getTargetRaySpace()},this.getControllerGrip=function(G){let Y=E[G];return Y===void 0&&(Y=new cr,E[G]=Y),Y.getGripSpace()},this.getHand=function(G){let Y=E[G];return Y===void 0&&(Y=new cr,E[G]=Y),Y.getHandSpace()};function V(G){const Y=x.indexOf(G.inputSource);if(Y===-1)return;const ct=E[Y];ct!==void 0&&(ct.update(G.inputSource,G.frame,c||a),ct.dispatchEvent({type:G.type,data:G.inputSource}))}function Q(){i.removeEventListener("select",V),i.removeEventListener("selectstart",V),i.removeEventListener("selectend",V),i.removeEventListener("squeeze",V),i.removeEventListener("squeezestart",V),i.removeEventListener("squeezeend",V),i.removeEventListener("end",Q),i.removeEventListener("inputsourceschange",P);for(let G=0;G<E.length;G++){const Y=x[G];Y!==null&&(x[G]=null,E[G].disconnect(Y))}b=null,k=null,t.setRenderTarget(f),m=null,p=null,u=null,i=null,h=null,rt.stop(),n.isPresenting=!1,t.setPixelRatio(D),t.setSize(T.width,T.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(G){r=G,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(G){o=G,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(G){c=G},this.getBaseLayer=function(){return p!==null?p:m},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(G){if(i=G,i!==null){if(f=t.getRenderTarget(),i.addEventListener("select",V),i.addEventListener("selectstart",V),i.addEventListener("selectend",V),i.addEventListener("squeeze",V),i.addEventListener("squeezestart",V),i.addEventListener("squeezeend",V),i.addEventListener("end",Q),i.addEventListener("inputsourceschange",P),_.xrCompatible!==!0&&await e.makeXRCompatible(),D=t.getPixelRatio(),t.getSize(T),i.renderState.layers===void 0||t.capabilities.isWebGL2===!1){const Y={antialias:i.renderState.layers===void 0?_.antialias:!0,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(i,e,Y),i.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),h=new Fn(m.framebufferWidth,m.framebufferHeight,{format:$e,type:vn,colorSpace:t.outputColorSpace,stencilBuffer:_.stencil})}else{let Y=null,ct=null,vt=null;_.depth&&(vt=_.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Y=_.stencil?xi:Un,ct=_.stencil?In:fn);const gt={colorFormat:e.RGBA8,depthFormat:vt,scaleFactor:r};u=new XRWebGLBinding(i,e),p=u.createProjectionLayer(gt),i.updateRenderState({layers:[p]}),t.setPixelRatio(1),t.setSize(p.textureWidth,p.textureHeight,!1),h=new Fn(p.textureWidth,p.textureHeight,{format:$e,type:vn,depthTexture:new rl(p.textureWidth,p.textureHeight,ct,void 0,void 0,void 0,void 0,void 0,void 0,Y),stencilBuffer:_.stencil,colorSpace:t.outputColorSpace,samples:_.antialias?4:0});const Lt=t.properties.get(h);Lt.__ignoreDepthValues=p.ignoreDepthValues}h.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),rt.setContext(i),rt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode};function P(G){for(let Y=0;Y<G.removed.length;Y++){const ct=G.removed[Y],vt=x.indexOf(ct);vt>=0&&(x[vt]=null,E[vt].disconnect(ct))}for(let Y=0;Y<G.added.length;Y++){const ct=G.added[Y];let vt=x.indexOf(ct);if(vt===-1){for(let Lt=0;Lt<E.length;Lt++)if(Lt>=x.length){x.push(ct),vt=Lt;break}else if(x[Lt]===null){x[Lt]=ct,vt=Lt;break}if(vt===-1)break}const gt=E[vt];gt&&gt.connect(ct)}}const F=new L,H=new L;function q(G,Y,ct){F.setFromMatrixPosition(Y.matrixWorld),H.setFromMatrixPosition(ct.matrixWorld);const vt=F.distanceTo(H),gt=Y.projectionMatrix.elements,Lt=ct.projectionMatrix.elements,Dt=gt[14]/(gt[10]-1),Tt=gt[14]/(gt[10]+1),Gt=(gt[9]+1)/gt[5],N=(gt[9]-1)/gt[5],ge=(gt[8]-1)/gt[0],St=(Lt[8]+1)/Lt[0],Rt=Dt*ge,pt=Dt*St,Kt=vt/(-ge+St),Ut=Kt*-ge;Y.matrixWorld.decompose(G.position,G.quaternion,G.scale),G.translateX(Ut),G.translateZ(Kt),G.matrixWorld.compose(G.position,G.quaternion,G.scale),G.matrixWorldInverse.copy(G.matrixWorld).invert();const y=Dt+Kt,v=Tt+Kt,U=Rt-Ut,tt=pt+(vt-Ut),Z=Gt*Tt/v*y,et=N*Tt/v*y;G.projectionMatrix.makePerspective(U,tt,Z,et,y,v),G.projectionMatrixInverse.copy(G.projectionMatrix).invert()}function X(G,Y){Y===null?G.matrixWorld.copy(G.matrix):G.matrixWorld.multiplyMatrices(Y.matrixWorld,G.matrix),G.matrixWorldInverse.copy(G.matrixWorld).invert()}this.updateCamera=function(G){if(i===null)return;S.near=w.near=R.near=G.near,S.far=w.far=R.far=G.far,(b!==S.near||k!==S.far)&&(i.updateRenderState({depthNear:S.near,depthFar:S.far}),b=S.near,k=S.far);const Y=G.parent,ct=S.cameras;X(S,Y);for(let vt=0;vt<ct.length;vt++)X(ct[vt],Y);ct.length===2?q(S,R,w):S.projectionMatrix.copy(R.projectionMatrix),$(G,S,Y)};function $(G,Y,ct){ct===null?G.matrix.copy(Y.matrixWorld):(G.matrix.copy(ct.matrixWorld),G.matrix.invert(),G.matrix.multiply(Y.matrixWorld)),G.matrix.decompose(G.position,G.quaternion,G.scale),G.updateMatrixWorld(!0),G.projectionMatrix.copy(Y.projectionMatrix),G.projectionMatrixInverse.copy(Y.projectionMatrixInverse),G.isPerspectiveCamera&&(G.fov=Tr*2*Math.atan(1/G.projectionMatrix.elements[5]),G.zoom=1)}this.getCamera=function(){return S},this.getFoveation=function(){if(!(p===null&&m===null))return l},this.setFoveation=function(G){l=G,p!==null&&(p.fixedFoveation=G),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=G)};let j=null;function st(G,Y){if(d=Y.getViewerPose(c||a),g=Y,d!==null){const ct=d.views;m!==null&&(t.setRenderTargetFramebuffer(h,m.framebuffer),t.setRenderTarget(h));let vt=!1;ct.length!==S.cameras.length&&(S.cameras.length=0,vt=!0);for(let gt=0;gt<ct.length;gt++){const Lt=ct[gt];let Dt=null;if(m!==null)Dt=m.getViewport(Lt);else{const Gt=u.getViewSubImage(p,Lt);Dt=Gt.viewport,gt===0&&(t.setRenderTargetTextures(h,Gt.colorTexture,p.ignoreDepthValues?void 0:Gt.depthStencilTexture),t.setRenderTarget(h))}let Tt=W[gt];Tt===void 0&&(Tt=new Fe,Tt.layers.enable(gt),Tt.viewport=new me,W[gt]=Tt),Tt.matrix.fromArray(Lt.transform.matrix),Tt.matrix.decompose(Tt.position,Tt.quaternion,Tt.scale),Tt.projectionMatrix.fromArray(Lt.projectionMatrix),Tt.projectionMatrixInverse.copy(Tt.projectionMatrix).invert(),Tt.viewport.set(Dt.x,Dt.y,Dt.width,Dt.height),gt===0&&(S.matrix.copy(Tt.matrix),S.matrix.decompose(S.position,S.quaternion,S.scale)),vt===!0&&S.cameras.push(Tt)}}for(let ct=0;ct<E.length;ct++){const vt=x[ct],gt=E[ct];vt!==null&&gt!==void 0&&gt.update(vt,Y,c||a)}j&&j(G,Y),Y.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Y}),g=null}const rt=new il;rt.setAnimationLoop(st),this.setAnimationLoop=function(G){j=G},this.dispose=function(){}}}function Ep(s,t){function e(f,h){f.matrixAutoUpdate===!0&&f.updateMatrix(),h.value.copy(f.matrix)}function n(f,h){h.color.getRGB(f.fogColor.value,tl(s)),h.isFog?(f.fogNear.value=h.near,f.fogFar.value=h.far):h.isFogExp2&&(f.fogDensity.value=h.density)}function i(f,h,E,x,T){h.isMeshBasicMaterial||h.isMeshLambertMaterial?r(f,h):h.isMeshToonMaterial?(r(f,h),u(f,h)):h.isMeshPhongMaterial?(r(f,h),d(f,h)):h.isMeshStandardMaterial?(r(f,h),p(f,h),h.isMeshPhysicalMaterial&&m(f,h,T)):h.isMeshMatcapMaterial?(r(f,h),g(f,h)):h.isMeshDepthMaterial?r(f,h):h.isMeshDistanceMaterial?(r(f,h),_(f,h)):h.isMeshNormalMaterial?r(f,h):h.isLineBasicMaterial?(a(f,h),h.isLineDashedMaterial&&o(f,h)):h.isPointsMaterial?l(f,h,E,x):h.isSpriteMaterial?c(f,h):h.isShadowMaterial?(f.color.value.copy(h.color),f.opacity.value=h.opacity):h.isShaderMaterial&&(h.uniformsNeedUpdate=!1)}function r(f,h){f.opacity.value=h.opacity,h.color&&f.diffuse.value.copy(h.color),h.emissive&&f.emissive.value.copy(h.emissive).multiplyScalar(h.emissiveIntensity),h.map&&(f.map.value=h.map,e(h.map,f.mapTransform)),h.alphaMap&&(f.alphaMap.value=h.alphaMap,e(h.alphaMap,f.alphaMapTransform)),h.bumpMap&&(f.bumpMap.value=h.bumpMap,e(h.bumpMap,f.bumpMapTransform),f.bumpScale.value=h.bumpScale,h.side===Te&&(f.bumpScale.value*=-1)),h.normalMap&&(f.normalMap.value=h.normalMap,e(h.normalMap,f.normalMapTransform),f.normalScale.value.copy(h.normalScale),h.side===Te&&f.normalScale.value.negate()),h.displacementMap&&(f.displacementMap.value=h.displacementMap,e(h.displacementMap,f.displacementMapTransform),f.displacementScale.value=h.displacementScale,f.displacementBias.value=h.displacementBias),h.emissiveMap&&(f.emissiveMap.value=h.emissiveMap,e(h.emissiveMap,f.emissiveMapTransform)),h.specularMap&&(f.specularMap.value=h.specularMap,e(h.specularMap,f.specularMapTransform)),h.alphaTest>0&&(f.alphaTest.value=h.alphaTest);const E=t.get(h).envMap;if(E&&(f.envMap.value=E,f.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,f.reflectivity.value=h.reflectivity,f.ior.value=h.ior,f.refractionRatio.value=h.refractionRatio),h.lightMap){f.lightMap.value=h.lightMap;const x=s._useLegacyLights===!0?Math.PI:1;f.lightMapIntensity.value=h.lightMapIntensity*x,e(h.lightMap,f.lightMapTransform)}h.aoMap&&(f.aoMap.value=h.aoMap,f.aoMapIntensity.value=h.aoMapIntensity,e(h.aoMap,f.aoMapTransform))}function a(f,h){f.diffuse.value.copy(h.color),f.opacity.value=h.opacity,h.map&&(f.map.value=h.map,e(h.map,f.mapTransform))}function o(f,h){f.dashSize.value=h.dashSize,f.totalSize.value=h.dashSize+h.gapSize,f.scale.value=h.scale}function l(f,h,E,x){f.diffuse.value.copy(h.color),f.opacity.value=h.opacity,f.size.value=h.size*E,f.scale.value=x*.5,h.map&&(f.map.value=h.map,e(h.map,f.uvTransform)),h.alphaMap&&(f.alphaMap.value=h.alphaMap,e(h.alphaMap,f.alphaMapTransform)),h.alphaTest>0&&(f.alphaTest.value=h.alphaTest)}function c(f,h){f.diffuse.value.copy(h.color),f.opacity.value=h.opacity,f.rotation.value=h.rotation,h.map&&(f.map.value=h.map,e(h.map,f.mapTransform)),h.alphaMap&&(f.alphaMap.value=h.alphaMap,e(h.alphaMap,f.alphaMapTransform)),h.alphaTest>0&&(f.alphaTest.value=h.alphaTest)}function d(f,h){f.specular.value.copy(h.specular),f.shininess.value=Math.max(h.shininess,1e-4)}function u(f,h){h.gradientMap&&(f.gradientMap.value=h.gradientMap)}function p(f,h){f.metalness.value=h.metalness,h.metalnessMap&&(f.metalnessMap.value=h.metalnessMap,e(h.metalnessMap,f.metalnessMapTransform)),f.roughness.value=h.roughness,h.roughnessMap&&(f.roughnessMap.value=h.roughnessMap,e(h.roughnessMap,f.roughnessMapTransform)),t.get(h).envMap&&(f.envMapIntensity.value=h.envMapIntensity)}function m(f,h,E){f.ior.value=h.ior,h.sheen>0&&(f.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),f.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(f.sheenColorMap.value=h.sheenColorMap,e(h.sheenColorMap,f.sheenColorMapTransform)),h.sheenRoughnessMap&&(f.sheenRoughnessMap.value=h.sheenRoughnessMap,e(h.sheenRoughnessMap,f.sheenRoughnessMapTransform))),h.clearcoat>0&&(f.clearcoat.value=h.clearcoat,f.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(f.clearcoatMap.value=h.clearcoatMap,e(h.clearcoatMap,f.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(f.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,e(h.clearcoatRoughnessMap,f.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(f.clearcoatNormalMap.value=h.clearcoatNormalMap,e(h.clearcoatNormalMap,f.clearcoatNormalMapTransform),f.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===Te&&f.clearcoatNormalScale.value.negate())),h.iridescence>0&&(f.iridescence.value=h.iridescence,f.iridescenceIOR.value=h.iridescenceIOR,f.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],f.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(f.iridescenceMap.value=h.iridescenceMap,e(h.iridescenceMap,f.iridescenceMapTransform)),h.iridescenceThicknessMap&&(f.iridescenceThicknessMap.value=h.iridescenceThicknessMap,e(h.iridescenceThicknessMap,f.iridescenceThicknessMapTransform))),h.transmission>0&&(f.transmission.value=h.transmission,f.transmissionSamplerMap.value=E.texture,f.transmissionSamplerSize.value.set(E.width,E.height),h.transmissionMap&&(f.transmissionMap.value=h.transmissionMap,e(h.transmissionMap,f.transmissionMapTransform)),f.thickness.value=h.thickness,h.thicknessMap&&(f.thicknessMap.value=h.thicknessMap,e(h.thicknessMap,f.thicknessMapTransform)),f.attenuationDistance.value=h.attenuationDistance,f.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(f.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(f.anisotropyMap.value=h.anisotropyMap,e(h.anisotropyMap,f.anisotropyMapTransform))),f.specularIntensity.value=h.specularIntensity,f.specularColor.value.copy(h.specularColor),h.specularColorMap&&(f.specularColorMap.value=h.specularColorMap,e(h.specularColorMap,f.specularColorMapTransform)),h.specularIntensityMap&&(f.specularIntensityMap.value=h.specularIntensityMap,e(h.specularIntensityMap,f.specularIntensityMapTransform))}function g(f,h){h.matcap&&(f.matcap.value=h.matcap)}function _(f,h){const E=t.get(h).light;f.referencePosition.value.setFromMatrixPosition(E.matrixWorld),f.nearDistance.value=E.shadow.camera.near,f.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function bp(s,t,e,n){let i={},r={},a=[];const o=e.isWebGL2?s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS):0;function l(E,x){const T=x.program;n.uniformBlockBinding(E,T)}function c(E,x){let T=i[E.id];T===void 0&&(g(E),T=d(E),i[E.id]=T,E.addEventListener("dispose",f));const D=x.program;n.updateUBOMapping(E,D);const R=t.render.frame;r[E.id]!==R&&(p(E),r[E.id]=R)}function d(E){const x=u();E.__bindingPointIndex=x;const T=s.createBuffer(),D=E.__size,R=E.usage;return s.bindBuffer(s.UNIFORM_BUFFER,T),s.bufferData(s.UNIFORM_BUFFER,D,R),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,x,T),T}function u(){for(let E=0;E<o;E++)if(a.indexOf(E)===-1)return a.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function p(E){const x=i[E.id],T=E.uniforms,D=E.__cache;s.bindBuffer(s.UNIFORM_BUFFER,x);for(let R=0,w=T.length;R<w;R++){const W=Array.isArray(T[R])?T[R]:[T[R]];for(let S=0,b=W.length;S<b;S++){const k=W[S];if(m(k,R,S,D)===!0){const V=k.__offset,Q=Array.isArray(k.value)?k.value:[k.value];let P=0;for(let F=0;F<Q.length;F++){const H=Q[F],q=_(H);typeof H=="number"||typeof H=="boolean"?(k.__data[0]=H,s.bufferSubData(s.UNIFORM_BUFFER,V+P,k.__data)):H.isMatrix3?(k.__data[0]=H.elements[0],k.__data[1]=H.elements[1],k.__data[2]=H.elements[2],k.__data[3]=0,k.__data[4]=H.elements[3],k.__data[5]=H.elements[4],k.__data[6]=H.elements[5],k.__data[7]=0,k.__data[8]=H.elements[6],k.__data[9]=H.elements[7],k.__data[10]=H.elements[8],k.__data[11]=0):(H.toArray(k.__data,P),P+=q.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,V,k.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function m(E,x,T,D){const R=E.value,w=x+"_"+T;if(D[w]===void 0)return typeof R=="number"||typeof R=="boolean"?D[w]=R:D[w]=R.clone(),!0;{const W=D[w];if(typeof R=="number"||typeof R=="boolean"){if(W!==R)return D[w]=R,!0}else if(W.equals(R)===!1)return W.copy(R),!0}return!1}function g(E){const x=E.uniforms;let T=0;const D=16;for(let w=0,W=x.length;w<W;w++){const S=Array.isArray(x[w])?x[w]:[x[w]];for(let b=0,k=S.length;b<k;b++){const V=S[b],Q=Array.isArray(V.value)?V.value:[V.value];for(let P=0,F=Q.length;P<F;P++){const H=Q[P],q=_(H),X=T%D;X!==0&&D-X<q.boundary&&(T+=D-X),V.__data=new Float32Array(q.storage/Float32Array.BYTES_PER_ELEMENT),V.__offset=T,T+=q.storage}}}const R=T%D;return R>0&&(T+=D-R),E.__size=T,E.__cache={},this}function _(E){const x={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(x.boundary=4,x.storage=4):E.isVector2?(x.boundary=8,x.storage=8):E.isVector3||E.isColor?(x.boundary=16,x.storage=12):E.isVector4?(x.boundary=16,x.storage=16):E.isMatrix3?(x.boundary=48,x.storage=48):E.isMatrix4?(x.boundary=64,x.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),x}function f(E){const x=E.target;x.removeEventListener("dispose",f);const T=a.indexOf(x.__bindingPointIndex);a.splice(T,1),s.deleteBuffer(i[x.id]),delete i[x.id],delete r[x.id]}function h(){for(const E in i)s.deleteBuffer(i[E]);a=[],i={},r={}}return{bind:l,update:c,dispose:h}}class hl{constructor(t={}){const{canvas:e=xc(),context:n=null,depth:i=!0,stencil:r=!0,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:u=!1}=t;this.isWebGLRenderer=!0;let p;n!==null?p=n.getContextAttributes().alpha:p=a;const m=new Uint32Array(4),g=new Int32Array(4);let _=null,f=null;const h=[],E=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=pe,this._useLegacyLights=!1,this.toneMapping=_n,this.toneMappingExposure=1;const x=this;let T=!1,D=0,R=0,w=null,W=-1,S=null;const b=new me,k=new me;let V=null;const Q=new Bt(0);let P=0,F=e.width,H=e.height,q=1,X=null,$=null;const j=new me(0,0,F,H),st=new me(0,0,F,H);let rt=!1;const G=new Ir;let Y=!1,ct=!1,vt=null;const gt=new re,Lt=new Et,Dt=new L,Tt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Gt(){return w===null?q:1}let N=n;function ge(M,I){for(let B=0;B<M.length;B++){const z=M[B],O=e.getContext(z,I);if(O!==null)return O}return null}try{const M={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Cr}`),e.addEventListener("webglcontextlost",J,!1),e.addEventListener("webglcontextrestored",C,!1),e.addEventListener("webglcontextcreationerror",it,!1),N===null){const I=["webgl2","webgl","experimental-webgl"];if(x.isWebGL1Renderer===!0&&I.shift(),N=ge(I,M),N===null)throw ge(I)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&N instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),N.getShaderPrecisionFormat===void 0&&(N.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}let St,Rt,pt,Kt,Ut,y,v,U,tt,Z,et,mt,lt,ft,bt,Nt,K,qt,zt,Ct,Mt,dt,A,nt;function _t(){St=new Iu(N),Rt=new wu(N,St,t),St.init(Rt),dt=new xp(N,St,Rt),pt=new _p(N,St,Rt),Kt=new Fu(N),Ut=new ip,y=new vp(N,St,pt,Ut,Rt,dt,Kt),v=new Cu(x),U=new Du(x),tt=new Wc(N,Rt),A=new Tu(N,St,tt,Rt),Z=new Uu(N,tt,Kt,A),et=new Hu(N,Z,tt,Kt),zt=new zu(N,Rt,y),Nt=new Ru(Ut),mt=new np(x,v,U,St,Rt,A,Nt),lt=new Ep(x,Ut),ft=new rp,bt=new hp(St,Rt),qt=new bu(x,v,U,pt,et,p,l),K=new gp(x,et,Rt),nt=new bp(N,Kt,Rt,pt),Ct=new Au(N,St,Kt,Rt),Mt=new Nu(N,St,Kt,Rt),Kt.programs=mt.programs,x.capabilities=Rt,x.extensions=St,x.properties=Ut,x.renderLists=ft,x.shadowMap=K,x.state=pt,x.info=Kt}_t();const ut=new yp(x,N);this.xr=ut,this.getContext=function(){return N},this.getContextAttributes=function(){return N.getContextAttributes()},this.forceContextLoss=function(){const M=St.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){const M=St.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return q},this.setPixelRatio=function(M){M!==void 0&&(q=M,this.setSize(F,H,!1))},this.getSize=function(M){return M.set(F,H)},this.setSize=function(M,I,B=!0){if(ut.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}F=M,H=I,e.width=Math.floor(M*q),e.height=Math.floor(I*q),B===!0&&(e.style.width=M+"px",e.style.height=I+"px"),this.setViewport(0,0,M,I)},this.getDrawingBufferSize=function(M){return M.set(F*q,H*q).floor()},this.setDrawingBufferSize=function(M,I,B){F=M,H=I,q=B,e.width=Math.floor(M*B),e.height=Math.floor(I*B),this.setViewport(0,0,M,I)},this.getCurrentViewport=function(M){return M.copy(b)},this.getViewport=function(M){return M.copy(j)},this.setViewport=function(M,I,B,z){M.isVector4?j.set(M.x,M.y,M.z,M.w):j.set(M,I,B,z),pt.viewport(b.copy(j).multiplyScalar(q).floor())},this.getScissor=function(M){return M.copy(st)},this.setScissor=function(M,I,B,z){M.isVector4?st.set(M.x,M.y,M.z,M.w):st.set(M,I,B,z),pt.scissor(k.copy(st).multiplyScalar(q).floor())},this.getScissorTest=function(){return rt},this.setScissorTest=function(M){pt.setScissorTest(rt=M)},this.setOpaqueSort=function(M){X=M},this.setTransparentSort=function(M){$=M},this.getClearColor=function(M){return M.copy(qt.getClearColor())},this.setClearColor=function(){qt.setClearColor.apply(qt,arguments)},this.getClearAlpha=function(){return qt.getClearAlpha()},this.setClearAlpha=function(){qt.setClearAlpha.apply(qt,arguments)},this.clear=function(M=!0,I=!0,B=!0){let z=0;if(M){let O=!1;if(w!==null){const ht=w.texture.format;O=ht===Vo||ht===ko||ht===Ho}if(O){const ht=w.texture.type,xt=ht===vn||ht===fn||ht===Pr||ht===In||ht===Bo||ht===zo,wt=qt.getClearColor(),Pt=qt.getClearAlpha(),Ht=wt.r,It=wt.g,Ft=wt.b;xt?(m[0]=Ht,m[1]=It,m[2]=Ft,m[3]=Pt,N.clearBufferuiv(N.COLOR,0,m)):(g[0]=Ht,g[1]=It,g[2]=Ft,g[3]=Pt,N.clearBufferiv(N.COLOR,0,g))}else z|=N.COLOR_BUFFER_BIT}I&&(z|=N.DEPTH_BUFFER_BIT),B&&(z|=N.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),N.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",J,!1),e.removeEventListener("webglcontextrestored",C,!1),e.removeEventListener("webglcontextcreationerror",it,!1),ft.dispose(),bt.dispose(),Ut.dispose(),v.dispose(),U.dispose(),et.dispose(),A.dispose(),nt.dispose(),mt.dispose(),ut.dispose(),ut.removeEventListener("sessionstart",ne),ut.removeEventListener("sessionend",$t),vt&&(vt.dispose(),vt=null),ae.stop()};function J(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),T=!0}function C(){console.log("THREE.WebGLRenderer: Context Restored."),T=!1;const M=Kt.autoReset,I=K.enabled,B=K.autoUpdate,z=K.needsUpdate,O=K.type;_t(),Kt.autoReset=M,K.enabled=I,K.autoUpdate=B,K.needsUpdate=z,K.type=O}function it(M){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function ot(M){const I=M.target;I.removeEventListener("dispose",ot),At(I)}function At(M){yt(M),Ut.remove(M)}function yt(M){const I=Ut.get(M).programs;I!==void 0&&(I.forEach(function(B){mt.releaseProgram(B)}),M.isShaderMaterial&&mt.releaseShaderCache(M))}this.renderBufferDirect=function(M,I,B,z,O,ht){I===null&&(I=Tt);const xt=O.isMesh&&O.matrixWorld.determinant()<0,wt=gl(M,I,B,z,O);pt.setMaterial(z,xt);let Pt=B.index,Ht=1;if(z.wireframe===!0){if(Pt=Z.getWireframeAttribute(B),Pt===void 0)return;Ht=2}const It=B.drawRange,Ft=B.attributes.position;let ie=It.start*Ht,Re=(It.start+It.count)*Ht;ht!==null&&(ie=Math.max(ie,ht.start*Ht),Re=Math.min(Re,(ht.start+ht.count)*Ht)),Pt!==null?(ie=Math.max(ie,0),Re=Math.min(Re,Pt.count)):Ft!=null&&(ie=Math.max(ie,0),Re=Math.min(Re,Ft.count));const ue=Re-ie;if(ue<0||ue===1/0)return;A.setup(O,z,wt,B,Pt);let Ye,Qt=Ct;if(Pt!==null&&(Ye=tt.get(Pt),Qt=Mt,Qt.setIndex(Ye)),O.isMesh)z.wireframe===!0?(pt.setLineWidth(z.wireframeLinewidth*Gt()),Qt.setMode(N.LINES)):Qt.setMode(N.TRIANGLES);else if(O.isLine){let kt=z.linewidth;kt===void 0&&(kt=1),pt.setLineWidth(kt*Gt()),O.isLineSegments?Qt.setMode(N.LINES):O.isLineLoop?Qt.setMode(N.LINE_LOOP):Qt.setMode(N.LINE_STRIP)}else O.isPoints?Qt.setMode(N.POINTS):O.isSprite&&Qt.setMode(N.TRIANGLES);if(O.isBatchedMesh)Qt.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else if(O.isInstancedMesh)Qt.renderInstances(ie,ue,O.count);else if(B.isInstancedBufferGeometry){const kt=B._maxInstanceCount!==void 0?B._maxInstanceCount:1/0,Ps=Math.min(B.instanceCount,kt);Qt.renderInstances(ie,ue,Ps)}else Qt.render(ie,ue)};function Wt(M,I,B){M.transparent===!0&&M.side===Oe&&M.forceSinglePass===!1?(M.side=Te,M.needsUpdate=!0,zi(M,I,B),M.side=Mn,M.needsUpdate=!0,zi(M,I,B),M.side=Oe):zi(M,I,B)}this.compile=function(M,I,B=null){B===null&&(B=M),f=bt.get(B),f.init(),E.push(f),B.traverseVisible(function(O){O.isLight&&O.layers.test(I.layers)&&(f.pushLight(O),O.castShadow&&f.pushShadow(O))}),M!==B&&M.traverseVisible(function(O){O.isLight&&O.layers.test(I.layers)&&(f.pushLight(O),O.castShadow&&f.pushShadow(O))}),f.setupLights(x._useLegacyLights);const z=new Set;return M.traverse(function(O){const ht=O.material;if(ht)if(Array.isArray(ht))for(let xt=0;xt<ht.length;xt++){const wt=ht[xt];Wt(wt,B,O),z.add(wt)}else Wt(ht,B,O),z.add(ht)}),E.pop(),f=null,z},this.compileAsync=function(M,I,B=null){const z=this.compile(M,I,B);return new Promise(O=>{function ht(){if(z.forEach(function(xt){Ut.get(xt).currentProgram.isReady()&&z.delete(xt)}),z.size===0){O(M);return}setTimeout(ht,10)}St.get("KHR_parallel_shader_compile")!==null?ht():setTimeout(ht,10)})};let Xt=null;function te(M){Xt&&Xt(M)}function ne(){ae.stop()}function $t(){ae.start()}const ae=new il;ae.setAnimationLoop(te),typeof self<"u"&&ae.setContext(self),this.setAnimationLoop=function(M){Xt=M,ut.setAnimationLoop(M),M===null?ae.stop():ae.start()},ut.addEventListener("sessionstart",ne),ut.addEventListener("sessionend",$t),this.render=function(M,I){if(I!==void 0&&I.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(T===!0)return;M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),ut.enabled===!0&&ut.isPresenting===!0&&(ut.cameraAutoUpdate===!0&&ut.updateCamera(I),I=ut.getCamera()),M.isScene===!0&&M.onBeforeRender(x,M,I,w),f=bt.get(M,E.length),f.init(),E.push(f),gt.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),G.setFromProjectionMatrix(gt),ct=this.localClippingEnabled,Y=Nt.init(this.clippingPlanes,ct),_=ft.get(M,h.length),_.init(),h.push(_),qe(M,I,0,x.sortObjects),_.finish(),x.sortObjects===!0&&_.sort(X,$),this.info.render.frame++,Y===!0&&Nt.beginShadows();const B=f.state.shadowsArray;if(K.render(B,M,I),Y===!0&&Nt.endShadows(),this.info.autoReset===!0&&this.info.reset(),qt.render(_,M),f.setupLights(x._useLegacyLights),I.isArrayCamera){const z=I.cameras;for(let O=0,ht=z.length;O<ht;O++){const xt=z[O];Hr(_,M,xt,xt.viewport)}}else Hr(_,M,I);w!==null&&(y.updateMultisampleRenderTarget(w),y.updateRenderTargetMipmap(w)),M.isScene===!0&&M.onAfterRender(x,M,I),A.resetDefaultState(),W=-1,S=null,E.pop(),E.length>0?f=E[E.length-1]:f=null,h.pop(),h.length>0?_=h[h.length-1]:_=null};function qe(M,I,B,z){if(M.visible===!1)return;if(M.layers.test(I.layers)){if(M.isGroup)B=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(I);else if(M.isLight)f.pushLight(M),M.castShadow&&f.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||G.intersectsSprite(M)){z&&Dt.setFromMatrixPosition(M.matrixWorld).applyMatrix4(gt);const xt=et.update(M),wt=M.material;wt.visible&&_.push(M,xt,wt,B,Dt.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||G.intersectsObject(M))){const xt=et.update(M),wt=M.material;if(z&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),Dt.copy(M.boundingSphere.center)):(xt.boundingSphere===null&&xt.computeBoundingSphere(),Dt.copy(xt.boundingSphere.center)),Dt.applyMatrix4(M.matrixWorld).applyMatrix4(gt)),Array.isArray(wt)){const Pt=xt.groups;for(let Ht=0,It=Pt.length;Ht<It;Ht++){const Ft=Pt[Ht],ie=wt[Ft.materialIndex];ie&&ie.visible&&_.push(M,xt,ie,B,Dt.z,Ft)}}else wt.visible&&_.push(M,xt,wt,B,Dt.z,null)}}const ht=M.children;for(let xt=0,wt=ht.length;xt<wt;xt++)qe(ht[xt],I,B,z)}function Hr(M,I,B,z){const O=M.opaque,ht=M.transmissive,xt=M.transparent;f.setupLightsView(B),Y===!0&&Nt.setGlobalState(x.clippingPlanes,B),ht.length>0&&ml(O,ht,I,B),z&&pt.viewport(b.copy(z)),O.length>0&&Bi(O,I,B),ht.length>0&&Bi(ht,I,B),xt.length>0&&Bi(xt,I,B),pt.buffers.depth.setTest(!0),pt.buffers.depth.setMask(!0),pt.buffers.color.setMask(!0),pt.setPolygonOffset(!1)}function ml(M,I,B,z){if((B.isScene===!0?B.overrideMaterial:null)!==null)return;const ht=Rt.isWebGL2;vt===null&&(vt=new Fn(1,1,{generateMipmaps:!0,type:St.has("EXT_color_buffer_half_float")?Ni:vn,minFilter:Ui,samples:ht?4:0})),x.getDrawingBufferSize(Lt),ht?vt.setSize(Lt.x,Lt.y):vt.setSize(Ar(Lt.x),Ar(Lt.y));const xt=x.getRenderTarget();x.setRenderTarget(vt),x.getClearColor(Q),P=x.getClearAlpha(),P<1&&x.setClearColor(16777215,.5),x.clear();const wt=x.toneMapping;x.toneMapping=_n,Bi(M,B,z),y.updateMultisampleRenderTarget(vt),y.updateRenderTargetMipmap(vt);let Pt=!1;for(let Ht=0,It=I.length;Ht<It;Ht++){const Ft=I[Ht],ie=Ft.object,Re=Ft.geometry,ue=Ft.material,Ye=Ft.group;if(ue.side===Oe&&ie.layers.test(z.layers)){const Qt=ue.side;ue.side=Te,ue.needsUpdate=!0,kr(ie,B,z,Re,ue,Ye),ue.side=Qt,ue.needsUpdate=!0,Pt=!0}}Pt===!0&&(y.updateMultisampleRenderTarget(vt),y.updateRenderTargetMipmap(vt)),x.setRenderTarget(xt),x.setClearColor(Q,P),x.toneMapping=wt}function Bi(M,I,B){const z=I.isScene===!0?I.overrideMaterial:null;for(let O=0,ht=M.length;O<ht;O++){const xt=M[O],wt=xt.object,Pt=xt.geometry,Ht=z===null?xt.material:z,It=xt.group;wt.layers.test(B.layers)&&kr(wt,I,B,Pt,Ht,It)}}function kr(M,I,B,z,O,ht){M.onBeforeRender(x,I,B,z,O,ht),M.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),O.onBeforeRender(x,I,B,z,M,ht),O.transparent===!0&&O.side===Oe&&O.forceSinglePass===!1?(O.side=Te,O.needsUpdate=!0,x.renderBufferDirect(B,I,z,O,M,ht),O.side=Mn,O.needsUpdate=!0,x.renderBufferDirect(B,I,z,O,M,ht),O.side=Oe):x.renderBufferDirect(B,I,z,O,M,ht),M.onAfterRender(x,I,B,z,O,ht)}function zi(M,I,B){I.isScene!==!0&&(I=Tt);const z=Ut.get(M),O=f.state.lights,ht=f.state.shadowsArray,xt=O.state.version,wt=mt.getParameters(M,O.state,ht,I,B),Pt=mt.getProgramCacheKey(wt);let Ht=z.programs;z.environment=M.isMeshStandardMaterial?I.environment:null,z.fog=I.fog,z.envMap=(M.isMeshStandardMaterial?U:v).get(M.envMap||z.environment),Ht===void 0&&(M.addEventListener("dispose",ot),Ht=new Map,z.programs=Ht);let It=Ht.get(Pt);if(It!==void 0){if(z.currentProgram===It&&z.lightsStateVersion===xt)return Gr(M,wt),It}else wt.uniforms=mt.getUniforms(M),M.onBuild(B,wt,x),M.onBeforeCompile(wt,x),It=mt.acquireProgram(wt,Pt),Ht.set(Pt,It),z.uniforms=wt.uniforms;const Ft=z.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Ft.clippingPlanes=Nt.uniform),Gr(M,wt),z.needsLights=vl(M),z.lightsStateVersion=xt,z.needsLights&&(Ft.ambientLightColor.value=O.state.ambient,Ft.lightProbe.value=O.state.probe,Ft.directionalLights.value=O.state.directional,Ft.directionalLightShadows.value=O.state.directionalShadow,Ft.spotLights.value=O.state.spot,Ft.spotLightShadows.value=O.state.spotShadow,Ft.rectAreaLights.value=O.state.rectArea,Ft.ltc_1.value=O.state.rectAreaLTC1,Ft.ltc_2.value=O.state.rectAreaLTC2,Ft.pointLights.value=O.state.point,Ft.pointLightShadows.value=O.state.pointShadow,Ft.hemisphereLights.value=O.state.hemi,Ft.directionalShadowMap.value=O.state.directionalShadowMap,Ft.directionalShadowMatrix.value=O.state.directionalShadowMatrix,Ft.spotShadowMap.value=O.state.spotShadowMap,Ft.spotLightMatrix.value=O.state.spotLightMatrix,Ft.spotLightMap.value=O.state.spotLightMap,Ft.pointShadowMap.value=O.state.pointShadowMap,Ft.pointShadowMatrix.value=O.state.pointShadowMatrix),z.currentProgram=It,z.uniformsList=null,It}function Vr(M){if(M.uniformsList===null){const I=M.currentProgram.getUniforms();M.uniformsList=ps.seqWithValue(I.seq,M.uniforms)}return M.uniformsList}function Gr(M,I){const B=Ut.get(M);B.outputColorSpace=I.outputColorSpace,B.batching=I.batching,B.instancing=I.instancing,B.instancingColor=I.instancingColor,B.skinning=I.skinning,B.morphTargets=I.morphTargets,B.morphNormals=I.morphNormals,B.morphColors=I.morphColors,B.morphTargetsCount=I.morphTargetsCount,B.numClippingPlanes=I.numClippingPlanes,B.numIntersection=I.numClipIntersection,B.vertexAlphas=I.vertexAlphas,B.vertexTangents=I.vertexTangents,B.toneMapping=I.toneMapping}function gl(M,I,B,z,O){I.isScene!==!0&&(I=Tt),y.resetTextureUnits();const ht=I.fog,xt=z.isMeshStandardMaterial?I.environment:null,wt=w===null?x.outputColorSpace:w.isXRRenderTarget===!0?w.texture.colorSpace:an,Pt=(z.isMeshStandardMaterial?U:v).get(z.envMap||xt),Ht=z.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,It=!!B.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),Ft=!!B.morphAttributes.position,ie=!!B.morphAttributes.normal,Re=!!B.morphAttributes.color;let ue=_n;z.toneMapped&&(w===null||w.isXRRenderTarget===!0)&&(ue=x.toneMapping);const Ye=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,Qt=Ye!==void 0?Ye.length:0,kt=Ut.get(z),Ps=f.state.lights;if(Y===!0&&(ct===!0||M!==S)){const De=M===S&&z.id===W;Nt.setState(z,M,De)}let ee=!1;z.version===kt.__version?(kt.needsLights&&kt.lightsStateVersion!==Ps.state.version||kt.outputColorSpace!==wt||O.isBatchedMesh&&kt.batching===!1||!O.isBatchedMesh&&kt.batching===!0||O.isInstancedMesh&&kt.instancing===!1||!O.isInstancedMesh&&kt.instancing===!0||O.isSkinnedMesh&&kt.skinning===!1||!O.isSkinnedMesh&&kt.skinning===!0||O.isInstancedMesh&&kt.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&kt.instancingColor===!1&&O.instanceColor!==null||kt.envMap!==Pt||z.fog===!0&&kt.fog!==ht||kt.numClippingPlanes!==void 0&&(kt.numClippingPlanes!==Nt.numPlanes||kt.numIntersection!==Nt.numIntersection)||kt.vertexAlphas!==Ht||kt.vertexTangents!==It||kt.morphTargets!==Ft||kt.morphNormals!==ie||kt.morphColors!==Re||kt.toneMapping!==ue||Rt.isWebGL2===!0&&kt.morphTargetsCount!==Qt)&&(ee=!0):(ee=!0,kt.__version=z.version);let Sn=kt.currentProgram;ee===!0&&(Sn=zi(z,I,O));let Wr=!1,yi=!1,Ls=!1;const _e=Sn.getUniforms(),yn=kt.uniforms;if(pt.useProgram(Sn.program)&&(Wr=!0,yi=!0,Ls=!0),z.id!==W&&(W=z.id,yi=!0),Wr||S!==M){_e.setValue(N,"projectionMatrix",M.projectionMatrix),_e.setValue(N,"viewMatrix",M.matrixWorldInverse);const De=_e.map.cameraPosition;De!==void 0&&De.setValue(N,Dt.setFromMatrixPosition(M.matrixWorld)),Rt.logarithmicDepthBuffer&&_e.setValue(N,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&_e.setValue(N,"isOrthographic",M.isOrthographicCamera===!0),S!==M&&(S=M,yi=!0,Ls=!0)}if(O.isSkinnedMesh){_e.setOptional(N,O,"bindMatrix"),_e.setOptional(N,O,"bindMatrixInverse");const De=O.skeleton;De&&(Rt.floatVertexTextures?(De.boneTexture===null&&De.computeBoneTexture(),_e.setValue(N,"boneTexture",De.boneTexture,y)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}O.isBatchedMesh&&(_e.setOptional(N,O,"batchingTexture"),_e.setValue(N,"batchingTexture",O._matricesTexture,y));const Ds=B.morphAttributes;if((Ds.position!==void 0||Ds.normal!==void 0||Ds.color!==void 0&&Rt.isWebGL2===!0)&&zt.update(O,B,Sn),(yi||kt.receiveShadow!==O.receiveShadow)&&(kt.receiveShadow=O.receiveShadow,_e.setValue(N,"receiveShadow",O.receiveShadow)),z.isMeshGouraudMaterial&&z.envMap!==null&&(yn.envMap.value=Pt,yn.flipEnvMap.value=Pt.isCubeTexture&&Pt.isRenderTargetTexture===!1?-1:1),yi&&(_e.setValue(N,"toneMappingExposure",x.toneMappingExposure),kt.needsLights&&_l(yn,Ls),ht&&z.fog===!0&&lt.refreshFogUniforms(yn,ht),lt.refreshMaterialUniforms(yn,z,q,H,vt),ps.upload(N,Vr(kt),yn,y)),z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(ps.upload(N,Vr(kt),yn,y),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&_e.setValue(N,"center",O.center),_e.setValue(N,"modelViewMatrix",O.modelViewMatrix),_e.setValue(N,"normalMatrix",O.normalMatrix),_e.setValue(N,"modelMatrix",O.matrixWorld),z.isShaderMaterial||z.isRawShaderMaterial){const De=z.uniformsGroups;for(let Is=0,xl=De.length;Is<xl;Is++)if(Rt.isWebGL2){const Xr=De[Is];nt.update(Xr,Sn),nt.bind(Xr,Sn)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Sn}function _l(M,I){M.ambientLightColor.needsUpdate=I,M.lightProbe.needsUpdate=I,M.directionalLights.needsUpdate=I,M.directionalLightShadows.needsUpdate=I,M.pointLights.needsUpdate=I,M.pointLightShadows.needsUpdate=I,M.spotLights.needsUpdate=I,M.spotLightShadows.needsUpdate=I,M.rectAreaLights.needsUpdate=I,M.hemisphereLights.needsUpdate=I}function vl(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return D},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return w},this.setRenderTargetTextures=function(M,I,B){Ut.get(M.texture).__webglTexture=I,Ut.get(M.depthTexture).__webglTexture=B;const z=Ut.get(M);z.__hasExternalTextures=!0,z.__hasExternalTextures&&(z.__autoAllocateDepthBuffer=B===void 0,z.__autoAllocateDepthBuffer||St.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),z.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(M,I){const B=Ut.get(M);B.__webglFramebuffer=I,B.__useDefaultFramebuffer=I===void 0},this.setRenderTarget=function(M,I=0,B=0){w=M,D=I,R=B;let z=!0,O=null,ht=!1,xt=!1;if(M){const Pt=Ut.get(M);Pt.__useDefaultFramebuffer!==void 0?(pt.bindFramebuffer(N.FRAMEBUFFER,null),z=!1):Pt.__webglFramebuffer===void 0?y.setupRenderTarget(M):Pt.__hasExternalTextures&&y.rebindTextures(M,Ut.get(M.texture).__webglTexture,Ut.get(M.depthTexture).__webglTexture);const Ht=M.texture;(Ht.isData3DTexture||Ht.isDataArrayTexture||Ht.isCompressedArrayTexture)&&(xt=!0);const It=Ut.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(It[I])?O=It[I][B]:O=It[I],ht=!0):Rt.isWebGL2&&M.samples>0&&y.useMultisampledRTT(M)===!1?O=Ut.get(M).__webglMultisampledFramebuffer:Array.isArray(It)?O=It[B]:O=It,b.copy(M.viewport),k.copy(M.scissor),V=M.scissorTest}else b.copy(j).multiplyScalar(q).floor(),k.copy(st).multiplyScalar(q).floor(),V=rt;if(pt.bindFramebuffer(N.FRAMEBUFFER,O)&&Rt.drawBuffers&&z&&pt.drawBuffers(M,O),pt.viewport(b),pt.scissor(k),pt.setScissorTest(V),ht){const Pt=Ut.get(M.texture);N.framebufferTexture2D(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_CUBE_MAP_POSITIVE_X+I,Pt.__webglTexture,B)}else if(xt){const Pt=Ut.get(M.texture),Ht=I||0;N.framebufferTextureLayer(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,Pt.__webglTexture,B||0,Ht)}W=-1},this.readRenderTargetPixels=function(M,I,B,z,O,ht,xt){if(!(M&&M.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let wt=Ut.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&xt!==void 0&&(wt=wt[xt]),wt){pt.bindFramebuffer(N.FRAMEBUFFER,wt);try{const Pt=M.texture,Ht=Pt.format,It=Pt.type;if(Ht!==$e&&dt.convert(Ht)!==N.getParameter(N.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const Ft=It===Ni&&(St.has("EXT_color_buffer_half_float")||Rt.isWebGL2&&St.has("EXT_color_buffer_float"));if(It!==vn&&dt.convert(It)!==N.getParameter(N.IMPLEMENTATION_COLOR_READ_TYPE)&&!(It===pn&&(Rt.isWebGL2||St.has("OES_texture_float")||St.has("WEBGL_color_buffer_float")))&&!Ft){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=M.width-z&&B>=0&&B<=M.height-O&&N.readPixels(I,B,z,O,dt.convert(Ht),dt.convert(It),ht)}finally{const Pt=w!==null?Ut.get(w).__webglFramebuffer:null;pt.bindFramebuffer(N.FRAMEBUFFER,Pt)}}},this.copyFramebufferToTexture=function(M,I,B=0){const z=Math.pow(2,-B),O=Math.floor(I.image.width*z),ht=Math.floor(I.image.height*z);y.setTexture2D(I,0),N.copyTexSubImage2D(N.TEXTURE_2D,B,0,0,M.x,M.y,O,ht),pt.unbindTexture()},this.copyTextureToTexture=function(M,I,B,z=0){const O=I.image.width,ht=I.image.height,xt=dt.convert(B.format),wt=dt.convert(B.type);y.setTexture2D(B,0),N.pixelStorei(N.UNPACK_FLIP_Y_WEBGL,B.flipY),N.pixelStorei(N.UNPACK_PREMULTIPLY_ALPHA_WEBGL,B.premultiplyAlpha),N.pixelStorei(N.UNPACK_ALIGNMENT,B.unpackAlignment),I.isDataTexture?N.texSubImage2D(N.TEXTURE_2D,z,M.x,M.y,O,ht,xt,wt,I.image.data):I.isCompressedTexture?N.compressedTexSubImage2D(N.TEXTURE_2D,z,M.x,M.y,I.mipmaps[0].width,I.mipmaps[0].height,xt,I.mipmaps[0].data):N.texSubImage2D(N.TEXTURE_2D,z,M.x,M.y,xt,wt,I.image),z===0&&B.generateMipmaps&&N.generateMipmap(N.TEXTURE_2D),pt.unbindTexture()},this.copyTextureToTexture3D=function(M,I,B,z,O=0){if(x.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const ht=M.max.x-M.min.x+1,xt=M.max.y-M.min.y+1,wt=M.max.z-M.min.z+1,Pt=dt.convert(z.format),Ht=dt.convert(z.type);let It;if(z.isData3DTexture)y.setTexture3D(z,0),It=N.TEXTURE_3D;else if(z.isDataArrayTexture||z.isCompressedArrayTexture)y.setTexture2DArray(z,0),It=N.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}N.pixelStorei(N.UNPACK_FLIP_Y_WEBGL,z.flipY),N.pixelStorei(N.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),N.pixelStorei(N.UNPACK_ALIGNMENT,z.unpackAlignment);const Ft=N.getParameter(N.UNPACK_ROW_LENGTH),ie=N.getParameter(N.UNPACK_IMAGE_HEIGHT),Re=N.getParameter(N.UNPACK_SKIP_PIXELS),ue=N.getParameter(N.UNPACK_SKIP_ROWS),Ye=N.getParameter(N.UNPACK_SKIP_IMAGES),Qt=B.isCompressedTexture?B.mipmaps[O]:B.image;N.pixelStorei(N.UNPACK_ROW_LENGTH,Qt.width),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,Qt.height),N.pixelStorei(N.UNPACK_SKIP_PIXELS,M.min.x),N.pixelStorei(N.UNPACK_SKIP_ROWS,M.min.y),N.pixelStorei(N.UNPACK_SKIP_IMAGES,M.min.z),B.isDataTexture||B.isData3DTexture?N.texSubImage3D(It,O,I.x,I.y,I.z,ht,xt,wt,Pt,Ht,Qt.data):B.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),N.compressedTexSubImage3D(It,O,I.x,I.y,I.z,ht,xt,wt,Pt,Qt.data)):N.texSubImage3D(It,O,I.x,I.y,I.z,ht,xt,wt,Pt,Ht,Qt),N.pixelStorei(N.UNPACK_ROW_LENGTH,Ft),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,ie),N.pixelStorei(N.UNPACK_SKIP_PIXELS,Re),N.pixelStorei(N.UNPACK_SKIP_ROWS,ue),N.pixelStorei(N.UNPACK_SKIP_IMAGES,Ye),O===0&&z.generateMipmaps&&N.generateMipmap(It),pt.unbindTexture()},this.initTexture=function(M){M.isCubeTexture?y.setTextureCube(M,0):M.isData3DTexture?y.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?y.setTexture2DArray(M,0):y.setTexture2D(M,0),pt.unbindTexture()},this.resetState=function(){D=0,R=0,w=null,pt.reset(),A.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=t===Lr?"display-p3":"srgb",e.unpackColorSpace=jt.workingColorSpace===Es?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===pe?Nn:Wo}set outputEncoding(t){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=t===Nn?pe:an}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(t){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=t}}class Tp extends hl{}Tp.prototype.isWebGL1Renderer=!0;class Nr{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Bt(t),this.near=e,this.far=n}clone(){return new Nr(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Ap extends ce{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e}}class wp{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Er,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=xn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,r=this.stride;i<r;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=xn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=xn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Me=new L;class Ss{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix4(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyNormalMatrix(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.transformDirection(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}setX(t,e){return this.normalized&&(e=Yt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Yt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Yt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Yt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=nn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=nn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=nn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=nn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array),i=Yt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Yt(e,this.array),n=Yt(n,this.array),i=Yt(i,this.array),r=Yt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return new ze(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Ss(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class ul extends Hn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Bt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let ri;const wi=new L,ai=new L,oi=new L,li=new Et,Ri=new Et,fl=new re,ls=new L,Ci=new L,cs=new L,uo=new Et,dr=new Et,fo=new Et;class Rp extends ce{constructor(t=new ul){if(super(),this.isSprite=!0,this.type="Sprite",ri===void 0){ri=new we;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new wp(e,5);ri.setIndex([0,1,2,0,2,3]),ri.setAttribute("position",new Ss(n,3,0,!1)),ri.setAttribute("uv",new Ss(n,2,3,!1))}this.geometry=ri,this.material=t,this.center=new Et(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ai.setFromMatrixScale(this.matrixWorld),fl.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),oi.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ai.multiplyScalar(-oi.z);const n=this.material.rotation;let i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));const a=this.center;ds(ls.set(-.5,-.5,0),oi,a,ai,i,r),ds(Ci.set(.5,-.5,0),oi,a,ai,i,r),ds(cs.set(.5,.5,0),oi,a,ai,i,r),uo.set(0,0),dr.set(1,0),fo.set(1,1);let o=t.ray.intersectTriangle(ls,Ci,cs,!1,wi);if(o===null&&(ds(Ci.set(-.5,.5,0),oi,a,ai,i,r),dr.set(0,1),o=t.ray.intersectTriangle(ls,cs,Ci,!1,wi),o===null))return;const l=t.ray.origin.distanceTo(wi);l<t.near||l>t.far||e.push({distance:l,point:wi.clone(),uv:Ne.getInterpolation(wi,ls,Ci,cs,uo,dr,fo,new Et),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function ds(s,t,e,n,i,r){li.subVectors(s,e).addScalar(.5).multiply(n),i!==void 0?(Ri.x=r*li.x-i*li.y,Ri.y=i*li.x+r*li.y):Ri.copy(li),s.copy(t),s.x+=Ri.x,s.y+=Ri.y,s.applyMatrix4(fl)}class Fr extends Hn{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Bt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const po=new L,mo=new L,go=new re,hr=new Ts,hs=new bs;class pl extends ce{constructor(t=new we,e=new Fr){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let i=1,r=e.count;i<r;i++)po.fromBufferAttribute(e,i-1),mo.fromBufferAttribute(e,i),n[i]=n[i-1],n[i]+=po.distanceTo(mo);t.setAttribute("lineDistance",new le(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,r=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),hs.copy(n.boundingSphere),hs.applyMatrix4(i),hs.radius+=r,t.ray.intersectsSphere(hs)===!1)return;go.copy(i).invert(),hr.copy(t.ray).applyMatrix4(go);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=new L,d=new L,u=new L,p=new L,m=this.isLineSegments?2:1,g=n.index,f=n.attributes.position;if(g!==null){const h=Math.max(0,a.start),E=Math.min(g.count,a.start+a.count);for(let x=h,T=E-1;x<T;x+=m){const D=g.getX(x),R=g.getX(x+1);if(c.fromBufferAttribute(f,D),d.fromBufferAttribute(f,R),hr.distanceSqToSegment(c,d,p,u)>l)continue;p.applyMatrix4(this.matrixWorld);const W=t.ray.origin.distanceTo(p);W<t.near||W>t.far||e.push({distance:W,point:u.clone().applyMatrix4(this.matrixWorld),index:x,face:null,faceIndex:null,object:this})}}else{const h=Math.max(0,a.start),E=Math.min(f.count,a.start+a.count);for(let x=h,T=E-1;x<T;x+=m){if(c.fromBufferAttribute(f,x),d.fromBufferAttribute(f,x+1),hr.distanceSqToSegment(c,d,p,u)>l)continue;p.applyMatrix4(this.matrixWorld);const R=t.ray.origin.distanceTo(p);R<t.near||R>t.far||e.push({distance:R,point:u.clone().applyMatrix4(this.matrixWorld),index:x,face:null,faceIndex:null,object:this})}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}const _o=new L,vo=new L;class Cp extends pl{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let i=0,r=e.count;i<r;i+=2)_o.fromBufferAttribute(e,i),vo.fromBufferAttribute(e,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+_o.distanceTo(vo);t.setAttribute("lineDistance",new le(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class xo extends Ae{constructor(t,e,n,i,r,a,o,l,c){super(t,e,n,i,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Rs extends we{constructor(t=1,e=1,n=1,i=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),r=Math.floor(r);const d=[],u=[],p=[],m=[];let g=0;const _=[],f=n/2;let h=0;E(),a===!1&&(t>0&&x(!0),e>0&&x(!1)),this.setIndex(d),this.setAttribute("position",new le(u,3)),this.setAttribute("normal",new le(p,3)),this.setAttribute("uv",new le(m,2));function E(){const T=new L,D=new L;let R=0;const w=(e-t)/n;for(let W=0;W<=r;W++){const S=[],b=W/r,k=b*(e-t)+t;for(let V=0;V<=i;V++){const Q=V/i,P=Q*l+o,F=Math.sin(P),H=Math.cos(P);D.x=k*F,D.y=-b*n+f,D.z=k*H,u.push(D.x,D.y,D.z),T.set(F,w,H).normalize(),p.push(T.x,T.y,T.z),m.push(Q,1-b),S.push(g++)}_.push(S)}for(let W=0;W<i;W++)for(let S=0;S<r;S++){const b=_[S][W],k=_[S+1][W],V=_[S+1][W+1],Q=_[S][W+1];d.push(b,k,Q),d.push(k,V,Q),R+=6}c.addGroup(h,R,0),h+=R}function x(T){const D=g,R=new Et,w=new L;let W=0;const S=T===!0?t:e,b=T===!0?1:-1;for(let V=1;V<=i;V++)u.push(0,f*b,0),p.push(0,b,0),m.push(.5,.5),g++;const k=g;for(let V=0;V<=i;V++){const P=V/i*l+o,F=Math.cos(P),H=Math.sin(P);w.x=S*H,w.y=f*b,w.z=S*F,u.push(w.x,w.y,w.z),p.push(0,b,0),R.x=F*.5+.5,R.y=H*.5*b+.5,m.push(R.x,R.y),g++}for(let V=0;V<i;V++){const Q=D+V,P=k+V;T===!0?d.push(P,P+1,Q):d.push(P+1,P,Q),W+=3}c.addGroup(h,W,T===!0?1:2),h+=W}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Rs(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Or extends Rs{constructor(t=1,e=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new Or(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Fi extends we{constructor(t=.5,e=1,n=32,i=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:a},n=Math.max(3,n),i=Math.max(1,i);const o=[],l=[],c=[],d=[];let u=t;const p=(e-t)/i,m=new L,g=new Et;for(let _=0;_<=i;_++){for(let f=0;f<=n;f++){const h=r+f/n*a;m.x=u*Math.cos(h),m.y=u*Math.sin(h),l.push(m.x,m.y,m.z),c.push(0,0,1),g.x=(m.x/e+1)/2,g.y=(m.y/e+1)/2,d.push(g.x,g.y)}u+=p}for(let _=0;_<i;_++){const f=_*(n+1);for(let h=0;h<n;h++){const E=h+f,x=E,T=E+n+1,D=E+n+2,R=E+1;o.push(x,T,R),o.push(T,D,R)}}this.setIndex(o),this.setAttribute("position",new le(l,3)),this.setAttribute("normal",new le(c,3)),this.setAttribute("uv",new le(d,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Fi(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Cs extends we{constructor(t=1,e=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const d=[],u=new L,p=new L,m=[],g=[],_=[],f=[];for(let h=0;h<=n;h++){const E=[],x=h/n;let T=0;h===0&&a===0?T=.5/e:h===n&&l===Math.PI&&(T=-.5/e);for(let D=0;D<=e;D++){const R=D/e;u.x=-t*Math.cos(i+R*r)*Math.sin(a+x*o),u.y=t*Math.cos(a+x*o),u.z=t*Math.sin(i+R*r)*Math.sin(a+x*o),g.push(u.x,u.y,u.z),p.copy(u).normalize(),_.push(p.x,p.y,p.z),f.push(R+T,1-x),E.push(c++)}d.push(E)}for(let h=0;h<n;h++)for(let E=0;E<e;E++){const x=d[h][E+1],T=d[h][E],D=d[h+1][E],R=d[h+1][E+1];(h!==0||a>0)&&m.push(x,T,R),(h!==n-1||l<Math.PI)&&m.push(T,D,R)}this.setIndex(m),this.setAttribute("position",new le(g,3)),this.setAttribute("normal",new le(_,3)),this.setAttribute("uv",new le(f,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Cs(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class wn extends Hn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new Bt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Bt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xo,this.normalScale=new Et(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Br extends ce{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Bt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),e}}class Pp extends Br{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ce.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Bt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const ur=new re,Mo=new L,So=new L;class Lp{constructor(t){this.camera=t,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Et(512,512),this.map=null,this.mapPass=null,this.matrix=new re,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ir,this._frameExtents=new Et(1,1),this._viewportCount=1,this._viewports=[new me(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Mo.setFromMatrixPosition(t.matrixWorld),e.position.copy(Mo),So.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(So),e.updateMatrixWorld(),ur.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ur),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ur)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class Dp extends Lp{constructor(){super(new sl(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class yo extends Br{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ce.DEFAULT_UP),this.updateMatrix(),this.target=new ce,this.shadow=new Dp}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class Ip extends Br{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}class Up{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Eo(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=Eo();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}function Eo(){return(typeof performance>"u"?Date:performance).now()}class Np{constructor(t,e,n=0,i=1/0){this.ray=new Ts(t,e),this.near=n,this.far=i,this.camera=null,this.layers=new Dr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}intersectObject(t,e=!0,n=[]){return Rr(t,this,n,e),n.sort(bo),n}intersectObjects(t,e=!0,n=[]){for(let i=0,r=t.length;i<r;i++)Rr(t[i],this,n,e);return n.sort(bo),n}}function bo(s,t){return s.distance-t.distance}function Rr(s,t,e,n){if(s.layers.test(t.layers)&&s.raycast(t,e),n===!0){const i=s.children;for(let r=0,a=i.length;r<a;r++)Rr(i[r],t,e,!0)}}class To{constructor(t=1,e=0,n=0){return this.radius=t,this.phi=e,this.theta=n,this}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(Ee(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class Fp extends Cp{constructor(t=10,e=10,n=4473924,i=8947848){n=new Bt(n),i=new Bt(i);const r=e/2,a=t/e,o=t/2,l=[],c=[];for(let p=0,m=0,g=-o;p<=e;p++,g+=a){l.push(-o,0,g,o,0,g),l.push(g,0,-o,g,0,o);const _=p===r?n:i;_.toArray(c,m),m+=3,_.toArray(c,m),m+=3,_.toArray(c,m),m+=3,_.toArray(c,m),m+=3}const d=new we;d.setAttribute("position",new le(l,3)),d.setAttribute("color",new le(c,3));const u=new Fr({vertexColors:!0,toneMapped:!1});super(d,u),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Cr}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Cr);const Ao={type:"change"},fr={type:"start"},wo={type:"end"},us=new Ts,Ro=new un,Op=Math.cos(70*vc.DEG2RAD);class Bp extends zn{constructor(t,e){super(),this.object=t,this.domElement=e,this.domElement.style.touchAction="none",this.enabled=!0,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:kn.ROTATE,MIDDLE:kn.DOLLY,RIGHT:kn.PAN},this.touches={ONE:Vn.ROTATE,TWO:Vn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this.getPolarAngle=function(){return o.phi},this.getAzimuthalAngle=function(){return o.theta},this.getDistance=function(){return this.object.position.distanceTo(this.target)},this.listenToKeyEvents=function(A){A.addEventListener("keydown",bt),this._domElementKeyEvents=A},this.stopListenToKeyEvents=function(){this._domElementKeyEvents.removeEventListener("keydown",bt),this._domElementKeyEvents=null},this.saveState=function(){n.target0.copy(n.target),n.position0.copy(n.object.position),n.zoom0=n.object.zoom},this.reset=function(){n.target.copy(n.target0),n.object.position.copy(n.position0),n.object.zoom=n.zoom0,n.object.updateProjectionMatrix(),n.dispatchEvent(Ao),n.update(),r=i.NONE},this.update=function(){const A=new L,nt=new On().setFromUnitVectors(t.up,new L(0,1,0)),_t=nt.clone().invert(),ut=new L,J=new On,C=new L,it=2*Math.PI;return function(At=null){const yt=n.object.position;A.copy(yt).sub(n.target),A.applyQuaternion(nt),o.setFromVector3(A),n.autoRotate&&r===i.NONE&&V(b(At)),n.enableDamping?(o.theta+=l.theta*n.dampingFactor,o.phi+=l.phi*n.dampingFactor):(o.theta+=l.theta,o.phi+=l.phi);let Wt=n.minAzimuthAngle,Xt=n.maxAzimuthAngle;isFinite(Wt)&&isFinite(Xt)&&(Wt<-Math.PI?Wt+=it:Wt>Math.PI&&(Wt-=it),Xt<-Math.PI?Xt+=it:Xt>Math.PI&&(Xt-=it),Wt<=Xt?o.theta=Math.max(Wt,Math.min(Xt,o.theta)):o.theta=o.theta>(Wt+Xt)/2?Math.max(Wt,o.theta):Math.min(Xt,o.theta)),o.phi=Math.max(n.minPolarAngle,Math.min(n.maxPolarAngle,o.phi)),o.makeSafe(),n.enableDamping===!0?n.target.addScaledVector(d,n.dampingFactor):n.target.add(d),n.target.sub(n.cursor),n.target.clampLength(n.minTargetRadius,n.maxTargetRadius),n.target.add(n.cursor),n.zoomToCursor&&R||n.object.isOrthographicCamera?o.radius=j(o.radius):o.radius=j(o.radius*c),A.setFromSpherical(o),A.applyQuaternion(_t),yt.copy(n.target).add(A),n.object.lookAt(n.target),n.enableDamping===!0?(l.theta*=1-n.dampingFactor,l.phi*=1-n.dampingFactor,d.multiplyScalar(1-n.dampingFactor)):(l.set(0,0,0),d.set(0,0,0));let te=!1;if(n.zoomToCursor&&R){let ne=null;if(n.object.isPerspectiveCamera){const $t=A.length();ne=j($t*c);const ae=$t-ne;n.object.position.addScaledVector(T,ae),n.object.updateMatrixWorld()}else if(n.object.isOrthographicCamera){const $t=new L(D.x,D.y,0);$t.unproject(n.object),n.object.zoom=Math.max(n.minZoom,Math.min(n.maxZoom,n.object.zoom/c)),n.object.updateProjectionMatrix(),te=!0;const ae=new L(D.x,D.y,0);ae.unproject(n.object),n.object.position.sub(ae).add($t),n.object.updateMatrixWorld(),ne=A.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),n.zoomToCursor=!1;ne!==null&&(this.screenSpacePanning?n.target.set(0,0,-1).transformDirection(n.object.matrix).multiplyScalar(ne).add(n.object.position):(us.origin.copy(n.object.position),us.direction.set(0,0,-1).transformDirection(n.object.matrix),Math.abs(n.object.up.dot(us.direction))<Op?t.lookAt(n.target):(Ro.setFromNormalAndCoplanarPoint(n.object.up,n.target),us.intersectPlane(Ro,n.target))))}else n.object.isOrthographicCamera&&(n.object.zoom=Math.max(n.minZoom,Math.min(n.maxZoom,n.object.zoom/c)),n.object.updateProjectionMatrix(),te=!0);return c=1,R=!1,te||ut.distanceToSquared(n.object.position)>a||8*(1-J.dot(n.object.quaternion))>a||C.distanceToSquared(n.target)>0?(n.dispatchEvent(Ao),ut.copy(n.object.position),J.copy(n.object.quaternion),C.copy(n.target),!0):!1}}(),this.dispose=function(){n.domElement.removeEventListener("contextmenu",qt),n.domElement.removeEventListener("pointerdown",y),n.domElement.removeEventListener("pointercancel",U),n.domElement.removeEventListener("wheel",et),n.domElement.removeEventListener("pointermove",v),n.domElement.removeEventListener("pointerup",U),n._domElementKeyEvents!==null&&(n._domElementKeyEvents.removeEventListener("keydown",bt),n._domElementKeyEvents=null)};const n=this,i={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6};let r=i.NONE;const a=1e-6,o=new To,l=new To;let c=1;const d=new L,u=new Et,p=new Et,m=new Et,g=new Et,_=new Et,f=new Et,h=new Et,E=new Et,x=new Et,T=new L,D=new Et;let R=!1;const w=[],W={};let S=!1;function b(A){return A!==null?2*Math.PI/60*n.autoRotateSpeed*A:2*Math.PI/60/60*n.autoRotateSpeed}function k(A){const nt=Math.abs(A*.01);return Math.pow(.95,n.zoomSpeed*nt)}function V(A){l.theta-=A}function Q(A){l.phi-=A}const P=function(){const A=new L;return function(_t,ut){A.setFromMatrixColumn(ut,0),A.multiplyScalar(-_t),d.add(A)}}(),F=function(){const A=new L;return function(_t,ut){n.screenSpacePanning===!0?A.setFromMatrixColumn(ut,1):(A.setFromMatrixColumn(ut,0),A.crossVectors(n.object.up,A)),A.multiplyScalar(_t),d.add(A)}}(),H=function(){const A=new L;return function(_t,ut){const J=n.domElement;if(n.object.isPerspectiveCamera){const C=n.object.position;A.copy(C).sub(n.target);let it=A.length();it*=Math.tan(n.object.fov/2*Math.PI/180),P(2*_t*it/J.clientHeight,n.object.matrix),F(2*ut*it/J.clientHeight,n.object.matrix)}else n.object.isOrthographicCamera?(P(_t*(n.object.right-n.object.left)/n.object.zoom/J.clientWidth,n.object.matrix),F(ut*(n.object.top-n.object.bottom)/n.object.zoom/J.clientHeight,n.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),n.enablePan=!1)}}();function q(A){n.object.isPerspectiveCamera||n.object.isOrthographicCamera?c/=A:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),n.enableZoom=!1)}function X(A){n.object.isPerspectiveCamera||n.object.isOrthographicCamera?c*=A:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),n.enableZoom=!1)}function $(A,nt){if(!n.zoomToCursor)return;R=!0;const _t=n.domElement.getBoundingClientRect(),ut=A-_t.left,J=nt-_t.top,C=_t.width,it=_t.height;D.x=ut/C*2-1,D.y=-(J/it)*2+1,T.set(D.x,D.y,1).unproject(n.object).sub(n.object.position).normalize()}function j(A){return Math.max(n.minDistance,Math.min(n.maxDistance,A))}function st(A){u.set(A.clientX,A.clientY)}function rt(A){$(A.clientX,A.clientX),h.set(A.clientX,A.clientY)}function G(A){g.set(A.clientX,A.clientY)}function Y(A){p.set(A.clientX,A.clientY),m.subVectors(p,u).multiplyScalar(n.rotateSpeed);const nt=n.domElement;V(2*Math.PI*m.x/nt.clientHeight),Q(2*Math.PI*m.y/nt.clientHeight),u.copy(p),n.update()}function ct(A){E.set(A.clientX,A.clientY),x.subVectors(E,h),x.y>0?q(k(x.y)):x.y<0&&X(k(x.y)),h.copy(E),n.update()}function vt(A){_.set(A.clientX,A.clientY),f.subVectors(_,g).multiplyScalar(n.panSpeed),H(f.x,f.y),g.copy(_),n.update()}function gt(A){$(A.clientX,A.clientY),A.deltaY<0?X(k(A.deltaY)):A.deltaY>0&&q(k(A.deltaY)),n.update()}function Lt(A){let nt=!1;switch(A.code){case n.keys.UP:A.ctrlKey||A.metaKey||A.shiftKey?Q(2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):H(0,n.keyPanSpeed),nt=!0;break;case n.keys.BOTTOM:A.ctrlKey||A.metaKey||A.shiftKey?Q(-2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):H(0,-n.keyPanSpeed),nt=!0;break;case n.keys.LEFT:A.ctrlKey||A.metaKey||A.shiftKey?V(2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):H(n.keyPanSpeed,0),nt=!0;break;case n.keys.RIGHT:A.ctrlKey||A.metaKey||A.shiftKey?V(-2*Math.PI*n.rotateSpeed/n.domElement.clientHeight):H(-n.keyPanSpeed,0),nt=!0;break}nt&&(A.preventDefault(),n.update())}function Dt(A){if(w.length===1)u.set(A.pageX,A.pageY);else{const nt=dt(A),_t=.5*(A.pageX+nt.x),ut=.5*(A.pageY+nt.y);u.set(_t,ut)}}function Tt(A){if(w.length===1)g.set(A.pageX,A.pageY);else{const nt=dt(A),_t=.5*(A.pageX+nt.x),ut=.5*(A.pageY+nt.y);g.set(_t,ut)}}function Gt(A){const nt=dt(A),_t=A.pageX-nt.x,ut=A.pageY-nt.y,J=Math.sqrt(_t*_t+ut*ut);h.set(0,J)}function N(A){n.enableZoom&&Gt(A),n.enablePan&&Tt(A)}function ge(A){n.enableZoom&&Gt(A),n.enableRotate&&Dt(A)}function St(A){if(w.length==1)p.set(A.pageX,A.pageY);else{const _t=dt(A),ut=.5*(A.pageX+_t.x),J=.5*(A.pageY+_t.y);p.set(ut,J)}m.subVectors(p,u).multiplyScalar(n.rotateSpeed);const nt=n.domElement;V(2*Math.PI*m.x/nt.clientHeight),Q(2*Math.PI*m.y/nt.clientHeight),u.copy(p)}function Rt(A){if(w.length===1)_.set(A.pageX,A.pageY);else{const nt=dt(A),_t=.5*(A.pageX+nt.x),ut=.5*(A.pageY+nt.y);_.set(_t,ut)}f.subVectors(_,g).multiplyScalar(n.panSpeed),H(f.x,f.y),g.copy(_)}function pt(A){const nt=dt(A),_t=A.pageX-nt.x,ut=A.pageY-nt.y,J=Math.sqrt(_t*_t+ut*ut);E.set(0,J),x.set(0,Math.pow(E.y/h.y,n.zoomSpeed)),q(x.y),h.copy(E);const C=(A.pageX+nt.x)*.5,it=(A.pageY+nt.y)*.5;$(C,it)}function Kt(A){n.enableZoom&&pt(A),n.enablePan&&Rt(A)}function Ut(A){n.enableZoom&&pt(A),n.enableRotate&&St(A)}function y(A){n.enabled!==!1&&(w.length===0&&(n.domElement.setPointerCapture(A.pointerId),n.domElement.addEventListener("pointermove",v),n.domElement.addEventListener("pointerup",U)),zt(A),A.pointerType==="touch"?Nt(A):tt(A))}function v(A){n.enabled!==!1&&(A.pointerType==="touch"?K(A):Z(A))}function U(A){Ct(A),w.length===0&&(n.domElement.releasePointerCapture(A.pointerId),n.domElement.removeEventListener("pointermove",v),n.domElement.removeEventListener("pointerup",U)),n.dispatchEvent(wo),r=i.NONE}function tt(A){let nt;switch(A.button){case 0:nt=n.mouseButtons.LEFT;break;case 1:nt=n.mouseButtons.MIDDLE;break;case 2:nt=n.mouseButtons.RIGHT;break;default:nt=-1}switch(nt){case kn.DOLLY:if(n.enableZoom===!1)return;rt(A),r=i.DOLLY;break;case kn.ROTATE:if(A.ctrlKey||A.metaKey||A.shiftKey){if(n.enablePan===!1)return;G(A),r=i.PAN}else{if(n.enableRotate===!1)return;st(A),r=i.ROTATE}break;case kn.PAN:if(A.ctrlKey||A.metaKey||A.shiftKey){if(n.enableRotate===!1)return;st(A),r=i.ROTATE}else{if(n.enablePan===!1)return;G(A),r=i.PAN}break;default:r=i.NONE}r!==i.NONE&&n.dispatchEvent(fr)}function Z(A){switch(r){case i.ROTATE:if(n.enableRotate===!1)return;Y(A);break;case i.DOLLY:if(n.enableZoom===!1)return;ct(A);break;case i.PAN:if(n.enablePan===!1)return;vt(A);break}}function et(A){n.enabled===!1||n.enableZoom===!1||r!==i.NONE||(A.preventDefault(),n.dispatchEvent(fr),gt(mt(A)),n.dispatchEvent(wo))}function mt(A){const nt=A.deltaMode,_t={clientX:A.clientX,clientY:A.clientY,deltaY:A.deltaY};switch(nt){case 1:_t.deltaY*=16;break;case 2:_t.deltaY*=100;break}return A.ctrlKey&&!S&&(_t.deltaY*=10),_t}function lt(A){A.key==="Control"&&(S=!0,document.addEventListener("keyup",ft,{passive:!0,capture:!0}))}function ft(A){A.key==="Control"&&(S=!1,document.removeEventListener("keyup",ft,{passive:!0,capture:!0}))}function bt(A){n.enabled===!1||n.enablePan===!1||Lt(A)}function Nt(A){switch(Mt(A),w.length){case 1:switch(n.touches.ONE){case Vn.ROTATE:if(n.enableRotate===!1)return;Dt(A),r=i.TOUCH_ROTATE;break;case Vn.PAN:if(n.enablePan===!1)return;Tt(A),r=i.TOUCH_PAN;break;default:r=i.NONE}break;case 2:switch(n.touches.TWO){case Vn.DOLLY_PAN:if(n.enableZoom===!1&&n.enablePan===!1)return;N(A),r=i.TOUCH_DOLLY_PAN;break;case Vn.DOLLY_ROTATE:if(n.enableZoom===!1&&n.enableRotate===!1)return;ge(A),r=i.TOUCH_DOLLY_ROTATE;break;default:r=i.NONE}break;default:r=i.NONE}r!==i.NONE&&n.dispatchEvent(fr)}function K(A){switch(Mt(A),r){case i.TOUCH_ROTATE:if(n.enableRotate===!1)return;St(A),n.update();break;case i.TOUCH_PAN:if(n.enablePan===!1)return;Rt(A),n.update();break;case i.TOUCH_DOLLY_PAN:if(n.enableZoom===!1&&n.enablePan===!1)return;Kt(A),n.update();break;case i.TOUCH_DOLLY_ROTATE:if(n.enableZoom===!1&&n.enableRotate===!1)return;Ut(A),n.update();break;default:r=i.NONE}}function qt(A){n.enabled!==!1&&A.preventDefault()}function zt(A){w.push(A.pointerId)}function Ct(A){delete W[A.pointerId];for(let nt=0;nt<w.length;nt++)if(w[nt]==A.pointerId){w.splice(nt,1);return}}function Mt(A){let nt=W[A.pointerId];nt===void 0&&(nt=new Et,W[A.pointerId]=nt),nt.set(A.pageX,A.pageY)}function dt(A){const nt=A.pointerId===w[0]?w[1]:w[0];return W[nt]}n.domElement.addEventListener("contextmenu",qt),n.domElement.addEventListener("pointerdown",y),n.domElement.addEventListener("pointercancel",U),n.domElement.addEventListener("wheel",et,{passive:!1}),document.addEventListener("keydown",lt,{passive:!0,capture:!0}),this.update()}}const Rn={accent:16498468,floor:2763326,wall:4013404,artwork:9133302},se={PERSPECTIVE:"perspective",TOP:"top",FRONT:"front",SIDE:"side",ORBIT:"orbit"},sn={NORMAL:"normal",HEATMAP:"heatmap",PATH:"path",COMBINED:"combined"},Ge={SKIP:"skip",OVERWRITE:"overwrite",APPEND:"append"},gi={JSON:"json",HTML:"html",CSV:"csv"},ci={RECORDS:"gallery_heatmap_records",CURRENT_RECORD:"gallery_heatmap_current",SETTINGS:"gallery_heatmap_settings"},Co={heatmapOpacity:.6,heatmapRadius:2.5,pathOpacity:.8,pathWidth:2,animationSpeed:1,showLabels:!0,showGrid:!0,showFloorPlan:!0,activeFloor:1,viewMode:"perspective",visualMode:"combined"},be={width:40,height:6,depth:30,wallThickness:.5,floorCount:2};class zp{constructor(t){this.container=t,this.scene=null,this.camera=null,this.renderer=null,this.controls=null,this.animationId=null,this.objects={gallery:null,artworks:new Map,paths:new Map,heatmap:null,visitors:new Map,labels:new Map,grid:null},this.viewMode=se.PERSPECTIVE,this.onAnimationFrame=null,this.clock=new Up,this.cameraPositions={[se.PERSPECTIVE]:{pos:new L(50,40,50),target:new L(0,0,0)},[se.TOP]:{pos:new L(0,80,.1),target:new L(0,0,0)},[se.FRONT]:{pos:new L(0,15,60),target:new L(0,0,0)},[se.SIDE]:{pos:new L(60,15,0),target:new L(0,0,0)}},this.raycaster=new Np,this.mouse=new Et,this.hoveredObject=null,this.onObjectHover=null,this.onObjectClick=null}init(){this.createScene(),this.createCamera(),this.createRenderer(),this.createControls(),this.createLighting(),this.createGallery(),this.setupEventListeners(),this.animate()}createScene(){this.scene=new Ap,this.scene.background=new Bt(986906),this.scene.fog=new Nr(986906,80,150)}createCamera(){const{clientWidth:t,clientHeight:e}=this.container;this.camera=new Fe(60,t/e,.1,1e3),this.setViewMode(se.PERSPECTIVE)}createRenderer(){const{clientWidth:t,clientHeight:e}=this.container;this.renderer=new hl({antialias:!0,alpha:!0}),this.renderer.setSize(t,e),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Io,this.renderer.outputColorSpace=pe,this.renderer.toneMapping=No,this.renderer.toneMappingExposure=1,this.container.appendChild(this.renderer.domElement)}createControls(){this.controls=new Bp(this.camera,this.renderer.domElement),this.controls.enableDamping=!0,this.controls.dampingFactor=.05,this.controls.minDistance=5,this.controls.maxDistance=150,this.controls.maxPolarAngle=Math.PI/2.1,this.controls.target.set(0,0,0)}createLighting(){const t=new Ip(16777215,.4);this.scene.add(t);const e=new yo(16777215,.8);e.position.set(30,50,30),e.castShadow=!0,e.shadow.mapSize.width=2048,e.shadow.mapSize.height=2048,e.shadow.camera.near=.5,e.shadow.camera.far=200,e.shadow.camera.left=-60,e.shadow.camera.right=60,e.shadow.camera.top=60,e.shadow.camera.bottom=-60,this.scene.add(e);const n=new yo(8947967,.3);n.position.set(-30,20,-30),this.scene.add(n);const i=new Pp(8900331,2763326,.3);this.scene.add(i)}createGallery(){const t=new Dn;t.name="gallery";const{width:e,height:n,depth:i,wallThickness:r,floorCount:a}=be;for(let o=0;o<a;o++){const l=o*n,c=new mi(e,i),d=new wn({color:Rn.floor,roughness:.8,metalness:.1}),u=new Jt(c,d);u.rotation.x=-Math.PI/2,u.position.y=l,u.receiveShadow=!0,u.userData.floor=o+1,u.name=`floor_${o+1}`,t.add(u);const p=new Fp(Math.max(e,i),Math.max(e,i)/2,4473958,3355477);p.position.y=l+.01,p.userData.floor=o+1,p.name=`grid_${o+1}`,t.add(p),this.objects.grid=p;const m=new wn({color:Rn.wall,roughness:.9,metalness:.1}),g=new Jt(new We(e,n,r),m);g.position.set(0,l+n/2,-i/2),g.castShadow=!0,g.receiveShadow=!0,g.userData.floor=o+1,t.add(g);const _=new Jt(new We(e/3,n,r),m);_.position.set(-e/3,l+n/2,i/2),_.castShadow=!0,_.receiveShadow=!0,_.userData.floor=o+1,t.add(_);const f=new Jt(new We(e/3,n,r),m);f.position.set(e/3,l+n/2,i/2),f.castShadow=!0,f.receiveShadow=!0,f.userData.floor=o+1,t.add(f);const h=new Jt(new We(r,n,i),m);h.position.set(-e/2,l+n/2,0),h.castShadow=!0,h.receiveShadow=!0,h.userData.floor=o+1,t.add(h);const E=new Jt(new We(r,n,i),m);E.position.set(e/2,l+n/2,0),E.castShadow=!0,E.receiveShadow=!0,E.userData.floor=o+1,t.add(E);const x=this.createEntranceMarker(l);t.add(x)}this.objects.gallery=t,this.scene.add(t)}createEntranceMarker(t){const e=new Dn,n=new Or(1,2,4),i=new wn({color:Rn.accent,emissive:Rn.accent,emissiveIntensity:.3}),r=new Jt(n,i);r.rotation.x=Math.PI/2,r.position.y=t+1,r.position.z=be.depth/2+2,e.add(r);const a=new Fi(1.5,2,32),o=new mn({color:Rn.accent,side:Oe,transparent:!0,opacity:.6}),l=new Jt(a,o);return l.rotation.x=-Math.PI/2,l.position.y=t+.02,l.position.z=be.depth/2+2,e.add(l),e.userData.isEntrance=!0,e}setupEventListeners(){this.renderer.domElement.addEventListener("mousemove",t=>this.onMouseMove(t)),this.renderer.domElement.addEventListener("click",t=>this.onMouseClick(t))}onMouseMove(t){const e=this.renderer.domElement.getBoundingClientRect();this.mouse.x=(t.clientX-e.left)/e.width*2-1,this.mouse.y=-((t.clientY-e.top)/e.height)*2+1,this.raycaster.setFromCamera(this.mouse,this.camera);const n=[];this.objects.artworks.forEach(r=>n.push(r.mesh));const i=this.raycaster.intersectObjects(n);if(i.length>0){const r=i[0].object;this.hoveredObject!==r&&(this.hoveredObject&&this.restoreObjectMaterial(this.hoveredObject),this.hoveredObject=r,this.highlightObject(r),this.onObjectHover&&r.userData.artworkData&&this.onObjectHover(r.userData.artworkData))}else this.hoveredObject&&(this.restoreObjectMaterial(this.hoveredObject),this.hoveredObject=null,this.onObjectHover&&this.onObjectHover(null))}onMouseClick(t){if(!this.hoveredObject)return;this.raycaster.setFromCamera(this.mouse,this.camera);const e=[];this.objects.artworks.forEach(i=>e.push(i.mesh));const n=this.raycaster.intersectObjects(e);n.length>0&&this.onObjectClick&&this.onObjectClick(n[0].object.userData.artworkData)}highlightObject(t){t.material.emissive=new Bt(Rn.accent),t.material.emissiveIntensity=.3,document.body.style.cursor="pointer"}restoreObjectMaterial(t){t.material.emissive=new Bt(0),t.material.emissiveIntensity=0,document.body.style.cursor="default"}setViewMode(t){this.viewMode=t;const e=this.cameraPositions[t];if(e){if(t===se.ORBIT){this.controls.enabled=!0;return}this.camera.position.copy(e.pos),this.controls.target.copy(e.target),this.controls.update(),t===se.TOP?this.controls.enabled=!1:this.controls.enabled=!0}}setFloorVisibility(t,e){this.objects.gallery&&this.objects.gallery.traverse(n=>{n.userData.floor!==void 0&&n.userData.floor!==null&&(n.userData.floor===t||n.userData.floor<t)&&(n.visible=e)}),this.objects.artworks.forEach(n=>{n.data.floor===t&&(n.mesh.visible=e,n.label.visible=e)})}setFloorOpacity(t,e){this.objects.gallery.traverse(n=>{n.userData.floor!==void 0&&n.userData.floor!==null&&n.userData.floor>t&&n.material&&(n.material.transparent=!0,n.material.opacity=e)})}addArtwork(t){const e=new Dn,n=new We(t.width||3,t.height||2,.2),i=new wn({color:9127187,roughness:.7,metalness:.3}),r=new Jt(n,i);r.castShadow=!0,r.receiveShadow=!0;const a=new mi((t.width||3)-.3,(t.height||2)-.3),o=t.color||Rn.artwork,l=new wn({color:o,roughness:.9,metalness:.1,emissive:o,emissiveIntensity:.1}),c=new Jt(a,l);c.position.z=.11,r.add(c),new wn({color:0,emissive:o,emissiveIntensity:.4});const{height:d}=be,u=((t.floor||1)-1)*d;e.position.set(t.x||0,u+(t.height||2)/2+1,t.z||0),e.rotation.y=t.rotation||0,r.userData.artworkData=t,c.userData.artworkData=t,e.userData.artworkData=t;const p=this.createLabel(t.name,new L(0,(t.height||2)/2+.5,0));return e.add(p),this.objects.artworks.set(t.id,{mesh:c,frame:r,data:t,label:p,group:e}),this.objects.gallery.add(e),e}createLabel(t,e){const n=document.createElement("canvas"),i=n.getContext("2d");n.width=256,n.height=64,i.fillStyle="rgba(0, 0, 0, 0)",i.fillRect(0,0,n.width,n.height),i.font="bold 24px Arial",i.fillStyle="#ffffff",i.textAlign="center",i.fillText(t,n.width/2,n.height/2+8);const r=new xo(n),a=new ul({map:r,transparent:!0}),o=new Rp(a);return o.position.copy(e),o.scale.set(4,1,1),o.userData.isLabel=!0,o}clearArtworks(){this.objects.artworks.forEach(t=>{this.objects.gallery.remove(t.group)}),this.objects.artworks.clear()}addVisitorPath(t,e=16711680){const n=new Cs(.4,16,16),i=new wn({color:e,emissive:e,emissiveIntensity:.5}),r=new Jt(n,i);r.castShadow=!0,this.scene.add(r);const a=new we,o=new Fr({color:e,transparent:!0,opacity:.6}),l=new pl(a,o);return this.scene.add(l),this.objects.visitors.set(t,{mesh:r,trail:l,trailPoints:[],path:[],currentIndex:0,color:e}),{mesh:r,trail:l}}updateVisitorPosition(t,e,n=!0){const i=this.objects.visitors.get(t);if(i&&(i.mesh.position.copy(e),n)){i.trailPoints.push(e.clone());const r=new Float32Array(i.trailPoints.length*3);i.trailPoints.forEach((a,o)=>{r[o*3]=a.x,r[o*3+1]=a.y,r[o*3+2]=a.z}),i.trail.geometry.setAttribute("position",new ze(r,3)),i.trail.geometry.computeBoundingSphere()}}clearVisitors(){this.objects.visitors.forEach(t=>{this.scene.remove(t.mesh),this.scene.remove(t.trail)}),this.objects.visitors.clear()}createHeatmap(t,e=1){this.objects.heatmap&&this.scene.remove(this.objects.heatmap);const{width:n,depth:i,height:r}=be,a=(e-1)*r,o=document.createElement("canvas");o.width=256,o.height=256;const l=o.getContext("2d"),c=l.createRadialGradient(128,128,0,128,128,128);c.addColorStop(0,"rgba(255, 0, 0, 0.8)"),c.addColorStop(.5,"rgba(255, 255, 0, 0.4)"),c.addColorStop(1,"rgba(0, 255, 0, 0)"),l.fillStyle="rgba(0, 0, 0, 0)",l.fillRect(0,0,256,256);const d=Math.max(...t.map(_=>_.value),1);t.forEach(_=>{const f=(_.x+n/2)/n*256,h=(_.z+i/2)/i*256,E=_.value/d,x=10+E*40,T=l.createRadialGradient(f,h,0,f,h,x);T.addColorStop(0,`rgba(255, ${Math.floor(255*(1-E))}, 0, ${.6*E})`),T.addColorStop(1,"rgba(0, 0, 0, 0)"),l.fillStyle=T,l.beginPath(),l.arc(f,h,x,0,Math.PI*2),l.fill()});const u=new xo(o),p=new mn({map:u,transparent:!0,opacity:.7,depthWrite:!1}),m=new mi(n,i),g=new Jt(m,p);return g.rotation.x=-Math.PI/2,g.position.y=a+.05,g.userData.floor=e,this.objects.heatmap=g,this.scene.add(g),g}clearHeatmap(){this.objects.heatmap&&(this.scene.remove(this.objects.heatmap),this.objects.heatmap=null)}setLabelsVisible(t){this.objects.artworks.forEach(e=>{e.label.visible=t})}setGridVisible(t){this.objects.grid.visible=t}resize(){const{clientWidth:t,clientHeight:e}=this.container;this.camera.aspect=t/e,this.camera.updateProjectionMatrix(),this.renderer.setSize(t,e)}animate(){this.animationId=requestAnimationFrame(()=>this.animate());const t=this.clock.getDelta();this.controls.update(),this.onAnimationFrame&&this.onAnimationFrame(t),this.objects.visitors.forEach(e=>{e.mesh.rotation.y+=t*2}),this.renderer.render(this.scene,this.camera)}dispose(){this.animationId&&cancelAnimationFrame(this.animationId),this.renderer.dispose(),this.objects.controls.dispose()}}function pr(){return Date.now().toString(36)+Math.random().toString(36).substr(2)}function Po(s){const t=Math.floor(s/3600),e=Math.floor(s%3600/60),n=Math.floor(s%60);return t>0?`${t.toString().padStart(2,"0")}:${e.toString().padStart(2,"0")}:${n.toString().padStart(2,"0")}`:`${e.toString().padStart(2,"0")}:${n.toString().padStart(2,"0")}`}function Le(s){return new Date(s).toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}function Di(s){if(s<60)return`${Math.round(s)}秒`;if(s<3600)return`${Math.round(s/60)}分钟`;const t=Math.floor(s/3600),e=Math.round(s%3600/60);return`${t}小时${e}分钟`}function Pi(s,t){return Math.sqrt(Math.pow(t.x-s.x,2)+Math.pow(t.z-s.z,2))}function mr(s,t,e){return s+(t-s)*e}function Hp(s,t,e){return{x:mr(s.x,t.x,e),y:mr(s.y,t.y,e),z:mr(s.z,t.z,e)}}function Ii(s,t,e="application/json"){const n=new Blob([s],{type:e}),i=URL.createObjectURL(n),r=document.createElement("a");r.href=i,r.download=t,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(i)}function kp(s){return new Promise((t,e)=>{const n=new FileReader;n.onload=i=>t(i.target.result),n.onerror=i=>e(i),n.readAsText(s)})}function Vp(s){return kp(s).then(t=>JSON.parse(t))}function Gp(s){let t=0;for(let e=0;e<s.length;e++){const n=s.charCodeAt(e);t=(t<<5)-t+n,t=t&t}return Math.abs(t).toString(16)}function Lo(s,t){return s.reduce((e,n)=>{const i=typeof t=="function"?t(n):n[t];return e[i]||(e[i]=[]),e[i].push(n),e},{})}function Wp(s,t){const e=new Set;return s.filter(n=>{const i=n[t];return e.has(i)?!1:(e.add(i),!0)})}function di(s){return s.length===0?0:s.reduce((t,e)=>t+e,0)/s.length}function gr(s){if(s.length===0)return 0;const t=[...s].sort((n,i)=>n-i),e=Math.floor(t.length/2);return t.length%2?t[e]:(t[e-1]+t[e])/2}class Xp{constructor(){this.records=[],this.currentRecordId=null,this.settings={...Co},this.importedFiles=new Map,this.loadFromStorage()}loadFromStorage(){try{const t=localStorage.getItem(ci.RECORDS);t&&(this.records=JSON.parse(t));const e=localStorage.getItem(ci.CURRENT_RECORD);e&&(this.currentRecordId=e);const n=localStorage.getItem(ci.SETTINGS);n&&(this.settings={...Co,...JSON.parse(n)})}catch(t){console.error("加载存储数据失败:",t)}}saveToStorage(){try{localStorage.setItem(ci.RECORDS,JSON.stringify(this.records)),localStorage.setItem(ci.CURRENT_RECORD,this.currentRecordId||""),localStorage.setItem(ci.SETTINGS,JSON.stringify(this.settings))}catch(t){console.error("保存存储数据失败:",t)}}async importFiles(t,e){const n={success:[],skipped:[],errors:[],conflicts:[]};for(const i of t)try{const r=await this.generateFileHash(i),a=this.importedFiles.get(r);if(a){n.conflicts.push({file:i.name,hash:r,existingRecordId:a.recordId,existingRecordName:a.recordName,importedAt:a.importedAt,reason:"该文件已导入过",action:Ge.SKIP});continue}let o;try{o=await Vp(i)}catch{n.errors.push({file:i.name,error:"文件格式错误，不是有效的JSON"});continue}const l=this.validateData(o);if(!l.valid){n.errors.push({file:i.name,error:l.error});continue}n.success.push({file:i.name,hash:r,data:o})}catch(r){n.errors.push({file:i.name,error:r.message})}if(n.conflicts.length>0&&e){const i=await e(n.conflicts);for(const r of i)r.action===Ge.SKIP?n.skipped.push({file:r.file,reason:"用户选择跳过"}):r.action===Ge.OVERWRITE&&n.success.find(o=>o.file===r.file)&&this.deleteRecord(r.existingRecordId)}for(const i of n.success){const r=this.createRecord(i.data,i.file);this.importedFiles.set(i.hash,{recordId:r.id,recordName:r.name,importedAt:Date.now(),fileName:i.file})}return this.saveToStorage(),n}async generateFileHash(t){return new Promise(e=>{const n=new FileReader;n.onload=i=>{const r=i.target.result,a=Gp(r+t.name+t.size+t.lastModified);e(a)},n.readAsText(t.slice(0,1e5))})}validateData(t){if(!t||typeof t!="object")return{valid:!1,error:"数据格式无效"};if(!t.artworks||!Array.isArray(t.artworks))return{valid:!1,error:"缺少artworks数组"};if(!t.visitors||!Array.isArray(t.visitors))return{valid:!1,error:"缺少visitors数组"};if(t.artworks.length===0)return{valid:!1,error:"artworks数组为空"};if(t.visitors.length===0)return{valid:!1,error:"visitors数组为空"};for(let e=0;e<t.artworks.length;e++){const n=t.artworks[e];if(!n.id)return{valid:!1,error:`artworks[${e}]缺少id`};if(n.x===void 0||n.z===void 0)return{valid:!1,error:`artworks[${e}]缺少位置坐标`}}for(let e=0;e<t.visitors.length;e++){const n=t.visitors[e];if(!n.id)return{valid:!1,error:`visitors[${e}]缺少id`};if(!n.path||!Array.isArray(n.path))return{valid:!1,error:`visitors[${e}]缺少path数组`};if(n.path.length<2)return{valid:!1,error:`visitors[${e}]的path点数不足`}}return{valid:!0}}createRecord(t,e){const n=this.processRawData(t),i={id:pr(),name:t.name||e||`记录 ${this.records.length+1}`,createdAt:Date.now(),updatedAt:Date.now(),fileName:e,artworks:n.artworks,visitors:n.visitors,batches:n.batches,congestionPoints:n.congestionPoints,heatmapData:n.heatmapData,statistics:n.statistics,issues:n.issues,filters:{selectedBatches:[],selectedArtworks:[],selectedFloors:[1,2],timeRange:null}};return this.records.push(i),this.currentRecordId=i.id,i}processRawData(t){var p,m;const e=[],n=[],i=[],r=[],a=Lo(t.visitors,g=>g.deviceId||g.macAddress||g.id);for(const[g,_]of Object.entries(a)){if(_.length>1)for(let f=1;f<_.length;f++){const h=_[f].path[0].timestamp-_[f-1].path[_[f-1].path.length-1].timestamp;h<36e5&&n.push({visitorId:_[f].id,deviceId:g,reason:`与前一次记录间隔仅 ${Math.round(h/6e4)} 分钟，判定为同一访客重复进入`,originalVisitor:_[f-1].id,timeDiff:h})}for(const f of _){const h=this.processVisitorPath(f,t.artworks,i,r);e.push({...f,deviceId:g,path:h.points,artworkVisits:h.artworkVisits,totalDuration:h.totalDuration,totalDistance:h.totalDistance,batch:f.batch||"default",entranceTime:(p=f.path[0])==null?void 0:p.timestamp,exitTime:(m=f.path[f.path.length-1])==null?void 0:m.timestamp,isDuplicate:n.some(E=>E.visitorId===f.id),issues:[...n.filter(E=>E.visitorId===f.id).map(E=>({type:"duplicate",...E})),...i.filter(E=>E.visitorId===f.id),...r.filter(E=>E.visitorId===f.id)]})}}const o=this.groupVisitorsByBatch(e),l=this.generateHeatmapData(e),c=this.detectCongestionPoints(e),d=this.calculateStatistics(e,t.artworks,{duplicates:n.length,occlusions:i.length,biases:r.length}),u={duplicates:n,occlusions:i,biases:r};return{artworks:t.artworks.map(g=>({...g,totalVisitors:0,avgStayDuration:0,heatValue:0})),visitors:e,batches:o,heatmapData:l,congestionPoints:c,statistics:d,issues:u}}processVisitorPath(t,e,n,i){const r=[],a=[];let o=0,l=0;const{height:c}=be;for(let d=0;d<t.path.length;d++){const u=t.path[d],p=u.floor||1,m=(p-1)*c,g={x:u.x,y:m+1.5,z:u.z,timestamp:u.timestamp,floor:p};if(r.push(g),d>0){const _=r[d-1];l+=Pi(_,g);const f=(u.timestamp-t.path[d-1].timestamp)/1e3;o+=f,_.floor!==p&&n.push({visitorId:t.id,reason:`在第 ${_.floor} 层到第 ${p} 层切换时，${f.toFixed(1)}秒内可能存在楼层遮挡`,fromFloor:_.floor,toFloor:p,duration:f})}}for(const d of e){let u=0,p=-1,m=-1;for(let g=0;g<r.length;g++)Pi(r[g],d)<(d.interactionRadius||3)&&(p===-1&&(p=g),m=g,g>0&&(u+=(r[g].timestamp-r[g-1].timestamp)/1e3));if(u>5){const g=r[0],_=Pi(g,{x:0,z:be.depth/2});p<3&&_>10&&i.push({visitorId:t.id,artworkId:d.id,reason:`进入后 ${u.toFixed(1)} 秒内到达 ${d.name}，可能受到入口人流引导`,timeFromEntrance:u,distToEntrance:_.toFixed(1)}),a.push({artworkId:d.id,artworkName:d.name,duration:u,firstSeen:p,lastSeen:m,avgDistance:2})}}return{points:r,artworkVisits:a,totalDuration:o,totalDistance:l}}groupVisitorsByBatch(t){const e=Lo(t,n=>n.batch);return Object.entries(e).map(([n,i])=>({id:n,name:n==="default"?"默认批次":`批次 ${n}`,visitorCount:i.length,entranceTime:Math.min(...i.map(r=>r.entranceTime)),exitTime:Math.max(...i.map(r=>r.exitTime)),avgDuration:di(i.map(r=>r.totalDuration)),color:this.getBatchColor(n)}))}getBatchColor(t){const e=[6717162,7752610,15766523,4906624,16498468,6333946,16020150,10980346],n=parseInt(t)||0;return e[n%e.length]}generateHeatmapData(t){const{width:e,depth:n}=be,i=1,r={};for(const a of t)for(let o=0;o<a.path.length;o++){const l=a.path[o],c=Math.floor((l.x+e/2)/i),d=Math.floor((l.z+n/2)/i),u=`${c},${d},${l.floor}`;if(r[u]||(r[u]={x:l.x,z:l.z,floor:l.floor,value:0,duration:0}),r[u].value+=1,o>0){const p=(l.timestamp-a.path[o-1].timestamp)/1e3;r[u].duration+=p}}return Object.values(r)}detectCongestionPoints(t){const i=[],r=[];for(const a of t)for(const o of a.path)r.push({...o,visitorId:a.id});r.sort((a,o)=>a.timestamp-o.timestamp);for(let a=0;a<r.length;a++){const o=r[a].timestamp+6e4,l=[r[a]];for(let d=a+1;d<r.length&&r[d].timestamp<o;d++)Pi(r[d],r[a])<3&&l.push(r[d]);const c=new Set(l.map(d=>d.visitorId)).size;c>=5&&(i.find(u=>Pi(u,r[a])<5&&Math.abs(u.timestamp-r[a].timestamp)<6e4)||i.push({id:pr(),x:r[a].x,z:r[a].z,floor:r[a].floor,timestamp:r[a].timestamp,visitorCount:c,duration:6e4/1e3,severity:c>=10?"high":c>=7?"medium":"low"}))}return i}calculateStatistics(t,e,n){const i=t.map(c=>c.totalDuration),r=t.map(c=>c.totalDistance),a=e.map(()=>0),o=e.map(()=>[]);for(const c of t)for(const d of c.artworkVisits){const u=e.findIndex(p=>p.id===d.artworkId);u!==-1&&(a[u]++,o[u].push(d.duration))}const l=e.map((c,d)=>({...c,totalVisitors:a[d],avgStayDuration:di(o[d]),medianStayDuration:gr(o[d]),heatValue:a[d]*di(o[d])}));return{totalVisitors:t.length,uniqueVisitors:new Set(t.map(c=>c.deviceId)).size,avgDuration:di(i),medianDuration:gr(i),avgDistance:di(r),medianDistance:gr(r),totalArtworks:e.length,avgArtworksPerVisitor:di(t.map(c=>c.artworkVisits.length)),artworks:l.sort((c,d)=>d.heatValue-c.heatValue),issues:n}}createRecordFromExisting(t,e,n){const i=this.getRecord(t);if(!i)return null;const r=this.processRawData(e),a=[...i.visitors,...r.visitors],o=Wp([...i.artworks,...r.artworks],"id"),l=this.groupVisitorsByBatch(a),c=this.generateHeatmapData(a),d=this.detectCongestionPoints(a),u=this.calculateStatistics(a,o,{duplicates:r.issues.duplicates.length,occlusions:r.issues.occlusions.length,biases:r.issues.biases.length}),p={...i,id:pr(),name:`${i.name} (追加 ${Le(Date.now())})`,createdAt:i.createdAt,updatedAt:Date.now(),parentRecordId:t,artworks:o,visitors:a,batches:l,heatmapData:c,congestionPoints:d,statistics:u,issues:{duplicates:[...i.issues.duplicates,...r.issues.duplicates],occlusions:[...i.issues.occlusions,...r.issues.occlusions],biases:[...i.issues.biases,...r.issues.biases]},filters:{...i.filters}};return this.records.push(p),this.currentRecordId=p.id,this.saveToStorage(),p}getCurrentRecord(){return this.getRecord(this.currentRecordId)}getRecord(t){return this.records.find(e=>e.id===t)}getAllRecords(){return[...this.records].sort((t,e)=>e.updatedAt-t.updatedAt)}setCurrentRecord(t){this.currentRecordId=t,this.saveToStorage()}updateRecord(t,e){const n=this.getRecord(t);return n?(Object.assign(n,e,{updatedAt:Date.now()}),this.saveToStorage(),n):null}deleteRecord(t){var n;const e=this.records.findIndex(i=>i.id===t);return e!==-1?(this.records.splice(e,1),this.currentRecordId===t&&(this.currentRecordId=((n=this.records[0])==null?void 0:n.id)||null),this.saveToStorage(),!0):!1}updateSettings(t){return Object.assign(this.settings,t),this.saveToStorage(),this.settings}exportRecord(t,e="json"){const n=this.getRecord(t);if(!n)return null;const i={...n,exportedAt:Date.now(),version:"1.0"};return e==="json"?JSON.stringify(i,null,2):i}getFilteredVisitors(t,e){if(!t)return[];if(!e)return t.visitors;let n=[...t.visitors];return e.selectedBatches&&e.selectedBatches.length>0&&(n=n.filter(i=>e.selectedBatches.includes(i.batch))),e.selectedFloors&&e.selectedFloors.length>0&&(n=n.filter(i=>i.path.some(r=>e.selectedFloors.includes(r.floor)))),e.timeRange&&(n=n.filter(i=>i.entranceTime>=e.timeRange.start&&i.exitTime<=e.timeRange.end)),n}getFilteredArtworks(t,e){if(!t)return[];if(!e)return t.artworks;let n=[...t.artworks];return e.selectedArtworks&&e.selectedArtworks.length>0&&(n=n.filter(i=>e.selectedArtworks.includes(i.id))),e.selectedFloors&&e.selectedFloors.length>0&&(n=n.filter(i=>e.selectedFloors.includes(i.floor||1))),n}}class $p{constructor(t){this.sceneManager=t,this.isPlaying=!1,this.currentTime=0,this.duration=0,this.speed=1,this.visitors=[],this.activeVisitors=new Map,this.onUpdate=null,this.onComplete=null,this.animationFrameId=null,this.lastTimestamp=0}setVisitors(t){if(this.visitors=t,this.activeVisitors.clear(),this.sceneManager.clearVisitors(),t.length===0){this.duration=0;return}const e=t.flatMap(r=>r.path.map(a=>a.timestamp)),n=Math.min(...e),i=Math.max(...e);this.duration=(i-n)/1e3,this.startTime=n,this.endTime=i}play(){this.isPlaying||this.visitors.length!==0&&(this.isPlaying=!0,this.lastTimestamp=performance.now(),this.animate())}pause(){this.isPlaying=!1,this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=null)}toggle(){return this.isPlaying?this.pause():this.play(),this.isPlaying}stop(){this.pause(),this.currentTime=0,this.updateVisitors(),this.activeVisitors.clear(),this.sceneManager.clearVisitors()}seek(t){this.currentTime=Math.max(0,Math.min(this.duration,t)),this.updateVisitors()}setSpeed(t){this.speed=Math.max(.1,Math.min(10,t))}animate(){if(!this.isPlaying)return;this.animationFrameId=requestAnimationFrame(()=>this.animate());const t=performance.now(),e=(t-this.lastTimestamp)/1e3;if(this.lastTimestamp=t,this.currentTime+=e*this.speed,this.currentTime>=this.duration){this.currentTime=this.duration,this.updateVisitors(),this.pause(),this.onComplete&&this.onComplete();return}this.updateVisitors(),this.onUpdate&&this.onUpdate(this.currentTime,this.duration)}updateVisitors(){if(this.visitors.length===0)return;const t=this.startTime+this.currentTime*1e3;for(const e of this.visitors){const n=this.getVisitorStateAtTime(e,t);if(!n){this.activeVisitors.has(e.id)&&this.activeVisitors.delete(e.id);continue}if(!this.activeVisitors.has(e.id)){const o=e.batchColor||6717162;this.sceneManager.addVisitorPath(e.id,o),this.activeVisitors.set(e.id,{lastTrailUpdate:0,trailUpdateInterval:.1})}const i=this.activeVisitors.get(e.id),r=new L(n.position.x,n.position.y,n.position.z),a=this.currentTime-i.lastTrailUpdate>=i.trailUpdateInterval/this.speed;this.sceneManager.updateVisitorPosition(e.id,r,a),a&&(i.lastTrailUpdate=this.currentTime)}}getVisitorStateAtTime(t,e){const n=t.path;if(!n||n.length<2||e<n[0].timestamp||e>n[n.length-1].timestamp)return null;for(let i=0;i<n.length-1;i++){const r=n[i],a=n[i+1];if(e>=r.timestamp&&e<=a.timestamp){const o=(a.timestamp-r.timestamp)/1e3,l=(e-r.timestamp)/1e3,c=o>0?l/o:0;return{position:Hp(r,a,c),segmentIndex:i,progress:c}}}return null}getCurrentTimestamp(){return this.startTime+this.currentTime*1e3}getProgress(){return this.duration>0?this.currentTime/this.duration:0}dispose(){this.pause(),this.visitors=[],this.activeVisitors.clear()}}class qp{constructor(t){this.app=t,this.dataManager=t.dataManager,this.toasts=[],this.modals=[]}init(){this.renderToolbar(),this.renderSidebar(),this.renderTimeline(),this.renderHeatmapLegend()}renderToolbar(){const t=document.getElementById("toolbar");t.innerHTML=`
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <div style="font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          🎨 画廊观展动线热图分析
        </div>
      </div>
      <button class="toolbar-btn" id="btn-import">
        <span>📁</span> 导入数据
      </button>
      <button class="toolbar-btn" id="btn-records">
        <span>📋</span> 记录管理
      </button>
      <button class="toolbar-btn primary" id="btn-export">
        <span>📊</span> 导出报告
      </button>
      <button class="toolbar-btn" id="btn-settings">
        <span>⚙️</span>
      </button>
    `,document.getElementById("btn-import").onclick=()=>this.showImportModal(),document.getElementById("btn-records").onclick=()=>this.showRecordsModal(),document.getElementById("btn-export").onclick=()=>this.showExportModal(),document.getElementById("btn-settings").onclick=()=>this.showSettingsModal()}renderSidebar(){const t=document.getElementById("sidebar");t.innerHTML=`
      <div class="section">
        <div class="section-title">当前记录</div>
        <div id="current-record-info">
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div>暂无数据，请导入观展记录</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">统计概览</div>
        <div id="stats-overview"></div>
      </div>

      <div class="section">
        <div class="section-title">视图控制</div>
        <div class="view-controls">
          <button class="view-btn active" data-view="${se.PERSPECTIVE}">透视</button>
          <button class="view-btn" data-view="${se.TOP}">俯视</button>
          <button class="view-btn" data-view="${se.FRONT}">正视</button>
          <button class="view-btn" data-view="${se.SIDE}">侧视</button>
          <button class="view-btn" data-view="${se.ORBIT}">自由</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">楼层</div>
        <div class="floor-toggle">
          <button class="floor-btn active" data-floor="all">全部</button>
          <button class="floor-btn" data-floor="1">1层</button>
          <button class="floor-btn" data-floor="2">2层</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">可视化模式</div>
        <div class="view-controls">
          <button class="view-btn" data-visual="${sn.NORMAL}">普通</button>
          <button class="view-btn active" data-visual="${sn.COMBINED}">综合</button>
          <button class="view-btn" data-visual="${sn.HEATMAP}">热力</button>
          <button class="view-btn" data-visual="${sn.PATH}">动线</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">显示设置</div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-labels" checked>
          <label for="show-labels">显示作品标签</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-grid" checked>
          <label for="show-grid">显示网格</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-congestion" checked>
          <label for="show-congestion">显示拥堵点</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-issues" checked>
          <label for="show-issues">显示问题标记</label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">热力图参数</div>
        <div class="slider-container">
          <label>
            <span>透明度</span>
            <span id="heatmap-opacity-value">60%</span>
          </label>
          <input type="range" id="heatmap-opacity" min="0" max="100" value="60">
        </div>
        <div class="slider-container">
          <label>
            <span>影响半径</span>
            <span id="heatmap-radius-value">2.5m</span>
          </label>
          <input type="range" id="heatmap-radius" min="1" max="5" step="0.1" value="2.5">
        </div>
      </div>

      <div class="section">
        <div class="section-title">作品热度</div>
        <div id="artwork-list" class="artwork-list"></div>
      </div>

      <div class="section">
        <div class="section-title">入口批次</div>
        <div id="batch-list"></div>
      </div>

      <div class="section">
        <div class="section-title">问题记录</div>
        <div id="issues-list"></div>
      </div>
    `,this.setupSidebarEventListeners()}setupSidebarEventListeners(){document.querySelectorAll(".view-btn[data-view]").forEach(t=>{t.onclick=()=>{document.querySelectorAll(".view-btn[data-view]").forEach(e=>e.classList.remove("active")),t.classList.add("active"),this.app.setViewMode(t.dataset.view)}}),document.querySelectorAll(".view-btn[data-visual]").forEach(t=>{t.onclick=()=>{document.querySelectorAll(".view-btn[data-visual]").forEach(e=>e.classList.remove("active")),t.classList.add("active"),this.app.setVisualMode(t.dataset.visual)}}),document.querySelectorAll(".floor-btn").forEach(t=>{t.onclick=()=>{document.querySelectorAll(".floor-btn").forEach(e=>e.classList.remove("active")),t.classList.add("active"),this.app.setActiveFloor(t.dataset.floor==="all"?null:parseInt(t.dataset.floor))}}),document.getElementById("show-labels").onchange=t=>{this.app.setLabelsVisible(t.target.checked)},document.getElementById("show-grid").onchange=t=>{this.app.setGridVisible(t.target.checked)},document.getElementById("show-congestion").onchange=t=>{this.app.setCongestionVisible(t.target.checked)},document.getElementById("show-issues").onchange=t=>{this.app.setIssuesVisible(t.target.checked)},document.getElementById("heatmap-opacity").oninput=t=>{const e=t.target.value/100;document.getElementById("heatmap-opacity-value").textContent=`${t.target.value}%`,this.app.setHeatmapOpacity(e)},document.getElementById("heatmap-radius").oninput=t=>{document.getElementById("heatmap-radius-value").textContent=`${t.target.value}m`,this.app.setHeatmapRadius(parseFloat(t.target.value))}}renderTimeline(){const t=document.getElementById("timeline");t.innerHTML=`
      <div class="timeline-controls">
        <button class="play-btn" id="play-btn">▶</button>
        <button class="btn small" id="stop-btn" style="width: 36px;">⏹</button>
        <div class="time-display" id="time-display">00:00 / 00:00</div>
        <input type="range" class="timeline-slider" id="timeline-slider" min="0" max="100" value="0" step="0.1">
        <div class="time-display" id="speed-display">1x</div>
        <button class="btn small" id="speed-down">−</button>
        <button class="btn small" id="speed-up">+</button>
        <button class="btn small" id="btn-reset" title="重置">↺</button>
      </div>
      <div class="batch-indicator" id="batch-indicator"></div>
    `,document.getElementById("play-btn").onclick=()=>{const e=this.app.animationController.toggle();document.getElementById("play-btn").textContent=e?"⏸":"▶"},document.getElementById("stop-btn").onclick=()=>{this.app.animationController.stop(),document.getElementById("play-btn").textContent="▶",this.updateTimelineDisplay()},document.getElementById("timeline-slider").oninput=e=>{const n=parseFloat(e.target.value);this.app.animationController.seek(n),this.updateTimelineDisplay()},document.getElementById("speed-down").onclick=()=>{const e=Math.max(.1,this.app.animationController.speed-.25);this.app.animationController.setSpeed(e),document.getElementById("speed-display").textContent=`${e.toFixed(1)}x`},document.getElementById("speed-up").onclick=()=>{const e=Math.min(10,this.app.animationController.speed+.25);this.app.animationController.setSpeed(e),document.getElementById("speed-display").textContent=`${e.toFixed(1)}x`},document.getElementById("btn-reset").onclick=()=>{this.app.animationController.seek(0),document.getElementById("timeline-slider").value=0,this.updateTimelineDisplay()},this.app.animationController.onUpdate=(e,n)=>{document.getElementById("timeline-slider").value=e,this.updateTimelineDisplay()},this.app.animationController.onComplete=()=>{document.getElementById("play-btn").textContent="▶"}}updateTimelineDisplay(){const t=this.app.animationController.currentTime,e=this.app.animationController.duration;document.getElementById("time-display").textContent=`${Po(t)} / ${Po(e)}`,document.getElementById("timeline-slider").max=e}renderHeatmapLegend(){const t=document.createElement("div");t.className="heatmap-legend",t.innerHTML=`
      <span class="legend-label">低</span>
      <div class="legend-gradient"></div>
      <span class="legend-label">高</span>
    `,document.getElementById("canvas-container").appendChild(t)}updateRecordDisplay(){var n;const t=this.dataManager.getCurrentRecord(),e=document.getElementById("current-record-info");if(!t){e.innerHTML=`
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div>暂无数据，请导入观展记录</div>
        </div>
      `;return}e.innerHTML=`
      <div class="stat-card">
        <div class="label">记录名称</div>
        <div class="value small">${t.name}</div>
      </div>
      <div class="stat-card">
        <div class="label">更新时间</div>
        <div class="value small">${Le(t.updatedAt)}</div>
      </div>
      <div class="stat-card">
        <div class="label">来源文件</div>
        <div class="value small" style="font-size: 11px; color: #888;">${t.fileName||"-"}</div>
      </div>
      ${t.parentRecordId?`
        <div class="stat-card">
          <div class="label" style="color: #fbbf24;">📎 基于记录</div>
          <div class="value small" style="font-size: 11px;">${((n=this.dataManager.getRecord(t.parentRecordId))==null?void 0:n.name)||"已删除"}</div>
        </div>
      `:""}
      <div class="btn-group">
        <button class="btn small" id="btn-rename-record">重命名</button>
        <button class="btn small" id="btn-duplicate-record">复制</button>
      </div>
    `,document.getElementById("btn-rename-record").onclick=()=>this.renameRecord(t),document.getElementById("btn-duplicate-record").onclick=()=>this.duplicateRecord(t),this.updateStats(),this.updateArtworkList(),this.updateBatchList(),this.updateIssuesList(),this.updateTimelineDisplay()}updateStats(){const t=this.dataManager.getCurrentRecord(),e=document.getElementById("stats-overview");if(!t){e.innerHTML="";return}const n=t.statistics;e.innerHTML=`
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div class="stat-card">
          <div class="label">访客总数</div>
          <div class="value">${n.totalVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="label">独立访客</div>
          <div class="value">${n.uniqueVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="label">平均停留</div>
          <div class="value small">${Di(n.avgDuration)}</div>
        </div>
        <div class="stat-card">
          <div class="label">平均观看作品</div>
          <div class="value">${n.avgArtworksPerVisitor.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="label">拥堵点</div>
          <div class="value" style="color: ${t.congestionPoints.length>3?"#ef4444":"#fbbf24"};">${t.congestionPoints.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">问题记录</div>
          <div class="value" style="color: #fbbf24;">${n.issues.duplicates+n.issues.occlusions+n.issues.biases}</div>
        </div>
      </div>
    `}updateArtworkList(){const t=this.dataManager.getCurrentRecord(),e=document.getElementById("artwork-list");if(!t){e.innerHTML="";return}const n=t.statistics.artworks.slice(0,10),i=Math.max(...n.map(r=>r.heatValue),1);e.innerHTML=n.map((r,a)=>{var c;const o=(r.heatValue/i*100).toFixed(0),l=this.getHeatColorRGB(r.heatValue/i);return`
        <div class="artwork-item ${(c=this.app.highlightedArtworks)!=null&&c.includes(r.id)?"highlighted":""}" data-artwork="${r.id}">
          <div class="artwork-color" style="background: rgb(${l.join(",")});"></div>
          <div class="artwork-info">
            <div class="artwork-name">${a+1}. ${r.name}</div>
            <div class="artwork-stats">
              ${r.totalVisitors}人 · ${Di(r.avgStayDuration)} · 热度 ${o}%
            </div>
          </div>
        </div>
      `}).join(""),e.querySelectorAll(".artwork-item").forEach(r=>{r.onclick=()=>{const a=r.dataset.artwork;this.app.toggleArtworkHighlight(a),r.classList.toggle("highlighted")}})}updateBatchList(){const t=this.dataManager.getCurrentRecord(),e=document.getElementById("batch-list");if(!t){e.innerHTML="";return}e.innerHTML=t.batches.map(n=>`
      <div class="checkbox-item">
        <input type="checkbox" id="batch-${n.id}" 
               ${!t.filters.selectedBatches.length||t.filters.selectedBatches.includes(n.id)?"checked":""}>
        <label for="batch-${n.id}" style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #${n.color.toString(16).padStart(6,"0")};"></span>
          <span>${n.name}</span>
          <span style="color: #888; margin-left: auto;">${n.visitorCount}人</span>
        </label>
      </div>
    `).join(""),t.batches.forEach(n=>{const i=document.getElementById(`batch-${n.id}`);i.onchange=r=>{this.app.toggleBatchFilter(n.id,r.target.checked)}})}updateIssuesList(){const t=this.dataManager.getCurrentRecord(),e=document.getElementById("issues-list");if(!t){e.innerHTML="";return}const{duplicates:n,occlusions:i,biases:r}=t.issues,a=n.length+i.length+r.length;if(a===0){e.innerHTML=`
        <div style="text-align: center; padding: 20px; color: #22c55e; font-size: 12px;">
          ✅ 未检测到数据质量问题
        </div>
      `;return}e.innerHTML=`
      <div class="stat-card" style="cursor: pointer;" id="issues-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="label">数据质量问题</div>
            <div class="value small" style="color: #fbbf24;">${a} 项待处理</div>
          </div>
          <span style="font-size: 20px;">⚠️</span>
        </div>
        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          ${n.length>0?`
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge duplicate">重复</span>
              <span>${n.length} 条重复访客记录</span>
            </div>
          `:""}
          ${i.length>0?`
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge occlusion">遮挡</span>
              <span>${i.length} 条楼层遮挡记录</span>
            </div>
          `:""}
          ${r.length>0?`
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge bias">偏差</span>
              <span>${r.length} 条入口热度偏差</span>
            </div>
          `:""}
        </div>
      </div>
    `,document.getElementById("issues-card").onclick=()=>this.showIssuesModal(t)}showImportModal(){const t=this.createModal({title:"导入观展数据",width:"600px",body:`
        <div id="drop-zone" class="drop-zone">
          <div class="drop-icon">📁</div>
          <div class="drop-text">拖拽 JSON 文件到此处，或点击选择文件</div>
          <div style="font-size: 11px; color: #666; margin-top: 8px;">
            支持格式: <code>.json</code> | 需要包含 artworks 和 visitors 数组
          </div>
          <input type="file" id="file-input" accept=".json" multiple style="display: none;">
        </div>
        
        <div class="section" style="margin-top: 20px;">
          <div class="section-title">追加到现有记录</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="append-to-record" style="flex: 1;">
              <option value="">不追加（创建新记录）</option>
              ${this.dataManager.getAllRecords().map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
            </select>
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">
            选择现有记录将把新数据追加到同一条记录中
          </div>
        </div>

        <div id="import-preview" style="margin-top: 20px; display: none;">
          <div class="section-title">导入预览</div>
          <div id="import-results"></div>
        </div>
      `,footer:`
        <button class="btn" id="btn-cancel-import">取消</button>
        <button class="btn primary" id="btn-confirm-import" disabled>确认导入</button>
      `}),e=document.getElementById("drop-zone"),n=document.getElementById("file-input"),i=document.getElementById("append-to-record");e.onclick=()=>n.click(),e.ondragover=r=>{r.preventDefault(),e.classList.add("dragover")},e.ondragleave=()=>{e.classList.remove("dragover")},e.ondrop=r=>{r.preventDefault(),e.classList.remove("dragover"),this.handleFilesSelected(r.dataTransfer.files,i.value)},n.onchange=r=>{this.handleFilesSelected(r.target.files,i.value)},document.getElementById("btn-cancel-import").onclick=()=>this.closeModal(t),document.getElementById("btn-confirm-import").onclick=()=>{this.closeModal(t),this.showToast("导入成功！","success"),this.updateRecordDisplay(),this.app.loadCurrentRecord()}}async handleFilesSelected(t,e){const n=document.getElementById("import-preview"),i=document.getElementById("import-results"),r=document.getElementById("btn-confirm-import");n.style.display="block",i.innerHTML='<div style="text-align: center; padding: 20px;">正在分析文件...</div>';try{const a=await this.dataManager.importFiles(Array.from(t),l=>this.showConflictModal(l));if(e)for(const l of a.success)this.dataManager.createRecordFromExisting(e,l.data,l.file);let o="";a.success.length>0&&(o+=`
          <div style="color: #22c55e; margin-bottom: 8px;">
            ✅ 成功导入 ${a.success.length} 个文件
          </div>
          ${a.success.map(l=>`
            <div class="conflict-item" style="margin-bottom: 4px;">
              <div class="file-name">${l.file}</div>
            </div>
          `).join("")}
        `),a.errors.length>0&&(o+=`
          <div style="color: #ef4444; margin: 12px 0 8px;">
            ❌ 导入失败 ${a.errors.length} 个文件
          </div>
          ${a.errors.map(l=>`
            <div class="conflict-item" style="margin-bottom: 4px; border-left: 3px solid #ef4444;">
              <div class="file-name">${l.file}</div>
              <div style="font-size: 11px; color: #f87171;">${l.error}</div>
            </div>
          `).join("")}
        `),a.skipped.length>0&&(o+=`
          <div style="color: #fbbf24; margin: 12px 0 8px;">
            ⚠️ 跳过 ${a.skipped.length} 个文件
          </div>
          ${a.skipped.map(l=>`
            <div class="conflict-item" style="margin-bottom: 4px; border-left: 3px solid #fbbf24;">
              <div class="file-name">${l.file}</div>
              <div style="font-size: 11px; color: #fbbf24;">${l.reason}</div>
            </div>
          `).join("")}
        `),i.innerHTML=o,r.disabled=a.success.length===0}catch(a){i.innerHTML=`<div style="color: #ef4444;">导入出错: ${a.message}</div>`}}showConflictModal(t){return new Promise(e=>{const n=t.map(a=>({...a,action:Ge.SKIP})),i=this.createModal({title:"检测到重复文件",width:"600px",body:`
          <div style="margin-bottom: 12px; font-size: 13px; color: #aaa;">
            以下文件之前已导入过，请选择处理方式：
          </div>
          <div class="conflict-list">
            ${n.map((a,o)=>`
              <div class="conflict-item">
                <div class="file-name">${a.file}</div>
                <div class="conflict-reason">
                  ${a.reason}<br>
                  <span style="color: #888;">已存在: ${a.existingRecordName} · ${Le(a.importedAt)}</span>
                </div>
                <div class="conflict-actions">
                  <button data-action="${Ge.SKIP}" data-index="${o}" class="active">跳过</button>
                  <button data-action="${Ge.OVERWRITE}" data-index="${o}">覆盖</button>
                  <button data-action="${Ge.APPEND}" data-index="${o}">追加</button>
                </div>
              </div>
            `).join("")}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="btn" data-action-all="${Ge.SKIP}">全部跳过</button>
            <button class="btn" data-action-all="${Ge.OVERWRITE}">全部覆盖</button>
            <button class="btn" data-action-all="${Ge.APPEND}">全部追加</button>
          </div>
        `,footer:`
          <button class="btn" id="btn-cancel-conflict">取消导入</button>
          <button class="btn primary" id="btn-confirm-conflict">确认处理</button>
        `}),r=(a,o)=>{n[a].action=o,i.querySelectorAll(`.conflict-actions button[data-index="${a}"]`).forEach(c=>c.classList.remove("active")),i.querySelector(`.conflict-actions button[data-action="${o}"][data-index="${a}"]`).classList.add("active")};i.querySelectorAll(".conflict-actions button").forEach(a=>{a.onclick=()=>r(parseInt(a.dataset.index),a.dataset.action)}),i.querySelectorAll("[data-action-all]").forEach(a=>{a.onclick=()=>{n.forEach((o,l)=>r(l,a.dataset.actionAll))}}),document.getElementById("btn-cancel-conflict").onclick=()=>{this.closeModal(i),e(t.map(a=>({...a,action:Ge.SKIP})))},document.getElementById("btn-confirm-conflict").onclick=()=>{this.closeModal(i),e(n)}})}showRecordsModal(){const t=this.dataManager.getAllRecords(),e=this.dataManager.getCurrentRecord(),n=this.createModal({title:"记录管理",width:"700px",body:`
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input type="text" id="record-search" placeholder="搜索记录..." style="flex: 1;">
          <button class="btn small primary" id="btn-new-record">+ 新建记录</button>
        </div>
        
        <div class="record-list" id="record-list">
          ${t.length===0?`
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div>暂无记录，点击"导入数据"开始</div>
            </div>
          `:t.map(i=>`
            <div class="record-item ${i.id===(e==null?void 0:e.id)?"active":""}" data-id="${i.id}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <div class="record-name">${i.name}</div>
                  <div class="record-meta">
                    ${i.statistics.totalVisitors} 访客 · ${i.statistics.totalArtworks} 作品 · ${Le(i.updatedAt)}
                    ${i.parentRecordId?" · 📎 派生记录":""}
                  </div>
                </div>
                <div style="display: flex; gap: 4px; margin-left: 12px;">
                  <button class="btn small" data-action="load" data-id="${i.id}">加载</button>
                  <button class="btn small" data-action="export" data-id="${i.id}">导出</button>
                  <button class="btn small" data-action="delete" data-id="${i.id}" style="color: #f87171;">删除</button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `});n.querySelectorAll("[data-action]").forEach(i=>{i.onclick=r=>{r.stopPropagation();const a=i.dataset.action,o=i.dataset.id;if(a==="load")this.dataManager.setCurrentRecord(o),this.closeModal(n),this.updateRecordDisplay(),this.app.loadCurrentRecord(),this.showToast("记录已加载","success");else if(a==="export"){const l=this.dataManager.exportRecord(o,"json"),c=this.dataManager.getRecord(o);Ii(l,`${c.name}.json`,"application/json"),this.showToast("记录已导出","success")}else a==="delete"&&confirm("确定要删除这条记录吗？此操作不可撤销。")&&(this.dataManager.deleteRecord(o),this.closeModal(n),this.showRecordsModal(),this.updateRecordDisplay(),this.showToast("记录已删除","info"))}}),n.querySelectorAll(".record-item").forEach(i=>{i.onclick=()=>{const r=i.dataset.id;this.dataManager.setCurrentRecord(r),this.closeModal(n),this.updateRecordDisplay(),this.app.loadCurrentRecord()}}),document.getElementById("btn-new-record").onclick=()=>{this.closeModal(n),this.showImportModal()},document.getElementById("record-search").oninput=i=>{const r=i.target.value.toLowerCase();n.querySelectorAll(".record-item").forEach(a=>{const o=a.querySelector(".record-name").textContent.toLowerCase();a.style.display=o.includes(r)?"":"none"})}}showExportModal(){const t=this.dataManager.getCurrentRecord();if(!t){this.showToast("请先加载一条记录","warning");return}const e=this.createModal({title:"导出分析报告",width:"500px",body:`
        <div class="form-group">
          <label>报告名称</label>
          <input type="text" id="export-name" value="${t.name} - 分析报告">
        </div>

        <div class="form-group">
          <label>导出格式</label>
          <div style="display: flex; gap: 8px;">
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${gi.HTML}" checked>
              <span>HTML 网页报告</span>
            </label>
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${gi.JSON}">
              <span>JSON 数据</span>
            </label>
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${gi.CSV}">
              <span>CSV 表格</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>包含内容</label>
          <div class="checkbox-item">
            <input type="checkbox" id="include-visitors" checked>
            <label for="include-visitors">访客动线数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-artworks" checked>
            <label for="include-artworks">作品热度数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-heatmap" checked>
            <label for="include-heatmap">热力图数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-issues" checked>
            <label for="include-issues">数据质量问题</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-congestion" checked>
            <label for="include-congestion">拥堵点分析</label>
          </div>
        </div>
      `,footer:`
        <button class="btn" id="btn-cancel-export">取消</button>
        <button class="btn primary" id="btn-confirm-export">导出</button>
      `});document.getElementById("btn-cancel-export").onclick=()=>this.closeModal(e),document.getElementById("btn-confirm-export").onclick=()=>{const n=document.querySelector('input[name="export-format"]:checked').value,i={includeVisitors:document.getElementById("include-visitors").checked,includeArtworks:document.getElementById("include-artworks").checked,includeHeatmap:document.getElementById("include-heatmap").checked,includeIssues:document.getElementById("include-issues").checked,includeCongestion:document.getElementById("include-congestion").checked},r=document.getElementById("export-name").value;this.app.exportReport(n,r,i),this.closeModal(e),this.showToast("报告已导出","success")}}showSettingsModal(){const t=this.dataManager.settings,e=this.createModal({title:"设置",width:"500px",body:`
        <div class="form-group">
          <label>动画播放速度 (默认)</label>
          <input type="number" id="setting-speed" value="${t.animationSpeed}" step="0.1" min="0.1" max="10">
        </div>

        <div class="form-group">
          <label>热力图默认透明度</label>
          <input type="range" id="setting-opacity" min="0" max="100" value="${t.heatmapOpacity*100}">
        </div>

        <div class="form-group">
          <label>默认视图模式</label>
          <select id="setting-viewmode">
            <option value="${se.PERSPECTIVE}" ${t.viewMode===se.PERSPECTIVE?"selected":""}>透视视图</option>
            <option value="${se.TOP}" ${t.viewMode===se.TOP?"selected":""}>俯视视图</option>
            <option value="${se.FRONT}" ${t.viewMode===se.FRONT?"selected":""}>正视视图</option>
            <option value="${se.ORBIT}" ${t.viewMode===se.ORBIT?"selected":""}>自由视图</option>
          </select>
        </div>

        <div class="section" style="margin-top: 24px;">
          <div class="section-title">数据管理</div>
          <div class="btn-group">
            <button class="btn small" id="btn-clear-storage" style="color: #f87171;">清除所有本地数据</button>
            <button class="btn small" id="btn-export-all">导出全部数据</button>
          </div>
        </div>
      `,footer:`
        <button class="btn" id="btn-cancel-settings">取消</button>
        <button class="btn primary" id="btn-save-settings">保存</button>
      `});document.getElementById("btn-clear-storage").onclick=()=>{confirm("确定要清除所有本地存储的数据吗？此操作不可撤销。")&&(localStorage.clear(),location.reload())},document.getElementById("btn-export-all").onclick=()=>{const n={records:this.dataManager.records,settings:this.dataManager.settings,exportedAt:Date.now()};Ii(JSON.stringify(n,null,2),`gallery-backup-${Date.now()}.json`),this.showToast("全部数据已导出","success")},document.getElementById("btn-cancel-settings").onclick=()=>this.closeModal(e),document.getElementById("btn-save-settings").onclick=()=>{this.dataManager.updateSettings({animationSpeed:parseFloat(document.getElementById("setting-speed").value),heatmapOpacity:parseInt(document.getElementById("setting-opacity").value)/100,viewMode:document.getElementById("setting-viewmode").value}),this.closeModal(e),this.showToast("设置已保存","success")}}showIssuesModal(t){const{duplicates:e,occlusions:n,biases:i}=t.issues,r=this.createModal({title:"数据质量问题分析",width:"800px",body:`
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(251, 191, 36, 0.1); border-radius: 8px; border-left: 3px solid #fbbf24;">
          <div style="font-weight: 500; margin-bottom: 4px;">⚡ 关于这些问题</div>
          <div style="font-size: 12px; color: #aaa;">
            系统自动检测了三类常见的数据质量问题。点击问题条目可在3D视图中定位相关位置。
            这些问题已在统计中剔除或标记，不影响主要分析结果。
          </div>
        </div>

        <div class="report-section">
          <h3>🔄 重复访客记录 (${e.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            同一设备在短时间内多次进入，可能是WiFi探针重复计数。
          </p>
          ${e.length===0?'<div style="color: #22c55e; font-size: 12px;">未检测到</div>':`
            <table class="report-table">
              <thead><tr><th>访客ID</th><th>设备标识</th><th>与上一次间隔</th><th>操作</th></tr></thead>
              <tbody>
                ${e.map(a=>`
                  <tr>
                    <td><code>${a.visitorId.slice(0,8)}...</code></td>
                    <td><code>${a.deviceId.slice(0,12)}...</code></td>
                    <td>${Math.round(a.timeDiff/6e4)} 分钟</td>
                    <td><button class="btn small" data-locate-duplicate="${a.visitorId}">定位</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <div class="report-section">
          <h3>🏢 楼层遮挡记录 (${n.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            跨楼层时信号不稳定，可能导致定位点跳变。已做平滑处理。
          </p>
          ${n.length===0?'<div style="color: #22c55e; font-size: 12px;">未检测到</div>':`
            <table class="report-table">
              <thead><tr><th>访客ID</th><th>楼层切换</th><th>遮挡时长</th><th>操作</th></tr></thead>
              <tbody>
                ${n.slice(0,10).map(a=>`
                  <tr>
                    <td><code>${a.visitorId.slice(0,8)}...</code></td>
                    <td>${a.fromFloor}层 → ${a.toFloor}层</td>
                    <td>${a.duration.toFixed(1)}秒</td>
                    <td><button class="btn small" data-locate-occlusion="${a.visitorId}">定位</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            ${n.length>10?'<div style="font-size: 11px; color: #666; margin-top: 4px;">仅显示前10条</div>':""}
          `}
        </div>

        <div class="report-section">
          <h3>🚪 入口热度偏差 (${i.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            入口附近作品热度可能被人流带偏，已在报告中单独标注。
          </p>
          ${i.length===0?'<div style="color: #22c55e; font-size: 12px;">未检测到</div>':`
            <table class="report-table">
              <thead><tr><th>作品</th><th>访客ID</th><th>入口到达时间</th><th>距入口距离</th><th>操作</th></tr></thead>
              <tbody>
                ${i.slice(0,10).map(a=>`
                  <tr>
                    <td>${a.artworkId}</td>
                    <td><code>${a.visitorId.slice(0,8)}...</code></td>
                    <td>${a.timeFromEntrance.toFixed(1)}秒</td>
                    <td>${a.distToEntrance}m</td>
                    <td><button class="btn small" data-locate-bias="${a.artworkId}">定位</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            ${i.length>10?'<div style="font-size: 11px; color: #666; margin-top: 4px;">仅显示前10条</div>':""}
          `}
        </div>
      `});r.querySelectorAll("[data-locate-duplicate]").forEach(a=>{a.onclick=()=>{const o=a.dataset.locateDuplicate;this.app.focusVisitor(o)}}),r.querySelectorAll("[data-locate-occlusion]").forEach(a=>{a.onclick=()=>{const o=a.dataset.locateOcclusion;this.app.focusVisitor(o)}}),r.querySelectorAll("[data-locate-bias]").forEach(a=>{a.onclick=()=>{const o=a.dataset.locateBias;this.app.focusArtwork(o),this.closeModal(r)}})}renameRecord(t){const e=prompt("请输入新的记录名称：",t.name);e&&e.trim()&&(this.dataManager.updateRecord(t.id,{name:e.trim()}),this.updateRecordDisplay(),this.showToast("记录已重命名","success"))}duplicateRecord(t){const e={...t,id:this.dataManager.generateId?this.dataManager.generateId():Date.now().toString(36),name:`${t.name} (副本)`,createdAt:Date.now(),updatedAt:Date.now()};this.dataManager.records.push(e),this.dataManager.saveToStorage(),this.updateRecordDisplay(),this.showToast("记录已复制","success")}createModal({title:t,body:e,footer:n,width:i="480px"}){const r=document.getElementById("modal-container");r.classList.add("active");const a=document.createElement("div");return a.className="modal-overlay",a.innerHTML=`
      <div class="modal" style="min-width: ${i};">
        <div class="modal-header">
          <div class="modal-title">${t}</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">${e}</div>
        ${n?`<div class="modal-footer">${n}</div>`:""}
      </div>
    `,a.querySelector(".modal-close").onclick=()=>this.closeModal(a),a.onclick=o=>{o.target===a&&this.closeModal(a)},r.appendChild(a),this.modals.push(a),a}closeModal(t){t&&t.parentNode&&t.parentNode.removeChild(t),this.modals=this.modals.filter(e=>e!==t),this.modals.length===0&&document.getElementById("modal-container").classList.remove("active")}showToast(t,e="info",n=3e3){const i=document.getElementById("toast-container"),r=document.createElement("div"),a={success:"✅",error:"❌",warning:"⚠️",info:"ℹ️"};r.className=`toast ${e}`,r.innerHTML=`
      <span class="toast-icon">${a[e]||a.info}</span>
      <span class="toast-message">${t}</span>
    `,i.appendChild(r),setTimeout(()=>{r.style.animation="toastIn 0.3s reverse",setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},300)},n)}getHeatColorRGB(t){return t<.33?[34,197,94]:t<.66?[234,179,8]:[239,68,68]}}class jp{constructor(t){this.dataManager=t}export(t,e,n){const i=this.dataManager.getCurrentRecord();if(!i)return null;switch(t){case gi.HTML:return this.exportHTML(i,e,n);case gi.JSON:return this.exportJSON(i,e,n);case gi.CSV:return this.exportCSV(i,e,n);default:return null}}exportHTML(t,e,n){const i=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 32px;
    }
    .header h1 { font-size: 32px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .stat-card {
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f0ff 100%);
      border-radius: 10px;
      padding: 16px;
      border-left: 4px solid #667eea;
    }
    .stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 600; color: #1d1d1f; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9ff; font-weight: 500; color: #666; font-size: 13px; }
    tr:hover { background: #f8f9ff; }
    .heat-bar {
      display: inline-block;
      height: 8px;
      background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);
      border-radius: 4px;
    }
    .issue-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      margin-right: 4px;
    }
    .issue-duplicate { background: #fef3c7; color: #d97706; }
    .issue-occlusion { background: #fce7f3; color: #db2777; }
    .issue-bias { background: #dbeafe; color: #2563eb; }
    .severity-high { color: #ef4444; }
    .severity-medium { color: #f59e0b; }
    .severity-low { color: #22c55e; }
    .congestion-point {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .footer {
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .empty { color: #888; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 ${e}</h1>
      <p>生成时间: ${Le(Date.now())} | 记录时间: ${Le(t.createdAt)}</p>
    </div>

    <div class="section">
      <h2>📊 观展概览</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">访客总数</div>
          <div class="stat-value">${t.statistics.totalVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">独立访客</div>
          <div class="stat-value">${t.statistics.uniqueVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均停留时长</div>
          <div class="stat-value" style="font-size: 18px;">${Di(t.statistics.avgDuration)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均观看作品</div>
          <div class="stat-value">${t.statistics.avgArtworksPerVisitor.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">作品总数</div>
          <div class="stat-value">${t.statistics.totalArtworks}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">拥堵点</div>
          <div class="stat-value" style="color: ${t.congestionPoints.length>3?"#ef4444":"#f59e0b"};">${t.congestionPoints.length}</div>
        </div>
      </div>
    </div>

    ${n.includeArtworks?`
    <div class="section">
      <h2>🔥 作品热度排行</h2>
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>作品名称</th>
            <th>楼层</th>
            <th>观看人数</th>
            <th>平均停留</th>
            <th>热度指数</th>
          </tr>
        </thead>
        <tbody>
          ${t.statistics.artworks.slice(0,15).map((r,a)=>{const o=t.statistics.artworks[0].heatValue||1,l=(r.heatValue/o*100).toFixed(0);return`
            <tr>
              <td><strong>${a+1}</strong></td>
              <td>${r.name}</td>
              <td>${r.floor||1}层</td>
              <td>${r.totalVisitors}人</td>
              <td>${Di(r.avgStayDuration)}</td>
              <td>
                <div class="heat-bar" style="width: ${l}%;"></div>
                <span style="margin-left: 8px; font-size: 12px;">${l}%</span>
              </td>
            </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
    `:""}

    ${n.includeCongestion?`
    <div class="section">
      <h2>🚶 拥堵点分析</h2>
      ${t.congestionPoints.length===0?'<p class="empty">未检测到拥堵点</p>':`
      <table>
        <thead>
          <tr>
            <th>位置</th>
            <th>楼层</th>
            <th>发生时间</th>
            <th>聚集人数</th>
            <th>持续时间</th>
            <th>严重程度</th>
          </tr>
        </thead>
        <tbody>
          ${t.congestionPoints.map((r,a)=>`
            <tr>
              <td>
                <span class="congestion-point" style="background: ${r.severity==="high"?"#ef4444":r.severity==="medium"?"#f59e0b":"#22c55e"};"></span>
                (${r.x.toFixed(1)}, ${r.z.toFixed(1)})
              </td>
              <td>${r.floor}层</td>
              <td>${Le(r.timestamp)}</td>
              <td>${r.visitorCount}人</td>
              <td>${r.duration.toFixed(0)}秒</td>
              <td class="severity-${r.severity}">${r.severity==="high"?"🔴 高":r.severity==="medium"?"🟡 中":"🟢 低"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      `}
    </div>
    `:""}

    ${n.includeVisitors?`
    <div class="section">
      <h2>👥 入口批次分析</h2>
      <table>
        <thead>
          <tr>
            <th>批次</th>
            <th>访客数</th>
            <th>最早进入</th>
            <th>最晚离开</th>
            <th>平均停留</th>
          </tr>
        </thead>
        <tbody>
          ${t.batches.map(r=>`
            <tr>
              <td><strong>${r.name}</strong></td>
              <td>${r.visitorCount}人</td>
              <td>${Le(r.entranceTime)}</td>
              <td>${Le(r.exitTime)}</td>
              <td>${Di(r.avgDuration)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    `:""}

    ${n.includeIssues?`
    <div class="section">
      <h2>⚠️ 数据质量问题</h2>
      ${t.statistics.issues.duplicates+t.statistics.issues.occlusions+t.statistics.issues.biases===0?'<p class="empty">✅ 未检测到数据质量问题</p>':`
        <div style="margin-bottom: 16px; padding: 12px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;">
            系统检测到以下数据质量问题，已在分析中做相应处理。详细记录请查看原始数据。
          </p>
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
          ${t.issues.duplicates.length>0?`
            <span class="issue-badge issue-duplicate">
              🔄 ${t.issues.duplicates.length} 条重复访客记录
            </span>
          `:""}
          ${t.issues.occlusions.length>0?`
            <span class="issue-badge issue-occlusion">
              🏢 ${t.issues.occlusions.length} 条楼层遮挡记录
            </span>
          `:""}
          ${t.issues.biases.length>0?`
            <span class="issue-badge issue-bias">
              🚪 ${t.issues.biases.length} 条入口热度偏差
            </span>
          `:""}
        </div>
        ${t.issues.duplicates.length>0?`
        <h3 style="font-size: 16px; margin: 20px 0 10px;">重复访客记录</h3>
        <table>
          <thead><tr><th>访客ID</th><th>设备标识</th><th>间隔时间</th><th>处理说明</th></tr></thead>
          <tbody>
            ${t.issues.duplicates.slice(0,10).map(r=>`
              <tr>
                <td><code>${r.visitorId.slice(0,12)}...</code></td>
                <td><code>${r.deviceId.slice(0,16)}...</code></td>
                <td>${Math.round(r.timeDiff/6e4)} 分钟</td>
                <td style="color: #666; font-size: 12px;">${r.reason}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        `:""}
        ${t.issues.biases.length>0?`
        <h3 style="font-size: 16px; margin: 20px 0 10px;">入口热度偏差 (影响作品)</h3>
        <table>
          <thead><tr><th>作品</th><th>受影响访客</th><th>偏差说明</th></tr></thead>
          <tbody>
            ${Array.from(new Set(t.issues.biases.map(r=>r.artworkId))).slice(0,10).map(r=>{const a=t.issues.biases.filter(l=>l.artworkId===r),o=t.artworks.find(l=>l.id===r);return`
                <tr>
                  <td>${(o==null?void 0:o.name)||r}</td>
                  <td>${a.length}人</td>
                  <td style="color: #666; font-size: 12px;">可能受到入口人流引导，热度被高估</td>
                </tr>
              `}).join("")}
          </tbody>
        </table>
        `:""}
      `}
    </div>
    `:""}

    ${n.includeHeatmap?`
    <div class="section">
      <h2>📍 热力分布说明</h2>
      <p style="color: #666; margin-bottom: 16px;">
        热力图基于访客停留时间和经过频次计算，颜色从绿到红表示热度从低到高。
      </p>
      <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8f9ff; border-radius: 8px;">
        <span style="font-size: 12px; color: #22c55e;">低热度</span>
        <div style="flex: 1; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);"></div>
        <span style="font-size: 12px; color: #ef4444;">高热度</span>
      </div>
      <p style="color: #888; font-size: 12px; margin-top: 12px;">
        热力图数据包含 ${t.heatmapData.length} 个采样点，覆盖 ${be.width}m × ${be.depth}m × ${be.floorCount}层 展厅空间。
      </p>
    </div>
    `:""}

    <div class="footer">
      <p>本报告由「画廊观展动线热图分析工具」生成</p>
      <p>记录ID: ${t.id} | 生成时间: ${Le(Date.now())}</p>
    </div>
  </div>
</body>
</html>`;return Ii(i,`${e}.html`,"text/html"),i}exportJSON(t,e,n){const i={name:e,exportedAt:Date.now(),record:{id:t.id,name:t.name,createdAt:t.createdAt,updatedAt:t.updatedAt,statistics:t.statistics,batches:t.batches,congestionPoints:t.congestionPoints,issues:t.issues}};n.includeArtworks&&(i.record.artworks=t.statistics.artworks),n.includeVisitors&&(i.record.visitors=t.visitors.map(a=>({id:a.id,deviceId:a.deviceId,batch:a.batch,totalDuration:a.totalDuration,totalDistance:a.totalDistance,artworkVisits:a.artworkVisits,entranceTime:a.entranceTime,exitTime:a.exitTime,isDuplicate:a.isDuplicate,issues:a.issues}))),n.includeHeatmap&&(i.record.heatmapData=t.heatmapData);const r=JSON.stringify(i,null,2);return Ii(r,`${e}.json`,"application/json"),r}exportCSV(t,e,n){let i="";const r=[];return n.includeArtworks&&(r.push("=== 作品热度排行 ==="),r.push("排名,作品名称,楼层,观看人数,平均停留(秒),热度指数"),t.statistics.artworks.forEach((a,o)=>{r.push(`${o+1},"${a.name}",${a.floor||1},${a.totalVisitors},${a.avgStayDuration.toFixed(1)},${a.heatValue.toFixed(2)}`)}),r.push("")),n.includeVisitors&&(r.push("=== 访客记录 ==="),r.push("访客ID,设备ID,批次,总时长(秒),总距离(m),观看作品数,进入时间,离开时间,是否重复"),t.visitors.forEach(a=>{r.push(`"${a.id}","${a.deviceId}","${a.batch}",${a.totalDuration.toFixed(1)},${a.totalDistance.toFixed(1)},${a.artworkVisits.length},${Le(a.entranceTime)},${Le(a.exitTime)},${a.isDuplicate?"是":"否"}`)}),r.push("")),n.includeCongestion&&(r.push("=== 拥堵点 ==="),r.push("序号,X坐标,Z坐标,楼层,时间,人数,持续时间(秒),严重程度"),t.congestionPoints.forEach((a,o)=>{r.push(`${o+1},${a.x.toFixed(2)},${a.z.toFixed(2)},${a.floor},${Le(a.timestamp)},${a.visitorCount},${a.duration.toFixed(0)},${a.severity}`)}),r.push("")),n.includeIssues&&(r.push("=== 数据质量问题 ==="),t.issues.duplicates.length>0&&(r.push("--- 重复访客 ---"),r.push("访客ID,设备ID,间隔(分钟),原因"),t.issues.duplicates.forEach(a=>{r.push(`"${a.visitorId}","${a.deviceId}",${Math.round(a.timeDiff/6e4)},"${a.reason}"`)})),t.issues.biases.length>0&&(r.push("--- 入口热度偏差 ---"),r.push("作品ID,访客ID,到达时间(秒),距入口距离(m)"),t.issues.biases.forEach(a=>{r.push(`"${a.artworkId}","${a.visitorId}",${a.timeFromEntrance.toFixed(1)},${a.distToEntrance}`)}))),i=r.join(`
`),Ii(i,`${e}.csv`,"text/csv"),i}}function Yp(){const s=Date.now()-72e5,t=[{id:"art_001",name:"星空",x:-15,z:-12,floor:1,width:4,height:3,rotation:0,color:9133302,interactionRadius:3},{id:"art_002",name:"向日葵",x:-15,z:0,floor:1,width:3,height:2.5,rotation:0,color:16096779,interactionRadius:3},{id:"art_003",name:"蒙娜丽莎",x:-15,z:12,floor:1,width:2.5,height:3.5,rotation:0,color:15485081,interactionRadius:3},{id:"art_004",name:"呐喊",x:0,z:-13,floor:1,width:3,height:2.5,rotation:0,color:1096065,interactionRadius:3},{id:"art_005",name:"记忆的永恒",x:15,z:-12,floor:1,width:3.5,height:2.5,rotation:Math.PI,color:6514417,interactionRadius:3},{id:"art_006",name:"戴珍珠耳环的少女",x:15,z:0,floor:1,width:2.5,height:3,rotation:Math.PI,color:16007006,interactionRadius:3},{id:"art_007",name:"维纳斯的诞生",x:15,z:12,floor:1,width:4,height:3,rotation:Math.PI,color:959977,interactionRadius:3},{id:"art_008",name:"最后的晚餐",x:-15,z:-12,floor:2,width:5,height:3,rotation:0,color:11032055,interactionRadius:3},{id:"art_009",name:"创造亚当",x:0,z:-13,floor:2,width:5,height:3,rotation:0,color:16347926,interactionRadius:3},{id:"art_010",name:"星月夜",x:15,z:-12,floor:2,width:4,height:3,rotation:Math.PI,color:2282478,interactionRadius:3}],e=[],n=["device_001","device_002","device_003","device_004","device_005","device_006","device_007","device_008","device_009","device_010","device_011","device_012","device_013","device_014","device_015","device_016","device_017","device_018","device_019","device_020"],i=[[{x:0,z:14,floor:1},{x:-10,z:12,floor:1},{x:-15,z:12,floor:1},{x:-15,z:0,floor:1},{x:-15,z:-12,floor:1},{x:0,z:-13,floor:1},{x:15,z:-12,floor:1},{x:15,z:0,floor:1},{x:15,z:12,floor:1},{x:5,z:14,floor:1}],[{x:0,z:14,floor:1},{x:10,z:12,floor:1},{x:15,z:12,floor:1},{x:15,z:0,floor:1},{x:15,z:-12,floor:1},{x:0,z:-13,floor:1},{x:-15,z:-12,floor:1},{x:-15,z:0,floor:1},{x:-15,z:12,floor:1},{x:-5,z:14,floor:1}],[{x:0,z:14,floor:1},{x:0,z:5,floor:1},{x:0,z:-5,floor:1},{x:0,z:-13,floor:1},{x:0,z:-5,floor:1},{x:0,z:5,floor:1},{x:5,z:14,floor:1}],[{x:0,z:14,floor:1},{x:-8,z:10,floor:1},{x:-15,z:12,floor:1},{x:-15,z:5,floor:1},{x:-8,z:0,floor:1},{x:-15,z:-5,floor:1},{x:-15,z:-12,floor:1},{x:-8,z:-10,floor:1},{x:0,z:-13,floor:1},{x:8,z:-10,floor:1},{x:15,z:-12,floor:1},{x:15,z:-5,floor:1},{x:8,z:0,floor:1},{x:15,z:5,floor:1},{x:15,z:12,floor:1},{x:8,z:10,floor:1},{x:0,z:14,floor:1}],[{x:0,z:14,floor:1},{x:-5,z:10,floor:1},{x:-10,z:5,floor:1},{x:-5,z:0,floor:1},{x:-10,z:-5,floor:1},{x:-5,z:-10,floor:1},{x:0,z:-5,floor:1},{x:5,z:-10,floor:1},{x:10,z:-5,floor:1},{x:5,z:0,floor:1},{x:10,z:5,floor:1},{x:5,z:10,floor:1},{x:0,z:14,floor:1}]],r=[[{x:0,z:14,floor:1},{x:0,z:5,floor:1},{x:0,z:-5,floor:1},{x:0,z:-13,floor:1},{x:0,z:-5,floor:1},{x:0,z:5,floor:1},{x:0,z:14,floor:2},{x:-8,z:10,floor:2},{x:-15,z:-12,floor:2},{x:0,z:-13,floor:2},{x:15,z:-12,floor:2},{x:8,z:10,floor:2},{x:0,z:14,floor:1}],[{x:0,z:14,floor:1},{x:-15,z:12,floor:1},{x:-15,z:0,floor:1},{x:-15,z:-12,floor:1},{x:0,z:-13,floor:1},{x:0,z:14,floor:2},{x:-15,z:-12,floor:2},{x:0,z:-13,floor:2},{x:15,z:-12,floor:2},{x:0,z:14,floor:1}]];for(let a=0;a<25;a++){const o=a<8?"1":a<16?"2":"3",l=a<20?Math.floor(Math.random()*i.length):Math.floor(Math.random()*r.length),c=a<20?i[l]:r[l-i.length+r.length],d=a*12e4,u=.8+Math.random()*.4,p=n[a%n.length],m=[];let g=s+d;for(let _=0;_<c.length;_++){const f=c[_],h=3+Math.floor(Math.random()*3);for(let E=0;E<h;E++){const x=E/h,T=c[(_+1)%c.length],D=f.x+(T.x-f.x)*x+(Math.random()-.5)*2,R=f.z+(T.z-f.z)*x+(Math.random()-.5)*2,W=Math.random()<.3?5e3+Math.random()*2e4:2e3+Math.random()*5e3;m.push({x:Math.max(-18,Math.min(18,D)),z:Math.max(-14,Math.min(14,R)),floor:f.floor,timestamp:g}),g+=W*u}}e.push({id:`visitor_${String(a+1).padStart(3,"0")}`,deviceId:p,batch:o,path:m})}return e.push({id:"visitor_duplicate",deviceId:"device_001",batch:"3",path:[{x:0,z:14,floor:1,timestamp:s+8e5},{x:-5,z:10,floor:1,timestamp:s+805e3},{x:-10,z:5,floor:1,timestamp:s+81e4},{x:-15,z:12,floor:1,timestamp:s+82e4},{x:-5,z:14,floor:1,timestamp:s+84e4}]}),{name:"2026年5月28日 观展数据 (示例)",artworks:t,visitors:e}}class Kp{constructor(){this.sceneManager=null,this.dataManager=new Xp,this.animationController=null,this.uiController=null,this.reportExporter=null,this.currentRecord=null,this.highlightedArtworks=[],this.activeFloor=null,this.visualMode=sn.COMBINED,this.congestionMarkers=[],this.issueMarkers=[],this.showCongestion=!0,this.showIssues=!0,this.heatmapOpacity=.6,this.heatmapRadius=2.5}init(){const t=document.getElementById("canvas-container");this.sceneManager=new zp(t),this.animationController=new $p(this.sceneManager),this.uiController=new qp(this),this.reportExporter=new jp(this.dataManager),this.sceneManager.init(),this.uiController.init(),this.sceneManager.onObjectClick=e=>{this.toggleArtworkHighlight(e.id),this.uiController.updateArtworkList()},this.loadSampleDataIfEmpty(),window.addEventListener("resize",()=>this.onResize())}async loadSampleDataIfEmpty(){if(this.dataManager.records.length===0){const t=Yp();this.dataManager.createRecord(t,"gallery-sample-data.json"),this.dataManager.saveToStorage()}this.loadCurrentRecord(),this.uiController.updateRecordDisplay()}loadCurrentRecord(){const t=this.dataManager.getCurrentRecord();if(!t)return;this.currentRecord=t,this.highlightedArtworks=[],this.sceneManager.clearArtworks(),this.sceneManager.clearVisitors(),this.sceneManager.clearHeatmap(),this.clearCongestionMarkers(),this.clearIssueMarkers(),this.dataManager.getFilteredArtworks(t,t.filters).forEach(r=>{this.sceneManager.addArtwork(r)}),this.updateHeatmap(),this.updateCongestionPoints(),this.updateIssueMarkers();const i=this.dataManager.getFilteredVisitors(t,t.filters).map(r=>{var a;return{...r,batchColor:((a=t.batches.find(o=>o.id===r.batch))==null?void 0:a.color)||6717162}});this.animationController.setVisitors(i),this.uiController.updateTimelineDisplay()}setViewMode(t){this.sceneManager.setViewMode(t)}setVisualMode(t){this.visualMode=t,this.updateHeatmap(),this.updateVisitorsVisibility()}setActiveFloor(t){this.activeFloor=t,t===null?this.sceneManager.setFloorOpacity(999,1):this.sceneManager.setFloorOpacity(t,.3),this.updateHeatmap(),this.updateCongestionPoints()}setLabelsVisible(t){this.sceneManager.setLabelsVisible(t)}setGridVisible(t){this.sceneManager.setGridVisible(t)}setCongestionVisible(t){this.showCongestion=t,this.congestionMarkers.forEach(e=>{e.visible=t})}setIssuesVisible(t){this.showIssues=t,this.issueMarkers.forEach(e=>{e.visible=t})}setHeatmapOpacity(t){this.heatmapOpacity=t,this.sceneManager.objects.heatmap&&(this.sceneManager.objects.heatmap.material.opacity=t)}setHeatmapRadius(t){this.heatmapRadius=t,this.updateHeatmap()}updateHeatmap(){if(!this.currentRecord)return;if(this.visualMode===sn.NORMAL||this.visualMode===sn.PATH){this.sceneManager.clearHeatmap();return}let t=this.currentRecord.heatmapData;if(this.activeFloor!==null&&(t=t.filter(e=>e.floor===this.activeFloor)),this.currentRecord.filters.selectedBatches.length>0){const e=this.dataManager.getFilteredVisitors(this.currentRecord,this.currentRecord.filters);t=this.regenerateHeatmap(e)}if(t.length>0){const e=this.activeFloor||1;this.sceneManager.createHeatmap(t,e),this.sceneManager.objects.heatmap.material.opacity=this.heatmapOpacity}}regenerateHeatmap(t){const{width:e,depth:n}=be,i=1,r={};for(const a of t)for(let o=0;o<a.path.length;o++){const l=a.path[o];if(this.activeFloor!==null&&l.floor!==this.activeFloor)continue;const c=Math.floor((l.x+e/2)/i),d=Math.floor((l.z+n/2)/i),u=`${c},${d},${l.floor}`;r[u]||(r[u]={x:l.x,z:l.z,floor:l.floor,value:0,duration:0}),r[u].value+=1,o>0&&(r[u].duration+=(l.timestamp-a.path[o-1].timestamp)/1e3)}return Object.values(r)}updateVisitorsVisibility(){const t=this.visualMode===sn.PATH||this.visualMode===sn.COMBINED;this.sceneManager.objects.visitors.forEach(e=>{e.mesh.visible=t,e.trail.visible=t})}updateCongestionPoints(){if(!this.currentRecord||(this.clearCongestionMarkers(),!this.showCongestion))return;let t=this.currentRecord.congestionPoints;this.activeFloor!==null&&(t=t.filter(n=>n.floor===this.activeFloor));const{height:e}=be;t.forEach(n=>{const i=(n.floor-1)*e,r=n.severity==="high"?15680580:n.severity==="medium"?16096779:2278750,a=new Rs(1.5,1.5,.1,16),o=new mn({color:r,transparent:!0,opacity:.6}),l=new Jt(a,o);l.position.set(n.x,i+.05,n.z);const c=new Fi(1.5,2.5,32),d=new mn({color:r,transparent:!0,opacity:.3,side:Oe}),u=new Jt(c,d);u.rotation.x=-Math.PI/2,u.position.y=i+.02,l.add(u);const p=new Fi(.5,.7,16),m=new mn({color:16777215,transparent:!0,opacity:.8,side:Oe}),g=new Jt(p,m);g.rotation.x=-Math.PI/2,g.position.y=i+.1,l.add(g),l.userData.congestionData=n,l.userData.isPulse=g,l.userData.baseScale=1,this.sceneManager.scene.add(l),this.congestionMarkers.push(l)}),this.animateCongestionMarkers()}animateCongestionMarkers(){const t=()=>{const e=Date.now()*.003;this.congestionMarkers.forEach(n=>{if(n.userData.isPulse){const i=1+Math.sin(e)*.3;n.userData.isPulse.scale.set(i,i,i),n.userData.isPulse.material.opacity=.5+Math.sin(e)*.3}}),requestAnimationFrame(t)};t()}clearCongestionMarkers(){this.congestionMarkers.forEach(t=>{this.sceneManager.scene.remove(t)}),this.congestionMarkers=[]}updateIssueMarkers(){if(!this.currentRecord||(this.clearIssueMarkers(),!this.showIssues))return;const{height:t}=be;this.currentRecord.issues.biases.forEach(n=>{const i=this.currentRecord.artworks.find(c=>c.id===n.artworkId);if(!i||this.activeFloor!==null&&i.floor!==this.activeFloor)return;const r=((i.floor||1)-1)*t,a=new Cs(.3,8,8),o=new mn({color:3900150,transparent:!0,opacity:.8}),l=new Jt(a,o);l.position.set(i.x,r+4,i.z),this.sceneManager.scene.add(l),this.issueMarkers.push(l)})}clearIssueMarkers(){this.issueMarkers.forEach(t=>{this.sceneManager.scene.remove(t)}),this.issueMarkers=[]}toggleArtworkHighlight(t){const e=this.highlightedArtworks.indexOf(t);e===-1?this.highlightedArtworks.push(t):this.highlightedArtworks.splice(e,1),this.sceneManager.objects.artworks.forEach((n,i)=>{const r=this.highlightedArtworks.includes(i),a=n.mesh.material;if(r)a.emissive.setHex(16498468),a.emissiveIntensity=.5,n.group.scale.set(1.1,1.1,1.1);else{const o=n.data.color||9133302;a.emissive.setHex(o),a.emissiveIntensity=.1,n.group.scale.set(1,1,1)}})}toggleBatchFilter(t,e){if(!this.currentRecord)return;const n=this.currentRecord.filters,i=n.selectedBatches.indexOf(t);e?i===-1&&n.selectedBatches.push(t):i!==-1&&n.selectedBatches.splice(i,1),this.dataManager.updateRecord(this.currentRecord.id,{filters:n}),this.loadCurrentRecord()}focusArtwork(t){const e=this.sceneManager.objects.artworks.get(t);if(!e)return;const n=e.group.position.clone();n.y+=2,n.x+=5,n.z+=5,this.sceneManager.camera.position.copy(n),this.sceneManager.controls.target.copy(e.group.position),this.sceneManager.controls.update(),this.highlightedArtworks.includes(t)||(this.toggleArtworkHighlight(t),this.uiController.updateArtworkList())}focusVisitor(t){var r;const e=(r=this.currentRecord)==null?void 0:r.visitors.find(a=>a.id===t);if(!e||e.path.length===0)return;const n=e.path[0],i=new L(n.x+5,n.y+3,n.z+5);this.sceneManager.camera.position.copy(i),this.sceneManager.controls.target.set(n.x,n.y,n.z),this.sceneManager.controls.update(),this.uiController.showToast(`已定位到访客 ${t.slice(0,8)}...`,"info")}exportReport(t,e,n){return this.reportExporter.export(t,e,n)}onResize(){this.sceneManager&&this.sceneManager.resize()}dispose(){this.sceneManager&&this.sceneManager.dispose(),this.animationController&&this.animationController.dispose()}}const zr=new Kp;window.addEventListener("DOMContentLoaded",()=>{zr.init()});window.addEventListener("resize",()=>{zr.onResize()});window.galleryApp=zr;
//# sourceMappingURL=index-Cx2wk5Q0.js.map
