/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&a(n)}).observe(document,{childList:!0,subtree:!0});function e(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=e(s);fetch(s.href,i)}})();let q=null,_=null;const et=[],st=[];function P(d){if(typeof d=="number"&&Number.isFinite(d))return!0;if(typeof d!="string")return!1;const t=d.trim();return t.length>0&&!(t.startsWith("__")&&t.endsWith("__"))}async function C(d,t={}){const e=d.startsWith("http://")||d.startsWith("https://")?d:`${W()}${d}`;return window.sidecar&&typeof window.sidecar.fetch=="function"?window.sidecar.fetch(e,t):fetch(e,t)}function W(){const d=window.__STUDIO_CONFIG__?.apiBaseUrl;return P(d)?String(d).trim().replace(/\/+$/,""):""}const $=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;function rt(){const d=window.sidecar?.conversationId?.trim();if(d&&$.test(d))return d;const t=new URLSearchParams(window.location.search),e=(t.get("conversationId")||t.get("session_id")||t.get("sessionId"))?.trim();if(e&&P(e)&&$.test(e))return e;const a=window.__STUDIO_CONFIG__?.sessionId;if(P(a)){const s=String(a).trim();if($.test(s))return s}return""}function I(){return q===null&&(q=rt()),q}function A(){const d=I();return d||null}function at(d){const t=d.trim();if(!t||!$.test(t))throw new Error(`Invalid session_id "${d}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`);q=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.sessionId=t);for(const e of et)e(t)}function D(d){at(d)}function ot(d){et.push(d)}function lt(){const t=new URLSearchParams(window.location.search).get("workspace")?.trim();if(t&&P(t))return t;const e=window.__STUDIO_CONFIG__?.workspace;return P(e)?String(e).trim():""}function T(){return _===null&&(_=lt()),_}function U(d){const t=d.trim();_=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.workspace=t);for(const e of st)e(t)}function dt(d){st.push(d)}function ct(){return new URLSearchParams(window.location.search).get("mode")==="preview"||window.__STUDIO_CONFIG__?.mode==="preview"?"preview":"full"}function N(){const d=window.location.protocol==="http:"||window.location.protocol==="https:"?window.location.origin:W(),t=I()||"standalone",e=T(),a=new URLSearchParams({mode:"full",conversationId:t}),s=new URLSearchParams(window.location.search).get("token");return s&&a.set("token",s),e&&a.set("workspace",e),`${d}/?${a.toString()}`}async function ht(d){const t=await C("/api/workspace/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceUri:d})});if(!t.ok){const e=await t.json().catch(()=>({}));throw new Error(e.error||`Failed to resolve workspace URI: HTTP ${t.status}`)}return await t.json()}async function ut(){const d=await C("/api/health",{method:"GET",cache:"no-store"});if(!d.ok)throw new Error(`Failed to fetch sidecar health: HTTP ${d.status} ${d.statusText}`);const t=await d.json();return t.activeSessionId&&!I()&&at(t.activeSessionId),t.defaultWorkspace&&!T()&&U(t.defaultWorkspace),t}async function pt(){const d=await C("/api/sessions",{method:"GET",cache:"no-store"});if(!d.ok)throw new Error(`Failed to fetch recent sessions: HTTP ${d.status} ${d.statusText}`);const t=await d.json();return Array.isArray(t.sessions)?t.sessions:[]}async function ft(d){const t=d.workspace.trim();if(!t)throw new Error("Workspace path is required to compile Go WASM.");const e=d.pkg?.trim()||void 0,a=await C("/api/playtest/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:t,pkg:e})}),s=await a.text();let i={};if(s.trim())try{i=JSON.parse(s)}catch{throw new Error(`Unexpected non-JSON response from /api/playtest/build (HTTP ${a.status}): ${s.slice(0,300)}`)}if(a.status===422)return{ok:!1,status:422,error:i.error||"Go WASM compilation failed",compilerOutput:i.compilerOutput||i.stderr||i.error||s,workspace:i.workspace||t,pkg:i.pkg||e||".",exitCode:typeof i.exitCode=="number"?i.exitCode:1};if(!a.ok)throw new Error(i.error||`WASM build request failed with HTTP ${a.status} ${a.statusText}`);return{ok:!0,status:200,buildId:i.buildId,workspace:i.workspace||t,pkg:i.pkg||e||".",wasmBytes:i.wasmBytes??0,durationMs:i.durationMs??0,wasmUrl:i.wasmUrl||`/api/playtest/wasm?buildId=${encodeURIComponent(i.buildId)}`,wasmExecUrl:i.wasmExecUrl||"/api/playtest/wasm_exec.js"}}async function O(d){const t=d.sessionId||window.sidecar?.conversationId||I()||"standalone",e=d.workspace||T(),a=d.pkg||".",s=d.filename||`playtest-bug-${Date.now()}.png`,i=await C("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,filename:s,image:d.imageDataUrl,note:d.note||"",consoleLogs:d.consoleLogs||[],workspace:e,pkg:a,metadata:{workspace:e,pkg:a,frameOffset:d.frameOffset??"live",resolution:d.resolution||(d.width&&d.height?`${d.width}x${d.height}`:"canvas"),width:d.width,height:d.height}})}),n=await i.text();let r={};try{r=n?JSON.parse(n):{}}catch{r={error:n}}if(!i.ok)throw new Error(r.error||`Failed to send bug report to chat: HTTP ${i.status} ${i.statusText}`);return r}async function mt(d){const t=d.sessionId||window.sidecar?.conversationId||I()||"standalone",e=d.workspace||T(),a=d.pkg||".",s=await C("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,buildError:d.buildError,note:d.note||"",workspace:e,pkg:a,metadata:{workspace:e,pkg:a}})}),i=await s.text();let n={};try{n=i?JSON.parse(i):{}}catch{n={error:i}}if(!s.ok)throw new Error(n.error||`Failed to send build error to chat: HTTP ${s.status} ${s.statusText}`);return n}class gt{maxFrames;captureIntervalMs;slots;writePtr=0;count=0;sequence=0;lastCaptureTimeMs=-1/0;constructor(t=250,e=40){if(!Number.isInteger(t)||t<1)throw new Error(`[FrameDvrBuffer] Invalid maxFrames=${t}. Must be a positive integer.`);if(!Number.isFinite(e)||e<1)throw new Error(`[FrameDvrBuffer] Invalid captureIntervalMs=${e}. Must be a positive number.`);this.maxFrames=t,this.captureIntervalMs=e,this.slots=new Array(t).fill(null)}get length(){return this.count}shouldCapture(t){return t-this.lastCaptureTimeMs>=this.captureIntervalMs}recordFrame(t,e=performance.now()){if(!t||typeof t.toDataURL!="function"||typeof t.width!="number"||typeof t.height!="number")throw new Error("[FrameDvrBuffer] recordFrame requires a valid canvas element with width, height, and toDataURL().");if(t.width<=0||t.height<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${t.width}x${t.height}).`);const a=t.toDataURL("image/png");return this.recordFrameDataUrl(a,t.width,t.height,e)}recordFrameDataUrl(t,e,a,s=performance.now()){if(typeof t!="string"||!t.startsWith("data:image/"))throw new Error("[FrameDvrBuffer] Canvas toDataURL() did not return a valid image data URI.");if(!Number.isFinite(e)||!Number.isFinite(a)||e<=0||a<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${e}x${a}).`);const i=++this.sequence,n={frameNumber:i,timestampMs:s,width:e,height:a,dataUrl:t};return this.slots[this.writePtr]=n,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s,{index:this.count-1,frameNumber:i,timestampMs:s,relativeSec:0,width:n.width,height:n.height,dataUrl:n.dataUrl}}recordCanvasSlot(t,e,a,s){const n={frameNumber:++this.sequence,timestampMs:s,width:e,height:a,dataUrl:"",canvas:t};this.slots[this.writePtr]=n,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s}recordFrameIfDue(t,e=performance.now()){return this.shouldCapture(e)?this.recordFrame(t,e):null}createDvrFrameFromSlot(t,e,a){return{index:e,frameNumber:t.frameNumber,timestampMs:t.timestampMs,relativeSec:a,width:t.width,height:t.height,canvas:t.canvas,get dataUrl(){return!t.dataUrl&&t.canvas&&(t.dataUrl=t.canvas.toDataURL("image/png")),t.dataUrl}}}getFrames(){if(this.count===0)return[];const t=this.count<this.maxFrames?0:this.writePtr,e=(t+this.count-1)%this.maxFrames,a=this.slots[e],s=a?a.timestampMs:0,i=new Array(this.count);for(let n=0;n<this.count;n++){const r=(t+n)%this.maxFrames,o=this.slots[r],c=(o.timestampMs-s)/1e3,u=c===0?0:Number(c.toFixed(2));i[n]=this.createDvrFrameFromSlot(o,n,u)}return i}getFrameAt(t){if(!Number.isInteger(t)||t<0||t>=this.count)return null;const e=this.count<this.maxFrames?0:this.writePtr,a=(e+t)%this.maxFrames,s=this.slots[a];if(!s)return null;const i=(e+this.count-1)%this.maxFrames,n=this.slots[i],r=n?n.timestampMs:s.timestampMs,o=(s.timestampMs-r)/1e3,c=o===0?0:Number(o.toFixed(2));return this.createDvrFrameFromSlot(s,t,c)}getLatestFrame(){return this.count===0?null:this.getFrameAt(this.count-1)}clear(){this.slots.fill(null),this.writePtr=0,this.count=0,this.lastCaptureTimeMs=-1/0}}function vt(){const d=new Uint8Array(768);let t=0;const e=(n,r,o)=>{t>=256||(d[t*3]=n,d[t*3+1]=r,d[t*3+2]=o,t++)},a=[0,51,102,153,204,255];for(let n=0;n<6;n++)for(let r=0;r<6;r++)for(let o=0;o<6;o++)e(a[n],a[r],a[o]);for(let n=0;n<24;n++){const r=Math.round(8+n*238/23);e(r,r,r)}const s=[[239,68,68],[250,204,21],[6,182,212],[34,197,94],[255,255,255],[9,13,22],[11,15,26],[16,23,38],[20,12,14],[56,189,248],[244,63,94],[168,85,247],[16,185,129],[245,158,11],[99,102,241],[236,72,153]];for(const[n,r,o]of s)e(n,r,o);const i=new Uint8Array(32768);for(let n=0;n<32;n++){const r=n<<3|n>>2;for(let o=0;o<32;o++){const c=o<<3|o>>2;for(let u=0;u<32;u++){const l=u<<3|u>>2;let h=0,p=1/0;for(let f=0;f<256;f++){const m=d[f*3],y=d[f*3+1],w=d[f*3+2],k=r-m,b=c-y,g=l-w,v=k*k*2+b*b*4+g*g;if(v<p&&(p=v,h=f,v===0))break}i[n<<10|o<<5|u]=h}}}return{palette:d,lut15:i}}let R=null;function bt(){return R||(R=vt()),R}class yt{buf;length=0;constructor(t=262144){this.buf=new Uint8Array(t)}ensure(t){const e=this.length+t;if(e<=this.buf.length)return;let a=this.buf.length*2;for(;a<e;)a*=2;const s=new Uint8Array(a);s.set(this.buf.subarray(0,this.length)),this.buf=s}writeByte(t){this.ensure(1),this.buf[this.length++]=t&255}writeUint16LE(t){this.ensure(2),this.buf[this.length++]=t&255,this.buf[this.length++]=t>>8&255}writeBytes(t){this.ensure(t.length),this.buf.set(t,this.length),this.length+=t.length}writeAscii(t){this.ensure(t.length);for(let e=0;e<t.length;e++)this.buf[this.length++]=t.charCodeAt(e)&255}toUint8Array(){return this.buf.slice(0,this.length)}}function St(d,t,e){d.writeByte(8);let n=9,r=258,o=(1<<n)-1;e.fill(-1);const c=new Uint8Array(255);let u=0,l=0,h=0;const p=()=>{u>0&&(d.writeByte(u),d.writeBytes(c.subarray(0,u)),u=0)},f=m=>{for(l|=m<<h,h+=n;h>=8;)c[u++]=l&255,u===255&&p(),l>>=8,h-=8};if(f(256),t.length>0){let m=t[0];for(let y=1;y<t.length;y++){const w=t[y],k=m<<8|w,b=e[k];b!==-1?m=b:(f(m),r<4096?(e[k]=r,r>o&&n<12&&(n++,o=(1<<n)-1),r++):(f(256),e.fill(-1),n=9,r=258,o=(1<<n)-1),m=w)}f(m)}f(257),h>0&&(c[u++]=l&255),p(),d.writeByte(0)}function wt(d){const{width:t,height:e,frames:a}=d;if(!Number.isInteger(t)||!Number.isInteger(e)||t<=0||e<=0)throw new Error(`[GifEncoder] Invalid GIF dimensions: ${t}x${e}.`);if(!Array.isArray(a)||a.length===0)throw new Error("[GifEncoder] encodeAnimatedGif requires at least 1 frame.");const s=t*e*4;for(let l=0;l<a.length;l++){const h=a[l];if(!h||!h.rgba||h.rgba.length!==s)throw new Error(`[GifEncoder] Frame ${l} RGBA length (${h?.rgba?.length??0}) does not match ${t}x${e}x4 (${s}).`)}const{palette:i,lut15:n}=bt(),r=new yt(Math.max(65536,t*e*Math.min(a.length,8)));r.writeAscii("GIF89a"),r.writeUint16LE(t),r.writeUint16LE(e),r.writeByte(247),r.writeByte(0),r.writeByte(0),r.writeBytes(i),r.writeBytes([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);const o=t*e,c=new Uint8Array(o),u=new Int32Array(4096*256);for(let l=0;l<a.length;l++){const h=a[l],p=h.rgba,f=Math.max(2,Math.round((h.delayMs||66)/10));for(let m=0,y=0;m<o;m++,y+=4){const w=p[y]>>3,k=p[y+1]>>3,b=p[y+2]>>3;c[m]=n[w<<10|k<<5|b]}r.writeBytes([33,249,4,0]),r.writeUint16LE(f),r.writeBytes([0,0]),r.writeByte(44),r.writeUint16LE(0),r.writeUint16LE(0),r.writeUint16LE(t),r.writeUint16LE(e),r.writeByte(0),St(r,c,u)}return r.writeByte(59),r.toUint8Array()}function H(d,t,e){if(t<=0||e<=0||d.length<t*e*4)return{x:0,y:0,width:Math.max(1,t),height:Math.max(1,e)};const a=(t*e-1)*4,s=d[3],i=d[a+3],n=s===0||i===0,r=d[0],o=d[1],c=d[2],u=!n&&r<=12&&o<=16&&c<=26&&Math.abs(d[a]-r)<=2&&Math.abs(d[a+1]-o)<=2&&Math.abs(d[a+2]-c)<=2,l=g=>{const v=d[g+3];return n?v>16:u?v>16&&(Math.abs(d[g]-r)>2||Math.abs(d[g+1]-o)>2||Math.abs(d[g+2]-c)>2):v>16&&(d[g]>0||d[g+1]>0||d[g+2]>0)};let h=0,p=!1;for(let g=0;g<e;g++){const v=g*t*4;for(let S=0;S<t;S+=2)if(l(v+S*4)){h=g,p=!0;break}if(p)break}if(!p)return{x:0,y:0,width:t,height:e};let f=e-1;for(let g=e-1;g>=h;g--){const v=g*t*4;let S=!1;for(let E=0;E<t;E+=2)if(l(v+E*4)){f=g,S=!0;break}if(S)break}let m=0,y=!1;for(let g=0;g<t;g++){for(let v=h;v<=f;v+=2)if(l((v*t+g)*4)){m=g,y=!0;break}if(y)break}let w=t-1;for(let g=t-1;g>=m;g--){let v=!1;for(let S=h;S<=f;S+=2)if(l((S*t+g)*4)){w=g,v=!0;break}if(v)break}const k=w-m+1,b=f-h+1;return k<64||b<36?{x:0,y:0,width:t,height:e}:{x:m,y:h,width:k,height:b}}function kt(d){const e=[];for(let s=0;s<d.length;s+=32768){const i=d.subarray(s,s+32768);e.push(String.fromCharCode(...i))}const a=e.join("");return`data:image/gif;base64,${btoa(a)}`}const it=[{name:"Red",hex:"#EF4444"},{name:"Yellow",hex:"#FACC15"},{name:"Cyan",hex:"#06B6D4"},{name:"Lime",hex:"#22C55E"},{name:"White",hex:"#FFFFFF"}];function Et(d,t){const e=d.replace(/^#/,"").trim();if(e.length===3){const a=parseInt(e[0]+e[0],16),s=parseInt(e[1]+e[1],16),i=parseInt(e[2]+e[2],16);return`rgba(${a}, ${s}, ${i}, ${t})`}if(e.length===6){const a=parseInt(e.slice(0,2),16),s=parseInt(e.slice(2,4),16),i=parseInt(e.slice(4,6),16);return`rgba(${a}, ${s}, ${i}, ${t})`}return`rgba(239, 68, 68, ${t})`}function nt(d){return d.type==="pen"?{...d,points:d.points.map(t=>({x:t.x,y:t.y}))}:{...d}}function L(d){return d.map(nt)}class xt{baseCanvas;overlayCanvas;onHistoryChange;activeTool="box";activeColor=it[0].hex;strokeWidth=3;shapes=[];undoStack=[];redoStack=[];isDrawing=!1;draftShape=null;shapeCounter=0;activeTextInputEl=null;width;height;hasBaseSnapshot=!1;constructor(t={}){this.baseCanvas=t.baseCanvas??null,this.overlayCanvas=t.overlayCanvas??null,this.onHistoryChange=t.onHistoryChange??null,this.width=t.width??(this.baseCanvas?.width||640),this.height=t.height??(this.baseCanvas?.height||360),this.baseCanvas&&(this.baseCanvas.width=this.width,this.baseCanvas.height=this.height),this.overlayCanvas&&(this.overlayCanvas.width=this.width,this.overlayCanvas.height=this.height,this.bindPointerEvents(this.overlayCanvas))}getTool(){return this.activeTool}setTool(t){this.commitOrCloseActiveTextInput(),this.activeTool=t}getColor(){return this.activeColor}setColor(t){if(!t||typeof t!="string")throw new Error("[BugAnnotator] Invalid color value.");this.activeColor=t}getDimensions(){return{width:this.width,height:this.height}}setDimensions(t,e){if(t<=0||e<=0)throw new Error(`[BugAnnotator] Invalid dimensions: ${t}x${e}`);this.width=t,this.height=e,this.baseCanvas&&(this.baseCanvas.width!==t||this.baseCanvas.height!==e)&&(this.baseCanvas.width=t,this.baseCanvas.height=e),this.overlayCanvas&&(this.overlayCanvas.width!==t||this.overlayCanvas.height!==e)&&(this.overlayCanvas.width=t,this.overlayCanvas.height=e),this.renderOverlay()}getShapes(){return L(this.shapes)}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}addShape(t){this.undoStack.push(L(this.shapes)),this.redoStack=[],this.shapes.push(nt(t)),this.renderOverlay(),this.notifyHistoryChange()}addTextAnnotation(t,e,a){const s=a.trim();if(!s)return null;const i={id:this.nextShapeId(),type:"text",color:this.activeColor,x:Math.round(t),y:Math.round(e),text:s};return this.addShape(i),i}undo(){if(this.undoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.redoStack.push(L(this.shapes));const t=this.undoStack.pop();return this.shapes=L(t),this.renderOverlay(),this.notifyHistoryChange(),!0}redo(){if(this.redoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.undoStack.push(L(this.shapes));const t=this.redoStack.pop();return this.shapes=L(t),this.renderOverlay(),this.notifyHistoryChange(),!0}clearAnnotations(){this.commitOrCloseActiveTextInput(),this.shapes.length!==0&&(this.undoStack.push(L(this.shapes)),this.redoStack=[],this.shapes=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange())}resetHistory(){this.commitOrCloseActiveTextInput(),this.shapes=[],this.undoStack=[],this.redoStack=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange()}loadBaseFromCanvas(t){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to receive snapshot.");t.width>0&&t.height>0&&this.setDimensions(t.width,t.height);const e=this.baseCanvas.getContext("2d");if(!e)throw new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas.");e.clearRect(0,0,this.width,this.height),e.drawImage(t,0,0,this.width,this.height),this.hasBaseSnapshot=!0,this.renderOverlay()}loadBaseFrameDataUrl(t,e,a){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to load frame data URL.");if(!t||!t.startsWith("data:image/"))throw new Error("[BugAnnotator] Invalid image dataUrl passed to loadBaseFrameDataUrl.");return new Promise((s,i)=>{const n=new Image;n.onload=()=>{const r=e&&e>0?e:n.naturalWidth||this.width,o=a&&a>0?a:n.naturalHeight||this.height;this.setDimensions(r,o);const c=this.baseCanvas.getContext("2d");if(!c){i(new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas."));return}c.clearRect(0,0,r,o),c.drawImage(n,0,0,r,o),this.hasBaseSnapshot=!0,this.renderOverlay(),s()},n.onerror=()=>{i(new Error("[BugAnnotator] Failed to decode DVR frame dataUrl into Image."))},n.src=t})}hasFrozenFrame(){return this.hasBaseSnapshot}renderOverlay(){if(!this.overlayCanvas)return;const t=this.overlayCanvas.getContext("2d");if(t){t.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);for(const e of this.shapes)this.renderShape(t,e);this.draftShape&&this.renderShape(t,this.draftShape)}}renderShape(t,e){if(t.save(),e.type==="pen"){if(e.points.length>0){t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let a=1;a<e.points.length;a++)t.lineTo(e.points[a].x,e.points[a].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let a=1;a<e.points.length;a++)t.lineTo(e.points[a].x,e.points[a].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke()}}else if(e.type==="arrow"){const a=e.endX-e.startX,s=e.endY-e.startY;if(Math.hypot(a,s)>=2){const n=Math.atan2(s,a),r=Math.max(12,e.strokeWidth*4.5),o=Math.PI/6.5,c=e.endX-r*Math.cos(n-o),u=e.endY-r*Math.sin(n-o),l=e.endX-r*Math.cos(n+o),h=e.endY-r*Math.sin(n+o);t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.72)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-r*.55*Math.cos(n),e.endY-r*.55*Math.sin(n)),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-r*.55*Math.cos(n),e.endY-r*.55*Math.sin(n)),t.stroke(),t.beginPath(),t.moveTo(e.endX,e.endY),t.lineTo(c,u),t.lineTo(l,h),t.closePath(),t.fillStyle=e.color,t.strokeStyle="rgba(0, 0, 0, 0.75)",t.lineWidth=1.5,t.stroke(),t.fill()}}else if(e.type==="box"){const a=e.width>=0?e.x:e.x+e.width,s=e.height>=0?e.y:e.y+e.height,i=Math.abs(e.width),n=Math.abs(e.height);(i>=1||n>=1)&&(t.fillStyle=Et(e.color,.14),t.fillRect(a,s,i,n),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2,t.strokeRect(a,s,i,n),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.strokeRect(a,s,i,n))}else if(e.type==="text"){const a='600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';t.font=a;const s=t.measureText(e.text),i=8,n=5,r=Math.ceil(s.width)+i*2,o=24,c=Math.max(4,Math.min(this.width-r-4,e.x)),u=Math.max(4,Math.min(this.height-o-4,e.y-o/2));t.fillStyle="rgba(9, 13, 22, 0.9)",t.strokeStyle=e.color,t.lineWidth=2,t.beginPath(),typeof t.roundRect=="function"?t.roundRect(c,u,r,o,6):t.rect(c,u,r,o),t.fill(),t.stroke(),t.fillStyle="#FFFFFF",t.textBaseline="middle",t.fillText(e.text,c+i,u+o/2+n*.05)}t.restore()}exportCompositeDataUrl(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");e.width=this.width,e.height=this.height;const a=e.getContext("2d");if(!a)throw new Error("[BugAnnotator] Failed to acquire 2D context for composite export.");this.baseCanvas?a.drawImage(this.baseCanvas,0,0,this.width,this.height):(a.fillStyle="#090D16",a.fillRect(0,0,this.width,this.height));for(const s of this.shapes)this.renderShape(a,s);return e.toDataURL("image/png")}exportSmartComposite(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");let a={x:0,y:0,width:this.width,height:this.height};if(this.baseCanvas&&typeof this.baseCanvas.getContext=="function"){const o=this.baseCanvas.getContext("2d");if(o&&typeof o.getImageData=="function"){const c=o.getImageData(0,0,this.width,this.height);a=H(c.data,this.width,this.height)}}const s=Bt(this.shapes,this.width,this.height),i=Ct(a,s,this.width,this.height);e.width=i.width,e.height=i.height;const n=e.getContext("2d");if(!n)throw new Error("[BugAnnotator] Failed to acquire 2D context for smart composite export.");typeof n.fillRect=="function"&&(i.x<a.x||i.y<a.y||i.x+i.width>a.x+a.width||i.y+i.height>a.y+a.height||!this.baseCanvas)&&(n.fillStyle="#090D16",n.fillRect(0,0,i.width,i.height)),this.baseCanvas&&(i.x===0&&i.y===0&&i.width===this.width&&i.height===this.height?n.drawImage(this.baseCanvas,0,0,this.width,this.height):n.drawImage(this.baseCanvas,i.x,i.y,i.width,i.height,0,0,i.width,i.height));const r=(i.x!==0||i.y!==0)&&typeof n.translate=="function";r&&(n.save(),n.translate(-i.x,-i.y));for(const o of this.shapes)this.renderShape(n,o);return r&&n.restore(),{dataUrl:e.toDataURL("image/png"),width:i.width,height:i.height,crop:i}}bindPointerEvents(t){const e=s=>{const i=t.getBoundingClientRect(),n=i.width>0?t.width/i.width:1,r=i.height>0?t.height/i.height:1;return{x:(s.clientX-i.left)*n,y:(s.clientY-i.top)*r}};t.addEventListener("pointerdown",s=>{if(s.button!==0)return;s.preventDefault();const i=e(s);if(this.activeTool==="text"){this.openInlineTextInput(i.x,i.y,s.clientX,s.clientY);return}this.commitOrCloseActiveTextInput(),this.isDrawing=!0;try{t.setPointerCapture(s.pointerId)}catch{}const n=this.nextShapeId();this.activeTool==="pen"?this.draftShape={id:n,type:"pen",color:this.activeColor,strokeWidth:this.strokeWidth,points:[i]}:this.activeTool==="arrow"?this.draftShape={id:n,type:"arrow",color:this.activeColor,strokeWidth:this.strokeWidth,startX:i.x,startY:i.y,endX:i.x,endY:i.y}:this.activeTool==="box"&&(this.draftShape={id:n,type:"box",color:this.activeColor,strokeWidth:this.strokeWidth,x:i.x,y:i.y,width:0,height:0}),this.renderOverlay()}),t.addEventListener("pointermove",s=>{if(!this.isDrawing||!this.draftShape)return;const i=e(s);this.draftShape.type==="pen"?this.draftShape.points.push(i):this.draftShape.type==="arrow"?(this.draftShape.endX=i.x,this.draftShape.endY=i.y):this.draftShape.type==="box"&&(this.draftShape.width=i.x-this.draftShape.x,this.draftShape.height=i.y-this.draftShape.y),this.renderOverlay()});const a=s=>{if(!this.isDrawing||!this.draftShape)return;this.isDrawing=!1;try{t.hasPointerCapture(s.pointerId)&&t.releasePointerCapture(s.pointerId)}catch{}const i=this.draftShape;if(this.draftShape=null,i.type==="pen"){let n=1/0,r=-1/0,o=1/0,c=-1/0;for(const u of i.points)u.x<n&&(n=u.x),u.x>r&&(r=u.x),u.y<o&&(o=u.y),u.y>c&&(c=u.y);if(Math.hypot(r-n,c-o)<3){this.renderOverlay();return}}else if(i.type==="arrow"){if(Math.hypot(i.endX-i.startX,i.endY-i.startY)<4){this.renderOverlay();return}}else if(i.type==="box"&&Math.abs(i.width)<3&&Math.abs(i.height)<3){this.renderOverlay();return}this.addShape(i)};t.addEventListener("pointerup",a),t.addEventListener("pointercancel",a)}openInlineTextInput(t,e,a,s){if(this.commitOrCloseActiveTextInput(),!this.overlayCanvas||!this.overlayCanvas.parentElement)return;const i=this.overlayCanvas.parentElement,n=i.getBoundingClientRect(),r=document.createElement("input");r.type="text",r.className="annotation-inline-text-input",r.placeholder="Type bug label & press Enter...",r.style.position="absolute",r.style.left=`${Math.max(8,Math.min(n.width-180,a-n.left))}px`,r.style.top=`${Math.max(8,Math.min(n.height-34,s-n.top-14))}px`,r.style.zIndex="50",r.style.background="rgba(9, 13, 22, 0.95)",r.style.color="#FFFFFF",r.style.border=`2px solid ${this.activeColor}`,r.style.borderRadius="6px",r.style.padding="4px 8px",r.style.fontSize="12px",r.style.fontWeight="600",r.style.outline="none",r.style.minWidth="160px",r.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.45)";let o=!1;const c=()=>{if(o)return;o=!0;const l=r.value.trim();r.parentElement&&r.remove(),this.activeTextInputEl===r&&(this.activeTextInputEl=null),l&&this.addTextAnnotation(t,e,l)},u=()=>{o||(o=!0,r.parentElement&&r.remove(),this.activeTextInputEl===r&&(this.activeTextInputEl=null))};r.addEventListener("keydown",l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),c()):l.key==="Escape"&&(l.preventDefault(),u())}),r.addEventListener("blur",()=>{c()}),this.activeTextInputEl=r,i.appendChild(r),requestAnimationFrame(()=>r.focus())}commitOrCloseActiveTextInput(){this.activeTextInputEl&&(this.activeTextInputEl.blur(),this.activeTextInputEl=null)}nextShapeId(){return`ann-${++this.shapeCounter}-${Date.now()}`}notifyHistoryChange(){this.onHistoryChange&&this.onHistoryChange()}}function Bt(d,t,e,a=12){if(!d||d.length===0||t<=0||e<=0)return null;let s=1/0,i=1/0,n=-1/0,r=-1/0;const o=(p,f,m,y,w)=>{const k=Math.min(p,m)-w,b=Math.max(p,m)+w,g=Math.min(f,y)-w,v=Math.max(f,y)+w;k<s&&(s=k),g<i&&(i=g),b>n&&(n=b),v>r&&(r=v)};for(const p of d)if(p.type==="pen"){const f=(p.strokeWidth||3)+4+a;for(const m of p.points)o(m.x,m.y,m.x,m.y,f)}else if(p.type==="arrow"){const f=Math.max(16,(p.strokeWidth||3)*4.5)+a;o(p.startX,p.startY,p.endX,p.endY,f)}else if(p.type==="box"){const f=(p.strokeWidth||3)+4+a;o(p.x,p.y,p.x+p.width,p.y+p.height,f)}else if(p.type==="text"){const f=Math.ceil((p.text||"").length*8.5)+16,m=24,y=Math.max(4,Math.min(t-f-4,p.x)),w=Math.max(4,Math.min(e-m-4,p.y-m/2));o(y,w,y+f,w+m,4+a)}if(!Number.isFinite(s)||!Number.isFinite(i))return null;const c=Math.max(0,Math.floor(s)),u=Math.max(0,Math.floor(i)),l=Math.min(t,Math.ceil(n)),h=Math.min(e,Math.ceil(r));return{x:c,y:u,width:Math.max(1,l-c),height:Math.max(1,h-u)}}function Ct(d,t,e,a){if(!t)return d;const s=Math.max(0,Math.min(d.x,t.x)),i=Math.max(0,Math.min(d.y,t.y)),n=Math.min(e,Math.max(d.x+d.width,t.x+t.width)),r=Math.min(a,Math.max(d.y+d.height,t.y+t.height));return{x:s,y:i,width:Math.max(1,n-s),height:Math.max(1,r-i)}}const G=200,V=15e3;class Tt{container;dvrBuffer;callbacks;iframe=null;currentRunnerId=0;activeMessageHandler=null;paused=!1;muted=!1;focused=!1;running=!1;consoleLogs=[];constructor(t,e,a={}){this.container=t,this.dvrBuffer=e,this.callbacks=a}isRunning(){return this.running}isPaused(){return this.paused}isMuted(){return this.muted}isFocused(){return this.focused}getConsoleLogs(){return[...this.consoleLogs]}clearConsoleLogs(){this.consoleLogs=[]}getGameCanvas(){try{const t=this.iframe?.contentWindow?.document;return t?this.iframe?.contentWindow?.__ACTIVE_GAME_CANVAS__||t.querySelector("canvas"):null}catch{return null}}async launchBuild(t){if(!t||typeof t!="string")throw new Error("[WasmRunner] launchBuild requires a non-empty buildId.");this.destroy(),this.dvrBuffer.clear(),this.clearConsoleLogs(),this.paused=!1,this.callbacks.onStateChange?.("loading"),await this.mountSidecarRunnerIframe({buildId:t})}postToChild(t){this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage({source:"playtest-runner-parent",runnerId:this.currentRunnerId,...t},"*")}mountSidecarRunnerIframe(t){return new Promise((e,a)=>{const s=++this.currentRunnerId;let i=!1;const n=window.setTimeout(()=>{i||(i=!0,this.callbacks.onStateChange?.("error"),a(new Error(`[WasmRunner] Timed out after ${V}ms waiting for sidecar runner iframe (/api/playtest/runner) to initialize.`)))},V),r=p=>{const f=p.data;if(!(!f||f.source!=="playtest-runner-child"||f.runnerId!==s))switch(f.type){case"READY":{this.running=!0,this.callbacks.onStateChange?.("running"),i||(i=!0,window.clearTimeout(n),e());break}case"FRAME":{if(typeof f.dataUrl=="string"&&typeof f.width=="number"&&typeof f.height=="number"&&f.width>0&&f.height>0)try{this.dvrBuffer.recordFrameDataUrl(f.dataUrl,f.width,f.height,f.timestampMs??performance.now()),this.callbacks.onFrameRecorded?.()}catch(m){console.error("[WasmRunner] Frame DVR capture error:",m)}break}case"LOG":{const m=f.level||"log";this.appendLog(m,f.text||"");break}case"PANIC":{const m=f.message||"Unknown Go WASM runtime error";this.appendLog("error",m),this.callbacks.onPanic?.(m,this.getConsoleLogs()),i||(i=!0,window.clearTimeout(n),a(new Error(m)));break}case"TOGGLE_PAUSE":{this.togglePause();break}case"FOCUS_CHANGE":{const m=!!f.focused;this.focused=m,this.callbacks.onFocusChange?.(m);break}}};this.activeMessageHandler=r,window.addEventListener("message",r);const o=W(),c=new URLSearchParams({runnerId:String(s),muted:this.muted?"1":"0",captureIntervalMs:String(this.dvrBuffer.captureIntervalMs),buildId:t.buildId}),u=new URLSearchParams(window.location.search).get("token");u&&c.set("token",u);const l=`${o}/api/playtest/runner?${c.toString()}`,h=document.createElement("iframe");h.className="wasm-runner-iframe",h.setAttribute("title","Ebitengine Playtest Viewport"),h.src=l,this.container.innerHTML="",this.container.appendChild(h),this.iframe=h})}syncDvrFromChild(){try{const t=this.iframe?.contentWindow;if(!t||typeof t.__PLAYTEST_GET_DVR_FRAMES__!="function")return;const e=t.__PLAYTEST_GET_DVR_FRAMES__();if(!Array.isArray(e)||e.length===0)return;this.dvrBuffer.clear();for(let a=0;a<e.length;a++){const s=e[a];s&&s.canvas&&s.width>0&&s.height>0&&this.dvrBuffer.recordCanvasSlot(s.canvas,s.width,s.height,s.timestampMs)}}catch{}}captureImmediateFrame(){this.running&&(this.postToChild({type:"CAPTURE_NOW"}),this.syncDvrFromChild())}setPaused(t){!this.running||this.paused===t||(this.paused=t,this.postToChild({type:"SET_PAUSED",paused:t}),t&&this.syncDvrFromChild(),this.callbacks.onPauseChange?.(t),this.callbacks.onStateChange?.(t?"paused":"running"))}togglePause(){return this.running?(this.setPaused(!this.paused),this.paused):!1}setMuted(t){this.muted=t,this.postToChild({type:"SET_MUTED",muted:t})}toggleMuted(){return this.setMuted(!this.muted),this.muted}focus(){try{this.iframe?.contentWindow?.focus()}catch{}this.postToChild({type:"FOCUS_GAME"})}dispatchVirtualKey(t,e,a){this.postToChild({type:"DISPATCH_KEY",code:t,key:e,keyEventType:a})}destroy(){this.activeMessageHandler&&(window.removeEventListener("message",this.activeMessageHandler),this.activeMessageHandler=null),this.running=!1,this.paused=!1,this.focused=!1,this.iframe&&(this.iframe.src="about:blank",this.iframe.remove(),this.iframe=null),this.container.innerHTML="",this.callbacks.onFocusChange?.(!1)}appendLog(t,e){const s=`[${new Date().toISOString().slice(11,23)}] [${t.toUpperCase()}] ${e}`;this.consoleLogs.push(s),this.consoleLogs.length>G&&this.consoleLogs.splice(0,this.consoleLogs.length-G),this.callbacks.onLog?.(t,s,this.getConsoleLogs())}}class x{static container=null;static getContainer(){return this.container||(this.container=document.createElement("div"),this.container.className="notification-container",document.body.appendChild(this.container)),this.container}static show(t,e="info",a=4e3,s){const i=this.getContainer(),n=document.createElement("div");n.className=`notification-toast toast-${e}`;const r=document.createElement("span");r.className="toast-icon",r.textContent=e==="success"?"✓":e==="error"?"⚠️":"ℹ";const o=document.createElement("div");o.className="toast-message";const c=document.createElement("div");if(c.className="toast-title",c.textContent=t,o.appendChild(c),s){const l=document.createElement("pre");l.className="toast-detail",l.textContent=s,o.appendChild(l)}const u=document.createElement("button");u.className="toast-close",u.textContent="✕",u.title="Dismiss",u.onclick=()=>n.remove(),n.appendChild(r),n.appendChild(o),n.appendChild(u),i.appendChild(n),a>0&&setTimeout(()=>{n.classList.add("toast-fade-out"),setTimeout(()=>n.remove(),280)},a)}static info(t,e=3e3){this.show(t,"info",e)}static success(t,e=3800){this.show(t,"success",e)}static error(t,e){console.error("[Playtest Studio Error]",t,e||""),this.show(t,"error",0,e)}static fatal(t,e,a){console.error("[Playtest Studio FATAL]",t,e,a??"");const s=document.getElementById("fatal-error-overlay");s&&s.remove();const i=document.createElement("div");i.id="fatal-error-overlay",i.className="modal-overlay fatal-overlay",i.setAttribute("role","alertdialog"),i.setAttribute("aria-modal","true");const n=e instanceof Error?`${e.name}: ${e.message}`:String(e),r=e instanceof Error&&e.stack?e.stack:"",o=[a?`[Context] ${a}`:"",n,r&&r!==n?r:""].filter(Boolean).join(`

`);i.innerHTML=`
      <div class="fatal-dialog">
        <div class="fatal-icon">🚨</div>
        <h2 class="fatal-title"></h2>
        <p class="fatal-desc">A critical error occurred in Playtest Studio. Failed fast with full diagnostics:</p>
        <pre class="fatal-pre"></pre>
        <div class="fatal-actions">
          <button type="button" class="btn btn-danger" id="fatal-reload-btn">Reload Studio</button>
          <button type="button" class="btn btn-outline" id="fatal-dismiss-btn">Dismiss (Esc)</button>
        </div>
      </div>
    `;const c=i.querySelector(".fatal-title");c&&(c.textContent=t);const u=i.querySelector(".fatal-pre");u&&(u.textContent=o);const l=()=>{window.removeEventListener("keydown",h),i.remove()},h=p=>{p.key==="Escape"&&(p.preventDefault(),l())};window.addEventListener("keydown",h),i.querySelector("#fatal-reload-btn")?.addEventListener("click",()=>{window.location.reload()}),i.querySelector("#fatal-dismiss-btn")?.addEventListener("click",l),document.body.appendChild(i)}}class Mt{headerEl;annotationBarEl;viewportEl;bugBarEl;dvrBuffer;annotator;runner;activePkg=".";activeDvrIndex=0;keypadVisible=!1;logsDrawerVisible=!1;isBuilding=!1;lastBuildFailure=null;runnerMountEl;annotationStageEl;readyStateEl;errorStateEl;gameStageEl;focusPillEl;keypadOverlayEl;logsDrawerEl;constructor(t){this.headerEl=t.headerEl,this.annotationBarEl=t.annotationBarEl,this.viewportEl=t.viewportEl,this.bugBarEl=t.bugBarEl,this.dvrBuffer=new gt(250,40),this.renderHeader(),this.renderAnnotationBar(),this.renderViewport(),this.renderBugReportBar();const e=this.viewportEl.querySelector("#annotation-base-canvas"),a=this.viewportEl.querySelector("#annotation-overlay-canvas");this.annotator=new xt({baseCanvas:e,overlayCanvas:a,width:640,height:360,onHistoryChange:()=>this.updateAnnotationControlsUI()}),this.runner=new Tt(this.runnerMountEl,this.dvrBuffer,{onFrameRecorded:()=>{if(this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.runner.isPaused()&&this.annotator.getShapes().length===0){const s=this.dvrBuffer.getLatestFrame();s&&this.annotator.loadBaseFrameDataUrl(s.dataUrl,s.width,s.height)}},onPauseChange:s=>{this.handlePauseStateChanged(s)},onFocusChange:s=>{this.updateFocusPillUI(s)},onLog:(s,i,n)=>{this.updateLogsUI(n)},onPanic:(s,i)=>{this.updateLogsUI(i),this.showRuntimePanicView(s)}}),this.bindEvents(),this.syncSessionAndWorkspaceFromServer()}async applyWorkspaceUri(t){if(!t||!t.trim())return!1;try{const e=await ht(t),a=e.projectPath||e.workspace;return a&&U(a),this.activePkg=".",this.updateHeaderInputsUI(),!!e.hasGoMod}catch(e){return console.warn("[PlaytestStudioUI] Failed to resolve workspace URI:",e),!1}}async syncSessionAndWorkspaceFromServer(){let t=!!new URLSearchParams(window.location.search).get("workspace")?.trim();if(window.sidecar?.conversationId&&!A())try{D(window.sidecar.conversationId)}catch{}window.sidecar&&typeof window.sidecar.onWorkspaceChange=="function"&&window.sidecar.onWorkspaceChange(e=>{Array.isArray(e)&&e.length>0&&e[0]&&this.applyWorkspaceUri(e[0])});try{const e=await ut();if(e.activeSessionId&&!A()&&D(e.activeSessionId),e.defaultWorkspace){const a=await this.applyWorkspaceUri(e.defaultWorkspace);t=t||a}this.updateHeaderInputsUI(),this.updateSessionBadgeUI()}catch(e){console.warn("[PlaytestStudioUI] Sidecar health check skipped or unavailable:",e)}if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const e=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(a=>setTimeout(()=>a([]),1200))]);if(Array.isArray(e)&&e.length>0&&e[0]){const a=await this.applyWorkspaceUri(e[0]);t=t||a}}catch(e){console.warn("[PlaytestStudioUI] getWorkspaceUris skipped:",e)}t&&T().trim()&&!this.isBuilding&&!this.runner.isRunning()&&this.handleBuildAndRun()}renderHeader(){const t=T();this.headerEl.innerHTML=`
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
            type="text"
            id="workspace-input"
            class="input-text workspace-path-input"
            placeholder="Go project path (e.g. /path/to/game)"
            value="${this.escapeAttr(t)}"
            aria-label="Go project or package directory path"
            title="Go Project or Package Directory Path"
          />
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
          data-tooltip="Open Full Playtest Studio in Browser Tab"
          title="Open Full Playtest Studio in Browser Tab"
          aria-label="Open Full Playtest Studio in Browser Tab"
        >
          <span>↗️</span>
        </a>
      </div>
    `,this.updateSessionBadgeUI()}renderAnnotationBar(){const t=it.map((e,a)=>`
        <button
          type="button"
          class="qa-color-swatch ${a===0?"active":""}"
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
    `}renderViewport(){const t=T();this.viewportEl.innerHTML=`
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
              <input
                type="text"
                id="ready-workspace-input"
                class="input-text"
                placeholder="/path/to/ebitengine-game or /path/to/repo/cmd/game"
                value="${this.escapeAttr(t)}"
              />
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
    `}bindEvents(){const t=this.headerEl.querySelector("#workspace-input"),e=this.viewportEl.querySelector("#ready-workspace-input"),a=l=>{U(l),t.value!==l&&(t.value=l),e.value!==l&&(e.value=l)};t.addEventListener("change",()=>a(t.value)),t.addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),a(t.value),this.handleBuildAndRun())}),e.addEventListener("input",()=>a(e.value)),e.addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),a(e.value),this.handleBuildAndRun())}),dt(()=>this.updateHeaderInputsUI()),ot(()=>this.updateSessionBadgeUI()),this.headerEl.querySelector("#btn-build-run")?.addEventListener("click",()=>{a(t.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-ready-build")?.addEventListener("click",()=>{a(e.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-retry-build")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-send-build-error")?.addEventListener("click",()=>{this.handleSendBuildErrorToChat()}),this.headerEl.querySelector("#btn-pause-toggle")?.addEventListener("click",()=>{this.runner.togglePause()}),this.headerEl.querySelector("#btn-home-ready")?.addEventListener("click",()=>{this.showReadyStateView()}),this.headerEl.querySelector("#btn-keypad-toggle")?.addEventListener("click",()=>{this.keypadVisible=!this.keypadVisible,this.keypadOverlayEl.classList.toggle("hidden",!this.keypadVisible),this.headerEl.querySelector("#btn-keypad-toggle")?.classList.toggle("active",this.keypadVisible)}),this.headerEl.querySelector("#btn-mute-toggle")?.addEventListener("click",()=>{const l=this.runner.toggleMuted(),h=this.headerEl.querySelector("#mute-btn-label"),p=this.headerEl.querySelector("#btn-mute-toggle");if(h&&(h.textContent=l?"🔇":"🔊"),p){const f=l?"Unmute Game Audio (Muted)":"Mute Game Audio";p.setAttribute("data-tooltip",f),p.setAttribute("title",f)}}),this.headerEl.querySelector("#btn-logs-toggle")?.addEventListener("click",()=>{this.logsDrawerVisible=!this.logsDrawerVisible,this.logsDrawerEl.classList.toggle("hidden",!this.logsDrawerVisible),this.headerEl.querySelector("#btn-logs-toggle")?.classList.toggle("active",this.logsDrawerVisible)}),this.viewportEl.querySelector("#btn-close-logs")?.addEventListener("click",()=>{this.logsDrawerVisible=!1,this.logsDrawerEl.classList.add("hidden"),this.headerEl.querySelector("#btn-logs-toggle")?.classList.remove("active")}),this.viewportEl.querySelector("#btn-clear-logs")?.addEventListener("click",()=>{this.runner.clearConsoleLogs(),this.updateLogsUI([])}),this.headerEl.querySelector("#btn-session-badge")?.addEventListener("click",()=>{this.openSessionSwitcherModal()}),this.focusPillEl.addEventListener("click",()=>{this.runner.isPaused()||this.runner.focus()}),this.keypadOverlayEl.querySelectorAll(".keypad-btn").forEach(l=>{const h=l,p=h.dataset.code||"Space",f=h.dataset.key||" ",m=w=>{w.preventDefault(),h.classList.add("pressed"),this.runner.dispatchVirtualKey(p,f,"keydown")},y=w=>{w.preventDefault(),h.classList.contains("pressed")&&(h.classList.remove("pressed"),this.runner.dispatchVirtualKey(p,f,"keyup"))};h.addEventListener("pointerdown",m),h.addEventListener("pointerup",y),h.addEventListener("pointerleave",y),h.addEventListener("pointercancel",y)}),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(l=>{l.addEventListener("click",()=>{const h=l.dataset.tool;h&&this.selectAnnotationTool(h)})});const n=this.annotationBarEl.querySelectorAll(".qa-color-swatch");n.forEach(l=>{l.addEventListener("click",()=>{const h=l.dataset.color;h&&(this.annotator.setColor(h),n.forEach(p=>p.classList.remove("active")),l.classList.add("active"))})}),this.annotationBarEl.querySelector("#btn-ann-undo")?.addEventListener("click",()=>{this.annotator.undo()}),this.annotationBarEl.querySelector("#btn-ann-redo")?.addEventListener("click",()=>{this.annotator.redo()}),this.annotationBarEl.querySelector("#btn-ann-clear")?.addEventListener("click",()=>{this.annotator.clearAnnotations()});const r=this.annotationBarEl.querySelector("#dvr-scrubber-slider");r.addEventListener("input",()=>{const l=Number.parseInt(r.value,10);this.scrubToDvrFrame(l)}),this.annotationBarEl.querySelector("#btn-dvr-prev")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.max(0,this.activeDvrIndex-1);this.scrubToDvrFrame(l)}}),this.annotationBarEl.querySelector("#btn-dvr-next")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1);this.scrubToDvrFrame(l)}});const o=this.bugBarEl.querySelector("#btn-toggle-attach-logs"),c=this.bugBarEl.querySelector("#include-logs-checkbox");o?.addEventListener("click",()=>{const l=c?!c.checked:!1;c&&(c.checked=l),o.classList.toggle("active",l),o.setAttribute("aria-pressed",String(l));const h=l?"Attach WASM Console Logs (ON)":"Attach WASM Console Logs (OFF)";o.setAttribute("data-tooltip",h),o.setAttribute("title",h)}),this.bugBarEl.querySelector("#bug-note-input").addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),this.handleSendBugToChat())}),this.bugBarEl.querySelector("#btn-send-bug-chat")?.addEventListener("click",()=>{this.handleSendBugToChat()}),this.bugBarEl.querySelector("#btn-send-gif-chat")?.addEventListener("click",()=>{this.handleSendGifToChat()}),window.addEventListener("keydown",l=>{const h=l.target,p=h&&(h.tagName==="INPUT"||h.tagName==="TEXTAREA"||h.isContentEditable);if(l.code==="F8"||!p&&l.code==="Backquote"){this.runner.isRunning()&&(l.preventDefault(),l.stopPropagation(),this.runner.togglePause());return}if(!(p||!this.runner.isPaused())){if((l.metaKey||l.ctrlKey)&&l.key.toLowerCase()==="z"){l.preventDefault(),l.shiftKey?this.annotator.redo():this.annotator.undo();return}l.code==="KeyP"?(l.preventDefault(),this.selectAnnotationTool("pen")):l.code==="KeyA"?(l.preventDefault(),this.selectAnnotationTool("arrow")):l.code==="KeyB"?(l.preventDefault(),this.selectAnnotationTool("box")):l.code==="KeyT"?(l.preventDefault(),this.selectAnnotationTool("text")):l.code==="ArrowLeft"?(l.preventDefault(),this.scrubToDvrFrame(Math.max(0,this.activeDvrIndex-1))):l.code==="ArrowRight"&&(l.preventDefault(),this.scrubToDvrFrame(Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1)))}},{capture:!0})}async handleBuildAndRun(){if(this.isBuilding)return;const t=T().trim();if(!t){x.error("Missing Go Workspace Path","Enter the path to your Ebitengine Go workspace in the header bar before building.");return}this.isBuilding=!0,this.lastBuildFailure=null,this.setBuildButtonsLoading(!0);try{x.info(`Compiling Go WASM in "${t}"...`,2500);const e=await ft({workspace:t});if(!e.ok){this.lastBuildFailure=e,this.showBuildErrorView(e),x.error("Go WASM Compilation Failed (HTTP 422)",e.compilerOutput.slice(0,240));return}this.activePkg=e.pkg||".",this.showActiveGameStage(),await this.runner.launchBuild(e.buildId);const a=this.headerEl.querySelector("#btn-pause-toggle");a&&(a.disabled=!1);const s=(e.wasmBytes/(1024*1024)).toFixed(2);x.success(`Built & launched ${e.pkg} (${s} MB WASM in ${e.durationMs}ms)`),this.runner.focus()}catch(e){x.error("WASM Build / Launch Error",e?.message||String(e))}finally{this.isBuilding=!1,this.setBuildButtonsLoading(!1)}}handlePauseStateChanged(t){const e=this.headerEl.querySelector("#btn-pause-toggle"),a=this.headerEl.querySelector("#pause-btn-label");if(t){e&&(e.classList.add("btn-warning-active"),e.setAttribute("data-tooltip","Resume Gameplay (` or F8)"),e.setAttribute("title","Resume Gameplay (` or F8)")),a&&(a.textContent="▶️ Resume"),this.annotationBarEl.classList.remove("hidden"),this.annotationStageEl.classList.remove("hidden");const s=this.runner.getGameCanvas();if(s&&s.width>0&&s.height>0)this.annotator.loadBaseFromCanvas(s);else{const i=this.dvrBuffer.getLatestFrame();i&&this.annotator.loadBaseFrameDataUrl(i.dataUrl,i.width,i.height)}this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.updateFocusPillUI(!1)}else e&&(e.classList.remove("btn-warning-active"),e.setAttribute("data-tooltip","Freeze Frame & Annotate Bug (` or F8)"),e.setAttribute("title","Freeze Frame & Annotate Bug (` or F8)")),a&&(a.textContent="⏸️ Pause"),this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.runner.focus()}async scrubToDvrFrame(t){const e=this.dvrBuffer.getFrameAt(t);e&&(this.activeDvrIndex=e.index,this.updateDvrScrubberUI(),e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}updateDvrScrubberUI(){const t=this.annotationBarEl.querySelector("#dvr-scrubber-slider"),e=this.annotationBarEl.querySelector("#dvr-frame-badge"),a=this.annotationBarEl.querySelector("#btn-dvr-prev"),s=this.annotationBarEl.querySelector("#btn-dvr-next"),i=this.dvrBuffer.length;if(i===0){t&&(t.min="0",t.max="0",t.value="0",t.disabled=!0),e&&(e.textContent="0.0s",e.setAttribute("data-tooltip","Live (0.0s)"),e.setAttribute("title","Live (0.0s)")),a&&(a.disabled=!0),s&&(s.disabled=!0);return}const n=Math.max(0,Math.min(i-1,this.activeDvrIndex)),r=this.dvrBuffer.getFrameAt(n);if(t&&(t.disabled=!1,t.min="0",t.max=String(i-1),t.value=String(n)),a&&(a.disabled=n<=0),s&&(s.disabled=n>=i-1),e&&r){const o=r.relativeSec===0?"0.0s":`${r.relativeSec.toFixed(1)}s`,c=r.relativeSec===0?`Live (0.0s) · Frame ${n+1}/${i}`:`${r.relativeSec.toFixed(2)}s · Frame ${n+1}/${i}`;e.textContent=o,e.setAttribute("data-tooltip",c),e.setAttribute("title",c)}}selectAnnotationTool(t){this.annotator.setTool(t),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(a=>{const s=a.dataset.tool;a.classList.toggle("active",s===t)})}updateAnnotationControlsUI(){const t=this.annotationBarEl.querySelector("#btn-ann-undo"),e=this.annotationBarEl.querySelector("#btn-ann-redo"),a=this.annotationBarEl.querySelector("#btn-ann-clear");t&&(t.disabled=!this.annotator.canUndo()),e&&(e.disabled=!this.annotator.canRedo()),a&&(a.disabled=this.annotator.getShapes().length===0)}updateFocusPillUI(t){if(this.focusPillEl){if(this.runner.isPaused()){this.focusPillEl.className="focus-status-pill paused",this.focusPillEl.innerHTML="<span>⏸ Paused: Draw on Frame or Scrub 10s DVR</span>";return}t?(this.focusPillEl.className="focus-status-pill focused",this.focusPillEl.innerHTML="<span>● Controls Active (` or F8 to Pause)</span>"):(this.focusPillEl.className="focus-status-pill unfocused",this.focusPillEl.innerHTML="<span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>")}}updateLogsUI(t){const e=this.headerEl.querySelector("#logs-count-badge");e&&(e.textContent=String(t.length));const a=this.viewportEl.querySelector("#logs-drawer-content");a&&(a.textContent=t.length>0?t.join(`
`):"No WASM console output recorded yet.",a.scrollTop=a.scrollHeight)}showReadyStateView(){this.runner.destroy(),this.lastBuildFailure=null,this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.readyStateEl.classList.remove("hidden");const t=this.headerEl.querySelector("#btn-pause-toggle"),e=this.headerEl.querySelector("#pause-btn-label");t&&(t.disabled=!0,t.classList.remove("btn-warning-active")),e&&(e.textContent="⏸️ Pause"),this.updateHeaderInputsUI()}showActiveGameStage(){this.readyStateEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.gameStageEl.classList.remove("hidden")}showBuildErrorView(t){this.runner.destroy(),this.annotationBarEl.classList.add("hidden"),this.readyStateEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.remove("hidden");const e=this.viewportEl.querySelector("#error-state-title"),a=this.viewportEl.querySelector("#error-state-meta"),s=this.viewportEl.querySelector("#error-state-traceback");e&&(e.textContent=t.error||"Go WASM Compilation Failed"),a&&(a.textContent=`Workspace: ${t.workspace} | Package: ${t.pkg} | Exit Code: ${t.exitCode}`),s&&(s.textContent=t.compilerOutput)}showRuntimePanicView(t){const e=T()||".";this.lastBuildFailure={ok:!1,status:422,error:"Go WASM Runtime Panic",compilerOutput:[t,"",...this.runner.getConsoleLogs().slice(-30)].join(`
`),workspace:e,pkg:this.activePkg,exitCode:2},this.showBuildErrorView(this.lastBuildFailure)}async handleSendBuildErrorToChat(){if(!this.lastBuildFailure)return;const t=this.viewportEl.querySelector("#btn-send-build-error");t&&(t.disabled=!0);try{const a=this.bugBarEl.querySelector("#bug-note-input")?.value.trim()||"";await mt({buildError:this.lastBuildFailure.compilerOutput,note:a,workspace:this.lastBuildFailure.workspace,pkg:this.lastBuildFailure.pkg}),x.success("Sent Go WASM compiler traceback directly to Antigravity chat!")}catch(e){x.error("Failed to send build error to chat",e?.message||String(e))}finally{t&&(t.disabled=!1)}}async ensurePausedFrameLoaded(){if(this.runner.isRunning()&&!this.runner.isPaused()?this.runner.setPaused(!0):this.dvrBuffer.length===0&&(this.runner.syncDvrFromChild(),this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI()),!this.annotator.hasFrozenFrame()){const t=this.runner.getGameCanvas();if(t&&t.width>0&&t.height>0)this.annotator.loadBaseFromCanvas(t);else{const e=this.dvrBuffer.getLatestFrame();e&&(e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}}}decodeDataUrlToImage(t){return new Promise((e,a)=>{const s=new Image;s.onload=()=>e(s),s.onerror=()=>a(new Error("Failed to decode frame dataUrl into HTMLImageElement.")),s.src=t})}async buildDvrAnimatedGifDataUrl(){await this.ensurePausedFrameLoaded();const t=this.dvrBuffer.getFrames(),e=t.length>0?Math.max(0,Math.min(t.length-1,this.activeDvrIndex)):0,a=t.length>0?t.slice(0,e+1):[],s=this.annotator.getDimensions(),i=a[0]?.width||s.width||640,n=a[0]?.height||s.height||360;let r={x:0,y:0,width:i,height:n};const o=a[a.length-1]||a[0];if(o){const b=document.createElement("canvas");b.width=i,b.height=n;const g=b.getContext("2d",{willReadFrequently:!0});if(g){if(g.clearRect(0,0,i,n),o.canvas)g.drawImage(o.canvas,0,0,i,n);else if(o.dataUrl){const S=await this.decodeDataUrlToImage(o.dataUrl);g.drawImage(S,0,0,i,n)}const v=g.getImageData(0,0,i,n);r=H(v.data,i,n)}}const c=480,u=r.width>c?c/r.width:1,l=Math.max(64,Math.round(r.width*u)),h=Math.max(36,Math.round(r.height*u)),p=document.createElement("canvas");p.width=l,p.height=h;const f=p.getContext("2d",{willReadFrequently:!0});if(!f)throw new Error("Failed to acquire 2D context for GIF encoding.");f.imageSmoothingEnabled=!1;const m=[];for(let b=0;b<a.length;b++){const g=a[b];if(f.fillStyle="#090D16",f.fillRect(0,0,l,h),g.canvas)f.drawImage(g.canvas,r.x,r.y,r.width,r.height,0,0,l,h);else{const B=await this.decodeDataUrlToImage(g.dataUrl);f.drawImage(B,r.x,r.y,r.width,r.height,0,0,l,h)}const v=f.getImageData(0,0,l,h),S=b===a.length-1;let E=this.dvrBuffer.captureIntervalMs;if(b+1<a.length){const B=a[b+1].timestampMs-g.timestampMs;Number.isFinite(B)&&B>=15&&B<=250&&(E=Math.round(B))}m.push({rgba:new Uint8Array(v.data),delayMs:S?900:E})}if(m.length===0){const b=this.runner.getGameCanvas();if(f.fillStyle="#090D16",f.fillRect(0,0,l,h),b&&b.width>0&&b.height>0){const v=b.getContext("2d");if(v){const S=v.getImageData(0,0,b.width,b.height);r=H(S.data,b.width,b.height)}f.drawImage(b,r.x,r.y,r.width,r.height,0,0,l,h)}const g=f.getImageData(0,0,l,h);m.push({rgba:new Uint8Array(g.data),delayMs:900})}const y=wt({width:l,height:h,frames:m}),w=a.length>=2?(a[a.length-1].timestampMs-a[0].timestampMs)/1e3:a.length*this.dvrBuffer.captureIntervalMs/1e3,k=Number(Math.max(.04,w).toFixed(2));return{dataUrl:kt(y),width:l,height:h,frameCount:m.length,durationSec:k}}async handleSendGifToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}const t=this.bugBarEl.querySelector("#btn-send-gif-chat"),e=this.bugBarEl.querySelector("#btn-send-bug-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{x.info("Encoding 10s DVR replay (25 FPS) into animated GIF...",2400);const a=await this.buildDvrAnimatedGifDataUrl(),s=this.bugBarEl.querySelector("#bug-note-input"),i=this.bugBarEl.querySelector("#include-logs-checkbox"),n=s?.value.trim()||"",o=(i?i.checked:!0)?this.runner.getConsoleLogs():[],c=this.dvrBuffer.getFrameAt(this.activeDvrIndex),u=c?c.relativeSec===0?"live (0.0s)":`${c.relativeSec.toFixed(2)}s`:"live",l=`playtest-clip-${Date.now()}.gif`,h=await O({filename:l,imageDataUrl:a.dataUrl,note:n,consoleLogs:o,workspace:T()||".",pkg:this.activePkg,frameOffset:`${a.frameCount}f (${a.durationSec}s DVR → ${u})`,resolution:`${a.width}x${a.height}`,width:a.width,height:a.height});x.success(`Delivered 10s DVR GIF "${h.filename||l}" (${a.frameCount} frames) to chat!`),s&&(s.value="")}catch(a){x.error("Failed to encode or send 10s DVR GIF",a?.message||String(a))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}async handleSendBugToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}await this.ensurePausedFrameLoaded();const t=this.bugBarEl.querySelector("#btn-send-bug-chat"),e=this.bugBarEl.querySelector("#btn-send-gif-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{const a=this.bugBarEl.querySelector("#bug-note-input"),s=this.bugBarEl.querySelector("#include-logs-checkbox"),i=a?.value.trim()||"",r=(s?s.checked:!0)?this.runner.getConsoleLogs():[],o=this.annotator.exportSmartComposite(),c=this.dvrBuffer.getFrameAt(this.activeDvrIndex),u=c?c.relativeSec===0?"live (0.0s)":`${c.relativeSec.toFixed(2)}s`:"live",l=`playtest-bug-${Date.now()}.png`,h=await O({filename:l,imageDataUrl:o.dataUrl,note:i,consoleLogs:r,workspace:T()||".",pkg:this.activePkg,frameOffset:u,resolution:`${o.width}x${o.height}`,width:o.width,height:o.height});x.success(`Delivered "${h.filename||l}" to Antigravity chat!`),a&&(a.value="")}catch(a){x.error("Failed to send bug report to chat",a?.message||String(a))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}setBuildButtonsLoading(t){const e=this.headerEl.querySelector("#btn-build-run"),a=this.headerEl.querySelector("#build-btn-label"),s=this.viewportEl.querySelector("#btn-ready-build");e&&(e.disabled=t),s&&(s.disabled=t,s.innerHTML=t?"<span>⏳ Compiling &amp; Launching WASM...</span>":"<span>▶ Compile &amp; Launch Ebitengine WASM</span>"),a&&(a.textContent=t?"⏳ Building...":"🚀 Run")}updateHeaderInputsUI(){const t=T(),e=this.headerEl.querySelector("#workspace-input"),a=this.viewportEl.querySelector("#ready-workspace-input");e&&e.value!==t&&(e.value=t),a&&a.value!==t&&(a.value=t);const s=this.headerEl.querySelector("#btn-full-studio");s&&(s.href=N())}updateSessionBadgeUI(){const t=A(),e=this.headerEl.querySelector("#btn-session-badge"),a=this.headerEl.querySelector("#btn-full-studio");if(e){const s=e.querySelector(".status-dot"),i=e.querySelector("#session-badge-text");if(t&&t!=="standalone"){e.className="session-badge connected",s&&(s.className="status-dot online"),i&&(i.textContent=`${t.slice(0,8)}...`);const n=`Session: ${t.slice(0,8)}... (Click to switch)`;e.setAttribute("data-tooltip",n),e.setAttribute("title",n)}else{e.className="session-badge disconnected",s&&(s.className="status-dot offline"),i&&(i.textContent="Standalone");const n="Session: Standalone (Click to connect)";e.setAttribute("data-tooltip",n),e.setAttribute("title",n)}}a&&(a.href=N())}async openSessionSwitcherModal(){const t=document.getElementById("session-switcher-modal");t&&t.remove();const e=document.createElement("div");e.id="session-switcher-modal",e.className="modal-overlay",e.innerHTML=`
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
              value="${this.escapeAttr(A()||"")}"
            />
            <button type="button" id="btn-apply-session" class="btn btn-primary btn-sm">Connect</button>
          </div>
          <div id="recent-sessions-list" class="recent-sessions-list">
            <div class="session-loading">Loading recent Antigravity sessions...</div>
          </div>
        </div>
      </div>
    `;const a=()=>e.remove();e.querySelector("#session-modal-close")?.addEventListener("click",a),e.addEventListener("click",i=>{i.target===e&&a()}),e.querySelector("#btn-apply-session")?.addEventListener("click",()=>{const n=e.querySelector("#manual-session-input").value.trim();if(n)try{D(n),x.success(`Connected to session ${n}`),a()}catch(r){x.error("Invalid Session ID",r?.message||String(r))}}),document.body.appendChild(e);const s=e.querySelector("#recent-sessions-list");try{const i=await pt();if(i.length===0){s.innerHTML='<div class="session-empty">No recent sessions found.</div>';return}s.innerHTML=i.map(n=>`
          <button type="button" class="session-item-btn" data-sid="${this.escapeAttr(n.id)}">
            <span class="session-item-id">${this.escapeHtml(n.id)}</span>
            <span class="session-item-time">${this.escapeHtml(new Date(n.updatedAt).toLocaleTimeString())}</span>
          </button>
        `).join(""),s.querySelectorAll(".session-item-btn").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.sid;r&&(D(r),x.success(`Connected to session ${r.slice(0,8)}...`),a())})})}catch(i){s.innerHTML=`<div class="session-empty">Failed to load sessions: ${this.escapeHtml(i?.message||String(i))}</div>`}}escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}escapeAttr(t){return this.escapeHtml(t).replace(/'/g,"&#39;")}}const j=[{id:"arcade_laser",label:"Laser",fileName:"laser_arcade.sfx"},{id:"plasma_gun",label:"Plasma",fileName:"plasma_gun.sfx"},{id:"explosion_arcade",label:"8-Bit Boom",fileName:"explosion_arcade.sfx"},{id:"explosion_deep",label:"Deep Boom",fileName:"explosion_deep.sfx"},{id:"jump_arcade",label:"Jump",fileName:"jump_arcade.sfx"},{id:"jump_spring",label:"Spring",fileName:"jump_spring.sfx"},{id:"coin_pickup",label:"Coin",fileName:"coin_pickup.sfx"},{id:"gem_shimmer",label:"Gem",fileName:"gem_shimmer.sfx"},{id:"sword_clash",label:"Sword",fileName:"sword_clash.sfx"},{id:"shield_deflect",label:"Shield",fileName:"shield_deflect.sfx"},{id:"hit_punch",label:"Punch",fileName:"hit_punch.sfx"},{id:"hit_damage",label:"Damage",fileName:"hit_damage.sfx"},{id:"powerup_fanfare",label:"Fanfare",fileName:"powerup_fanfare.sfx"},{id:"ui_select",label:"Menu Tick",fileName:"ui_select.sfx"},{id:"ui_confirm",label:"Confirm",fileName:"ui_confirm.sfx"},{id:"ui_error",label:"Error",fileName:"ui_error.sfx"},{id:"footstep_stone",label:"Footstep",fileName:"footstep_stone.sfx"},{id:"engine_thruster",label:"Thruster",fileName:"engine_thruster.sfx"}],Lt=[{id:"square",label:"Square"},{id:"sawtooth",label:"Saw"},{id:"triangle",label:"Triangle"},{id:"sine",label:"Sine"},{id:"fm",label:"Metallic FM"},{id:"psg_noise",label:"8-Bit Noise"}],X=[{id:"ym2612_guitar",label:"FM Lead Guitar",dslWave:"wave=ym2612_guitar gm=overdriven_guitar"},{id:"ym2612_rhythm_guitar",label:"FM Rhythm Guitar",dslWave:"wave=ym2612_rhythm_guitar gm=distortion_guitar"},{id:"ym2612_brass",label:"FM Synth Brass",dslWave:"wave=ym2612_brass gm=synth_brass_1"},{id:"ym2612_epiano",label:"FM Electric Piano",dslWave:"wave=ym2612_epiano gm=epiano1"},{id:"ym2612_bell",label:"FM Crystal Bell",dslWave:"wave=ym2612_bell gm=vibraphone"},{id:"ym2612_strings",label:"FM Strings Pad",dslWave:"wave=ym2612_strings gm=string_ensemble_1"},{id:"ym2612_choir",label:"FM Choir Pad",dslWave:"wave=ym2612_choir gm=choir_aahs"},{id:"ym2612_flute",label:"FM Flute",dslWave:"wave=ym2612_flute gm=flute"},{id:"ym2612_bass",label:"FM Synth Bass",dslWave:"wave=ym2612_bass gm=electric_bass"},{id:"ym2612_slap_bass",label:"FM Slap Bass",dslWave:"wave=ym2612_slap_bass gm=slap_bass_1"},{id:"sub_bass",label:"Deep Sub Bass",dslWave:"wave=sub_bass gm=synth_bass_2"},{id:"psg_square",label:"PSG Chiptune Square",dslWave:"wave=psg_square gm=lead_square"},{id:"psg_arp",label:"PSG Fast Arpeggio",dslWave:"wave=psg_arp gm=clavinet"},{id:"square",label:"Square Lead",dslWave:"wave=square duty=0.25 gm=lead_square"},{id:"pulse",label:"Pulse Lead",dslWave:"wave=pulse duty=0.25 gm=lead_square"},{id:"sawtooth",label:"Sawtooth Lead",dslWave:"wave=sawtooth gm=lead_sawtooth"},{id:"triangle",label:"Warm Triangle",dslWave:"wave=triangle gm=ocarina"},{id:"sine",label:"Pure Sine",dslWave:"wave=sine gm=ocarina"},{id:"fm",label:"2-Op FM Synth",dslWave:"wave=fm gm=epiano2"},{id:"piano",label:"Grand Piano",dslWave:"wave=piano gm=acoustic_grand_piano"},{id:"epiano",label:"Rhodes E-Piano",dslWave:"wave=epiano gm=epiano1"},{id:"organ",label:"Pipe / Rock Organ",dslWave:"wave=organ gm=church_organ"},{id:"guitar",label:"Acoustic Guitar",dslWave:"wave=guitar gm=acoustic_guitar"},{id:"harp",label:"Orchestral Harp",dslWave:"wave=harp gm=orchestral_harp"},{id:"violin",label:"Solo Violin",dslWave:"wave=violin gm=violin"},{id:"cello",label:"Solo Cello",dslWave:"wave=cello gm=cello"},{id:"strings",label:"String Ensemble",dslWave:"wave=strings gm=string_ensemble_1"},{id:"voice",label:"Choir Voice",dslWave:"wave=voice gm=choir_aahs"},{id:"flute",label:"Concert Flute",dslWave:"wave=flute gm=flute"},{id:"oboe",label:"Oboe",dslWave:"wave=oboe gm=oboe"},{id:"clarinet",label:"Clarinet",dslWave:"wave=clarinet gm=clarinet"},{id:"shakuhachi",label:"Shakuhachi",dslWave:"wave=shakuhachi gm=shakuhachi"},{id:"brass",label:"Brass Section",dslWave:"wave=brass gm=brass_section"},{id:"trumpet",label:"Trumpet",dslWave:"wave=trumpet gm=trumpet"},{id:"horn",label:"French Horn",dslWave:"wave=horn gm=french_horn"},{id:"koto",label:"Koto",dslWave:"wave=koto gm=koto"},{id:"shamisen",label:"Shamisen",dslWave:"wave=shamisen gm=shamisen"},{id:"bell",label:"Tubular Bell",dslWave:"wave=bell gm=tubular_bells"}],Y={larghissimo:24,grave:42,largo:50,lento:56,larghetto:63,adagio:70,adagietto:76,marcia_moderato:84,andante:88,andantino:96,moderato:112,allegretto:120,allegro_moderato:124,allegro:138,vivace:160,vivacissimo:172,allegrissimo:176,presto:188,prestissimo:208},F=new Set(["noise","kick","snare","tom","hat","open_hat","crash","ym2612_kick","ym2612_snare","ym2612_tom","ym2612_hat","ym2612_open_hat","ym2612_crash"]);function Ft(d){const t=(d||"").trim().toLowerCase();switch(t){case"sine":case"sin":return"sine";case"square":case"sq":return"square";case"pulse":return"pulse";case"triangle":case"tri":return"triangle";case"sawtooth":case"saw":return"sawtooth";case"noise":case"white_noise":return"noise";case"fm":case"fm2":return"fm";case"piano":case"grand_piano":return"piano";case"epiano":case"rhodes":return"epiano";case"organ":case"pipe_organ":case"church_organ":return"organ";case"guitar":case"acoustic_guitar":return"guitar";case"harp":case"pluck":return"harp";case"violin":return"violin";case"cello":return"cello";case"strings":case"ensemble":return"strings";case"voice":case"choir":case"vocal":return"voice";case"flute":return"flute";case"oboe":return"oboe";case"clarinet":return"clarinet";case"shakuhachi":return"shakuhachi";case"brass":case"brass_ensemble":return"brass";case"trumpet":return"trumpet";case"horn":case"french_horn":return"horn";case"koto":return"koto";case"shamisen":return"shamisen";case"bell":case"chime":return"bell";case"ym2612_guitar":case"overdriven_guitar":case"distortion_guitar":case"electric_guitar":case"fm_guitar":return"ym2612_guitar";case"ym2612_rhythm_guitar":case"rhythm_guitar":case"power_guitar":case"muted_guitar":return"ym2612_rhythm_guitar";case"ym2612_bass":case"synth_bass":case"fm_bass":case"bass":return"ym2612_bass";case"ym2612_slap_bass":case"slap_bass":return"ym2612_slap_bass";case"sub_bass":return"sub_bass";case"ym2612_brass":case"fm_brass":case"synth_brass":case"polysynth":return"ym2612_brass";case"ym2612_epiano":case"fm_epiano":case"dx7":return"ym2612_epiano";case"ym2612_strings":case"fm_strings":case"synth_strings":return"ym2612_strings";case"ym2612_choir":case"fm_choir":case"ym2612_voice":return"ym2612_choir";case"ym2612_flute":case"fm_flute":return"ym2612_flute";case"ym2612_bell":case"fm_bell":return"ym2612_bell";case"psg_square":case"psg_pulse":case"sn76489":return"psg_square";case"psg_arp":return"psg_arp";default:return t||"ym2612_brass"}}function K(d){const t=(d||"").trim().toLowerCase();return t==="pulse"||t==="sq"||t==="square"||t==="psg_square"?"square":t==="saw"||t==="sawtooth"?"sawtooth":t==="tri"||t==="triangle"?"triangle":t==="sin"||t==="sine"?"sine":t==="fm"||t==="fm2"?"fm":t==="noise"||t==="psg_noise"||t==="lfsr"||t==="white_noise"?"psg_noise":"square"}function J(d){const t=d.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);if(!t)return null;let a={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[t[1].toUpperCase()];if(a===void 0)return null;t[2]==="#"?a+=1:t[2]==="b"&&(a-=1);const i=(parseInt(t[3],10)+1)*12+a;return Math.round(440*Math.pow(2,(i-69)/12))}const Z=[{name:"arcade_laser",wave:"square",startFreq:950,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.125,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.06,sustain:.25,release:.04,volume:.28},{name:"plasma_gun",wave:"sawtooth",startFreq:1200,endFreq:180,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:3500,lpfEnd:400,hpfStart:0,hpfEnd:0,q:2.2,attack:.002,decay:.08,sustain:.2,release:.05,volume:.3},{name:"explosion_arcade",wave:"psg_noise",startFreq:180,endFreq:25,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:1200,lpfEnd:150,hpfStart:0,hpfEnd:0,q:1.5,attack:.003,decay:.28,sustain:.15,release:.22,volume:.36},{name:"explosion_deep",wave:"sine",startFreq:120,endFreq:24,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.004,decay:.35,sustain:.2,release:.25,volume:.4},{name:"jump_arcade",wave:"square",startFreq:160,endFreq:620,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.003,decay:.04,sustain:.55,release:.05,volume:.26},{name:"jump_spring",wave:"triangle",startFreq:120,endFreq:480,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.004,decay:.06,sustain:.45,release:.06,volume:.28},{name:"coin_pickup",wave:"square",startFreq:988,endFreq:1319,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.025,sustain:.35,release:.035,volume:.22},{name:"gem_shimmer",wave:"fm",startFreq:1568,endFreq:1568,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.06,sustain:.15,release:.12,volume:.2},{name:"sword_clash",wave:"fm",startFreq:520,endFreq:210,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.04,sustain:.08,release:.1,volume:.32},{name:"shield_deflect",wave:"fm",startFreq:880,endFreq:440,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.05,sustain:.1,release:.08,volume:.28},{name:"hit_punch",wave:"triangle",startFreq:180,endFreq:45,pitchCurve:"hyper",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.05,sustain:.1,release:.05,volume:.38},{name:"hit_damage",wave:"sawtooth",startFreq:220,endFreq:65,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.06,sustain:.15,release:.05,volume:.32},{name:"powerup_fanfare",wave:"square",startFreq:523,endFreq:1046,pitchCurve:"exp",dutyStart:.25,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.003,decay:.04,sustain:.5,release:.06,volume:.24},{name:"ui_select",wave:"sine",startFreq:880,endFreq:1100,pitchCurve:"lin",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.015,sustain:.05,release:.015,volume:.18},{name:"ui_confirm",wave:"square",startFreq:659,endFreq:1319,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.025,sustain:.3,release:.03,volume:.2},{name:"ui_error",wave:"sawtooth",startFreq:150,endFreq:110,pitchCurve:"lin",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.05,sustain:.4,release:.04,volume:.25},{name:"footstep_stone",wave:"noise",startFreq:320,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:1400,lpfEnd:400,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.025,sustain:.05,release:.02,volume:.2},{name:"engine_thruster",wave:"psg_noise",startFreq:110,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.01,decay:.08,sustain:.65,release:.08,volume:.22}],Q=`title "Arcade Pulse Laser"
type sfx

inst laser preset=arcade_laser duty=0.50->0.125 vol=0.32
track main laser: 950Hz->110Hz:140ms
`,At=`title "Neon Stage Groove"
type song
tempo allegro 132
time 4/4

inst lead   wave=ym2612_brass gm=synth_brass_1 vol=0.22 pan=-0.15
inst pad    wave=ym2612_epiano gm=epiano1 vol=0.16 pan=0.25
inst bass   wave=ym2612_slap_bass gm=slap_bass_1 vol=0.26 pan=0.0
inst kick   wave=ym2612_kick vol=0.20 pan=0.0

pattern hook = A4:8 C5:8 E5:4 D5:8 C5:8 G4:4 | F4:8 A4:8 C5:4 B4:8 G4:8 E4:4
pattern chords = [A3 C4 E4]:2 [G3 B3 D4]:2 | [F3 A3 C4]:2 [E3 G3 B3]:2
pattern bassline = A1:8 A2:8 A1:8 G1:8 G1:8 G2:8 G1:8 E1:8 | F1:8 F2:8 F1:8 E1:8 E1:8 E2:8 E1:8 G1:8
pattern beat = (kick:8 hat:8 snare:8 hat:8)*2 | (kick:8 hat:8 snare:8 hat:8)*2

track lead_ch lead:     (hook)*2
track pad_ch pad:       (chords)*2
track bass_ch bass:     (bassline)*2
track drum_ch kick:     (beat)*2
`;function Pt(){typeof window>"u"||typeof HTMLElement>"u"||("popover"in HTMLElement.prototype||import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(()=>{}),typeof document<"u"&&document.documentElement&&!("anchorName"in document.documentElement.style)&&import("https://unpkg.com/@oddbird/css-anchor-positioning").catch(()=>{}),typeof HTMLButtonElement<"u"&&!Object.prototype.hasOwnProperty.call(HTMLButtonElement.prototype,"interestForElement")&&import("https://unpkg.com/interestfor@latest").catch(()=>{}))}class It{rootEl;tabSfxBtn;tabMusicBtn;fileSelectEl;playBtnEl;undoBtnEl;redoBtnEl;resetBtnEl;loopBtnEl;saveBtnEl;exportBtnEl;engineYmBtn;engineAppleBtn;vizWaveformBtn;vizSpectrumBtn;diagnosticsContainerEl;editorTextarea;canvasEl;statusPillBtn;timeReadoutEl;scrubSliderEl;sfxShaperPaneEl;sfxPresetGridEl;sfxToneGroupEl;sfxStartFreqSlider;sfxStartFreqVal;sfxEndFreqSlider;sfxEndFreqVal;sfxDurSlider;sfxDurVal;sfxBrightSlider;sfxBrightVal;sfxGritSlider;sfxGritVal;musicMixerPaneEl;musicBpmSlider;musicBpmVal;musicBankChipBtn;musicBankAppleBtn;trackListEl;chatNoteInputEl;sendChatBtnEl;catalog={musicLibrary:[],sfxLibrary:[],workspaceFiles:[]};sfxPresets=[...Z];activeFilePath="";activeFileName="laser_arcade.sfx";activeDocType="sfx";useAppleSynth=!1;loopEnabled=!1;visualizerMode="waveform";soloTracks=new Set;muteTracks=new Set;trackMetaCache=new Map;trackStemBuffers=new Map;trackStemPeaks=new Map;trackStemBaseMeta=new Map;trackLiveMeta=new Map;activeStemNodes=new Map;masterLimiterNode=null;lastSynthesizedNonMixerDsl="";exportWavNeedsResynth=!1;lastBuildId="";lastReport=null;isSynthesizing=!1;pendingSynthRequest=null;realtimeDebounceTimer=null;dslDirty=!0;undoStack=[];redoStack=[];initialSnapshot=null;sliderDragSnapshotTaken=!1;modeSavedState={sfx:null,music:null};sfxState={title:"Arcade Laser",preset:"arcade_laser",wave:"square",startFreq:950,endFreq:110,durationMs:140,brightnessHz:8e3,gritPct:0,volume:.35,pitchCurve:"exp"};audioCtx=null;analyser=null;sourceNode=null;decodedBuffer=null;isPlaying=!1;playStartCtxTime=0;playOffsetSec=0;rafId=null;constructor(t){this.rootEl=t.rootEl,Pt(),this.renderLayout(),this.bindEvents(),this.initializeStudio()}renderLayout(){this.rootEl.innerHTML=`
      <div class="sound-studio-shell">
        <!-- Single-Row Minimalist Toolbar -->
        <header class="sound-toolbar">
          <div class="sound-toolbar-main">
            <div class="sound-mode-tabs" role="tablist" aria-label="Sound Studio Mode">
              <button
                type="button"
                id="tab-sound-sfx"
                class="sound-mode-tab active"
                role="tab"
                aria-selected="true"
                aria-controls="sound-sfx-shaper"
                tabindex="0"
              >
                SFX
              </button>
              <button
                type="button"
                id="tab-sound-music"
                class="sound-mode-tab"
                role="tab"
                aria-selected="false"
                aria-controls="sound-music-mixer"
                tabindex="-1"
              >
                Music
              </button>
            </div>

            <select
              id="sound-file-select"
              class="sound-file-select"
              aria-label="Select sound effect or music track"
            >
              <option value="">Select sound effect...</option>
            </select>

            <button
              type="button"
              id="btn-sound-play"
              class="btn btn-primary sound-play-btn"
            >
              Play
            </button>
          </div>

          <div class="sound-toolbar-edges">
            <button
              type="button"
              id="btn-sound-undo"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-undo);"
              aria-label="Undo change"
              interestfor="tip-sound-undo"
              disabled
            ></button>
            <div id="tip-sound-undo" popover="hint" class="sound-hint-tooltip">Undo (⌘Z)</div>

            <button
              type="button"
              id="btn-sound-redo"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-redo);"
              aria-label="Redo change"
              interestfor="tip-sound-redo"
              disabled
            ></button>
            <div id="tip-sound-redo" popover="hint" class="sound-hint-tooltip">Redo (⇧⌘Z)</div>

            <button
              type="button"
              id="btn-sound-reset"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-reset);"
              aria-label="Reset changes"
              interestfor="tip-sound-reset"
              disabled
            ></button>
            <div id="tip-sound-reset" popover="hint" class="sound-hint-tooltip">Reset to original</div>

            <span class="sound-toolbar-divider" aria-hidden="true"></span>

            <button
              type="button"
              id="btn-sound-loop"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-repeat);"
              aria-label="Loop playback"
              aria-pressed="false"
              interestfor="tip-sound-loop"
            ></button>
            <div id="tip-sound-loop" popover="hint" class="sound-hint-tooltip">Loop playback</div>

            <button
              type="button"
              id="btn-sound-new-trigger"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-plus);"
              popovertarget="sound-new-menu"
              aria-label="New sound or song"
              interestfor="tip-sound-new"
            ></button>
            <div id="tip-sound-new" popover="hint" class="sound-hint-tooltip">New sound or song</div>

            <button
              type="button"
              id="btn-sound-settings-trigger"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-tune);"
              popovertarget="sound-settings-menu"
              aria-label="Audio settings and diagnostics"
              interestfor="tip-sound-settings"
            ></button>
            <div id="tip-sound-settings" popover="hint" class="sound-hint-tooltip">Settings &amp; Code</div>

            <button
              type="button"
              id="btn-sound-save"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-save);"
              aria-label="Save file"
              interestfor="tip-sound-save"
            ></button>
            <div id="tip-sound-save" popover="hint" class="sound-hint-tooltip">Save to project</div>

            <button
              type="button"
              id="btn-sound-export"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-download);"
              aria-label="Download WAV"
              interestfor="tip-sound-export"
            ></button>
            <div id="tip-sound-export" popover="hint" class="sound-hint-tooltip">Download WAV</div>
          </div>
        </header>

        <!-- Light-Dismiss Popover: New Sound / Song -->
        <div id="sound-new-menu" popover="auto" class="sound-popover-panel">
          <button type="button" id="btn-sound-new-sfx" class="sound-popover-action">
            New Sound Effect (.sfx)
          </button>
          <button type="button" id="btn-sound-new-music" class="sound-popover-action">
            New Music Track (.music)
          </button>
        </div>

        <!-- Light-Dismiss Popover: Settings, Diagnostics & Raw DSL Code -->
        <aside id="sound-settings-menu" popover="auto" class="sound-popover-panel sound-settings-popover">
          <div class="sound-popover-section">
            <span class="sound-popover-label">Visualizer</span>
            <div class="sound-segmented-group">
              <button type="button" id="btn-viz-waveform" class="sound-seg-btn active">Waveform</button>
              <button type="button" id="btn-viz-spectrum" class="sound-seg-btn">Spectrum</button>
            </div>
          </div>

          <div class="sound-popover-section">
            <span class="sound-popover-label">Music Synth Engine</span>
            <div class="sound-segmented-group">
              <button type="button" id="btn-engine-ym2612" class="sound-seg-btn active">16-Bit YM2612</button>
              <button type="button" id="btn-engine-apple" class="sound-seg-btn">Real Instruments</button>
            </div>
          </div>

          <details class="sound-popover-details" id="sound-diagnostics-details">
            <summary>Audio Quality &amp; Diagnostics</summary>
            <div id="sound-diagnostics-body" class="sound-diagnostics-body"></div>
          </details>

          <details class="sound-popover-details">
            <summary>Advanced: DSL Source Code</summary>
            <div class="sound-dsl-drawer-body">
              <textarea
                id="sound-dsl-textarea"
                class="sound-dsl-textarea"
                spellcheck="false"
                aria-label="Procedural audio DSL source"
              ></textarea>
              <button type="button" id="btn-apply-raw-dsl" class="btn btn-secondary sound-apply-dsl-btn">
                Apply Code
              </button>
            </div>
          </details>
        </aside>

        <!-- Forefront Hero Stage (80%+ of screen) -->
        <main class="sound-hero-stage">
          <!-- 1. Interactive Waveform & Transport Card -->
          <section class="sound-wave-card" aria-label="Audio Waveform Player">
            <div class="sound-wave-canvas-wrap">
              <canvas id="sound-visualizer-canvas" width="900" height="140"></canvas>
              <div class="sound-wave-overlay">
                <span id="sound-time-readout" class="sound-time-pill">0.00s</span>
                <button
                  type="button"
                  id="btn-sound-status-pill"
                  class="sound-status-pill pass"
                  popovertarget="sound-settings-menu"
                  title="Click to inspect audio diagnostics"
                >
                  Ready
                </button>
              </div>
            </div>
            <input
              type="range"
              id="sound-scrub-slider"
              class="sound-scrub-slider"
              min="0"
              max="1000"
              step="1"
              value="0"
              aria-label="Playback position"
            />
          </section>

          <!-- 2A. Human-Friendly Sound Effect Shaper (visible for .sfx) -->
          <section
            id="sound-sfx-shaper"
            class="sound-controls-card"
            role="tabpanel"
            aria-labelledby="tab-sound-sfx"
          >
            <div class="sound-preset-strip" id="sound-sfx-preset-grid" aria-label="Sound Effect Presets"></div>

            <div class="sound-tone-row">
              <span class="sound-control-label">Tone</span>
              <div class="sound-tone-group" id="sound-sfx-tone-group"></div>
            </div>

            <div class="sound-sliders-grid">
              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Start Pitch</span>
                  <strong id="val-sfx-start-freq">950 Hz</strong>
                </div>
                <input type="range" id="slider-sfx-start-freq" min="40" max="2000" step="5" value="950" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>End Pitch</span>
                  <strong id="val-sfx-end-freq">110 Hz</strong>
                </div>
                <input type="range" id="slider-sfx-end-freq" min="20" max="2000" step="5" value="110" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Length</span>
                  <strong id="val-sfx-dur">140 ms</strong>
                </div>
                <input type="range" id="slider-sfx-dur" min="30" max="1000" step="10" value="140" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Brightness</span>
                  <strong id="val-sfx-bright">Open</strong>
                </div>
                <input type="range" id="slider-sfx-bright" min="200" max="8000" step="100" value="8000" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Grit</span>
                  <strong id="val-sfx-grit">0%</strong>
                </div>
                <input type="range" id="slider-sfx-grit" min="0" max="90" step="5" value="0" />
              </label>
            </div>
          </section>

          <!-- 2B. Human-Friendly Song Mixer (visible for .music) -->
          <section
            id="sound-music-mixer"
            class="sound-controls-card hidden"
            role="tabpanel"
            aria-labelledby="tab-sound-music"
          >
            <div class="sound-music-top-bar">
              <label class="sound-slider-field sound-tempo-field">
                <div class="sound-slider-header">
                  <span>Tempo</span>
                  <strong id="val-music-bpm">132 BPM</strong>
                </div>
                <input type="range" id="slider-music-bpm" min="40" max="220" step="1" value="132" />
              </label>

              <div class="sound-bank-switch">
                <span class="sound-control-label">Instruments</span>
                <div class="sound-segmented-group">
                  <button type="button" id="btn-music-bank-chip" class="sound-seg-btn active">16-Bit Chiptune</button>
                  <button type="button" id="btn-music-bank-apple" class="sound-seg-btn">Real Instruments</button>
                </div>
              </div>
            </div>

            <div id="sound-track-list" class="sound-track-list"></div>
          </section>
        </main>

        <!-- Bottom Prompt Bar -->
        <footer class="sound-prompt-bar">
          <input
            type="text"
            id="sound-chat-note-input"
            class="sound-prompt-input"
            placeholder="Describe a sound or ask to change the song..."
            aria-label="Prompt to modify sound or song"
          />
          <button
            type="button"
            id="btn-sound-send-chat"
            class="btn btn-primary sound-send-btn"
          >
            Send
          </button>
        </footer>
      </div>
    `,this.tabSfxBtn=this.rootEl.querySelector("#tab-sound-sfx"),this.tabMusicBtn=this.rootEl.querySelector("#tab-sound-music"),this.fileSelectEl=this.rootEl.querySelector("#sound-file-select"),this.playBtnEl=this.rootEl.querySelector("#btn-sound-play"),this.undoBtnEl=this.rootEl.querySelector("#btn-sound-undo"),this.redoBtnEl=this.rootEl.querySelector("#btn-sound-redo"),this.resetBtnEl=this.rootEl.querySelector("#btn-sound-reset"),this.loopBtnEl=this.rootEl.querySelector("#btn-sound-loop"),this.saveBtnEl=this.rootEl.querySelector("#btn-sound-save"),this.exportBtnEl=this.rootEl.querySelector("#btn-sound-export"),this.engineYmBtn=this.rootEl.querySelector("#btn-engine-ym2612"),this.engineAppleBtn=this.rootEl.querySelector("#btn-engine-apple"),this.vizWaveformBtn=this.rootEl.querySelector("#btn-viz-waveform"),this.vizSpectrumBtn=this.rootEl.querySelector("#btn-viz-spectrum"),this.diagnosticsContainerEl=this.rootEl.querySelector("#sound-diagnostics-body"),this.editorTextarea=this.rootEl.querySelector("#sound-dsl-textarea"),this.canvasEl=this.rootEl.querySelector("#sound-visualizer-canvas"),this.statusPillBtn=this.rootEl.querySelector("#btn-sound-status-pill"),this.timeReadoutEl=this.rootEl.querySelector("#sound-time-readout"),this.scrubSliderEl=this.rootEl.querySelector("#sound-scrub-slider"),this.sfxShaperPaneEl=this.rootEl.querySelector("#sound-sfx-shaper"),this.sfxPresetGridEl=this.rootEl.querySelector("#sound-sfx-preset-grid"),this.sfxToneGroupEl=this.rootEl.querySelector("#sound-sfx-tone-group"),this.sfxStartFreqSlider=this.rootEl.querySelector("#slider-sfx-start-freq"),this.sfxStartFreqVal=this.rootEl.querySelector("#val-sfx-start-freq"),this.sfxEndFreqSlider=this.rootEl.querySelector("#slider-sfx-end-freq"),this.sfxEndFreqVal=this.rootEl.querySelector("#val-sfx-end-freq"),this.sfxDurSlider=this.rootEl.querySelector("#slider-sfx-dur"),this.sfxDurVal=this.rootEl.querySelector("#val-sfx-dur"),this.sfxBrightSlider=this.rootEl.querySelector("#slider-sfx-bright"),this.sfxBrightVal=this.rootEl.querySelector("#val-sfx-bright"),this.sfxGritSlider=this.rootEl.querySelector("#slider-sfx-grit"),this.sfxGritVal=this.rootEl.querySelector("#val-sfx-grit"),this.musicMixerPaneEl=this.rootEl.querySelector("#sound-music-mixer"),this.musicBpmSlider=this.rootEl.querySelector("#slider-music-bpm"),this.musicBpmVal=this.rootEl.querySelector("#val-music-bpm"),this.musicBankChipBtn=this.rootEl.querySelector("#btn-music-bank-chip"),this.musicBankAppleBtn=this.rootEl.querySelector("#btn-music-bank-apple"),this.trackListEl=this.rootEl.querySelector("#sound-track-list"),this.chatNoteInputEl=this.rootEl.querySelector("#sound-chat-note-input"),this.sendChatBtnEl=this.rootEl.querySelector("#btn-sound-send-chat"),this.renderSfxPresetChips(),this.renderSfxToneButtons()}renderSfxPresetChips(){this.sfxPresetGridEl.innerHTML=j.map(t=>`
        <button
          type="button"
          class="sound-preset-chip ${this.sfxState.preset===t.id?"active":""}"
          data-preset="${t.id}"
        >
          ${t.label}
        </button>
      `).join(""),this.sfxPresetGridEl.querySelectorAll(".sound-preset-chip").forEach(t=>{t.addEventListener("click",()=>{const e=t.getAttribute("data-preset")||"";e&&this.applySfxPreset(e)})})}renderSfxToneButtons(){this.sfxToneGroupEl.innerHTML=Lt.map(t=>`
        <button
          type="button"
          class="sound-tone-btn ${this.sfxState.wave===t.id?"active":""}"
          data-wave="${t.id}"
        >
          ${t.label}
        </button>
      `).join(""),this.sfxToneGroupEl.querySelectorAll(".sound-tone-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.getAttribute("data-wave")||"square";this.sfxState.wave!==e&&(this.recordHistoryBeforeChange(),this.sfxState.wave=e,this.renderSfxToneButtons(),this.updateSfxDslInPlace("wave"),this.synthesizeAndPlay(!0,!1))})})}captureSnapshot(){return{dsl:this.editorTextarea.value,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks),useAppleSynth:this.useAppleSynth}}snapshotsEqual(t,e){return!t||!e?!1:t.dsl===e.dsl&&t.useAppleSynth===e.useAppleSynth&&t.soloTracks.join(",")===e.soloTracks.join(",")&&t.muteTracks.join(",")===e.muteTracks.join(",")}resetHistoryBaseline(){this.initialSnapshot=this.captureSnapshot(),this.undoStack=[],this.redoStack=[],this.sliderDragSnapshotTaken=!1,this.updateHistoryButtonsUI()}recordHistoryBeforeChange(){const t=this.captureSnapshot(),e=this.undoStack.length>0?this.undoStack[this.undoStack.length-1]:null;this.snapshotsEqual(t,e)||(this.undoStack.push(t),this.undoStack.length>50&&this.undoStack.shift()),this.redoStack=[],this.updateHistoryButtonsUI()}updateHistoryButtonsUI(){if(!this.undoBtnEl||!this.redoBtnEl||!this.resetBtnEl)return;const t=this.captureSnapshot();this.undoBtnEl.disabled=this.undoStack.length===0,this.redoBtnEl.disabled=this.redoStack.length===0,this.resetBtnEl.disabled=!this.initialSnapshot||this.snapshotsEqual(t,this.initialSnapshot)}stripMixerPropsFromDsl(t){return t.split(`
`).map(e=>{const a=e.trim();if(/^(?:inst|patch)\b/i.test(a)){const s=a.replace(/\b(?:vol|volume)=[^\s]+/gi,"").replace(/\bpan=[^\s]+/gi,"").replace(/\s+/g," ").trim(),i=s.match(/^(?:inst|patch)\s+([^\s]+)\s+wave=([^\s]+)$/i);return i&&i[1].toLowerCase()===i[2].toLowerCase()&&F.has(i[1].toLowerCase())?"":s}return a}).filter(Boolean).join(`
`)}syncLiveTrackMetaFromDsl(t){const e=this.lastReport?.tracks||[];for(const a of e){const s=this.trackStemBaseMeta.get(a.name)||{volume:a.volume>0?a.volume:.2,pan:a.pan||0},i=/drum|perc|toms/i.test(a.name)||F.has((a.waveType||"").toLowerCase()),r=(a.defaultInst||(i?"kick":a.name)).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),o=t.match(new RegExp(`^\\s*(?:inst|patch)\\s+${r}\\b(.*)$`,"m")),c=o?o[1]:"",u=c.match(/\b(?:vol|volume)=([0-9.]+)/i),l=c.match(/\bpan=([-+0-9.]+)/i),h=u?Number(u[1]):s.volume,p=l?Number(l[1]):s.pan;this.trackLiveMeta.set(a.name,{volume:h,pan:p});const f=this.trackMetaCache.get(a.name);f&&(f.volume=h,f.pan=p)}}applySnapshot(t){this.sliderDragSnapshotTaken=!1;const e=this.activeDocType==="music"&&this.trackStemBuffers.size>0&&t.useAppleSynth===this.useAppleSynth&&this.stripMixerPropsFromDsl(t.dsl)===this.lastSynthesizedNonMixerDsl;if(this.editorTextarea.value=t.dsl,this.soloTracks=new Set(t.soloTracks),this.muteTracks=new Set(t.muteTracks),this.useAppleSynth=t.useAppleSynth,this.engineYmBtn.classList.toggle("active",!t.useAppleSynth),this.engineAppleBtn.classList.toggle("active",t.useAppleSynth),this.musicBankChipBtn.classList.toggle("active",!t.useAppleSynth),this.musicBankAppleBtn.classList.toggle("active",t.useAppleSynth),e){this.dslDirty=!1,this.exportWavNeedsResynth=!0,this.syncLiveTrackMetaFromDsl(t.dsl),this.lastReport?.tracks&&this.renderMusicTrackMixer(this.lastReport.tracks),this.applyLiveTrackMixerState(),this.updateHistoryButtonsUI();return}this.dslDirty=!0,this.syncControlsFromDsl(t.dsl),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,this.activeDocType==="music")}undo(){if(this.undoStack.length===0)return;const t=this.captureSnapshot(),e=this.undoStack.pop();this.redoStack.push(t),this.applySnapshot(e)}redo(){if(this.redoStack.length===0)return;const t=this.captureSnapshot(),e=this.redoStack.pop();this.undoStack.push(t),this.applySnapshot(e)}resetChanges(){if(!this.initialSnapshot)return;const t=this.captureSnapshot();this.snapshotsEqual(t,this.initialSnapshot)||(this.recordHistoryBeforeChange(),this.applySnapshot({dsl:this.initialSnapshot.dsl,soloTracks:[...this.initialSnapshot.soloTracks],muteTracks:[...this.initialSnapshot.muteTracks],useAppleSynth:this.initialSnapshot.useAppleSynth}))}scheduleRealtimeSynthesize(t,e){this.realtimeDebounceTimer!==null&&window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=window.setTimeout(()=>{this.realtimeDebounceTimer=null,this.synthesizeAndPlay(t,e)},110)}bindEvents(){this.tabSfxBtn.addEventListener("click",()=>{this.switchDocTypeTab("sfx",!1)}),this.tabMusicBtn.addEventListener("click",()=>{this.switchDocTypeTab("music",!1)});const t=s=>{if(s.key==="ArrowLeft"||s.key==="ArrowRight"||s.key==="Home"||s.key==="End"){s.preventDefault();let i;s.key==="Home"?i="sfx":s.key==="End"?i="music":i=this.activeDocType==="sfx"?"music":"sfx",(i==="sfx"?this.tabSfxBtn:this.tabMusicBtn).focus(),this.switchDocTypeTab(i,!1)}};this.tabSfxBtn.addEventListener("keydown",t),this.tabMusicBtn.addEventListener("keydown",t),this.fileSelectEl.addEventListener("change",()=>{const s=this.fileSelectEl.value;s&&this.loadFileFromPath(s,!0)}),this.playBtnEl.addEventListener("click",()=>{if(this.isPlaying)this.stopPlayback();else if(this.decodedBuffer&&!this.dslDirty){const s=this.playOffsetSec>0&&this.playOffsetSec<this.decodedBuffer.duration-.05?this.playOffsetSec:0;this.startBufferPlayback(s)}else this.synthesizeAndPlay(!0,!1)}),this.undoBtnEl.addEventListener("click",()=>this.undo()),this.redoBtnEl.addEventListener("click",()=>this.redo()),this.resetBtnEl.addEventListener("click",()=>this.resetChanges()),window.addEventListener("pointerup",()=>{this.sliderDragSnapshotTaken=!1}),window.addEventListener("pointercancel",()=>{this.sliderDragSnapshotTaken=!1}),this.rootEl.addEventListener("keydown",s=>{const i=s.target;i&&(i.tagName==="TEXTAREA"||i.tagName==="INPUT")&&(i.type==="text"||i.tagName==="TEXTAREA")||((s.metaKey||s.ctrlKey)&&s.key.toLowerCase()==="z"?(s.preventDefault(),s.shiftKey?this.redo():this.undo()):(s.metaKey||s.ctrlKey)&&s.key.toLowerCase()==="y"&&(s.preventDefault(),this.redo()))}),this.loopBtnEl.addEventListener("click",()=>{this.loopEnabled=!this.loopEnabled,this.loopBtnEl.classList.toggle("active",this.loopEnabled),this.loopBtnEl.setAttribute("aria-pressed",String(this.loopEnabled)),this.sourceNode&&(this.sourceNode.loop=this.loopEnabled);for(const s of this.activeStemNodes.values())s.source.loop=this.loopEnabled}),this.rootEl.querySelector("#btn-sound-new-sfx")?.addEventListener("click",()=>{this.closePopover("#sound-new-menu"),this.loadTemplate("sfx")}),this.rootEl.querySelector("#btn-sound-new-music")?.addEventListener("click",()=>{this.closePopover("#sound-new-menu"),this.loadTemplate("music")});const e=s=>{this.useAppleSynth!==s&&(this.recordHistoryBeforeChange(),this.useAppleSynth=s,this.engineYmBtn.classList.toggle("active",!s),this.engineAppleBtn.classList.toggle("active",s),this.musicBankChipBtn.classList.toggle("active",!s),this.musicBankAppleBtn.classList.toggle("active",s),this.dslDirty=!0,this.updateHistoryButtonsUI(),this.activeDocType==="music"&&this.synthesizeAndPlay(!0,!0))};this.engineYmBtn.addEventListener("click",()=>e(!1)),this.engineAppleBtn.addEventListener("click",()=>e(!0)),this.musicBankChipBtn.addEventListener("click",()=>e(!1)),this.musicBankAppleBtn.addEventListener("click",()=>e(!0)),this.vizWaveformBtn.addEventListener("click",()=>{this.visualizerMode="waveform",this.vizWaveformBtn.classList.add("active"),this.vizSpectrumBtn.classList.remove("active"),this.drawVisualizerFrame()}),this.vizSpectrumBtn.addEventListener("click",()=>{this.visualizerMode="spectrum",this.vizSpectrumBtn.classList.add("active"),this.vizWaveformBtn.classList.remove("active"),this.drawVisualizerFrame()}),this.saveBtnEl.addEventListener("click",()=>void this.saveCurrentFile()),this.exportBtnEl.addEventListener("click",()=>void this.exportCurrentWav()),this.rootEl.querySelector("#btn-apply-raw-dsl")?.addEventListener("click",()=>{this.syncControlsFromDsl(this.editorTextarea.value),this.dslDirty=!0,this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,this.activeDocType==="music")}),this.editorTextarea.addEventListener("focus",()=>{this.recordHistoryBeforeChange()}),this.editorTextarea.addEventListener("input",()=>{this.dslDirty=!0,this.updateHistoryButtonsUI()});const a=(s,i,n)=>{s.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),s.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(s.value)),this.updateSfxShaperLabels(),this.updateSfxDslInPlace(i),this.updateHistoryButtonsUI(),this.scheduleRealtimeSynthesize(!0,!1)}),s.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(s.value)),this.updateSfxShaperLabels(),this.updateSfxDslInPlace(i),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!1)})};a(this.sfxStartFreqSlider,"startFreq",s=>{this.sfxState.startFreq=s}),a(this.sfxEndFreqSlider,"endFreq",s=>{this.sfxState.endFreq=s}),a(this.sfxDurSlider,"durationMs",s=>{this.sfxState.durationMs=s}),a(this.sfxBrightSlider,"brightnessHz",s=>{this.sfxState.brightnessHz=s}),a(this.sfxGritSlider,"gritPct",s=>{this.sfxState.gritPct=s}),this.musicBpmSlider.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),this.musicBpmSlider.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0);const s=Number(this.musicBpmSlider.value)||120;this.musicBpmVal.textContent=`${s} BPM`,this.updateMusicBpmInDsl(s),this.updateHistoryButtonsUI(),this.scheduleRealtimeSynthesize(!0,!0)}),this.musicBpmSlider.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null);const s=Number(this.musicBpmSlider.value)||120;this.musicBpmVal.textContent=`${s} BPM`,this.updateMusicBpmInDsl(s),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!0)}),this.scrubSliderEl.addEventListener("input",()=>{if(!this.decodedBuffer)return;const i=Number(this.scrubSliderEl.value)/1e3*this.decodedBuffer.duration;this.playOffsetSec=i,this.updateTimeReadout(i,this.decodedBuffer.duration),this.isPlaying?this.startBufferPlayback(i):this.drawVisualizerFrame()}),this.canvasEl.addEventListener("click",s=>{if(!this.decodedBuffer){this.synthesizeAndPlay(!0,!1);return}const i=this.canvasEl.getBoundingClientRect();if(i.width<=0)return;const r=Math.max(0,Math.min(1,(s.clientX-i.left)/i.width))*this.decodedBuffer.duration;this.playOffsetSec=r,this.startBufferPlayback(r)}),this.sendChatBtnEl.addEventListener("click",()=>void this.sendToChat()),this.chatNoteInputEl.addEventListener("keydown",s=>{s.key==="Enter"&&(s.preventDefault(),this.sendToChat())})}closePopover(t){const e=this.rootEl.querySelector(t);if(e&&typeof e.hidePopover=="function")try{e.hidePopover()}catch{}}async initializeStudio(){this.setDslContent(Q,"laser_arcade.sfx","","sfx"),this.resetHistoryBaseline(),this.drawVisualizerFrame(),await Promise.all([this.refreshPresetsCatalog(),this.refreshFilesCatalog()]);const t=new URLSearchParams(window.location.search),e=t.get("file")||t.get("path")||t.get("uri");if(e&&e.trim()){await this.loadFileFromPath(e.trim(),!0);return}const a=this.catalog.sfxLibrary.find(s=>s.name==="laser_arcade.sfx")||this.catalog.sfxLibrary[0];a?(await this.loadFileFromPath(a.path||a.filePath||"",!1),await this.synthesizeAndPlay(!1,!1)):await this.synthesizeAndPlay(!1,!1)}async refreshFilesCatalog(){try{const t=T(),e=t?`?workspace=${encodeURIComponent(t)}`:"",a=await C(`/api/sound/files${e}`,{method:"GET",cache:"no-store"});if(!a.ok)return;const s=await a.json();this.catalog={workspaceFiles:Array.isArray(s.workspaceFiles)?s.workspaceFiles:[],sfxLibrary:Array.isArray(s.sfxLibrary)?s.sfxLibrary:[],musicLibrary:Array.isArray(s.musicLibrary)?s.musicLibrary:[]},this.renderFileSelectOptions()}catch{}}async refreshPresetsCatalog(){try{const t=await C("/api/sound/presets",{method:"GET",cache:"no-store"});if(!t.ok)return;const e=await t.json();Array.isArray(e.sfxPresets)&&e.sfxPresets.length>0&&(this.sfxPresets=e.sfxPresets)}catch{}}renderFileSelectOptions(){const t=this.activeDocType==="music",a=[`<option value="">${t?"Select music track...":"Select sound effect..."}</option>`],s=this.catalog.workspaceFiles.filter(i=>{const n=(i.name||i.path||i.filePath||"").toLowerCase();return t?i.type==="music"||n.endsWith(".music"):i.type==="sfx"||n.endsWith(".sfx")});if(s.length>0){const i=s.map(r=>{const o=r.path||r.filePath||"",c=o===this.activeFilePath?"selected":"";return`<option value="${this.escapeHtml(o)}" ${c}>${this.escapeHtml(r.title||r.name)}</option>`}).join(""),n=t?"Project Music":"Project SFX";a.push(`<optgroup label="${n}">${i}</optgroup>`)}if(!t&&this.catalog.sfxLibrary.length>0){const i=this.catalog.sfxLibrary.map(n=>{const r=n.path||n.filePath||"",o=r===this.activeFilePath?"selected":"";return`<option value="${this.escapeHtml(r)}" ${o}>${this.escapeHtml(n.title||n.name)}</option>`}).join("");a.push(`<optgroup label="Sound Effects (${this.catalog.sfxLibrary.length})">${i}</optgroup>`)}if(t&&this.catalog.musicLibrary.length>0){const i=this.catalog.musicLibrary.map(n=>{const r=n.path||n.filePath||"",o=r===this.activeFilePath?"selected":"";return`<option value="${this.escapeHtml(r)}" ${o}>${this.escapeHtml(n.title||n.name)}</option>`}).join("");a.push(`<optgroup label="Music Tracks (${this.catalog.musicLibrary.length})">${i}</optgroup>`)}this.fileSelectEl.innerHTML=a.join("")}saveCurrentModeState(){const t=this.editorTextarea?.value||"";t.trim()&&(this.modeSavedState[this.activeDocType]={filePath:this.activeFilePath,fileName:this.activeFileName,dsl:t,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks),useAppleSynth:this.useAppleSynth,initialSnapshot:this.initialSnapshot?{dsl:this.initialSnapshot.dsl,soloTracks:[...this.initialSnapshot.soloTracks],muteTracks:[...this.initialSnapshot.muteTracks],useAppleSynth:this.initialSnapshot.useAppleSynth}:null,undoStack:this.undoStack.map(e=>({dsl:e.dsl,soloTracks:[...e.soloTracks],muteTracks:[...e.muteTracks],useAppleSynth:e.useAppleSynth})),redoStack:this.redoStack.map(e=>({dsl:e.dsl,soloTracks:[...e.soloTracks],muteTracks:[...e.muteTracks],useAppleSynth:e.useAppleSynth}))})}syncModeTabsUI(){if(!this.tabSfxBtn||!this.tabMusicBtn)return;const t=this.activeDocType==="sfx";this.tabSfxBtn.classList.toggle("active",t),this.tabSfxBtn.setAttribute("aria-selected",String(t)),this.tabSfxBtn.setAttribute("tabindex",t?"0":"-1"),this.tabMusicBtn.classList.toggle("active",!t),this.tabMusicBtn.setAttribute("aria-selected",String(!t)),this.tabMusicBtn.setAttribute("tabindex",t?"-1":"0")}async switchDocTypeTab(t,e=!1){if(this.activeDocType===t)return;this.saveCurrentModeState(),this.stopPlayback();const a=this.modeSavedState[t];if(a){this.soloTracks=new Set(a.soloTracks),this.muteTracks=new Set(a.muteTracks),this.useAppleSynth=a.useAppleSynth,this.engineYmBtn.classList.toggle("active",!a.useAppleSynth),this.engineAppleBtn.classList.toggle("active",a.useAppleSynth),this.musicBankChipBtn.classList.toggle("active",!a.useAppleSynth),this.musicBankAppleBtn.classList.toggle("active",a.useAppleSynth),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(a.dsl,a.fileName,a.filePath,t),this.initialSnapshot=a.initialSnapshot,this.undoStack=a.undoStack,this.redoStack=a.redoStack,this.sliderDragSnapshotTaken=!1,this.updateHistoryButtonsUI(),this.renderFileSelectOptions(),await this.synthesizeAndPlay(e,!1);return}if(t==="music"){const i=this.catalog.workspaceFiles.find(n=>n.type==="music"||(n.name||"").toLowerCase().endsWith(".music"))||this.catalog.musicLibrary[0];if(i&&(i.path||i.filePath)){await this.loadFileFromPath(i.path||i.filePath||"",e),e||await this.synthesizeAndPlay(!1,!1);return}this.loadTemplate("music");return}const s=this.catalog.sfxLibrary.find(i=>i.name==="laser_arcade.sfx")||this.catalog.sfxLibrary[0];if(s&&(s.path||s.filePath)){await this.loadFileFromPath(s.path||s.filePath||"",e),e||await this.synthesizeAndPlay(!1,!1);return}this.loadTemplate("sfx")}async loadFileFromPath(t,e=!0){try{const a=await C("/api/sound/file/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:t})}),s=await a.json().catch(()=>({}));if(!a.ok)throw new Error(s.error||`Failed to load file "${t}"`);const i=typeof s.content=="string"?s.content:"",n=s.fileName||t.split(/[\\/]/).pop()||"untitled.sfx",r=s.type==="music"||n.endsWith(".music")?"music":"sfx";r!==this.activeDocType&&this.saveCurrentModeState(),this.stopPlayback(),this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(i,n,s.filePath||t,r),this.resetHistoryBaseline(),this.renderFileSelectOptions(),e&&await this.synthesizeAndPlay(!0,!1)}catch(a){x.error("Failed to Load Audio File",a?.message||String(a))}}loadTemplate(t){t!==this.activeDocType&&this.saveCurrentModeState(),this.stopPlayback(),this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,t==="music"?this.setDslContent(At,"new_song.music","","music"):this.setDslContent(Q,"new_cue.sfx","","sfx"),this.resetHistoryBaseline(),this.renderFileSelectOptions(),this.synthesizeAndPlay(!0,!1)}applySfxPreset(t){const e=j.find(r=>r.id===t),a=e?.fileName||`${t}.sfx`,s=this.catalog.sfxLibrary.find(r=>r.name===a||r.name===`${t}.sfx`);if(s&&(s.path||s.filePath)){this.loadFileFromPath(s.path||s.filePath||"",!0);return}this.recordHistoryBeforeChange();const i=this.sfxPresets.find(r=>r.name===t)||Z[0];this.sfxState={title:e?e.label:i.name,preset:i.name,wave:K(i.wave||"square"),startFreq:Math.round(i.startFreq||440),endFreq:Math.round(i.endFreq||i.startFreq||220),durationMs:Math.round(((i.attack||.01)+(i.decay||.08)+(i.release||.06))*1e3),brightnessHz:i.lpfStart>0?Math.round(i.lpfStart):8e3,gritPct:i.wave==="noise"||i.wave==="psg_noise"?60:0,volume:Number((i.volume||.32).toFixed(2)),pitchCurve:i.pitchCurve||"exp"};const n=[`title "${this.sfxState.title}"`,"type sfx","",`inst cue preset=${i.name} vol=${this.sfxState.volume.toFixed(2)}`,`track main cue: ${this.sfxState.startFreq}Hz->${this.sfxState.endFreq}Hz:${this.sfxState.durationMs}ms`,""].join(`
`);this.editorTextarea.value=n,this.dslDirty=!0,this.syncSfxShaperInputs(),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!1)}setDslContent(t,e,a,s){this.editorTextarea.value=t,this.activeFileName=e,this.activeFilePath=a,this.activeDocType=s,this.dslDirty=!0,this.syncModeTabsUI(),this.sfxShaperPaneEl.classList.toggle("hidden",s!=="sfx"),this.musicMixerPaneEl.classList.toggle("hidden",s!=="music"),this.syncControlsFromDsl(t)}parseMusicBpmFromDsl(t){const e=t.match(/^\s*(?:tempo|bpm)\s+([^\n#]+)/im);if(!e)return 120;const a=e[1].trim().split(/\s+/);let s=120;for(const i of a){const n=Number(i);if(!Number.isNaN(n)&&n>=20&&n<=300)return Math.round(n);const r=i.toLowerCase();Y[r]!==void 0&&(s=Y[r])}return s}syncControlsFromDsl(t){if(this.activeDocType==="sfx"){const e=t.match(/^\s*title\s+"?([^"\n]+)"?/im),a=t.split(`
`),s=[],i=[];for(const g of a){const v=g.replace(/#.*$/,"").trim();if(!v)continue;const S=v.match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);if(S){s.push({name:S[1],attrs:S[2]});continue}const E=v.match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);E&&i.push({name:E[1],defaultInst:E[2]||"",body:E[3]})}const n=s.find(g=>/\bpreset=/i.test(g.attrs))||s[s.length-1]||{name:"cue",attrs:""},r=i.find(g=>g.defaultInst===n.name)||i[i.length-1]||{defaultInst:n.name,body:""},o=n.attrs.match(/\bpreset=([a-zA-Z0-9_]+)/i),c=o?o[1]:"",u=this.sfxPresets.find(g=>g.name===c),l=n.attrs.match(/\bwave=([a-zA-Z0-9_]+)/i),h=l?l[1]:u?.wave||"square";this.sfxState.title=e?e[1].trim():"Custom Sound",this.sfxState.preset=c,this.sfxState.wave=K(h);const p=n.attrs.match(/\b(?:vol|volume)=([0-9.]+)/i);this.sfxState.volume=Number(p?p[1]:(u?.volume||.32).toFixed(2));const f=Array.from(r.body.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi));if(f.length>0){const g=f.reduce((v,S)=>v+Number(S[1]),0);this.sfxState.durationMs=Math.round(Math.max(30,Math.min(1e3,g)))}else u&&(this.sfxState.durationMs=Math.round(((u.attack||.01)+(u.decay||.08)+(u.release||.06))*1e3));const m=r.body.match(/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i)||n.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i),y=r.body.match(/(\d+(?:\.\d+)?)Hz\b/i)||n.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz\b/i);if(m)this.sfxState.startFreq=Math.round(Number(m[1])),this.sfxState.endFreq=Math.round(Number(m[2]));else if(y)this.sfxState.startFreq=Math.round(Number(y[1])),this.sfxState.endFreq=Math.round(Number(y[1]));else{const g=Array.from(r.body.matchAll(/\b([A-Ga-g][#b]?\d+)(?::\d+(?:\.\d+)?ms)?\b/g));if(g.length>0){const v=J(g[0][1])||u?.startFreq||440,S=J(g[g.length-1][1])||u?.endFreq||v;this.sfxState.startFreq=v,this.sfxState.endFreq=S}else u&&(this.sfxState.startFreq=Math.round(u.startFreq||440),this.sfxState.endFreq=Math.round(u.endFreq||u.startFreq||220))}const w=n.attrs.match(/\blpf=(\d+(?:\.\d+)?)/i)||n.attrs.match(/\bcutoff=(\d+(?:\.\d+)?)/i);if(w){const g=Number(w[1]);this.sfxState.brightnessHz=g<=1?Math.round(200+g*7800):Math.round(g)}else u&&u.lpfStart>0?this.sfxState.brightnessHz=Math.round(u.lpfStart):this.sfxState.brightnessHz=8e3;const k=n.attrs.match(/\bnoise_blend=(\d+(?:\.\d+)?)/i),b=n.attrs.match(/\bnoise=\d+(?:\.\d+)?,(\d+(?:\.\d+)?)/i);k?this.sfxState.gritPct=Math.round(Number(k[1])*100):b?this.sfxState.gritPct=Math.round(Number(b[1])*100):this.sfxState.wave==="psg_noise"?this.sfxState.gritPct=60:this.sfxState.gritPct=0,this.syncSfxShaperInputs()}else{const e=this.parseMusicBpmFromDsl(t);this.musicBpmSlider.value=String(Math.max(40,Math.min(220,e))),this.musicBpmVal.textContent=`${e} BPM`}}syncSfxShaperInputs(){this.sfxStartFreqSlider.value=String(Math.max(40,Math.min(2e3,this.sfxState.startFreq))),this.sfxEndFreqSlider.value=String(Math.max(20,Math.min(2e3,this.sfxState.endFreq))),this.sfxDurSlider.value=String(Math.max(30,Math.min(1e3,this.sfxState.durationMs))),this.sfxBrightSlider.value=String(Math.max(200,Math.min(8e3,this.sfxState.brightnessHz))),this.sfxGritSlider.value=String(Math.max(0,Math.min(90,this.sfxState.gritPct))),this.updateSfxShaperLabels(),this.renderSfxPresetChips(),this.renderSfxToneButtons()}updateSfxShaperLabels(){this.sfxStartFreqVal.textContent=`${this.sfxState.startFreq} Hz`,this.sfxEndFreqVal.textContent=`${this.sfxState.endFreq} Hz`,this.sfxDurVal.textContent=`${this.sfxState.durationMs} ms`,this.sfxBrightVal.textContent=this.sfxState.brightnessHz>=7800?"Open":`${this.sfxState.brightnessHz} Hz`,this.sfxGritVal.textContent=`${this.sfxState.gritPct}%`}updateSfxDslInPlace(t){const e=this.sfxState,a=this.editorTextarea.value.split(`
`);let s=-1,i="";for(let o=0;o<a.length;o++){const u=a[o].replace(/#.*$/,"").trim().match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);u&&(s===-1||/\bpreset=/i.test(u[2]))&&(s=o,i=u[1])}if(s===-1){const o=["inst cue"];if(e.preset&&o.push(`preset=${e.preset}`),o.push(`wave=${e.wave}`),e.brightnessHz<7800){const c=Math.max(120,Math.round(e.brightnessHz*.25));o.push(`lpf=${e.brightnessHz}->${c}`)}e.gritPct>0&&e.wave!=="psg_noise"&&e.wave!=="noise"&&o.push(`noise_blend=${(e.gritPct/100).toFixed(2)}`),o.push(`vol=${e.volume.toFixed(2)}`),this.editorTextarea.value=[`title "${e.title}"`,"type sfx","",o.join(" "),`track main cue: ${e.startFreq}Hz->${e.endFreq}Hz:${e.durationMs}ms`,""].join(`
`),this.dslDirty=!0;return}let n=a[s].replace(/\bnoise=\d+(?:\.\d+)?(?!\s*,)/g,"").trim();if(t==="wave")/\bwave=[^\s]+/i.test(n)?n=n.replace(/\bwave=[^\s]+/i,`wave=${e.wave}`):n=`${n} wave=${e.wave}`;else if(t==="brightnessHz"){const o=Math.max(120,Math.round(e.brightnessHz*.25));e.brightnessHz>=7800?n=n.replace(/\s*\b(?:lpf|cutoff)=[^\s]+/gi,""):/\b(?:lpf|cutoff)=[^\s]+/i.test(n)?n=n.replace(/\b(?:lpf|cutoff)=[^\s]+/i,`lpf=${e.brightnessHz}->${o}`):n=`${n} lpf=${e.brightnessHz}->${o}`}else t==="gritPct"&&(n=n.replace(/\s*\bnoise_blend=[^\s]+/gi,""),e.gritPct>0&&(n=`${n} noise_blend=${(e.gritPct/100).toFixed(2)}`));a[s]=n.replace(/\s+/g," ").trim();let r=-1;for(let o=0;o<a.length;o++){const u=a[o].replace(/#.*$/,"").trim().match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);u&&(r===-1||u[2]===i)&&(r=o)}if(r!==-1){if(t==="durationMs"){const o=a[r],u=Array.from(o.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi)).reduce((h,p)=>h+Number(p[1]),0),l=u>0?e.durationMs/u:1;for(let h=0;h<a.length;h++)/^\s*track\s+/i.test(a[h])&&(a[h]=a[h].replace(/:(\d+(?:\.\d+)?)ms\b/gi,(p,f)=>`:${Math.max(10,Math.round(Number(f)*l))}ms`))}else if(t==="startFreq"||t==="endFreq"){const o=a[r];/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i.test(o)?a[r]=o.replace(/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/gi,`${e.startFreq}Hz->${e.endFreq}Hz`):a[r]=o.replace(/^(\s*track\s+[^\s:]+(?:\s+[^\s:]+)?\s*:\s*).*$/i,`$1${e.startFreq}Hz->${e.endFreq}Hz:${e.durationMs}ms`)}}this.editorTextarea.value=a.join(`
`),this.dslDirty=!0}updateMusicBpmInDsl(t){let e=this.editorTextarea.value;/^\s*tempo\s+/im.test(e)?e=e.replace(/^(\s*tempo\s+(?:[a-zA-Z_]+)?)(?:\s+\d+(?:\.\d+)?)?\s*$/im,(a,s)=>`${s.trimEnd()} ${t}`):/^\s*bpm\s+/im.test(e)?e=e.replace(/^(\s*bpm\s+)(\d+(?:\.\d+)?)/im,`$1${t}`):e=`bpm ${t}
`+e,this.editorTextarea.value=e,this.dslDirty=!0}updateMusicInstProperty(t,e,a){const s=this.editorTextarea.value.split(`
`),i=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),n=new RegExp(`^(\\s*(?:inst|patch)\\s+${i}\\b.*)$`);let r=!1;for(let o=0;o<s.length;o++)if(n.test(s[o])){s[o]=a(s[o]),r=!0;break}if(!r){const o=F.has(e)?e:"ym2612_brass",c=a(`inst ${t} wave=${o}`);let u=s.findIndex(l=>/^\s*(?:pattern|track)\b/i.test(l));u===-1&&(u=s.length),s.splice(u,0,c)}this.editorTextarea.value=s.join(`
`),this.dslDirty=!0}async synthesizeAndPlay(t=!0,e=!1){if(this.isSynthesizing){this.pendingSynthRequest={autoPlay:t||!!this.pendingSynthRequest?.autoPlay,preservePlayhead:e||!!this.pendingSynthRequest?.preservePlayhead};return}const a=this.editorTextarea.value.trim();if(a){this.isSynthesizing=!0,this.playBtnEl.disabled=!0,this.isPlaying||(this.playBtnEl.textContent="...");try{const s=await C("/api/sound/synthesize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dsl:a,type:this.activeDocType,apple:this.activeDocType==="music"?this.useAppleSynth:!1,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks)})}),i=await s.json().catch(()=>({}));if(i.report&&(this.lastReport=i.report,this.renderDiagnosticsAndStatus(i.report),this.activeDocType==="music")){if(typeof i.report.bpm=="number"&&i.report.bpm>0&&document.activeElement!==this.musicBpmSlider){const p=Math.round(i.report.bpm);this.musicBpmSlider.value=String(Math.max(40,Math.min(220,p))),this.musicBpmVal.textContent=`${p} BPM`}this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear();for(const p of i.report.tracks||[]){const f=typeof p.volume=="number"&&p.volume>0?p.volume:.2,m=typeof p.pan=="number"?p.pan:0;this.trackStemBaseMeta.set(p.name,{volume:f,pan:m}),this.trackLiveMeta.set(p.name,{volume:f,pan:m})}this.syncLiveTrackMetaFromDsl(this.editorTextarea.value),this.lastSynthesizedNonMixerDsl=this.stripMixerPropsFromDsl(a),this.exportWavNeedsResynth=!1,this.renderMusicTrackMixer(i.report.tracks||[])}if(!s.ok||!i.buildId){const p=i.report?.error||i.error||i.report?.issues&&i.report.issues[0]||`Synthesis failed (HTTP ${s.status})`;this.statusPillBtn.textContent="Check Code",this.statusPillBtn.className="sound-status-pill fail",x.error("Synthesis Issue",p);return}this.lastBuildId=i.buildId,this.dslDirty=!1;const n=this.ensureAudioContext();let r=null;if(this.activeDocType==="music"&&i.hasStems){const p=await C(`/api/sound/stems?buildId=${encodeURIComponent(i.buildId)}`,{method:"GET",cache:"no-store"});if(p.ok){const f=await p.arrayBuffer();r=this.decodeStemsBinary(f,n)}}if(!r){this.trackStemBuffers.clear(),this.trackStemPeaks.clear();const p=await C(`/api/sound/wav?buildId=${encodeURIComponent(i.buildId)}`,{method:"GET",cache:"no-store"});if(!p.ok)throw new Error(`Failed to fetch audio stream (HTTP ${p.status})`);const f=await p.arrayBuffer();r=await n.decodeAudioData(f.slice(0))}const o=this.decodedBuffer?.duration||0,c=this.getCurrentPlayheadSec(),u=o>0?Math.max(0,Math.min(1,c/o)):0,l=this.isPlaying;this.decodedBuffer=r;let h=0;e&&this.activeDocType==="music"&&r.duration>0&&(o>0&&Math.abs(r.duration-o)>.05?h=u*r.duration:h=Math.min(c,Math.max(0,r.duration-.05)),h>=r.duration-.05&&(h=0)),this.playOffsetSec=h,this.updateTimeReadout(h,r.duration),t||e&&l?await this.startBufferPlayback(h):this.drawVisualizerFrame()}catch(s){x.error("Audio Synthesis Error",s?.message||String(s))}finally{if(this.isSynthesizing=!1,this.playBtnEl.disabled=!1,this.playBtnEl.textContent=this.isPlaying?"Stop":"Play",this.pendingSynthRequest){const s=this.pendingSynthRequest;this.pendingSynthRequest=null,this.synthesizeAndPlay(s.autoPlay,s.preservePlayhead)}}}}decodeStemsBinary(t,e){const a=new DataView(t);if(t.byteLength<12||String.fromCharCode(a.getUint8(0),a.getUint8(1),a.getUint8(2),a.getUint8(3))!=="STEM")return null;const i=a.getUint32(4,!0)||44100,n=a.getUint32(8,!0),r=new TextDecoder("utf-8");this.trackStemBuffers.clear(),this.trackStemPeaks.clear();const o=900;let c=12,u=null;for(let l=0;l<n&&!(c+2>t.byteLength);l++){const h=a.getUint16(c,!0);if(c+=2,c+h+4>t.byteLength)break;const p=r.decode(new Uint8Array(t,c,h));c+=h;const f=a.getUint32(c,!0);if(c+=4,c+f>t.byteLength)break;const m=Math.floor(f/4);if(m>0){const y=e.createBuffer(2,m,i),w=y.getChannelData(0),k=y.getChannelData(1);let b=c;for(let S=0;S<m;S++)w[S]=a.getInt16(b,!0)/32768,k[S]=a.getInt16(b+2,!0)/32768,b+=4;this.trackStemBuffers.set(p,y);const g=new Float32Array(o),v=Math.max(1,Math.floor(m/o));for(let S=0;S<o;S++){const E=S*v;let B=0;for(let M=0;M<v&&E+M<m;M+=4){const z=Math.max(Math.abs(w[E+M]),Math.abs(k[E+M]));z>B&&(B=z)}g[S]=B}this.trackStemPeaks.set(p,g),(!u||y.duration>u.duration)&&(u=y)}c+=f}return u}computeTrackMixerNodesState(t){if(!((this.soloTracks.size===0||this.soloTracks.has(t))&&!this.muteTracks.has(t)))return{gain:0,pan:0,monoDownmix:!1,peakScale:0};const a=this.trackStemBaseMeta.get(t)||{volume:.2,pan:0},s=this.trackLiveMeta.get(t)||a,i=Math.max(.005,a.volume||.2),n=Math.max(0,s.volume/i),r=Math.max(-1,Math.min(1,a.pan||0)),o=Math.max(-1,Math.min(1,s.pan||0));if(!(Math.abs(o-r)>.005))return{gain:n,pan:0,monoDownmix:!1,peakScale:n};const u=(r+1)*Math.PI/4,l=(Math.cos(u)+Math.sin(u))*.5,h=l>.05?1/l:1;return{gain:n*h,pan:o,monoDownmix:!0,peakScale:n}}syncMixerButtonsDOM(){this.trackListEl&&this.trackListEl.querySelectorAll(".sound-ms-btn").forEach(t=>{const e=t,a=e.getAttribute("data-track")||"",s=e.getAttribute("data-action");s==="mute"?e.classList.toggle("active",this.muteTracks.has(a)):s==="solo"&&e.classList.toggle("active",this.soloTracks.has(a))})}applyLiveTrackMixerState(){const t=this.audioCtx?this.audioCtx.currentTime:0;for(const[e,a]of this.activeStemNodes.entries()){const s=this.computeTrackMixerNodesState(e),i=s.monoDownmix?1:2,n=s.monoDownmix?"explicit":"max";a.pan.channelCount!==i&&(a.pan.channelCount=i,a.pan.channelCountMode=n),this.audioCtx?(a.gain.gain.cancelScheduledValues(t),a.gain.gain.setValueAtTime(a.gain.gain.value,t),a.gain.gain.setTargetAtTime(s.gain,t,.003),s.gain===0&&a.gain.gain.setValueAtTime(0,t+.015),a.pan.pan.cancelScheduledValues(t),a.pan.pan.setValueAtTime(a.pan.pan.value,t),a.pan.pan.setTargetAtTime(s.pan,t,.003)):(a.gain.gain.value=s.gain,a.pan.pan.value=s.pan)}this.drawVisualizerFrame()}renderMusicTrackMixer(t){if(t.length===0){this.trackListEl.innerHTML='<div class="sound-empty-note">No tracks found in song.</div>';return}for(const s of t)s.eventCount>0&&s.waveType&&this.trackMetaCache.set(s.name,{waveType:s.waveType,volume:s.volume,pan:s.pan});const e=document.activeElement;if(e&&this.trackListEl.contains(e)&&e.tagName==="INPUT"&&this.sliderDragSnapshotTaken)return;const a=this.editorTextarea.value;this.trackListEl.innerHTML=t.map(s=>{const i=this.muteTracks.has(s.name),n=this.soloTracks.has(s.name),r=this.trackMetaCache.get(s.name),o=/drum|perc|toms/i.test(s.name)||F.has((s.waveType||"").toLowerCase())||F.has((r?.waveType||"").toLowerCase()),c=s.defaultInst||(o?"kick":s.name),u=c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),l=a.match(new RegExp(`^\\s*(?:inst|patch)\\s+${u}\\b(.*)$`,"m")),h=l?l[1]:"",p=h.match(/\bwave=([^\s]+)/i),f=h.match(/\b(?:vol|volume)=([0-9.]+)/i),m=h.match(/\bpan=([-+0-9.]+)/i),y=p?p[1]:s.eventCount>0&&s.waveType?s.waveType:r?.waveType||s.waveType||"ym2612_brass",w=Ft(y),k=f?Number(f[1]):s.eventCount>0&&s.volume>0?s.volume:r?.volume??s.volume??.2,b=m?Number(m[1]):s.eventCount>0?s.pan:r?.pan??s.pan??0,g=Math.round(Math.max(1,Math.min(100,k*100))),v=Math.round(Math.max(-100,Math.min(100,b*100))),S=o?'<option value="kick" selected>Drum Kit</option>':X.map(E=>{const B=w===E.id?"selected":"";return`<option value="${E.id}" ${B}>${E.label}</option>`}).join("");return`
          <div class="sound-mixer-row" data-track="${this.escapeHtml(s.name)}" data-inst="${this.escapeHtml(c)}" data-wave="${this.escapeHtml(y)}">
            <div class="sound-mixer-left">
              <button
                type="button"
                class="sound-ms-btn mute ${i?"active":""}"
                data-action="mute"
                data-track="${this.escapeHtml(s.name)}"
                title="Mute ${this.escapeHtml(s.name)}"
              >M</button>
              <button
                type="button"
                class="sound-ms-btn solo ${n?"active":""}"
                data-action="solo"
                data-track="${this.escapeHtml(s.name)}"
                title="Solo ${this.escapeHtml(s.name)}"
              >S</button>
              <span class="sound-track-title">${this.escapeHtml(s.name)}</span>
            </div>

            <select
              class="sound-inst-select"
              data-track="${this.escapeHtml(s.name)}"
              data-inst="${this.escapeHtml(c)}"
              data-wave="${this.escapeHtml(y)}"
              aria-label="Instrument for ${this.escapeHtml(s.name)}"
              ${o?"disabled":""}
            >
              ${S}
            </select>

            <label class="sound-mini-slider" title="Track Volume (${g}%)">
              <span>Vol</span>
              <input
                type="range"
                class="track-vol-slider"
                data-track="${this.escapeHtml(s.name)}"
                data-inst="${this.escapeHtml(c)}"
                data-wave="${this.escapeHtml(y)}"
                min="1"
                max="100"
                step="1"
                value="${g}"
              />
            </label>

            <label class="sound-mini-slider" title="Stereo Pan (${v})">
              <span>Pan</span>
              <input
                type="range"
                class="track-pan-slider"
                data-track="${this.escapeHtml(s.name)}"
                data-inst="${this.escapeHtml(c)}"
                data-wave="${this.escapeHtml(y)}"
                min="-100"
                max="100"
                step="1"
                value="${v}"
              />
            </label>
          </div>
        `}).join(""),this.trackListEl.querySelectorAll(".sound-ms-btn").forEach(s=>{s.addEventListener("click",()=>{const i=s,n=i.getAttribute("data-track")||"",r=i.getAttribute("data-action");n&&(this.recordHistoryBeforeChange(),r==="mute"?this.muteTracks.has(n)?this.muteTracks.delete(n):(this.muteTracks.add(n),this.soloTracks.delete(n)):r==="solo"&&(this.soloTracks.has(n)?this.soloTracks.delete(n):(this.soloTracks.add(n),this.muteTracks.delete(n))),this.syncMixerButtonsDOM(),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?(this.exportWavNeedsResynth=!0,this.applyLiveTrackMixerState()):this.synthesizeAndPlay(!0,!0))})}),this.trackListEl.querySelectorAll(".sound-inst-select").forEach(s=>{s.addEventListener("change",()=>{const i=s,n=i.getAttribute("data-track")||"",r=i.getAttribute("data-inst")||"",o=i.getAttribute("data-wave")||"ym2612_brass",c=i.value,u=X.find(h=>h.id===c);if(!r||!u)return;this.recordHistoryBeforeChange(),this.updateMusicInstProperty(r,o,h=>`${h.replace(/\b(wave|wave_type|preset|gm|duty)=[^\s]+/gi,"").replace(/\s+/g," ").trim()} ${u.dslWave}`);const l=this.trackMetaCache.get(n);l&&(l.waveType=u.id),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!0)})}),this.trackListEl.querySelectorAll(".track-vol-slider").forEach(s=>{const i=s,n=r=>{const o=i.getAttribute("data-track")||"",c=i.getAttribute("data-inst")||"",u=i.getAttribute("data-wave")||"ym2612_brass";if(!c)return;const l=Number((r/100).toFixed(2)),h=l.toFixed(2);this.updateMusicInstProperty(c,u,m=>/\b(?:vol|volume)=[^\s]+/i.test(m)?m.replace(/\b(?:vol|volume)=[^\s]+/i,`vol=${h}`):`${m} vol=${h}`);const p=this.trackMetaCache.get(o);p&&(p.volume=l);const f=this.trackLiveMeta.get(o)||this.trackStemBaseMeta.get(o)||{pan:0};this.trackLiveMeta.set(o,{volume:l,pan:f.pan}),i.parentElement&&(i.parentElement.title=`Track Volume (${Math.round(r)}%)`),this.trackStemBuffers.size>0&&(this.dslDirty=!1,this.exportWavNeedsResynth=!0)};i.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),i.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.scheduleRealtimeSynthesize(!0,!0)}),i.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.synthesizeAndPlay(!0,!0)})}),this.trackListEl.querySelectorAll(".track-pan-slider").forEach(s=>{const i=s,n=r=>{const o=i.getAttribute("data-track")||"",c=i.getAttribute("data-inst")||"",u=i.getAttribute("data-wave")||"ym2612_brass";if(!c)return;const l=Number((r/100).toFixed(2)),h=l.toFixed(2);this.updateMusicInstProperty(c,u,m=>/\bpan=[^\s]+/i.test(m)?m.replace(/\bpan=[^\s]+/i,`pan=${h}`):`${m} pan=${h}`);const p=this.trackMetaCache.get(o);p&&(p.pan=l);const f=this.trackLiveMeta.get(o)||this.trackStemBaseMeta.get(o)||{volume:.2};this.trackLiveMeta.set(o,{volume:f.volume,pan:l}),i.parentElement&&(i.parentElement.title=`Stereo Pan (${Math.round(r)})`),this.trackStemBuffers.size>0&&(this.dslDirty=!1,this.exportWavNeedsResynth=!0)};i.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),i.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.scheduleRealtimeSynthesize(!0,!0)}),i.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.synthesizeAndPlay(!0,!0)})})}renderDiagnosticsAndStatus(t){const e=!!t.passed,a=typeof t.peakLeftDBFS=="number"?t.peakLeftDBFS.toFixed(1):"0.0";this.statusPillBtn.className=`sound-status-pill ${e?"pass":"fail"}`,this.statusPillBtn.textContent=e?`✓ Clean · ${a} dB`:`⚠ ${t.issues?.length||1} issue${(t.issues?.length||1)>1?"s":""}`;const s=typeof t.rmsDBFS=="number"?`${t.rmsDBFS.toFixed(1)} dB`:"-",i=typeof t.dcOffset=="number"?t.dcOffset.toFixed(4):"0.0000",n=this.activeDocType==="music"?`Low-Freq Energy: ${(t.lowFreqEnergyPct??0).toFixed(1)}%`:`Boundaries: ${t.boundaryClean!==!1?"Zero-click":"Click risk"}`,r=t.issues&&t.issues.length>0?`<ul class="sound-issues-list">${t.issues.map(o=>`<li>${this.escapeHtml(o)}</li>`).join("")}</ul>`:'<p class="sound-pass-note">Passes all headroom and anti-click checks.</p>';this.diagnosticsContainerEl.innerHTML=`
      <div class="sound-diag-summary">
        <span>Peak: <strong>${a} dBFS</strong></span>
        <span>RMS: <strong>${s}</strong></span>
        <span>DC: <strong>${i}</strong></span>
        <span>${n}</span>
      </div>
      ${r}
    `}ensureAudioContext(){if(!this.audioCtx){const t=window.AudioContext||window.webkitAudioContext;this.audioCtx=new t,this.analyser=this.audioCtx.createAnalyser(),this.analyser.fftSize=2048,this.analyser.smoothingTimeConstant=.78,this.analyser.connect(this.audioCtx.destination);const e=this.audioCtx.createWaveShaper(),a=65537,s=new Float32Array(a),i=28e3/32768,n=4767/32768;for(let r=0;r<a;r++){const o=r*2/(a-1)-1,c=Math.abs(o);if(c<=i)s[r]=o;else{const u=(c-i)/n,l=i+n*Math.tanh(u);s[r]=o<0?-l:l}}e.curve=s,e.oversample="none",e.connect(this.analyser),this.masterLimiterNode=e}return this.audioCtx.state==="suspended"&&this.audioCtx.resume().catch(()=>{}),this.audioCtx}async startBufferPlayback(t=0){if(!this.decodedBuffer)return;const e=this.ensureAudioContext();e.state==="suspended"&&await e.resume(),this.stopSourceNodeOnly();const a=Math.max(0,Math.min(t,Math.max(0,this.decodedBuffer.duration-.005)));if(this.playOffsetSec=a,this.playStartCtxTime=e.currentTime,this.isPlaying=!0,this.playBtnEl.textContent="Stop",this.activeDocType==="music"&&this.trackStemBuffers.size>0){const i=e.currentTime,n=this.masterLimiterNode||this.analyser;let r=null;for(const[o,c]of this.trackStemBuffers.entries()){const u=e.createBufferSource();u.buffer=c,u.loop=this.loopEnabled;const l=e.createGain(),h=e.createStereoPanner(),p=this.computeTrackMixerNodesState(o);l.gain.value=p.gain,h.channelCount=p.monoDownmix?1:2,h.channelCountMode=p.monoDownmix?"explicit":"max",h.pan.value=p.pan,u.connect(l),l.connect(h),h.connect(n),this.activeStemNodes.set(o,{source:u,gain:l,pan:h}),(!r||c.duration>=(r.buffer?.duration||0))&&(r=u)}r&&(this.sourceNode=r,r.onended=()=>{this.sourceNode===r&&!this.loopEnabled&&(this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl.textContent="Play",this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame())});for(const o of this.activeStemNodes.values()){const c=Math.min(a,Math.max(0,(o.source.buffer?.duration||0)-.005));o.source.start(i,c)}this.startVisualizerLoop();return}const s=e.createBufferSource();s.buffer=this.decodedBuffer,s.loop=this.loopEnabled,s.connect(this.analyser),this.sourceNode=s,s.onended=()=>{this.sourceNode===s&&!this.loopEnabled&&(this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl.textContent="Play",this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame())},s.start(0,a),this.startVisualizerLoop()}stopSourceNodeOnly(){if(this.sourceNode){try{this.sourceNode.onended=null,this.sourceNode.stop(),this.sourceNode.disconnect()}catch{}this.sourceNode=null}if(this.activeStemNodes.size>0){for(const t of this.activeStemNodes.values()){try{t.source.onended=null,t.source.stop()}catch{}try{t.source.disconnect(),t.gain.disconnect(),t.pan.disconnect()}catch{}}this.activeStemNodes.clear()}}stopPlayback(){this.stopSourceNodeOnly(),this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl&&(this.playBtnEl.textContent="Play"),this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame()}getCurrentPlayheadSec(){if(!this.decodedBuffer)return 0;if(!this.isPlaying||!this.audioCtx)return this.playOffsetSec;const t=this.audioCtx.currentTime-this.playStartCtxTime+this.playOffsetSec,e=this.decodedBuffer.duration||1;return this.loopEnabled?t%e:Math.min(e,t)}startVisualizerLoop(){this.rafId!==null&&cancelAnimationFrame(this.rafId);const t=()=>{if(this.decodedBuffer){const e=this.getCurrentPlayheadSec();this.updateTimeReadout(e,this.decodedBuffer.duration)}this.drawVisualizerFrame(),this.isPlaying&&(this.rafId=requestAnimationFrame(t))};this.rafId=requestAnimationFrame(t)}updateTimeReadout(t,e){if(this.timeReadoutEl.textContent=`${t.toFixed(2)}s / ${e.toFixed(2)}s`,e>0){const a=Math.max(0,Math.min(1,t/e));this.scrubSliderEl.value=String(Math.round(a*1e3))}else this.scrubSliderEl.value="0"}drawVisualizerFrame(){const t=this.canvasEl;if(!t)return;const e=t.getContext("2d");if(!e)return;const a=t.width,s=t.height;e.clearRect(0,0,a,s),this.visualizerMode==="spectrum"?this.drawSpectrumView(e,a,s):this.drawWaveformView(e,a,s)}drawWaveformView(t,e,a){const s=a/2;if(t.strokeStyle="rgba(148, 163, 184, 0.14)",t.lineWidth=1,t.beginPath(),t.moveTo(0,s),t.lineTo(e,s),t.stroke(),this.activeDocType==="music"&&this.trackStemPeaks.size>0){t.fillStyle="rgba(99, 102, 241, 0.32)";const i=[];for(const[o,c]of this.trackStemPeaks.entries()){const u=this.computeTrackMixerNodesState(o);u.peakScale>0&&i.push({peaks:c,scale:u.peakScale})}const n=28e3/32768,r=4767/32768;for(let o=0;o<e;o++){let c=0;for(let l=0;l<i.length;l++){const h=i[l],p=Math.min(h.peaks.length-1,Math.floor(o/e*h.peaks.length));c+=h.peaks[p]*h.scale}c>n&&(c=n+r*Math.tanh((c-n)/r));const u=Math.min(s-6,c*(s-8));t.fillRect(o,s-u,1,u*2)}}else if(this.decodedBuffer){const i=this.decodedBuffer.getChannelData(0),n=this.decodedBuffer.numberOfChannels>1?this.decodedBuffer.getChannelData(1):i,r=i.length,o=Math.max(1,Math.floor(r/e));t.fillStyle="rgba(99, 102, 241, 0.32)",t.strokeStyle="rgba(129, 140, 248, 0.9)",t.lineWidth=1.25,t.beginPath();for(let c=0;c<e;c++){const u=c*o;let l=0;for(let p=0;p<o&&u+p<r;p+=4){const f=Math.max(Math.abs(i[u+p]),Math.abs(n[u+p]));f>l&&(l=f)}const h=Math.min(s-6,l*(s-8));t.fillRect(c,s-h,1,h*2)}}if(this.isPlaying&&this.analyser){const i=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(i),t.strokeStyle="#38bdf8",t.lineWidth=2,t.beginPath();const n=e/i.length;let r=0;for(let o=0;o<i.length;o++){const u=i[o]/128*a/2;o===0?t.moveTo(r,u):t.lineTo(r,u),r+=n}t.stroke()}if(this.decodedBuffer&&this.decodedBuffer.duration>0){const i=this.getCurrentPlayheadSec(),n=Math.max(0,Math.min(e,i/this.decodedBuffer.duration*e));t.strokeStyle="#f59e0b",t.lineWidth=2,t.beginPath(),t.moveTo(n,0),t.lineTo(n,a),t.stroke()}}drawSpectrumView(t,e,a){const i=Math.floor(e*.24);if(t.fillStyle="rgba(16, 185, 129, 0.08)",t.fillRect(0,0,i,a),this.analyser&&this.isPlaying){const n=new Uint8Array(this.analyser.frequencyBinCount);this.analyser.getByteFrequencyData(n);const r=64,o=e/r;for(let c=0;c<r;c++){const u=c/r,l=Math.min(n.length-1,Math.floor(Math.pow(u,2)*(n.length*.45))),h=n[l]/255,p=Math.max(2,h*(a-16)),f=c*o,m=a-p;t.fillStyle=f<i?"#10b981":"#6366f1",t.fillRect(f+1,m,Math.max(2,o-2),p)}}}async saveCurrentFile(){const t=this.editorTextarea.value;if(!t.trim())return;let e=this.activeFilePath;if(!e){const a=T()||"",s=a?`${a.replace(/\/+$/,"")}/${this.activeFileName}`:this.activeFileName,i=window.prompt("Save file path:",s);if(!i||!i.trim())return;e=i.trim()}this.saveBtnEl.disabled=!0;try{const a=await C("/api/sound/file/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:e,content:t})}),s=await a.json().catch(()=>({}));if(!a.ok)throw new Error(s.error||`Failed to save (HTTP ${a.status})`);this.activeFilePath=s.filePath||e,this.activeFileName=this.activeFilePath.split(/[\\/]/).pop()||this.activeFileName,x.success(`Saved ${this.activeFileName}`),await this.refreshFilesCatalog()}catch(a){x.error("Save Failed",a?.message||String(a))}finally{this.saveBtnEl.disabled=!1}}async exportCurrentWav(){let t=this.lastBuildId;if(!t||this.dslDirty||this.activeDocType==="music"&&(this.exportWavNeedsResynth||this.soloTracks.size>0||this.muteTracks.size>0)){const i=this.editorTextarea.value.trim();if(!i)return;const n=await C("/api/sound/synthesize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dsl:i,type:this.activeDocType,apple:this.activeDocType==="music"?this.useAppleSynth:!1,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks)})}),r=await n.json().catch(()=>({}));if(!n.ok||!r.buildId){x.error("Export Failed",r.error||r.report?.error||"Could not synthesize WAV for export");return}t=r.buildId,this.exportWavNeedsResynth=!1}const a=`${this.activeFileName.replace(/\.(music|sfx)$/i,"")||"sound_export"}.wav`,s=document.createElement("a");s.href=`/api/sound/wav?buildId=${encodeURIComponent(t)}`,s.download=a,document.body.appendChild(s),s.click(),s.remove(),x.success(`Downloaded ${a}`)}async sendToChat(){const t=this.editorTextarea.value.trim(),e=this.chatNoteInputEl.value.trim();if(!(!t&&!e)){this.sendChatBtnEl.disabled=!0;try{const s=[`### Sound Studio: \`${this.activeFilePath||this.activeFileName}\``,e?`
**Request**: ${e}`:"",`
\`\`\`${this.activeDocType}`,t,"```"].filter(Boolean).join(`
`),i=window.sidecar?.conversationId||A()||"standalone";if(window.sidecar?.agent?.sendMessage)await window.sidecar.agent.sendMessage(s,i!=="standalone"?i:void 0);else{const n=await C("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:i,buildError:s,note:e,workspace:T()||"."})});if(!n.ok){const r=await n.json().catch(()=>({}));throw new Error(r.error||`Failed to send (HTTP ${n.status})`)}}x.success("Sent to chat"),this.chatNoteInputEl.value=""}catch(a){x.error("Failed to Send",a?.message||String(a))}finally{this.sendChatBtnEl.disabled=!1}}}escapeHtml(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}}function Dt(){const d=window.location.pathname||"/",t=new URLSearchParams(window.location.search),e=(t.get("view")||"").trim().toLowerCase(),a=(t.get("file")||t.get("path")||t.get("uri")||"").trim().toLowerCase();return d.startsWith("/sound")||e==="sound"||a.endsWith(".music")||a.endsWith(".sfx")?"sound":"playtest"}function tt(){try{const d=ct(),t=d==="preview"?"studio-mode-preview":"studio-mode-full";document.body.classList.remove("studio-mode-preview","studio-mode-full"),document.body.classList.add("studio-container",t),d==="preview"?document.body.classList.add("bg-transparent"):document.body.classList.remove("bg-transparent");const e=document.getElementById("app");e&&(e.classList.remove("studio-mode-preview","studio-mode-full"),e.classList.add("studio-container",t));const a=document.getElementById("app-root");a&&(a.classList.remove("studio-mode-preview","studio-mode-full"),a.classList.add("studio-container",t));const s=document.getElementById("header-bar"),i=document.getElementById("annotation-bar"),n=document.getElementById("viewport-container"),r=document.getElementById("bug-report-bar");if(!a||!s||!i||!n||!r)throw new Error("Required DOM containers not found for Game Studio. Missing: "+[!a&&"#app-root",!s&&"#header-bar",!i&&"#annotation-bar",!n&&"#viewport-container",!r&&"#bug-report-bar"].filter(Boolean).join(", "));let o=document.getElementById("studio-top-nav");o||(o=document.createElement("nav"),o.id="studio-top-nav",o.className="studio-top-nav",o.setAttribute("aria-label","Studio Workspace"),o.innerHTML=`
        <div class="studio-top-tabs" role="tablist" aria-label="Studio Mode">
          <button
            type="button"
            id="top-tab-playtest"
            class="studio-top-tab"
            role="tab"
            aria-selected="true"
          >
            Playtest
          </button>
          <button
            type="button"
            id="top-tab-sound"
            class="studio-top-tab"
            role="tab"
            aria-selected="false"
          >
            Sound
          </button>
        </div>
      `,a.insertBefore(o,a.firstChild));const c=o.querySelector("#top-tab-playtest"),u=o.querySelector("#top-tab-sound");let l=document.getElementById("sound-studio-root");l||(l=document.createElement("div"),l.id="sound-studio-root",l.className="sound-studio-root hidden",a.appendChild(l));let h=null,p=null,f=Dt();const m=v=>{try{const S=new URLSearchParams(window.location.search);S.has("view")&&S.set("view",v);const E=v==="sound"?"/sound":"/playtest",B=S.toString(),M=`${E}${B?`?${B}`:""}`;window.location.pathname+window.location.search!==M&&window.history.replaceState({view:v},"",M)}catch{}document.title=v==="sound"?"Sound Studio":"Playtest Studio"},y=()=>(h||(h=new Mt({headerEl:s,annotationBarEl:i,viewportEl:n,bugBarEl:r})),h),w=()=>(p||(p=new It({rootEl:l,onSwitchToPlaytest:()=>k("playtest")})),p),k=(v,S=!0)=>{f=v;const E=v==="sound";c&&u&&(c.classList.toggle("active",!E),c.setAttribute("aria-selected",String(!E)),u.classList.toggle("active",E),u.setAttribute("aria-selected",String(E))),E?(h&&h.runner.isRunning()&&!h.runner.isPaused()&&h.runner.setPaused(!0),s.classList.add("studio-view-hidden"),i.classList.add("studio-view-hidden"),n.classList.add("studio-view-hidden"),r.classList.add("studio-view-hidden"),l.classList.remove("hidden"),w()):(p&&p.stopPlayback(),l.classList.add("hidden"),s.classList.remove("studio-view-hidden"),i.classList.remove("studio-view-hidden"),n.classList.remove("studio-view-hidden"),r.classList.remove("studio-view-hidden"),y()),S&&m(v)};c?.addEventListener("click",()=>k("playtest")),u?.addEventListener("click",()=>k("sound"));const b=window.location.pathname||"/",g=b.startsWith("/sound")||b.startsWith("/playtest");k(f,g),console.log(`[Game Studio] Initialized "${f}" view in "${d}" mode`)}catch(d){console.error("[Game Studio] Initialization error:",d),x.fatal("Game Studio Initialization Failed",d)}}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",tt,{once:!0}):tt();window.addEventListener("error",d=>{console.error("[Game Studio] Uncaught Window Error:",d),x.fatal("Uncaught Runtime Error",d.error||d.message)});window.addEventListener("unhandledrejection",d=>{console.error("[Game Studio] Unhandled Promise Rejection:",d),x.fatal("Unhandled Promise Rejection",d.reason)});
