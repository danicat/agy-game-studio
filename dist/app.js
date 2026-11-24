(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function e(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(s){if(s.ep)return;s.ep=!0;const i=e(s);fetch(s.href,i)}})();let q=null,O=null;const Q=[],tt=[];function R(a){if(typeof a=="number"&&Number.isFinite(a))return!0;if(typeof a!="string")return!1;const t=a.trim();return t.length>0&&!(t.startsWith("__")&&t.endsWith("__"))}async function L(a,t={}){const e=a.startsWith("http://")||a.startsWith("https://")?a:`${V()}${a}`;return window.sidecar&&typeof window.sidecar.fetch=="function"?window.sidecar.fetch(e,t):fetch(e,t)}function V(){const a=window.__STUDIO_CONFIG__?.apiBaseUrl;return R(a)?String(a).trim().replace(/\/+$/,""):""}const U=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;function at(){const a=window.sidecar?.conversationId?.trim();if(a&&U.test(a))return a;const t=new URLSearchParams(window.location.search),e=(t.get("conversationId")||t.get("session_id")||t.get("sessionId"))?.trim();if(e&&R(e)&&U.test(e))return e;const n=window.__STUDIO_CONFIG__?.sessionId;if(R(n)){const i=String(n).trim();if(U.test(i))return i}const s=(t.get("file")||t.get("path"))?.trim();if(s){const i=s.replace(/\\/g,"/").match(/\/brain\/([a-zA-Z0-9_-]{1,128})\//);if(i&&i[1]!=="tempmediaStorage"&&U.test(i[1]))return i[1]}return""}async function ot(){if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const a=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(t=>setTimeout(()=>t([]),1e3))]);return Array.isArray(a)?a:[]}catch{return[]}return[]}function D(){return q===null&&(q=at()),q}function $(){const a=D();return a||null}function et(a){const t=a.trim();if(!t||!U.test(t))throw new Error(`Invalid session_id "${a}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`);q=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.sessionId=t);for(const e of Q)e(t)}function G(a){et(a)}function rt(a){Q.push(a)}function lt(){const t=new URLSearchParams(window.location.search).get("workspace")?.trim();if(t&&R(t))return t;const e=window.__STUDIO_CONFIG__?.workspace;return R(e)?String(e).trim():""}function x(){return O===null&&(O=lt()),O}function B(a){const t=a.trim();O=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.workspace=t);for(const e of tt)e(t)}function dt(a){tt.push(a)}function ct(){return new URLSearchParams(window.location.search).get("mode")==="preview"||window.__STUDIO_CONFIG__?.mode==="preview"?"preview":"full"}function N(){const a=window.location.protocol==="http:"||window.location.protocol==="https:"?window.location.origin:V(),t=D()||"standalone",e=x(),n=new URLSearchParams({mode:"full",conversationId:t}),s=new URLSearchParams(window.location.search).get("token");return s&&n.set("token",s),e&&n.set("workspace",e),`${a}/?${n.toString()}`}async function W(a){const t=await L("/api/workspace/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceUri:a})});if(!t.ok){const e=await t.json().catch(()=>({}));throw new Error(e.error||`Failed to resolve workspace URI: HTTP ${t.status}`)}return await t.json()}async function ut(){const a=await L("/api/health",{method:"GET",cache:"no-store"});if(!a.ok)throw new Error(`Failed to fetch sidecar health: HTTP ${a.status} ${a.statusText}`);const t=await a.json();return t.activeSessionId&&!D()&&et(t.activeSessionId),t.defaultWorkspace&&!x()&&B(t.defaultWorkspace),t}let z=!1,P=null;async function ht(){if(window.sidecar?.conversationId&&!$())try{G(window.sidecar.conversationId)}catch{}return!z&&window.sidecar&&typeof window.sidecar.onWorkspaceChange=="function"&&(z=!0,window.sidecar.onWorkspaceChange(a=>{Array.isArray(a)&&a.length>0&&a[0]&&W(a[0]).then(t=>{t.workspace&&B(t.workspace)}).catch(()=>{})})),P||(P=(async()=>{let a=!1;if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const t=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(e=>setTimeout(()=>e([]),1200))]);if(Array.isArray(t)&&t.length>0&&t[0]){const e=await W(t[0]);e.workspace&&(B(e.workspace),a=!0)}}catch{}try{const t=await ut();if(t.activeSessionId&&!$()&&G(t.activeSessionId),!a&&!x()&&t.defaultWorkspace){const e=await W(t.defaultWorkspace);e.workspace&&B(e.workspace)}}catch{}return x()})().finally(()=>{P=null}),P)}async function pt(){const a=await L("/api/sessions",{method:"GET",cache:"no-store"});if(!a.ok)throw new Error(`Failed to fetch recent sessions: HTTP ${a.status} ${a.statusText}`);const t=await a.json();return Array.isArray(t.sessions)?t.sessions:[]}async function ft(a){const t=a.workspace.trim();if(!t)throw new Error("Workspace path is required to compile Go WASM.");const e=a.pkg?.trim()||void 0,n=await L("/api/playtest/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:t,pkg:e})}),s=await n.text();let i={};if(s.trim())try{i=JSON.parse(s)}catch{throw new Error(`Unexpected non-JSON response from /api/playtest/build (HTTP ${n.status}): ${s.slice(0,300)}`)}if(n.status===422)return{ok:!1,status:422,error:i.error||"Go WASM compilation failed",compilerOutput:i.compilerOutput||i.stderr||i.error||s,workspace:i.workspace||t,pkg:i.pkg||e||".",exitCode:typeof i.exitCode=="number"?i.exitCode:1};if(!n.ok)throw new Error(i.error||`WASM build request failed with HTTP ${n.status} ${n.statusText}`);return{ok:!0,status:200,buildId:i.buildId,workspace:i.workspace||t,pkg:i.pkg||e||".",wasmBytes:i.wasmBytes??0,durationMs:i.durationMs??0,wasmUrl:i.wasmUrl||`/api/playtest/wasm?buildId=${encodeURIComponent(i.buildId)}`,wasmExecUrl:i.wasmExecUrl||"/api/playtest/wasm_exec.js"}}async function X(a){const t=a.sessionId||window.sidecar?.conversationId||D()||"standalone",e=a.workspace||x(),n=a.pkg||".",s=a.filename||`playtest-bug-${Date.now()}.png`,i=await L("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,filename:s,image:a.imageDataUrl,note:a.note||"",consoleLogs:a.consoleLogs||[],workspace:e,pkg:n,metadata:{workspace:e,pkg:n,frameOffset:a.frameOffset??"live",resolution:a.resolution||(a.width&&a.height?`${a.width}x${a.height}`:"canvas"),width:a.width,height:a.height}})}),r=await i.text();let o={};try{o=r?JSON.parse(r):{}}catch{o={error:r}}if(!i.ok)throw new Error(o.error||`Failed to send bug report to chat: HTTP ${i.status} ${i.statusText}`);return o}async function gt(a){const t=a.sessionId||window.sidecar?.conversationId||D()||"standalone",e=a.workspace||x(),n=a.pkg||".",s=await L("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,buildError:a.buildError,note:a.note||"",workspace:e,pkg:n,metadata:{workspace:e,pkg:n}})}),i=await s.text();let r={};try{r=i?JSON.parse(i):{}}catch{r={error:i}}if(!s.ok)throw new Error(r.error||`Failed to send build error to chat: HTTP ${s.status} ${s.statusText}`);return r}function mt(){const t=document.querySelector(".studio-top-tab.active")?.dataset?.view||"",e=new URLSearchParams(window.location.search),n=(e.get("tab")||"").trim().toLowerCase(),s=t||n||"playtest",i=s==="sound"?"Sound":s==="sprite"||s==="sprites"?"Sprites":"Playtest";let r=(e.get("file")||e.get("path")||"").trim();if(s==="sprite"||s==="sprites"){const d=document.getElementById("spr-active-file-badge")?.getAttribute("title")?.trim()||"";d&&d!=="No sprite loaded"&&(r=d)}else if(s==="sound"){const d=document.getElementById("sound-active-file-label")?.getAttribute("title")?.trim()||"";d&&!/^Untitled\.(sfx|music)$/i.test(d)&&(r=d)}return{tab:i,filePath:r}}async function Y(a){const t=a.sessionId||window.sidecar?.conversationId||D()||"standalone",e=a.workspace||x()||".",n=mt(),s=a.tab||n.tab,i=a.filePath??n.filePath,r=a.errorTitle.trim()||"Game Dev Studio Error",o=a.errorDetail&&a.errorDetail.trim()||r,d=await L("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,errorTitle:r,studioError:o,workspace:e,metadata:{workspace:e,tab:s,filePath:i}})}),u=await d.text();let h={};try{h=u?JSON.parse(u):{}}catch{h={error:u}}if(!d.ok)throw new Error(h.error||`Failed to send error to agent: HTTP ${d.status} ${d.statusText}`);return h}async function bt(a){const t=await ot(),e=new URLSearchParams,n=$();n&&e.set("session_id",n),t.length>0&&t[0]?e.set("workspace_uri",t[0]):x()&&e.set("workspace",x());const s=e.toString(),i=await L(`/api/fs/info${s?`?${s}`:""}`,{method:"GET",cache:"no-store"});if(!i.ok){const r=await i.json().catch(()=>({}));throw new Error(r.error||`Failed to fetch filesystem info: HTTP ${i.status}`)}return await i.json()}async function nt(a,t="all",e){const n=new URLSearchParams;a&&a.trim()&&n.set("dir",a.trim()),n.set("filter",t);const s=await L(`/api/fs/list?${n.toString()}`,{method:"GET",cache:"no-store"});if(!s.ok){const i=await s.json().catch(()=>({}));throw new Error(i.error||`Failed to list directory "${a}": HTTP ${s.status}`)}return await s.json()}async function yt(a){const t=await nt(a,"project");return{workspace:t.dir||a,pkg:t.defaultPkg||".",packages:Array.isArray(t.packages)&&t.packages.length>0?t.packages:["."],hasGoMod:!!t.hasGoMod}}class vt{maxFrames;captureIntervalMs;slots;writePtr=0;count=0;sequence=0;lastCaptureTimeMs=-1/0;constructor(t=250,e=40){if(!Number.isInteger(t)||t<1)throw new Error(`[FrameDvrBuffer] Invalid maxFrames=${t}. Must be a positive integer.`);if(!Number.isFinite(e)||e<1)throw new Error(`[FrameDvrBuffer] Invalid captureIntervalMs=${e}. Must be a positive number.`);this.maxFrames=t,this.captureIntervalMs=e,this.slots=new Array(t).fill(null)}get length(){return this.count}shouldCapture(t){return t-this.lastCaptureTimeMs>=this.captureIntervalMs}recordFrame(t,e=performance.now()){if(!t||typeof t.toDataURL!="function"||typeof t.width!="number"||typeof t.height!="number")throw new Error("[FrameDvrBuffer] recordFrame requires a valid canvas element with width, height, and toDataURL().");if(t.width<=0||t.height<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${t.width}x${t.height}).`);const n=t.toDataURL("image/png");return this.recordFrameDataUrl(n,t.width,t.height,e)}recordFrameDataUrl(t,e,n,s=performance.now()){if(typeof t!="string"||!t.startsWith("data:image/"))throw new Error("[FrameDvrBuffer] Canvas toDataURL() did not return a valid image data URI.");if(!Number.isFinite(e)||!Number.isFinite(n)||e<=0||n<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${e}x${n}).`);const i=++this.sequence,r={frameNumber:i,timestampMs:s,width:e,height:n,dataUrl:t};return this.slots[this.writePtr]=r,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s,{index:this.count-1,frameNumber:i,timestampMs:s,relativeSec:0,width:r.width,height:r.height,dataUrl:r.dataUrl}}recordCanvasSlot(t,e,n,s){const r={frameNumber:++this.sequence,timestampMs:s,width:e,height:n,dataUrl:"",canvas:t};this.slots[this.writePtr]=r,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s}recordFrameIfDue(t,e=performance.now()){return this.shouldCapture(e)?this.recordFrame(t,e):null}createDvrFrameFromSlot(t,e,n){return{index:e,frameNumber:t.frameNumber,timestampMs:t.timestampMs,relativeSec:n,width:t.width,height:t.height,canvas:t.canvas,get dataUrl(){return!t.dataUrl&&t.canvas&&(t.dataUrl=t.canvas.toDataURL("image/png")),t.dataUrl}}}getFrames(){if(this.count===0)return[];const t=this.count<this.maxFrames?0:this.writePtr,e=(t+this.count-1)%this.maxFrames,n=this.slots[e],s=n?n.timestampMs:0,i=new Array(this.count);for(let r=0;r<this.count;r++){const o=(t+r)%this.maxFrames,d=this.slots[o],u=(d.timestampMs-s)/1e3,h=u===0?0:Number(u.toFixed(2));i[r]=this.createDvrFrameFromSlot(d,r,h)}return i}getFrameAt(t){if(!Number.isInteger(t)||t<0||t>=this.count)return null;const e=this.count<this.maxFrames?0:this.writePtr,n=(e+t)%this.maxFrames,s=this.slots[n];if(!s)return null;const i=(e+this.count-1)%this.maxFrames,r=this.slots[i],o=r?r.timestampMs:s.timestampMs,d=(s.timestampMs-o)/1e3,u=d===0?0:Number(d.toFixed(2));return this.createDvrFrameFromSlot(s,t,u)}getLatestFrame(){return this.count===0?null:this.getFrameAt(this.count-1)}clear(){this.slots.fill(null),this.writePtr=0,this.count=0,this.lastCaptureTimeMs=-1/0}}function wt(){const a=new Uint8Array(768);let t=0;const e=(r,o,d)=>{t>=256||(a[t*3]=r,a[t*3+1]=o,a[t*3+2]=d,t++)},n=[0,51,102,153,204,255];for(let r=0;r<6;r++)for(let o=0;o<6;o++)for(let d=0;d<6;d++)e(n[r],n[o],n[d]);for(let r=0;r<24;r++){const o=Math.round(8+r*238/23);e(o,o,o)}const s=[[239,68,68],[250,204,21],[6,182,212],[34,197,94],[255,255,255],[9,13,22],[11,15,26],[16,23,38],[20,12,14],[56,189,248],[244,63,94],[168,85,247],[16,185,129],[245,158,11],[99,102,241],[236,72,153]];for(const[r,o,d]of s)e(r,o,d);const i=new Uint8Array(32768);for(let r=0;r<32;r++){const o=r<<3|r>>2;for(let d=0;d<32;d++){const u=d<<3|d>>2;for(let h=0;h<32;h++){const l=h<<3|h>>2;let c=0,f=1/0;for(let p=0;p<256;p++){const m=a[p*3],S=a[p*3+1],w=a[p*3+2],v=o-m,b=u-S,g=l-w,y=v*v*2+b*b*4+g*g;if(y<f&&(f=y,c=p,y===0))break}i[r<<10|d<<5|h]=c}}}return{palette:a,lut15:i}}let j=null;function St(){return j||(j=wt()),j}class Et{buf;length=0;constructor(t=262144){this.buf=new Uint8Array(t)}ensure(t){const e=this.length+t;if(e<=this.buf.length)return;let n=this.buf.length*2;for(;n<e;)n*=2;const s=new Uint8Array(n);s.set(this.buf.subarray(0,this.length)),this.buf=s}writeByte(t){this.ensure(1),this.buf[this.length++]=t&255}writeUint16LE(t){this.ensure(2),this.buf[this.length++]=t&255,this.buf[this.length++]=t>>8&255}writeBytes(t){this.ensure(t.length),this.buf.set(t,this.length),this.length+=t.length}writeAscii(t){this.ensure(t.length);for(let e=0;e<t.length;e++)this.buf[this.length++]=t.charCodeAt(e)&255}toUint8Array(){return this.buf.slice(0,this.length)}}function kt(a,t,e){a.writeByte(8);let r=9,o=258,d=(1<<r)-1;e.fill(-1);const u=new Uint8Array(255);let h=0,l=0,c=0;const f=()=>{h>0&&(a.writeByte(h),a.writeBytes(u.subarray(0,h)),h=0)},p=m=>{for(l|=m<<c,c+=r;c>=8;)u[h++]=l&255,h===255&&f(),l>>=8,c-=8};if(p(256),t.length>0){let m=t[0];for(let S=1;S<t.length;S++){const w=t[S],v=m<<8|w,b=e[v];b!==-1?m=b:(p(m),o<4096?(e[v]=o,o>d&&r<12&&(r++,d=(1<<r)-1),o++):(p(256),e.fill(-1),r=9,o=258,d=(1<<r)-1),m=w)}p(m)}p(257),c>0&&(u[h++]=l&255),f(),a.writeByte(0)}function xt(a){const{width:t,height:e,frames:n}=a;if(!Number.isInteger(t)||!Number.isInteger(e)||t<=0||e<=0)throw new Error(`[GifEncoder] Invalid GIF dimensions: ${t}x${e}.`);if(!Array.isArray(n)||n.length===0)throw new Error("[GifEncoder] encodeAnimatedGif requires at least 1 frame.");const s=t*e*4;for(let l=0;l<n.length;l++){const c=n[l];if(!c||!c.rgba||c.rgba.length!==s)throw new Error(`[GifEncoder] Frame ${l} RGBA length (${c?.rgba?.length??0}) does not match ${t}x${e}x4 (${s}).`)}const{palette:i,lut15:r}=St(),o=new Et(Math.max(65536,t*e*Math.min(n.length,8)));o.writeAscii("GIF89a"),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(247),o.writeByte(0),o.writeByte(0),o.writeBytes(i),o.writeBytes([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);const d=t*e,u=new Uint8Array(d),h=new Int32Array(4096*256);for(let l=0;l<n.length;l++){const c=n[l],f=c.rgba,p=Math.max(2,Math.round((c.delayMs||66)/10));for(let m=0,S=0;m<d;m++,S+=4){const w=f[S]>>3,v=f[S+1]>>3,b=f[S+2]>>3;u[m]=r[w<<10|v<<5|b]}o.writeBytes([33,249,4,0]),o.writeUint16LE(p),o.writeBytes([0,0]),o.writeByte(44),o.writeUint16LE(0),o.writeUint16LE(0),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(0),kt(o,u,h)}return o.writeByte(59),o.toUint8Array()}function H(a,t,e){if(t<=0||e<=0||a.length<t*e*4)return{x:0,y:0,width:Math.max(1,t),height:Math.max(1,e)};const n=(t*e-1)*4,s=a[3],i=a[n+3],r=s===0||i===0,o=a[0],d=a[1],u=a[2],h=!r&&o<=12&&d<=16&&u<=26&&Math.abs(a[n]-o)<=2&&Math.abs(a[n+1]-d)<=2&&Math.abs(a[n+2]-u)<=2,l=g=>{const y=a[g+3];return r?y>16:h?y>16&&(Math.abs(a[g]-o)>2||Math.abs(a[g+1]-d)>2||Math.abs(a[g+2]-u)>2):y>16&&(a[g]>0||a[g+1]>0||a[g+2]>0)};let c=0,f=!1;for(let g=0;g<e;g++){const y=g*t*4;for(let E=0;E<t;E+=2)if(l(y+E*4)){c=g,f=!0;break}if(f)break}if(!f)return{x:0,y:0,width:t,height:e};let p=e-1;for(let g=e-1;g>=c;g--){const y=g*t*4;let E=!1;for(let C=0;C<t;C+=2)if(l(y+C*4)){p=g,E=!0;break}if(E)break}let m=0,S=!1;for(let g=0;g<t;g++){for(let y=c;y<=p;y+=2)if(l((y*t+g)*4)){m=g,S=!0;break}if(S)break}let w=t-1;for(let g=t-1;g>=m;g--){let y=!1;for(let E=c;E<=p;E+=2)if(l((E*t+g)*4)){w=g,y=!0;break}if(y)break}const v=w-m+1,b=p-c+1;return v<64||b<36?{x:0,y:0,width:t,height:e}:{x:m,y:c,width:v,height:b}}function Ct(a){const e=[];for(let s=0;s<a.length;s+=32768){const i=a.subarray(s,s+32768);e.push(String.fromCharCode(...i))}const n=e.join("");return`data:image/gif;base64,${btoa(n)}`}const it=[{name:"Red",hex:"#EF4444"},{name:"Yellow",hex:"#FACC15"},{name:"Cyan",hex:"#06B6D4"},{name:"Lime",hex:"#22C55E"},{name:"White",hex:"#FFFFFF"}];function Lt(a,t){const e=a.replace(/^#/,"").trim();if(e.length===3){const n=parseInt(e[0]+e[0],16),s=parseInt(e[1]+e[1],16),i=parseInt(e[2]+e[2],16);return`rgba(${n}, ${s}, ${i}, ${t})`}if(e.length===6){const n=parseInt(e.slice(0,2),16),s=parseInt(e.slice(2,4),16),i=parseInt(e.slice(4,6),16);return`rgba(${n}, ${s}, ${i}, ${t})`}return`rgba(239, 68, 68, ${t})`}function st(a){return a.type==="pen"?{...a,points:a.points.map(t=>({x:t.x,y:t.y}))}:{...a}}function A(a){return a.map(st)}class At{baseCanvas;overlayCanvas;onHistoryChange;activeTool="box";activeColor=it[0].hex;strokeWidth=3;shapes=[];undoStack=[];redoStack=[];isDrawing=!1;draftShape=null;shapeCounter=0;activeTextInputEl=null;width;height;hasBaseSnapshot=!1;constructor(t={}){this.baseCanvas=t.baseCanvas??null,this.overlayCanvas=t.overlayCanvas??null,this.onHistoryChange=t.onHistoryChange??null,this.width=t.width??(this.baseCanvas?.width||640),this.height=t.height??(this.baseCanvas?.height||360),this.baseCanvas&&(this.baseCanvas.width=this.width,this.baseCanvas.height=this.height),this.overlayCanvas&&(this.overlayCanvas.width=this.width,this.overlayCanvas.height=this.height,this.bindPointerEvents(this.overlayCanvas))}getTool(){return this.activeTool}setTool(t){this.commitOrCloseActiveTextInput(),this.activeTool=t}getColor(){return this.activeColor}setColor(t){if(!t||typeof t!="string")throw new Error("[BugAnnotator] Invalid color value.");this.activeColor=t}getDimensions(){return{width:this.width,height:this.height}}setDimensions(t,e){if(t<=0||e<=0)throw new Error(`[BugAnnotator] Invalid dimensions: ${t}x${e}`);this.width=t,this.height=e,this.baseCanvas&&(this.baseCanvas.width!==t||this.baseCanvas.height!==e)&&(this.baseCanvas.width=t,this.baseCanvas.height=e),this.overlayCanvas&&(this.overlayCanvas.width!==t||this.overlayCanvas.height!==e)&&(this.overlayCanvas.width=t,this.overlayCanvas.height=e),this.renderOverlay()}getShapes(){return A(this.shapes)}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}addShape(t){this.undoStack.push(A(this.shapes)),this.redoStack=[],this.shapes.push(st(t)),this.renderOverlay(),this.notifyHistoryChange()}addTextAnnotation(t,e,n){const s=n.trim();if(!s)return null;const i={id:this.nextShapeId(),type:"text",color:this.activeColor,x:Math.round(t),y:Math.round(e),text:s};return this.addShape(i),i}undo(){if(this.undoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.redoStack.push(A(this.shapes));const t=this.undoStack.pop();return this.shapes=A(t),this.renderOverlay(),this.notifyHistoryChange(),!0}redo(){if(this.redoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.undoStack.push(A(this.shapes));const t=this.redoStack.pop();return this.shapes=A(t),this.renderOverlay(),this.notifyHistoryChange(),!0}clearAnnotations(){this.commitOrCloseActiveTextInput(),this.shapes.length!==0&&(this.undoStack.push(A(this.shapes)),this.redoStack=[],this.shapes=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange())}resetHistory(){this.commitOrCloseActiveTextInput(),this.shapes=[],this.undoStack=[],this.redoStack=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange()}loadBaseFromCanvas(t){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to receive snapshot.");t.width>0&&t.height>0&&this.setDimensions(t.width,t.height);const e=this.baseCanvas.getContext("2d");if(!e)throw new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas.");e.clearRect(0,0,this.width,this.height),e.drawImage(t,0,0,this.width,this.height),this.hasBaseSnapshot=!0,this.renderOverlay()}loadBaseFrameDataUrl(t,e,n){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to load frame data URL.");if(!t||!t.startsWith("data:image/"))throw new Error("[BugAnnotator] Invalid image dataUrl passed to loadBaseFrameDataUrl.");return new Promise((s,i)=>{const r=new Image;r.onload=()=>{const o=e&&e>0?e:r.naturalWidth||this.width,d=n&&n>0?n:r.naturalHeight||this.height;this.setDimensions(o,d);const u=this.baseCanvas.getContext("2d");if(!u){i(new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas."));return}u.clearRect(0,0,o,d),u.drawImage(r,0,0,o,d),this.hasBaseSnapshot=!0,this.renderOverlay(),s()},r.onerror=()=>{i(new Error("[BugAnnotator] Failed to decode DVR frame dataUrl into Image."))},r.src=t})}hasFrozenFrame(){return this.hasBaseSnapshot}renderOverlay(){if(!this.overlayCanvas)return;const t=this.overlayCanvas.getContext("2d");if(t){t.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);for(const e of this.shapes)this.renderShape(t,e);this.draftShape&&this.renderShape(t,this.draftShape)}}renderShape(t,e){if(t.save(),e.type==="pen"){if(e.points.length>0){t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke()}}else if(e.type==="arrow"){const n=e.endX-e.startX,s=e.endY-e.startY;if(Math.hypot(n,s)>=2){const r=Math.atan2(s,n),o=Math.max(12,e.strokeWidth*4.5),d=Math.PI/6.5,u=e.endX-o*Math.cos(r-d),h=e.endY-o*Math.sin(r-d),l=e.endX-o*Math.cos(r+d),c=e.endY-o*Math.sin(r+d);t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.72)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(r),e.endY-o*.55*Math.sin(r)),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(r),e.endY-o*.55*Math.sin(r)),t.stroke(),t.beginPath(),t.moveTo(e.endX,e.endY),t.lineTo(u,h),t.lineTo(l,c),t.closePath(),t.fillStyle=e.color,t.strokeStyle="rgba(0, 0, 0, 0.75)",t.lineWidth=1.5,t.stroke(),t.fill()}}else if(e.type==="box"){const n=e.width>=0?e.x:e.x+e.width,s=e.height>=0?e.y:e.y+e.height,i=Math.abs(e.width),r=Math.abs(e.height);(i>=1||r>=1)&&(t.fillStyle=Lt(e.color,.14),t.fillRect(n,s,i,r),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2,t.strokeRect(n,s,i,r),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.strokeRect(n,s,i,r))}else if(e.type==="text"){const n='600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';t.font=n;const s=t.measureText(e.text),i=8,r=5,o=Math.ceil(s.width)+i*2,d=24,u=Math.max(4,Math.min(this.width-o-4,e.x)),h=Math.max(4,Math.min(this.height-d-4,e.y-d/2));t.fillStyle="rgba(9, 13, 22, 0.9)",t.strokeStyle=e.color,t.lineWidth=2,t.beginPath(),typeof t.roundRect=="function"?t.roundRect(u,h,o,d,6):t.rect(u,h,o,d),t.fill(),t.stroke(),t.fillStyle="#FFFFFF",t.textBaseline="middle",t.fillText(e.text,u+i,h+d/2+r*.05)}t.restore()}exportCompositeDataUrl(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");e.width=this.width,e.height=this.height;const n=e.getContext("2d");if(!n)throw new Error("[BugAnnotator] Failed to acquire 2D context for composite export.");this.baseCanvas?n.drawImage(this.baseCanvas,0,0,this.width,this.height):(n.fillStyle="#090D16",n.fillRect(0,0,this.width,this.height));for(const s of this.shapes)this.renderShape(n,s);return e.toDataURL("image/png")}exportSmartComposite(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");let n={x:0,y:0,width:this.width,height:this.height};if(this.baseCanvas&&typeof this.baseCanvas.getContext=="function"){const d=this.baseCanvas.getContext("2d");if(d&&typeof d.getImageData=="function"){const u=d.getImageData(0,0,this.width,this.height);n=H(u.data,this.width,this.height)}}const s=Bt(this.shapes,this.width,this.height),i=It(n,s,this.width,this.height);e.width=i.width,e.height=i.height;const r=e.getContext("2d");if(!r)throw new Error("[BugAnnotator] Failed to acquire 2D context for smart composite export.");typeof r.fillRect=="function"&&(i.x<n.x||i.y<n.y||i.x+i.width>n.x+n.width||i.y+i.height>n.y+n.height||!this.baseCanvas)&&(r.fillStyle="#090D16",r.fillRect(0,0,i.width,i.height)),this.baseCanvas&&(i.x===0&&i.y===0&&i.width===this.width&&i.height===this.height?r.drawImage(this.baseCanvas,0,0,this.width,this.height):r.drawImage(this.baseCanvas,i.x,i.y,i.width,i.height,0,0,i.width,i.height));const o=(i.x!==0||i.y!==0)&&typeof r.translate=="function";o&&(r.save(),r.translate(-i.x,-i.y));for(const d of this.shapes)this.renderShape(r,d);return o&&r.restore(),{dataUrl:e.toDataURL("image/png"),width:i.width,height:i.height,crop:i}}bindPointerEvents(t){const e=s=>{const i=t.getBoundingClientRect(),r=i.width>0?t.width/i.width:1,o=i.height>0?t.height/i.height:1;return{x:(s.clientX-i.left)*r,y:(s.clientY-i.top)*o}};t.addEventListener("pointerdown",s=>{if(s.button!==0)return;s.preventDefault();const i=e(s);if(this.activeTool==="text"){this.openInlineTextInput(i.x,i.y,s.clientX,s.clientY);return}this.commitOrCloseActiveTextInput(),this.isDrawing=!0;try{t.setPointerCapture(s.pointerId)}catch{}const r=this.nextShapeId();this.activeTool==="pen"?this.draftShape={id:r,type:"pen",color:this.activeColor,strokeWidth:this.strokeWidth,points:[i]}:this.activeTool==="arrow"?this.draftShape={id:r,type:"arrow",color:this.activeColor,strokeWidth:this.strokeWidth,startX:i.x,startY:i.y,endX:i.x,endY:i.y}:this.activeTool==="box"&&(this.draftShape={id:r,type:"box",color:this.activeColor,strokeWidth:this.strokeWidth,x:i.x,y:i.y,width:0,height:0}),this.renderOverlay()}),t.addEventListener("pointermove",s=>{if(!this.isDrawing||!this.draftShape)return;const i=e(s);this.draftShape.type==="pen"?this.draftShape.points.push(i):this.draftShape.type==="arrow"?(this.draftShape.endX=i.x,this.draftShape.endY=i.y):this.draftShape.type==="box"&&(this.draftShape.width=i.x-this.draftShape.x,this.draftShape.height=i.y-this.draftShape.y),this.renderOverlay()});const n=s=>{if(!this.isDrawing||!this.draftShape)return;this.isDrawing=!1;try{t.hasPointerCapture(s.pointerId)&&t.releasePointerCapture(s.pointerId)}catch{}const i=this.draftShape;if(this.draftShape=null,i.type==="pen"){let r=1/0,o=-1/0,d=1/0,u=-1/0;for(const h of i.points)h.x<r&&(r=h.x),h.x>o&&(o=h.x),h.y<d&&(d=h.y),h.y>u&&(u=h.y);if(Math.hypot(o-r,u-d)<3){this.renderOverlay();return}}else if(i.type==="arrow"){if(Math.hypot(i.endX-i.startX,i.endY-i.startY)<4){this.renderOverlay();return}}else if(i.type==="box"&&Math.abs(i.width)<3&&Math.abs(i.height)<3){this.renderOverlay();return}this.addShape(i)};t.addEventListener("pointerup",n),t.addEventListener("pointercancel",n)}openInlineTextInput(t,e,n,s){if(this.commitOrCloseActiveTextInput(),!this.overlayCanvas||!this.overlayCanvas.parentElement)return;const i=this.overlayCanvas.parentElement,r=i.getBoundingClientRect(),o=document.createElement("input");o.type="text",o.className="annotation-inline-text-input",o.placeholder="Type bug label & press Enter...",o.style.position="absolute",o.style.left=`${Math.max(8,Math.min(r.width-180,n-r.left))}px`,o.style.top=`${Math.max(8,Math.min(r.height-34,s-r.top-14))}px`,o.style.zIndex="50",o.style.background="rgba(9, 13, 22, 0.95)",o.style.color="#FFFFFF",o.style.border=`2px solid ${this.activeColor}`,o.style.borderRadius="6px",o.style.padding="4px 8px",o.style.fontSize="12px",o.style.fontWeight="600",o.style.outline="none",o.style.minWidth="160px",o.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.45)";let d=!1;const u=()=>{if(d)return;d=!0;const l=o.value.trim();o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null),l&&this.addTextAnnotation(t,e,l)},h=()=>{d||(d=!0,o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null))};o.addEventListener("keydown",l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),u()):l.key==="Escape"&&(l.preventDefault(),h())}),o.addEventListener("blur",()=>{u()}),this.activeTextInputEl=o,i.appendChild(o),requestAnimationFrame(()=>o.focus())}commitOrCloseActiveTextInput(){this.activeTextInputEl&&(this.activeTextInputEl.blur(),this.activeTextInputEl=null)}nextShapeId(){return`ann-${++this.shapeCounter}-${Date.now()}`}notifyHistoryChange(){this.onHistoryChange&&this.onHistoryChange()}}function Bt(a,t,e,n=12){if(!a||a.length===0||t<=0||e<=0)return null;let s=1/0,i=1/0,r=-1/0,o=-1/0;const d=(f,p,m,S,w)=>{const v=Math.min(f,m)-w,b=Math.max(f,m)+w,g=Math.min(p,S)-w,y=Math.max(p,S)+w;v<s&&(s=v),g<i&&(i=g),b>r&&(r=b),y>o&&(o=y)};for(const f of a)if(f.type==="pen"){const p=(f.strokeWidth||3)+4+n;for(const m of f.points)d(m.x,m.y,m.x,m.y,p)}else if(f.type==="arrow"){const p=Math.max(16,(f.strokeWidth||3)*4.5)+n;d(f.startX,f.startY,f.endX,f.endY,p)}else if(f.type==="box"){const p=(f.strokeWidth||3)+4+n;d(f.x,f.y,f.x+f.width,f.y+f.height,p)}else if(f.type==="text"){const p=Math.ceil((f.text||"").length*8.5)+16,m=24,S=Math.max(4,Math.min(t-p-4,f.x)),w=Math.max(4,Math.min(e-m-4,f.y-m/2));d(S,w,S+p,w+m,4+n)}if(!Number.isFinite(s)||!Number.isFinite(i))return null;const u=Math.max(0,Math.floor(s)),h=Math.max(0,Math.floor(i)),l=Math.min(t,Math.ceil(r)),c=Math.min(e,Math.ceil(o));return{x:u,y:h,width:Math.max(1,l-u),height:Math.max(1,c-h)}}function It(a,t,e,n){if(!t)return a;const s=Math.max(0,Math.min(a.x,t.x)),i=Math.max(0,Math.min(a.y,t.y)),r=Math.min(e,Math.max(a.x+a.width,t.x+t.width)),o=Math.min(n,Math.max(a.y+a.height,t.y+t.height));return{x:s,y:i,width:Math.max(1,r-s),height:Math.max(1,o-i)}}const K=200,J=15e3;class Ft{container;dvrBuffer;callbacks;iframe=null;currentRunnerId=0;activeMessageHandler=null;paused=!1;muted=!1;focused=!1;running=!1;consoleLogs=[];constructor(t,e,n={}){this.container=t,this.dvrBuffer=e,this.callbacks=n}isRunning(){return this.running}isPaused(){return this.paused}isMuted(){return this.muted}isFocused(){return this.focused}getConsoleLogs(){return[...this.consoleLogs]}clearConsoleLogs(){this.consoleLogs=[]}getGameCanvas(){try{const t=this.iframe?.contentWindow?.document;return t?this.iframe?.contentWindow?.__ACTIVE_GAME_CANVAS__||t.querySelector("canvas"):null}catch{return null}}async launchBuild(t){if(!t||typeof t!="string")throw new Error("[WasmRunner] launchBuild requires a non-empty buildId.");this.destroy(),this.dvrBuffer.clear(),this.clearConsoleLogs(),this.paused=!1,this.callbacks.onStateChange?.("loading"),await this.mountSidecarRunnerIframe({buildId:t})}postToChild(t){this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage({source:"playtest-runner-parent",runnerId:this.currentRunnerId,...t},"*")}mountSidecarRunnerIframe(t){return new Promise((e,n)=>{const s=++this.currentRunnerId;let i=!1;const r=window.setTimeout(()=>{i||(i=!0,this.callbacks.onStateChange?.("error"),n(new Error(`[WasmRunner] Timed out after ${J}ms waiting for sidecar runner iframe (/api/playtest/runner) to initialize.`)))},J),o=f=>{const p=f.data;if(!(!p||p.source!=="playtest-runner-child"||p.runnerId!==s))switch(p.type){case"READY":{this.running=!0,this.callbacks.onStateChange?.("running"),i||(i=!0,window.clearTimeout(r),e());break}case"FRAME":{if(typeof p.dataUrl=="string"&&typeof p.width=="number"&&typeof p.height=="number"&&p.width>0&&p.height>0)try{this.dvrBuffer.recordFrameDataUrl(p.dataUrl,p.width,p.height,p.timestampMs??performance.now()),this.callbacks.onFrameRecorded?.()}catch(m){console.error("[WasmRunner] Frame DVR capture error:",m)}break}case"LOG":{const m=p.level||"log";this.appendLog(m,p.text||"");break}case"PANIC":{const m=p.message||"Unknown Go WASM runtime error";this.appendLog("error",m),this.callbacks.onPanic?.(m,this.getConsoleLogs()),i||(i=!0,window.clearTimeout(r),n(new Error(m)));break}case"TOGGLE_PAUSE":{this.togglePause();break}case"FOCUS_CHANGE":{const m=!!p.focused;this.focused=m,this.callbacks.onFocusChange?.(m);break}}};this.activeMessageHandler=o,window.addEventListener("message",o);const d=V(),u=new URLSearchParams({runnerId:String(s),muted:this.muted?"1":"0",captureIntervalMs:String(this.dvrBuffer.captureIntervalMs),buildId:t.buildId}),h=new URLSearchParams(window.location.search).get("token");h&&u.set("token",h);const l=`${d}/api/playtest/runner?${u.toString()}`,c=document.createElement("iframe");c.className="wasm-runner-iframe",c.setAttribute("title","Ebitengine Playtest Viewport"),c.src=l,this.container.innerHTML="",this.container.appendChild(c),this.iframe=c})}syncDvrFromChild(){try{const t=this.iframe?.contentWindow;if(!t||typeof t.__PLAYTEST_GET_DVR_FRAMES__!="function")return;const e=t.__PLAYTEST_GET_DVR_FRAMES__();if(!Array.isArray(e)||e.length===0)return;this.dvrBuffer.clear();for(let n=0;n<e.length;n++){const s=e[n];s&&s.canvas&&s.width>0&&s.height>0&&this.dvrBuffer.recordCanvasSlot(s.canvas,s.width,s.height,s.timestampMs)}}catch{}}captureImmediateFrame(){this.running&&(this.postToChild({type:"CAPTURE_NOW"}),this.syncDvrFromChild())}setPaused(t){!this.running||this.paused===t||(this.paused=t,this.postToChild({type:"SET_PAUSED",paused:t}),t&&this.syncDvrFromChild(),this.callbacks.onPauseChange?.(t),this.callbacks.onStateChange?.(t?"paused":"running"))}togglePause(){return this.running?(this.setPaused(!this.paused),this.paused):!1}setMuted(t){this.muted=t,this.postToChild({type:"SET_MUTED",muted:t})}toggleMuted(){return this.setMuted(!this.muted),this.muted}focus(){try{this.iframe?.contentWindow?.focus()}catch{}this.postToChild({type:"FOCUS_GAME"})}dispatchVirtualKey(t,e,n){this.postToChild({type:"DISPATCH_KEY",code:t,key:e,keyEventType:n})}destroy(){this.activeMessageHandler&&(window.removeEventListener("message",this.activeMessageHandler),this.activeMessageHandler=null),this.running=!1,this.paused=!1,this.focused=!1,this.iframe&&(this.iframe.src="about:blank",this.iframe.remove(),this.iframe=null),this.container.innerHTML="",this.callbacks.onFocusChange?.(!1)}appendLog(t,e){const s=`[${new Date().toISOString().slice(11,23)}] [${t.toUpperCase()}] ${e}`;this.consoleLogs.push(s),this.consoleLogs.length>K&&this.consoleLogs.splice(0,this.consoleLogs.length-K),this.callbacks.onLog?.(t,s,this.getConsoleLogs())}}function T(a){return String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function _(a){return T(a).replace(/'/g,"&#39;")}function Mt(a,t,e){const n=[];t.workspaceDir&&n.push({label:"Workspace",path:t.workspaceDir}),t.downloadsDir&&n.push({label:"Downloads",path:t.downloadsDir}),t.desktopDir&&n.push({label:"Desktop",path:t.desktopDir}),t.sessionDir&&n.push({label:"Session",path:t.sessionDir}),a.innerHTML="";for(const s of n){const i=document.createElement("button");i.type="button",i.className="btn btn-sm btn-outline",i.style.cssText="height: 22px; padding: 0 7px; font-size: 11px;",i.textContent=s.label,i.title=s.path,i.addEventListener("click",()=>e(s.path)),a.appendChild(i)}}function Tt(a){const t=document.getElementById("studio-project-modal-overlay");t&&t.remove();const e=a.currentWorkspace||x()||"";let n=a.currentPkg||".";const s=document.createElement("div");s.id="studio-project-modal-overlay",s.className="modal-overlay";const i=document.createElement("div");i.className="modal-dialog",i.style.width="520px",i.style.maxWidth="95vw",i.innerHTML=`
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>🕹️</span>
        <span>Open Go / Ebitengine Project</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Project Directory</span>
          <div id="studio-proj-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <div style="display: flex; gap: 6px;">
          <input
            type="text"
            id="studio-proj-dir-input"
            class="input-text"
            style="flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
            value="${_(e)}"
            placeholder="/path/to/ebitengine-game"
            spellcheck="false"
          />
          <button type="button" id="studio-proj-up-btn" class="btn btn-sm btn-outline" title="Parent Directory">⬆ Up</button>
          <button type="button" id="studio-proj-go-btn" class="btn btn-sm btn-outline" title="Inspect Directory">Inspect</button>
        </div>
      </div>

      <div
        id="studio-proj-status"
        style="font-size: 11px; padding: 6px 8px; border-radius: 6px; background: var(--studio-surface-hover); border: 1px solid var(--studio-border); color: var(--studio-text-secondary);"
      >
        Checking Go module &amp; runnable packages...
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Subfolders</span>
        <div
          id="studio-proj-folders-list"
          style="display: flex; flex-direction: column; gap: 4px; min-height: 150px; max-height: 210px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 6px;"
        >
          <div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading folders...</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Runnable Go Package</span>
        <select id="studio-proj-pkg-select" class="input-text" style="height: 30px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
          <option value="${_(n)}">${T(n)}</option>
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
        <button type="button" id="studio-proj-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
        <button type="button" id="studio-proj-open-btn" class="btn btn-sm btn-primary">Open Project</button>
      </div>
    </div>
  `,s.appendChild(i),document.body.appendChild(s);let r=null;const o=()=>{window.removeEventListener("keydown",d),s.remove()},d=v=>{v.key==="Escape"&&(v.preventDefault(),o())};window.addEventListener("keydown",d),s.addEventListener("click",v=>{v.target===s&&o()}),i.querySelector(".modal-close-btn")?.addEventListener("click",o),i.querySelector("#studio-proj-cancel-btn")?.addEventListener("click",o);const u=i.querySelector("#studio-proj-dir-input"),h=i.querySelector("#studio-proj-status"),l=i.querySelector("#studio-proj-folders-list"),c=i.querySelector("#studio-proj-pkg-select"),f=i.querySelector("#studio-proj-dir-pills"),p=i.querySelector("#studio-proj-up-btn"),m=i.querySelector("#studio-proj-go-btn"),S=i.querySelector("#studio-proj-open-btn"),w=async v=>{l.innerHTML=`<div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Scanning ${T(v||"workspace")}...</div>`;try{const[b,g]=await Promise.all([nt(v,"project"),yt(v)]);u.value=b.dir,r=b.parentDir,p.disabled=!r;const y=g.packages.length>0?g.packages:["."];if(c.innerHTML=y.map(E=>`<option value="${_(E)}">${T(E)}</option>`).join(""),y.includes(n)||(n=g.pkg||y[0]||"."),c.value=n,g.hasGoMod?(h.style.borderColor="rgba(16, 185, 129, 0.45)",h.style.color="var(--studio-success)",h.textContent=`✓ Go project detected (${y.length} runnable package${y.length===1?"":"s"}: ${y.join(", ")})`):(h.style.borderColor="var(--studio-border)",h.style.color="var(--studio-text-muted)",h.textContent="No go.mod in this folder. Select a subfolder below or open anyway."),l.innerHTML="",b.directories.length===0){const E=document.createElement("div");E.style.cssText="font-size: 12px; color: var(--studio-text-muted); padding: 10px; text-align: center;",E.textContent="No subdirectories in this folder.",l.appendChild(E);return}for(const E of b.directories){const C=document.createElement("button");C.type="button",C.className="session-item-btn",C.style.cssText="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px;",C.innerHTML=`
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>📁</span>
            <span>${T(E.name)}</span>
          </span>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            ${E.hasGoMod?'<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.16); color: var(--studio-success); border: 1px solid rgba(16, 185, 129, 0.4);">go.mod</span>':""}
            <span style="font-size: 11px; color: var(--studio-text-muted);">Open ▸</span>
          </span>
        `,C.addEventListener("click",()=>{w(E.path)}),l.appendChild(C)}}catch(b){h.style.borderColor="var(--studio-danger)",h.style.color="var(--studio-danger)",h.textContent=b?.message||String(b),l.innerHTML=`<div style="font-size: 12px; color: var(--studio-danger); padding: 8px;">${T(b?.message||String(b))}</div>`}};p.addEventListener("click",()=>{r&&w(r)}),m.addEventListener("click",()=>{w(u.value.trim())}),u.addEventListener("keydown",v=>{v.key==="Enter"&&(v.preventDefault(),w(u.value.trim()))}),S.addEventListener("click",async()=>{const v=u.value.trim(),b=c.value.trim()||".";if(!v){k.error("Missing Project Directory","Enter or select a Go project directory.");return}S.disabled=!0;try{await a.onSelectProject(v,b),o()}catch(g){k.error("Failed to Open Project",g?.message||String(g))}finally{S.disabled=!1}}),(async()=>{try{const v=await bt(),b=e||v.workspaceDir||v.defaultDir;Mt(f,v,g=>{u.value=g,w(g)}),await w(b)}catch{await w(e)}})()}class k{static container=null;static getContainer(){return this.container||(this.container=document.createElement("div"),this.container.className="notification-container",document.body.appendChild(this.container)),this.container}static show(t,e="info",n=4e3,s){const i=this.getContainer(),r=document.createElement("div");r.className=`notification-toast toast-${e}`;const o=document.createElement("span");o.className="toast-icon",o.textContent=e==="success"?"✓":e==="error"?"⚠️":"ℹ";const d=document.createElement("div");d.className="toast-message";const u=document.createElement("div");if(u.className="toast-title",u.textContent=t,d.appendChild(u),s){const l=document.createElement("pre");l.className="toast-detail",l.textContent=s,d.appendChild(l)}if(e==="error"){const l=document.createElement("div");l.className="toast-actions";const c=document.createElement("button");c.type="button",c.className="toast-send-agent-btn",c.textContent="💬 Send to Agent",c.title="Send this error directly to the active Antigravity agent for diagnosis",c.addEventListener("click",async()=>{c.disabled=!0,c.textContent="Sending...";try{await Y({errorTitle:t,errorDetail:s||t}),c.textContent="✓ Sent to Agent",c.classList.add("sent")}catch(f){c.disabled=!1,c.textContent="💬 Retry Send to Agent",console.error("[StudioNotifier] Failed to send error to agent:",f)}}),l.appendChild(c),d.appendChild(l)}const h=document.createElement("button");h.className="toast-close",h.textContent="✕",h.title="Dismiss",h.onclick=()=>r.remove(),r.appendChild(o),r.appendChild(d),r.appendChild(h),i.appendChild(r),n>0&&setTimeout(()=>{r.classList.add("toast-fade-out"),setTimeout(()=>r.remove(),280)},n)}static info(t,e=3e3){this.show(t,"info",e)}static success(t,e=3800){this.show(t,"success",e)}static error(t,e){console.error("[Game Dev Studio Error]",t,e||""),this.show(t,"error",0,e)}static fatal(t,e,n){console.error("[Game Dev Studio FATAL]",t,e,n??"");const s=document.getElementById("fatal-error-overlay");s&&s.remove();const i=document.createElement("div");i.id="fatal-error-overlay",i.className="modal-overlay fatal-overlay",i.setAttribute("role","alertdialog"),i.setAttribute("aria-modal","true");const r=e instanceof Error?`${e.name}: ${e.message}`:String(e),o=e instanceof Error&&e.stack?e.stack:"",d=[n?`[Context] ${n}`:"",r,o&&o!==r?o:""].filter(Boolean).join(`

`);i.innerHTML=`
      <div class="fatal-dialog">
        <div class="fatal-icon">🚨</div>
        <h2 class="fatal-title"></h2>
        <p class="fatal-desc">A critical error occurred in Game Dev Studio. Failed fast with full diagnostics:</p>
        <pre class="fatal-pre"></pre>
        <div class="fatal-actions">
          <button type="button" class="btn btn-send-chat" id="fatal-send-agent-btn">💬 Send to Agent</button>
          <button type="button" class="btn btn-danger" id="fatal-reload-btn">Reload Studio</button>
          <button type="button" class="btn btn-outline" id="fatal-dismiss-btn">Dismiss (Esc)</button>
        </div>
      </div>
    `;const u=i.querySelector(".fatal-title");u&&(u.textContent=t);const h=i.querySelector(".fatal-pre");h&&(h.textContent=d);const l=()=>{window.removeEventListener("keydown",c),i.remove()},c=p=>{p.key==="Escape"&&(p.preventDefault(),l())};window.addEventListener("keydown",c);const f=i.querySelector("#fatal-send-agent-btn");f?.addEventListener("click",async()=>{if(f){f.disabled=!0,f.textContent="Sending...";try{await Y({errorTitle:t,errorDetail:d}),f.textContent="✓ Sent to Agent"}catch(p){f.disabled=!1,f.textContent="💬 Retry Send to Agent",console.error("[StudioNotifier] Failed to send fatal error to agent:",p)}}}),i.querySelector("#fatal-reload-btn")?.addEventListener("click",()=>{window.location.reload()}),i.querySelector("#fatal-dismiss-btn")?.addEventListener("click",l),document.body.appendChild(i)}}class Dt{headerEl;annotationBarEl;viewportEl;bugBarEl;dvrBuffer;annotator;runner;activePkg=".";activeDvrIndex=0;keypadVisible=!1;logsDrawerVisible=!1;isBuilding=!1;lastBuildFailure=null;runnerMountEl;annotationStageEl;readyStateEl;errorStateEl;gameStageEl;focusPillEl;keypadOverlayEl;logsDrawerEl;constructor(t){this.headerEl=t.headerEl,this.annotationBarEl=t.annotationBarEl,this.viewportEl=t.viewportEl,this.bugBarEl=t.bugBarEl,this.dvrBuffer=new vt(250,40),this.renderHeader(),this.renderAnnotationBar(),this.renderViewport(),this.renderBugReportBar();const e=this.viewportEl.querySelector("#annotation-base-canvas"),n=this.viewportEl.querySelector("#annotation-overlay-canvas");this.annotator=new At({baseCanvas:e,overlayCanvas:n,width:640,height:360,onHistoryChange:()=>this.updateAnnotationControlsUI()}),this.runner=new Ft(this.runnerMountEl,this.dvrBuffer,{onFrameRecorded:()=>{if(this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.runner.isPaused()&&this.annotator.getShapes().length===0){const s=this.dvrBuffer.getLatestFrame();s&&this.annotator.loadBaseFrameDataUrl(s.dataUrl,s.width,s.height)}},onPauseChange:s=>{this.handlePauseStateChanged(s)},onFocusChange:s=>{this.updateFocusPillUI(s)},onLog:(s,i,r)=>{this.updateLogsUI(r)},onPanic:(s,i)=>{this.updateLogsUI(i),this.showRuntimePanicView(s)}}),this.bindEvents(),this.syncSessionAndWorkspaceFromServer()}async applyWorkspaceUri(t){if(!t||!t.trim())return!1;try{const e=await W(t);return e.workspace&&B(e.workspace),this.activePkg=".",this.updateHeaderInputsUI(),!!e.hasGoMod}catch(e){return console.warn("[PlaytestStudioUI] Failed to resolve workspace URI:",e),!1}}async syncSessionAndWorkspaceFromServer(){await ht(),this.updateHeaderInputsUI(),this.updateSessionBadgeUI()}formatProjectBadgeLabel(t,e){const n=(t||"").trim().replace(/\/+$/,"");if(!n)return"No project selected";const s=n.split("/").filter(Boolean),i=s[s.length-1]||n,r=(e||".").trim()||".";return`${i} (${r})`}openProjectPicker(){Tt({currentWorkspace:x(),currentPkg:this.activePkg,onSelectProject:(t,e)=>{B(t),this.activePkg=(e||".").trim()||".",this.updateHeaderInputsUI(),k.info(`Selected project: ${this.formatProjectBadgeLabel(t,this.activePkg)}`,2400)}})}renderHeader(){const t=x(),e=this.formatProjectBadgeLabel(t,this.activePkg),n=t?`${t} (${this.activePkg||"."}) — Click to switch project`:"Click to open a Go game project";this.headerEl.innerHTML=`
      <div class="header-left">
        <button
          type="button"
          id="btn-home-ready"
          class="app-brand brand-home-btn"
          data-tooltip="Return to Ready Card / Stop Game"
          title="Return to Ready Card / Stop Game"
          aria-label="Return to Ready Card"
        >
          <span class="brand-logo" aria-hidden="true">🕹️</span>
        </button>

        <div class="workspace-controls">
          <input
            type="hidden"
            id="workspace-input"
            value="${this.escapeAttr(t)}"
          />
          <button
            type="button"
            id="btn-open-project"
            class="btn btn-sm btn-outline btn-header-action"
            data-tooltip="Open Go Game Project &amp; Package"
            title="Open Go Game Project &amp; Package"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span class="btn-label">Open Project</span>
          </button>
          <button
            type="button"
            id="playtest-project-label"
            class="btn btn-sm btn-ghost"
            style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; border: 1px solid var(--studio-border);"
            title="${this.escapeAttr(n)}"
            aria-label="Active Go project and package"
          >
            ${this.escapeHtml(e)}
          </button>
          <button
            type="button"
            id="btn-build-run"
            class="btn btn-primary btn-sm"
            data-tooltip="Compile Go to WASM &amp; Launch (GOOS=js GOARCH=wasm)"
            title="Compile Go to WASM &amp; Launch (GOOS=js GOARCH=wasm)"
          >
            <span id="build-btn-label">🚀 Run</span>
          </button>
        </div>
      </div>

      <div class="header-right">
        <button
          type="button"
          id="btn-pause-toggle"
          class="btn btn-outline btn-sm"
          disabled
          data-tooltip="Freeze Frame &amp; Annotate Bug (\` or F8)"
          title="Freeze Frame &amp; Annotate Bug (\` or F8)"
        >
          <span id="pause-btn-label">⏸️ Pause</span>
        </button>

        <button
          type="button"
          id="btn-keypad-toggle"
          class="btn btn-ghost btn-icon"
          data-tooltip="Virtual Gamepad (WASD / Arrows / Space)"
          title="Toggle On-Screen Virtual Gamepad (WASD / Arrows / Space)"
          aria-label="Toggle On-Screen Virtual Gamepad"
        >
          <span>🎮</span>
        </button>

        <button
          type="button"
          id="btn-mute-toggle"
          class="btn btn-ghost btn-icon"
          data-tooltip="Mute / Unmute Game Audio"
          title="Mute / Unmute Game Audio"
          aria-label="Mute or Unmute Game Audio"
        >
          <span id="mute-btn-label">🔊</span>
        </button>

        <button
          type="button"
          id="btn-logs-toggle"
          class="btn btn-ghost btn-icon-badge"
          data-tooltip="WASM Console &amp; Stderr Logs"
          title="Toggle WASM Console &amp; Stderr Logs"
          aria-label="Toggle WASM Console and Stderr Logs"
        >
          <span>📟</span>
          <span id="logs-count-badge" class="badge-pill">0</span>
        </button>

        <button
          type="button"
          id="btn-session-badge"
          class="session-badge disconnected"
          data-tooltip="Active Antigravity Session (Click to switch)"
          title="Active Antigravity Session (Click to switch)"
          aria-label="Switch Antigravity Session"
        >
          <span class="status-dot offline"></span>
          <span>🔗</span>
          <span id="session-badge-text" class="sr-only">Standalone</span>
        </button>

        <a
          id="btn-full-studio"
          href="${this.escapeAttr(N())}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-ghost btn-icon preview-only-btn"
          data-tooltip="Open Game Dev Studio in Browser Tab"
          title="Open Game Dev Studio in Browser Tab"
          aria-label="Open Game Dev Studio in Browser Tab"
        >
          <span>↗️</span>
        </a>
      </div>
    `,this.updateSessionBadgeUI()}renderAnnotationBar(){const t=it.map((e,n)=>`
        <button
          type="button"
          class="qa-color-swatch ${n===0?"active":""}"
          data-color="${e.hex}"
          style="background-color: ${e.hex};"
          data-tooltip="Color: ${e.name} (${e.hex})"
          title="Annotation Color: ${e.name} (${e.hex})"
          aria-label="Annotation color ${e.name}"
        ></button>
      `).join("");this.annotationBarEl.innerHTML=`
      <div class="annotation-tools-group" role="toolbar" aria-label="Bug Annotation Tools">
        <button
          type="button"
          class="ann-tool-btn btn-icon"
          data-tool="pen"
          data-tooltip="Freehand Pen (P)"
          title="Freehand Pen (P)"
          aria-label="Freehand Pen Tool (P)"
        >
          <span>✏️</span>
        </button>
        <button
          type="button"
          class="ann-tool-btn btn-icon"
          data-tool="arrow"
          data-tooltip="Pointing Arrow Callout (A)"
          title="Pointing Arrow Callout (A)"
          aria-label="Pointing Arrow Tool (A)"
        >
          <span>🏹</span>
        </button>
        <button
          type="button"
          class="ann-tool-btn btn-icon active"
          data-tool="box"
          data-tooltip="Bounding Box Callout (B)"
          title="Bounding Box Callout (B)"
          aria-label="Bounding Box Tool (B)"
        >
          <span>🔲</span>
        </button>
        <button
          type="button"
          class="ann-tool-btn btn-icon"
          data-tool="text"
          data-tooltip="Text Label Callout (T)"
          title="Text Label Callout (T)"
          aria-label="Text Label Tool (T)"
        >
          <span>🏷️</span>
        </button>

        <div class="bar-divider"></div>

        <div class="qa-swatch-group" role="group" aria-label="QA Colors">
          ${t}
        </div>

        <div class="bar-divider"></div>

        <div class="ann-history-group">
          <button
            type="button"
            id="btn-ann-undo"
            class="btn btn-ghost btn-icon"
            disabled
            data-tooltip="Undo Annotation (⌘Z)"
            title="Undo Annotation (⌘Z)"
            aria-label="Undo Annotation"
          >↩️</button>
          <button
            type="button"
            id="btn-ann-redo"
            class="btn btn-ghost btn-icon"
            disabled
            data-tooltip="Redo Annotation (⇧⌘Z)"
            title="Redo Annotation (⇧⌘Z)"
            aria-label="Redo Annotation"
          >↪️</button>
          <button
            type="button"
            id="btn-ann-clear"
            class="btn btn-ghost btn-icon"
            disabled
            data-tooltip="Clear All Annotations"
            title="Clear All Annotations"
            aria-label="Clear All Annotations"
          >🧹</button>
        </div>
      </div>

      <div class="dvr-scrubber-group" role="region" aria-label="10-Second DVR Frame Scrubber">
        <button
          type="button"
          id="btn-dvr-prev"
          class="btn btn-outline btn-icon"
          data-tooltip="Step Back 1 Frame (←)"
          title="Step Back 1 Frame (←)"
          aria-label="Step Back 1 Frame"
        >⏮️</button>
        <input
          type="range"
          id="dvr-scrubber-slider"
          class="dvr-slider"
          min="0"
          max="0"
          step="1"
          value="0"
          title="Scrub 10-Second Gameplay DVR Buffer (250 frames @ 25fps)"
          aria-label="Scrub recorded gameplay frames"
        />
        <button
          type="button"
          id="btn-dvr-next"
          class="btn btn-outline btn-icon"
          data-tooltip="Step Forward 1 Frame (→)"
          title="Step Forward 1 Frame (→)"
          aria-label="Step Forward 1 Frame"
        >⏭️</button>
        <span
          id="dvr-frame-badge"
          class="dvr-frame-badge"
          data-tooltip="Live (0.0s)"
          title="Live (0.0s)"
        >0.0s</span>
      </div>
    `}renderViewport(){const t=x();this.viewportEl.innerHTML=`
      <!-- 1. Ready State (before first WASM build) -->
      <div id="viewport-ready-state" class="viewport-state-panel">
        <div class="ready-card">
          <div class="ready-icon-badge">🎮</div>
          <h2 class="ready-title">Ebitengine Live Playtest &amp; Visual QA</h2>
          <p class="ready-subtitle">
            Compile your Go game to WebAssembly (<code>GOOS=js GOARCH=wasm</code>), play inline at 60 FPS,
            pause with <kbd>F8</kbd> or <kbd>\`</kbd> to scrub the 10-second DVR ring buffer, circle visual bugs, and send directly to Antigravity chat.
          </p>

          <div class="ready-form-row">
            <div class="ready-field">
              <label for="ready-workspace-input">Go Project or Package Directory</label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <input
                  type="text"
                  id="ready-workspace-input"
                  class="input-text"
                  style="flex: 1;"
                  placeholder="/path/to/ebitengine-game or /path/to/repo/cmd/game"
                  value="${this.escapeAttr(t)}"
                />
                <button
                  type="button"
                  id="btn-ready-open-project"
                  class="btn btn-outline btn-sm"
                  title="Browse Go Project &amp; Package"
                >
                  📂 Open Project
                </button>
              </div>
            </div>
          </div>

          <div class="ready-actions">
            <button type="button" id="btn-ready-build" class="btn btn-primary btn-lg">
              <span>▶ Compile &amp; Launch Ebitengine WASM</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Build Error / Runtime Panic State (HTTP 422 fail-fast view) -->
      <div id="viewport-error-state" class="viewport-state-panel hidden">
        <div class="error-card">
          <div class="error-card-header">
            <div class="error-title-wrap">
              <span class="error-badge-icon">🚨</span>
              <div>
                <h3 id="error-state-title" class="error-card-title">Go WASM Compilation Failed</h3>
                <div id="error-state-meta" class="error-card-meta"></div>
              </div>
            </div>
            <div class="error-card-actions">
              <button type="button" id="btn-retry-build" class="btn btn-outline btn-sm">🔄 Retry Build</button>
              <button type="button" id="btn-send-build-error" class="btn btn-danger btn-sm">
                <span>🚨 Send Build Error to Chat</span>
              </button>
            </div>
          </div>
          <pre id="error-state-traceback" class="error-traceback-pre"></pre>
        </div>
      </div>

      <!-- 3. Active Game + Frozen DVR Annotation Stage -->
      <div id="viewport-game-stage" class="viewport-game-stage hidden">
        <div id="wasm-runner-mount" class="wasm-runner-mount"></div>

        <div id="annotation-stage" class="annotation-stage hidden">
          <div class="annotation-canvas-wrapper">
            <canvas id="annotation-base-canvas" class="annotation-base-canvas"></canvas>
            <canvas id="annotation-overlay-canvas" class="annotation-overlay-canvas"></canvas>
          </div>
        </div>

        <!-- Focus & Controls Status Pill -->
        <button type="button" id="focus-status-pill" class="focus-status-pill unfocused">
          <span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>
        </button>

        <!-- Collapsible On-Screen Virtual Gamepad Overlay -->
        <div id="virtual-keypad-overlay" class="virtual-keypad-overlay hidden" aria-label="On-Screen Virtual Gamepad">
          <div class="keypad-dpad">
            <button type="button" class="keypad-btn dpad-up" data-code="ArrowUp" data-key="ArrowUp">▲</button>
            <div class="dpad-mid-row">
              <button type="button" class="keypad-btn dpad-left" data-code="ArrowLeft" data-key="ArrowLeft">◀</button>
              <button type="button" class="keypad-btn dpad-down" data-code="ArrowDown" data-key="ArrowDown">▼</button>
              <button type="button" class="keypad-btn dpad-right" data-code="ArrowRight" data-key="ArrowRight">▶</button>
            </div>
          </div>
          <div class="keypad-actions">
            <button type="button" class="keypad-btn action-btn" data-code="KeyZ" data-key="z">Z</button>
            <button type="button" class="keypad-btn action-btn" data-code="KeyX" data-key="x">X</button>
            <button type="button" class="keypad-btn action-btn action-space" data-code="Space" data-key=" ">SPACE</button>
          </div>
        </div>

        <!-- Collapsible WASM Console & Stderr Drawer -->
        <div id="logs-drawer" class="logs-drawer hidden">
          <div class="logs-drawer-header">
            <span>WASM Console &amp; Runtime Logs (Last 200 lines)</span>
            <div class="logs-drawer-actions">
              <button type="button" id="btn-clear-logs" class="btn btn-ghost btn-sm">Clear</button>
              <button type="button" id="btn-close-logs" class="btn btn-ghost btn-sm">✕</button>
            </div>
          </div>
          <pre id="logs-drawer-content" class="logs-drawer-pre">No WASM console output recorded yet.</pre>
        </div>
      </div>
    `,this.readyStateEl=this.viewportEl.querySelector("#viewport-ready-state"),this.errorStateEl=this.viewportEl.querySelector("#viewport-error-state"),this.gameStageEl=this.viewportEl.querySelector("#viewport-game-stage"),this.runnerMountEl=this.viewportEl.querySelector("#wasm-runner-mount"),this.annotationStageEl=this.viewportEl.querySelector("#annotation-stage"),this.focusPillEl=this.viewportEl.querySelector("#focus-status-pill"),this.keypadOverlayEl=this.viewportEl.querySelector("#virtual-keypad-overlay"),this.logsDrawerEl=this.viewportEl.querySelector("#logs-drawer")}renderBugReportBar(){this.bugBarEl.innerHTML=`
      <input
        type="text"
        id="bug-note-input"
        class="input-text bug-note-input"
        placeholder="Describe the visual bug or instruction for Antigravity..."
        aria-label="Bug description or instruction for Antigravity"
      />
      <input type="checkbox" id="include-logs-checkbox" checked class="hidden" aria-hidden="true" />
      <button
        type="button"
        id="btn-toggle-attach-logs"
        class="btn btn-ghost btn-icon btn-toggle active"
        data-tooltip-pos="top"
        data-tooltip="Attach WASM Console Logs (ON)"
        title="Attach Captured WASM Console / Stderr Logs (ON: Click to toggle)"
        aria-label="Toggle attaching WASM console logs"
        aria-pressed="true"
      >
        <span>📋</span>
      </button>
      <button
        type="button"
        id="btn-send-bug-chat"
        class="btn btn-send-chat btn-sm"
        data-tooltip-pos="top"
        data-tooltip="Send Annotated Frame (.png) to Chat (Enter)"
        title="Send Annotated Frame Screenshot (.png) to Chat (Enter)"
      >
        <span>📸 Frame</span>
      </button>
      <button
        type="button"
        id="btn-send-gif-chat"
        class="btn btn-send-gif btn-sm"
        data-tooltip-pos="top"
        data-tooltip="Send 10-Second DVR Replay (.gif @ 25fps) to Chat"
        title="Send 10-Second DVR Replay as Animated GIF (.gif @ 25fps) to Chat"
      >
        <span>🎞️ 10s GIF</span>
      </button>
    `}bindEvents(){const t=this.headerEl.querySelector("#workspace-input"),e=this.viewportEl.querySelector("#ready-workspace-input"),n=l=>{B(l),t&&t.value!==l&&(t.value=l),e&&e.value!==l&&(e.value=l),this.updateHeaderInputsUI()};t?.addEventListener("change",()=>n(t.value)),e?.addEventListener("input",()=>n(e.value)),e?.addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),n(e.value),this.handleBuildAndRun())}),this.headerEl.querySelector("#btn-open-project")?.addEventListener("click",()=>{this.openProjectPicker()}),this.headerEl.querySelector("#playtest-project-label")?.addEventListener("click",()=>{this.openProjectPicker()}),this.viewportEl.querySelector("#btn-ready-open-project")?.addEventListener("click",()=>{this.openProjectPicker()}),dt(()=>this.updateHeaderInputsUI()),rt(()=>this.updateSessionBadgeUI()),this.headerEl.querySelector("#btn-build-run")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-ready-build")?.addEventListener("click",()=>{e&&n(e.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-retry-build")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-send-build-error")?.addEventListener("click",()=>{this.handleSendBuildErrorToChat()}),this.headerEl.querySelector("#btn-pause-toggle")?.addEventListener("click",()=>{this.runner.togglePause()}),this.headerEl.querySelector("#btn-home-ready")?.addEventListener("click",()=>{this.showReadyStateView()}),this.headerEl.querySelector("#btn-keypad-toggle")?.addEventListener("click",()=>{this.keypadVisible=!this.keypadVisible,this.keypadOverlayEl.classList.toggle("hidden",!this.keypadVisible),this.headerEl.querySelector("#btn-keypad-toggle")?.classList.toggle("active",this.keypadVisible)}),this.headerEl.querySelector("#btn-mute-toggle")?.addEventListener("click",()=>{const l=this.runner.toggleMuted(),c=this.headerEl.querySelector("#mute-btn-label"),f=this.headerEl.querySelector("#btn-mute-toggle");if(c&&(c.textContent=l?"🔇":"🔊"),f){const p=l?"Unmute Game Audio (Muted)":"Mute Game Audio";f.setAttribute("data-tooltip",p),f.setAttribute("title",p)}}),this.headerEl.querySelector("#btn-logs-toggle")?.addEventListener("click",()=>{this.logsDrawerVisible=!this.logsDrawerVisible,this.logsDrawerEl.classList.toggle("hidden",!this.logsDrawerVisible),this.headerEl.querySelector("#btn-logs-toggle")?.classList.toggle("active",this.logsDrawerVisible)}),this.viewportEl.querySelector("#btn-close-logs")?.addEventListener("click",()=>{this.logsDrawerVisible=!1,this.logsDrawerEl.classList.add("hidden"),this.headerEl.querySelector("#btn-logs-toggle")?.classList.remove("active")}),this.viewportEl.querySelector("#btn-clear-logs")?.addEventListener("click",()=>{this.runner.clearConsoleLogs(),this.updateLogsUI([])}),this.headerEl.querySelector("#btn-session-badge")?.addEventListener("click",()=>{this.openSessionSwitcherModal()}),this.focusPillEl.addEventListener("click",()=>{this.runner.isPaused()||this.runner.focus()}),this.keypadOverlayEl.querySelectorAll(".keypad-btn").forEach(l=>{const c=l,f=c.dataset.code||"Space",p=c.dataset.key||" ",m=w=>{w.preventDefault(),c.classList.add("pressed"),this.runner.dispatchVirtualKey(f,p,"keydown")},S=w=>{w.preventDefault(),c.classList.contains("pressed")&&(c.classList.remove("pressed"),this.runner.dispatchVirtualKey(f,p,"keyup"))};c.addEventListener("pointerdown",m),c.addEventListener("pointerup",S),c.addEventListener("pointerleave",S),c.addEventListener("pointercancel",S)}),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(l=>{l.addEventListener("click",()=>{const c=l.dataset.tool;c&&this.selectAnnotationTool(c)})});const r=this.annotationBarEl.querySelectorAll(".qa-color-swatch");r.forEach(l=>{l.addEventListener("click",()=>{const c=l.dataset.color;c&&(this.annotator.setColor(c),r.forEach(f=>f.classList.remove("active")),l.classList.add("active"))})}),this.annotationBarEl.querySelector("#btn-ann-undo")?.addEventListener("click",()=>{this.annotator.undo()}),this.annotationBarEl.querySelector("#btn-ann-redo")?.addEventListener("click",()=>{this.annotator.redo()}),this.annotationBarEl.querySelector("#btn-ann-clear")?.addEventListener("click",()=>{this.annotator.clearAnnotations()});const o=this.annotationBarEl.querySelector("#dvr-scrubber-slider");o.addEventListener("input",()=>{const l=Number.parseInt(o.value,10);this.scrubToDvrFrame(l)}),this.annotationBarEl.querySelector("#btn-dvr-prev")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.max(0,this.activeDvrIndex-1);this.scrubToDvrFrame(l)}}),this.annotationBarEl.querySelector("#btn-dvr-next")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1);this.scrubToDvrFrame(l)}});const d=this.bugBarEl.querySelector("#btn-toggle-attach-logs"),u=this.bugBarEl.querySelector("#include-logs-checkbox");d?.addEventListener("click",()=>{const l=u?!u.checked:!1;u&&(u.checked=l),d.classList.toggle("active",l),d.setAttribute("aria-pressed",String(l));const c=l?"Attach WASM Console Logs (ON)":"Attach WASM Console Logs (OFF)";d.setAttribute("data-tooltip",c),d.setAttribute("title",c)}),this.bugBarEl.querySelector("#bug-note-input").addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),this.handleSendBugToChat())}),this.bugBarEl.querySelector("#btn-send-bug-chat")?.addEventListener("click",()=>{this.handleSendBugToChat()}),this.bugBarEl.querySelector("#btn-send-gif-chat")?.addEventListener("click",()=>{this.handleSendGifToChat()}),window.addEventListener("keydown",l=>{if(this.headerEl.classList.contains("studio-view-hidden"))return;const c=l.target,f=c&&(c.tagName==="INPUT"||c.tagName==="TEXTAREA"||c.isContentEditable);if(l.code==="F8"||!f&&l.code==="Backquote"){this.runner.isRunning()&&(l.preventDefault(),l.stopPropagation(),this.runner.togglePause());return}if(!(f||!this.runner.isPaused())){if((l.metaKey||l.ctrlKey)&&l.key.toLowerCase()==="z"){l.preventDefault(),l.shiftKey?this.annotator.redo():this.annotator.undo();return}l.code==="KeyP"?(l.preventDefault(),this.selectAnnotationTool("pen")):l.code==="KeyA"?(l.preventDefault(),this.selectAnnotationTool("arrow")):l.code==="KeyB"?(l.preventDefault(),this.selectAnnotationTool("box")):l.code==="KeyT"?(l.preventDefault(),this.selectAnnotationTool("text")):l.code==="ArrowLeft"?(l.preventDefault(),this.scrubToDvrFrame(Math.max(0,this.activeDvrIndex-1))):l.code==="ArrowRight"&&(l.preventDefault(),this.scrubToDvrFrame(Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1)))}},{capture:!0})}async handleBuildAndRun(){if(this.isBuilding)return;const t=x().trim();if(!t){k.error("Missing Go Workspace Path",'Click "Open Project" in the header bar to select your Ebitengine Go project before building.'),this.openProjectPicker();return}this.isBuilding=!0,this.lastBuildFailure=null,this.setBuildButtonsLoading(!0);try{k.info(`Compiling Go WASM in "${t}" (${this.activePkg||"."})...`,2500);const e=await ft({workspace:t,pkg:this.activePkg});if(!e.ok){this.lastBuildFailure=e,this.showBuildErrorView(e),k.error("Go WASM Compilation Failed (HTTP 422)",e.compilerOutput.slice(0,240));return}this.activePkg=e.pkg||".",this.updateHeaderInputsUI(),this.showActiveGameStage(),await this.runner.launchBuild(e.buildId);const n=this.headerEl.querySelector("#btn-pause-toggle");n&&(n.disabled=!1);const s=(e.wasmBytes/(1024*1024)).toFixed(2);k.success(`Built & launched ${e.pkg} (${s} MB WASM in ${e.durationMs}ms)`),this.runner.focus()}catch(e){k.error("WASM Build / Launch Error",e?.message||String(e))}finally{this.isBuilding=!1,this.setBuildButtonsLoading(!1)}}handlePauseStateChanged(t){const e=this.headerEl.querySelector("#btn-pause-toggle"),n=this.headerEl.querySelector("#pause-btn-label");if(t){e&&(e.classList.add("btn-warning-active"),e.setAttribute("data-tooltip","Resume Gameplay (` or F8)"),e.setAttribute("title","Resume Gameplay (` or F8)")),n&&(n.textContent="▶️ Resume"),this.annotationBarEl.classList.remove("hidden"),this.annotationStageEl.classList.remove("hidden");const s=this.runner.getGameCanvas();if(s&&s.width>0&&s.height>0)this.annotator.loadBaseFromCanvas(s);else{const i=this.dvrBuffer.getLatestFrame();i&&this.annotator.loadBaseFrameDataUrl(i.dataUrl,i.width,i.height)}this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.updateFocusPillUI(!1)}else e&&(e.classList.remove("btn-warning-active"),e.setAttribute("data-tooltip","Freeze Frame & Annotate Bug (` or F8)"),e.setAttribute("title","Freeze Frame & Annotate Bug (` or F8)")),n&&(n.textContent="⏸️ Pause"),this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.runner.focus()}async scrubToDvrFrame(t){const e=this.dvrBuffer.getFrameAt(t);e&&(this.activeDvrIndex=e.index,this.updateDvrScrubberUI(),e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}updateDvrScrubberUI(){const t=this.annotationBarEl.querySelector("#dvr-scrubber-slider"),e=this.annotationBarEl.querySelector("#dvr-frame-badge"),n=this.annotationBarEl.querySelector("#btn-dvr-prev"),s=this.annotationBarEl.querySelector("#btn-dvr-next"),i=this.dvrBuffer.length;if(i===0){t&&(t.min="0",t.max="0",t.value="0",t.disabled=!0),e&&(e.textContent="0.0s",e.setAttribute("data-tooltip","Live (0.0s)"),e.setAttribute("title","Live (0.0s)")),n&&(n.disabled=!0),s&&(s.disabled=!0);return}const r=Math.max(0,Math.min(i-1,this.activeDvrIndex)),o=this.dvrBuffer.getFrameAt(r);if(t&&(t.disabled=!1,t.min="0",t.max=String(i-1),t.value=String(r)),n&&(n.disabled=r<=0),s&&(s.disabled=r>=i-1),e&&o){const d=o.relativeSec===0?"0.0s":`${o.relativeSec.toFixed(1)}s`,u=o.relativeSec===0?`Live (0.0s) · Frame ${r+1}/${i}`:`${o.relativeSec.toFixed(2)}s · Frame ${r+1}/${i}`;e.textContent=d,e.setAttribute("data-tooltip",u),e.setAttribute("title",u)}}selectAnnotationTool(t){this.annotator.setTool(t),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(n=>{const s=n.dataset.tool;n.classList.toggle("active",s===t)})}updateAnnotationControlsUI(){const t=this.annotationBarEl.querySelector("#btn-ann-undo"),e=this.annotationBarEl.querySelector("#btn-ann-redo"),n=this.annotationBarEl.querySelector("#btn-ann-clear");t&&(t.disabled=!this.annotator.canUndo()),e&&(e.disabled=!this.annotator.canRedo()),n&&(n.disabled=this.annotator.getShapes().length===0)}updateFocusPillUI(t){if(this.focusPillEl){if(this.runner.isPaused()){this.focusPillEl.className="focus-status-pill paused",this.focusPillEl.innerHTML="<span>⏸ Paused: Draw on Frame or Scrub 10s DVR</span>";return}t?(this.focusPillEl.className="focus-status-pill focused",this.focusPillEl.innerHTML="<span>● Controls Active (` or F8 to Pause)</span>"):(this.focusPillEl.className="focus-status-pill unfocused",this.focusPillEl.innerHTML="<span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>")}}updateLogsUI(t){const e=this.headerEl.querySelector("#logs-count-badge");e&&(e.textContent=String(t.length));const n=this.viewportEl.querySelector("#logs-drawer-content");n&&(n.textContent=t.length>0?t.join(`
`):"No WASM console output recorded yet.",n.scrollTop=n.scrollHeight)}showReadyStateView(){this.runner.destroy(),this.lastBuildFailure=null,this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.readyStateEl.classList.remove("hidden");const t=this.headerEl.querySelector("#btn-pause-toggle"),e=this.headerEl.querySelector("#pause-btn-label");t&&(t.disabled=!0,t.classList.remove("btn-warning-active")),e&&(e.textContent="⏸️ Pause"),this.updateHeaderInputsUI()}showActiveGameStage(){this.readyStateEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.gameStageEl.classList.remove("hidden")}showBuildErrorView(t){this.runner.destroy(),this.annotationBarEl.classList.add("hidden"),this.readyStateEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.remove("hidden");const e=this.viewportEl.querySelector("#error-state-title"),n=this.viewportEl.querySelector("#error-state-meta"),s=this.viewportEl.querySelector("#error-state-traceback");e&&(e.textContent=t.error||"Go WASM Compilation Failed"),n&&(n.textContent=`Workspace: ${t.workspace} | Package: ${t.pkg} | Exit Code: ${t.exitCode}`),s&&(s.textContent=t.compilerOutput)}showRuntimePanicView(t){const e=x()||".";this.lastBuildFailure={ok:!1,status:422,error:"Go WASM Runtime Panic",compilerOutput:[t,"",...this.runner.getConsoleLogs().slice(-30)].join(`
`),workspace:e,pkg:this.activePkg,exitCode:2},this.showBuildErrorView(this.lastBuildFailure)}async handleSendBuildErrorToChat(){if(!this.lastBuildFailure)return;const t=this.viewportEl.querySelector("#btn-send-build-error");t&&(t.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input")?.value.trim()||"";await gt({buildError:this.lastBuildFailure.compilerOutput,note:n,workspace:this.lastBuildFailure.workspace,pkg:this.lastBuildFailure.pkg}),k.success("Sent Go WASM compiler traceback directly to Antigravity chat!")}catch(e){k.error("Failed to send build error to chat",e?.message||String(e))}finally{t&&(t.disabled=!1)}}async ensurePausedFrameLoaded(){if(this.runner.isRunning()&&!this.runner.isPaused()?this.runner.setPaused(!0):this.dvrBuffer.length===0&&(this.runner.syncDvrFromChild(),this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI()),!this.annotator.hasFrozenFrame()){const t=this.runner.getGameCanvas();if(t&&t.width>0&&t.height>0)this.annotator.loadBaseFromCanvas(t);else{const e=this.dvrBuffer.getLatestFrame();e&&(e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}}}decodeDataUrlToImage(t){return new Promise((e,n)=>{const s=new Image;s.onload=()=>e(s),s.onerror=()=>n(new Error("Failed to decode frame dataUrl into HTMLImageElement.")),s.src=t})}async buildDvrAnimatedGifDataUrl(){await this.ensurePausedFrameLoaded();const t=this.dvrBuffer.getFrames(),e=t.length>0?Math.max(0,Math.min(t.length-1,this.activeDvrIndex)):0,n=t.length>0?t.slice(0,e+1):[],s=this.annotator.getDimensions(),i=n[0]?.width||s.width||640,r=n[0]?.height||s.height||360;let o={x:0,y:0,width:i,height:r};const d=n[n.length-1]||n[0];if(d){const b=document.createElement("canvas");b.width=i,b.height=r;const g=b.getContext("2d",{willReadFrequently:!0});if(g){if(g.clearRect(0,0,i,r),d.canvas)g.drawImage(d.canvas,0,0,i,r);else if(d.dataUrl){const E=await this.decodeDataUrlToImage(d.dataUrl);g.drawImage(E,0,0,i,r)}const y=g.getImageData(0,0,i,r);o=H(y.data,i,r)}}const u=480,h=o.width>u?u/o.width:1,l=Math.max(64,Math.round(o.width*h)),c=Math.max(36,Math.round(o.height*h)),f=document.createElement("canvas");f.width=l,f.height=c;const p=f.getContext("2d",{willReadFrequently:!0});if(!p)throw new Error("Failed to acquire 2D context for GIF encoding.");p.imageSmoothingEnabled=!1;const m=[];for(let b=0;b<n.length;b++){const g=n[b];if(p.fillStyle="#090D16",p.fillRect(0,0,l,c),g.canvas)p.drawImage(g.canvas,o.x,o.y,o.width,o.height,0,0,l,c);else{const I=await this.decodeDataUrlToImage(g.dataUrl);p.drawImage(I,o.x,o.y,o.width,o.height,0,0,l,c)}const y=p.getImageData(0,0,l,c),E=b===n.length-1;let C=this.dvrBuffer.captureIntervalMs;if(b+1<n.length){const I=n[b+1].timestampMs-g.timestampMs;Number.isFinite(I)&&I>=15&&I<=250&&(C=Math.round(I))}m.push({rgba:new Uint8Array(y.data),delayMs:E?900:C})}if(m.length===0){const b=this.runner.getGameCanvas();if(p.fillStyle="#090D16",p.fillRect(0,0,l,c),b&&b.width>0&&b.height>0){const y=b.getContext("2d");if(y){const E=y.getImageData(0,0,b.width,b.height);o=H(E.data,b.width,b.height)}p.drawImage(b,o.x,o.y,o.width,o.height,0,0,l,c)}const g=p.getImageData(0,0,l,c);m.push({rgba:new Uint8Array(g.data),delayMs:900})}const S=xt({width:l,height:c,frames:m}),w=n.length>=2?(n[n.length-1].timestampMs-n[0].timestampMs)/1e3:n.length*this.dvrBuffer.captureIntervalMs/1e3,v=Number(Math.max(.04,w).toFixed(2));return{dataUrl:Ct(S),width:l,height:c,frameCount:m.length,durationSec:v}}async handleSendGifToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}const t=this.bugBarEl.querySelector("#btn-send-gif-chat"),e=this.bugBarEl.querySelector("#btn-send-bug-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{k.info("Encoding 10s DVR replay (25 FPS) into animated GIF...",2400);const n=await this.buildDvrAnimatedGifDataUrl(),s=this.bugBarEl.querySelector("#bug-note-input"),i=this.bugBarEl.querySelector("#include-logs-checkbox"),r=s?.value.trim()||"",d=(i?i.checked:!0)?this.runner.getConsoleLogs():[],u=this.dvrBuffer.getFrameAt(this.activeDvrIndex),h=u?u.relativeSec===0?"live (0.0s)":`${u.relativeSec.toFixed(2)}s`:"live",l=`playtest-clip-${Date.now()}.gif`,c=await X({filename:l,imageDataUrl:n.dataUrl,note:r,consoleLogs:d,workspace:x()||".",pkg:this.activePkg,frameOffset:`${n.frameCount}f (${n.durationSec}s DVR → ${h})`,resolution:`${n.width}x${n.height}`,width:n.width,height:n.height});k.success(`Delivered 10s DVR GIF "${c.filename||l}" (${n.frameCount} frames) to chat!`),s&&(s.value="")}catch(n){k.error("Failed to encode or send 10s DVR GIF",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}async handleSendBugToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}await this.ensurePausedFrameLoaded();const t=this.bugBarEl.querySelector("#btn-send-bug-chat"),e=this.bugBarEl.querySelector("#btn-send-gif-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input"),s=this.bugBarEl.querySelector("#include-logs-checkbox"),i=n?.value.trim()||"",o=(s?s.checked:!0)?this.runner.getConsoleLogs():[],d=this.annotator.exportSmartComposite(),u=this.dvrBuffer.getFrameAt(this.activeDvrIndex),h=u?u.relativeSec===0?"live (0.0s)":`${u.relativeSec.toFixed(2)}s`:"live",l=`playtest-bug-${Date.now()}.png`,c=await X({filename:l,imageDataUrl:d.dataUrl,note:i,consoleLogs:o,workspace:x()||".",pkg:this.activePkg,frameOffset:h,resolution:`${d.width}x${d.height}`,width:d.width,height:d.height});k.success(`Delivered "${c.filename||l}" to Antigravity chat!`),n&&(n.value="")}catch(n){k.error("Failed to send bug report to chat",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}setBuildButtonsLoading(t){const e=this.headerEl.querySelector("#btn-build-run"),n=this.headerEl.querySelector("#build-btn-label"),s=this.viewportEl.querySelector("#btn-ready-build");e&&(e.disabled=t),s&&(s.disabled=t,s.innerHTML=t?"<span>⏳ Compiling &amp; Launching WASM...</span>":"<span>▶ Compile &amp; Launch Ebitengine WASM</span>"),n&&(n.textContent=t?"⏳ Building...":"🚀 Run")}updateHeaderInputsUI(){const t=x(),e=this.headerEl.querySelector("#workspace-input"),n=this.viewportEl.querySelector("#ready-workspace-input");e&&e.value!==t&&(e.value=t),n&&n.value!==t&&(n.value=t);const s=this.headerEl.querySelector("#playtest-project-label");if(s){s.textContent=this.formatProjectBadgeLabel(t,this.activePkg);const r=t?`${t} (${this.activePkg||"."}) — Click to switch project`:"Click to open a Go game project";s.setAttribute("title",r)}const i=this.headerEl.querySelector("#btn-full-studio");i&&(i.href=N())}updateSessionBadgeUI(){const t=$(),e=this.headerEl.querySelector("#btn-session-badge"),n=this.headerEl.querySelector("#btn-full-studio");if(e){const s=e.querySelector(".status-dot"),i=e.querySelector("#session-badge-text");if(t&&t!=="standalone"){e.className="session-badge connected",s&&(s.className="status-dot online"),i&&(i.textContent=`${t.slice(0,8)}...`);const r=`Session: ${t.slice(0,8)}... (Click to switch)`;e.setAttribute("data-tooltip",r),e.setAttribute("title",r)}else{e.className="session-badge disconnected",s&&(s.className="status-dot offline"),i&&(i.textContent="Standalone");const r="Session: Standalone (Click to connect)";e.setAttribute("data-tooltip",r),e.setAttribute("title",r)}}n&&(n.href=N())}async openSessionSwitcherModal(){const t=document.getElementById("session-switcher-modal");t&&t.remove();const e=document.createElement("div");e.id="session-switcher-modal",e.className="modal-overlay",e.innerHTML=`
      <div class="modal-dialog session-modal-dialog">
        <div class="modal-header">
          <span class="modal-title">Connect Antigravity Session</span>
          <button type="button" class="modal-close-btn" id="session-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="session-manual-row">
            <input
              type="text"
              id="manual-session-input"
              class="input-text"
              placeholder="Paste Session UUID or 'standalone'"
              value="${this.escapeAttr($()||"")}"
            />
            <button type="button" id="btn-apply-session" class="btn btn-primary btn-sm">Connect</button>
          </div>
          <div id="recent-sessions-list" class="recent-sessions-list">
            <div class="session-loading">Loading recent Antigravity sessions...</div>
          </div>
        </div>
      </div>
    `;const n=()=>e.remove();e.querySelector("#session-modal-close")?.addEventListener("click",n),e.addEventListener("click",i=>{i.target===e&&n()}),e.querySelector("#btn-apply-session")?.addEventListener("click",()=>{const r=e.querySelector("#manual-session-input").value.trim();if(r)try{G(r),k.success(`Connected to session ${r}`),n()}catch(o){k.error("Invalid Session ID",o?.message||String(o))}}),document.body.appendChild(e);const s=e.querySelector("#recent-sessions-list");try{const i=await pt();if(i.length===0){s.innerHTML='<div class="session-empty">No recent sessions found.</div>';return}s.innerHTML=i.map(r=>`
          <button type="button" class="session-item-btn" data-sid="${this.escapeAttr(r.id)}">
            <span class="session-item-id">${this.escapeHtml(r.id)}</span>
            <span class="session-item-time">${this.escapeHtml(new Date(r.updatedAt).toLocaleTimeString())}</span>
          </button>
        `).join(""),s.querySelectorAll(".session-item-btn").forEach(r=>{r.addEventListener("click",()=>{const o=r.dataset.sid;o&&(G(o),k.success(`Connected to session ${o.slice(0,8)}...`),n())})})}catch(i){s.innerHTML=`<div class="session-empty">Failed to load sessions: ${this.escapeHtml(i?.message||String(i))}</div>`}}escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}escapeAttr(t){return this.escapeHtml(t).replace(/'/g,"&#39;")}}function Pt(a){const t=a.trim().toLowerCase();if(!t)return null;const e=t.match(/^#([0-9a-f]{3,8})$/i);if(e){const o=e[1];let d=0,u=0,h=0;return o.length===3||o.length===4?(d=parseInt(o[0]+o[0],16),u=parseInt(o[1]+o[1],16),h=parseInt(o[2]+o[2],16)):o.length>=6&&(d=parseInt(o.slice(0,2),16),u=parseInt(o.slice(2,4),16),h=parseInt(o.slice(4,6),16)),(.299*d+.587*u+.114*h)/255}const n=t.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/);if(n){const o=Number(n[1]),d=Number(n[2]),u=Number(n[3]);return(.299*o+.587*d+.114*u)/255}const s=t.match(/^hsla?\(\s*[\d.]+\s*[, ]\s*[\d.]+%\s*[, ]\s*([\d.]+)%/);if(s)return Number(s[1])/100;const i=t.match(/^oklch\(\s*([\d.]+)(%?)/);if(i){const o=Number(i[1]);return i[2]==="%"?o/100:o}const r=t.match(/^[\d.]+\s+[\d.]+%\s+([\d.]+)%$/);return r?Number(r[1])/100:null}function F(a){const t=document.documentElement,e=a==="light",n=t.classList.contains("light")!==e||t.classList.contains("dark")!==!e;t.classList.toggle("light",e),t.classList.toggle("dark",!e),document.body?.classList.toggle("light",e),document.body?.classList.toggle("dark",!e),n&&window.dispatchEvent(new CustomEvent("studio-theme-change",{detail:{theme:a}}))}function M(a){if(a==="light"||a==="dark"){F(a);return}const e=(new URLSearchParams(window.location.search).get("theme")||"").trim().toLowerCase();if(e==="light"||e==="dark"){F(e);return}const n=document.documentElement,s=(n.getAttribute("data-theme")||document.body?.getAttribute("data-theme")||"").trim().toLowerCase();if(s.includes("light")){F("light");return}if(s.includes("dark")){F("dark");return}const i=getComputedStyle(n),r=i.getPropertyValue("--background").trim()||i.getPropertyValue("--vscode-editor-background").trim()||(document.body?getComputedStyle(document.body).getPropertyValue("--background").trim():""),o=Pt(r);if(o!==null){F(o>.55?"light":"dark");return}if(typeof window.matchMedia=="function"&&window.matchMedia("(prefers-color-scheme: light)").matches){F("light");return}}function Ut(){if(M(),window.addEventListener("message",a=>{const t=a.data;if(!t||typeof t!="object")return;const e=String(t.type||t.event||"").toLowerCase();if(e==="theme-change"||e==="theme"||e==="antigravity:theme-change"||typeof t.theme=="string"||typeof t.colorScheme=="string"){const n=String(t.theme||t.colorScheme||t.mode||"").toLowerCase();n.includes("light")?M("light"):n.includes("dark")?M("dark"):M()}}),typeof MutationObserver<"u"&&new MutationObserver(()=>{M()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]}),typeof window.matchMedia=="function"){const a=window.matchMedia("(prefers-color-scheme: light)");typeof a.addEventListener=="function"&&a.addEventListener("change",()=>M())}}function Z(){try{Ut(),document.title="Game Dev Studio";const a=ct(),t=a==="preview"?"studio-mode-preview":"studio-mode-full";document.body.classList.remove("studio-mode-preview","studio-mode-full"),document.body.classList.add("studio-container",t),a==="preview"?document.body.classList.add("bg-transparent"):document.body.classList.remove("bg-transparent");const e=document.getElementById("app");e&&(e.classList.remove("studio-mode-preview","studio-mode-full"),e.classList.add("studio-container",t));const n=document.getElementById("app-root");n&&(n.classList.remove("studio-mode-preview","studio-mode-full"),n.classList.add("studio-container",t));const s=document.getElementById("header-bar"),i=document.getElementById("annotation-bar"),r=document.getElementById("viewport-container"),o=document.getElementById("bug-report-bar");if(!n||!s||!i||!r||!o)throw new Error("Required DOM containers not found for Game Dev Studio. Missing: "+[!n&&"#app-root",!s&&"#header-bar",!i&&"#annotation-bar",!r&&"#viewport-container",!o&&"#bug-report-bar"].filter(Boolean).join(", "));new Dt({headerEl:s,annotationBarEl:i,viewportEl:r,bugBarEl:o}),console.log(`[Game Dev Studio] Initialized playtest view in "${a}" mode`)}catch(a){console.error("[Game Dev Studio] Initialization error:",a),k.fatal("Game Dev Studio Initialization Failed",a)}}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",Z,{once:!0}):Z();window.addEventListener("error",a=>{console.error("[Game Dev Studio] Uncaught Window Error:",a),k.fatal("Uncaught Runtime Error",a.error||a.message)});window.addEventListener("unhandledrejection",a=>{console.error("[Game Dev Studio] Unhandled Promise Rejection:",a),k.fatal("Unhandled Promise Rejection",a.reason)});
