(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function e(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(a){if(a.ep)return;a.ep=!0;const i=e(a);fetch(a.href,i)}})();let it=null,gt=null;const Ht=[],Ot=[];function dt(c){if(typeof c=="number"&&Number.isFinite(c))return!0;if(typeof c!="string")return!1;const t=c.trim();return t.length>0&&!(t.startsWith("__")&&t.endsWith("__"))}async function P(c,t={}){const e=c.startsWith("http://")||c.startsWith("https://")?c:`${wt()}${c}`;return window.sidecar&&typeof window.sidecar.fetch=="function"?window.sidecar.fetch(e,t):fetch(e,t)}function wt(){const c=window.__STUDIO_CONFIG__?.apiBaseUrl;return dt(c)?String(c).trim().replace(/\/+$/,""):""}const lt=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;function Qt(){const c=window.sidecar?.conversationId?.trim();if(c&&lt.test(c))return c;const t=new URLSearchParams(window.location.search),e=(t.get("conversationId")||t.get("session_id")||t.get("sessionId"))?.trim();if(e&&dt(e)&&lt.test(e))return e;const s=window.__STUDIO_CONFIG__?.sessionId;if(dt(s)){const i=String(s).trim();if(lt.test(i))return i}const a=(t.get("file")||t.get("path"))?.trim();if(a){const i=a.replace(/\\/g,"/").match(/\/brain\/([a-zA-Z0-9_-]{1,128})\//);if(i&&i[1]!=="tempmediaStorage"&&lt.test(i[1]))return i[1]}return""}async function zt(){if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const c=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(t=>setTimeout(()=>t([]),1e3))]);return Array.isArray(c)?c:[]}catch{return[]}return[]}function nt(){return it===null&&(it=Qt()),it}function J(){const c=nt();return c||null}function Gt(c){const t=c.trim();if(!t||!lt.test(t))throw new Error(`Invalid session_id "${c}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`);it=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.sessionId=t);for(const e of Ht)e(t)}function yt(c){Gt(c)}function te(c){Ht.push(c)}function ee(){const t=new URLSearchParams(window.location.search).get("workspace")?.trim();if(t&&dt(t))return t;const e=window.__STUDIO_CONFIG__?.workspace;return dt(e)?String(e).trim():""}function D(){return gt===null&&(gt=ee()),gt}function et(c){const t=c.trim();gt=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.workspace=t);for(const e of Ot)e(t)}function jt(c){Ot.push(c)}function se(){return new URLSearchParams(window.location.search).get("mode")==="preview"||window.__STUDIO_CONFIG__?.mode==="preview"?"preview":"full"}function St(){const c=window.location.protocol==="http:"||window.location.protocol==="https:"?window.location.origin:wt(),t=nt()||"standalone",e=D(),s=new URLSearchParams({mode:"full",conversationId:t}),a=new URLSearchParams(window.location.search).get("token");return a&&s.set("token",a),e&&s.set("workspace",e),`${c}/?${s.toString()}`}async function vt(c){const t=await P("/api/workspace/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceUri:c})});if(!t.ok){const e=await t.json().catch(()=>({}));throw new Error(e.error||`Failed to resolve workspace URI: HTTP ${t.status}`)}return await t.json()}async function ae(){const c=await P("/api/health",{method:"GET",cache:"no-store"});if(!c.ok)throw new Error(`Failed to fetch sidecar health: HTTP ${c.status} ${c.statusText}`);const t=await c.json();return t.activeSessionId&&!nt()&&Gt(t.activeSessionId),t.defaultWorkspace&&!D()&&et(t.defaultWorkspace),t}let Lt=!1,ot=null;async function Ct(){if(window.sidecar?.conversationId&&!J())try{yt(window.sidecar.conversationId)}catch{}return!Lt&&window.sidecar&&typeof window.sidecar.onWorkspaceChange=="function"&&(Lt=!0,window.sidecar.onWorkspaceChange(c=>{Array.isArray(c)&&c.length>0&&c[0]&&vt(c[0]).then(t=>{t.workspace&&et(t.workspace)}).catch(()=>{})})),ot||(ot=(async()=>{let c=!1;if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const t=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(e=>setTimeout(()=>e([]),1200))]);if(Array.isArray(t)&&t.length>0&&t[0]){const e=await vt(t[0]);e.workspace&&(et(e.workspace),c=!0)}}catch{}try{const t=await ae();if(t.activeSessionId&&!J()&&yt(t.activeSessionId),!c&&!D()&&t.defaultWorkspace){const e=await vt(t.defaultWorkspace);e.workspace&&et(e.workspace)}}catch{}return D()})().finally(()=>{ot=null}),ot)}async function ie(){const c=await P("/api/session/active",{method:"GET",cache:"no-store"});if(!c.ok)throw new Error(`Failed to fetch active session ID: HTTP ${c.status} ${c.statusText}`);const t=await c.json(),e=typeof t.sessionId=="string"&&t.sessionId?t.sessionId:null;return e&&!it&&(it=e),e}async function ne(){const c=await P("/api/sessions",{method:"GET",cache:"no-store"});if(!c.ok)throw new Error(`Failed to fetch recent sessions: HTTP ${c.status} ${c.statusText}`);const t=await c.json();return Array.isArray(t.sessions)?t.sessions:[]}async function re(c){const t=c.workspace.trim();if(!t)throw new Error("Workspace path is required to compile Go WASM.");const e=c.pkg?.trim()||void 0,s=await P("/api/playtest/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:t,pkg:e})}),a=await s.text();let i={};if(a.trim())try{i=JSON.parse(a)}catch{throw new Error(`Unexpected non-JSON response from /api/playtest/build (HTTP ${s.status}): ${a.slice(0,300)}`)}if(s.status===422)return{ok:!1,status:422,error:i.error||"Go WASM compilation failed",compilerOutput:i.compilerOutput||i.stderr||i.error||a,workspace:i.workspace||t,pkg:i.pkg||e||".",exitCode:typeof i.exitCode=="number"?i.exitCode:1};if(!s.ok)throw new Error(i.error||`WASM build request failed with HTTP ${s.status} ${s.statusText}`);return{ok:!0,status:200,buildId:i.buildId,workspace:i.workspace||t,pkg:i.pkg||e||".",wasmBytes:i.wasmBytes??0,durationMs:i.durationMs??0,wasmUrl:i.wasmUrl||`/api/playtest/wasm?buildId=${encodeURIComponent(i.buildId)}`,wasmExecUrl:i.wasmExecUrl||"/api/playtest/wasm_exec.js"}}async function At(c){const t=c.sessionId||window.sidecar?.conversationId||nt()||"standalone",e=c.workspace||D(),s=c.pkg||".",a=c.filename||`playtest-bug-${Date.now()}.png`,i=await P("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,filename:a,image:c.imageDataUrl,note:c.note||"",consoleLogs:c.consoleLogs||[],workspace:e,pkg:s,metadata:{workspace:e,pkg:s,frameOffset:c.frameOffset??"live",resolution:c.resolution||(c.width&&c.height?`${c.width}x${c.height}`:"canvas"),width:c.width,height:c.height}})}),n=await i.text();let r={};try{r=n?JSON.parse(n):{}}catch{r={error:n}}if(!i.ok)throw new Error(r.error||`Failed to send bug report to chat: HTTP ${i.status} ${i.statusText}`);return r}async function oe(c){const t=c.sessionId||window.sidecar?.conversationId||nt()||"standalone",e=c.workspace||D(),s=c.pkg||".",a=await P("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,buildError:c.buildError,note:c.note||"",workspace:e,pkg:s,metadata:{workspace:e,pkg:s}})}),i=await a.text();let n={};try{n=i?JSON.parse(i):{}}catch{n={error:i}}if(!a.ok)throw new Error(n.error||`Failed to send build error to chat: HTTP ${a.status} ${a.statusText}`);return n}function le(){const t=document.querySelector(".studio-top-tab.active")?.dataset?.view||"",e=new URLSearchParams(window.location.search),s=(e.get("tab")||"").trim().toLowerCase(),a=t||s||"playtest",i=a==="sound"?"Sound":a==="sprite"||a==="sprites"?"Sprites":"Playtest";let n=(e.get("file")||e.get("path")||"").trim();if(a==="sprite"||a==="sprites"){const o=document.getElementById("spr-active-file-badge")?.getAttribute("title")?.trim()||"";o&&o!=="No sprite loaded"&&(n=o)}else if(a==="sound"){const o=document.getElementById("sound-active-file-label")?.getAttribute("title")?.trim()||"";o&&!/^Untitled\.(sfx|music)$/i.test(o)&&(n=o)}return{tab:i,filePath:n}}async function Pt(c){const t=c.sessionId||window.sidecar?.conversationId||nt()||"standalone",e=c.workspace||D()||".",s=le(),a=c.tab||s.tab,i=c.filePath??s.filePath,n=c.errorTitle.trim()||"Game Dev Studio Error",r=c.errorDetail&&c.errorDetail.trim()||n,o=await P("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,errorTitle:n,studioError:r,workspace:e,metadata:{workspace:e,tab:a,filePath:i}})}),d=await o.text();let h={};try{h=d?JSON.parse(d):{}}catch{h={error:d}}if(!o.ok)throw new Error(h.error||`Failed to send error to agent: HTTP ${o.status} ${o.statusText}`);return h}async function Bt(c){const t=await zt(),e=new URLSearchParams,s=J();s&&e.set("session_id",s),t.length>0&&t[0]?e.set("workspace_uri",t[0]):D()&&e.set("workspace",D());const a=e.toString(),i=await P(`/api/fs/info${a?`?${a}`:""}`,{method:"GET",cache:"no-store"});if(!i.ok){const n=await i.json().catch(()=>({}));throw new Error(n.error||`Failed to fetch filesystem info: HTTP ${i.status}`)}return await i.json()}async function Tt(c,t="all",e){const s=new URLSearchParams;c&&c.trim()&&s.set("dir",c.trim()),s.set("filter",t),e&&e.length>0&&s.set("extensions",e.join(","));const a=await P(`/api/fs/list?${s.toString()}`,{method:"GET",cache:"no-store"});if(!a.ok){const i=await a.json().catch(()=>({}));throw new Error(i.error||`Failed to list directory "${c}": HTTP ${a.status}`)}return await a.json()}async function ce(c){const t=await Tt(c,"project");return{workspace:t.dir||c,pkg:t.defaultPkg||".",packages:Array.isArray(t.packages)&&t.packages.length>0?t.packages:["."],hasGoMod:!!t.hasGoMod}}class de{maxFrames;captureIntervalMs;slots;writePtr=0;count=0;sequence=0;lastCaptureTimeMs=-1/0;constructor(t=250,e=40){if(!Number.isInteger(t)||t<1)throw new Error(`[FrameDvrBuffer] Invalid maxFrames=${t}. Must be a positive integer.`);if(!Number.isFinite(e)||e<1)throw new Error(`[FrameDvrBuffer] Invalid captureIntervalMs=${e}. Must be a positive number.`);this.maxFrames=t,this.captureIntervalMs=e,this.slots=new Array(t).fill(null)}get length(){return this.count}shouldCapture(t){return t-this.lastCaptureTimeMs>=this.captureIntervalMs}recordFrame(t,e=performance.now()){if(!t||typeof t.toDataURL!="function"||typeof t.width!="number"||typeof t.height!="number")throw new Error("[FrameDvrBuffer] recordFrame requires a valid canvas element with width, height, and toDataURL().");if(t.width<=0||t.height<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${t.width}x${t.height}).`);const s=t.toDataURL("image/png");return this.recordFrameDataUrl(s,t.width,t.height,e)}recordFrameDataUrl(t,e,s,a=performance.now()){if(typeof t!="string"||!t.startsWith("data:image/"))throw new Error("[FrameDvrBuffer] Canvas toDataURL() did not return a valid image data URI.");if(!Number.isFinite(e)||!Number.isFinite(s)||e<=0||s<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${e}x${s}).`);const i=++this.sequence,n={frameNumber:i,timestampMs:a,width:e,height:s,dataUrl:t};return this.slots[this.writePtr]=n,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=a,{index:this.count-1,frameNumber:i,timestampMs:a,relativeSec:0,width:n.width,height:n.height,dataUrl:n.dataUrl}}recordCanvasSlot(t,e,s,a){const n={frameNumber:++this.sequence,timestampMs:a,width:e,height:s,dataUrl:"",canvas:t};this.slots[this.writePtr]=n,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=a}recordFrameIfDue(t,e=performance.now()){return this.shouldCapture(e)?this.recordFrame(t,e):null}createDvrFrameFromSlot(t,e,s){return{index:e,frameNumber:t.frameNumber,timestampMs:t.timestampMs,relativeSec:s,width:t.width,height:t.height,canvas:t.canvas,get dataUrl(){return!t.dataUrl&&t.canvas&&(t.dataUrl=t.canvas.toDataURL("image/png")),t.dataUrl}}}getFrames(){if(this.count===0)return[];const t=this.count<this.maxFrames?0:this.writePtr,e=(t+this.count-1)%this.maxFrames,s=this.slots[e],a=s?s.timestampMs:0,i=new Array(this.count);for(let n=0;n<this.count;n++){const r=(t+n)%this.maxFrames,o=this.slots[r],d=(o.timestampMs-a)/1e3,h=d===0?0:Number(d.toFixed(2));i[n]=this.createDvrFrameFromSlot(o,n,h)}return i}getFrameAt(t){if(!Number.isInteger(t)||t<0||t>=this.count)return null;const e=this.count<this.maxFrames?0:this.writePtr,s=(e+t)%this.maxFrames,a=this.slots[s];if(!a)return null;const i=(e+this.count-1)%this.maxFrames,n=this.slots[i],r=n?n.timestampMs:a.timestampMs,o=(a.timestampMs-r)/1e3,d=o===0?0:Number(o.toFixed(2));return this.createDvrFrameFromSlot(a,t,d)}getLatestFrame(){return this.count===0?null:this.getFrameAt(this.count-1)}clear(){this.slots.fill(null),this.writePtr=0,this.count=0,this.lastCaptureTimeMs=-1/0}}function he(){const c=new Uint8Array(768);let t=0;const e=(n,r,o)=>{t>=256||(c[t*3]=n,c[t*3+1]=r,c[t*3+2]=o,t++)},s=[0,51,102,153,204,255];for(let n=0;n<6;n++)for(let r=0;r<6;r++)for(let o=0;o<6;o++)e(s[n],s[r],s[o]);for(let n=0;n<24;n++){const r=Math.round(8+n*238/23);e(r,r,r)}const a=[[239,68,68],[250,204,21],[6,182,212],[34,197,94],[255,255,255],[9,13,22],[11,15,26],[16,23,38],[20,12,14],[56,189,248],[244,63,94],[168,85,247],[16,185,129],[245,158,11],[99,102,241],[236,72,153]];for(const[n,r,o]of a)e(n,r,o);const i=new Uint8Array(32768);for(let n=0;n<32;n++){const r=n<<3|n>>2;for(let o=0;o<32;o++){const d=o<<3|o>>2;for(let h=0;h<32;h++){const l=h<<3|h>>2;let u=0,m=1/0;for(let f=0;f<256;f++){const p=c[f*3],x=c[f*3+1],S=c[f*3+2],E=r-p,v=d-x,g=l-S,b=E*E*2+v*v*4+g*g;if(b<m&&(m=b,u=f,b===0))break}i[n<<10|o<<5|h]=u}}}return{palette:c,lut15:i}}let Et=null;function ue(){return Et||(Et=he()),Et}class pe{buf;length=0;constructor(t=262144){this.buf=new Uint8Array(t)}ensure(t){const e=this.length+t;if(e<=this.buf.length)return;let s=this.buf.length*2;for(;s<e;)s*=2;const a=new Uint8Array(s);a.set(this.buf.subarray(0,this.length)),this.buf=a}writeByte(t){this.ensure(1),this.buf[this.length++]=t&255}writeUint16LE(t){this.ensure(2),this.buf[this.length++]=t&255,this.buf[this.length++]=t>>8&255}writeBytes(t){this.ensure(t.length),this.buf.set(t,this.length),this.length+=t.length}writeAscii(t){this.ensure(t.length);for(let e=0;e<t.length;e++)this.buf[this.length++]=t.charCodeAt(e)&255}toUint8Array(){return this.buf.slice(0,this.length)}}function me(c,t,e){c.writeByte(8);let n=9,r=258,o=(1<<n)-1;e.fill(-1);const d=new Uint8Array(255);let h=0,l=0,u=0;const m=()=>{h>0&&(c.writeByte(h),c.writeBytes(d.subarray(0,h)),h=0)},f=p=>{for(l|=p<<u,u+=n;u>=8;)d[h++]=l&255,h===255&&m(),l>>=8,u-=8};if(f(256),t.length>0){let p=t[0];for(let x=1;x<t.length;x++){const S=t[x],E=p<<8|S,v=e[E];v!==-1?p=v:(f(p),r<4096?(e[E]=r,r>o&&n<12&&(n++,o=(1<<n)-1),r++):(f(256),e.fill(-1),n=9,r=258,o=(1<<n)-1),p=S)}f(p)}f(257),u>0&&(d[h++]=l&255),m(),c.writeByte(0)}function fe(c){const{width:t,height:e,frames:s}=c;if(!Number.isInteger(t)||!Number.isInteger(e)||t<=0||e<=0)throw new Error(`[GifEncoder] Invalid GIF dimensions: ${t}x${e}.`);if(!Array.isArray(s)||s.length===0)throw new Error("[GifEncoder] encodeAnimatedGif requires at least 1 frame.");const a=t*e*4;for(let l=0;l<s.length;l++){const u=s[l];if(!u||!u.rgba||u.rgba.length!==a)throw new Error(`[GifEncoder] Frame ${l} RGBA length (${u?.rgba?.length??0}) does not match ${t}x${e}x4 (${a}).`)}const{palette:i,lut15:n}=ue(),r=new pe(Math.max(65536,t*e*Math.min(s.length,8)));r.writeAscii("GIF89a"),r.writeUint16LE(t),r.writeUint16LE(e),r.writeByte(247),r.writeByte(0),r.writeByte(0),r.writeBytes(i),r.writeBytes([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);const o=t*e,d=new Uint8Array(o),h=new Int32Array(4096*256);for(let l=0;l<s.length;l++){const u=s[l],m=u.rgba,f=Math.max(2,Math.round((u.delayMs||66)/10));for(let p=0,x=0;p<o;p++,x+=4){const S=m[x]>>3,E=m[x+1]>>3,v=m[x+2]>>3;d[p]=n[S<<10|E<<5|v]}r.writeBytes([33,249,4,0]),r.writeUint16LE(f),r.writeBytes([0,0]),r.writeByte(44),r.writeUint16LE(0),r.writeUint16LE(0),r.writeUint16LE(t),r.writeUint16LE(e),r.writeByte(0),me(r,d,h)}return r.writeByte(59),r.toUint8Array()}function Ft(c,t,e){if(t<=0||e<=0||c.length<t*e*4)return{x:0,y:0,width:Math.max(1,t),height:Math.max(1,e)};const s=(t*e-1)*4,a=c[3],i=c[s+3],n=a===0||i===0,r=c[0],o=c[1],d=c[2],h=!n&&r<=12&&o<=16&&d<=26&&Math.abs(c[s]-r)<=2&&Math.abs(c[s+1]-o)<=2&&Math.abs(c[s+2]-d)<=2,l=g=>{const b=c[g+3];return n?b>16:h?b>16&&(Math.abs(c[g]-r)>2||Math.abs(c[g+1]-o)>2||Math.abs(c[g+2]-d)>2):b>16&&(c[g]>0||c[g+1]>0||c[g+2]>0)};let u=0,m=!1;for(let g=0;g<e;g++){const b=g*t*4;for(let y=0;y<t;y+=2)if(l(b+y*4)){u=g,m=!0;break}if(m)break}if(!m)return{x:0,y:0,width:t,height:e};let f=e-1;for(let g=e-1;g>=u;g--){const b=g*t*4;let y=!1;for(let w=0;w<t;w+=2)if(l(b+w*4)){f=g,y=!0;break}if(y)break}let p=0,x=!1;for(let g=0;g<t;g++){for(let b=u;b<=f;b+=2)if(l((b*t+g)*4)){p=g,x=!0;break}if(x)break}let S=t-1;for(let g=t-1;g>=p;g--){let b=!1;for(let y=u;y<=f;y+=2)if(l((y*t+g)*4)){S=g,b=!0;break}if(b)break}const E=S-p+1,v=f-u+1;return E<64||v<36?{x:0,y:0,width:t,height:e}:{x:p,y:u,width:E,height:v}}function ge(c){const e=[];for(let a=0;a<c.length;a+=32768){const i=c.subarray(a,a+32768);e.push(String.fromCharCode(...i))}const s=e.join("");return`data:image/gif;base64,${btoa(s)}`}const Vt=[{name:"Red",hex:"#EF4444"},{name:"Yellow",hex:"#FACC15"},{name:"Cyan",hex:"#06B6D4"},{name:"Lime",hex:"#22C55E"},{name:"White",hex:"#FFFFFF"}];function ve(c,t){const e=c.replace(/^#/,"").trim();if(e.length===3){const s=parseInt(e[0]+e[0],16),a=parseInt(e[1]+e[1],16),i=parseInt(e[2]+e[2],16);return`rgba(${s}, ${a}, ${i}, ${t})`}if(e.length===6){const s=parseInt(e.slice(0,2),16),a=parseInt(e.slice(2,4),16),i=parseInt(e.slice(4,6),16);return`rgba(${s}, ${a}, ${i}, ${t})`}return`rgba(239, 68, 68, ${t})`}function Xt(c){return c.type==="pen"?{...c,points:c.points.map(t=>({x:t.x,y:t.y}))}:{...c}}function Z(c){return c.map(Xt)}class ye{baseCanvas;overlayCanvas;onHistoryChange;activeTool="box";activeColor=Vt[0].hex;strokeWidth=3;shapes=[];undoStack=[];redoStack=[];isDrawing=!1;draftShape=null;shapeCounter=0;activeTextInputEl=null;width;height;hasBaseSnapshot=!1;constructor(t={}){this.baseCanvas=t.baseCanvas??null,this.overlayCanvas=t.overlayCanvas??null,this.onHistoryChange=t.onHistoryChange??null,this.width=t.width??(this.baseCanvas?.width||640),this.height=t.height??(this.baseCanvas?.height||360),this.baseCanvas&&(this.baseCanvas.width=this.width,this.baseCanvas.height=this.height),this.overlayCanvas&&(this.overlayCanvas.width=this.width,this.overlayCanvas.height=this.height,this.bindPointerEvents(this.overlayCanvas))}getTool(){return this.activeTool}setTool(t){this.commitOrCloseActiveTextInput(),this.activeTool=t}getColor(){return this.activeColor}setColor(t){if(!t||typeof t!="string")throw new Error("[BugAnnotator] Invalid color value.");this.activeColor=t}getDimensions(){return{width:this.width,height:this.height}}setDimensions(t,e){if(t<=0||e<=0)throw new Error(`[BugAnnotator] Invalid dimensions: ${t}x${e}`);this.width=t,this.height=e,this.baseCanvas&&(this.baseCanvas.width!==t||this.baseCanvas.height!==e)&&(this.baseCanvas.width=t,this.baseCanvas.height=e),this.overlayCanvas&&(this.overlayCanvas.width!==t||this.overlayCanvas.height!==e)&&(this.overlayCanvas.width=t,this.overlayCanvas.height=e),this.renderOverlay()}getShapes(){return Z(this.shapes)}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}addShape(t){this.undoStack.push(Z(this.shapes)),this.redoStack=[],this.shapes.push(Xt(t)),this.renderOverlay(),this.notifyHistoryChange()}addTextAnnotation(t,e,s){const a=s.trim();if(!a)return null;const i={id:this.nextShapeId(),type:"text",color:this.activeColor,x:Math.round(t),y:Math.round(e),text:a};return this.addShape(i),i}undo(){if(this.undoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.redoStack.push(Z(this.shapes));const t=this.undoStack.pop();return this.shapes=Z(t),this.renderOverlay(),this.notifyHistoryChange(),!0}redo(){if(this.redoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.undoStack.push(Z(this.shapes));const t=this.redoStack.pop();return this.shapes=Z(t),this.renderOverlay(),this.notifyHistoryChange(),!0}clearAnnotations(){this.commitOrCloseActiveTextInput(),this.shapes.length!==0&&(this.undoStack.push(Z(this.shapes)),this.redoStack=[],this.shapes=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange())}resetHistory(){this.commitOrCloseActiveTextInput(),this.shapes=[],this.undoStack=[],this.redoStack=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange()}loadBaseFromCanvas(t){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to receive snapshot.");t.width>0&&t.height>0&&this.setDimensions(t.width,t.height);const e=this.baseCanvas.getContext("2d");if(!e)throw new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas.");e.clearRect(0,0,this.width,this.height),e.drawImage(t,0,0,this.width,this.height),this.hasBaseSnapshot=!0,this.renderOverlay()}loadBaseFrameDataUrl(t,e,s){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to load frame data URL.");if(!t||!t.startsWith("data:image/"))throw new Error("[BugAnnotator] Invalid image dataUrl passed to loadBaseFrameDataUrl.");return new Promise((a,i)=>{const n=new Image;n.onload=()=>{const r=e&&e>0?e:n.naturalWidth||this.width,o=s&&s>0?s:n.naturalHeight||this.height;this.setDimensions(r,o);const d=this.baseCanvas.getContext("2d");if(!d){i(new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas."));return}d.clearRect(0,0,r,o),d.drawImage(n,0,0,r,o),this.hasBaseSnapshot=!0,this.renderOverlay(),a()},n.onerror=()=>{i(new Error("[BugAnnotator] Failed to decode DVR frame dataUrl into Image."))},n.src=t})}hasFrozenFrame(){return this.hasBaseSnapshot}renderOverlay(){if(!this.overlayCanvas)return;const t=this.overlayCanvas.getContext("2d");if(t){t.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);for(const e of this.shapes)this.renderShape(t,e);this.draftShape&&this.renderShape(t,this.draftShape)}}renderShape(t,e){if(t.save(),e.type==="pen"){if(e.points.length>0){t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let s=1;s<e.points.length;s++)t.lineTo(e.points[s].x,e.points[s].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let s=1;s<e.points.length;s++)t.lineTo(e.points[s].x,e.points[s].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke()}}else if(e.type==="arrow"){const s=e.endX-e.startX,a=e.endY-e.startY;if(Math.hypot(s,a)>=2){const n=Math.atan2(a,s),r=Math.max(12,e.strokeWidth*4.5),o=Math.PI/6.5,d=e.endX-r*Math.cos(n-o),h=e.endY-r*Math.sin(n-o),l=e.endX-r*Math.cos(n+o),u=e.endY-r*Math.sin(n+o);t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.72)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-r*.55*Math.cos(n),e.endY-r*.55*Math.sin(n)),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-r*.55*Math.cos(n),e.endY-r*.55*Math.sin(n)),t.stroke(),t.beginPath(),t.moveTo(e.endX,e.endY),t.lineTo(d,h),t.lineTo(l,u),t.closePath(),t.fillStyle=e.color,t.strokeStyle="rgba(0, 0, 0, 0.75)",t.lineWidth=1.5,t.stroke(),t.fill()}}else if(e.type==="box"){const s=e.width>=0?e.x:e.x+e.width,a=e.height>=0?e.y:e.y+e.height,i=Math.abs(e.width),n=Math.abs(e.height);(i>=1||n>=1)&&(t.fillStyle=ve(e.color,.14),t.fillRect(s,a,i,n),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2,t.strokeRect(s,a,i,n),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.strokeRect(s,a,i,n))}else if(e.type==="text"){const s='600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';t.font=s;const a=t.measureText(e.text),i=8,n=5,r=Math.ceil(a.width)+i*2,o=24,d=Math.max(4,Math.min(this.width-r-4,e.x)),h=Math.max(4,Math.min(this.height-o-4,e.y-o/2));t.fillStyle="rgba(9, 13, 22, 0.9)",t.strokeStyle=e.color,t.lineWidth=2,t.beginPath(),typeof t.roundRect=="function"?t.roundRect(d,h,r,o,6):t.rect(d,h,r,o),t.fill(),t.stroke(),t.fillStyle="#FFFFFF",t.textBaseline="middle",t.fillText(e.text,d+i,h+o/2+n*.05)}t.restore()}exportCompositeDataUrl(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");e.width=this.width,e.height=this.height;const s=e.getContext("2d");if(!s)throw new Error("[BugAnnotator] Failed to acquire 2D context for composite export.");this.baseCanvas?s.drawImage(this.baseCanvas,0,0,this.width,this.height):(s.fillStyle="#090D16",s.fillRect(0,0,this.width,this.height));for(const a of this.shapes)this.renderShape(s,a);return e.toDataURL("image/png")}exportSmartComposite(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");let s={x:0,y:0,width:this.width,height:this.height};if(this.baseCanvas&&typeof this.baseCanvas.getContext=="function"){const o=this.baseCanvas.getContext("2d");if(o&&typeof o.getImageData=="function"){const d=o.getImageData(0,0,this.width,this.height);s=Ft(d.data,this.width,this.height)}}const a=be(this.shapes,this.width,this.height),i=we(s,a,this.width,this.height);e.width=i.width,e.height=i.height;const n=e.getContext("2d");if(!n)throw new Error("[BugAnnotator] Failed to acquire 2D context for smart composite export.");typeof n.fillRect=="function"&&(i.x<s.x||i.y<s.y||i.x+i.width>s.x+s.width||i.y+i.height>s.y+s.height||!this.baseCanvas)&&(n.fillStyle="#090D16",n.fillRect(0,0,i.width,i.height)),this.baseCanvas&&(i.x===0&&i.y===0&&i.width===this.width&&i.height===this.height?n.drawImage(this.baseCanvas,0,0,this.width,this.height):n.drawImage(this.baseCanvas,i.x,i.y,i.width,i.height,0,0,i.width,i.height));const r=(i.x!==0||i.y!==0)&&typeof n.translate=="function";r&&(n.save(),n.translate(-i.x,-i.y));for(const o of this.shapes)this.renderShape(n,o);return r&&n.restore(),{dataUrl:e.toDataURL("image/png"),width:i.width,height:i.height,crop:i}}bindPointerEvents(t){const e=a=>{const i=t.getBoundingClientRect(),n=i.width>0?t.width/i.width:1,r=i.height>0?t.height/i.height:1;return{x:(a.clientX-i.left)*n,y:(a.clientY-i.top)*r}};t.addEventListener("pointerdown",a=>{if(a.button!==0)return;a.preventDefault();const i=e(a);if(this.activeTool==="text"){this.openInlineTextInput(i.x,i.y,a.clientX,a.clientY);return}this.commitOrCloseActiveTextInput(),this.isDrawing=!0;try{t.setPointerCapture(a.pointerId)}catch{}const n=this.nextShapeId();this.activeTool==="pen"?this.draftShape={id:n,type:"pen",color:this.activeColor,strokeWidth:this.strokeWidth,points:[i]}:this.activeTool==="arrow"?this.draftShape={id:n,type:"arrow",color:this.activeColor,strokeWidth:this.strokeWidth,startX:i.x,startY:i.y,endX:i.x,endY:i.y}:this.activeTool==="box"&&(this.draftShape={id:n,type:"box",color:this.activeColor,strokeWidth:this.strokeWidth,x:i.x,y:i.y,width:0,height:0}),this.renderOverlay()}),t.addEventListener("pointermove",a=>{if(!this.isDrawing||!this.draftShape)return;const i=e(a);this.draftShape.type==="pen"?this.draftShape.points.push(i):this.draftShape.type==="arrow"?(this.draftShape.endX=i.x,this.draftShape.endY=i.y):this.draftShape.type==="box"&&(this.draftShape.width=i.x-this.draftShape.x,this.draftShape.height=i.y-this.draftShape.y),this.renderOverlay()});const s=a=>{if(!this.isDrawing||!this.draftShape)return;this.isDrawing=!1;try{t.hasPointerCapture(a.pointerId)&&t.releasePointerCapture(a.pointerId)}catch{}const i=this.draftShape;if(this.draftShape=null,i.type==="pen"){let n=1/0,r=-1/0,o=1/0,d=-1/0;for(const h of i.points)h.x<n&&(n=h.x),h.x>r&&(r=h.x),h.y<o&&(o=h.y),h.y>d&&(d=h.y);if(Math.hypot(r-n,d-o)<3){this.renderOverlay();return}}else if(i.type==="arrow"){if(Math.hypot(i.endX-i.startX,i.endY-i.startY)<4){this.renderOverlay();return}}else if(i.type==="box"&&Math.abs(i.width)<3&&Math.abs(i.height)<3){this.renderOverlay();return}this.addShape(i)};t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s)}openInlineTextInput(t,e,s,a){if(this.commitOrCloseActiveTextInput(),!this.overlayCanvas||!this.overlayCanvas.parentElement)return;const i=this.overlayCanvas.parentElement,n=i.getBoundingClientRect(),r=document.createElement("input");r.type="text",r.className="annotation-inline-text-input",r.placeholder="Type bug label & press Enter...",r.style.position="absolute",r.style.left=`${Math.max(8,Math.min(n.width-180,s-n.left))}px`,r.style.top=`${Math.max(8,Math.min(n.height-34,a-n.top-14))}px`,r.style.zIndex="50",r.style.background="rgba(9, 13, 22, 0.95)",r.style.color="#FFFFFF",r.style.border=`2px solid ${this.activeColor}`,r.style.borderRadius="6px",r.style.padding="4px 8px",r.style.fontSize="12px",r.style.fontWeight="600",r.style.outline="none",r.style.minWidth="160px",r.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.45)";let o=!1;const d=()=>{if(o)return;o=!0;const l=r.value.trim();r.parentElement&&r.remove(),this.activeTextInputEl===r&&(this.activeTextInputEl=null),l&&this.addTextAnnotation(t,e,l)},h=()=>{o||(o=!0,r.parentElement&&r.remove(),this.activeTextInputEl===r&&(this.activeTextInputEl=null))};r.addEventListener("keydown",l=>{l.stopPropagation(),l.key==="Enter"?(l.preventDefault(),d()):l.key==="Escape"&&(l.preventDefault(),h())}),r.addEventListener("blur",()=>{d()}),this.activeTextInputEl=r,i.appendChild(r),requestAnimationFrame(()=>r.focus())}commitOrCloseActiveTextInput(){this.activeTextInputEl&&(this.activeTextInputEl.blur(),this.activeTextInputEl=null)}nextShapeId(){return`ann-${++this.shapeCounter}-${Date.now()}`}notifyHistoryChange(){this.onHistoryChange&&this.onHistoryChange()}}function be(c,t,e,s=12){if(!c||c.length===0||t<=0||e<=0)return null;let a=1/0,i=1/0,n=-1/0,r=-1/0;const o=(m,f,p,x,S)=>{const E=Math.min(m,p)-S,v=Math.max(m,p)+S,g=Math.min(f,x)-S,b=Math.max(f,x)+S;E<a&&(a=E),g<i&&(i=g),v>n&&(n=v),b>r&&(r=b)};for(const m of c)if(m.type==="pen"){const f=(m.strokeWidth||3)+4+s;for(const p of m.points)o(p.x,p.y,p.x,p.y,f)}else if(m.type==="arrow"){const f=Math.max(16,(m.strokeWidth||3)*4.5)+s;o(m.startX,m.startY,m.endX,m.endY,f)}else if(m.type==="box"){const f=(m.strokeWidth||3)+4+s;o(m.x,m.y,m.x+m.width,m.y+m.height,f)}else if(m.type==="text"){const f=Math.ceil((m.text||"").length*8.5)+16,p=24,x=Math.max(4,Math.min(t-f-4,m.x)),S=Math.max(4,Math.min(e-p-4,m.y-p/2));o(x,S,x+f,S+p,4+s)}if(!Number.isFinite(a)||!Number.isFinite(i))return null;const d=Math.max(0,Math.floor(a)),h=Math.max(0,Math.floor(i)),l=Math.min(t,Math.ceil(n)),u=Math.min(e,Math.ceil(r));return{x:d,y:h,width:Math.max(1,l-d),height:Math.max(1,u-h)}}function we(c,t,e,s){if(!t)return c;const a=Math.max(0,Math.min(c.x,t.x)),i=Math.max(0,Math.min(c.y,t.y)),n=Math.min(e,Math.max(c.x+c.width,t.x+t.width)),r=Math.min(s,Math.max(c.y+c.height,t.y+t.height));return{x:a,y:i,width:Math.max(1,n-a),height:Math.max(1,r-i)}}const Dt=200,It=15e3;class xe{container;dvrBuffer;callbacks;iframe=null;currentRunnerId=0;activeMessageHandler=null;paused=!1;muted=!1;focused=!1;running=!1;consoleLogs=[];constructor(t,e,s={}){this.container=t,this.dvrBuffer=e,this.callbacks=s}isRunning(){return this.running}isPaused(){return this.paused}isMuted(){return this.muted}isFocused(){return this.focused}getConsoleLogs(){return[...this.consoleLogs]}clearConsoleLogs(){this.consoleLogs=[]}getGameCanvas(){try{const t=this.iframe?.contentWindow?.document;return t?this.iframe?.contentWindow?.__ACTIVE_GAME_CANVAS__||t.querySelector("canvas"):null}catch{return null}}async launchBuild(t){if(!t||typeof t!="string")throw new Error("[WasmRunner] launchBuild requires a non-empty buildId.");this.destroy(),this.dvrBuffer.clear(),this.clearConsoleLogs(),this.paused=!1,this.callbacks.onStateChange?.("loading"),await this.mountSidecarRunnerIframe({buildId:t})}postToChild(t){this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage({source:"playtest-runner-parent",runnerId:this.currentRunnerId,...t},"*")}mountSidecarRunnerIframe(t){return new Promise((e,s)=>{const a=++this.currentRunnerId;let i=!1;const n=window.setTimeout(()=>{i||(i=!0,this.callbacks.onStateChange?.("error"),s(new Error(`[WasmRunner] Timed out after ${It}ms waiting for sidecar runner iframe (/api/playtest/runner) to initialize.`)))},It),r=m=>{const f=m.data;if(!(!f||f.source!=="playtest-runner-child"||f.runnerId!==a))switch(f.type){case"READY":{this.running=!0,this.callbacks.onStateChange?.("running"),i||(i=!0,window.clearTimeout(n),e());break}case"FRAME":{if(typeof f.dataUrl=="string"&&typeof f.width=="number"&&typeof f.height=="number"&&f.width>0&&f.height>0)try{this.dvrBuffer.recordFrameDataUrl(f.dataUrl,f.width,f.height,f.timestampMs??performance.now()),this.callbacks.onFrameRecorded?.()}catch(p){console.error("[WasmRunner] Frame DVR capture error:",p)}break}case"LOG":{const p=f.level||"log";this.appendLog(p,f.text||"");break}case"PANIC":{const p=f.message||"Unknown Go WASM runtime error";this.appendLog("error",p),this.callbacks.onPanic?.(p,this.getConsoleLogs()),i||(i=!0,window.clearTimeout(n),s(new Error(p)));break}case"TOGGLE_PAUSE":{this.togglePause();break}case"FOCUS_CHANGE":{const p=!!f.focused;this.focused=p,this.callbacks.onFocusChange?.(p);break}}};this.activeMessageHandler=r,window.addEventListener("message",r);const o=wt(),d=new URLSearchParams({runnerId:String(a),muted:this.muted?"1":"0",captureIntervalMs:String(this.dvrBuffer.captureIntervalMs),buildId:t.buildId}),h=new URLSearchParams(window.location.search).get("token");h&&d.set("token",h);const l=`${o}/api/playtest/runner?${d.toString()}`,u=document.createElement("iframe");u.className="wasm-runner-iframe",u.setAttribute("title","Ebitengine Playtest Viewport"),u.src=l,this.container.innerHTML="",this.container.appendChild(u),this.iframe=u})}syncDvrFromChild(){try{const t=this.iframe?.contentWindow;if(!t||typeof t.__PLAYTEST_GET_DVR_FRAMES__!="function")return;const e=t.__PLAYTEST_GET_DVR_FRAMES__();if(!Array.isArray(e)||e.length===0)return;this.dvrBuffer.clear();for(let s=0;s<e.length;s++){const a=e[s];a&&a.canvas&&a.width>0&&a.height>0&&this.dvrBuffer.recordCanvasSlot(a.canvas,a.width,a.height,a.timestampMs)}}catch{}}captureImmediateFrame(){this.running&&(this.postToChild({type:"CAPTURE_NOW"}),this.syncDvrFromChild())}setPaused(t){!this.running||this.paused===t||(this.paused=t,this.postToChild({type:"SET_PAUSED",paused:t}),t&&this.syncDvrFromChild(),this.callbacks.onPauseChange?.(t),this.callbacks.onStateChange?.(t?"paused":"running"))}togglePause(){return this.running?(this.setPaused(!this.paused),this.paused):!1}setMuted(t){this.muted=t,this.postToChild({type:"SET_MUTED",muted:t})}toggleMuted(){return this.setMuted(!this.muted),this.muted}focus(){try{this.iframe?.contentWindow?.focus()}catch{}this.postToChild({type:"FOCUS_GAME"})}dispatchVirtualKey(t,e,s){this.postToChild({type:"DISPATCH_KEY",code:t,key:e,keyEventType:s})}destroy(){this.activeMessageHandler&&(window.removeEventListener("message",this.activeMessageHandler),this.activeMessageHandler=null),this.running=!1,this.paused=!1,this.focused=!1,this.iframe&&(this.iframe.src="about:blank",this.iframe.remove(),this.iframe=null),this.container.innerHTML="",this.callbacks.onFocusChange?.(!1)}appendLog(t,e){const a=`[${new Date().toISOString().slice(11,23)}] [${t.toUpperCase()}] ${e}`;this.consoleLogs.push(a),this.consoleLogs.length>Dt&&this.consoleLogs.splice(0,this.consoleLogs.length-Dt),this.callbacks.onLog?.(t,a,this.getConsoleLogs())}}let kt="",$t="";function N(c){return String(c).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function G(c){return N(c).replace(/'/g,"&#39;")}function Yt(c){return c<1024?`${c} B`:c<1024*1024?`${(c/1024).toFixed(1)} KB`:`${(c/(1024*1024)).toFixed(1)} MB`}function Mt(c,t,e){const s=[];t.workspaceDir&&s.push({label:"Workspace",path:t.workspaceDir}),t.downloadsDir&&s.push({label:"Downloads",path:t.downloadsDir}),t.desktopDir&&s.push({label:"Desktop",path:t.desktopDir}),t.sessionDir&&s.push({label:"Session",path:t.sessionDir}),c.innerHTML="";for(const a of s){const i=document.createElement("button");i.type="button",i.className="btn btn-sm btn-outline",i.style.cssText="height: 22px; padding: 0 7px; font-size: 11px;",i.textContent=a.label,i.title=a.path,i.addEventListener("click",()=>e(a.path)),c.appendChild(i)}}function Kt(c){const t=document.getElementById("studio-file-modal-overlay");t&&t.remove();const e=c.initialDirectory||$t||D()||"",s=document.createElement("div");s.id="studio-file-modal-overlay",s.className="modal-overlay";const a=document.createElement("div");a.className="modal-dialog",a.style.width="520px",a.style.maxWidth="95vw";const i=c.acceptExtensions.map(g=>g.startsWith(".")?g:`.${g}`).join(",");a.innerHTML=`
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>📂</span>
        <span>${N(c.title)}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Folder</span>
          <div id="studio-file-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <div style="display: flex; gap: 6px;">
          <input
            type="text"
            id="studio-file-dir-input"
            class="input-text"
            style="flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
            value="${G(e)}"
            placeholder="/path/to/workspace"
            spellcheck="false"
          />
          <button type="button" id="studio-file-up-btn" class="btn btn-sm btn-outline" title="Parent Directory">⬆ Up</button>
          <button type="button" id="studio-file-go-btn" class="btn btn-sm btn-outline" title="List Directory">Go</button>
        </div>
      </div>

      <div
        id="studio-file-list"
        style="display: flex; flex-direction: column; gap: 4px; min-height: 180px; max-height: 250px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 6px;"
      >
        <div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading directory contents...</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Selected File Path (${N(i)})</span>
        <input
          type="text"
          id="studio-file-path-input"
          class="input-text"
          style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
          placeholder="Select a file above or paste an absolute file path..."
          spellcheck="false"
        />
      </div>

      <input type="file" id="studio-hidden-local-file" accept="${G(i)}" class="hidden" />

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
        <button type="button" id="studio-browse-local-btn" class="btn btn-sm btn-outline" title="Browse local file from computer">
          <span>💻 Browse Local File...</span>
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" id="studio-file-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
          <button type="button" id="studio-file-open-btn" class="btn btn-sm btn-primary">Open File</button>
        </div>
      </div>
    </div>
  `,s.appendChild(a),document.body.appendChild(s);let n=null;const r=()=>{window.removeEventListener("keydown",o),s.remove()},o=g=>{g.key==="Escape"&&(g.preventDefault(),r())};window.addEventListener("keydown",o),s.addEventListener("click",g=>{g.target===s&&r()}),a.querySelector(".modal-close-btn")?.addEventListener("click",r),a.querySelector("#studio-file-cancel-btn")?.addEventListener("click",r);const d=a.querySelector("#studio-file-dir-input"),h=a.querySelector("#studio-file-path-input"),l=a.querySelector("#studio-file-list"),u=a.querySelector("#studio-file-dir-pills"),m=a.querySelector("#studio-file-up-btn"),f=a.querySelector("#studio-file-go-btn"),p=a.querySelector("#studio-file-open-btn"),x=a.querySelector("#studio-browse-local-btn"),S=a.querySelector("#studio-hidden-local-file"),E=async g=>{const b=g.trim();if(!b){F.error("Missing File Path","Select a file from the list or enter a file path.");return}p.disabled=!0;const y=p.textContent;p.textContent="Opening...";try{await c.onSelectFilePath(b),r()}catch(w){F.error("Failed to Open File",w?.message||String(w))}finally{p.disabled=!1,p.textContent=y}},v=async g=>{l.innerHTML=`<div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading ${N(g||"workspace")}...</div>`;try{const b=await Tt(g,c.filterType,c.acceptExtensions);if(d.value=b.dir,$t=b.dir,n=b.parentDir,m.disabled=!n,l.innerHTML="",b.directories.length===0&&b.files.length===0){const y=document.createElement("div");y.style.cssText="font-size: 12px; color: var(--studio-text-muted); padding: 12px; text-align: center;",y.textContent=`No matching (${i}) files or subfolders in this directory.`,l.appendChild(y);return}for(const y of b.directories){const w=document.createElement("button");w.type="button",w.className="session-item-btn",w.style.cssText="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px;",w.innerHTML=`
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>📁</span>
            <span>${N(y.name)}</span>
          </span>
          <span style="font-size: 11px; color: var(--studio-text-muted);">Folder ▸</span>
        `,w.addEventListener("click",()=>{v(y.path)}),l.appendChild(w)}for(const y of b.files){const w=document.createElement("div");w.className="session-item-btn",w.style.cssText="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 8px;";const B=document.createElement("div");B.style.cssText="display: flex; flex-direction: column; min-width: 0; flex: 1; cursor: pointer;",B.innerHTML=`
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--studio-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span>${y.ext===".music"||y.ext===".sfx"||y.ext===".wav"?"🎵":"🎨"}</span>
            <span>${N(y.name)}</span>
          </div>
          <div style="font-size: 10px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
            ${N(Yt(y.size))}
          </div>
        `;const M=()=>{h.value=y.path,l.querySelectorAll(".studio-file-row-selected").forEach(k=>{k.style.borderColor="",k.classList.remove("studio-file-row-selected")}),w.classList.add("studio-file-row-selected"),w.style.borderColor="var(--studio-accent)"};B.addEventListener("click",M),B.addEventListener("dblclick",()=>{M(),E(y.path)});const C=document.createElement("button");C.type="button",C.className="btn btn-sm btn-outline",C.style.cssText="height: 24px; padding: 0 8px; font-size: 11px; flex-shrink: 0;",C.textContent="Open",C.addEventListener("click",k=>{k.stopPropagation(),h.value=y.path,E(y.path)}),w.appendChild(B),w.appendChild(C),l.appendChild(w)}}catch(b){l.innerHTML=`<div style="font-size: 12px; color: var(--studio-danger); padding: 8px;">${N(b?.message||String(b))}</div>`}};m.addEventListener("click",()=>{n&&v(n)}),f.addEventListener("click",()=>{v(d.value.trim())}),d.addEventListener("keydown",g=>{g.key==="Enter"&&(g.preventDefault(),v(d.value.trim()))}),h.addEventListener("keydown",g=>{g.key==="Enter"&&(g.preventDefault(),E(h.value))}),p.addEventListener("click",()=>{E(h.value)}),x.addEventListener("click",()=>{S.click()}),S.addEventListener("change",async()=>{const g=S.files?.[0];if(g)try{if(c.onSelectLocalFile)await c.onSelectLocalFile(g),r();else{const b=g;b.path&&(await c.onSelectFilePath(b.path),r())}}catch(b){F.error("Failed to Load Local File",b?.message||String(b))}finally{S.value=""}}),(async()=>{try{const g=await Bt(),b=e||g.defaultDir||g.workspaceDir;Mt(u,g,y=>{d.value=y,v(y)}),await v(b)}catch{await v(e)}})()}function Se(c){const t=document.getElementById("studio-project-modal-overlay");t&&t.remove();const e=c.currentWorkspace||D()||"";let s=c.currentPkg||".";const a=document.createElement("div");a.id="studio-project-modal-overlay",a.className="modal-overlay";const i=document.createElement("div");i.className="modal-dialog",i.style.width="520px",i.style.maxWidth="95vw",i.innerHTML=`
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
            value="${G(e)}"
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
          <option value="${G(s)}">${N(s)}</option>
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
        <button type="button" id="studio-proj-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
        <button type="button" id="studio-proj-open-btn" class="btn btn-sm btn-primary">Open Project</button>
      </div>
    </div>
  `,a.appendChild(i),document.body.appendChild(a);let n=null;const r=()=>{window.removeEventListener("keydown",o),a.remove()},o=E=>{E.key==="Escape"&&(E.preventDefault(),r())};window.addEventListener("keydown",o),a.addEventListener("click",E=>{E.target===a&&r()}),i.querySelector(".modal-close-btn")?.addEventListener("click",r),i.querySelector("#studio-proj-cancel-btn")?.addEventListener("click",r);const d=i.querySelector("#studio-proj-dir-input"),h=i.querySelector("#studio-proj-status"),l=i.querySelector("#studio-proj-folders-list"),u=i.querySelector("#studio-proj-pkg-select"),m=i.querySelector("#studio-proj-dir-pills"),f=i.querySelector("#studio-proj-up-btn"),p=i.querySelector("#studio-proj-go-btn"),x=i.querySelector("#studio-proj-open-btn"),S=async E=>{l.innerHTML=`<div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Scanning ${N(E||"workspace")}...</div>`;try{const[v,g]=await Promise.all([Tt(E,"project"),ce(E)]);d.value=v.dir,n=v.parentDir,f.disabled=!n;const b=g.packages.length>0?g.packages:["."];if(u.innerHTML=b.map(y=>`<option value="${G(y)}">${N(y)}</option>`).join(""),b.includes(s)||(s=g.pkg||b[0]||"."),u.value=s,g.hasGoMod?(h.style.borderColor="rgba(16, 185, 129, 0.45)",h.style.color="var(--studio-success)",h.textContent=`✓ Go project detected (${b.length} runnable package${b.length===1?"":"s"}: ${b.join(", ")})`):(h.style.borderColor="var(--studio-border)",h.style.color="var(--studio-text-muted)",h.textContent="No go.mod in this folder. Select a subfolder below or open anyway."),l.innerHTML="",v.directories.length===0){const y=document.createElement("div");y.style.cssText="font-size: 12px; color: var(--studio-text-muted); padding: 10px; text-align: center;",y.textContent="No subdirectories in this folder.",l.appendChild(y);return}for(const y of v.directories){const w=document.createElement("button");w.type="button",w.className="session-item-btn",w.style.cssText="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px;",w.innerHTML=`
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>📁</span>
            <span>${N(y.name)}</span>
          </span>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            ${y.hasGoMod?'<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.16); color: var(--studio-success); border: 1px solid rgba(16, 185, 129, 0.4);">go.mod</span>':""}
            <span style="font-size: 11px; color: var(--studio-text-muted);">Open ▸</span>
          </span>
        `,w.addEventListener("click",()=>{S(y.path)}),l.appendChild(w)}}catch(v){h.style.borderColor="var(--studio-danger)",h.style.color="var(--studio-danger)",h.textContent=v?.message||String(v),l.innerHTML=`<div style="font-size: 12px; color: var(--studio-danger); padding: 8px;">${N(v?.message||String(v))}</div>`}};f.addEventListener("click",()=>{n&&S(n)}),p.addEventListener("click",()=>{S(d.value.trim())}),d.addEventListener("keydown",E=>{E.key==="Enter"&&(E.preventDefault(),S(d.value.trim()))}),x.addEventListener("click",async()=>{const E=d.value.trim(),v=u.value.trim()||".";if(!E){F.error("Missing Project Directory","Enter or select a Go project directory.");return}x.disabled=!0;try{await c.onSelectProject(E,v),r()}catch(g){F.error("Failed to Open Project",g?.message||String(g))}finally{x.disabled=!1}}),(async()=>{try{const E=await Bt(),v=e||E.workspaceDir||E.defaultDir;Mt(m,E,g=>{d.value=g,S(g)}),await S(v)}catch{await S(e)}})()}function Jt(c){const t=document.getElementById("studio-artifact-modal-overlay");t&&t.remove();let e=J()||"standalone";const s=new Set(c.filterExtensions.map(p=>p.startsWith(".")?p.toLowerCase():`.${p.toLowerCase()}`)),a=document.createElement("div");a.id="studio-artifact-modal-overlay",a.className="modal-overlay";const i=document.createElement("div");i.className="modal-dialog artifact-modal",i.style.width="520px",i.style.maxWidth="95vw";const n=c.saveFormats.map(p=>`<option value="${G(p.value)}">${N(p.label)}</option>`).join("");i.innerHTML=`
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>📦</span>
        <span>${N(c.title||"Session Artifacts")}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
      <!-- Save to Artifacts Section -->
      <div class="artifact-save-box" style="display: flex; flex-direction: column; gap: 6px; background: var(--studio-surface-hover); padding: 10px; border-radius: 8px; border: 1px solid var(--studio-border);">
        <div class="section-subtitle" style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Save Current Asset to Session Artifacts</div>
        <div class="artifact-save-controls" style="display: flex; gap: 6px; flex-wrap: wrap;">
          <input
            type="text"
            id="artifact-save-name"
            class="input-text"
            style="flex: 1 1 160px;"
            placeholder="filename"
            value="${G(c.defaultSaveName)}"
          />
          <select id="artifact-save-format" class="input-text" style="height: 28px;">
            ${n}
          </select>
          <button type="button" id="artifact-save-btn" class="btn btn-sm btn-primary">Save to Artifacts</button>
        </div>
      </div>

      <!-- Browse Artifacts Section -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div class="section-subtitle" style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">
          Artifacts in Current Session (${N(Array.from(s).join(", "))})
        </div>
        <div
          id="artifact-list-container"
          class="artifact-list"
          style="display: flex; flex-direction: column; gap: 6px; min-height: 180px; max-height: 280px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 8px;"
        >
          <div class="artifact-loading" style="font-size: 12px; color: var(--studio-text-muted);">Loading session artifacts...</div>
        </div>
      </div>
    </div>
  `,a.appendChild(i),document.body.appendChild(a);const r=()=>{window.removeEventListener("keydown",o),a.remove()},o=p=>{p.key==="Escape"&&(p.preventDefault(),r())};window.addEventListener("keydown",o),a.addEventListener("click",p=>{p.target===a&&r()}),i.querySelector(".modal-close-btn")?.addEventListener("click",r);const d=i.querySelector("#artifact-list-container"),h=i.querySelector("#artifact-save-name"),l=i.querySelector("#artifact-save-format"),u=i.querySelector("#artifact-save-btn"),m=p=>[".png",".jpg",".jpeg",".webp",".gif",".svg"].includes(p.toLowerCase()),f=async()=>{d.innerHTML='<div class="artifact-loading" style="font-size: 12px; color: var(--studio-text-muted);">Loading session artifacts...</div>';try{if(!e||e==="standalone"){const v=await ie().catch(()=>null);v&&(e=v)}const p=await P(`/api/artifacts?session_id=${encodeURIComponent(e)}`,{method:"GET",cache:"no-store"});if(!p.ok){const v=await p.json().catch(()=>({}));throw new Error(v.error||`HTTP ${p.status}: ${p.statusText}`)}const E=((await p.json()).artifacts||[]).filter(v=>{const g=String(v.ext||"").toLowerCase();return s.size===0||s.has(g)});if(d.textContent="",E.length===0){const v=document.createElement("div");v.className="artifact-empty",v.style.cssText="font-size: 12px; color: var(--studio-text-muted); padding: 12px; text-align: center;",v.textContent="No matching artifacts in this session yet.",d.appendChild(v);return}for(const v of E){const g=v.name||v.displayName||v.filename||"unnamed",b=v.relativePath||v.filename||g,y=typeof v.size=="number"?v.size:0,w=String(v.ext||"").toLowerCase(),B=document.createElement("div");B.className="artifact-card artifact-item",B.style.cssText="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--studio-border); background: var(--studio-surface-hover);";const M=document.createElement("div");if(M.style.cssText="width: 36px; height: 36px; border-radius: 5px; background: var(--studio-bg); border: 1px solid var(--studio-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;",m(w)){const L=document.createElement("img");L.style.cssText="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;",L.alt=g,L.src=`${wt()}/api/artifact?session_id=${encodeURIComponent(e)}&filename=${encodeURIComponent(b)}`,M.appendChild(L)}else{const L=document.createElement("span");L.style.cssText="font-size: 9px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--studio-accent);",L.textContent=w.replace(/^\./,"").toUpperCase()||"FILE",M.appendChild(L)}const C=document.createElement("div");C.style.cssText="display: flex; flex-direction: column; min-width: 0; flex: 1;";const k=document.createElement("div");k.style.cssText="font-size: 12px; font-weight: 600; color: var(--studio-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",k.title=b,k.textContent=g;const T=document.createElement("div");T.style.cssText="font-size: 10px; color: var(--studio-text-muted);";const I=v.modifiedTime?` • ${new Date(v.modifiedTime).toLocaleTimeString()}`:"";if(T.textContent=`${Yt(y)}${I}`,C.appendChild(k),b!==g){const L=document.createElement("div");L.style.cssText="font-size: 10px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",L.textContent=b,C.appendChild(L)}C.appendChild(T);const $=document.createElement("button");$.type="button",$.className="btn btn-sm btn-outline",$.textContent="Open",$.addEventListener("click",async()=>{$.disabled=!0;try{const L=`/api/artifact?session_id=${encodeURIComponent(e)}&filename=${encodeURIComponent(b)}`,O=await P(L);if(!O.ok)throw new Error(`Failed to download artifact "${b}": HTTP ${O.status}`);const j=await O.arrayBuffer(),A=new TextDecoder("utf-8").decode(j);await c.onLoadArtifact({filename:b,filePath:typeof v.filePath=="string"?v.filePath:"",displayName:g,ext:w,content:j,text:A}),F.success(`Opened artifact "${g}"`),r()}catch(L){F.error("Failed to Open Artifact",L?.message||String(L))}finally{$.disabled=!1}}),B.appendChild(M),B.appendChild(C),B.appendChild($),d.appendChild(B)}}catch(p){d.innerHTML=`<div class="artifact-error" style="font-size: 12px; color: var(--studio-danger);">${N(p?.message||String(p))}</div>`}};u.addEventListener("click",async()=>{const p=l.value;let x=h.value.trim()||c.defaultSaveName||`asset-${Date.now()}`;u.disabled=!0;const S=u.textContent;u.textContent="Saving...";try{const E=await c.onGetSavePayload(p),v=E.ext.startsWith(".")?E.ext:`.${E.ext}`;x.toLowerCase().endsWith(v.toLowerCase())||(x+=v);const g=await P("/api/artifact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:e,filename:x,data:E.base64,text:E.text})});if(!g.ok){const y=await g.json().catch(()=>({}));throw new Error(y.error||`HTTP ${g.status}: ${g.statusText}`)}const b=await g.json();F.success(`Saved "${b.filename}" to session artifacts!`),await f()}catch(E){F.error("Save to Artifacts Failed",E?.message||String(E))}finally{u.disabled=!1,u.textContent=S}}),f()}function bt(c){const t=document.getElementById("save-export-modal-overlay");t&&t.remove();const e=c.formats;if(!e||e.length===0)return;let s=e.find(y=>y.id===c.initialFormatId)||e[0];const a=c.defaultBasename||`asset-${Date.now()}`,i=c.initialDirectory||kt||D()||"~/Downloads",n=document.createElement("div");n.id="save-export-modal-overlay",n.className="modal-overlay";const r=document.createElement("div");r.className="modal-dialog",r.style.width="460px",r.style.maxWidth="94vw";const o=e.map(y=>`
      <button
        type="button"
        class="btn btn-sm btn-outline save-format-btn ${y.id===s.id?"active btn-primary":""}"
        data-format-id="${G(y.id)}"
      >${N(y.label)}</button>
    `).join(""),d=y=>{const w=y.trim();for(const B of e){const M=B.ext.replace(/^\./,""),C=new RegExp(`\\.${M}$`,"i");if(C.test(w))return w.replace(C,"")||a}return w.replace(/\.(music|sfx|wav|sprite|aseprite|ase|png|json|gif|psd|jpg|jpeg|webp)$/i,"")||a},h=(y,w)=>{const B=w.ext.replace(/^\./,"");return`${d(y)}.${B}`};r.innerHTML=`
    <div class="modal-header">
      <div class="modal-title">
        <span id="save-modal-title">${N(c.title)}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Format</span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="save-format-pills">
          ${o}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Destination Folder</span>
          <div id="save-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <input
          type="text"
          id="save-dir-input"
          class="input-text"
          value="${G(i)}"
          placeholder="/path/to/workspace"
          spellcheck="false"
        />
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Filename</span>
        <input
          type="text"
          id="save-filename-input"
          class="input-text"
          value="${G(h(a,s))}"
          spellcheck="false"
        />
      </div>

      <div
        id="save-fullpath-preview"
        style="font-size: 11px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--studio-surface-hover); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--studio-border); word-break: break-all;"
      ></div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
        <button type="button" id="save-browser-download-btn" class="btn btn-sm btn-outline" title="Download via Browser">
          Browser Download
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" id="save-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
          <button type="button" id="save-confirm-btn" class="btn btn-sm btn-primary">Save to Filesystem</button>
        </div>
      </div>
    </div>
  `,n.appendChild(r),document.body.appendChild(n);const l=()=>{window.removeEventListener("keydown",u),n.remove()},u=y=>{y.key==="Escape"&&(y.preventDefault(),l())};window.addEventListener("keydown",u),n.addEventListener("click",y=>{y.target===n&&l()}),r.querySelector(".modal-close-btn")?.addEventListener("click",l),r.querySelector("#save-cancel-btn")?.addEventListener("click",l);const m=r.querySelector("#save-dir-input"),f=r.querySelector("#save-filename-input"),p=r.querySelector("#save-fullpath-preview"),x=r.querySelector("#save-dir-pills"),S=r.querySelector("#save-confirm-btn"),E=r.querySelector("#save-browser-download-btn"),v=r.querySelectorAll(".save-format-btn"),g=()=>{const y=m.value.trim().replace(/\/+$/,"")||".",w=h(f.value,s);p.textContent=`${y}/${w}`};g(),v.forEach(y=>{y.addEventListener("click",()=>{const w=y.getAttribute("data-format-id"),B=e.find(M=>M.id===w);B&&(s=B,v.forEach(M=>{const C=M===y;M.classList.toggle("active",C),M.classList.toggle("btn-primary",C)}),f.value=h(f.value,s),g())})}),m.addEventListener("input",g),f.addEventListener("input",g),(async()=>{try{const y=await Bt();!c.initialDirectory&&!kt&&y.defaultDir&&(m.value=y.defaultDir,g()),Mt(x,y,w=>{m.value=w,g()})}catch{}})();const b=async()=>{const y=m.value.trim(),w=h(f.value,s);if(!y){F.error("Missing Directory","Specify a destination folder path.");return}S.disabled=!0;const B=S.textContent;S.textContent="Saving...";try{const[M,C]=await Promise.all([zt(),c.onGetPayload(s.id)]),k=await P("/api/fs/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({directory:y,filename:w,data:C.base64,text:C.text,workspaceUris:M})});if(!k.ok){const I=await k.json().catch(()=>({}));throw new Error(I.error||`HTTP ${k.status}: ${k.statusText}`)}const T=await k.json();kt=y,F.success(`Saved to ${T.path}`),c.onSaved&&c.onSaved(T.path,T.filename||w),l()}catch(M){F.error("Save to Filesystem Failed",M?.message||String(M))}finally{S.disabled=!1,S.textContent=B}};S.addEventListener("click",()=>{b()}),f.addEventListener("keydown",y=>{y.key==="Enter"&&(y.preventDefault(),b())}),m.addEventListener("keydown",y=>{y.key==="Enter"&&(y.preventDefault(),b())}),E.addEventListener("click",async()=>{const y=h(f.value,s);E.disabled=!0;try{const w=await c.onGetPayload(s.id);let B;if(typeof w.text=="string")B=new Blob([w.text],{type:w.mimeType||"text/plain;charset=utf-8"});else if(typeof w.base64=="string"){const C=w.base64.includes(",")?w.base64.split(",")[1]:w.base64,k=atob(C),T=new Uint8Array(k.length);for(let I=0;I<k.length;I++)T[I]=k.charCodeAt(I);B=new Blob([T],{type:w.mimeType||"application/octet-stream"})}else throw new Error("Empty download payload.");const M=URL.createObjectURL(B);try{const C=document.createElement("a");C.href=M,C.download=y,document.body.appendChild(C),C.click(),C.remove()}finally{setTimeout(()=>URL.revokeObjectURL(M),1e3)}F.success(`Downloaded "${y}"`),l()}catch(w){F.error("Browser Download Failed",w?.message||String(w))}finally{E.disabled=!1}})}class F{static container=null;static getContainer(){return this.container||(this.container=document.createElement("div"),this.container.className="notification-container",document.body.appendChild(this.container)),this.container}static show(t,e="info",s=4e3,a){const i=this.getContainer(),n=document.createElement("div");n.className=`notification-toast toast-${e}`;const r=document.createElement("span");r.className="toast-icon",r.textContent=e==="success"?"✓":e==="error"?"⚠️":"ℹ";const o=document.createElement("div");o.className="toast-message";const d=document.createElement("div");if(d.className="toast-title",d.textContent=t,o.appendChild(d),a){const l=document.createElement("pre");l.className="toast-detail",l.textContent=a,o.appendChild(l)}if(e==="error"){const l=document.createElement("div");l.className="toast-actions";const u=document.createElement("button");u.type="button",u.className="toast-send-agent-btn",u.textContent="💬 Send to Agent",u.title="Send this error directly to the active Antigravity agent for diagnosis",u.addEventListener("click",async()=>{u.disabled=!0,u.textContent="Sending...";try{await Pt({errorTitle:t,errorDetail:a||t}),u.textContent="✓ Sent to Agent",u.classList.add("sent")}catch(m){u.disabled=!1,u.textContent="💬 Retry Send to Agent",console.error("[StudioNotifier] Failed to send error to agent:",m)}}),l.appendChild(u),o.appendChild(l)}const h=document.createElement("button");h.className="toast-close",h.textContent="✕",h.title="Dismiss",h.onclick=()=>n.remove(),n.appendChild(r),n.appendChild(o),n.appendChild(h),i.appendChild(n),s>0&&setTimeout(()=>{n.classList.add("toast-fade-out"),setTimeout(()=>n.remove(),280)},s)}static info(t,e=3e3){this.show(t,"info",e)}static success(t,e=3800){this.show(t,"success",e)}static error(t,e){console.error("[Game Dev Studio Error]",t,e||""),this.show(t,"error",0,e)}static fatal(t,e,s){console.error("[Game Dev Studio FATAL]",t,e,s??"");const a=document.getElementById("fatal-error-overlay");a&&a.remove();const i=document.createElement("div");i.id="fatal-error-overlay",i.className="modal-overlay fatal-overlay",i.setAttribute("role","alertdialog"),i.setAttribute("aria-modal","true");const n=e instanceof Error?`${e.name}: ${e.message}`:String(e),r=e instanceof Error&&e.stack?e.stack:"",o=[s?`[Context] ${s}`:"",n,r&&r!==n?r:""].filter(Boolean).join(`

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
    `;const d=i.querySelector(".fatal-title");d&&(d.textContent=t);const h=i.querySelector(".fatal-pre");h&&(h.textContent=o);const l=()=>{window.removeEventListener("keydown",u),i.remove()},u=f=>{f.key==="Escape"&&(f.preventDefault(),l())};window.addEventListener("keydown",u);const m=i.querySelector("#fatal-send-agent-btn");m?.addEventListener("click",async()=>{if(m){m.disabled=!0,m.textContent="Sending...";try{await Pt({errorTitle:t,errorDetail:o}),m.textContent="✓ Sent to Agent"}catch(f){m.disabled=!1,m.textContent="💬 Retry Send to Agent",console.error("[StudioNotifier] Failed to send fatal error to agent:",f)}}}),i.querySelector("#fatal-reload-btn")?.addEventListener("click",()=>{window.location.reload()}),i.querySelector("#fatal-dismiss-btn")?.addEventListener("click",l),document.body.appendChild(i)}}class Ee{headerEl;annotationBarEl;viewportEl;bugBarEl;dvrBuffer;annotator;runner;activePkg=".";activeDvrIndex=0;keypadVisible=!1;logsDrawerVisible=!1;isBuilding=!1;lastBuildFailure=null;runnerMountEl;annotationStageEl;readyStateEl;errorStateEl;gameStageEl;focusPillEl;keypadOverlayEl;logsDrawerEl;constructor(t){this.headerEl=t.headerEl,this.annotationBarEl=t.annotationBarEl,this.viewportEl=t.viewportEl,this.bugBarEl=t.bugBarEl,this.dvrBuffer=new de(250,40),this.renderHeader(),this.renderAnnotationBar(),this.renderViewport(),this.renderBugReportBar();const e=this.viewportEl.querySelector("#annotation-base-canvas"),s=this.viewportEl.querySelector("#annotation-overlay-canvas");this.annotator=new ye({baseCanvas:e,overlayCanvas:s,width:640,height:360,onHistoryChange:()=>this.updateAnnotationControlsUI()}),this.runner=new xe(this.runnerMountEl,this.dvrBuffer,{onFrameRecorded:()=>{if(this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.runner.isPaused()&&this.annotator.getShapes().length===0){const a=this.dvrBuffer.getLatestFrame();a&&this.annotator.loadBaseFrameDataUrl(a.dataUrl,a.width,a.height)}},onPauseChange:a=>{this.handlePauseStateChanged(a)},onFocusChange:a=>{this.updateFocusPillUI(a)},onLog:(a,i,n)=>{this.updateLogsUI(n)},onPanic:(a,i)=>{this.updateLogsUI(i),this.showRuntimePanicView(a)}}),this.bindEvents(),this.syncSessionAndWorkspaceFromServer()}async applyWorkspaceUri(t){if(!t||!t.trim())return!1;try{const e=await vt(t);return e.workspace&&et(e.workspace),this.activePkg=".",this.updateHeaderInputsUI(),!!e.hasGoMod}catch(e){return console.warn("[PlaytestStudioUI] Failed to resolve workspace URI:",e),!1}}async syncSessionAndWorkspaceFromServer(){await Ct(),this.updateHeaderInputsUI(),this.updateSessionBadgeUI()}formatProjectBadgeLabel(t,e){const s=(t||"").trim().replace(/\/+$/,"");if(!s)return"No project selected";const a=s.split("/").filter(Boolean),i=a[a.length-1]||s,n=(e||".").trim()||".";return`${i} (${n})`}openProjectPicker(){Se({currentWorkspace:D(),currentPkg:this.activePkg,onSelectProject:(t,e)=>{et(t),this.activePkg=(e||".").trim()||".",this.updateHeaderInputsUI(),F.info(`Selected project: ${this.formatProjectBadgeLabel(t,this.activePkg)}`,2400)}})}renderHeader(){const t=D(),e=this.formatProjectBadgeLabel(t,this.activePkg),s=t?`${t} (${this.activePkg||"."}) — Click to switch project`:"Click to open a Go game project";this.headerEl.innerHTML=`
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
            title="${this.escapeAttr(s)}"
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
          href="${this.escapeAttr(St())}"
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
    `,this.updateSessionBadgeUI()}renderAnnotationBar(){const t=Vt.map((e,s)=>`
        <button
          type="button"
          class="qa-color-swatch ${s===0?"active":""}"
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
    `}renderViewport(){const t=D();this.viewportEl.innerHTML=`
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
    `}bindEvents(){const t=this.headerEl.querySelector("#workspace-input"),e=this.viewportEl.querySelector("#ready-workspace-input"),s=l=>{et(l),t&&t.value!==l&&(t.value=l),e&&e.value!==l&&(e.value=l),this.updateHeaderInputsUI()};t?.addEventListener("change",()=>s(t.value)),e?.addEventListener("input",()=>s(e.value)),e?.addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),s(e.value),this.handleBuildAndRun())}),this.headerEl.querySelector("#btn-open-project")?.addEventListener("click",()=>{this.openProjectPicker()}),this.headerEl.querySelector("#playtest-project-label")?.addEventListener("click",()=>{this.openProjectPicker()}),this.viewportEl.querySelector("#btn-ready-open-project")?.addEventListener("click",()=>{this.openProjectPicker()}),jt(()=>this.updateHeaderInputsUI()),te(()=>this.updateSessionBadgeUI()),this.headerEl.querySelector("#btn-build-run")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-ready-build")?.addEventListener("click",()=>{e&&s(e.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-retry-build")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-send-build-error")?.addEventListener("click",()=>{this.handleSendBuildErrorToChat()}),this.headerEl.querySelector("#btn-pause-toggle")?.addEventListener("click",()=>{this.runner.togglePause()}),this.headerEl.querySelector("#btn-home-ready")?.addEventListener("click",()=>{this.showReadyStateView()}),this.headerEl.querySelector("#btn-keypad-toggle")?.addEventListener("click",()=>{this.keypadVisible=!this.keypadVisible,this.keypadOverlayEl.classList.toggle("hidden",!this.keypadVisible),this.headerEl.querySelector("#btn-keypad-toggle")?.classList.toggle("active",this.keypadVisible)}),this.headerEl.querySelector("#btn-mute-toggle")?.addEventListener("click",()=>{const l=this.runner.toggleMuted(),u=this.headerEl.querySelector("#mute-btn-label"),m=this.headerEl.querySelector("#btn-mute-toggle");if(u&&(u.textContent=l?"🔇":"🔊"),m){const f=l?"Unmute Game Audio (Muted)":"Mute Game Audio";m.setAttribute("data-tooltip",f),m.setAttribute("title",f)}}),this.headerEl.querySelector("#btn-logs-toggle")?.addEventListener("click",()=>{this.logsDrawerVisible=!this.logsDrawerVisible,this.logsDrawerEl.classList.toggle("hidden",!this.logsDrawerVisible),this.headerEl.querySelector("#btn-logs-toggle")?.classList.toggle("active",this.logsDrawerVisible)}),this.viewportEl.querySelector("#btn-close-logs")?.addEventListener("click",()=>{this.logsDrawerVisible=!1,this.logsDrawerEl.classList.add("hidden"),this.headerEl.querySelector("#btn-logs-toggle")?.classList.remove("active")}),this.viewportEl.querySelector("#btn-clear-logs")?.addEventListener("click",()=>{this.runner.clearConsoleLogs(),this.updateLogsUI([])}),this.headerEl.querySelector("#btn-session-badge")?.addEventListener("click",()=>{this.openSessionSwitcherModal()}),this.focusPillEl.addEventListener("click",()=>{this.runner.isPaused()||this.runner.focus()}),this.keypadOverlayEl.querySelectorAll(".keypad-btn").forEach(l=>{const u=l,m=u.dataset.code||"Space",f=u.dataset.key||" ",p=S=>{S.preventDefault(),u.classList.add("pressed"),this.runner.dispatchVirtualKey(m,f,"keydown")},x=S=>{S.preventDefault(),u.classList.contains("pressed")&&(u.classList.remove("pressed"),this.runner.dispatchVirtualKey(m,f,"keyup"))};u.addEventListener("pointerdown",p),u.addEventListener("pointerup",x),u.addEventListener("pointerleave",x),u.addEventListener("pointercancel",x)}),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(l=>{l.addEventListener("click",()=>{const u=l.dataset.tool;u&&this.selectAnnotationTool(u)})});const n=this.annotationBarEl.querySelectorAll(".qa-color-swatch");n.forEach(l=>{l.addEventListener("click",()=>{const u=l.dataset.color;u&&(this.annotator.setColor(u),n.forEach(m=>m.classList.remove("active")),l.classList.add("active"))})}),this.annotationBarEl.querySelector("#btn-ann-undo")?.addEventListener("click",()=>{this.annotator.undo()}),this.annotationBarEl.querySelector("#btn-ann-redo")?.addEventListener("click",()=>{this.annotator.redo()}),this.annotationBarEl.querySelector("#btn-ann-clear")?.addEventListener("click",()=>{this.annotator.clearAnnotations()});const r=this.annotationBarEl.querySelector("#dvr-scrubber-slider");r.addEventListener("input",()=>{const l=Number.parseInt(r.value,10);this.scrubToDvrFrame(l)}),this.annotationBarEl.querySelector("#btn-dvr-prev")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.max(0,this.activeDvrIndex-1);this.scrubToDvrFrame(l)}}),this.annotationBarEl.querySelector("#btn-dvr-next")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1);this.scrubToDvrFrame(l)}});const o=this.bugBarEl.querySelector("#btn-toggle-attach-logs"),d=this.bugBarEl.querySelector("#include-logs-checkbox");o?.addEventListener("click",()=>{const l=d?!d.checked:!1;d&&(d.checked=l),o.classList.toggle("active",l),o.setAttribute("aria-pressed",String(l));const u=l?"Attach WASM Console Logs (ON)":"Attach WASM Console Logs (OFF)";o.setAttribute("data-tooltip",u),o.setAttribute("title",u)}),this.bugBarEl.querySelector("#bug-note-input").addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),this.handleSendBugToChat())}),this.bugBarEl.querySelector("#btn-send-bug-chat")?.addEventListener("click",()=>{this.handleSendBugToChat()}),this.bugBarEl.querySelector("#btn-send-gif-chat")?.addEventListener("click",()=>{this.handleSendGifToChat()}),window.addEventListener("keydown",l=>{if(this.headerEl.classList.contains("studio-view-hidden"))return;const u=l.target,m=u&&(u.tagName==="INPUT"||u.tagName==="TEXTAREA"||u.isContentEditable);if(l.code==="F8"||!m&&l.code==="Backquote"){this.runner.isRunning()&&(l.preventDefault(),l.stopPropagation(),this.runner.togglePause());return}if(!(m||!this.runner.isPaused())){if((l.metaKey||l.ctrlKey)&&l.key.toLowerCase()==="z"){l.preventDefault(),l.shiftKey?this.annotator.redo():this.annotator.undo();return}l.code==="KeyP"?(l.preventDefault(),this.selectAnnotationTool("pen")):l.code==="KeyA"?(l.preventDefault(),this.selectAnnotationTool("arrow")):l.code==="KeyB"?(l.preventDefault(),this.selectAnnotationTool("box")):l.code==="KeyT"?(l.preventDefault(),this.selectAnnotationTool("text")):l.code==="ArrowLeft"?(l.preventDefault(),this.scrubToDvrFrame(Math.max(0,this.activeDvrIndex-1))):l.code==="ArrowRight"&&(l.preventDefault(),this.scrubToDvrFrame(Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1)))}},{capture:!0})}async handleBuildAndRun(){if(this.isBuilding)return;const t=D().trim();if(!t){F.error("Missing Go Workspace Path",'Click "Open Project" in the header bar to select your Ebitengine Go project before building.'),this.openProjectPicker();return}this.isBuilding=!0,this.lastBuildFailure=null,this.setBuildButtonsLoading(!0);try{F.info(`Compiling Go WASM in "${t}" (${this.activePkg||"."})...`,2500);const e=await re({workspace:t,pkg:this.activePkg});if(!e.ok){this.lastBuildFailure=e,this.showBuildErrorView(e),F.error("Go WASM Compilation Failed (HTTP 422)",e.compilerOutput.slice(0,240));return}this.activePkg=e.pkg||".",this.updateHeaderInputsUI(),this.showActiveGameStage(),await this.runner.launchBuild(e.buildId);const s=this.headerEl.querySelector("#btn-pause-toggle");s&&(s.disabled=!1);const a=(e.wasmBytes/(1024*1024)).toFixed(2);F.success(`Built & launched ${e.pkg} (${a} MB WASM in ${e.durationMs}ms)`),this.runner.focus()}catch(e){F.error("WASM Build / Launch Error",e?.message||String(e))}finally{this.isBuilding=!1,this.setBuildButtonsLoading(!1)}}handlePauseStateChanged(t){const e=this.headerEl.querySelector("#btn-pause-toggle"),s=this.headerEl.querySelector("#pause-btn-label");if(t){e&&(e.classList.add("btn-warning-active"),e.setAttribute("data-tooltip","Resume Gameplay (` or F8)"),e.setAttribute("title","Resume Gameplay (` or F8)")),s&&(s.textContent="▶️ Resume"),this.annotationBarEl.classList.remove("hidden"),this.annotationStageEl.classList.remove("hidden");const a=this.runner.getGameCanvas();if(a&&a.width>0&&a.height>0)this.annotator.loadBaseFromCanvas(a);else{const i=this.dvrBuffer.getLatestFrame();i&&this.annotator.loadBaseFrameDataUrl(i.dataUrl,i.width,i.height)}this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.updateFocusPillUI(!1)}else e&&(e.classList.remove("btn-warning-active"),e.setAttribute("data-tooltip","Freeze Frame & Annotate Bug (` or F8)"),e.setAttribute("title","Freeze Frame & Annotate Bug (` or F8)")),s&&(s.textContent="⏸️ Pause"),this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.runner.focus()}async scrubToDvrFrame(t){const e=this.dvrBuffer.getFrameAt(t);e&&(this.activeDvrIndex=e.index,this.updateDvrScrubberUI(),e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}updateDvrScrubberUI(){const t=this.annotationBarEl.querySelector("#dvr-scrubber-slider"),e=this.annotationBarEl.querySelector("#dvr-frame-badge"),s=this.annotationBarEl.querySelector("#btn-dvr-prev"),a=this.annotationBarEl.querySelector("#btn-dvr-next"),i=this.dvrBuffer.length;if(i===0){t&&(t.min="0",t.max="0",t.value="0",t.disabled=!0),e&&(e.textContent="0.0s",e.setAttribute("data-tooltip","Live (0.0s)"),e.setAttribute("title","Live (0.0s)")),s&&(s.disabled=!0),a&&(a.disabled=!0);return}const n=Math.max(0,Math.min(i-1,this.activeDvrIndex)),r=this.dvrBuffer.getFrameAt(n);if(t&&(t.disabled=!1,t.min="0",t.max=String(i-1),t.value=String(n)),s&&(s.disabled=n<=0),a&&(a.disabled=n>=i-1),e&&r){const o=r.relativeSec===0?"0.0s":`${r.relativeSec.toFixed(1)}s`,d=r.relativeSec===0?`Live (0.0s) · Frame ${n+1}/${i}`:`${r.relativeSec.toFixed(2)}s · Frame ${n+1}/${i}`;e.textContent=o,e.setAttribute("data-tooltip",d),e.setAttribute("title",d)}}selectAnnotationTool(t){this.annotator.setTool(t),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(s=>{const a=s.dataset.tool;s.classList.toggle("active",a===t)})}updateAnnotationControlsUI(){const t=this.annotationBarEl.querySelector("#btn-ann-undo"),e=this.annotationBarEl.querySelector("#btn-ann-redo"),s=this.annotationBarEl.querySelector("#btn-ann-clear");t&&(t.disabled=!this.annotator.canUndo()),e&&(e.disabled=!this.annotator.canRedo()),s&&(s.disabled=this.annotator.getShapes().length===0)}updateFocusPillUI(t){if(this.focusPillEl){if(this.runner.isPaused()){this.focusPillEl.className="focus-status-pill paused",this.focusPillEl.innerHTML="<span>⏸ Paused: Draw on Frame or Scrub 10s DVR</span>";return}t?(this.focusPillEl.className="focus-status-pill focused",this.focusPillEl.innerHTML="<span>● Controls Active (` or F8 to Pause)</span>"):(this.focusPillEl.className="focus-status-pill unfocused",this.focusPillEl.innerHTML="<span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>")}}updateLogsUI(t){const e=this.headerEl.querySelector("#logs-count-badge");e&&(e.textContent=String(t.length));const s=this.viewportEl.querySelector("#logs-drawer-content");s&&(s.textContent=t.length>0?t.join(`
`):"No WASM console output recorded yet.",s.scrollTop=s.scrollHeight)}showReadyStateView(){this.runner.destroy(),this.lastBuildFailure=null,this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.readyStateEl.classList.remove("hidden");const t=this.headerEl.querySelector("#btn-pause-toggle"),e=this.headerEl.querySelector("#pause-btn-label");t&&(t.disabled=!0,t.classList.remove("btn-warning-active")),e&&(e.textContent="⏸️ Pause"),this.updateHeaderInputsUI()}showActiveGameStage(){this.readyStateEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.gameStageEl.classList.remove("hidden")}showBuildErrorView(t){this.runner.destroy(),this.annotationBarEl.classList.add("hidden"),this.readyStateEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.remove("hidden");const e=this.viewportEl.querySelector("#error-state-title"),s=this.viewportEl.querySelector("#error-state-meta"),a=this.viewportEl.querySelector("#error-state-traceback");e&&(e.textContent=t.error||"Go WASM Compilation Failed"),s&&(s.textContent=`Workspace: ${t.workspace} | Package: ${t.pkg} | Exit Code: ${t.exitCode}`),a&&(a.textContent=t.compilerOutput)}showRuntimePanicView(t){const e=D()||".";this.lastBuildFailure={ok:!1,status:422,error:"Go WASM Runtime Panic",compilerOutput:[t,"",...this.runner.getConsoleLogs().slice(-30)].join(`
`),workspace:e,pkg:this.activePkg,exitCode:2},this.showBuildErrorView(this.lastBuildFailure)}async handleSendBuildErrorToChat(){if(!this.lastBuildFailure)return;const t=this.viewportEl.querySelector("#btn-send-build-error");t&&(t.disabled=!0);try{const s=this.bugBarEl.querySelector("#bug-note-input")?.value.trim()||"";await oe({buildError:this.lastBuildFailure.compilerOutput,note:s,workspace:this.lastBuildFailure.workspace,pkg:this.lastBuildFailure.pkg}),F.success("Sent Go WASM compiler traceback directly to Antigravity chat!")}catch(e){F.error("Failed to send build error to chat",e?.message||String(e))}finally{t&&(t.disabled=!1)}}async ensurePausedFrameLoaded(){if(this.runner.isRunning()&&!this.runner.isPaused()?this.runner.setPaused(!0):this.dvrBuffer.length===0&&(this.runner.syncDvrFromChild(),this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI()),!this.annotator.hasFrozenFrame()){const t=this.runner.getGameCanvas();if(t&&t.width>0&&t.height>0)this.annotator.loadBaseFromCanvas(t);else{const e=this.dvrBuffer.getLatestFrame();e&&(e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}}}decodeDataUrlToImage(t){return new Promise((e,s)=>{const a=new Image;a.onload=()=>e(a),a.onerror=()=>s(new Error("Failed to decode frame dataUrl into HTMLImageElement.")),a.src=t})}async buildDvrAnimatedGifDataUrl(){await this.ensurePausedFrameLoaded();const t=this.dvrBuffer.getFrames(),e=t.length>0?Math.max(0,Math.min(t.length-1,this.activeDvrIndex)):0,s=t.length>0?t.slice(0,e+1):[],a=this.annotator.getDimensions(),i=s[0]?.width||a.width||640,n=s[0]?.height||a.height||360;let r={x:0,y:0,width:i,height:n};const o=s[s.length-1]||s[0];if(o){const v=document.createElement("canvas");v.width=i,v.height=n;const g=v.getContext("2d",{willReadFrequently:!0});if(g){if(g.clearRect(0,0,i,n),o.canvas)g.drawImage(o.canvas,0,0,i,n);else if(o.dataUrl){const y=await this.decodeDataUrlToImage(o.dataUrl);g.drawImage(y,0,0,i,n)}const b=g.getImageData(0,0,i,n);r=Ft(b.data,i,n)}}const d=480,h=r.width>d?d/r.width:1,l=Math.max(64,Math.round(r.width*h)),u=Math.max(36,Math.round(r.height*h)),m=document.createElement("canvas");m.width=l,m.height=u;const f=m.getContext("2d",{willReadFrequently:!0});if(!f)throw new Error("Failed to acquire 2D context for GIF encoding.");f.imageSmoothingEnabled=!1;const p=[];for(let v=0;v<s.length;v++){const g=s[v];if(f.fillStyle="#090D16",f.fillRect(0,0,l,u),g.canvas)f.drawImage(g.canvas,r.x,r.y,r.width,r.height,0,0,l,u);else{const B=await this.decodeDataUrlToImage(g.dataUrl);f.drawImage(B,r.x,r.y,r.width,r.height,0,0,l,u)}const b=f.getImageData(0,0,l,u),y=v===s.length-1;let w=this.dvrBuffer.captureIntervalMs;if(v+1<s.length){const B=s[v+1].timestampMs-g.timestampMs;Number.isFinite(B)&&B>=15&&B<=250&&(w=Math.round(B))}p.push({rgba:new Uint8Array(b.data),delayMs:y?900:w})}if(p.length===0){const v=this.runner.getGameCanvas();if(f.fillStyle="#090D16",f.fillRect(0,0,l,u),v&&v.width>0&&v.height>0){const b=v.getContext("2d");if(b){const y=b.getImageData(0,0,v.width,v.height);r=Ft(y.data,v.width,v.height)}f.drawImage(v,r.x,r.y,r.width,r.height,0,0,l,u)}const g=f.getImageData(0,0,l,u);p.push({rgba:new Uint8Array(g.data),delayMs:900})}const x=fe({width:l,height:u,frames:p}),S=s.length>=2?(s[s.length-1].timestampMs-s[0].timestampMs)/1e3:s.length*this.dvrBuffer.captureIntervalMs/1e3,E=Number(Math.max(.04,S).toFixed(2));return{dataUrl:ge(x),width:l,height:u,frameCount:p.length,durationSec:E}}async handleSendGifToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}const t=this.bugBarEl.querySelector("#btn-send-gif-chat"),e=this.bugBarEl.querySelector("#btn-send-bug-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{F.info("Encoding 10s DVR replay (25 FPS) into animated GIF...",2400);const s=await this.buildDvrAnimatedGifDataUrl(),a=this.bugBarEl.querySelector("#bug-note-input"),i=this.bugBarEl.querySelector("#include-logs-checkbox"),n=a?.value.trim()||"",o=(i?i.checked:!0)?this.runner.getConsoleLogs():[],d=this.dvrBuffer.getFrameAt(this.activeDvrIndex),h=d?d.relativeSec===0?"live (0.0s)":`${d.relativeSec.toFixed(2)}s`:"live",l=`playtest-clip-${Date.now()}.gif`,u=await At({filename:l,imageDataUrl:s.dataUrl,note:n,consoleLogs:o,workspace:D()||".",pkg:this.activePkg,frameOffset:`${s.frameCount}f (${s.durationSec}s DVR → ${h})`,resolution:`${s.width}x${s.height}`,width:s.width,height:s.height});F.success(`Delivered 10s DVR GIF "${u.filename||l}" (${s.frameCount} frames) to chat!`),a&&(a.value="")}catch(s){F.error("Failed to encode or send 10s DVR GIF",s?.message||String(s))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}async handleSendBugToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}await this.ensurePausedFrameLoaded();const t=this.bugBarEl.querySelector("#btn-send-bug-chat"),e=this.bugBarEl.querySelector("#btn-send-gif-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{const s=this.bugBarEl.querySelector("#bug-note-input"),a=this.bugBarEl.querySelector("#include-logs-checkbox"),i=s?.value.trim()||"",r=(a?a.checked:!0)?this.runner.getConsoleLogs():[],o=this.annotator.exportSmartComposite(),d=this.dvrBuffer.getFrameAt(this.activeDvrIndex),h=d?d.relativeSec===0?"live (0.0s)":`${d.relativeSec.toFixed(2)}s`:"live",l=`playtest-bug-${Date.now()}.png`,u=await At({filename:l,imageDataUrl:o.dataUrl,note:i,consoleLogs:r,workspace:D()||".",pkg:this.activePkg,frameOffset:h,resolution:`${o.width}x${o.height}`,width:o.width,height:o.height});F.success(`Delivered "${u.filename||l}" to Antigravity chat!`),s&&(s.value="")}catch(s){F.error("Failed to send bug report to chat",s?.message||String(s))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}setBuildButtonsLoading(t){const e=this.headerEl.querySelector("#btn-build-run"),s=this.headerEl.querySelector("#build-btn-label"),a=this.viewportEl.querySelector("#btn-ready-build");e&&(e.disabled=t),a&&(a.disabled=t,a.innerHTML=t?"<span>⏳ Compiling &amp; Launching WASM...</span>":"<span>▶ Compile &amp; Launch Ebitengine WASM</span>"),s&&(s.textContent=t?"⏳ Building...":"🚀 Run")}updateHeaderInputsUI(){const t=D(),e=this.headerEl.querySelector("#workspace-input"),s=this.viewportEl.querySelector("#ready-workspace-input");e&&e.value!==t&&(e.value=t),s&&s.value!==t&&(s.value=t);const a=this.headerEl.querySelector("#playtest-project-label");if(a){a.textContent=this.formatProjectBadgeLabel(t,this.activePkg);const n=t?`${t} (${this.activePkg||"."}) — Click to switch project`:"Click to open a Go game project";a.setAttribute("title",n)}const i=this.headerEl.querySelector("#btn-full-studio");i&&(i.href=St())}updateSessionBadgeUI(){const t=J(),e=this.headerEl.querySelector("#btn-session-badge"),s=this.headerEl.querySelector("#btn-full-studio");if(e){const a=e.querySelector(".status-dot"),i=e.querySelector("#session-badge-text");if(t&&t!=="standalone"){e.className="session-badge connected",a&&(a.className="status-dot online"),i&&(i.textContent=`${t.slice(0,8)}...`);const n=`Session: ${t.slice(0,8)}... (Click to switch)`;e.setAttribute("data-tooltip",n),e.setAttribute("title",n)}else{e.className="session-badge disconnected",a&&(a.className="status-dot offline"),i&&(i.textContent="Standalone");const n="Session: Standalone (Click to connect)";e.setAttribute("data-tooltip",n),e.setAttribute("title",n)}}s&&(s.href=St())}async openSessionSwitcherModal(){const t=document.getElementById("session-switcher-modal");t&&t.remove();const e=document.createElement("div");e.id="session-switcher-modal",e.className="modal-overlay",e.innerHTML=`
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
              value="${this.escapeAttr(J()||"")}"
            />
            <button type="button" id="btn-apply-session" class="btn btn-primary btn-sm">Connect</button>
          </div>
          <div id="recent-sessions-list" class="recent-sessions-list">
            <div class="session-loading">Loading recent Antigravity sessions...</div>
          </div>
        </div>
      </div>
    `;const s=()=>e.remove();e.querySelector("#session-modal-close")?.addEventListener("click",s),e.addEventListener("click",i=>{i.target===e&&s()}),e.querySelector("#btn-apply-session")?.addEventListener("click",()=>{const n=e.querySelector("#manual-session-input").value.trim();if(n)try{yt(n),F.success(`Connected to session ${n}`),s()}catch(r){F.error("Invalid Session ID",r?.message||String(r))}}),document.body.appendChild(e);const a=e.querySelector("#recent-sessions-list");try{const i=await ne();if(i.length===0){a.innerHTML='<div class="session-empty">No recent sessions found.</div>';return}a.innerHTML=i.map(n=>`
          <button type="button" class="session-item-btn" data-sid="${this.escapeAttr(n.id)}">
            <span class="session-item-id">${this.escapeHtml(n.id)}</span>
            <span class="session-item-time">${this.escapeHtml(new Date(n.updatedAt).toLocaleTimeString())}</span>
          </button>
        `).join(""),a.querySelectorAll(".session-item-btn").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.sid;r&&(yt(r),F.success(`Connected to session ${r.slice(0,8)}...`),s())})})}catch(i){a.innerHTML=`<div class="session-empty">Failed to load sessions: ${this.escapeHtml(i?.message||String(i))}</div>`}}escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}escapeAttr(t){return this.escapeHtml(t).replace(/'/g,"&#39;")}}const K={ym2612_guitar:{volume:.16,pan:-.12},ym2612_rhythm_guitar:{volume:.1,pan:.36},ym2612_bell:{volume:.06,pan:.25},ym2612_epiano:{volume:.13,pan:-.24},ym2612_brass:{volume:.12,pan:.2},ym2612_strings:{volume:.1,pan:-.3},ym2612_choir:{volume:.1,pan:-.3},ym2612_flute:{volume:.12,pan:-.15},psg_arp:{volume:.072,pan:-.44},psg_square:{volume:.05,pan:.48},ym2612_bass:{volume:.24,pan:0},ym2612_slap_bass:{volume:.25,pan:0},sub_bass:{volume:.22,pan:0},kick:{volume:.19,pan:0},ym2612_kick:{volume:.19,pan:0},snare:{volume:.14,pan:.08},ym2612_snare:{volume:.14,pan:.08},tom:{volume:.14,pan:0},ym2612_tom:{volume:.14,pan:0},hat:{volume:.08,pan:-.15},ym2612_hat:{volume:.08,pan:-.15},open_hat:{volume:.09,pan:-.15},ym2612_open_hat:{volume:.09,pan:-.15},crash:{volume:.11,pan:.2},ym2612_crash:{volume:.11,pan:.2}},ke=[{id:"arcade_laser",label:"Laser",fileName:"laser_arcade.sfx"},{id:"plasma_gun",label:"Plasma",fileName:"plasma_gun.sfx"},{id:"explosion_arcade",label:"8-Bit Boom",fileName:"explosion_arcade.sfx"},{id:"explosion_deep",label:"Deep Boom",fileName:"explosion_deep.sfx"},{id:"jump_arcade",label:"Jump",fileName:"jump_arcade.sfx"},{id:"jump_spring",label:"Spring",fileName:"jump_spring.sfx"},{id:"coin_pickup",label:"Coin",fileName:"coin_pickup.sfx"},{id:"gem_shimmer",label:"Gem",fileName:"gem_shimmer.sfx"},{id:"sword_clash",label:"Sword",fileName:"sword_clash.sfx"},{id:"shield_deflect",label:"Shield",fileName:"shield_deflect.sfx"},{id:"hit_punch",label:"Punch",fileName:"hit_punch.sfx"},{id:"hit_damage",label:"Damage",fileName:"hit_damage.sfx"},{id:"powerup_fanfare",label:"Fanfare",fileName:"powerup_fanfare.sfx"},{id:"ui_select",label:"Menu Tick",fileName:"ui_select.sfx"},{id:"ui_confirm",label:"Confirm",fileName:"ui_confirm.sfx"},{id:"ui_error",label:"Error",fileName:"ui_error.sfx"},{id:"footstep_stone",label:"Footstep",fileName:"footstep_stone.sfx"},{id:"engine_thruster",label:"Thruster",fileName:"engine_thruster.sfx"}],Fe=[{id:"square",label:"Square"},{id:"sawtooth",label:"Saw"},{id:"triangle",label:"Triangle"},{id:"sine",label:"Sine"},{id:"fm",label:"Metallic FM"},{id:"psg_noise",label:"8-Bit Noise"}],qt=[{id:"ym2612_guitar",label:"FM Lead Guitar",dslWave:"wave=ym2612_guitar gm=overdriven_guitar"},{id:"ym2612_rhythm_guitar",label:"FM Rhythm Guitar",dslWave:"wave=ym2612_rhythm_guitar gm=distortion_guitar"},{id:"ym2612_brass",label:"FM Synth Brass",dslWave:"wave=ym2612_brass gm=synth_brass_1"},{id:"ym2612_epiano",label:"FM Electric Piano",dslWave:"wave=ym2612_epiano gm=epiano1"},{id:"ym2612_bell",label:"FM Crystal Bell",dslWave:"wave=ym2612_bell gm=vibraphone"},{id:"ym2612_strings",label:"FM Strings Pad",dslWave:"wave=ym2612_strings gm=string_ensemble_1"},{id:"ym2612_choir",label:"FM Choir Pad",dslWave:"wave=ym2612_choir gm=choir_aahs"},{id:"ym2612_flute",label:"FM Flute",dslWave:"wave=ym2612_flute gm=flute"},{id:"ym2612_bass",label:"FM Synth Bass",dslWave:"wave=ym2612_bass gm=electric_bass"},{id:"ym2612_slap_bass",label:"FM Slap Bass",dslWave:"wave=ym2612_slap_bass gm=slap_bass_1"},{id:"sub_bass",label:"Deep Sub Bass",dslWave:"wave=sub_bass gm=synth_bass_2"},{id:"psg_square",label:"PSG Chiptune Square",dslWave:"wave=psg_square gm=lead_square"},{id:"psg_arp",label:"PSG Fast Arpeggio",dslWave:"wave=psg_arp gm=clavinet"},{id:"square",label:"Square Lead",dslWave:"wave=square duty=0.25 gm=lead_square"},{id:"pulse",label:"Pulse Lead",dslWave:"wave=pulse duty=0.25 gm=lead_square"},{id:"sawtooth",label:"Sawtooth Lead",dslWave:"wave=sawtooth gm=lead_sawtooth"},{id:"triangle",label:"Warm Triangle",dslWave:"wave=triangle gm=ocarina"},{id:"sine",label:"Pure Sine",dslWave:"wave=sine gm=ocarina"},{id:"fm",label:"2-Op FM Synth",dslWave:"wave=fm gm=epiano2"},{id:"piano",label:"Grand Piano",dslWave:"wave=piano gm=acoustic_grand_piano"},{id:"epiano",label:"Rhodes E-Piano",dslWave:"wave=epiano gm=epiano1"},{id:"organ",label:"Pipe / Rock Organ",dslWave:"wave=organ gm=church_organ"},{id:"guitar",label:"Acoustic Guitar",dslWave:"wave=guitar gm=acoustic_guitar"},{id:"harp",label:"Orchestral Harp",dslWave:"wave=harp gm=orchestral_harp"},{id:"violin",label:"Solo Violin",dslWave:"wave=violin gm=violin"},{id:"cello",label:"Solo Cello",dslWave:"wave=cello gm=cello"},{id:"strings",label:"String Ensemble",dslWave:"wave=strings gm=string_ensemble_1"},{id:"voice",label:"Choir Voice",dslWave:"wave=voice gm=choir_aahs"},{id:"flute",label:"Concert Flute",dslWave:"wave=flute gm=flute"},{id:"oboe",label:"Oboe",dslWave:"wave=oboe gm=oboe"},{id:"clarinet",label:"Clarinet",dslWave:"wave=clarinet gm=clarinet"},{id:"shakuhachi",label:"Shakuhachi",dslWave:"wave=shakuhachi gm=shakuhachi"},{id:"brass",label:"Brass Section",dslWave:"wave=brass gm=brass_section"},{id:"trumpet",label:"Trumpet",dslWave:"wave=trumpet gm=trumpet"},{id:"horn",label:"French Horn",dslWave:"wave=horn gm=french_horn"},{id:"koto",label:"Koto",dslWave:"wave=koto gm=koto"},{id:"shamisen",label:"Shamisen",dslWave:"wave=shamisen gm=shamisen"},{id:"bell",label:"Tubular Bell",dslWave:"wave=bell gm=tubular_bells"}],Rt={larghissimo:24,grave:42,largo:50,lento:56,larghetto:63,adagio:70,adagietto:76,marcia_moderato:84,andante:88,andantino:96,moderato:112,allegretto:120,allegro_moderato:124,allegro:138,vivace:160,vivacissimo:172,allegrissimo:176,presto:188,prestissimo:208},Q=new Set(["noise","kick","snare","tom","hat","open_hat","crash","ym2612_kick","ym2612_snare","ym2612_tom","ym2612_hat","ym2612_open_hat","ym2612_crash"]);function ft(c){const t=(c||"").trim().toLowerCase();switch(t){case"sine":case"sin":return"sine";case"square":case"sq":return"square";case"pulse":return"pulse";case"triangle":case"tri":return"triangle";case"sawtooth":case"saw":return"sawtooth";case"noise":case"white_noise":return"noise";case"fm":case"fm2":return"fm";case"piano":case"grand_piano":return"piano";case"epiano":case"rhodes":return"epiano";case"organ":case"pipe_organ":case"church_organ":return"organ";case"guitar":case"acoustic_guitar":return"guitar";case"harp":case"pluck":return"harp";case"violin":return"violin";case"cello":return"cello";case"strings":case"ensemble":return"strings";case"voice":case"choir":case"vocal":return"voice";case"flute":return"flute";case"oboe":return"oboe";case"clarinet":return"clarinet";case"shakuhachi":return"shakuhachi";case"brass":case"brass_ensemble":return"brass";case"trumpet":return"trumpet";case"horn":case"french_horn":return"horn";case"koto":return"koto";case"shamisen":return"shamisen";case"bell":case"chime":return"bell";case"ym2612_guitar":case"overdriven_guitar":case"distortion_guitar":case"electric_guitar":case"fm_guitar":return"ym2612_guitar";case"ym2612_rhythm_guitar":case"rhythm_guitar":case"power_guitar":case"muted_guitar":return"ym2612_rhythm_guitar";case"ym2612_bass":case"synth_bass":case"fm_bass":case"bass":return"ym2612_bass";case"ym2612_slap_bass":case"slap_bass":return"ym2612_slap_bass";case"sub_bass":return"sub_bass";case"ym2612_brass":case"fm_brass":case"synth_brass":case"polysynth":return"ym2612_brass";case"ym2612_epiano":case"fm_epiano":case"dx7":return"ym2612_epiano";case"ym2612_strings":case"fm_strings":case"synth_strings":return"ym2612_strings";case"ym2612_choir":case"fm_choir":case"ym2612_voice":return"ym2612_choir";case"ym2612_flute":case"fm_flute":return"ym2612_flute";case"ym2612_bell":case"fm_bell":return"ym2612_bell";case"psg_square":case"psg_pulse":case"sn76489":return"psg_square";case"psg_arp":return"psg_arp";default:return t||"ym2612_brass"}}function Nt(c){const t=(c||"").trim().toLowerCase();return t==="pulse"||t==="sq"||t==="square"||t==="psg_square"?"square":t==="saw"||t==="sawtooth"?"sawtooth":t==="tri"||t==="triangle"?"triangle":t==="sin"||t==="sine"?"sine":t==="fm"||t==="fm2"?"fm":t==="noise"||t==="psg_noise"||t==="lfsr"||t==="white_noise"?"psg_noise":"square"}function _t(c){const t=c.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);if(!t)return null;let s={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[t[1].toUpperCase()];if(s===void 0)return null;t[2]==="#"?s+=1:t[2]==="b"&&(s-=1);const i=(parseInt(t[3],10)+1)*12+s;return Math.round(440*Math.pow(2,(i-69)/12))}const Ut=[{name:"arcade_laser",wave:"square",startFreq:950,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.125,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.06,sustain:.25,release:.04,volume:.28},{name:"plasma_gun",wave:"sawtooth",startFreq:1200,endFreq:180,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:3500,lpfEnd:400,hpfStart:0,hpfEnd:0,q:2.2,attack:.002,decay:.08,sustain:.2,release:.05,volume:.3},{name:"explosion_arcade",wave:"psg_noise",startFreq:180,endFreq:25,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:1200,lpfEnd:150,hpfStart:0,hpfEnd:0,q:1.5,attack:.003,decay:.28,sustain:.15,release:.22,volume:.36},{name:"explosion_deep",wave:"sine",startFreq:120,endFreq:24,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.004,decay:.35,sustain:.2,release:.25,volume:.4},{name:"jump_arcade",wave:"square",startFreq:160,endFreq:620,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.003,decay:.04,sustain:.55,release:.05,volume:.26},{name:"jump_spring",wave:"triangle",startFreq:120,endFreq:480,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.004,decay:.06,sustain:.45,release:.06,volume:.28},{name:"coin_pickup",wave:"square",startFreq:988,endFreq:1319,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.025,sustain:.35,release:.035,volume:.22},{name:"gem_shimmer",wave:"fm",startFreq:1568,endFreq:1568,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.06,sustain:.15,release:.12,volume:.2},{name:"sword_clash",wave:"fm",startFreq:520,endFreq:210,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.04,sustain:.08,release:.1,volume:.32},{name:"shield_deflect",wave:"fm",startFreq:880,endFreq:440,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.05,sustain:.1,release:.08,volume:.28},{name:"hit_punch",wave:"triangle",startFreq:180,endFreq:45,pitchCurve:"hyper",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.05,sustain:.1,release:.05,volume:.38},{name:"hit_damage",wave:"sawtooth",startFreq:220,endFreq:65,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.06,sustain:.15,release:.05,volume:.32},{name:"powerup_fanfare",wave:"square",startFreq:523,endFreq:1046,pitchCurve:"exp",dutyStart:.25,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.003,decay:.04,sustain:.5,release:.06,volume:.24},{name:"ui_select",wave:"sine",startFreq:880,endFreq:1100,pitchCurve:"lin",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.015,sustain:.05,release:.015,volume:.18},{name:"ui_confirm",wave:"square",startFreq:659,endFreq:1319,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.025,sustain:.3,release:.03,volume:.2},{name:"ui_error",wave:"sawtooth",startFreq:150,endFreq:110,pitchCurve:"lin",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.002,decay:.05,sustain:.4,release:.04,volume:.25},{name:"footstep_stone",wave:"noise",startFreq:320,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:1400,lpfEnd:400,hpfStart:0,hpfEnd:0,q:1,attack:.001,decay:.025,sustain:.05,release:.02,volume:.2},{name:"engine_thruster",wave:"psg_noise",startFreq:110,endFreq:110,pitchCurve:"exp",dutyStart:.5,dutyEnd:.5,lpfStart:0,lpfEnd:0,hpfStart:0,hpfEnd:0,q:1,attack:.01,decay:.08,sustain:.65,release:.08,volume:.22}],Ce=`title "Arcade Pulse Laser"
type sfx

inst laser preset=arcade_laser duty=0.50->0.125 vol=0.32
track main laser: 950Hz->110Hz:140ms
`,Be=`title "Neon Stage Groove"
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
`;function Te(){typeof window>"u"||typeof HTMLElement>"u"||("popover"in HTMLElement.prototype||import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(()=>{}),typeof document<"u"&&document.documentElement&&!("anchorName"in document.documentElement.style)&&import("https://unpkg.com/@oddbird/css-anchor-positioning").catch(()=>{}),typeof HTMLButtonElement<"u"&&!Object.prototype.hasOwnProperty.call(HTMLButtonElement.prototype,"interestForElement")&&import("https://unpkg.com/interestfor@latest").catch(()=>{}))}class ct{rootEl;activeFileLabelEl;tabSfxBtn;tabMusicBtn;modeGuiBtn;modeTextBtn;vizWaveformBtn;vizSpectrumBtn;playBtnEl;undoBtnEl;redoBtnEl;resetBtnEl;loopBtnEl;openFileBtnEl;artifactsBtnEl;saveBtnEl;exportBtnEl;textEditorPaneEl;textEditorTitleEl;diagnosticsContainerEl;editorTextarea;canvasEl;statusPillBtn;timeReadoutEl;scrubSliderEl;sfxShaperPaneEl;sfxPresetGridEl;sfxToneGroupEl;sfxStartFreqSlider;sfxStartFreqVal;sfxEndFreqSlider;sfxEndFreqVal;sfxDurSlider;sfxDurVal;sfxBrightSlider;sfxBrightVal;sfxGritSlider;sfxGritVal;musicMixerPaneEl;musicBpmSlider;musicBpmVal;musicBankChipBtn;musicBankAppleBtn;trackListEl;chatNoteInputEl;sendChatBtnEl;sfxPresets=[...Ut];activeFilePath="";activeFileName="";activeDocType="sfx";diskSfxFiles=[];editorMode="gui";useAppleSynth=!1;loopEnabled=!1;visualizerMode="waveform";soloTracks=new Set;muteTracks=new Set;trackMetaCache=new Map;trackStemBuffers=new Map;trackStemPeaks=new Map;trackStemBaseMeta=new Map;trackLiveMeta=new Map;activeStemNodes=new Map;masterLimiterNode=null;lastSynthesizedNonMixerDsl="";exportWavNeedsResynth=!1;lastBuildId="";lastReport=null;synthGenId=0;isSynthesizing=!1;pendingSynthRequest=null;realtimeDebounceTimer=null;dslDirty=!0;undoStack=[];redoStack=[];initialSnapshot=null;sliderDragSnapshotTaken=!1;modeSavedState={sfx:null,music:null};sfxState={title:"Arcade Laser",preset:"arcade_laser",wave:"square",startFreq:950,endFreq:110,durationMs:140,brightnessHz:8e3,gritPct:0,volume:.35,pitchCurve:"exp"};audioCtx=null;analyser=null;sourceNode=null;decodedBuffer=null;isPlaying=!1;playStartCtxTime=0;playOffsetSec=0;rafId=null;constructor(t){this.rootEl=t.rootEl,Te(),this.renderLayout(),this.bindEvents(),this.initializeStudio()}renderLayout(){this.rootEl.innerHTML=`
      <div class="sound-studio-shell">
        <!-- Two-Row Standardized Toolbar -->
        <header class="sound-toolbar sound-toolbar-two-rows">
          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <div class="sound-mode-tabs" role="tablist" aria-label="Sound Editor Mode">
                <button
                  type="button"
                  id="tab-mode-music"
                  class="sound-mode-tab"
                  role="tab"
                  aria-selected="false"
                  aria-controls="sound-music-mixer"
                  tabindex="-1"
                  title="Song (.music)"
                >
                  Song
                </button>
                <button
                  type="button"
                  id="tab-mode-sfx"
                  class="sound-mode-tab active"
                  role="tab"
                  aria-selected="true"
                  aria-controls="sound-sfx-shaper"
                  tabindex="0"
                  title="Sound FX (.sfx)"
                >
                  SFX
                </button>
              </div>

              <span
                id="sound-active-file-label"
                class="file-badge-pill"
                title="Active sound or music file"
              >Untitled.sfx</span>
            </div>

            <div class="sound-toolbar-edges">
              <button
                type="button"
                id="sound-open-file-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open .music or .sfx file from workspace or local disk"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span class="btn-label">Open</span>
              </button>

              <button
                type="button"
                id="sound-artifacts-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open or save session artifacts (.music, .sfx)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="btn-label">Artifacts</span>
              </button>

              <button
                type="button"
                id="sound-save-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Save .music or .sfx DSL file"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span class="btn-label">Save</span>
              </button>

              <button
                type="button"
                id="sound-export-btn"
                class="btn btn-sm btn-primary btn-header-action"
                title="Export synthesized .wav audio"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span class="btn-label">Export</span>
              </button>
            </div>
          </div>

          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <div class="sound-mode-tabs" role="tablist" aria-label="Editor View Mode">
                <button
                  type="button"
                  id="btn-sound-mode-gui"
                  class="sound-mode-tab active"
                  role="tab"
                  aria-selected="true"
                  tabindex="0"
                  title="Visual GUI controls"
                >
                  GUI
                </button>
                <button
                  type="button"
                  id="btn-sound-mode-text"
                  class="sound-mode-tab"
                  role="tab"
                  aria-selected="false"
                  tabindex="-1"
                  title="Edit raw .sfx / .music DSL text"
                >
                  Text
                </button>
              </div>

              <div class="sound-mode-tabs" role="group" aria-label="Visualizer Mode">
                <button
                  type="button"
                  id="btn-viz-waveform"
                  class="sound-mode-tab active"
                  title="Show waveform visualizer"
                >
                  Wave
                </button>
                <button
                  type="button"
                  id="btn-viz-spectrum"
                  class="sound-mode-tab"
                  title="Show frequency spectrum visualizer"
                >
                  Spectrum
                </button>
              </div>

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
            </div>
          </div>
        </header>

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
                  title="Click to toggle GUI / Text view"
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

          <!-- 2A. Human-Friendly Sound Effect Shaper (visible in GUI mode for .sfx) -->
          <section
            id="sound-sfx-shaper"
            class="sound-controls-card"
            role="tabpanel"
            aria-labelledby="tab-mode-sfx"
          >
            <div class="sound-preset-strip hidden" id="sound-sfx-preset-grid" aria-label="Sound Effect Files on Disk"></div>

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

          <!-- 2B. Human-Friendly Song Mixer (visible in GUI mode for .music) -->
          <section
            id="sound-music-mixer"
            class="sound-controls-card hidden"
            role="tabpanel"
            aria-labelledby="tab-mode-music"
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

          <!-- 2C. Direct DSL Text Editor (visible in Text mode) -->
          <section
            id="sound-text-editor-pane"
            class="sprite-text-card hidden"
            aria-label="Audio DSL Source Editor"
          >
            <div class="sprite-text-header">
              <span id="sound-text-editor-title" class="sprite-text-title">.sfx Source</span>
              <div class="sprite-text-actions">
                <button type="button" id="btn-apply-raw-dsl" class="btn btn-secondary btn-sm">
                  Apply Code
                </button>
                <button type="button" id="btn-save-raw-dsl" class="btn btn-primary btn-sm">
                  Save File
                </button>
              </div>
            </div>
            <textarea
              id="sound-dsl-textarea"
              class="sound-dsl-textarea sprite-full-textarea"
              spellcheck="false"
              placeholder="# Open a .sfx file above, or write .sfx DSL here..."
              aria-label="Procedural audio DSL source"
            ></textarea>
            <div id="sound-diagnostics-body" class="sound-diagnostics-body"></div>
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
    `,this.activeFileLabelEl=this.rootEl.querySelector("#sound-active-file-label"),this.tabMusicBtn=this.rootEl.querySelector("#tab-mode-music"),this.tabSfxBtn=this.rootEl.querySelector("#tab-mode-sfx"),this.modeGuiBtn=this.rootEl.querySelector("#btn-sound-mode-gui"),this.modeTextBtn=this.rootEl.querySelector("#btn-sound-mode-text"),this.vizWaveformBtn=this.rootEl.querySelector("#btn-viz-waveform"),this.vizSpectrumBtn=this.rootEl.querySelector("#btn-viz-spectrum"),this.playBtnEl=this.rootEl.querySelector("#btn-sound-play"),this.undoBtnEl=this.rootEl.querySelector("#btn-sound-undo"),this.redoBtnEl=this.rootEl.querySelector("#btn-sound-redo"),this.resetBtnEl=this.rootEl.querySelector("#btn-sound-reset"),this.loopBtnEl=this.rootEl.querySelector("#btn-sound-loop"),this.openFileBtnEl=this.rootEl.querySelector("#sound-open-file-btn"),this.artifactsBtnEl=this.rootEl.querySelector("#sound-artifacts-btn"),this.saveBtnEl=this.rootEl.querySelector("#sound-save-btn"),this.exportBtnEl=this.rootEl.querySelector("#sound-export-btn"),this.textEditorPaneEl=this.rootEl.querySelector("#sound-text-editor-pane"),this.textEditorTitleEl=this.rootEl.querySelector("#sound-text-editor-title"),this.diagnosticsContainerEl=this.rootEl.querySelector("#sound-diagnostics-body"),this.editorTextarea=this.rootEl.querySelector("#sound-dsl-textarea"),this.canvasEl=this.rootEl.querySelector("#sound-visualizer-canvas"),this.statusPillBtn=this.rootEl.querySelector("#btn-sound-status-pill"),this.timeReadoutEl=this.rootEl.querySelector("#sound-time-readout"),this.scrubSliderEl=this.rootEl.querySelector("#sound-scrub-slider"),this.sfxShaperPaneEl=this.rootEl.querySelector("#sound-sfx-shaper"),this.sfxPresetGridEl=this.rootEl.querySelector("#sound-sfx-preset-grid"),this.sfxToneGroupEl=this.rootEl.querySelector("#sound-sfx-tone-group"),this.sfxStartFreqSlider=this.rootEl.querySelector("#slider-sfx-start-freq"),this.sfxStartFreqVal=this.rootEl.querySelector("#val-sfx-start-freq"),this.sfxEndFreqSlider=this.rootEl.querySelector("#slider-sfx-end-freq"),this.sfxEndFreqVal=this.rootEl.querySelector("#val-sfx-end-freq"),this.sfxDurSlider=this.rootEl.querySelector("#slider-sfx-dur"),this.sfxDurVal=this.rootEl.querySelector("#val-sfx-dur"),this.sfxBrightSlider=this.rootEl.querySelector("#slider-sfx-bright"),this.sfxBrightVal=this.rootEl.querySelector("#val-sfx-bright"),this.sfxGritSlider=this.rootEl.querySelector("#slider-sfx-grit"),this.sfxGritVal=this.rootEl.querySelector("#val-sfx-grit"),this.musicMixerPaneEl=this.rootEl.querySelector("#sound-music-mixer"),this.musicBpmSlider=this.rootEl.querySelector("#slider-music-bpm"),this.musicBpmVal=this.rootEl.querySelector("#val-music-bpm"),this.musicBankChipBtn=this.rootEl.querySelector("#btn-music-bank-chip"),this.musicBankAppleBtn=this.rootEl.querySelector("#btn-music-bank-apple"),this.trackListEl=this.rootEl.querySelector("#sound-track-list"),this.chatNoteInputEl=this.rootEl.querySelector("#sound-chat-note-input"),this.sendChatBtnEl=this.rootEl.querySelector("#btn-sound-send-chat"),this.renderSfxPresetChips(),this.renderSfxToneButtons(),this.updateActiveFileLabel(),this.syncEditorModeUI()}updateActiveFileLabel(){if(!this.activeFileLabelEl)return;const t=this.activeDocType==="music"?"Untitled.music":"Untitled.sfx",e=this.activeFileName?this.activeFileName:t;this.activeFileLabelEl.textContent=e,this.activeFileLabelEl.title=this.activeFilePath||e}switchEditorMode(t){this.editorMode!==t&&(t==="gui"&&this.editorMode==="text"&&this.syncControlsFromDsl(this.editorTextarea.value),this.editorMode=t,this.syncEditorModeUI())}syncEditorModeUI(){const t=this.editorMode==="gui";if(this.modeGuiBtn&&this.modeTextBtn&&(this.modeGuiBtn.classList.toggle("active",t),this.modeGuiBtn.setAttribute("aria-selected",String(t)),this.modeGuiBtn.setAttribute("tabindex",t?"0":"-1"),this.modeTextBtn.classList.toggle("active",!t),this.modeTextBtn.setAttribute("aria-selected",String(!t)),this.modeTextBtn.setAttribute("tabindex",t?"-1":"0")),this.textEditorTitleEl){const e=this.activeFileName?`${this.activeFileName} (${this.activeDocType==="music"?".music":".sfx"})`:this.activeDocType==="music"?".music Source":".sfx Source";this.textEditorTitleEl.textContent=e}this.editorTextarea&&(this.editorTextarea.placeholder=this.activeDocType==="music"?"# Open a .music file above, or write .music DSL here...":"# Open a .sfx file above, or write .sfx DSL here..."),this.modeTextBtn&&(this.modeTextBtn.title=this.activeDocType==="music"?"Edit raw .music DSL text":"Edit raw .sfx DSL text"),this.openFileBtnEl&&(this.openFileBtnEl.title=this.activeDocType==="music"?"Open .music song file from workspace or local disk":"Open .sfx sound effect file from workspace or local disk"),this.artifactsBtnEl&&(this.artifactsBtnEl.title=this.activeDocType==="music"?"Open or save .music session artifacts":"Open or save .sfx session artifacts"),this.saveBtnEl&&(this.saveBtnEl.title=this.activeDocType==="music"?"Save .music DSL file":"Save .sfx DSL file"),this.chatNoteInputEl&&(this.chatNoteInputEl.placeholder=this.activeDocType==="music"?"Describe a song or ask to change the arrangement...":"Describe a sound effect or ask to tweak this cue..."),this.sfxShaperPaneEl&&this.musicMixerPaneEl&&this.textEditorPaneEl&&(this.sfxShaperPaneEl.classList.toggle("hidden",!t||this.activeDocType!=="sfx"),this.musicMixerPaneEl.classList.toggle("hidden",!t||this.activeDocType!=="music"),this.textEditorPaneEl.classList.toggle("hidden",t))}renderSfxPresetChips(){if(this.sfxPresetGridEl){if(this.diskSfxFiles.length===0){this.sfxPresetGridEl.innerHTML="",this.sfxPresetGridEl.classList.add("hidden");return}this.sfxPresetGridEl.classList.remove("hidden"),this.sfxPresetGridEl.innerHTML=this.diskSfxFiles.map(t=>{const e=this.activeFilePath&&this.activeFilePath===t.path||!this.activeFilePath&&this.activeFileName&&this.activeFileName===t.name,s=t.name.replace(/\.sfx$/i,"");return`
        <button
          type="button"
          class="sound-preset-chip ${e?"active":""}"
          data-sfx-path="${this.escapeHtml(t.path)}"
          title="${this.escapeHtml(t.path)}"
        >
          ${this.escapeHtml(s)}
        </button>
      `}).join(""),this.sfxPresetGridEl.querySelectorAll(".sound-preset-chip").forEach(t=>{t.addEventListener("click",()=>{const e=t.getAttribute("data-sfx-path")||"";e&&this.loadFileFromPath(e,!0)})})}}async refreshDiskSfxFiles(){try{const t=[],e=new Set,s=(i,n)=>{!i||!n||!i.toLowerCase().endsWith(".sfx")||n.replace(/\\/g,"/").includes("/skills/procedural-sfx/scripts/")||e.has(n)||(e.add(n),t.push({name:i,path:n}))},a=this.activeFilePath&&/[\\/]/.test(this.activeFilePath)?this.activeFilePath.replace(/[\\/][^\\/]+$/,""):"";if(a){const i=await P(`/api/fs/list?dir=${encodeURIComponent(a)}&filter=sound&extensions=.sfx`,{method:"GET",cache:"no-store"});if(i.ok){const n=await i.json();if(Array.isArray(n.files))for(const r of n.files)s(r.name||"",r.path||r.filePath||"")}}if(t.length===0){const i=D()||"";if(i){const n=await P(`/api/sound/files?workspace=${encodeURIComponent(i)}`,{method:"GET",cache:"no-store"});if(n.ok){const r=await n.json();if(Array.isArray(r.workspaceFiles))for(const o of r.workspaceFiles){const d=o.path||o.filePath||"",h=o.name||o.fileName||"";(h.toLowerCase().endsWith(".sfx")||o.type==="sfx")&&s(h,d)}}}}this.diskSfxFiles=t}catch{}this.renderSfxPresetChips()}renderSfxToneButtons(){this.sfxToneGroupEl.innerHTML=Fe.map(t=>`
        <button
          type="button"
          class="sound-tone-btn ${this.sfxState.wave===t.id?"active":""}"
          data-wave="${t.id}"
        >
          ${t.label}
        </button>
      `).join(""),this.sfxToneGroupEl.querySelectorAll(".sound-tone-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.getAttribute("data-wave")||"square";this.sfxState.wave!==e&&(this.recordHistoryBeforeChange(),this.sfxState.wave=e,this.renderSfxToneButtons(),this.updateSfxDslInPlace("wave"),this.synthesizeAndPlay(!0,!1))})})}captureSnapshot(){return{dsl:this.editorTextarea.value,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks),useAppleSynth:this.useAppleSynth}}snapshotsEqual(t,e){return!t||!e?!1:t.dsl===e.dsl&&t.useAppleSynth===e.useAppleSynth&&t.soloTracks.join(",")===e.soloTracks.join(",")&&t.muteTracks.join(",")===e.muteTracks.join(",")}resetHistoryBaseline(){this.initialSnapshot=this.captureSnapshot(),this.undoStack=[],this.redoStack=[],this.sliderDragSnapshotTaken=!1,this.updateHistoryButtonsUI()}recordHistoryBeforeChange(){const t=this.captureSnapshot(),e=this.undoStack.length>0?this.undoStack[this.undoStack.length-1]:null;this.snapshotsEqual(t,e)||(this.undoStack.push(t),this.undoStack.length>50&&this.undoStack.shift()),this.redoStack=[],this.updateHistoryButtonsUI()}updateHistoryButtonsUI(){if(!this.undoBtnEl||!this.redoBtnEl||!this.resetBtnEl)return;const t=this.captureSnapshot();this.undoBtnEl.disabled=this.undoStack.length===0,this.redoBtnEl.disabled=this.redoStack.length===0,this.resetBtnEl.disabled=!this.initialSnapshot||this.snapshotsEqual(t,this.initialSnapshot)}stripMixerPropsFromDsl(t){return t.split(`
`).map(e=>{const s=e.trim();if(/^(?:inst|patch)\b/i.test(s)){const a=s.replace(/\b(?:vol|volume)=[^\s]+/gi,"").replace(/\bpan=[^\s]+/gi,"").replace(/\s+/g," ").trim(),i=a.match(/^(?:inst|patch)\s+([^\s]+)\s+wave=([^\s]+)$/i);return i&&i[1].toLowerCase()===i[2].toLowerCase()&&Q.has(i[1].toLowerCase())?"":a}return s}).filter(Boolean).join(`
`)}syncLiveTrackMetaFromDsl(t){const e=this.lastReport?.tracks&&this.lastReport.tracks.length>0?this.lastReport.tracks:this.parseMusicTracksFromDsl(t);for(const s of e){const a=/drum|perc|toms/i.test(s.name)||Q.has((s.waveType||"").toLowerCase()),n=(s.defaultInst||(a?"kick":s.name)).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=t.match(new RegExp(`^\\s*(?:inst|patch)\\s+${n}\\b(.*)$`,"m")),o=r?r[1]:"",d=o.match(/\bwave=([^\s]+)/i),h=o.match(/\bgm=([^\s]+)/i),l=o.match(/\bpreset=([^\s]+)/i),u=d?d[1]:h?h[1]:l?l[1]:s.waveType||(a?"kick":"ym2612_brass"),m=K[u.toLowerCase()]||K[ft(u)],f=this.trackStemBaseMeta.get(s.name)||{volume:s.volume>0?s.volume:m?.volume??.2,pan:typeof s.pan=="number"?s.pan:m?.pan??0},p=o.match(/\b(?:vol|volume)=([0-9.]+)/i),x=o.match(/\bpan=([-+0-9.]+)/i),S=p?Number(p[1]):m?.volume??f.volume,E=x?Number(x[1]):m?.pan??f.pan;this.trackLiveMeta.set(s.name,{volume:S,pan:E});const v=this.trackMetaCache.get(s.name);v&&(v.volume=S,v.pan=E)}}applySnapshot(t){this.sliderDragSnapshotTaken=!1;const e=this.activeDocType==="music"&&this.trackStemBuffers.size>0&&t.useAppleSynth===this.useAppleSynth&&this.stripMixerPropsFromDsl(t.dsl)===this.lastSynthesizedNonMixerDsl;if(this.editorTextarea.value=t.dsl,this.soloTracks=new Set(t.soloTracks),this.muteTracks=new Set(t.muteTracks),this.useAppleSynth=t.useAppleSynth,this.musicBankChipBtn.classList.toggle("active",!t.useAppleSynth),this.musicBankAppleBtn.classList.toggle("active",t.useAppleSynth),e){this.dslDirty=!1,this.exportWavNeedsResynth=!0,this.syncLiveTrackMetaFromDsl(t.dsl);const s=this.lastReport?.tracks&&this.lastReport.tracks.length>0?this.lastReport.tracks:this.parseMusicTracksFromDsl(t.dsl);this.renderMusicTrackMixer(s),this.applyLiveTrackMixerState(),this.updateHistoryButtonsUI();return}this.dslDirty=!0,this.syncControlsFromDsl(t.dsl),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,this.activeDocType==="music")}undo(){if(this.undoStack.length===0)return;const t=this.captureSnapshot(),e=this.undoStack.pop();this.redoStack.push(t),this.applySnapshot(e)}redo(){if(this.redoStack.length===0)return;const t=this.captureSnapshot(),e=this.redoStack.pop();this.undoStack.push(t),this.applySnapshot(e)}resetChanges(){if(!this.initialSnapshot)return;const t=this.captureSnapshot();this.snapshotsEqual(t,this.initialSnapshot)||(this.recordHistoryBeforeChange(),this.applySnapshot({dsl:this.initialSnapshot.dsl,soloTracks:[...this.initialSnapshot.soloTracks],muteTracks:[...this.initialSnapshot.muteTracks],useAppleSynth:this.initialSnapshot.useAppleSynth}))}scheduleRealtimeSynthesize(t,e){this.realtimeDebounceTimer!==null&&window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=window.setTimeout(()=>{this.realtimeDebounceTimer=null,this.synthesizeAndPlay(t,e)},110)}bindEvents(){this.tabSfxBtn.addEventListener("click",()=>{this.switchDocTypeTab("sfx",!1)}),this.tabMusicBtn.addEventListener("click",()=>{this.switchDocTypeTab("music",!1)});const t=a=>{if(a.key==="ArrowLeft"||a.key==="ArrowRight"||a.key==="Home"||a.key==="End"){a.preventDefault();let i;a.key==="Home"?i="music":a.key==="End"?i="sfx":i=this.activeDocType==="sfx"?"music":"sfx",(i==="sfx"?this.tabSfxBtn:this.tabMusicBtn).focus(),this.switchDocTypeTab(i,!1)}};this.tabSfxBtn.addEventListener("keydown",t),this.tabMusicBtn.addEventListener("keydown",t),this.openFileBtnEl.addEventListener("click",()=>{this.openFileModal()}),this.artifactsBtnEl.addEventListener("click",()=>{this.openArtifactModal()}),this.playBtnEl.addEventListener("click",()=>{if(this.isPlaying)this.stopPlayback();else if(this.decodedBuffer&&!this.dslDirty){const a=this.playOffsetSec>0&&this.playOffsetSec<this.decodedBuffer.duration-.05?this.playOffsetSec:0;this.startBufferPlayback(a).catch(i=>{F.error("Audio Playback Error",i?.message||String(i))})}else this.editorTextarea.value.trim()?this.synthesizeAndPlay(!0,!1):F.info("Open a .music or .sfx file or choose a preset first.")}),this.undoBtnEl.addEventListener("click",()=>this.undo()),this.redoBtnEl.addEventListener("click",()=>this.redo()),this.resetBtnEl.addEventListener("click",()=>this.resetChanges()),window.addEventListener("pointerup",()=>{this.sliderDragSnapshotTaken=!1}),window.addEventListener("pointercancel",()=>{this.sliderDragSnapshotTaken=!1}),window.addEventListener("studio-theme-change",()=>{this.drawVisualizerFrame()}),this.rootEl.addEventListener("keydown",a=>{if(this.rootEl.classList.contains("hidden"))return;const i=a.target;i&&(i.tagName==="TEXTAREA"||i.tagName==="INPUT")&&(i.type==="text"||i.tagName==="TEXTAREA")||((a.metaKey||a.ctrlKey)&&a.key.toLowerCase()==="z"?(a.preventDefault(),a.shiftKey?this.redo():this.undo()):(a.metaKey||a.ctrlKey)&&a.key.toLowerCase()==="y"&&(a.preventDefault(),this.redo()))}),this.loopBtnEl.addEventListener("click",()=>{this.loopEnabled=!this.loopEnabled,this.loopBtnEl.classList.toggle("active",this.loopEnabled),this.loopBtnEl.setAttribute("aria-pressed",String(this.loopEnabled)),this.sourceNode&&(this.sourceNode.loop=this.loopEnabled);for(const a of this.activeStemNodes.values())a.source.loop=this.loopEnabled});const e=a=>{this.useAppleSynth!==a&&(this.recordHistoryBeforeChange(),this.useAppleSynth=a,this.musicBankChipBtn.classList.toggle("active",!a),this.musicBankAppleBtn.classList.toggle("active",a),this.dslDirty=!0,this.updateHistoryButtonsUI(),this.activeDocType==="music"&&this.synthesizeAndPlay(!0,!0))};this.musicBankChipBtn.addEventListener("click",()=>e(!1)),this.musicBankAppleBtn.addEventListener("click",()=>e(!0)),this.modeGuiBtn.addEventListener("click",()=>this.switchEditorMode("gui")),this.modeTextBtn.addEventListener("click",()=>this.switchEditorMode("text")),this.statusPillBtn.addEventListener("click",()=>{this.switchEditorMode(this.editorMode==="gui"?"text":"gui")}),this.vizWaveformBtn.addEventListener("click",()=>{this.visualizerMode="waveform",this.vizWaveformBtn.classList.add("active"),this.vizSpectrumBtn.classList.remove("active"),this.drawVisualizerFrame()}),this.vizSpectrumBtn.addEventListener("click",()=>{this.visualizerMode="spectrum",this.vizSpectrumBtn.classList.add("active"),this.vizWaveformBtn.classList.remove("active"),this.drawVisualizerFrame()}),this.saveBtnEl.addEventListener("click",()=>void this.saveCurrentFile()),this.rootEl.querySelector("#btn-save-raw-dsl")?.addEventListener("click",()=>void this.saveCurrentFile()),this.exportBtnEl.addEventListener("click",()=>void this.exportCurrentWav()),this.rootEl.querySelector("#btn-apply-raw-dsl")?.addEventListener("click",()=>{this.syncControlsFromDsl(this.editorTextarea.value),this.dslDirty=!0,this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,this.activeDocType==="music")}),this.editorTextarea.addEventListener("focus",()=>{this.recordHistoryBeforeChange()}),this.editorTextarea.addEventListener("input",()=>{this.dslDirty=!0,this.updateHistoryButtonsUI()});const s=(a,i,n)=>{a.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),a.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(a.value)),this.updateSfxShaperLabels(),this.updateSfxDslInPlace(i),this.updateHistoryButtonsUI(),this.scheduleRealtimeSynthesize(!0,!1)}),a.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(a.value)),this.updateSfxShaperLabels(),this.updateSfxDslInPlace(i),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!1)})};s(this.sfxStartFreqSlider,"startFreq",a=>{this.sfxState.startFreq=a}),s(this.sfxEndFreqSlider,"endFreq",a=>{this.sfxState.endFreq=a}),s(this.sfxDurSlider,"durationMs",a=>{this.sfxState.durationMs=a}),s(this.sfxBrightSlider,"brightnessHz",a=>{this.sfxState.brightnessHz=a}),s(this.sfxGritSlider,"gritPct",a=>{this.sfxState.gritPct=a}),this.musicBpmSlider.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),this.musicBpmSlider.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0);const a=Number(this.musicBpmSlider.value)||120;this.musicBpmVal.textContent=`${a} BPM`,this.updateMusicBpmInDsl(a),this.updateHistoryButtonsUI(),this.scheduleRealtimeSynthesize(!0,!0)}),this.musicBpmSlider.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null);const a=Number(this.musicBpmSlider.value)||120;this.musicBpmVal.textContent=`${a} BPM`,this.updateMusicBpmInDsl(a),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!0)}),this.scrubSliderEl.addEventListener("input",()=>{if(!this.decodedBuffer)return;const i=Number(this.scrubSliderEl.value)/1e3*this.decodedBuffer.duration;this.playOffsetSec=i,this.updateTimeReadout(i,this.decodedBuffer.duration),this.isPlaying?this.startBufferPlayback(i).catch(n=>{F.error("Audio Playback Error",n?.message||String(n))}):this.drawVisualizerFrame()}),this.canvasEl.addEventListener("click",a=>{if(!this.decodedBuffer){this.editorTextarea.value.trim()&&this.synthesizeAndPlay(!0,!1);return}const i=this.canvasEl.getBoundingClientRect();if(i.width<=0)return;const r=Math.max(0,Math.min(1,(a.clientX-i.left)/i.width))*this.decodedBuffer.duration;this.playOffsetSec=r,this.startBufferPlayback(r).catch(o=>{F.error("Audio Playback Error",o?.message||String(o))})}),this.sendChatBtnEl.addEventListener("click",()=>void this.sendToChat()),this.chatNoteInputEl.addEventListener("keydown",a=>{a.key==="Enter"&&(a.preventDefault(),this.sendToChat())})}static isSupportedSoundFile(t){const e=(t||"").trim().toLowerCase();return e.endsWith(".music")||e.endsWith(".sfx")}async initializeStudio(){this.activeFilePath="",this.activeFileName="",this.editorTextarea.value="",this.dslDirty=!1,this.updateActiveFileLabel(),this.syncModeTabsUI(),this.syncEditorModeUI(),this.resetHistoryBaseline(),this.drawVisualizerFrame(),await Ct(),await this.refreshPresetsCatalog(),await this.refreshDiskSfxFiles();const t=new URLSearchParams(window.location.search),e=(t.get("file")||t.get("path")||t.get("uri")||"").trim();e&&ct.isSupportedSoundFile(e)&&(await this.loadFileFromPath(e,!1),await this.synthesizeAndPlay(!1,!1))}async refreshPresetsCatalog(){try{const t=await P("/api/sound/presets",{method:"GET",cache:"no-store"});if(!t.ok)return;const e=await t.json();Array.isArray(e.sfxPresets)&&e.sfxPresets.length>0&&(this.sfxPresets=e.sfxPresets)}catch{}}saveCurrentModeState(){const t=this.editorTextarea?.value||"";t.trim()&&(this.modeSavedState[this.activeDocType]={filePath:this.activeFilePath,fileName:this.activeFileName,dsl:t,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks),useAppleSynth:this.useAppleSynth,initialSnapshot:this.initialSnapshot?{dsl:this.initialSnapshot.dsl,soloTracks:[...this.initialSnapshot.soloTracks],muteTracks:[...this.initialSnapshot.muteTracks],useAppleSynth:this.initialSnapshot.useAppleSynth}:null,undoStack:this.undoStack.map(e=>({dsl:e.dsl,soloTracks:[...e.soloTracks],muteTracks:[...e.muteTracks],useAppleSynth:e.useAppleSynth})),redoStack:this.redoStack.map(e=>({dsl:e.dsl,soloTracks:[...e.soloTracks],muteTracks:[...e.muteTracks],useAppleSynth:e.useAppleSynth}))})}syncModeTabsUI(){if(!this.tabSfxBtn||!this.tabMusicBtn)return;const t=this.activeDocType==="sfx";this.tabSfxBtn.classList.toggle("active",t),this.tabSfxBtn.setAttribute("aria-selected",String(t)),this.tabSfxBtn.setAttribute("tabindex",t?"0":"-1"),this.tabMusicBtn.classList.toggle("active",!t),this.tabMusicBtn.setAttribute("aria-selected",String(!t)),this.tabMusicBtn.setAttribute("tabindex",t?"-1":"0")}async switchDocTypeTab(t,e=!1){if(this.activeDocType===t)return;this.saveCurrentModeState(),this.stopPlayback();const s=this.modeSavedState[t];if(s){this.soloTracks=new Set(s.soloTracks),this.muteTracks=new Set(s.muteTracks),this.useAppleSynth=s.useAppleSynth,this.musicBankChipBtn.classList.toggle("active",!s.useAppleSynth),this.musicBankAppleBtn.classList.toggle("active",s.useAppleSynth),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(s.dsl,s.fileName,s.filePath,t),this.initialSnapshot=s.initialSnapshot,this.undoStack=s.undoStack,this.redoStack=s.redoStack,this.sliderDragSnapshotTaken=!1,this.updateHistoryButtonsUI(),await this.synthesizeAndPlay(e,!1);return}this.activeDocType=t,this.activeFilePath="",this.activeFileName="",this.editorTextarea.value="",this.decodedBuffer=null,this.dslDirty=!1,this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.updateActiveFileLabel(),this.syncModeTabsUI(),this.syncEditorModeUI(),t==="music"&&(this.trackListEl.innerHTML='<div class="sound-empty-note">Open a .music file via Open File or Open Artifact to inspect and mix tracks.</div>'),this.resetHistoryBaseline(),this.updateTimeReadout(0,0),this.drawVisualizerFrame()}async loadFileFromPath(t,e=!0){if(ct.isSupportedSoundFile(t))try{const s=await P("/api/sound/file/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:t})}),a=await s.json().catch(()=>({}));if(!s.ok)throw new Error(a.error||`Failed to load file "${t}"`);const i=typeof a.content=="string"?a.content:"",n=a.fileName||t.split(/[\\/]/).pop()||"untitled.sfx",r=a.type==="music"||n.endsWith(".music")?"music":"sfx";r!==this.activeDocType&&this.saveCurrentModeState(),this.stopPlayback(),this.synthGenId++,this.isSynthesizing=!1,this.pendingSynthRequest=null,this.lastReport=null,this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(i,n,a.filePath||t,r),this.resetHistoryBaseline(),this.refreshDiskSfxFiles(),e&&await this.synthesizeAndPlay(!0,!1)}catch(s){F.error("Failed to Load Audio File",s?.message||String(s))}}applySfxPreset(t){const e=ke.find(i=>i.id===t);this.recordHistoryBeforeChange();const s=this.sfxPresets.find(i=>i.name===t)||Ut[0];this.sfxState={title:e?e.label:s.name,preset:s.name,wave:Nt(s.wave||"square"),startFreq:Math.round(s.startFreq||440),endFreq:Math.round(s.endFreq||s.startFreq||220),durationMs:Math.round(((s.attack||.01)+(s.decay||.08)+(s.release||.06))*1e3),brightnessHz:s.lpfStart>0?Math.round(s.lpfStart):8e3,gritPct:s.wave==="noise"||s.wave==="psg_noise"?60:0,volume:Number((s.volume||.32).toFixed(2)),pitchCurve:s.pitchCurve||"exp"};const a=[`title "${this.sfxState.title}"`,"type sfx","",`inst cue preset=${s.name} vol=${this.sfxState.volume.toFixed(2)}`,`track main cue: ${this.sfxState.startFreq}Hz->${this.sfxState.endFreq}Hz:${this.sfxState.durationMs}ms`,""].join(`
`);this.editorTextarea.value=a,this.activeFilePath||(this.activeFileName=e?.fileName||`${s.name}.sfx`,this.updateActiveFileLabel()),this.dslDirty=!0,this.syncSfxShaperInputs(),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!1)}setDslContent(t,e,s,a){this.editorTextarea.value=t,this.activeFileName=e,this.activeFilePath=s,this.activeDocType=a,this.dslDirty=!0,this.updateActiveFileLabel(),this.syncModeTabsUI(),this.syncEditorModeUI(),this.syncControlsFromDsl(t)}parseMusicBpmFromDsl(t){const e=t.match(/^\s*(?:tempo|bpm)\s+([^\n#]+)/im);if(!e)return 120;const s=e[1].trim().split(/\s+/);let a=120;for(const i of s){const n=Number(i);if(!Number.isNaN(n)&&n>=20&&n<=300)return Math.round(n);const r=i.toLowerCase();Rt[r]!==void 0&&(a=Rt[r])}return a}parseMusicTracksFromDsl(t){const e=new Map,s=[],a=new Map,i=t.split(`
`);for(const n of i){const r=n.replace(/#.*$/,"").trim();if(!r)continue;const o=r.match(/^(?:inst|patch)\s+([^\s]+)(?:\s+(.*))?$/i);if(o){const h=o[1],l=o[2]||"",u=l.match(/\bwave=([^\s]+)/i),m=l.match(/\bgm=([^\s]+)/i),f=l.match(/\bpreset=([^\s]+)/i),p=l.match(/\b(?:vol|volume)=([0-9.]+)/i),x=l.match(/\bpan=([-+0-9.]+)/i),S=u?u[1]:m?m[1]:f?f[1]:Q.has(h.toLowerCase())?h.toLowerCase():"ym2612_brass",E=K[S.toLowerCase()]||K[ft(S)],v=p?Number(p[1]):E?.volume??.2,g=x?Number(x[1]):E?.pan??0;e.set(h,{waveType:S,volume:v,pan:g});continue}const d=r.match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);if(d){const h=d[1],l=d[2]||"",u=d[3]||"",m=/drum|perc|toms/i.test(h)||Q.has(l.toLowerCase()),f=l||(m?"kick":h),p=e.get(f),x=p?.waveType||(m?"kick":"ym2612_brass"),S=K[x.toLowerCase()]||K[ft(x)],E=p?.volume??S?.volume??.2,v=p?.pan??S?.pan??0,g=u.trim().split(/\s+/).filter(Boolean);let b=0;for(const w of g)w==="|"||w==="-"||/^r(?::.*)?$/i.test(w)||b++;const y=a.get(h);y?(y.eventCount+=b,!y.defaultInst&&f&&(y.defaultInst=f),p&&(y.waveType=p.waveType,y.volume=p.volume,y.pan=p.pan)):(s.push(h),a.set(h,{name:h,defaultInst:f,waveType:x,volume:E,pan:v,eventCount:Math.max(1,b)}))}}return s.map(n=>a.get(n))}syncControlsFromDsl(t){if(this.activeDocType==="sfx"){const e=t.match(/^\s*title\s+"?([^"\n]+)"?/im),s=t.split(`
`),a=[],i=[];for(const g of s){const b=g.replace(/#.*$/,"").trim();if(!b)continue;const y=b.match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);if(y){a.push({name:y[1],attrs:y[2]});continue}const w=b.match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);w&&i.push({name:w[1],defaultInst:w[2]||"",body:w[3]})}const n=a.find(g=>/\bpreset=/i.test(g.attrs))||a[a.length-1]||{name:"cue",attrs:""},r=i.find(g=>g.defaultInst===n.name)||i[i.length-1]||{defaultInst:n.name,body:""},o=n.attrs.match(/\bpreset=([a-zA-Z0-9_]+)/i),d=o?o[1]:"",h=this.sfxPresets.find(g=>g.name===d),l=n.attrs.match(/\bwave=([a-zA-Z0-9_]+)/i),u=l?l[1]:h?.wave||"square";this.sfxState.title=e?e[1].trim():"Custom Sound",this.sfxState.preset=d,this.sfxState.wave=Nt(u);const m=n.attrs.match(/\b(?:vol|volume)=([0-9.]+)/i);this.sfxState.volume=Number(m?m[1]:(h?.volume||.32).toFixed(2));const f=Array.from(r.body.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi));if(f.length>0){const g=f.reduce((b,y)=>b+Number(y[1]),0);this.sfxState.durationMs=Math.round(Math.max(30,Math.min(1e3,g)))}else h&&(this.sfxState.durationMs=Math.round(((h.attack||.01)+(h.decay||.08)+(h.release||.06))*1e3));const p=r.body.match(/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i)||n.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i),x=r.body.match(/(\d+(?:\.\d+)?)Hz\b/i)||n.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz\b/i);if(p)this.sfxState.startFreq=Math.round(Number(p[1])),this.sfxState.endFreq=Math.round(Number(p[2]));else if(x)this.sfxState.startFreq=Math.round(Number(x[1])),this.sfxState.endFreq=Math.round(Number(x[1]));else{const g=Array.from(r.body.matchAll(/\b([A-Ga-g][#b]?\d+)(?::\d+(?:\.\d+)?ms)?\b/g));if(g.length>0){const b=_t(g[0][1])||h?.startFreq||440,y=_t(g[g.length-1][1])||h?.endFreq||b;this.sfxState.startFreq=b,this.sfxState.endFreq=y}else h&&(this.sfxState.startFreq=Math.round(h.startFreq||440),this.sfxState.endFreq=Math.round(h.endFreq||h.startFreq||220))}const S=n.attrs.match(/\blpf=(\d+(?:\.\d+)?)/i)||n.attrs.match(/\bcutoff=(\d+(?:\.\d+)?)/i);if(S){const g=Number(S[1]);this.sfxState.brightnessHz=g<=1?Math.round(200+g*7800):Math.round(g)}else h&&h.lpfStart>0?this.sfxState.brightnessHz=Math.round(h.lpfStart):this.sfxState.brightnessHz=8e3;const E=n.attrs.match(/\bnoise_blend=(\d+(?:\.\d+)?)/i),v=n.attrs.match(/\bnoise=\d+(?:\.\d+)?,(\d+(?:\.\d+)?)/i);E?this.sfxState.gritPct=Math.round(Number(E[1])*100):v?this.sfxState.gritPct=Math.round(Number(v[1])*100):this.sfxState.wave==="psg_noise"?this.sfxState.gritPct=60:this.sfxState.gritPct=0,this.syncSfxShaperInputs()}else{const e=this.parseMusicBpmFromDsl(t);this.musicBpmSlider.value=String(Math.max(40,Math.min(220,e))),this.musicBpmVal.textContent=`${e} BPM`,/^\s*(?:synth|engine)\s+(?:apple|coreaudio)\b/im.test(t)?this.useAppleSynth=!0:/^\s*(?:synth|engine)\s+(?:default|ym2612|chip|chiptune)\b/im.test(t)&&(this.useAppleSynth=!1),this.musicBankChipBtn&&this.musicBankAppleBtn&&(this.musicBankChipBtn.classList.toggle("active",!this.useAppleSynth),this.musicBankAppleBtn.classList.toggle("active",this.useAppleSynth));const s=this.parseMusicTracksFromDsl(t);this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear();for(const a of s){const i=typeof a.volume=="number"&&a.volume>0?a.volume:.2,n=typeof a.pan=="number"?a.pan:0;this.trackStemBaseMeta.set(a.name,{volume:i,pan:n}),this.trackLiveMeta.set(a.name,{volume:i,pan:n})}this.renderMusicTrackMixer(s)}}syncSfxShaperInputs(){this.sfxStartFreqSlider.value=String(Math.max(40,Math.min(2e3,this.sfxState.startFreq))),this.sfxEndFreqSlider.value=String(Math.max(20,Math.min(2e3,this.sfxState.endFreq))),this.sfxDurSlider.value=String(Math.max(30,Math.min(1e3,this.sfxState.durationMs))),this.sfxBrightSlider.value=String(Math.max(200,Math.min(8e3,this.sfxState.brightnessHz))),this.sfxGritSlider.value=String(Math.max(0,Math.min(90,this.sfxState.gritPct))),this.updateSfxShaperLabels(),this.renderSfxPresetChips(),this.renderSfxToneButtons()}updateSfxShaperLabels(){this.sfxStartFreqVal.textContent=`${this.sfxState.startFreq} Hz`,this.sfxEndFreqVal.textContent=`${this.sfxState.endFreq} Hz`,this.sfxDurVal.textContent=`${this.sfxState.durationMs} ms`,this.sfxBrightVal.textContent=this.sfxState.brightnessHz>=7800?"Open":`${this.sfxState.brightnessHz} Hz`,this.sfxGritVal.textContent=`${this.sfxState.gritPct}%`}updateSfxDslInPlace(t){const e=this.sfxState,s=this.editorTextarea.value.split(`
`);let a=-1,i="";for(let o=0;o<s.length;o++){const h=s[o].replace(/#.*$/,"").trim().match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);h&&(a===-1||/\bpreset=/i.test(h[2]))&&(a=o,i=h[1])}if(a===-1){const o=["inst cue"];if(e.preset&&o.push(`preset=${e.preset}`),o.push(`wave=${e.wave}`),e.brightnessHz<7800){const d=Math.max(120,Math.round(e.brightnessHz*.25));o.push(`lpf=${e.brightnessHz}->${d}`)}e.gritPct>0&&e.wave!=="psg_noise"&&e.wave!=="noise"&&o.push(`noise_blend=${(e.gritPct/100).toFixed(2)}`),o.push(`vol=${e.volume.toFixed(2)}`),this.editorTextarea.value=[`title "${e.title}"`,"type sfx","",o.join(" "),`track main cue: ${e.startFreq}Hz->${e.endFreq}Hz:${e.durationMs}ms`,""].join(`
`),this.dslDirty=!0;return}let n=s[a].replace(/\bnoise=\d+(?:\.\d+)?(?!\s*,)/g,"").trim();if(t==="wave")/\bwave=[^\s]+/i.test(n)?n=n.replace(/\bwave=[^\s]+/i,`wave=${e.wave}`):n=`${n} wave=${e.wave}`;else if(t==="brightnessHz"){const o=Math.max(120,Math.round(e.brightnessHz*.25));e.brightnessHz>=7800?n=n.replace(/\s*\b(?:lpf|cutoff)=[^\s]+/gi,""):/\b(?:lpf|cutoff)=[^\s]+/i.test(n)?n=n.replace(/\b(?:lpf|cutoff)=[^\s]+/i,`lpf=${e.brightnessHz}->${o}`):n=`${n} lpf=${e.brightnessHz}->${o}`}else t==="gritPct"&&(n=n.replace(/\s*\bnoise_blend=[^\s]+/gi,""),e.gritPct>0&&(n=`${n} noise_blend=${(e.gritPct/100).toFixed(2)}`));s[a]=n.replace(/\s+/g," ").trim();let r=-1;for(let o=0;o<s.length;o++){const h=s[o].replace(/#.*$/,"").trim().match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);h&&(r===-1||h[2]===i)&&(r=o)}if(r!==-1){if(t==="durationMs"){const o=s[r],h=Array.from(o.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi)).reduce((u,m)=>u+Number(m[1]),0),l=h>0?e.durationMs/h:1;for(let u=0;u<s.length;u++)/^\s*track\s+/i.test(s[u])&&(s[u]=s[u].replace(/:(\d+(?:\.\d+)?)ms\b/gi,(m,f)=>`:${Math.max(10,Math.round(Number(f)*l))}ms`))}else if(t==="startFreq"||t==="endFreq"){const o=s[r];/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i.test(o)?s[r]=o.replace(/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/gi,`${e.startFreq}Hz->${e.endFreq}Hz`):s[r]=o.replace(/^(\s*track\s+[^\s:]+(?:\s+[^\s:]+)?\s*:\s*).*$/i,`$1${e.startFreq}Hz->${e.endFreq}Hz:${e.durationMs}ms`)}}this.editorTextarea.value=s.join(`
`),this.dslDirty=!0}updateMusicBpmInDsl(t){let e=this.editorTextarea.value;/^\s*tempo\s+/im.test(e)?e=e.replace(/^(\s*tempo\s+(?:[a-zA-Z_]+)?)(?:\s+\d+(?:\.\d+)?)?\s*$/im,(s,a)=>`${a.trimEnd()} ${t}`):/^\s*bpm\s+/im.test(e)?e=e.replace(/^(\s*bpm\s+)(\d+(?:\.\d+)?)/im,`$1${t}`):e=`bpm ${t}
`+e,this.editorTextarea.value=e,this.dslDirty=!0}updateMusicInstProperty(t,e,s){const a=this.editorTextarea.value.split(`
`),i=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),n=new RegExp(`^(\\s*(?:inst|patch)\\s+${i}\\b.*)$`);let r=!1;for(let o=0;o<a.length;o++)if(n.test(a[o])){a[o]=s(a[o]),r=!0;break}if(!r){const o=Q.has(e)?e:"ym2612_brass",d=s(`inst ${t} wave=${o}`);let h=a.findIndex(l=>/^\s*(?:pattern|track)\b/i.test(l));h===-1&&(h=a.length),a.splice(h,0,d)}this.editorTextarea.value=a.join(`
`),this.dslDirty=!0}async synthesizeAndPlay(t=!0,e=!1){if(this.isSynthesizing){this.pendingSynthRequest={autoPlay:t||!!this.pendingSynthRequest?.autoPlay,preservePlayhead:e||!!this.pendingSynthRequest?.preservePlayhead};return}const s=this.editorTextarea.value.trim();if(!s)return;const a=++this.synthGenId;this.isSynthesizing=!0,this.playBtnEl.disabled=!0,this.isPlaying||(this.playBtnEl.textContent="...");try{const i=await P("/api/sound/synthesize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dsl:s,type:this.activeDocType,apple:this.activeDocType==="music"?this.useAppleSynth:!1,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks)})}),n=await i.json().catch(()=>({}));if(a!==this.synthGenId)return;if(n.report&&(this.lastReport=n.report,this.renderDiagnosticsAndStatus(n.report),this.activeDocType==="music")){if(typeof n.report.bpm=="number"&&n.report.bpm>0&&document.activeElement!==this.musicBpmSlider){const p=Math.round(n.report.bpm);this.musicBpmSlider.value=String(Math.max(40,Math.min(220,p))),this.musicBpmVal.textContent=`${p} BPM`}const f=n.report.tracks&&n.report.tracks.length>0?n.report.tracks:this.parseMusicTracksFromDsl(this.editorTextarea.value);this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear();for(const p of f){const x=typeof p.volume=="number"&&p.volume>0?p.volume:.2,S=typeof p.pan=="number"?p.pan:0;this.trackStemBaseMeta.set(p.name,{volume:x,pan:S}),this.trackLiveMeta.set(p.name,{volume:x,pan:S})}this.syncLiveTrackMetaFromDsl(this.editorTextarea.value),this.lastSynthesizedNonMixerDsl=this.stripMixerPropsFromDsl(s),this.exportWavNeedsResynth=!1,this.renderMusicTrackMixer(f)}if(!i.ok||!n.buildId){const f=n.report?.error||n.error||n.report?.issues&&n.report.issues[0]||`Synthesis failed (HTTP ${i.status})`;this.statusPillBtn.textContent="Check Code",this.statusPillBtn.className="sound-status-pill fail",F.error("Synthesis Issue",f);return}this.lastBuildId=n.buildId,this.dslDirty=!1;const r=this.ensureAudioContext();let o=null;if(this.activeDocType==="music"&&n.hasStems){const f=await P(`/api/sound/stems?buildId=${encodeURIComponent(n.buildId)}`,{method:"GET",cache:"no-store"});if(a!==this.synthGenId)return;if(f.ok){const p=await f.arrayBuffer();if(a!==this.synthGenId)return;o=this.decodeStemsBinary(p,r)}}if(!o){this.trackStemBuffers.clear(),this.trackStemPeaks.clear();const f=await P(`/api/sound/wav?buildId=${encodeURIComponent(n.buildId)}`,{method:"GET",cache:"no-store"});if(a!==this.synthGenId)return;if(!f.ok)throw new Error(`Failed to fetch audio stream (HTTP ${f.status})`);const p=await f.arrayBuffer();if(a!==this.synthGenId||(o=await r.decodeAudioData(p.slice(0)),a!==this.synthGenId))return}const d=this.decodedBuffer?.duration||0,h=this.getCurrentPlayheadSec(),l=d>0?Math.max(0,Math.min(1,h/d)):0,u=this.isPlaying;this.decodedBuffer=o;let m=0;e&&this.activeDocType==="music"&&o.duration>0&&(d>0&&Math.abs(o.duration-d)>.05?m=l*o.duration:m=Math.min(h,Math.max(0,o.duration-.05)),m>=o.duration-.05&&(m=0)),this.playOffsetSec=m,this.updateTimeReadout(m,o.duration),t||e&&u?await this.startBufferPlayback(m):this.drawVisualizerFrame()}catch(i){if(a!==this.synthGenId)return;F.error("Audio Synthesis Error",i?.message||String(i))}finally{if(a===this.synthGenId&&(this.isSynthesizing=!1,this.playBtnEl.disabled=!1,this.playBtnEl.textContent=this.isPlaying?"Stop":"Play",this.pendingSynthRequest)){const i=this.pendingSynthRequest;this.pendingSynthRequest=null,this.synthesizeAndPlay(i.autoPlay,i.preservePlayhead)}}}decodeStemsBinary(t,e){const s=new DataView(t);if(t.byteLength<12||String.fromCharCode(s.getUint8(0),s.getUint8(1),s.getUint8(2),s.getUint8(3))!=="STEM")return null;const i=s.getUint32(4,!0)||44100,n=s.getUint32(8,!0),r=new TextDecoder("utf-8");this.trackStemBuffers.clear(),this.trackStemPeaks.clear();const o=900;let d=12,h=null;for(let l=0;l<n&&!(d+2>t.byteLength);l++){const u=s.getUint16(d,!0);if(d+=2,d+u+4>t.byteLength)break;const m=r.decode(new Uint8Array(t,d,u));d+=u;const f=s.getUint32(d,!0);if(d+=4,d+f>t.byteLength)break;const p=Math.floor(f/4);if(p>0){const x=e.createBuffer(2,p,i),S=x.getChannelData(0),E=x.getChannelData(1);let v=d;for(let y=0;y<p;y++)S[y]=s.getInt16(v,!0)/32768,E[y]=s.getInt16(v+2,!0)/32768,v+=4;this.trackStemBuffers.set(m,x);const g=new Float32Array(o),b=Math.max(1,Math.floor(p/o));for(let y=0;y<o;y++){const w=y*b;let B=0;for(let M=0;M<b&&w+M<p;M+=4){const C=Math.max(Math.abs(S[w+M]),Math.abs(E[w+M]));C>B&&(B=C)}g[y]=B}this.trackStemPeaks.set(m,g),(!h||x.duration>h.duration)&&(h=x)}d+=f}return h}computeTrackMixerNodesState(t){if(!((this.soloTracks.size===0||this.soloTracks.has(t))&&!this.muteTracks.has(t)))return{gain:0,pan:0,monoDownmix:!1,peakScale:0};const s=this.trackStemBaseMeta.get(t)||{volume:.2,pan:0},a=this.trackLiveMeta.get(t)||s,i=Math.max(.005,s.volume||.2),n=Math.max(0,a.volume/i),r=Math.max(-1,Math.min(1,s.pan||0)),o=Math.max(-1,Math.min(1,a.pan||0));if(!(Math.abs(o-r)>.005))return{gain:n,pan:0,monoDownmix:!1,peakScale:n};const h=(r+1)*Math.PI/4,l=(Math.cos(h)+Math.sin(h))*.5,u=l>.05?1/l:1;return{gain:n*u,pan:o,monoDownmix:!0,peakScale:n}}syncMixerButtonsDOM(){this.trackListEl&&this.trackListEl.querySelectorAll(".sound-ms-btn").forEach(t=>{const e=t,s=e.getAttribute("data-track")||"",a=e.getAttribute("data-action");a==="mute"?e.classList.toggle("active",this.muteTracks.has(s)):a==="solo"&&e.classList.toggle("active",this.soloTracks.has(s))})}applyLiveTrackMixerState(){const t=this.audioCtx?this.audioCtx.currentTime:0;for(const[e,s]of this.activeStemNodes.entries()){const a=this.computeTrackMixerNodesState(e),i=a.monoDownmix?1:2,n=a.monoDownmix?"explicit":"clamped-max";s.pan.channelCount!==i&&(s.pan.channelCount=i,s.pan.channelCountMode=n),this.audioCtx?(s.gain.gain.cancelScheduledValues(t),s.gain.gain.setValueAtTime(s.gain.gain.value,t),s.gain.gain.setTargetAtTime(a.gain,t,.003),a.gain===0&&s.gain.gain.setValueAtTime(0,t+.015),s.pan.pan.cancelScheduledValues(t),s.pan.pan.setValueAtTime(s.pan.pan.value,t),s.pan.pan.setTargetAtTime(a.pan,t,.003)):(s.gain.gain.value=a.gain,s.pan.pan.value=a.pan)}this.drawVisualizerFrame()}renderMusicTrackMixer(t){if(t.length===0){this.trackListEl.innerHTML='<div class="sound-empty-note">No tracks found in song.</div>';return}for(const a of t)a.eventCount>0&&a.waveType&&this.trackMetaCache.set(a.name,{waveType:a.waveType,volume:a.volume,pan:a.pan});const e=document.activeElement;if(e&&this.trackListEl.contains(e)&&e.tagName==="INPUT"&&this.sliderDragSnapshotTaken)return;const s=this.editorTextarea.value;this.trackListEl.innerHTML=t.map(a=>{const i=this.muteTracks.has(a.name),n=this.soloTracks.has(a.name),r=this.trackMetaCache.get(a.name),o=/drum|perc|toms/i.test(a.name)||Q.has((a.waveType||"").toLowerCase())||Q.has((r?.waveType||"").toLowerCase()),d=a.defaultInst||(o?"kick":a.name),h=d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),l=s.match(new RegExp(`^\\s*(?:inst|patch)\\s+${h}\\b(.*)$`,"m")),u=l?l[1]:"",m=u.match(/\bwave=([^\s]+)/i),f=u.match(/\bgm=([^\s]+)/i),p=u.match(/\bpreset=([^\s]+)/i),x=u.match(/\b(?:vol|volume)=([0-9.]+)/i),S=u.match(/\bpan=([-+0-9.]+)/i),E=m?m[1]:f?f[1]:p?p[1]:a.eventCount>0&&a.waveType?a.waveType:r?.waveType||a.waveType||"ym2612_brass",v=ft(E),g=K[E.toLowerCase()]||K[v],b=x?Number(x[1]):a.eventCount>0&&a.volume>0?a.volume:g?.volume??r?.volume??a.volume??.2,y=S?Number(S[1]):a.eventCount>0&&typeof a.pan=="number"&&a.pan!==0?a.pan:g?.pan??r?.pan??a.pan??0,w=Math.round(Math.max(1,Math.min(100,b*100))),B=Math.round(Math.max(-100,Math.min(100,y*100))),M=o?'<option value="kick" selected>Drum Kit</option>':qt.map(C=>{const k=v===C.id?"selected":"";return`<option value="${C.id}" ${k}>${C.label}</option>`}).join("");return`
          <div class="sound-mixer-row" data-track="${this.escapeHtml(a.name)}" data-inst="${this.escapeHtml(d)}" data-wave="${this.escapeHtml(E)}">
            <div class="sound-mixer-left">
              <button
                type="button"
                class="sound-ms-btn mute ${i?"active":""}"
                data-action="mute"
                data-track="${this.escapeHtml(a.name)}"
                title="Mute ${this.escapeHtml(a.name)}"
              >M</button>
              <button
                type="button"
                class="sound-ms-btn solo ${n?"active":""}"
                data-action="solo"
                data-track="${this.escapeHtml(a.name)}"
                title="Solo ${this.escapeHtml(a.name)}"
              >S</button>
              <span class="sound-track-title">${this.escapeHtml(a.name)}</span>
            </div>

            <select
              class="sound-inst-select"
              data-track="${this.escapeHtml(a.name)}"
              data-inst="${this.escapeHtml(d)}"
              data-wave="${this.escapeHtml(E)}"
              aria-label="Instrument for ${this.escapeHtml(a.name)}"
              ${o?"disabled":""}
            >
              ${M}
            </select>

            <label class="sound-mini-slider" title="Track Volume (${w}%)">
              <span>Vol</span>
              <input
                type="range"
                class="track-vol-slider"
                data-track="${this.escapeHtml(a.name)}"
                data-inst="${this.escapeHtml(d)}"
                data-wave="${this.escapeHtml(E)}"
                min="1"
                max="100"
                step="1"
                value="${w}"
              />
            </label>

            <label class="sound-mini-slider" title="Stereo Pan (${B})">
              <span>Pan</span>
              <input
                type="range"
                class="track-pan-slider"
                data-track="${this.escapeHtml(a.name)}"
                data-inst="${this.escapeHtml(d)}"
                data-wave="${this.escapeHtml(E)}"
                min="-100"
                max="100"
                step="1"
                value="${B}"
              />
            </label>
          </div>
        `}).join(""),this.trackListEl.querySelectorAll(".sound-ms-btn").forEach(a=>{a.addEventListener("click",()=>{const i=a,n=i.getAttribute("data-track")||"",r=i.getAttribute("data-action");n&&(this.recordHistoryBeforeChange(),r==="mute"?this.muteTracks.has(n)?this.muteTracks.delete(n):(this.muteTracks.add(n),this.soloTracks.delete(n)):r==="solo"&&(this.soloTracks.has(n)?this.soloTracks.delete(n):(this.soloTracks.add(n),this.muteTracks.delete(n))),this.syncMixerButtonsDOM(),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?(this.exportWavNeedsResynth=!0,this.applyLiveTrackMixerState()):this.synthesizeAndPlay(!0,!0))})}),this.trackListEl.querySelectorAll(".sound-inst-select").forEach(a=>{a.addEventListener("change",()=>{const i=a,n=i.getAttribute("data-track")||"",r=i.getAttribute("data-inst")||"",o=i.getAttribute("data-wave")||"ym2612_brass",d=i.value,h=qt.find(u=>u.id===d);if(!r||!h)return;this.recordHistoryBeforeChange(),this.updateMusicInstProperty(r,o,u=>`${u.replace(/\b(wave|wave_type|preset|gm|duty)=[^\s]+/gi,"").replace(/\s+/g," ").trim()} ${h.dslWave}`);const l=this.trackMetaCache.get(n);l&&(l.waveType=h.id),this.updateHistoryButtonsUI(),this.synthesizeAndPlay(!0,!0)})}),this.trackListEl.querySelectorAll(".track-vol-slider").forEach(a=>{const i=a,n=r=>{const o=i.getAttribute("data-track")||"",d=i.getAttribute("data-inst")||"",h=i.getAttribute("data-wave")||"ym2612_brass";if(!d)return;const l=Number((r/100).toFixed(2)),u=l.toFixed(2);this.updateMusicInstProperty(d,h,p=>/\b(?:vol|volume)=[^\s]+/i.test(p)?p.replace(/\b(?:vol|volume)=[^\s]+/i,`vol=${u}`):`${p} vol=${u}`);const m=this.trackMetaCache.get(o);m&&(m.volume=l);const f=this.trackLiveMeta.get(o)||this.trackStemBaseMeta.get(o)||{pan:0};this.trackLiveMeta.set(o,{volume:l,pan:f.pan}),i.parentElement&&(i.parentElement.title=`Track Volume (${Math.round(r)}%)`),this.trackStemBuffers.size>0&&(this.dslDirty=!1,this.exportWavNeedsResynth=!0)};i.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),i.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.scheduleRealtimeSynthesize(!0,!0)}),i.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.synthesizeAndPlay(!0,!0)})}),this.trackListEl.querySelectorAll(".track-pan-slider").forEach(a=>{const i=a,n=r=>{const o=i.getAttribute("data-track")||"",d=i.getAttribute("data-inst")||"",h=i.getAttribute("data-wave")||"ym2612_brass";if(!d)return;const l=Number((r/100).toFixed(2)),u=l.toFixed(2);this.updateMusicInstProperty(d,h,p=>/\bpan=[^\s]+/i.test(p)?p.replace(/\bpan=[^\s]+/i,`pan=${u}`):`${p} pan=${u}`);const m=this.trackMetaCache.get(o);m&&(m.pan=l);const f=this.trackLiveMeta.get(o)||this.trackStemBaseMeta.get(o)||{volume:.2};this.trackLiveMeta.set(o,{volume:f.volume,pan:l}),i.parentElement&&(i.parentElement.title=`Stereo Pan (${Math.round(r)})`),this.trackStemBuffers.size>0&&(this.dslDirty=!1,this.exportWavNeedsResynth=!0)};i.addEventListener("pointerdown",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0)}),i.addEventListener("input",()=>{this.sliderDragSnapshotTaken||(this.recordHistoryBeforeChange(),this.sliderDragSnapshotTaken=!0),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.scheduleRealtimeSynthesize(!0,!0)}),i.addEventListener("change",()=>{this.sliderDragSnapshotTaken=!1,this.realtimeDebounceTimer!==null&&(window.clearTimeout(this.realtimeDebounceTimer),this.realtimeDebounceTimer=null),n(Number(i.value)),this.updateHistoryButtonsUI(),this.trackStemBuffers.size>0?this.applyLiveTrackMixerState():this.synthesizeAndPlay(!0,!0)})})}renderDiagnosticsAndStatus(t){const e=!!t.passed,s=typeof t.peakLeftDBFS=="number"?t.peakLeftDBFS.toFixed(1):"0.0";this.statusPillBtn.className=`sound-status-pill ${e?"pass":"fail"}`,this.statusPillBtn.textContent=e?`✓ Clean · ${s} dB`:`⚠ ${t.issues?.length||1} issue${(t.issues?.length||1)>1?"s":""}`;const a=typeof t.rmsDBFS=="number"?`${t.rmsDBFS.toFixed(1)} dB`:"-",i=typeof t.dcOffset=="number"?t.dcOffset.toFixed(4):"0.0000",n=this.activeDocType==="music"?`Low-Freq Energy: ${(t.lowFreqEnergyPct??0).toFixed(1)}%`:`Boundaries: ${t.boundaryClean!==!1?"Zero-click":"Click risk"}`,r=t.issues&&t.issues.length>0?`<ul class="sound-issues-list">${t.issues.map(o=>`<li>${this.escapeHtml(o)}</li>`).join("")}</ul>`:'<p class="sound-pass-note">Passes all headroom and anti-click checks.</p>';this.diagnosticsContainerEl.innerHTML=`
      <div class="sound-diag-summary">
        <span>Peak: <strong>${s} dBFS</strong></span>
        <span>RMS: <strong>${a}</strong></span>
        <span>DC: <strong>${i}</strong></span>
        <span>${n}</span>
      </div>
      ${r}
    `}ensureAudioContext(){if(!this.audioCtx){const t=window.AudioContext||window.webkitAudioContext;this.audioCtx=new t,this.analyser=this.audioCtx.createAnalyser(),this.analyser.fftSize=2048,this.analyser.smoothingTimeConstant=.78,this.analyser.connect(this.audioCtx.destination);const e=this.audioCtx.createWaveShaper(),s=65537,a=new Float32Array(s),i=28e3/32768,n=4767/32768;for(let r=0;r<s;r++){const o=r*2/(s-1)-1,d=Math.abs(o);if(d<=i)a[r]=o;else{const h=(d-i)/n,l=i+n*Math.tanh(h);a[r]=o<0?-l:l}}e.curve=a,e.oversample="none",e.connect(this.analyser),this.masterLimiterNode=e}return this.audioCtx.state==="suspended"&&this.audioCtx.resume().catch(()=>{}),this.audioCtx}async startBufferPlayback(t=0){if(!this.decodedBuffer)return;const e=this.ensureAudioContext();e.state==="suspended"&&await e.resume(),this.stopSourceNodeOnly();const s=Math.max(0,Math.min(t,Math.max(0,this.decodedBuffer.duration-.005)));if(this.playOffsetSec=s,this.playStartCtxTime=e.currentTime,this.isPlaying=!0,this.playBtnEl.textContent="Stop",this.activeDocType==="music"&&this.trackStemBuffers.size>0){const i=e.currentTime,n=this.masterLimiterNode||this.analyser;let r=null;for(const[o,d]of this.trackStemBuffers.entries()){const h=e.createBufferSource();h.buffer=d,h.loop=this.loopEnabled;const l=e.createGain(),u=e.createStereoPanner(),m=this.computeTrackMixerNodesState(o);l.gain.value=m.gain,u.channelCount=m.monoDownmix?1:2,u.channelCountMode=m.monoDownmix?"explicit":"clamped-max",u.pan.value=m.pan,h.connect(l),l.connect(u),u.connect(n),this.activeStemNodes.set(o,{source:h,gain:l,pan:u}),(!r||d.duration>=(r.buffer?.duration||0))&&(r=h)}r&&(this.sourceNode=r,r.onended=()=>{this.sourceNode===r&&!this.loopEnabled&&(this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl.textContent="Play",this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame())});for(const o of this.activeStemNodes.values()){const d=Math.min(s,Math.max(0,(o.source.buffer?.duration||0)-.005));o.source.start(i,d)}this.startVisualizerLoop();return}const a=e.createBufferSource();a.buffer=this.decodedBuffer,a.loop=this.loopEnabled,a.connect(this.analyser),this.sourceNode=a,a.onended=()=>{this.sourceNode===a&&!this.loopEnabled&&(this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl.textContent="Play",this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame())},a.start(0,s),this.startVisualizerLoop()}stopSourceNodeOnly(){if(this.sourceNode){try{this.sourceNode.onended=null,this.sourceNode.stop(),this.sourceNode.disconnect()}catch{}this.sourceNode=null}if(this.activeStemNodes.size>0){for(const t of this.activeStemNodes.values()){try{t.source.onended=null,t.source.stop()}catch{}try{t.source.disconnect(),t.gain.disconnect(),t.pan.disconnect()}catch{}}this.activeStemNodes.clear()}}stopPlayback(){this.stopSourceNodeOnly(),this.isPlaying=!1,this.playOffsetSec=0,this.playBtnEl&&(this.playBtnEl.textContent="Play"),this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.decodedBuffer&&this.updateTimeReadout(0,this.decodedBuffer.duration),this.drawVisualizerFrame()}getCurrentPlayheadSec(){if(!this.decodedBuffer)return 0;if(!this.isPlaying||!this.audioCtx)return this.playOffsetSec;const t=this.audioCtx.currentTime-this.playStartCtxTime+this.playOffsetSec,e=this.decodedBuffer.duration||1;return this.loopEnabled?t%e:Math.min(e,t)}startVisualizerLoop(){this.rafId!==null&&cancelAnimationFrame(this.rafId);const t=()=>{if(this.decodedBuffer){const e=this.getCurrentPlayheadSec();this.updateTimeReadout(e,this.decodedBuffer.duration)}this.drawVisualizerFrame(),this.isPlaying&&(this.rafId=requestAnimationFrame(t))};this.rafId=requestAnimationFrame(t)}updateTimeReadout(t,e){if(this.timeReadoutEl.textContent=`${t.toFixed(2)}s / ${e.toFixed(2)}s`,e>0){const s=Math.max(0,Math.min(1,t/e));this.scrubSliderEl.value=String(Math.round(s*1e3))}else this.scrubSliderEl.value="0"}getVisualizerThemePalette(){const t=typeof window<"u"&&typeof getComputedStyle=="function"?getComputedStyle(this.rootEl):null,e=t?.getPropertyValue("--studio-surface").trim()||"",s=t?.getPropertyValue("--studio-bg").trim()||"",i=typeof document<"u"&&document.documentElement?.classList.contains("light")||/^#(f|e|d)/i.test(e)||/^#(f|e|d)/i.test(s);return{isLight:i,surfaceBg:e||(i?"#FFFFFF":"#121824"),gridLine:i?"rgba(100, 116, 139, 0.22)":"rgba(148, 163, 184, 0.14)",waveFill:i?"rgba(79, 70, 229, 0.28)":"rgba(99, 102, 241, 0.32)",waveStroke:i?"rgba(79, 70, 229, 0.85)":"rgba(129, 140, 248, 0.9)",liveTrace:i?"#0284c7":"#38bdf8",playhead:i?"#d97706":"#f59e0b",bassZoneFill:i?"rgba(5, 150, 105, 0.08)":"rgba(16, 185, 129, 0.08)",bassBar:i?"#059669":"#10b981",highBar:i?"#4f46e5":"#6366f1"}}drawVisualizerFrame(){const t=this.canvasEl;if(!t)return;const e=t.getContext("2d");if(!e)return;const s=t.width,a=t.height,i=this.getVisualizerThemePalette();e.clearRect(0,0,s,a),e.fillStyle=i.surfaceBg,e.fillRect(0,0,s,a),this.visualizerMode==="spectrum"?this.drawSpectrumView(e,s,a,i):this.drawWaveformView(e,s,a,i)}drawWaveformView(t,e,s,a=this.getVisualizerThemePalette()){const i=s/2;if(t.strokeStyle=a.gridLine,t.lineWidth=1,t.beginPath(),t.moveTo(0,i),t.lineTo(e,i),t.stroke(),this.activeDocType==="music"&&this.trackStemPeaks.size>0){t.fillStyle=a.waveFill;const n=[];for(const[d,h]of this.trackStemPeaks.entries()){const l=this.computeTrackMixerNodesState(d);l.peakScale>0&&n.push({peaks:h,scale:l.peakScale})}const r=28e3/32768,o=4767/32768;for(let d=0;d<e;d++){let h=0;for(let u=0;u<n.length;u++){const m=n[u],f=Math.min(m.peaks.length-1,Math.floor(d/e*m.peaks.length));h+=m.peaks[f]*m.scale}h>r&&(h=r+o*Math.tanh((h-r)/o));const l=Math.min(i-6,h*(i-8));t.fillRect(d,i-l,1,l*2)}}else if(this.decodedBuffer){const n=this.decodedBuffer.getChannelData(0),r=this.decodedBuffer.numberOfChannels>1?this.decodedBuffer.getChannelData(1):n,o=n.length,d=Math.max(1,Math.floor(o/e));t.fillStyle=a.waveFill,t.strokeStyle=a.waveStroke,t.lineWidth=1.25,t.beginPath();for(let h=0;h<e;h++){const l=h*d;let u=0;for(let f=0;f<d&&l+f<o;f+=4){const p=Math.max(Math.abs(n[l+f]),Math.abs(r[l+f]));p>u&&(u=p)}const m=Math.min(i-6,u*(i-8));t.fillRect(h,i-m,1,m*2)}}if(this.isPlaying&&this.analyser){const n=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(n),t.strokeStyle=a.liveTrace,t.lineWidth=2,t.beginPath();const r=e/n.length;let o=0;for(let d=0;d<n.length;d++){const l=n[d]/128*s/2;d===0?t.moveTo(o,l):t.lineTo(o,l),o+=r}t.stroke()}if(this.decodedBuffer&&this.decodedBuffer.duration>0){const n=this.getCurrentPlayheadSec(),r=Math.max(0,Math.min(e,n/this.decodedBuffer.duration*e));t.strokeStyle=a.playhead,t.lineWidth=2,t.beginPath(),t.moveTo(r,0),t.lineTo(r,s),t.stroke()}}drawSpectrumView(t,e,s,a=this.getVisualizerThemePalette()){const n=Math.floor(e*.24);if(t.fillStyle=a.bassZoneFill,t.fillRect(0,0,n,s),this.analyser&&this.isPlaying){const r=new Uint8Array(this.analyser.frequencyBinCount);this.analyser.getByteFrequencyData(r);const o=64,d=e/o;for(let h=0;h<o;h++){const l=h/o,u=Math.min(r.length-1,Math.floor(Math.pow(l,2)*(r.length*.45))),m=r[u]/255,f=Math.max(2,m*(s-16)),p=h*d,x=s-f;t.fillStyle=p<n?a.bassBar:a.highBar,t.fillRect(p+1,x,Math.max(2,d-2),f)}}}getOrDefaultDslText(){return this.editorTextarea.value.trim()?this.editorTextarea.value:this.activeDocType==="music"?Be:Ce}static arrayBufferToBase64(t){const e=new Uint8Array(t);let s="";const a=32768;for(let i=0;i<e.length;i+=a){const n=e.subarray(i,i+a);s+=String.fromCharCode(...n)}return btoa(s)}async synthesizeWavBase64ForExport(){let t=this.lastBuildId;if(!t||this.dslDirty||this.activeDocType==="music"&&(this.exportWavNeedsResynth||this.soloTracks.size>0||this.muteTracks.size>0)){const a=this.getOrDefaultDslText().trim();if(!a)throw new Error("No sound or music DSL loaded to synthesize.");const i=await P("/api/sound/synthesize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dsl:a,type:this.activeDocType,apple:this.activeDocType==="music"?this.useAppleSynth:!1,soloTracks:Array.from(this.soloTracks),muteTracks:Array.from(this.muteTracks)})}),n=await i.json().catch(()=>({}));if(!i.ok||!n.buildId)throw new Error(n.error||n.report?.error||`Could not synthesize WAV for export (HTTP ${i.status})`);t=n.buildId,this.lastBuildId=n.buildId,this.exportWavNeedsResynth=!1}const e=await P(`/api/sound/wav?buildId=${encodeURIComponent(t)}`,{method:"GET",cache:"no-store"});if(!e.ok)throw new Error(`Failed to fetch synthesized WAV (HTTP ${e.status})`);const s=await e.arrayBuffer();return ct.arrayBufferToBase64(s)}openFileModal(){const t=this.activeDocType==="music",e=t?".music":".sfx",s=this.activeFilePath?this.activeFilePath.replace(/[\\/][^\\/]+$/,""):D()||void 0;Kt({title:t?"Open Song File (.music)":"Open Sound FX File (.sfx)",acceptExtensions:[e],filterType:"sound",initialDirectory:s,onSelectFilePath:async a=>{await this.loadFileFromPath(a,!0)},onSelectLocalFile:async a=>{const i=a.name||`untitled${e}`;if(!i.toLowerCase().endsWith(e)){F.error("Unsupported File Type",`Expected a ${e} file in ${t?"Song":"SFX"} mode.`);return}const n=await a.text();this.stopPlayback(),this.synthGenId++,this.isSynthesizing=!1,this.pendingSynthRequest=null,this.lastReport=null,this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(n,i,"",this.activeDocType),this.resetHistoryBaseline(),await this.synthesizeAndPlay(!0,!1)}})}async loadFromArtifact(t){const e=(t.ext||"").toLowerCase();if(e!==".music"&&e!==".sfx"){F.error("Unsupported Artifact Type","Only .music and .sfx artifacts can be opened in the Sound Editor.");return}const s=e===".music"?"music":"sfx",a=typeof t.text=="string"?t.text:new TextDecoder("utf-8").decode(t.content);s!==this.activeDocType&&this.saveCurrentModeState(),this.stopPlayback(),this.synthGenId++,this.isSynthesizing=!1,this.pendingSynthRequest=null,this.lastReport=null,this.soloTracks.clear(),this.muteTracks.clear(),this.trackMetaCache.clear(),this.trackStemBuffers.clear(),this.trackStemPeaks.clear(),this.trackStemBaseMeta.clear(),this.trackLiveMeta.clear(),this.exportWavNeedsResynth=!1,this.playOffsetSec=0,this.setDslContent(a,t.displayName||t.filename,t.filePath||"",s),this.resetHistoryBaseline(),this.refreshDiskSfxFiles(),await this.synthesizeAndPlay(!0,!1)}openArtifactModal(){const t=this.activeDocType==="music",e=t?".music":".sfx",s=(this.activeFileName||(t?"song":"sound")).replace(/\.(music|sfx|wav)$/i,"");Jt({title:t?"Song Session Artifacts (.music)":"Sound FX Session Artifacts (.sfx)",filterExtensions:[e],defaultSaveName:s,saveFormats:t?[{value:"music",label:"Music DSL (.music)"}]:[{value:"sfx",label:"Sound FX DSL (.sfx)"}],onLoadArtifact:async a=>{await this.loadFromArtifact(a)},onGetSavePayload:async()=>({text:this.getOrDefaultDslText(),ext:e})})}async saveCurrentFile(){const t=this.activeDocType==="music"?"music":"sfx",e=(this.activeFileName||`untitled.${t}`).replace(/\.(music|sfx|wav)$/i,""),s=this.activeFilePath?this.activeFilePath.replace(/[\\/][^\\/]+$/,""):D()||void 0;bt({mode:"save",title:`Save ${this.activeDocType==="music"?"Song (.music)":"Sound FX (.sfx)"}`,defaultBasename:e,initialDirectory:s,initialFormatId:t,formats:this.activeDocType==="music"?[{id:"music",label:"Music DSL (.music)",ext:"music"}]:[{id:"sfx",label:"Sound FX DSL (.sfx)",ext:"sfx"}],onGetPayload:async()=>({text:this.getOrDefaultDslText(),mimeType:"text/plain;charset=utf-8"}),onSaved:(a,i)=>{this.activeFilePath=a,this.activeFileName=i,this.updateActiveFileLabel(),this.syncEditorModeUI(),this.refreshDiskSfxFiles()}})}async exportCurrentWav(){const t=(this.activeFileName||(this.activeDocType==="music"?"song_export":"sound_export")).replace(/\.(music|sfx|wav)$/i,""),e=this.activeFilePath?this.activeFilePath.replace(/[\\/][^\\/]+$/,""):D()||void 0;bt({mode:"export",title:"Export Synthesized Audio (.wav)",defaultBasename:t,initialDirectory:e,initialFormatId:"wav",formats:[{id:"wav",label:"WAV Audio (.wav)",ext:"wav"}],onGetPayload:async()=>({base64:await this.synthesizeWavBase64ForExport(),mimeType:"audio/wav"})})}async sendToChat(){const t=this.editorTextarea.value.trim(),e=this.chatNoteInputEl.value.trim();if(!(!t&&!e)){this.sendChatBtnEl.disabled=!0;try{const a=[`### Sound Editor: \`${this.activeFilePath||this.activeFileName||(this.activeDocType==="music"?"Untitled.music":"Untitled.sfx")}\``,e?`
**Request**: ${e}`:"",`
\`\`\`${this.activeDocType}`,t,"```"].filter(Boolean).join(`
`),i=window.sidecar?.conversationId||J()||"standalone";if(window.sidecar?.agent?.sendMessage)await window.sidecar.agent.sendMessage(a,i!=="standalone"?i:void 0);else{const n=await P("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:i,buildError:a,note:e,workspace:D()||"."})});if(!n.ok){const r=await n.json().catch(()=>({}));throw new Error(r.error||`Failed to send (HTTP ${n.status})`)}}F.success("Sent to chat"),this.chatNoteInputEl.value=""}catch(s){F.error("Failed to Send",s?.message||String(s))}finally{this.sendChatBtnEl.disabled=!1}}}escapeHtml(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}}class tt{rootEl;editorMode="visual";activeFilePath="";activeFileName="";activeSheetId="";activeDsl="";report=null;sheetImage=null;isPlaying=!1;isOffscreenSkipped=!1;rafId=null;lastTickTime=0;elapsedInFrameMs=0;currentFrameIndex=0;pingPongDir=1;activeTagIndex=0;speedMultiplier=1;smoothFilter=!1;backdrop="slate";userSelectedBackdrop=!1;frameComments=new Map;activeFileLabelEl;openFileBtn;openArtifactBtn;saveBtn;exportBtn;modeVisualBtn;modeTextBtn;visualPaneEl;textPaneEl;playPauseBtn;stagePlayBtn;prevFrameBtn;nextFrameBtn;toggleOnceBtn;frameReadoutEl;textTitleEl;stageCanvas;stageCtx;stageHudEl;atlasCanvas;atlasCtx;scrubberEl;tagsBarEl;dslTextarea;saveDslBtn;compileDslBtn;commentTargetEl;pinnedCommentsBarEl;pinCommentBtn;chatNoteInputEl;constructor(t){this.rootEl=t.rootEl,this.backdrop=this.isLightTheme()?"light":"slate",this.buildDOM(),this.bindEvents(),this.setupBackgroundProcessingGuard(),this.setupThemeSync(),this.renderStageAndAtlas(),jt(()=>{this.loadCatalogAndInitialAsset(!0)}),this.loadCatalogAndInitialAsset()}isLightTheme(){return document.documentElement.classList.contains("light")}setupThemeSync(){const t=()=>{if(!this.userSelectedBackdrop){const e=this.isLightTheme()?"light":"slate";this.backdrop!==e&&(this.backdrop=e,this.syncBackdropPillsUI())}this.renderStageAndAtlas()};window.addEventListener("studio-theme-change",t),typeof MutationObserver<"u"&&new MutationObserver(t).observe(document.documentElement,{attributes:!0,attributeFilter:["class","data-theme"]})}syncBackdropPillsUI(){this.rootEl.querySelectorAll("#spr-bg-group .sprite-speed-pill").forEach(t=>{const e=t.dataset.bg;t.classList.toggle("active",e===this.backdrop)})}updateActiveFileBadge(){if(!this.activeFileLabelEl)return;const t=this.activeFileName||(this.activeFilePath?this.activeFilePath.split("/").pop()||this.activeFilePath:"")||(this.report?.title?`${this.report.title}.sprite`:"");t?(this.activeFileLabelEl.textContent=t,this.activeFileLabelEl.title=this.activeFilePath||t,this.textTitleEl&&(this.textTitleEl.textContent=t)):(this.activeFileLabelEl.textContent="No sprite loaded",this.activeFileLabelEl.title="Open a .sprite or .aseprite file or artifact",this.textTitleEl&&(this.textTitleEl.textContent=".sprite Source"))}static isSupportedSpriteFile(t){const e=(t||"").trim().toLowerCase();return e.endsWith(".sprite")||e.endsWith(".aseprite")||e.endsWith(".ase")}onShow(){this.isOffscreenSkipped=!1,this.userSelectedBackdrop||(this.backdrop=this.isLightTheme()?"light":"slate",this.syncBackdropPillsUI()),this.renderStageAndAtlas(),this.sheetImage&&this.isPlaying&&this.startAnimationLoop()}pausePlayback(){this.isPlaying=!1,this.updatePlayPauseButton(),this.stopAnimationLoop()}buildDOM(){const t=this.backdrop==="light";this.rootEl.innerHTML=`
      <div class="sound-studio-shell">
        <!-- Two-Row Top Toolbar: Row 1 File Actions, Row 2 Visual / Text Toggle, Play/Pause, Backdrop -->
        <header class="sound-toolbar sound-toolbar-two-rows">
          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <span
                id="spr-active-file-label"
                class="file-badge-pill"
                title="Open a .sprite or .aseprite file or artifact"
              >No sprite loaded</span>
            </div>

            <div class="sound-toolbar-edges">
              <button
                type="button"
                id="spr-open-file-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open .sprite or .aseprite file from workspace or computer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span class="btn-label">Open</span>
              </button>

              <button
                type="button"
                id="spr-artifacts-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open or save session sprite artifacts"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="btn-label">Artifacts</span>
              </button>

              <button
                type="button"
                id="spr-save-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Save .sprite or .aseprite file"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span class="btn-label">Save</span>
              </button>

              <button
                type="button"
                id="spr-export-btn"
                class="btn btn-sm btn-primary btn-header-action"
                title="Export as .aseprite, .png sprite sheet, or .json animation manifest"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span class="btn-label">Export</span>
              </button>
            </div>
          </div>

          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <div class="sound-mode-tabs" role="tablist" aria-label="Editor Mode">
                <button
                  type="button"
                  id="spr-mode-visual"
                  class="sound-mode-tab active"
                  role="tab"
                  aria-selected="true"
                  tabindex="0"
                >
                  Visual
                </button>
                <button
                  type="button"
                  id="spr-mode-text"
                  class="sound-mode-tab"
                  role="tab"
                  aria-selected="false"
                  tabindex="-1"
                  title="Edit raw .sprite container text"
                >
                  Text
                </button>
              </div>

              <button
                type="button"
                id="spr-play-btn"
                class="btn btn-primary sound-play-btn"
              >
                Play
              </button>
            </div>

            <div class="sound-toolbar-edges">
              <div class="sprite-speed-pills" id="spr-bg-group" role="group" aria-label="Backdrop">
                <button type="button" class="sprite-speed-pill${t?"":" active"}" data-bg="slate" title="Dark slate backdrop">Slate</button>
                <button type="button" class="sprite-speed-pill${t?" active":""}" data-bg="light" title="Light backdrop">Light</button>
                <button type="button" class="sprite-speed-pill" data-bg="void" title="Pure black backdrop">Void</button>
                <button type="button" class="sprite-speed-pill" data-bg="chroma" title="Chroma green backdrop">Chroma</button>
              </div>
            </div>
          </div>
        </header>

        <!-- 1. Visual Mode: Stage, Transport (Pause/Play + Speed), Motion Chips & Frame Strip -->
        <main id="spr-visual-pane" class="sound-hero-stage">
          <section class="sprite-stage-card" aria-label="Animated Sprite Stage">
            <div class="sprite-stage-canvas-wrap">
              <canvas id="sprite-stage-canvas" width="520" height="240"></canvas>
              <div class="sound-wave-overlay">
                <span id="sprite-stage-hud" class="sound-time-pill">No sprite loaded</span>
              </div>
            </div>

            <div class="sprite-transport-bar" role="group" aria-label="Animation Transport and Speed">
              <div class="sprite-transport-btns">
                <button
                  type="button"
                  id="spr-prev-frame-btn"
                  class="sprite-transport-btn"
                  title="Previous frame"
                  aria-label="Previous frame"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  id="spr-stage-play-btn"
                  class="sprite-transport-btn primary"
                  title="Play / Pause animation"
                  aria-label="Play animation"
                >
                  ▶
                </button>
                <button
                  type="button"
                  id="spr-next-frame-btn"
                  class="sprite-transport-btn"
                  title="Next frame"
                  aria-label="Next frame"
                >
                  ⏭
                </button>
              </div>

              <label for="sprite-frame-scrubber" class="sr-only">Frame Scrubber</label>
              <input
                type="range"
                id="sprite-frame-scrubber"
                class="sprite-range-slider"
                min="0"
                max="0"
                step="1"
                value="0"
              />
              <span id="spr-frame-readout" class="sprite-frame-readout">#0</span>

              <button
                type="button"
                id="spr-toggle-once-btn"
                class="sprite-speed-pill"
                title="Flag this frame to run once as a lead-in before looping the rest of the animation (e.g. tag run 8 once, 9..11 loop)"
              >
                1× Once
              </button>

              <div class="sprite-speed-pills" id="spr-stage-speed-group" role="group" aria-label="Animation Speed">
                <button type="button" class="sprite-speed-pill" data-speed="0.25" title="0.25x speed">0.25×</button>
                <button type="button" class="sprite-speed-pill" data-speed="0.5" title="0.5x speed">0.5×</button>
                <button type="button" class="sprite-speed-pill active" data-speed="1" title="1x speed">1×</button>
                <button type="button" class="sprite-speed-pill" data-speed="2" title="2x speed">2×</button>
              </div>
            </div>
          </section>

          <section class="sound-controls-card" aria-label="Sprite Motions and Frames">
            <div id="sprite-tags-bar" class="sound-preset-strip" role="tablist" aria-label="Sprite Motions"></div>
            <div class="sprite-filmstrip-wrap">
              <canvas id="sprite-atlas-canvas" width="520" height="140" title="Click any sprite frame to pause and comment on it"></canvas>
            </div>
          </section>
        </main>

        <!-- 2. .sprite Text Mode: Direct .sprite Text Editor -->
        <main id="spr-text-pane" class="sound-hero-stage sprite-text-editor-pane hidden">
          <section class="sprite-text-card" aria-label=".sprite Text Editor">
            <div class="sprite-text-header">
              <span id="spr-text-title" class="sprite-text-title">.sprite Source</span>
              <div class="sprite-text-actions">
                <button type="button" id="spr-compile-btn" class="btn btn-secondary btn-sm">
                  Apply
                </button>
                <button type="button" id="spr-save-dsl-btn" class="btn btn-primary btn-sm">
                  Save .sprite
                </button>
              </div>
            </div>
            <textarea
              id="sprite-dsl-textarea"
              class="sound-dsl-textarea sprite-full-textarea"
              spellcheck="false"
              placeholder="// Select a sprite or write .sprite definition here..."
              aria-label="Sprite DSL source code"
            ></textarea>
          </section>
        </main>

        <!-- Bottom Per-Sprite Comment & Prompt Bar -->
        <footer class="sprite-comment-footer">
          <div id="spr-pinned-comments-bar" class="sprite-pinned-comments hidden" aria-label="Pinned sprite frame comments"></div>
          <div class="sound-prompt-bar">
            <span id="spr-comment-target" class="sprite-comment-target-pill" title="Selected sprite frame for comment">
              #0
            </span>
            <input
              type="text"
              id="sprite-chat-note-input"
              class="sound-prompt-input"
              placeholder="Click a sprite frame to comment on it, or ask to edit..."
              aria-label="Comment on selected sprite frame"
            />
            <button
              type="button"
              id="spr-pin-comment-btn"
              class="btn btn-secondary sprite-pin-btn"
              title="Pin comment to this specific sprite frame so you can comment on multiple frames before sending"
            >
              + Note
            </button>
            <button
              type="button"
              id="spr-send-frame-btn"
              class="btn btn-primary sound-send-btn"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    `,this.activeFileLabelEl=this.rootEl.querySelector("#spr-active-file-label"),this.openFileBtn=this.rootEl.querySelector("#spr-open-file-btn"),this.openArtifactBtn=this.rootEl.querySelector("#spr-artifacts-btn"),this.saveBtn=this.rootEl.querySelector("#spr-save-btn"),this.exportBtn=this.rootEl.querySelector("#spr-export-btn"),this.modeVisualBtn=this.rootEl.querySelector("#spr-mode-visual"),this.modeTextBtn=this.rootEl.querySelector("#spr-mode-text"),this.visualPaneEl=this.rootEl.querySelector("#spr-visual-pane"),this.textPaneEl=this.rootEl.querySelector("#spr-text-pane"),this.playPauseBtn=this.rootEl.querySelector("#spr-play-btn"),this.stagePlayBtn=this.rootEl.querySelector("#spr-stage-play-btn"),this.prevFrameBtn=this.rootEl.querySelector("#spr-prev-frame-btn"),this.nextFrameBtn=this.rootEl.querySelector("#spr-next-frame-btn"),this.toggleOnceBtn=this.rootEl.querySelector("#spr-toggle-once-btn"),this.frameReadoutEl=this.rootEl.querySelector("#spr-frame-readout"),this.textTitleEl=this.rootEl.querySelector("#spr-text-title"),this.stageCanvas=this.rootEl.querySelector("#sprite-stage-canvas"),this.stageCtx=this.stageCanvas.getContext("2d"),this.stageHudEl=this.rootEl.querySelector("#sprite-stage-hud"),this.atlasCanvas=this.rootEl.querySelector("#sprite-atlas-canvas"),this.atlasCtx=this.atlasCanvas.getContext("2d"),this.scrubberEl=this.rootEl.querySelector("#sprite-frame-scrubber"),this.tagsBarEl=this.rootEl.querySelector("#sprite-tags-bar"),this.dslTextarea=this.rootEl.querySelector("#sprite-dsl-textarea"),this.saveDslBtn=this.rootEl.querySelector("#spr-save-dsl-btn"),this.compileDslBtn=this.rootEl.querySelector("#spr-compile-btn"),this.commentTargetEl=this.rootEl.querySelector("#spr-comment-target"),this.pinnedCommentsBarEl=this.rootEl.querySelector("#spr-pinned-comments-bar"),this.pinCommentBtn=this.rootEl.querySelector("#spr-pin-comment-btn"),this.chatNoteInputEl=this.rootEl.querySelector("#sprite-chat-note-input"),this.syncRangeSliderCssVars(),this.updatePlayPauseButton(),this.updateActiveFileBadge()}switchEditorMode(t){this.editorMode=t;const e=t==="visual";this.modeVisualBtn.classList.toggle("active",e),this.modeVisualBtn.setAttribute("aria-selected",String(e)),this.modeVisualBtn.setAttribute("tabindex",e?"0":"-1"),this.modeTextBtn.classList.toggle("active",!e),this.modeTextBtn.setAttribute("aria-selected",String(!e)),this.modeTextBtn.setAttribute("tabindex",e?"-1":"0"),this.visualPaneEl.classList.toggle("hidden",!e),this.textPaneEl.classList.toggle("hidden",e),e?this.renderStageAndAtlas():this.pausePlayback()}syncRangeSliderCssVars(){const t=this.scrubberEl.min||"0",e=this.scrubberEl.max||"100",s=this.scrubberEl.value||"0";this.scrubberEl.style.setProperty("--attr-min",t),this.scrubberEl.style.setProperty("--attr-max",e===t?String(Number(t)+1):e),this.scrubberEl.style.setProperty("--control-value",s),this.scrubberEl.setAttribute("aria-valuetext",`Frame ${Number(s)+1}`)}setupBackgroundProcessingGuard(){if(this.rootEl.addEventListener("contentvisibilityautostatechange",t=>{t.skipped?(this.isOffscreenSkipped=!0,this.stopAnimationLoop()):(this.isOffscreenSkipped=!1,this.isPlaying&&this.sheetImage&&this.startAnimationLoop())}),typeof ResizeObserver<"u"){const t=new ResizeObserver(()=>{!this.isOffscreenSkipped&&!this.rootEl.classList.contains("hidden")&&this.renderStageAndAtlas()}),e=this.stageCanvas?.parentElement,s=this.atlasCanvas?.parentElement;e&&t.observe(e),s&&t.observe(s)}}bindEvents(){this.modeVisualBtn.addEventListener("click",()=>this.switchEditorMode("visual")),this.modeTextBtn.addEventListener("click",()=>this.switchEditorMode("text")),this.openFileBtn.addEventListener("click",()=>{this.handleOpenFileModal()}),this.openArtifactBtn.addEventListener("click",()=>{this.handleOpenArtifactModal()}),this.saveBtn.addEventListener("click",()=>{this.handleSaveModal()}),this.exportBtn.addEventListener("click",()=>{this.handleExportModal()}),this.playPauseBtn.addEventListener("click",()=>{this.togglePlayPause()}),this.stagePlayBtn.addEventListener("click",()=>{this.togglePlayPause()}),this.prevFrameBtn.addEventListener("click",()=>{this.stepFrame(-1)}),this.nextFrameBtn.addEventListener("click",()=>{this.stepFrame(1)}),this.toggleOnceBtn.addEventListener("click",()=>{this.toggleOnceOnCurrentFrame()}),this.stageCanvas.addEventListener("click",()=>{this.sheetImage&&this.togglePlayPause()}),this.rootEl.querySelectorAll("#spr-bg-group .sprite-speed-pill").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.bg||"slate";this.userSelectedBackdrop=!0,this.backdrop=e,this.syncBackdropPillsUI(),this.renderStageAndAtlas()})}),this.rootEl.querySelectorAll("#spr-stage-speed-group .sprite-speed-pill").forEach(t=>{t.addEventListener("click",()=>{const e=Number(t.dataset.speed)||1;this.setSpeedMultiplier(e)})}),this.scrubberEl.addEventListener("input",()=>{const t=Number(this.scrubberEl.value)||0;this.selectAndPauseFrame(t)}),this.compileDslBtn.addEventListener("click",()=>{this.compileCurrentDsl(!0)}),this.saveDslBtn.addEventListener("click",()=>{this.saveCurrentDsl()}),this.dslTextarea.addEventListener("keydown",t=>{(t.metaKey||t.ctrlKey)&&t.key==="Enter"&&(t.preventDefault(),this.compileCurrentDsl(!0))}),this.atlasCanvas.addEventListener("click",t=>{if(!this.report||!this.sheetImage)return;const e=this.atlasCanvas.getBoundingClientRect();if(e.width<=0||e.height<=0)return;const s=this.atlasCanvas.width/e.width,a=this.atlasCanvas.height/e.height,i=(t.clientX-e.left)*s,n=(t.clientY-e.top)*a;if(this.activeTagIndex>=0){const r=this.getActiveFrameRange(),o=Math.max(1,r.to-r.from+1),d=this.getFilmstripDrawRect(o);if(i<d.x||i>d.x+d.w||n<d.y||n>d.y+d.h)return;const h=Math.min(o-1,Math.max(0,Math.floor((i-d.x)/d.w*o)));this.selectAndPauseFrame(r.from+h,!0)}else{const r=Math.max(1,this.report.sheetCols||1),o=Math.max(1,this.report.sheetRows||1),d=this.getAtlasDrawRect();if(i<d.x||i>d.x+d.w||n<d.y||n>d.y+d.h)return;const h=Math.min(r-1,Math.max(0,Math.floor((i-d.x)/d.w*r))),u=Math.min(o-1,Math.max(0,Math.floor((n-d.y)/d.h*o)))*r+h;u>=0&&u<this.report.totalFrames&&this.selectAndPauseFrame(u,!0)}}),this.pinCommentBtn.addEventListener("click",()=>{this.pinCommentToCurrentFrame()}),this.rootEl.querySelector("#spr-send-frame-btn")?.addEventListener("click",()=>{this.sendCanvasToChat()}),this.chatNoteInputEl.addEventListener("keydown",t=>{t.key==="Enter"&&(t.shiftKey||t.metaKey||t.ctrlKey)?(t.preventDefault(),this.pinCommentToCurrentFrame()):t.key==="Enter"&&(t.preventDefault(),this.sendCanvasToChat())})}setSpeedMultiplier(t){this.speedMultiplier=t,this.rootEl.querySelectorAll("#spr-stage-speed-group .sprite-speed-pill").forEach(e=>{const s=Number(e.dataset.speed)||1;e.classList.toggle("active",Math.abs(s-t)<.01)})}stepFrame(t){if(!this.report)return;const e=this.getActiveFrameRange(),s=Math.max(1,e.to-e.from+1),a=((this.currentFrameIndex-e.from+t)%s+s)%s;this.selectAndPauseFrame(e.from+a,!1)}selectAndPauseFrame(t,e=!1){if(!this.report)return;const s=Math.max(1,this.report.totalFrames||1);this.currentFrameIndex=Math.max(0,Math.min(s-1,t)),this.isPlaying=!1,this.updatePlayPauseButton(),this.stopAnimationLoop(),this.syncScrubberToFrame(),this.updateCommentTargetBadge(),this.renderStageAndAtlas();const a=this.frameComments.get(this.currentFrameIndex);a&&!this.chatNoteInputEl.value.trim()&&(this.chatNoteInputEl.value=a.comment),e&&this.chatNoteInputEl.focus()}getFrameMetadata(t){if(!this.report)return{tagName:"all",localFrame:1,tagSpan:1,row:1,col:1};const e=Math.max(1,this.report.sheetCols||1),s=t%e+1,a=Math.floor(t/e)+1,i=this.report.tags||[];for(const n of i)if(t>=n.fromFrame&&t<=n.toFrame)return{tagName:n.name,localFrame:t-n.fromFrame+1,tagSpan:Math.max(1,n.toFrame-n.fromFrame+1),row:a,col:s};return{tagName:"all",localFrame:t+1,tagSpan:Math.max(1,this.report.totalFrames||1),row:a,col:s}}updateCommentTargetBadge(){if(!this.commentTargetEl)return;if(!this.report){this.commentTargetEl.textContent="#0";return}const t=this.getFrameMetadata(this.currentFrameIndex);this.commentTargetEl.textContent=`${t.tagName} #${this.currentFrameIndex}`,this.commentTargetEl.title=`Frame #${this.currentFrameIndex} · ${t.tagName} (${t.localFrame}/${t.tagSpan}) · Row ${t.row}, Col ${t.col}`,this.chatNoteInputEl.placeholder=`Comment on ${t.tagName} #${this.currentFrameIndex} (Row ${t.row}, Col ${t.col})...`}pinCommentToCurrentFrame(){if(!this.report)return;const t=this.chatNoteInputEl.value.trim();if(!t){F.info('Type a note first, then click "+ Note" to pin it to this sprite.'),this.chatNoteInputEl.focus();return}const e=this.getFrameMetadata(this.currentFrameIndex);this.frameComments.set(this.currentFrameIndex,{frameIndex:this.currentFrameIndex,tagName:e.tagName,localFrame:e.localFrame,row:e.row,col:e.col,comment:t}),this.chatNoteInputEl.value="",this.renderPinnedCommentsBar(),this.renderStageAndAtlas()}renderPinnedCommentsBar(){if(!this.pinnedCommentsBarEl)return;if(this.pinnedCommentsBarEl.innerHTML="",this.frameComments.size===0){this.pinnedCommentsBarEl.classList.add("hidden");return}this.pinnedCommentsBarEl.classList.remove("hidden");const t=Array.from(this.frameComments.values()).sort((e,s)=>e.frameIndex-s.frameIndex);for(const e of t){const s=document.createElement("div");s.className="sprite-comment-chip";const a=document.createElement("button");a.type="button",a.className="sprite-comment-chip-jump";const i=e.comment.length>28?`${e.comment.slice(0,26)}…`:e.comment;a.textContent=`${e.tagName} #${e.frameIndex}: "${i}"`,a.title=`Jump to ${e.tagName} #${e.frameIndex} (Row ${e.row}, Col ${e.col}): ${e.comment}`,a.addEventListener("click",()=>{this.selectAndPauseFrame(e.frameIndex,!0),this.chatNoteInputEl.value=e.comment});const n=document.createElement("button");n.type="button",n.className="sprite-comment-chip-remove",n.textContent="×",n.setAttribute("aria-label",`Remove comment on frame #${e.frameIndex}`),n.addEventListener("click",()=>{this.frameComments.delete(e.frameIndex),this.renderPinnedCommentsBar(),this.renderStageAndAtlas()}),s.appendChild(a),s.appendChild(n),this.pinnedCommentsBarEl.appendChild(s)}}togglePlayPause(){if(!this.sheetImage){F.info("Select a sprite first.");return}if(this.isPlaying=!this.isPlaying,this.isPlaying){const t=this.getActiveFrameRange();t.loop==="once"&&this.currentFrameIndex>=t.to&&(this.currentFrameIndex=t.from,this.syncScrubberToFrame(),this.renderStageAndAtlas()),this.editorMode!=="visual"&&this.switchEditorMode("visual"),this.startAnimationLoop()}else this.stopAnimationLoop();this.updatePlayPauseButton()}toggleOnceOnCurrentFrame(){if(!this.report||!this.report.tags||this.activeTagIndex<0||this.activeTagIndex>=this.report.tags.length){F.info("Select a named animation tag first to flag a lead-in frame to run once.");return}const t=this.report.tags[this.activeTagIndex];if(t.toFrame<=t.fromFrame){F.info(`Tag "${t.name}" has only 1 frame.`);return}if(this.currentFrameIndex<t.toFrame){const e=this.currentFrameIndex+1;if(t.loopFromFrame===e)delete t.loopFromFrame,F.info(`Cleared lead-in once flag on "${t.name}" (${t.fromFrame}..${t.toFrame} ${t.loop||"loop"}).`);else{t.loopFromFrame=e,(t.loop==="once"||!t.loop||t.loop==="forward")&&(t.loop="loop");const s=e-1>t.fromFrame?`${t.fromFrame}..${e-1}`:`${t.fromFrame}`,a=t.toFrame>e?`${e}..${t.toFrame}`:`${e}`;F.info(`Flagged "${t.name}": ${s} once, ${a} ${t.loop}`)}}else{const e=t.loop==="once"?"loop":"once";t.loop=e,e==="once"&&delete t.loopFromFrame,F.info(`Set "${t.name}" playback mode to ${e}.`)}this.syncTagToDsl(t),this.syncScrubberToFrame(),this.renderStageAndAtlas()}syncTagToDsl(t){const e=this.dslTextarea.value||this.activeDsl;if(!e.trim())return;const s=String(t.loop||"loop").toLowerCase(),a=s==="forward"||s===""?"loop":s;let i="";if(t.loopFromFrame&&t.loopFromFrame>t.fromFrame&&t.loopFromFrame<=t.toFrame){const l=t.loopFromFrame-1>t.fromFrame?`${t.fromFrame}..${t.loopFromFrame-1}`:`${t.fromFrame}`,u=t.toFrame>t.loopFromFrame?`${t.loopFromFrame}..${t.toFrame}`:`${t.loopFromFrame}`;i=`tag ${t.name.padEnd(10)} ${l} once, ${u} ${a}`}else{const l=t.toFrame>t.fromFrame?`${t.fromFrame}..${t.toFrame}`:`${t.fromFrame}`;i=`tag ${t.name.padEnd(10)} ${l} ${a}`}const n=e.split(`
`),r=t.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),o=new RegExp(`^(\\s*tag\\s+${r}\\b)(.*)$`,"i");let d=!1;const h=n.map(l=>!d&&o.test(l)?(d=!0,i):l);if(d){const l=h.join(`
`);this.dslTextarea.value=l,this.activeDsl=l}}getDefaultBasename(){return(this.activeFileName||this.activeFilePath&&this.activeFilePath.split("/").pop()||""||this.report?.title||"sprite").replace(/\.(sprite|aseprite|ase|png|gif|json)$/i,"").trim().replace(/[^a-zA-Z0-9._-]+/g,"_")||"sprite"}getInitialSaveDirectory(){return this.activeFilePath&&this.activeFilePath.includes("/")?this.activeFilePath.slice(0,this.activeFilePath.lastIndexOf("/")):D()||""}handleOpenFileModal(){Kt({title:"Open Sprite File (.sprite, .aseprite)",acceptExtensions:[".sprite",".aseprite",".ase"],filterType:"sprite",initialDirectory:this.getInitialSaveDirectory(),onSelectFilePath:async t=>{await this.loadAssetFile(t)},onSelectLocalFile:async t=>{await this.loadLocalFile(t)}})}handleOpenArtifactModal(){Jt({title:"Session Sprite Artifacts",filterExtensions:[".sprite",".aseprite",".png",".gif"],defaultSaveName:this.getDefaultBasename(),saveFormats:[{value:"sprite",label:".sprite DSL Source"},{value:"aseprite",label:".aseprite Sprite Container"},{value:"png",label:".png Sprite Sheet"}],onLoadArtifact:async t=>{await this.loadArtifactIntoEditor(t)},onGetSavePayload:async t=>{if(t==="sprite"){const s=this.dslTextarea.value.trim()||this.activeDsl.trim();if(!s)throw new Error("No .sprite DSL text available to save.");return{text:s,ext:".sprite"}}return t==="aseprite"?{base64:(await this.buildExportPayload("aseprite")).base64,ext:".aseprite"}:{base64:(await this.buildExportPayload("png")).base64,ext:".png"}}})}handleSaveModal(t){const e=!!(this.dslTextarea.value.trim()||this.activeDsl.trim()),s=t||(this.activeFilePath.toLowerCase().endsWith(".aseprite")||this.activeFilePath.toLowerCase().endsWith(".ase")?"aseprite":e?"sprite":"aseprite");bt({mode:"save",title:"Save Sprite",defaultBasename:this.getDefaultBasename(),initialDirectory:this.getInitialSaveDirectory(),initialFormatId:s,formats:[{id:"sprite",label:"Sprite DSL (.sprite)",ext:".sprite"},{id:"aseprite",label:"Aseprite Binary (.aseprite)",ext:".aseprite"}],onGetPayload:async a=>{if(a==="sprite"){const i=this.dslTextarea.value.trim()||this.activeDsl.trim();if(!i)throw new Error("Write or load a .sprite DSL definition before saving as .sprite.");return{text:i,mimeType:"text/plain;charset=utf-8"}}return await this.buildExportPayload("aseprite")},onSaved:(a,i)=>{a&&(this.activeFilePath=a),this.activeFileName=i,this.updateActiveFileBadge()}})}handleExportModal(){if(!this.sheetImage||!this.report){F.info("Open or compile a sprite before exporting.");return}bt({mode:"export",title:"Export Sprite Asset",defaultBasename:this.getDefaultBasename(),initialDirectory:this.getInitialSaveDirectory(),initialFormatId:"aseprite",formats:[{id:"aseprite",label:"Aseprite Container (.aseprite)",ext:".aseprite"},{id:"png",label:"Packed Sprite Sheet (.png)",ext:".png"},{id:"json",label:"Animation Manifest (.json)",ext:".json"}],onGetPayload:async t=>await this.buildExportPayload(t)})}async buildExportPayload(t){if(!this.sheetImage||!this.report)throw new Error("No compiled or loaded sprite sheet available to export.");if(t==="png"){const s=document.createElement("canvas");s.width=Math.max(1,this.sheetImage.naturalWidth||this.report.sheetWidth||this.report.width),s.height=Math.max(1,this.sheetImage.naturalHeight||this.report.sheetHeight||this.report.height);const a=s.getContext("2d");if(!a)throw new Error("Failed to acquire 2D context for PNG export.");return a.clearRect(0,0,s.width,s.height),a.drawImage(this.sheetImage,0,0),{base64:s.toDataURL("image/png").replace(/^data:image\/png;base64,/,""),mimeType:"image/png"}}if(t==="json"){const s=Math.max(1,this.report.sheetCols||1),a=Math.max(1,this.report.sheetRows||1),i=Math.max(1,this.report.width||1),n=Math.max(1,this.report.height||1),r=Math.max(1,this.report.totalFrames||1),o=this.report.tags||[],d=[];for(let l=0;l<r;l++){const u=l%s,m=Math.floor(l/s),f=o.find(p=>l>=p.fromFrame&&l<=p.toFrame);d.push({frame:l,x:u*i,y:m*n,w:i,h:n,durationMs:f?.durationMs||100,tag:f?.name||"all"})}const h={title:this.report.title||this.getDefaultBasename(),type:this.report.type||"sprite",frameWidth:i,frameHeight:n,sheetWidth:this.report.sheetWidth||s*i,sheetHeight:this.report.sheetHeight||a*n,cols:s,rows:a,totalFrames:r,tags:o,frames:d};return{text:`${JSON.stringify(h,null,2)}
`,mimeType:"application/json;charset=utf-8"}}const e=await this.encodeAsepriteBinary();return{base64:tt.uint8ToBase64(e),mimeType:"application/octet-stream"}}static uint8ToBase64(t){let e="";for(let a=0;a<t.length;a+=32768){const i=t.subarray(a,a+32768);e+=String.fromCharCode(...i)}return btoa(e)}static async zlibCompress(t){if(typeof CompressionStream>"u")throw new Error('CompressionStream("deflate") is required to encode .aseprite cel chunks.');const e=new CompressionStream("deflate"),s=e.writable.getWriter();await s.write(t),await s.close();const a=await new Response(e.readable).arrayBuffer();return new Uint8Array(a)}static async zlibDecompress(t){if(typeof DecompressionStream>"u")throw new Error('DecompressionStream("deflate") is required to decode .aseprite cel chunks.');const e=new DecompressionStream("deflate"),s=e.writable.getWriter();await s.write(t),await s.close();const a=await new Response(e.readable).arrayBuffer();return new Uint8Array(a)}async encodeAsepriteBinary(){if(!this.sheetImage||!this.report)throw new Error("No sprite sheet loaded.");const t=Math.max(1,this.report.width),e=Math.max(1,this.report.height),s=Math.max(1,this.report.sheetCols||1),a=Math.max(1,this.report.totalFrames||1),i=this.report.tags||[],n=document.createElement("canvas");n.width=t,n.height=e;const r=n.getContext("2d",{willReadFrequently:!0});if(!r)throw new Error("Failed to create 2D context for .aseprite encoding.");const o=new TextEncoder,d=[];let h=0;for(let p=0;p<a;p++){const x=p%s,S=Math.floor(p/s);r.clearRect(0,0,t,e),r.drawImage(this.sheetImage,x*t,S*e,t,e,0,0,t,e);const E=new Uint8Array(r.getImageData(0,0,t,e).data.buffer),v=await tt.zlibCompress(E),g=[];if(p===0){const L=o.encode("Sprite"),O=24+L.length,j=new Uint8Array(O),A=new DataView(j.buffer);if(A.setUint32(0,O,!0),A.setUint16(4,8196,!0),A.setUint16(6,1,!0),A.setUint16(8,0,!0),A.setUint16(10,0,!0),A.setUint16(12,0,!0),A.setUint16(14,0,!0),A.setUint16(16,0,!0),j[18]=255,A.setUint16(22,L.length,!0),j.set(L,24),g.push(j),i.length>0){let V=16;const rt=i.map(q=>o.encode(q.name||"anim"));for(const q of rt)V+=19+q.length;const U=new Uint8Array(V),z=new DataView(U.buffer);z.setUint32(0,V,!0),z.setUint16(4,8216,!0),z.setUint16(6,i.length,!0);let _=16;for(let q=0;q<i.length;q++){const R=i[q],W=rt[q];z.setUint16(_,Math.max(0,R.fromFrame),!0),z.setUint16(_+2,Math.max(0,R.toFrame),!0);let H=0,X=0;R.loop==="reverse"?H=1:R.loop==="pingpong"?H=2:R.loop==="once"&&(X=1),U[_+4]=H,z.setUint16(_+5,X,!0),R.loopFromFrame&&R.loopFromFrame>R.fromFrame&&R.loopFromFrame<=R.toFrame&&(z.setUint16(_+7,R.loopFromFrame,!0),U[_+9]=1),U[_+13]=99,U[_+14]=102,U[_+15]=241,z.setUint16(_+17,W.length,!0),U.set(W,_+19),_+=19+W.length}g.push(U)}}const b=26+v.length,y=new Uint8Array(b),w=new DataView(y.buffer);w.setUint32(0,b,!0),w.setUint16(4,8197,!0),w.setUint16(6,0,!0),w.setInt16(8,0,!0),w.setInt16(10,0,!0),y[12]=255,w.setUint16(13,2,!0),w.setInt16(15,0,!0),w.setUint16(22,t,!0),w.setUint16(24,e,!0),y.set(v,26),g.push(y);let B=0;for(const L of g)B+=L.length;const M=16+B,C=new Uint8Array(M),k=new DataView(C.buffer),T=i.find(L=>p>=L.fromFrame&&p<=L.toFrame),I=Math.max(16,T?.durationMs||100);k.setUint32(0,M,!0),k.setUint16(4,61946,!0),k.setUint16(6,g.length,!0),k.setUint16(8,I,!0),k.setUint32(12,g.length,!0);let $=16;for(const L of g)C.set(L,$),$+=L.length;d.push(C),h+=C.length}const l=128+h,u=new Uint8Array(l),m=new DataView(u.buffer);m.setUint32(0,l,!0),m.setUint16(4,42464,!0),m.setUint16(6,a,!0),m.setUint16(8,t,!0),m.setUint16(10,e,!0),m.setUint16(12,32,!0),m.setUint32(14,1,!0),m.setUint16(18,100,!0),u[28]=0,m.setUint16(32,1,!0),u[34]=1,u[35]=1,m.setUint16(38,t,!0),m.setUint16(40,e,!0);let f=128;for(const p of d)u.set(p,f),f+=p.length;return u}async decodeAndLoadAsepriteBuffer(t,e){const s=new Uint8Array(t);if(s.length<128)throw new Error(`Invalid .aseprite file "${e}" (too short).`);const a=new DataView(s.buffer,s.byteOffset,s.byteLength);if(a.getUint16(4,!0)!==42464)throw new Error(`Invalid .aseprite header magic in "${e}".`);const n=Math.max(1,a.getUint16(6,!0)),r=Math.max(1,a.getUint16(8,!0)),o=Math.max(1,a.getUint16(10,!0)),d=a.getUint16(12,!0);if(d!==32)throw new Error(`Unsupported .aseprite color depth (${d}-bit); 32-bit RGBA expected.`);const h=Math.max(1,Math.min(8,Math.ceil(Math.sqrt(n)))),l=Math.max(1,Math.ceil(n/h)),u=h*r,m=l*o,f=document.createElement("canvas");f.width=u,f.height=m;const p=f.getContext("2d");if(!p)throw new Error("Failed to create 2D context for .aseprite sheet decoding.");const x=[],S=[],E=new TextDecoder;let v=128;for(let k=0;k<n&&v+16<=s.length;k++){const T=a.getUint32(v,!0);if(a.getUint16(v+4,!0)!==61946)break;const $=a.getUint16(v+6,!0),L=a.getUint16(v+8,!0)||100,O=a.getUint32(v+12,!0),j=O>0?O:$;S.push(L);let A=v+16;const V=Math.min(s.length,v+T);for(let rt=0;rt<j&&A+6<=V;rt++){const U=a.getUint32(A,!0),z=a.getUint16(A+4,!0);if(U<6||A+U>V)break;if(z===8216&&A+16<=V){const _=a.getUint16(A+6,!0);let q=A+16;for(let R=0;R<_&&q+19<=A+U;R++){const W=a.getUint16(q,!0),H=a.getUint16(q+2,!0),X=s[q+4],ht=a.getUint16(q+5,!0),Y=a.getUint16(q+7,!0),ut=s[q+9]===1,pt=a.getUint16(q+17,!0),mt=Math.min(A+U,q+19+pt),xt=E.decode(s.subarray(q+19,mt))||`tag_${R}`;x.push({name:xt,fromFrame:W,loopFromFrame:ut&&Y>W&&Y<=H?Y:void 0,toFrame:H,frames:Math.max(1,H-W+1),durationMs:L,loop:X===1?"reverse":X===2?"pingpong":ht===1?"once":"loop"}),q=mt}}else if(z===8197&&A+26<=V){const _=a.getInt16(A+8,!0),q=a.getInt16(A+10,!0),R=a.getUint16(A+13,!0);if(R===2||R===0){const W=a.getUint16(A+22,!0),H=a.getUint16(A+24,!0),X=s.subarray(A+26,A+U),ht=R===2?await tt.zlibDecompress(X):X;if(ht.length>=W*H*4&&W>0&&H>0){const Y=document.createElement("canvas");Y.width=W,Y.height=H;const ut=Y.getContext("2d");if(ut){const pt=new Uint8ClampedArray(W*H*4);pt.set(ht.subarray(0,W*H*4));const mt=new ImageData(pt,W,H);ut.putImageData(mt,0,0);const xt=k%h,Zt=Math.floor(k/h);p.drawImage(Y,xt*r+_,Zt*o+q)}}}}A+=U}v+=Math.max(16,T)}for(const k of x)k.fromFrame>=0&&k.fromFrame<S.length&&(k.durationMs=S[k.fromFrame]||100);const g=e.replace(/\.(aseprite|ase)$/i,""),b={passed:!0,title:g,type:"aseprite",width:r,height:o,sheetWidth:u,sheetHeight:m,sheetCols:h,sheetRows:l,palette:"rgba",totalFrames:n,fillRatioPct:50,opaquePixelPct:50,centerOfMassX:.5,centerOfMassY:.5,luminanceSteps:8,premultipliedClean:!0,tags:x.length>0?x:[{name:"default",fromFrame:0,toFrame:n-1,frames:n,durationMs:S[0]||100,loop:"forward"}],parts:[],issues:[]},y=f.toDataURL("image/png"),w=b.tags[0]?.durationMs||100,B=b.tags.map(k=>{const T=k.loop==="forward"||!k.loop?"loop":k.loop;if(k.loopFromFrame&&k.loopFromFrame>k.fromFrame&&k.loopFromFrame<=k.toFrame){const $=k.loopFromFrame-1>k.fromFrame?`${k.fromFrame}..${k.loopFromFrame-1}`:`${k.fromFrame}`,L=k.toFrame>k.loopFromFrame?`${k.loopFromFrame}..${k.toFrame}`:`${k.loopFromFrame}`;return`tag ${k.name.padEnd(10)} ${$} once, ${L} ${T}`}const I=k.toFrame>k.fromFrame?`${k.fromFrame}..${k.toFrame}`:`${k.fromFrame}`;return`tag ${k.name.padEnd(10)} ${I} ${T}`}),M=1e3%w===0?`fps ${1e3/w}`:`duration ${w}ms`,C=[`title "${g}"`,"type sprite",`sheet "${e}"`,`size ${r}x${o}`,`grid ${h}x${l}`,M,"",...B,""].join(`
`);this.activeDsl=C,this.dslTextarea.value=C,await this.applyLoadedSheetResponse(`local_${Date.now()}`,b,y)}async loadImageBufferIntoEditor(t,e,s){const a=s===".gif"?"image/gif":"image/png",i=new Blob([t],{type:a}),n=URL.createObjectURL(i),r=new Image;try{await new Promise((v,g)=>{r.onload=()=>v(),r.onerror=()=>g(new Error(`Failed to decode image "${e}"`)),r.src=n})}finally{URL.revokeObjectURL(n)}const o=Math.max(1,r.naturalWidth||r.width),d=Math.max(1,r.naturalHeight||r.height);let h=1,l=1,u=o,m=d;o>d&&o%d===0&&o/d<=16&&(h=o/d,u=d);const f=h*l,x={passed:!0,title:e.replace(/\.(png|gif)$/i,""),type:"sheet",width:u,height:m,sheetWidth:o,sheetHeight:d,sheetCols:h,sheetRows:l,palette:"rgba",totalFrames:f,fillRatioPct:50,opaquePixelPct:50,centerOfMassX:.5,centerOfMassY:.5,luminanceSteps:8,premultipliedClean:!0,tags:[{name:"all",fromFrame:0,toFrame:f-1,frames:f,durationMs:100,loop:"forward"}],parts:[],issues:[]},S=document.createElement("canvas");S.width=o,S.height=d,S.getContext("2d").drawImage(r,0,0),await this.applyLoadedSheetResponse(`img_${Date.now()}`,x,S.toDataURL("image/png"))}async loadLocalFile(t){this.pausePlayback(),this.activeFilePath="",this.activeFileName=t.name,this.updateActiveFileBadge();const e=t.name.toLowerCase();if(e.endsWith(".sprite")){const a=await t.text();this.activeDsl=a,this.dslTextarea.value=a,await this.compileCurrentDsl(!0);return}const s=await t.arrayBuffer();if(e.endsWith(".aseprite")||e.endsWith(".ase")){await this.decodeAndLoadAsepriteBuffer(s,t.name),this.switchEditorMode("visual"),F.success(`Loaded "${t.name}"`);return}if(e.endsWith(".png")||e.endsWith(".gif")){const a=e.endsWith(".gif")?".gif":".png";await this.loadImageBufferIntoEditor(s,t.name,a),this.switchEditorMode("visual"),F.success(`Loaded "${t.name}"`)}}async loadArtifactIntoEditor(t){this.pausePlayback(),this.activeFilePath=t.filePath||"",this.activeFileName=t.displayName||t.filename,this.updateActiveFileBadge();const e=(t.ext||"").toLowerCase();if(e===".sprite"){const s=typeof t.text=="string"?t.text:new TextDecoder().decode(t.content);this.activeDsl=s,this.dslTextarea.value=s,await this.compileCurrentDsl(!0);return}if(e===".aseprite"||e===".ase"){await this.decodeAndLoadAsepriteBuffer(t.content,this.activeFileName),this.switchEditorMode("visual");return}await this.loadImageBufferIntoEditor(t.content,this.activeFileName,e),this.switchEditorMode("visual")}async loadCatalogAndInitialAsset(t=!1){try{if(D()||await Ct(),t&&this.activeFilePath){await this.loadAssetFile(this.activeFilePath);return}const e=new URLSearchParams(window.location.search),s=(e.get("file")||e.get("path")||e.get("uri")||"").trim();!t&&s&&tt.isSupportedSpriteFile(s)&&await this.loadAssetFile(s)}catch(e){F.error("Sprite Editor failed to load initial asset",e.message)}}async loadAssetFile(t){if(!tt.isSupportedSpriteFile(t))return;this.pausePlayback(),this.activeFilePath=t,this.activeFileName=t.split("/").pop()||t,this.updateActiveFileBadge(),t.toLowerCase().endsWith(".sprite")?await this.loadDslFile(t):await this.loadAsepriteOrSheet(t)}async loadAsepriteOrSheet(t){try{const e=await P("/api/sprite/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:t})}),s=await e.json();if(!e.ok)throw new Error(s.error||`Failed to inspect sprite (${e.status})`);typeof s.dsl=="string"&&s.dsl.trim()&&(this.activeDsl=s.dsl,this.dslTextarea.value=s.dsl),await this.applyLoadedSheetResponse(s.sheetId,s.report,s.pngDataUrl),this.updateActiveFileBadge()}catch(e){F.error("Failed to inspect sprite",e.message)}}async loadDslFile(t){try{const e=await P("/api/sprite/file/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:t})}),s=await e.json();if(!e.ok)throw new Error(s.error||`Failed to read "${t}"`);this.activeDsl=s.content||"",this.dslTextarea.value=this.activeDsl,await this.compileCurrentDsl(!1),this.updateActiveFileBadge()}catch(e){F.error("Failed to load .sprite file",e.message)}}async compileCurrentDsl(t=!1){try{const e=this.dslTextarea.value;if(!e.trim()){F.info("Write or open a .sprite definition first.");return}this.activeDsl=e;const s=await P("/api/sprite/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dsl:e,filePath:this.activeFilePath})}),a=await s.json();if(!s.ok)throw new Error(a.error||`Sprite DSL compilation failed (${s.status})`);await this.applyLoadedSheetResponse(a.sheetId,a.report,a.pngDataUrl),this.updateActiveFileBadge(),t&&(this.switchEditorMode("visual"),F.info(`Applied "${a.report?.title||"Sprite"}"`))}catch(e){F.error("DSL Compile Error",e.message)}}async saveCurrentDsl(){const t=this.dslTextarea.value;if(!t.trim()){F.info("Cannot save empty .sprite text.");return}if(!this.activeFilePath||!this.activeFilePath.toLowerCase().endsWith(".sprite")){this.handleSaveModal("sprite");return}try{const e=await P("/api/sprite/file/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filePath:this.activeFilePath,content:t})}),s=await e.json();if(!e.ok)throw new Error(s.error||`Save failed (${e.status})`);this.activeFilePath=s.filePath||this.activeFilePath,this.activeFileName=s.fileName||this.activeFilePath.split("/").pop()||"",this.updateActiveFileBadge(),F.info(`Saved ${s.fileName}`),await this.compileCurrentDsl(!0)}catch(e){F.error("Failed to save .sprite file",e.message)}}async applyLoadedSheetResponse(t,e,s){this.activeSheetId=t,this.report=e;let a=typeof s=="string"&&s.startsWith("data:image/")?s:"",i="";if(!a){const o=await P(`/api/sprite/png?sheetId=${encodeURIComponent(t)}&t=${Date.now()}`,{method:"GET"});if(!o.ok)throw new Error(`Failed to fetch sprite sheet PNG (${o.status})`);const d=await o.blob();i=URL.createObjectURL(d),a=i}const n=new Image;try{await new Promise((o,d)=>{n.onload=()=>o(),n.onerror=()=>d(new Error(`Failed to decode sprite sheet PNG (${t})`)),n.src=a})}finally{i&&URL.revokeObjectURL(i)}this.sheetImage=n,this.smoothFilter=e.width>=128||e.height>=128,this.activeTagIndex=e.tags&&e.tags.length>0?0:-1;const r=this.getActiveFrameRange();this.currentFrameIndex=r.from,this.pingPongDir=1,this.elapsedInFrameMs=0,this.isPlaying=!1,this.updatePlayPauseButton(),this.stopAnimationLoop(),this.frameComments.clear(),this.renderPinnedCommentsBar(),this.renderTagsBar(),this.syncScrubberToFrame(),this.updateCommentTargetBadge(),this.renderStageAndAtlas()}getActiveFrameRange(){if(!this.report)return{from:0,loopFrom:0,to:0,durationMs:100,loop:"loop",name:"none"};const t=Math.max(1,this.report.totalFrames||1),e=this.report.tags||[];if(this.activeTagIndex>=0&&this.activeTagIndex<e.length){const s=e[this.activeTagIndex],a=Math.max(0,Math.min(t-1,s.fromFrame)),i=Math.max(a,Math.min(t-1,s.toFrame)),n=s.loopFromFrame&&s.loopFromFrame>a&&s.loopFromFrame<=i?s.loopFromFrame:a,r=String(s.loop||"loop").toLowerCase();return{from:a,loopFrom:n,to:i,durationMs:s.durationMs>0?s.durationMs:100,loop:r==="forward"||r===""?"loop":r,name:s.name}}return{from:0,loopFrom:0,to:t-1,durationMs:100,loop:"loop",name:"all"}}syncOnceButtonUI(){if(!this.toggleOnceBtn)return;const t=this.getActiveFrameRange(),e=this.activeTagIndex>=0&&(t.loop==="once"||t.loopFrom>t.from&&this.currentFrameIndex<t.loopFrom);this.toggleOnceBtn.classList.toggle("active",e),this.toggleOnceBtn.disabled=!this.report||this.activeTagIndex<0}syncScrubberToFrame(){const t=this.getActiveFrameRange();if(this.scrubberEl.min=String(t.from),this.scrubberEl.max=String(t.to),this.scrubberEl.value=String(this.currentFrameIndex),this.syncRangeSliderCssVars(),this.frameReadoutEl){const e=Math.max(1,this.currentFrameIndex-t.from+1),s=Math.max(1,t.to-t.from+1);this.frameReadoutEl.textContent=`#${this.currentFrameIndex} · ${e}/${s}`}this.syncOnceButtonUI(),this.updateCommentTargetBadge()}renderTagsBar(){if(this.tagsBarEl.innerHTML="",!this.report)return;const t=this.report.tags||[],e=(s,a)=>{const i=document.createElement("button");return i.type="button",i.className=`sound-preset-chip${this.activeTagIndex===a?" active":""}`,i.setAttribute("role","tab"),i.setAttribute("aria-selected",String(this.activeTagIndex===a)),i.textContent=s,i.addEventListener("click",()=>{this.activeTagIndex=a;const n=this.getActiveFrameRange();this.currentFrameIndex=n.loop==="reverse"?n.to:n.from,this.pingPongDir=1,this.elapsedInFrameMs=0,this.renderTagsBar(),this.syncScrubberToFrame(),this.renderStageAndAtlas()}),i};t.forEach((s,a)=>{this.tagsBarEl.appendChild(e(s.name,a))}),(t.length>1||t.length===0)&&this.tagsBarEl.appendChild(e("All",-1))}updatePlayPauseButton(){this.playPauseBtn&&(this.playPauseBtn.textContent=this.isPlaying?"Pause":"Play"),this.stagePlayBtn&&(this.stagePlayBtn.textContent=this.isPlaying?"⏸":"▶",this.stagePlayBtn.setAttribute("aria-label",this.isPlaying?"Pause animation":"Play animation"))}advanceTagFrame(){if(!this.report)return;const t=this.getActiveFrameRange();if(t.to<=t.from){this.currentFrameIndex=t.from;return}t.loop==="once"?this.currentFrameIndex<t.to?this.currentFrameIndex++:this.pausePlayback():t.loop==="reverse"?(this.currentFrameIndex--,this.currentFrameIndex<t.loopFrom&&(this.currentFrameIndex=t.to)):t.loop==="pingpong"?(this.currentFrameIndex+=this.pingPongDir,this.currentFrameIndex>t.to?(this.pingPongDir=-1,this.currentFrameIndex=Math.max(t.loopFrom,t.to-1)):this.currentFrameIndex<t.loopFrom&&this.pingPongDir<0&&(this.pingPongDir=1,this.currentFrameIndex=Math.min(t.to,t.loopFrom+1))):(this.currentFrameIndex++,this.currentFrameIndex>t.to&&(this.currentFrameIndex=t.loopFrom))}startAnimationLoop(){if(this.rafId!==null)return;this.lastTickTime=performance.now();const t=e=>{if(!this.isPlaying||this.isOffscreenSkipped){this.rafId=null;return}const s=Math.min(100,Math.max(0,e-this.lastTickTime));this.lastTickTime=e;const a=this.getActiveFrameRange(),i=Math.max(16,a.durationMs/Math.max(.1,this.speedMultiplier));this.elapsedInFrameMs+=s,this.elapsedInFrameMs>=i&&(this.elapsedInFrameMs%=i,this.advanceTagFrame(),this.syncScrubberToFrame(),this.renderStageAndAtlas()),this.rafId=requestAnimationFrame(t)};this.rafId=requestAnimationFrame(t)}stopAnimationLoop(){this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null)}drawBackdrop(t,e,s){if(this.backdrop==="chroma"){t.fillStyle="#00FF00",t.fillRect(0,0,e,s);return}if(this.backdrop==="void"){t.fillStyle="#0B0A14",t.fillRect(0,0,e,s);return}const a=16,i=this.backdrop==="light"?"#E4E6EB":"#1E1D2F",n=this.backdrop==="light"?"#F4F5F8":"#26253A";for(let r=0;r<s;r+=a)for(let o=0;o<e;o+=a)t.fillStyle=(o/a+r/a&1)===0?i:n,t.fillRect(o,r,a,a)}drawFrameAt(t,e,s,a,i,n,r=1){if(!this.sheetImage||!this.report)return;const o=Math.max(1,this.report.sheetCols||1),d=this.report.width,h=this.report.height,l=e%o,u=Math.floor(e/o),m=l*d,f=u*h;t.save(),t.globalAlpha=r,t.imageSmoothingEnabled=this.smoothFilter,this.smoothFilter&&(t.imageSmoothingQuality="high"),t.drawImage(this.sheetImage,m,f,d,h,s,a,i,n),t.restore()}renderStageAndAtlas(){this.renderStage(),this.renderAtlas()}syncStageCanvasSize(){const t=this.stageCanvas.parentElement;if(!t)return;const e=t.getBoundingClientRect(),s=Math.max(200,Math.round(e.width||520)),a=Math.max(160,Math.round(e.height||240));(this.stageCanvas.width!==s||this.stageCanvas.height!==a)&&(this.stageCanvas.width=s,this.stageCanvas.height=a)}syncAtlasCanvasSize(t){const e=this.atlasCanvas.parentElement,s=e?e.getBoundingClientRect():null,a=Math.max(200,Math.round(s&&s.width>40?s.width:520)),i=Math.max(80,Math.round(t));(this.atlasCanvas.width!==a||this.atlasCanvas.height!==i)&&(this.atlasCanvas.width=a,this.atlasCanvas.height=i)}renderStage(){this.syncStageCanvasSize();const t=this.stageCanvas.width,e=this.stageCanvas.height,s=this.stageCtx;if(this.drawBackdrop(s,t,e),!this.sheetImage||!this.report){this.stageHudEl.textContent="No sprite loaded",s.save(),s.fillStyle=this.backdrop==="light"?"#475569":"#94A3B8",s.font="600 13px system-ui, -apple-system, sans-serif",s.textAlign="center",s.textBaseline="middle",s.fillText('Click "Open File" or "Open Artifact" to inspect a sprite',t*.5,e*.5),s.restore();return}const a=Math.max(1,this.report.width),i=Math.max(1,this.report.height),n=this.getActiveFrameRange(),r=t*.86,o=e*.86,d=Math.min(r/a,o/i),h=Math.max(1,Math.round(a*d)),l=Math.max(1,Math.round(i*d)),u=Math.round((t-h)*.5),m=Math.round((e-l)*.5);this.drawFrameAt(s,this.currentFrameIndex,u,m,h,l,1);const f=this.currentFrameIndex-n.from+1,p=Math.max(1,n.to-n.from+1),x=n.loopFrom>n.from?`${n.loopFrom-1>n.from?`${n.from}..${n.loopFrom-1}`:n.from} once, ${n.to>n.loopFrom?`${n.loopFrom}..${n.to}`:n.loopFrom} ${n.loop}`:`${n.from}..${n.to} ${n.loop}`;this.stageHudEl.textContent=`${n.name} (${x}) · ${f}/${p} · ${a}×${i}`}getFilmstripDrawRect(t){const e=this.atlasCanvas.width,s=this.atlasCanvas.height;if(!this.report||t<=0)return{x:0,y:0,w:e,h:s,cellW:e};const a=8,i=Math.max(16,e-a*2),n=Math.max(16,s-a*2),r=Math.max(1,this.report.width),o=Math.max(1,this.report.height),d=Math.min(i/(t*r),n/o),h=Math.max(1,Math.round(r*d)),l=Math.max(1,Math.round(o*d)),u=h*t,m=Math.round((e-u)*.5),f=Math.round((s-l)*.5);return{x:m,y:f,w:u,h:l,cellW:h}}getAtlasDrawRect(){const t=this.atlasCanvas.width,e=this.atlasCanvas.height;if(!this.report||this.report.sheetWidth<=0||this.report.sheetHeight<=0)return{x:0,y:0,w:t,h:e};const s=8,a=t-s*2,i=e-s*2,n=Math.min(a/this.report.sheetWidth,i/this.report.sheetHeight),r=Math.max(1,Math.round(this.report.sheetWidth*n)),o=Math.max(1,Math.round(this.report.sheetHeight*n)),d=Math.round((t-r)*.5),h=Math.round((e-o)*.5);return{x:d,y:h,w:r,h:o}}drawCellCommentBadge(t,e,s,a,i,n){if(t.save(),i>=28&&n>=28&&(t.font="600 9px ui-monospace, SFMono-Regular, Menlo, monospace",t.fillStyle=this.backdrop==="light"?"rgba(248, 250, 252, 0.85)":"rgba(11, 10, 20, 0.72)",t.fillRect(s+2,a+2,20,12),t.fillStyle=this.backdrop==="light"?"#0F172A":"rgba(255, 255, 255, 0.78)",t.fillText(`#${e}`,s+4,a+11),this.activeTagIndex>=0)){const r=this.getActiveFrameRange();(r.loop==="once"||r.loopFrom>r.from&&e<r.loopFrom)&&(t.fillStyle="rgba(59, 130, 246, 0.88)",t.fillRect(s+2,a+n-14,24,12),t.fillStyle="#FFFFFF",t.fillText("1×",s+6,a+n-5))}if(this.frameComments.has(e)){const r=Math.min(16,Math.max(10,i*.24)),o=s+i-r-3,d=a+3;t.fillStyle="#F59E0B",t.beginPath(),t.arc(o+r*.5,d+r*.5,r*.5,0,Math.PI*2),t.fill(),t.fillStyle="#0B0A14",t.font="bold 9px system-ui, sans-serif",t.textAlign="center",t.textBaseline="middle",t.fillText("★",o+r*.5,d+r*.5+.5)}t.restore()}renderAtlas(){const t=this.backdrop==="light"?"rgba(15, 23, 42, 0.2)":"rgba(255, 255, 255, 0.16)";if(!this.sheetImage||!this.report){this.syncAtlasCanvasSize(120);const h=this.atlasCanvas.width,l=this.atlasCanvas.height;this.drawBackdrop(this.atlasCtx,h,l),this.atlasCtx.save(),this.atlasCtx.fillStyle=this.backdrop==="light"?"#64748B":"#94A3B8",this.atlasCtx.font="500 12px system-ui, -apple-system, sans-serif",this.atlasCtx.textAlign="center",this.atlasCtx.textBaseline="middle",this.atlasCtx.fillText("Animation filmstrip & frame grid will appear here",h*.5,l*.5),this.atlasCtx.restore();return}if(this.activeTagIndex>=0){this.syncAtlasCanvasSize(132);const h=this.atlasCanvas.width,l=this.atlasCanvas.height,u=this.atlasCtx;this.drawBackdrop(u,h,l);const m=this.getActiveFrameRange(),f=Math.max(1,m.to-m.from+1),p=this.getFilmstripDrawRect(f);for(let x=0;x<f;x++){const S=m.from+x,E=p.x+x*p.cellW,v=p.y;this.drawFrameAt(u,S,E,v,p.cellW,p.h,1),u.save(),S===this.currentFrameIndex?(u.strokeStyle="#F59E0B",u.lineWidth=2.5,u.strokeRect(E+1,v+1,p.cellW-2,p.h-2)):this.frameComments.has(S)?(u.strokeStyle="rgba(245, 158, 11, 0.65)",u.lineWidth=1.5,u.strokeRect(E+.75,v+.75,p.cellW-1.5,p.h-1.5)):(u.strokeStyle=t,u.lineWidth=1,u.strokeRect(E+.5,v+.5,p.cellW-1,p.h-1)),u.restore(),this.drawCellCommentBadge(u,S,E,v,p.cellW,p.h)}return}this.syncAtlasCanvasSize(220);const e=this.atlasCanvas.width,s=this.atlasCanvas.height,a=this.atlasCtx;this.drawBackdrop(a,e,s);const i=this.getAtlasDrawRect();a.save(),a.imageSmoothingEnabled=this.smoothFilter,this.smoothFilter&&(a.imageSmoothingQuality="high"),a.drawImage(this.sheetImage,i.x,i.y,i.w,i.h);const n=Math.max(1,this.report.sheetCols||1),r=Math.max(1,this.report.sheetRows||1),o=i.w/n,d=i.h/r;for(let h=0;h<r;h++)for(let l=0;l<n;l++){const u=h*n+l,m=i.x+l*o,f=i.y+h*d;u===this.currentFrameIndex?(a.strokeStyle="#F59E0B",a.lineWidth=2.5,a.strokeRect(m+1,f+1,o-2,d-2)):this.frameComments.has(u)?(a.strokeStyle="rgba(245, 158, 11, 0.65)",a.lineWidth=1.5,a.strokeRect(m+.75,f+.75,o-1.5,d-1.5)):(a.strokeStyle=t,a.lineWidth=1,a.strokeRect(m+.5,f+.5,o-1,d-1)),this.drawCellCommentBadge(a,u,m,f,o,d)}a.restore()}renderCommentedFramesCard(t){if(!this.report||!this.sheetImage||t.length===0)return this.stageCanvas.toDataURL("image/png");const e=Math.min(4,Math.max(1,t.length)),s=Math.ceil(t.length/e),a=180,i=210,n=12,r=document.createElement("canvas");r.width=e*a+(e+1)*n,r.height=s*i+(s+1)*n;const o=r.getContext("2d");o.fillStyle="#12111C",o.fillRect(0,0,r.width,r.height);const d=Math.max(1,this.report.width),h=Math.max(1,this.report.height);return t.forEach((l,u)=>{const m=u%e,f=Math.floor(u/e),p=n+m*(a+n),x=n+f*(i+n);o.fillStyle="#1E1D2F",o.fillRect(p,x,a,i),o.strokeStyle="#F59E0B",o.lineWidth=2,o.strokeRect(p+1,x+1,a-2,i-2);const S=140,E=Math.min(S/d,S/h),v=Math.max(1,Math.round(d*E)),g=Math.max(1,Math.round(h*E)),b=p+Math.round((a-v)*.5),y=x+8+Math.round((S-g)*.5);this.drawFrameAt(o,l.frameIndex,b,y,v,g,1),o.fillStyle="#F59E0B",o.font="bold 12px ui-monospace, SFMono-Regular, Menlo, monospace",o.fillText(`${l.tagName} #${l.frameIndex} (R${l.row}C${l.col})`,p+8,x+166),o.fillStyle="#E4E6EB",o.font="11px system-ui, -apple-system, sans-serif";const w=l.comment.slice(0,26),B=l.comment.length>26?l.comment.slice(26,52):"";o.fillText(w,p+8,x+184),B&&o.fillText(B,p+8,x+199)}),r.toDataURL("image/png")}async sendCanvasToChat(){if(!this.report){F.info("Select a sprite first before sending to chat.");return}try{const t=this.chatNoteInputEl.value.trim(),e=new Map(this.frameComments);if(t){const h=this.getFrameMetadata(this.currentFrameIndex);e.set(this.currentFrameIndex,{frameIndex:this.currentFrameIndex,tagName:h.tagName,localFrame:h.localFrame,row:h.row,col:h.col,comment:t})}const s=Array.from(e.values()).sort((h,l)=>h.frameIndex-l.frameIndex),a=this.getActiveFrameRange(),i=J()||"standalone";let n="",r="";if(s.length>1){const h=s.map(l=>`- Frame #${l.frameIndex} (${l.tagName} ${l.localFrame}, Row ${l.row} Col ${l.col}): ${l.comment}`);n=`Sprite review for "${this.report.title}" (${this.activeFilePath}):
${h.join(`
`)}`,r=this.renderCommentedFramesCard(s)}else if(s.length===1){const h=s[0];n=`${h.comment} (${this.report.title} · ${h.tagName} · frame #${h.frameIndex} [Row ${h.row}, Col ${h.col}])`,r=this.renderCommentedFramesCard(s)}else n=`Sprite Editor: "${this.report.title}" · ${a.name} · frame #${this.currentFrameIndex} (${this.report.width}×${this.report.height})`,r=this.stageCanvas.toDataURL("image/png");const o=await P("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:i,image:r,filename:`sprite_${a.name}_${Date.now()}.png`,note:n})}),d=await o.json();if(!o.ok)throw new Error(d.error||`Send to chat failed (${o.status})`);this.chatNoteInputEl.value="",this.frameComments.clear(),this.renderPinnedCommentsBar(),this.renderStageAndAtlas(),F.info("Sent sprite review to chat")}catch(t){F.error("Send to chat failed",t.message)}}}function Me(c){const t=c.trim().toLowerCase();if(!t)return null;const e=t.match(/^#([0-9a-f]{3,8})$/i);if(e){const r=e[1];let o=0,d=0,h=0;return r.length===3||r.length===4?(o=parseInt(r[0]+r[0],16),d=parseInt(r[1]+r[1],16),h=parseInt(r[2]+r[2],16)):r.length>=6&&(o=parseInt(r.slice(0,2),16),d=parseInt(r.slice(2,4),16),h=parseInt(r.slice(4,6),16)),(.299*o+.587*d+.114*h)/255}const s=t.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/);if(s){const r=Number(s[1]),o=Number(s[2]),d=Number(s[3]);return(.299*r+.587*o+.114*d)/255}const a=t.match(/^hsla?\(\s*[\d.]+\s*[, ]\s*[\d.]+%\s*[, ]\s*([\d.]+)%/);if(a)return Number(a[1])/100;const i=t.match(/^oklch\(\s*([\d.]+)(%?)/);if(i){const r=Number(i[1]);return i[2]==="%"?r/100:r}const n=t.match(/^[\d.]+\s+[\d.]+%\s+([\d.]+)%$/);return n?Number(n[1])/100:null}function st(c){const t=document.documentElement,e=c==="light",s=t.classList.contains("light")!==e||t.classList.contains("dark")!==!e;t.classList.toggle("light",e),t.classList.toggle("dark",!e),document.body?.classList.toggle("light",e),document.body?.classList.toggle("dark",!e),s&&window.dispatchEvent(new CustomEvent("studio-theme-change",{detail:{theme:c}}))}function at(c){if(c==="light"||c==="dark"){st(c);return}const e=(new URLSearchParams(window.location.search).get("theme")||"").trim().toLowerCase();if(e==="light"||e==="dark"){st(e);return}const s=document.documentElement,a=(s.getAttribute("data-theme")||document.body?.getAttribute("data-theme")||"").trim().toLowerCase();if(a.includes("light")){st("light");return}if(a.includes("dark")){st("dark");return}const i=getComputedStyle(s),n=i.getPropertyValue("--background").trim()||i.getPropertyValue("--vscode-editor-background").trim()||(document.body?getComputedStyle(document.body).getPropertyValue("--background").trim():""),r=Me(n);if(r!==null){st(r>.55?"light":"dark");return}if(typeof window.matchMedia=="function"&&window.matchMedia("(prefers-color-scheme: light)").matches){st("light");return}}function Le(){if(at(),window.addEventListener("message",c=>{const t=c.data;if(!t||typeof t!="object")return;const e=String(t.type||t.event||"").toLowerCase();if(e==="theme-change"||e==="theme"||e==="antigravity:theme-change"||typeof t.theme=="string"||typeof t.colorScheme=="string"){const s=String(t.theme||t.colorScheme||t.mode||"").toLowerCase();s.includes("light")?at("light"):s.includes("dark")?at("dark"):at()}}),typeof MutationObserver<"u"&&new MutationObserver(()=>{at()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]}),typeof window.matchMedia=="function"){const c=window.matchMedia("(prefers-color-scheme: light)");typeof c.addEventListener=="function"&&c.addEventListener("change",()=>at())}}function Ae(){const c=window.location.pathname||"/",t=new URLSearchParams(window.location.search),e=(t.get("view")||"").trim().toLowerCase(),s=(t.get("file")||t.get("path")||t.get("uri")||"").trim().toLowerCase();return c.startsWith("/sprite")||e==="sprite"||s.endsWith(".sprite")||s.endsWith(".aseprite")||s.endsWith(".ase")?"sprite":c.startsWith("/sound")||e==="sound"||s.endsWith(".music")||s.endsWith(".sfx")?"sound":"playtest"}function Wt(){try{Le(),document.title="Game Dev Studio";const c=se(),t=c==="preview"?"studio-mode-preview":"studio-mode-full";document.body.classList.remove("studio-mode-preview","studio-mode-full"),document.body.classList.add("studio-container",t),c==="preview"?document.body.classList.add("bg-transparent"):document.body.classList.remove("bg-transparent");const e=document.getElementById("app");e&&(e.classList.remove("studio-mode-preview","studio-mode-full"),e.classList.add("studio-container",t));const s=document.getElementById("app-root");s&&(s.classList.remove("studio-mode-preview","studio-mode-full"),s.classList.add("studio-container",t));const a=document.getElementById("header-bar"),i=document.getElementById("annotation-bar"),n=document.getElementById("viewport-container"),r=document.getElementById("bug-report-bar");if(!s||!a||!i||!n||!r)throw new Error("Required DOM containers not found for Game Dev Studio. Missing: "+[!s&&"#app-root",!a&&"#header-bar",!i&&"#annotation-bar",!n&&"#viewport-container",!r&&"#bug-report-bar"].filter(Boolean).join(", "));let o=document.getElementById("studio-top-nav");o||(o=document.createElement("nav"),o.id="studio-top-nav",o.className="studio-top-nav",o.setAttribute("aria-label","Game Dev Studio Workspace"),o.innerHTML=`
        <div class="studio-top-tabs" role="tablist" aria-label="Game Dev Studio Tabs">
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
          <button
            type="button"
            id="top-tab-sprite"
            class="studio-top-tab"
            role="tab"
            aria-selected="false"
          >
            Sprites
          </button>
        </div>
      `,s.insertBefore(o,s.firstChild));const d=o.querySelector("#top-tab-playtest"),h=o.querySelector("#top-tab-sound"),l=o.querySelector("#top-tab-sprite");let u=document.getElementById("sound-studio-root");u||(u=document.createElement("div"),u.id="sound-studio-root",u.className="sound-studio-root hidden",s.appendChild(u));let m=document.getElementById("sprite-studio-root");m||(m=document.createElement("div"),m.id="sprite-studio-root",m.className="sprite-studio-root hidden",s.appendChild(m));let f=null,p=null,x=null,S=Ae();const E=(C,k)=>{const T=(C||"").trim().toLowerCase();return T?k==="sound"?T.endsWith(".music")||T.endsWith(".sfx"):k==="sprite"?T.endsWith(".sprite")||T.endsWith(".aseprite")||T.endsWith(".ase"):!1:!1},v=(C,k=!1)=>{try{const T=new URLSearchParams(window.location.search);T.has("view")&&T.set("view",C);const I=T.get("file")||T.get("path")||T.get("uri")||"";(k||I&&!E(I,C))&&(T.delete("file"),T.delete("path"),T.delete("uri"));const $=C==="sound"?"/sound":C==="sprite"?"/sprite":"/playtest",L=T.toString(),O=`${$}${L?`?${L}`:""}`;window.location.pathname+window.location.search!==O&&window.history.replaceState({view:C},"",O)}catch{}document.title="Game Dev Studio"},g=()=>(f||(f=new Ee({headerEl:a,annotationBarEl:i,viewportEl:n,bugBarEl:r})),f),b=()=>(p||(p=new ct({rootEl:u,onSwitchToPlaytest:()=>w("playtest")})),p),y=()=>(x||(x=new tt({rootEl:m})),x),w=(C,k=!0)=>{S=C;const T=C==="playtest",I=C==="sound",$=C==="sprite";d&&h&&(d.classList.toggle("active",T),d.setAttribute("aria-selected",String(T)),h.classList.toggle("active",I),h.setAttribute("aria-selected",String(I))),l&&(l.classList.toggle("active",$),l.setAttribute("aria-selected",String($))),!T&&f&&f.runner.isRunning()&&!f.runner.isPaused()&&f.runner.setPaused(!0),!I&&p&&p.stopPlayback(),!$&&x&&x.pausePlayback(),a.classList.toggle("studio-view-hidden",!T),i.classList.toggle("studio-view-hidden",!T),n.classList.toggle("studio-view-hidden",!T),r.classList.toggle("studio-view-hidden",!T),u.classList.toggle("hidden",!I),m.classList.toggle("hidden",!$),k?v(C):document.title="Game Dev Studio",I?b():$?y().onShow():g()};d?.addEventListener("click",()=>w("playtest")),h?.addEventListener("click",()=>w("sound")),l?.addEventListener("click",()=>w("sprite"));const B=window.location.pathname||"/",M=B.startsWith("/sound")||B.startsWith("/sprite")||B.startsWith("/playtest");w(S,M),console.log(`[Game Dev Studio] Initialized "${S}" view in "${c}" mode`)}catch(c){console.error("[Game Dev Studio] Initialization error:",c),F.fatal("Game Dev Studio Initialization Failed",c)}}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",Wt,{once:!0}):Wt();window.addEventListener("error",c=>{console.error("[Game Dev Studio] Uncaught Window Error:",c),F.fatal("Uncaught Runtime Error",c.error||c.message)});window.addEventListener("unhandledrejection",c=>{console.error("[Game Dev Studio] Unhandled Promise Rejection:",c),F.fatal("Unhandled Promise Rejection",c.reason)});
