(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(s){if(s.ep)return;s.ep=!0;const i=e(s);fetch(s.href,i)}})();let D=null,P=null;const V=[],X=[];function L(r){if(typeof r=="number"&&Number.isFinite(r))return!0;if(typeof r!="string")return!1;const t=r.trim();return t.length>0&&!(t.startsWith("__")&&t.endsWith("__"))}async function I(r,t={}){const e=r.startsWith("http://")||r.startsWith("https://")?r:`${O()}${r}`;return window.sidecar&&typeof window.sidecar.fetch=="function"?window.sidecar.fetch(e,t):fetch(e,t)}function O(){const r=window.__STUDIO_CONFIG__?.apiBaseUrl;return L(r)?String(r).trim().replace(/\/+$/,""):""}const U=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;function K(){const r=window.sidecar?.conversationId?.trim();if(r&&U.test(r))return r;const t=new URLSearchParams(window.location.search),e=(t.get("conversationId")||t.get("session_id")||t.get("sessionId"))?.trim();if(e&&L(e)&&U.test(e))return e;const n=window.__STUDIO_CONFIG__?.sessionId;if(L(n)){const s=String(n).trim();if(U.test(s))return s}return""}function F(){return D===null&&(D=K()),D}function M(){const r=F();return r||null}function Y(r){const t=r.trim();if(!t||!U.test(t))throw new Error(`Invalid session_id "${r}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`);D=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.sessionId=t);for(const e of V)e(t)}function T(r){Y(r)}function J(r){V.push(r)}function Z(){const t=new URLSearchParams(window.location.search).get("workspace")?.trim();if(t&&L(t))return t;const e=window.__STUDIO_CONFIG__?.workspace;return L(e)?String(e).trim():""}function k(){return P===null&&(P=Z()),P}function q(r){const t=r.trim();P=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.workspace=t);for(const e of X)e(t)}function Q(r){X.push(r)}function tt(){return new URLSearchParams(window.location.search).get("mode")==="preview"||window.__STUDIO_CONFIG__?.mode==="preview"?"preview":"full"}function R(){const r=window.location.protocol==="http:"||window.location.protocol==="https:"?window.location.origin:O(),t=F()||"standalone",e=k(),n=new URLSearchParams({mode:"full",conversationId:t}),s=new URLSearchParams(window.location.search).get("token");return s&&n.set("token",s),e&&n.set("workspace",e),`${r}/?${n.toString()}`}async function et(r){const t=await I("/api/workspace/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceUri:r})});if(!t.ok){const e=await t.json().catch(()=>({}));throw new Error(e.error||`Failed to resolve workspace URI: HTTP ${t.status}`)}return await t.json()}async function nt(){const r=await I("/api/health",{method:"GET",cache:"no-store"});if(!r.ok)throw new Error(`Failed to fetch sidecar health: HTTP ${r.status} ${r.statusText}`);const t=await r.json();return t.activeSessionId&&!F()&&Y(t.activeSessionId),t.defaultWorkspace&&!k()&&q(t.defaultWorkspace),t}async function it(){const r=await I("/api/sessions",{method:"GET",cache:"no-store"});if(!r.ok)throw new Error(`Failed to fetch recent sessions: HTTP ${r.status} ${r.statusText}`);const t=await r.json();return Array.isArray(t.sessions)?t.sessions:[]}async function st(r){const t=r.workspace.trim();if(!t)throw new Error("Workspace path is required to compile Go WASM.");const e=r.pkg?.trim()||void 0,n=await I("/api/playtest/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:t,pkg:e})}),s=await n.text();let i={};if(s.trim())try{i=JSON.parse(s)}catch{throw new Error(`Unexpected non-JSON response from /api/playtest/build (HTTP ${n.status}): ${s.slice(0,300)}`)}if(n.status===422)return{ok:!1,status:422,error:i.error||"Go WASM compilation failed",compilerOutput:i.compilerOutput||i.stderr||i.error||s,workspace:i.workspace||t,pkg:i.pkg||e||".",exitCode:typeof i.exitCode=="number"?i.exitCode:1};if(!n.ok)throw new Error(i.error||`WASM build request failed with HTTP ${n.status} ${n.statusText}`);return{ok:!0,status:200,buildId:i.buildId,workspace:i.workspace||t,pkg:i.pkg||e||".",wasmBytes:i.wasmBytes??0,durationMs:i.durationMs??0,wasmUrl:i.wasmUrl||`/api/playtest/wasm?buildId=${encodeURIComponent(i.buildId)}`,wasmExecUrl:i.wasmExecUrl||"/api/playtest/wasm_exec.js"}}async function G(r){const t=r.sessionId||window.sidecar?.conversationId||F()||"standalone",e=r.workspace||k(),n=r.pkg||".",s=r.filename||`playtest-bug-${Date.now()}.png`,i=await I("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,filename:s,image:r.imageDataUrl,note:r.note||"",consoleLogs:r.consoleLogs||[],workspace:e,pkg:n,metadata:{workspace:e,pkg:n,frameOffset:r.frameOffset??"live",resolution:r.resolution||(r.width&&r.height?`${r.width}x${r.height}`:"canvas"),width:r.width,height:r.height}})}),a=await i.text();let o={};try{o=a?JSON.parse(a):{}}catch{o={error:a}}if(!i.ok)throw new Error(o.error||`Failed to send bug report to chat: HTTP ${i.status} ${i.statusText}`);return o}async function at(r){const t=r.sessionId||window.sidecar?.conversationId||F()||"standalone",e=r.workspace||k(),n=r.pkg||".",s=await I("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,buildError:r.buildError,note:r.note||"",workspace:e,pkg:n,metadata:{workspace:e,pkg:n}})}),i=await s.text();let a={};try{a=i?JSON.parse(i):{}}catch{a={error:i}}if(!s.ok)throw new Error(a.error||`Failed to send build error to chat: HTTP ${s.status} ${s.statusText}`);return a}class ot{maxFrames;captureIntervalMs;slots;writePtr=0;count=0;sequence=0;lastCaptureTimeMs=-1/0;constructor(t=250,e=40){if(!Number.isInteger(t)||t<1)throw new Error(`[FrameDvrBuffer] Invalid maxFrames=${t}. Must be a positive integer.`);if(!Number.isFinite(e)||e<1)throw new Error(`[FrameDvrBuffer] Invalid captureIntervalMs=${e}. Must be a positive number.`);this.maxFrames=t,this.captureIntervalMs=e,this.slots=new Array(t).fill(null)}get length(){return this.count}shouldCapture(t){return t-this.lastCaptureTimeMs>=this.captureIntervalMs}recordFrame(t,e=performance.now()){if(!t||typeof t.toDataURL!="function"||typeof t.width!="number"||typeof t.height!="number")throw new Error("[FrameDvrBuffer] recordFrame requires a valid canvas element with width, height, and toDataURL().");if(t.width<=0||t.height<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${t.width}x${t.height}).`);const n=t.toDataURL("image/png");return this.recordFrameDataUrl(n,t.width,t.height,e)}recordFrameDataUrl(t,e,n,s=performance.now()){if(typeof t!="string"||!t.startsWith("data:image/"))throw new Error("[FrameDvrBuffer] Canvas toDataURL() did not return a valid image data URI.");if(!Number.isFinite(e)||!Number.isFinite(n)||e<=0||n<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${e}x${n}).`);const i=++this.sequence,a={frameNumber:i,timestampMs:s,width:e,height:n,dataUrl:t};return this.slots[this.writePtr]=a,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s,{index:this.count-1,frameNumber:i,timestampMs:s,relativeSec:0,width:a.width,height:a.height,dataUrl:a.dataUrl}}recordCanvasSlot(t,e,n,s){const a={frameNumber:++this.sequence,timestampMs:s,width:e,height:n,dataUrl:"",canvas:t};this.slots[this.writePtr]=a,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=s}recordFrameIfDue(t,e=performance.now()){return this.shouldCapture(e)?this.recordFrame(t,e):null}createDvrFrameFromSlot(t,e,n){return{index:e,frameNumber:t.frameNumber,timestampMs:t.timestampMs,relativeSec:n,width:t.width,height:t.height,canvas:t.canvas,get dataUrl(){return!t.dataUrl&&t.canvas&&(t.dataUrl=t.canvas.toDataURL("image/png")),t.dataUrl}}}getFrames(){if(this.count===0)return[];const t=this.count<this.maxFrames?0:this.writePtr,e=(t+this.count-1)%this.maxFrames,n=this.slots[e],s=n?n.timestampMs:0,i=new Array(this.count);for(let a=0;a<this.count;a++){const o=(t+a)%this.maxFrames,d=this.slots[o],h=(d.timestampMs-s)/1e3,p=h===0?0:Number(h.toFixed(2));i[a]=this.createDvrFrameFromSlot(d,a,p)}return i}getFrameAt(t){if(!Number.isInteger(t)||t<0||t>=this.count)return null;const e=this.count<this.maxFrames?0:this.writePtr,n=(e+t)%this.maxFrames,s=this.slots[n];if(!s)return null;const i=(e+this.count-1)%this.maxFrames,a=this.slots[i],o=a?a.timestampMs:s.timestampMs,d=(s.timestampMs-o)/1e3,h=d===0?0:Number(d.toFixed(2));return this.createDvrFrameFromSlot(s,t,h)}getLatestFrame(){return this.count===0?null:this.getFrameAt(this.count-1)}clear(){this.slots.fill(null),this.writePtr=0,this.count=0,this.lastCaptureTimeMs=-1/0}}function rt(){const r=new Uint8Array(768);let t=0;const e=(a,o,d)=>{t>=256||(r[t*3]=a,r[t*3+1]=o,r[t*3+2]=d,t++)},n=[0,51,102,153,204,255];for(let a=0;a<6;a++)for(let o=0;o<6;o++)for(let d=0;d<6;d++)e(n[a],n[o],n[d]);for(let a=0;a<24;a++){const o=Math.round(8+a*238/23);e(o,o,o)}const s=[[239,68,68],[250,204,21],[6,182,212],[34,197,94],[255,255,255],[9,13,22],[11,15,26],[16,23,38],[20,12,14],[56,189,248],[244,63,94],[168,85,247],[16,185,129],[245,158,11],[99,102,241],[236,72,153]];for(const[a,o,d]of s)e(a,o,d);const i=new Uint8Array(32768);for(let a=0;a<32;a++){const o=a<<3|a>>2;for(let d=0;d<32;d++){const h=d<<3|d>>2;for(let p=0;p<32;p++){const u=p<<3|p>>2;let f=0,m=1/0;for(let l=0;l<256;l++){const c=r[l*3],y=r[l*3+1],w=r[l*3+2],E=o-c,b=h-y,g=u-w,v=E*E*2+b*b*4+g*g;if(v<m&&(m=v,f=l,v===0))break}i[a<<10|d<<5|p]=f}}}return{palette:r,lut15:i}}let W=null;function lt(){return W||(W=rt()),W}class dt{buf;length=0;constructor(t=262144){this.buf=new Uint8Array(t)}ensure(t){const e=this.length+t;if(e<=this.buf.length)return;let n=this.buf.length*2;for(;n<e;)n*=2;const s=new Uint8Array(n);s.set(this.buf.subarray(0,this.length)),this.buf=s}writeByte(t){this.ensure(1),this.buf[this.length++]=t&255}writeUint16LE(t){this.ensure(2),this.buf[this.length++]=t&255,this.buf[this.length++]=t>>8&255}writeBytes(t){this.ensure(t.length),this.buf.set(t,this.length),this.length+=t.length}writeAscii(t){this.ensure(t.length);for(let e=0;e<t.length;e++)this.buf[this.length++]=t.charCodeAt(e)&255}toUint8Array(){return this.buf.slice(0,this.length)}}function ct(r,t,e){r.writeByte(8);let a=9,o=258,d=(1<<a)-1;e.fill(-1);const h=new Uint8Array(255);let p=0,u=0,f=0;const m=()=>{p>0&&(r.writeByte(p),r.writeBytes(h.subarray(0,p)),p=0)},l=c=>{for(u|=c<<f,f+=a;f>=8;)h[p++]=u&255,p===255&&m(),u>>=8,f-=8};if(l(256),t.length>0){let c=t[0];for(let y=1;y<t.length;y++){const w=t[y],E=c<<8|w,b=e[E];b!==-1?c=b:(l(c),o<4096?(e[E]=o,o>d&&a<12&&(a++,d=(1<<a)-1),o++):(l(256),e.fill(-1),a=9,o=258,d=(1<<a)-1),c=w)}l(c)}l(257),f>0&&(h[p++]=u&255),m(),r.writeByte(0)}function ht(r){const{width:t,height:e,frames:n}=r;if(!Number.isInteger(t)||!Number.isInteger(e)||t<=0||e<=0)throw new Error(`[GifEncoder] Invalid GIF dimensions: ${t}x${e}.`);if(!Array.isArray(n)||n.length===0)throw new Error("[GifEncoder] encodeAnimatedGif requires at least 1 frame.");const s=t*e*4;for(let u=0;u<n.length;u++){const f=n[u];if(!f||!f.rgba||f.rgba.length!==s)throw new Error(`[GifEncoder] Frame ${u} RGBA length (${f?.rgba?.length??0}) does not match ${t}x${e}x4 (${s}).`)}const{palette:i,lut15:a}=lt(),o=new dt(Math.max(65536,t*e*Math.min(n.length,8)));o.writeAscii("GIF89a"),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(247),o.writeByte(0),o.writeByte(0),o.writeBytes(i),o.writeBytes([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);const d=t*e,h=new Uint8Array(d),p=new Int32Array(4096*256);for(let u=0;u<n.length;u++){const f=n[u],m=f.rgba,l=Math.max(2,Math.round((f.delayMs||66)/10));for(let c=0,y=0;c<d;c++,y+=4){const w=m[y]>>3,E=m[y+1]>>3,b=m[y+2]>>3;h[c]=a[w<<10|E<<5|b]}o.writeBytes([33,249,4,0]),o.writeUint16LE(l),o.writeBytes([0,0]),o.writeByte(44),o.writeUint16LE(0),o.writeUint16LE(0),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(0),ct(o,h,p)}return o.writeByte(59),o.toUint8Array()}function $(r,t,e){if(t<=0||e<=0||r.length<t*e*4)return{x:0,y:0,width:Math.max(1,t),height:Math.max(1,e)};const n=(t*e-1)*4,s=r[3],i=r[n+3],a=s===0||i===0,o=r[0],d=r[1],h=r[2],p=!a&&o<=12&&d<=16&&h<=26&&Math.abs(r[n]-o)<=2&&Math.abs(r[n+1]-d)<=2&&Math.abs(r[n+2]-h)<=2,u=g=>{const v=r[g+3];return a?v>16:p?v>16&&(Math.abs(r[g]-o)>2||Math.abs(r[g+1]-d)>2||Math.abs(r[g+2]-h)>2):v>16&&(r[g]>0||r[g+1]>0||r[g+2]>0)};let f=0,m=!1;for(let g=0;g<e;g++){const v=g*t*4;for(let C=0;C<t;C+=2)if(u(v+C*4)){f=g,m=!0;break}if(m)break}if(!m)return{x:0,y:0,width:t,height:e};let l=e-1;for(let g=e-1;g>=f;g--){const v=g*t*4;let C=!1;for(let A=0;A<t;A+=2)if(u(v+A*4)){l=g,C=!0;break}if(C)break}let c=0,y=!1;for(let g=0;g<t;g++){for(let v=f;v<=l;v+=2)if(u((v*t+g)*4)){c=g,y=!0;break}if(y)break}let w=t-1;for(let g=t-1;g>=c;g--){let v=!1;for(let C=f;C<=l;C+=2)if(u((C*t+g)*4)){w=g,v=!0;break}if(v)break}const E=w-c+1,b=l-f+1;return E<64||b<36?{x:0,y:0,width:t,height:e}:{x:c,y:f,width:E,height:b}}function ut(r){const e=[];for(let s=0;s<r.length;s+=32768){const i=r.subarray(s,s+32768);e.push(String.fromCharCode(...i))}const n=e.join("");return`data:image/gif;base64,${btoa(n)}`}const z=[{name:"Red",hex:"#EF4444"},{name:"Yellow",hex:"#FACC15"},{name:"Cyan",hex:"#06B6D4"},{name:"Lime",hex:"#22C55E"},{name:"White",hex:"#FFFFFF"}];function pt(r,t){const e=r.replace(/^#/,"").trim();if(e.length===3){const n=parseInt(e[0]+e[0],16),s=parseInt(e[1]+e[1],16),i=parseInt(e[2]+e[2],16);return`rgba(${n}, ${s}, ${i}, ${t})`}if(e.length===6){const n=parseInt(e.slice(0,2),16),s=parseInt(e.slice(2,4),16),i=parseInt(e.slice(4,6),16);return`rgba(${n}, ${s}, ${i}, ${t})`}return`rgba(239, 68, 68, ${t})`}function j(r){return r.type==="pen"?{...r,points:r.points.map(t=>({x:t.x,y:t.y}))}:{...r}}function x(r){return r.map(j)}class ft{baseCanvas;overlayCanvas;onHistoryChange;activeTool="box";activeColor=z[0].hex;strokeWidth=3;shapes=[];undoStack=[];redoStack=[];isDrawing=!1;draftShape=null;shapeCounter=0;activeTextInputEl=null;width;height;hasBaseSnapshot=!1;constructor(t={}){this.baseCanvas=t.baseCanvas??null,this.overlayCanvas=t.overlayCanvas??null,this.onHistoryChange=t.onHistoryChange??null,this.width=t.width??(this.baseCanvas?.width||640),this.height=t.height??(this.baseCanvas?.height||360),this.baseCanvas&&(this.baseCanvas.width=this.width,this.baseCanvas.height=this.height),this.overlayCanvas&&(this.overlayCanvas.width=this.width,this.overlayCanvas.height=this.height,this.bindPointerEvents(this.overlayCanvas))}getTool(){return this.activeTool}setTool(t){this.commitOrCloseActiveTextInput(),this.activeTool=t}getColor(){return this.activeColor}setColor(t){if(!t||typeof t!="string")throw new Error("[BugAnnotator] Invalid color value.");this.activeColor=t}getDimensions(){return{width:this.width,height:this.height}}setDimensions(t,e){if(t<=0||e<=0)throw new Error(`[BugAnnotator] Invalid dimensions: ${t}x${e}`);this.width=t,this.height=e,this.baseCanvas&&(this.baseCanvas.width!==t||this.baseCanvas.height!==e)&&(this.baseCanvas.width=t,this.baseCanvas.height=e),this.overlayCanvas&&(this.overlayCanvas.width!==t||this.overlayCanvas.height!==e)&&(this.overlayCanvas.width=t,this.overlayCanvas.height=e),this.renderOverlay()}getShapes(){return x(this.shapes)}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}addShape(t){this.undoStack.push(x(this.shapes)),this.redoStack=[],this.shapes.push(j(t)),this.renderOverlay(),this.notifyHistoryChange()}addTextAnnotation(t,e,n){const s=n.trim();if(!s)return null;const i={id:this.nextShapeId(),type:"text",color:this.activeColor,x:Math.round(t),y:Math.round(e),text:s};return this.addShape(i),i}undo(){if(this.undoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.redoStack.push(x(this.shapes));const t=this.undoStack.pop();return this.shapes=x(t),this.renderOverlay(),this.notifyHistoryChange(),!0}redo(){if(this.redoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.undoStack.push(x(this.shapes));const t=this.redoStack.pop();return this.shapes=x(t),this.renderOverlay(),this.notifyHistoryChange(),!0}clearAnnotations(){this.commitOrCloseActiveTextInput(),this.shapes.length!==0&&(this.undoStack.push(x(this.shapes)),this.redoStack=[],this.shapes=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange())}resetHistory(){this.commitOrCloseActiveTextInput(),this.shapes=[],this.undoStack=[],this.redoStack=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange()}loadBaseFromCanvas(t){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to receive snapshot.");t.width>0&&t.height>0&&this.setDimensions(t.width,t.height);const e=this.baseCanvas.getContext("2d");if(!e)throw new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas.");e.clearRect(0,0,this.width,this.height),e.drawImage(t,0,0,this.width,this.height),this.hasBaseSnapshot=!0,this.renderOverlay()}loadBaseFrameDataUrl(t,e,n){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to load frame data URL.");if(!t||!t.startsWith("data:image/"))throw new Error("[BugAnnotator] Invalid image dataUrl passed to loadBaseFrameDataUrl.");return new Promise((s,i)=>{const a=new Image;a.onload=()=>{const o=e&&e>0?e:a.naturalWidth||this.width,d=n&&n>0?n:a.naturalHeight||this.height;this.setDimensions(o,d);const h=this.baseCanvas.getContext("2d");if(!h){i(new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas."));return}h.clearRect(0,0,o,d),h.drawImage(a,0,0,o,d),this.hasBaseSnapshot=!0,this.renderOverlay(),s()},a.onerror=()=>{i(new Error("[BugAnnotator] Failed to decode DVR frame dataUrl into Image."))},a.src=t})}hasFrozenFrame(){return this.hasBaseSnapshot}renderOverlay(){if(!this.overlayCanvas)return;const t=this.overlayCanvas.getContext("2d");if(t){t.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);for(const e of this.shapes)this.renderShape(t,e);this.draftShape&&this.renderShape(t,this.draftShape)}}renderShape(t,e){if(t.save(),e.type==="pen"){if(e.points.length>0){t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke()}}else if(e.type==="arrow"){const n=e.endX-e.startX,s=e.endY-e.startY;if(Math.hypot(n,s)>=2){const a=Math.atan2(s,n),o=Math.max(12,e.strokeWidth*4.5),d=Math.PI/6.5,h=e.endX-o*Math.cos(a-d),p=e.endY-o*Math.sin(a-d),u=e.endX-o*Math.cos(a+d),f=e.endY-o*Math.sin(a+d);t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.72)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(a),e.endY-o*.55*Math.sin(a)),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(a),e.endY-o*.55*Math.sin(a)),t.stroke(),t.beginPath(),t.moveTo(e.endX,e.endY),t.lineTo(h,p),t.lineTo(u,f),t.closePath(),t.fillStyle=e.color,t.strokeStyle="rgba(0, 0, 0, 0.75)",t.lineWidth=1.5,t.stroke(),t.fill()}}else if(e.type==="box"){const n=e.width>=0?e.x:e.x+e.width,s=e.height>=0?e.y:e.y+e.height,i=Math.abs(e.width),a=Math.abs(e.height);(i>=1||a>=1)&&(t.fillStyle=pt(e.color,.14),t.fillRect(n,s,i,a),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2,t.strokeRect(n,s,i,a),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.strokeRect(n,s,i,a))}else if(e.type==="text"){const n='600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';t.font=n;const s=t.measureText(e.text),i=8,a=5,o=Math.ceil(s.width)+i*2,d=24,h=Math.max(4,Math.min(this.width-o-4,e.x)),p=Math.max(4,Math.min(this.height-d-4,e.y-d/2));t.fillStyle="rgba(9, 13, 22, 0.9)",t.strokeStyle=e.color,t.lineWidth=2,t.beginPath(),typeof t.roundRect=="function"?t.roundRect(h,p,o,d,6):t.rect(h,p,o,d),t.fill(),t.stroke(),t.fillStyle="#FFFFFF",t.textBaseline="middle",t.fillText(e.text,h+i,p+d/2+a*.05)}t.restore()}exportCompositeDataUrl(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");e.width=this.width,e.height=this.height;const n=e.getContext("2d");if(!n)throw new Error("[BugAnnotator] Failed to acquire 2D context for composite export.");this.baseCanvas?n.drawImage(this.baseCanvas,0,0,this.width,this.height):(n.fillStyle="#090D16",n.fillRect(0,0,this.width,this.height));for(const s of this.shapes)this.renderShape(n,s);return e.toDataURL("image/png")}exportSmartComposite(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");let n={x:0,y:0,width:this.width,height:this.height};if(this.baseCanvas&&typeof this.baseCanvas.getContext=="function"){const d=this.baseCanvas.getContext("2d");if(d&&typeof d.getImageData=="function"){const h=d.getImageData(0,0,this.width,this.height);n=$(h.data,this.width,this.height)}}const s=gt(this.shapes,this.width,this.height),i=mt(n,s,this.width,this.height);e.width=i.width,e.height=i.height;const a=e.getContext("2d");if(!a)throw new Error("[BugAnnotator] Failed to acquire 2D context for smart composite export.");typeof a.fillRect=="function"&&(i.x<n.x||i.y<n.y||i.x+i.width>n.x+n.width||i.y+i.height>n.y+n.height||!this.baseCanvas)&&(a.fillStyle="#090D16",a.fillRect(0,0,i.width,i.height)),this.baseCanvas&&(i.x===0&&i.y===0&&i.width===this.width&&i.height===this.height?a.drawImage(this.baseCanvas,0,0,this.width,this.height):a.drawImage(this.baseCanvas,i.x,i.y,i.width,i.height,0,0,i.width,i.height));const o=(i.x!==0||i.y!==0)&&typeof a.translate=="function";o&&(a.save(),a.translate(-i.x,-i.y));for(const d of this.shapes)this.renderShape(a,d);return o&&a.restore(),{dataUrl:e.toDataURL("image/png"),width:i.width,height:i.height,crop:i}}bindPointerEvents(t){const e=s=>{const i=t.getBoundingClientRect(),a=i.width>0?t.width/i.width:1,o=i.height>0?t.height/i.height:1;return{x:(s.clientX-i.left)*a,y:(s.clientY-i.top)*o}};t.addEventListener("pointerdown",s=>{if(s.button!==0)return;s.preventDefault();const i=e(s);if(this.activeTool==="text"){this.openInlineTextInput(i.x,i.y,s.clientX,s.clientY);return}this.commitOrCloseActiveTextInput(),this.isDrawing=!0;try{t.setPointerCapture(s.pointerId)}catch{}const a=this.nextShapeId();this.activeTool==="pen"?this.draftShape={id:a,type:"pen",color:this.activeColor,strokeWidth:this.strokeWidth,points:[i]}:this.activeTool==="arrow"?this.draftShape={id:a,type:"arrow",color:this.activeColor,strokeWidth:this.strokeWidth,startX:i.x,startY:i.y,endX:i.x,endY:i.y}:this.activeTool==="box"&&(this.draftShape={id:a,type:"box",color:this.activeColor,strokeWidth:this.strokeWidth,x:i.x,y:i.y,width:0,height:0}),this.renderOverlay()}),t.addEventListener("pointermove",s=>{if(!this.isDrawing||!this.draftShape)return;const i=e(s);this.draftShape.type==="pen"?this.draftShape.points.push(i):this.draftShape.type==="arrow"?(this.draftShape.endX=i.x,this.draftShape.endY=i.y):this.draftShape.type==="box"&&(this.draftShape.width=i.x-this.draftShape.x,this.draftShape.height=i.y-this.draftShape.y),this.renderOverlay()});const n=s=>{if(!this.isDrawing||!this.draftShape)return;this.isDrawing=!1;try{t.hasPointerCapture(s.pointerId)&&t.releasePointerCapture(s.pointerId)}catch{}const i=this.draftShape;if(this.draftShape=null,i.type==="pen"){let a=1/0,o=-1/0,d=1/0,h=-1/0;for(const p of i.points)p.x<a&&(a=p.x),p.x>o&&(o=p.x),p.y<d&&(d=p.y),p.y>h&&(h=p.y);if(Math.hypot(o-a,h-d)<3){this.renderOverlay();return}}else if(i.type==="arrow"){if(Math.hypot(i.endX-i.startX,i.endY-i.startY)<4){this.renderOverlay();return}}else if(i.type==="box"&&Math.abs(i.width)<3&&Math.abs(i.height)<3){this.renderOverlay();return}this.addShape(i)};t.addEventListener("pointerup",n),t.addEventListener("pointercancel",n)}openInlineTextInput(t,e,n,s){if(this.commitOrCloseActiveTextInput(),!this.overlayCanvas||!this.overlayCanvas.parentElement)return;const i=this.overlayCanvas.parentElement,a=i.getBoundingClientRect(),o=document.createElement("input");o.type="text",o.className="annotation-inline-text-input",o.placeholder="Type bug label & press Enter...",o.style.position="absolute",o.style.left=`${Math.max(8,Math.min(a.width-180,n-a.left))}px`,o.style.top=`${Math.max(8,Math.min(a.height-34,s-a.top-14))}px`,o.style.zIndex="50",o.style.background="rgba(9, 13, 22, 0.95)",o.style.color="#FFFFFF",o.style.border=`2px solid ${this.activeColor}`,o.style.borderRadius="6px",o.style.padding="4px 8px",o.style.fontSize="12px",o.style.fontWeight="600",o.style.outline="none",o.style.minWidth="160px",o.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.45)";let d=!1;const h=()=>{if(d)return;d=!0;const u=o.value.trim();o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null),u&&this.addTextAnnotation(t,e,u)},p=()=>{d||(d=!0,o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null))};o.addEventListener("keydown",u=>{u.stopPropagation(),u.key==="Enter"?(u.preventDefault(),h()):u.key==="Escape"&&(u.preventDefault(),p())}),o.addEventListener("blur",()=>{h()}),this.activeTextInputEl=o,i.appendChild(o),requestAnimationFrame(()=>o.focus())}commitOrCloseActiveTextInput(){this.activeTextInputEl&&(this.activeTextInputEl.blur(),this.activeTextInputEl=null)}nextShapeId(){return`ann-${++this.shapeCounter}-${Date.now()}`}notifyHistoryChange(){this.onHistoryChange&&this.onHistoryChange()}}function gt(r,t,e,n=12){if(!r||r.length===0||t<=0||e<=0)return null;let s=1/0,i=1/0,a=-1/0,o=-1/0;const d=(m,l,c,y,w)=>{const E=Math.min(m,c)-w,b=Math.max(m,c)+w,g=Math.min(l,y)-w,v=Math.max(l,y)+w;E<s&&(s=E),g<i&&(i=g),b>a&&(a=b),v>o&&(o=v)};for(const m of r)if(m.type==="pen"){const l=(m.strokeWidth||3)+4+n;for(const c of m.points)d(c.x,c.y,c.x,c.y,l)}else if(m.type==="arrow"){const l=Math.max(16,(m.strokeWidth||3)*4.5)+n;d(m.startX,m.startY,m.endX,m.endY,l)}else if(m.type==="box"){const l=(m.strokeWidth||3)+4+n;d(m.x,m.y,m.x+m.width,m.y+m.height,l)}else if(m.type==="text"){const l=Math.ceil((m.text||"").length*8.5)+16,c=24,y=Math.max(4,Math.min(t-l-4,m.x)),w=Math.max(4,Math.min(e-c-4,m.y-c/2));d(y,w,y+l,w+c,4+n)}if(!Number.isFinite(s)||!Number.isFinite(i))return null;const h=Math.max(0,Math.floor(s)),p=Math.max(0,Math.floor(i)),u=Math.min(t,Math.ceil(a)),f=Math.min(e,Math.ceil(o));return{x:h,y:p,width:Math.max(1,u-h),height:Math.max(1,f-p)}}function mt(r,t,e,n){if(!t)return r;const s=Math.max(0,Math.min(r.x,t.x)),i=Math.max(0,Math.min(r.y,t.y)),a=Math.min(e,Math.max(r.x+r.width,t.x+t.width)),o=Math.min(n,Math.max(r.y+r.height,t.y+t.height));return{x:s,y:i,width:Math.max(1,a-s),height:Math.max(1,o-i)}}const _=200,N=15e3;class bt{container;dvrBuffer;callbacks;iframe=null;currentRunnerId=0;activeMessageHandler=null;paused=!1;muted=!1;focused=!1;running=!1;consoleLogs=[];constructor(t,e,n={}){this.container=t,this.dvrBuffer=e,this.callbacks=n}isRunning(){return this.running}isPaused(){return this.paused}isMuted(){return this.muted}isFocused(){return this.focused}getConsoleLogs(){return[...this.consoleLogs]}clearConsoleLogs(){this.consoleLogs=[]}getGameCanvas(){try{const t=this.iframe?.contentWindow?.document;return t?this.iframe?.contentWindow?.__ACTIVE_GAME_CANVAS__||t.querySelector("canvas"):null}catch{return null}}async launchBuild(t){if(!t||typeof t!="string")throw new Error("[WasmRunner] launchBuild requires a non-empty buildId.");this.destroy(),this.dvrBuffer.clear(),this.clearConsoleLogs(),this.paused=!1,this.callbacks.onStateChange?.("loading"),await this.mountSidecarRunnerIframe({buildId:t})}postToChild(t){this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage({source:"playtest-runner-parent",runnerId:this.currentRunnerId,...t},"*")}mountSidecarRunnerIframe(t){return new Promise((e,n)=>{const s=++this.currentRunnerId;let i=!1;const a=window.setTimeout(()=>{i||(i=!0,this.callbacks.onStateChange?.("error"),n(new Error(`[WasmRunner] Timed out after ${N}ms waiting for sidecar runner iframe (/api/playtest/runner) to initialize.`)))},N),o=m=>{const l=m.data;if(!(!l||l.source!=="playtest-runner-child"||l.runnerId!==s))switch(l.type){case"READY":{this.running=!0,this.callbacks.onStateChange?.("running"),i||(i=!0,window.clearTimeout(a),e());break}case"FRAME":{if(typeof l.dataUrl=="string"&&typeof l.width=="number"&&typeof l.height=="number"&&l.width>0&&l.height>0)try{this.dvrBuffer.recordFrameDataUrl(l.dataUrl,l.width,l.height,l.timestampMs??performance.now()),this.callbacks.onFrameRecorded?.()}catch(c){console.error("[WasmRunner] Frame DVR capture error:",c)}break}case"LOG":{const c=l.level||"log";this.appendLog(c,l.text||"");break}case"PANIC":{const c=l.message||"Unknown Go WASM runtime error";this.appendLog("error",c),this.callbacks.onPanic?.(c,this.getConsoleLogs()),i||(i=!0,window.clearTimeout(a),n(new Error(c)));break}case"TOGGLE_PAUSE":{this.togglePause();break}case"FOCUS_CHANGE":{const c=!!l.focused;this.focused=c,this.callbacks.onFocusChange?.(c);break}}};this.activeMessageHandler=o,window.addEventListener("message",o);const d=O(),h=new URLSearchParams({runnerId:String(s),muted:this.muted?"1":"0",captureIntervalMs:String(this.dvrBuffer.captureIntervalMs),buildId:t.buildId}),p=new URLSearchParams(window.location.search).get("token");p&&h.set("token",p);const u=`${d}/api/playtest/runner?${h.toString()}`,f=document.createElement("iframe");f.className="wasm-runner-iframe",f.setAttribute("title","Ebitengine Playtest Viewport"),f.src=u,this.container.innerHTML="",this.container.appendChild(f),this.iframe=f})}syncDvrFromChild(){try{const t=this.iframe?.contentWindow;if(!t||typeof t.__PLAYTEST_GET_DVR_FRAMES__!="function")return;const e=t.__PLAYTEST_GET_DVR_FRAMES__();if(!Array.isArray(e)||e.length===0)return;this.dvrBuffer.clear();for(let n=0;n<e.length;n++){const s=e[n];s&&s.canvas&&s.width>0&&s.height>0&&this.dvrBuffer.recordCanvasSlot(s.canvas,s.width,s.height,s.timestampMs)}}catch{}}captureImmediateFrame(){this.running&&(this.postToChild({type:"CAPTURE_NOW"}),this.syncDvrFromChild())}setPaused(t){!this.running||this.paused===t||(this.paused=t,this.postToChild({type:"SET_PAUSED",paused:t}),t&&this.syncDvrFromChild(),this.callbacks.onPauseChange?.(t),this.callbacks.onStateChange?.(t?"paused":"running"))}togglePause(){return this.running?(this.setPaused(!this.paused),this.paused):!1}setMuted(t){this.muted=t,this.postToChild({type:"SET_MUTED",muted:t})}toggleMuted(){return this.setMuted(!this.muted),this.muted}focus(){try{this.iframe?.contentWindow?.focus()}catch{}this.postToChild({type:"FOCUS_GAME"})}dispatchVirtualKey(t,e,n){this.postToChild({type:"DISPATCH_KEY",code:t,key:e,keyEventType:n})}destroy(){this.activeMessageHandler&&(window.removeEventListener("message",this.activeMessageHandler),this.activeMessageHandler=null),this.running=!1,this.paused=!1,this.focused=!1,this.iframe&&(this.iframe.src="about:blank",this.iframe.remove(),this.iframe=null),this.container.innerHTML="",this.callbacks.onFocusChange?.(!1)}appendLog(t,e){const s=`[${new Date().toISOString().slice(11,23)}] [${t.toUpperCase()}] ${e}`;this.consoleLogs.push(s),this.consoleLogs.length>_&&this.consoleLogs.splice(0,this.consoleLogs.length-_),this.callbacks.onLog?.(t,s,this.getConsoleLogs())}}class S{static container=null;static getContainer(){return this.container||(this.container=document.createElement("div"),this.container.className="notification-container",document.body.appendChild(this.container)),this.container}static show(t,e="info",n=4e3,s){const i=this.getContainer(),a=document.createElement("div");a.className=`notification-toast toast-${e}`;const o=document.createElement("span");o.className="toast-icon",o.textContent=e==="success"?"✓":e==="error"?"⚠️":"ℹ";const d=document.createElement("div");d.className="toast-message";const h=document.createElement("div");if(h.className="toast-title",h.textContent=t,d.appendChild(h),s){const u=document.createElement("pre");u.className="toast-detail",u.textContent=s,d.appendChild(u)}const p=document.createElement("button");p.className="toast-close",p.textContent="✕",p.title="Dismiss",p.onclick=()=>a.remove(),a.appendChild(o),a.appendChild(d),a.appendChild(p),i.appendChild(a),n>0&&setTimeout(()=>{a.classList.add("toast-fade-out"),setTimeout(()=>a.remove(),280)},n)}static info(t,e=3e3){this.show(t,"info",e)}static success(t,e=3800){this.show(t,"success",e)}static error(t,e){console.error("[Playtest Studio Error]",t,e||""),this.show(t,"error",0,e)}static fatal(t,e,n){console.error("[Playtest Studio FATAL]",t,e,n??"");const s=document.getElementById("fatal-error-overlay");s&&s.remove();const i=document.createElement("div");i.id="fatal-error-overlay",i.className="modal-overlay fatal-overlay",i.setAttribute("role","alertdialog"),i.setAttribute("aria-modal","true");const a=e instanceof Error?`${e.name}: ${e.message}`:String(e),o=e instanceof Error&&e.stack?e.stack:"",d=[n?`[Context] ${n}`:"",a,o&&o!==a?o:""].filter(Boolean).join(`

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
    `;const h=i.querySelector(".fatal-title");h&&(h.textContent=t);const p=i.querySelector(".fatal-pre");p&&(p.textContent=d);const u=()=>{window.removeEventListener("keydown",f),i.remove()},f=m=>{m.key==="Escape"&&(m.preventDefault(),u())};window.addEventListener("keydown",f),i.querySelector("#fatal-reload-btn")?.addEventListener("click",()=>{window.location.reload()}),i.querySelector("#fatal-dismiss-btn")?.addEventListener("click",u),document.body.appendChild(i)}}class yt{headerEl;annotationBarEl;viewportEl;bugBarEl;dvrBuffer;annotator;runner;activePkg=".";activeDvrIndex=0;keypadVisible=!1;logsDrawerVisible=!1;isBuilding=!1;lastBuildFailure=null;runnerMountEl;annotationStageEl;readyStateEl;errorStateEl;gameStageEl;focusPillEl;keypadOverlayEl;logsDrawerEl;constructor(t){this.headerEl=t.headerEl,this.annotationBarEl=t.annotationBarEl,this.viewportEl=t.viewportEl,this.bugBarEl=t.bugBarEl,this.dvrBuffer=new ot(250,40),this.renderHeader(),this.renderAnnotationBar(),this.renderViewport(),this.renderBugReportBar();const e=this.viewportEl.querySelector("#annotation-base-canvas"),n=this.viewportEl.querySelector("#annotation-overlay-canvas");this.annotator=new ft({baseCanvas:e,overlayCanvas:n,width:640,height:360,onHistoryChange:()=>this.updateAnnotationControlsUI()}),this.runner=new bt(this.runnerMountEl,this.dvrBuffer,{onFrameRecorded:()=>{if(this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.runner.isPaused()&&this.annotator.getShapes().length===0){const s=this.dvrBuffer.getLatestFrame();s&&this.annotator.loadBaseFrameDataUrl(s.dataUrl,s.width,s.height)}},onPauseChange:s=>{this.handlePauseStateChanged(s)},onFocusChange:s=>{this.updateFocusPillUI(s)},onLog:(s,i,a)=>{this.updateLogsUI(a)},onPanic:(s,i)=>{this.updateLogsUI(i),this.showRuntimePanicView(s)}}),this.bindEvents(),this.syncSessionAndWorkspaceFromServer()}async applyWorkspaceUri(t){if(!t||!t.trim())return!1;try{const e=await et(t);return e.workspace&&q(e.workspace),e.pkg&&(this.activePkg=e.pkg),this.updateHeaderInputsUI(),!!e.hasGoMod}catch(e){return console.warn("[PlaytestStudioUI] Failed to resolve workspace URI:",e),!1}}async syncSessionAndWorkspaceFromServer(){let t=!!new URLSearchParams(window.location.search).get("workspace")?.trim();if(window.sidecar?.conversationId&&!M())try{T(window.sidecar.conversationId)}catch{}window.sidecar&&typeof window.sidecar.onWorkspaceChange=="function"&&window.sidecar.onWorkspaceChange(e=>{Array.isArray(e)&&e.length>0&&e[0]&&this.applyWorkspaceUri(e[0])});try{const e=await nt();if(e.activeSessionId&&!M()&&T(e.activeSessionId),e.defaultWorkspace){const n=await this.applyWorkspaceUri(e.defaultWorkspace);t=t||n}this.updateHeaderInputsUI(),this.updateSessionBadgeUI()}catch(e){console.warn("[PlaytestStudioUI] Sidecar health check skipped or unavailable:",e)}if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const e=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(n=>setTimeout(()=>n([]),1200))]);if(Array.isArray(e)&&e.length>0&&e[0]){const n=await this.applyWorkspaceUri(e[0]);t=t||n}}catch(e){console.warn("[PlaytestStudioUI] getWorkspaceUris skipped:",e)}t&&k().trim()&&!this.isBuilding&&!this.runner.isRunning()&&this.handleBuildAndRun()}renderHeader(){const t=k();this.headerEl.innerHTML=`
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
            placeholder="Workspace path (e.g. /path/to/game)"
            value="${this.escapeAttr(t)}"
            aria-label="Go workspace directory path"
            title="Go Workspace Directory Path"
          />
          <input
            type="text"
            id="pkg-input"
            class="input-text pkg-path-input"
            placeholder="./cmd/game or ."
            value="${this.escapeAttr(this.activePkg)}"
            aria-label="Go main package path"
            title="Go Main Package Path (e.g. . or ./cmd/game)"
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
          href="${this.escapeAttr(R())}"
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
    `,this.updateSessionBadgeUI()}renderAnnotationBar(){const t=z.map((e,n)=>`
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
    `}renderViewport(){const t=k();this.viewportEl.innerHTML=`
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
              <label for="ready-workspace-input">Go Workspace Directory</label>
              <input
                type="text"
                id="ready-workspace-input"
                class="input-text"
                placeholder="/path/to/ebitengine-game"
                value="${this.escapeAttr(t)}"
              />
            </div>
            <div class="ready-field ready-field-pkg">
              <label for="ready-pkg-input">Package</label>
              <input
                type="text"
                id="ready-pkg-input"
                class="input-text"
                placeholder="./cmd/game or ."
                value="${this.escapeAttr(this.activePkg)}"
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
        title="Attach Captured WASM Console / Stderr Logs (ON — Click to toggle)"
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
    `}bindEvents(){const t=this.headerEl.querySelector("#workspace-input"),e=this.headerEl.querySelector("#pkg-input"),n=this.viewportEl.querySelector("#ready-workspace-input"),s=this.viewportEl.querySelector("#ready-pkg-input"),i=l=>{q(l),t.value!==l&&(t.value=l),n.value!==l&&(n.value=l)},a=l=>{this.activePkg=l.trim()||".",e.value!==l&&(e.value=l),s.value!==l&&(s.value=l)};t.addEventListener("change",()=>i(t.value)),n.addEventListener("input",()=>i(n.value)),e.addEventListener("change",()=>a(e.value)),s.addEventListener("input",()=>a(s.value)),Q(()=>this.updateHeaderInputsUI()),J(()=>this.updateSessionBadgeUI()),this.headerEl.querySelector("#btn-build-run")?.addEventListener("click",()=>{i(t.value),a(e.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-ready-build")?.addEventListener("click",()=>{i(n.value),a(s.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-retry-build")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-send-build-error")?.addEventListener("click",()=>{this.handleSendBuildErrorToChat()}),this.headerEl.querySelector("#btn-pause-toggle")?.addEventListener("click",()=>{this.runner.togglePause()}),this.headerEl.querySelector("#btn-home-ready")?.addEventListener("click",()=>{this.showReadyStateView()}),this.headerEl.querySelector("#btn-keypad-toggle")?.addEventListener("click",()=>{this.keypadVisible=!this.keypadVisible,this.keypadOverlayEl.classList.toggle("hidden",!this.keypadVisible),this.headerEl.querySelector("#btn-keypad-toggle")?.classList.toggle("active",this.keypadVisible)}),this.headerEl.querySelector("#btn-mute-toggle")?.addEventListener("click",()=>{const l=this.runner.toggleMuted(),c=this.headerEl.querySelector("#mute-btn-label"),y=this.headerEl.querySelector("#btn-mute-toggle");if(c&&(c.textContent=l?"🔇":"🔊"),y){const w=l?"Unmute Game Audio (Muted)":"Mute Game Audio";y.setAttribute("data-tooltip",w),y.setAttribute("title",w)}}),this.headerEl.querySelector("#btn-logs-toggle")?.addEventListener("click",()=>{this.logsDrawerVisible=!this.logsDrawerVisible,this.logsDrawerEl.classList.toggle("hidden",!this.logsDrawerVisible),this.headerEl.querySelector("#btn-logs-toggle")?.classList.toggle("active",this.logsDrawerVisible)}),this.viewportEl.querySelector("#btn-close-logs")?.addEventListener("click",()=>{this.logsDrawerVisible=!1,this.logsDrawerEl.classList.add("hidden"),this.headerEl.querySelector("#btn-logs-toggle")?.classList.remove("active")}),this.viewportEl.querySelector("#btn-clear-logs")?.addEventListener("click",()=>{this.runner.clearConsoleLogs(),this.updateLogsUI([])}),this.headerEl.querySelector("#btn-session-badge")?.addEventListener("click",()=>{this.openSessionSwitcherModal()}),this.focusPillEl.addEventListener("click",()=>{this.runner.isPaused()||this.runner.focus()}),this.keypadOverlayEl.querySelectorAll(".keypad-btn").forEach(l=>{const c=l,y=c.dataset.code||"Space",w=c.dataset.key||" ",E=g=>{g.preventDefault(),c.classList.add("pressed"),this.runner.dispatchVirtualKey(y,w,"keydown")},b=g=>{g.preventDefault(),c.classList.contains("pressed")&&(c.classList.remove("pressed"),this.runner.dispatchVirtualKey(y,w,"keyup"))};c.addEventListener("pointerdown",E),c.addEventListener("pointerup",b),c.addEventListener("pointerleave",b),c.addEventListener("pointercancel",b)}),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(l=>{l.addEventListener("click",()=>{const c=l.dataset.tool;c&&this.selectAnnotationTool(c)})});const h=this.annotationBarEl.querySelectorAll(".qa-color-swatch");h.forEach(l=>{l.addEventListener("click",()=>{const c=l.dataset.color;c&&(this.annotator.setColor(c),h.forEach(y=>y.classList.remove("active")),l.classList.add("active"))})}),this.annotationBarEl.querySelector("#btn-ann-undo")?.addEventListener("click",()=>{this.annotator.undo()}),this.annotationBarEl.querySelector("#btn-ann-redo")?.addEventListener("click",()=>{this.annotator.redo()}),this.annotationBarEl.querySelector("#btn-ann-clear")?.addEventListener("click",()=>{this.annotator.clearAnnotations()});const p=this.annotationBarEl.querySelector("#dvr-scrubber-slider");p.addEventListener("input",()=>{const l=Number.parseInt(p.value,10);this.scrubToDvrFrame(l)}),this.annotationBarEl.querySelector("#btn-dvr-prev")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.max(0,this.activeDvrIndex-1);this.scrubToDvrFrame(l)}}),this.annotationBarEl.querySelector("#btn-dvr-next")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1);this.scrubToDvrFrame(l)}});const u=this.bugBarEl.querySelector("#btn-toggle-attach-logs"),f=this.bugBarEl.querySelector("#include-logs-checkbox");u?.addEventListener("click",()=>{const l=f?!f.checked:!1;f&&(f.checked=l),u.classList.toggle("active",l),u.setAttribute("aria-pressed",String(l));const c=l?"Attach WASM Console Logs (ON)":"Attach WASM Console Logs (OFF)";u.setAttribute("data-tooltip",c),u.setAttribute("title",c)}),this.bugBarEl.querySelector("#bug-note-input").addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),this.handleSendBugToChat())}),this.bugBarEl.querySelector("#btn-send-bug-chat")?.addEventListener("click",()=>{this.handleSendBugToChat()}),this.bugBarEl.querySelector("#btn-send-gif-chat")?.addEventListener("click",()=>{this.handleSendGifToChat()}),window.addEventListener("keydown",l=>{const c=l.target,y=c&&(c.tagName==="INPUT"||c.tagName==="TEXTAREA"||c.isContentEditable);if(l.code==="F8"||!y&&l.code==="Backquote"){this.runner.isRunning()&&(l.preventDefault(),l.stopPropagation(),this.runner.togglePause());return}if(!(y||!this.runner.isPaused())){if((l.metaKey||l.ctrlKey)&&l.key.toLowerCase()==="z"){l.preventDefault(),l.shiftKey?this.annotator.redo():this.annotator.undo();return}l.code==="KeyP"?(l.preventDefault(),this.selectAnnotationTool("pen")):l.code==="KeyA"?(l.preventDefault(),this.selectAnnotationTool("arrow")):l.code==="KeyB"?(l.preventDefault(),this.selectAnnotationTool("box")):l.code==="KeyT"?(l.preventDefault(),this.selectAnnotationTool("text")):l.code==="ArrowLeft"?(l.preventDefault(),this.scrubToDvrFrame(Math.max(0,this.activeDvrIndex-1))):l.code==="ArrowRight"&&(l.preventDefault(),this.scrubToDvrFrame(Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1)))}},{capture:!0})}async handleBuildAndRun(){if(this.isBuilding)return;const t=k().trim();if(!t){S.error("Missing Go Workspace Path","Enter the path to your Ebitengine Go workspace in the header bar before building.");return}this.isBuilding=!0,this.lastBuildFailure=null,this.setBuildButtonsLoading(!0);try{S.info(`Compiling Go WASM in "${t}" (${this.activePkg})...`,2500);const e=await st({workspace:t,pkg:this.activePkg});if(!e.ok){this.lastBuildFailure=e,this.showBuildErrorView(e),S.error("Go WASM Compilation Failed (HTTP 422)",e.compilerOutput.slice(0,240));return}this.showActiveGameStage(),await this.runner.launchBuild(e.buildId);const n=this.headerEl.querySelector("#btn-pause-toggle");n&&(n.disabled=!1);const s=(e.wasmBytes/(1024*1024)).toFixed(2);S.success(`Built & launched ${e.pkg} (${s} MB WASM in ${e.durationMs}ms)`),this.runner.focus()}catch(e){S.error("WASM Build / Launch Error",e?.message||String(e))}finally{this.isBuilding=!1,this.setBuildButtonsLoading(!1)}}handlePauseStateChanged(t){const e=this.headerEl.querySelector("#btn-pause-toggle"),n=this.headerEl.querySelector("#pause-btn-label");if(t){e&&(e.classList.add("btn-warning-active"),e.setAttribute("data-tooltip","Resume Gameplay (` or F8)"),e.setAttribute("title","Resume Gameplay (` or F8)")),n&&(n.textContent="▶️ Resume"),this.annotationBarEl.classList.remove("hidden"),this.annotationStageEl.classList.remove("hidden");const s=this.runner.getGameCanvas();if(s&&s.width>0&&s.height>0)this.annotator.loadBaseFromCanvas(s);else{const i=this.dvrBuffer.getLatestFrame();i&&this.annotator.loadBaseFrameDataUrl(i.dataUrl,i.width,i.height)}this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.updateFocusPillUI(!1)}else e&&(e.classList.remove("btn-warning-active"),e.setAttribute("data-tooltip","Freeze Frame & Annotate Bug (` or F8)"),e.setAttribute("title","Freeze Frame & Annotate Bug (` or F8)")),n&&(n.textContent="⏸️ Pause"),this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.runner.focus()}async scrubToDvrFrame(t){const e=this.dvrBuffer.getFrameAt(t);e&&(this.activeDvrIndex=e.index,this.updateDvrScrubberUI(),e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}updateDvrScrubberUI(){const t=this.annotationBarEl.querySelector("#dvr-scrubber-slider"),e=this.annotationBarEl.querySelector("#dvr-frame-badge"),n=this.annotationBarEl.querySelector("#btn-dvr-prev"),s=this.annotationBarEl.querySelector("#btn-dvr-next"),i=this.dvrBuffer.length;if(i===0){t&&(t.min="0",t.max="0",t.value="0",t.disabled=!0),e&&(e.textContent="0.0s",e.setAttribute("data-tooltip","Live (0.0s)"),e.setAttribute("title","Live (0.0s)")),n&&(n.disabled=!0),s&&(s.disabled=!0);return}const a=Math.max(0,Math.min(i-1,this.activeDvrIndex)),o=this.dvrBuffer.getFrameAt(a);if(t&&(t.disabled=!1,t.min="0",t.max=String(i-1),t.value=String(a)),n&&(n.disabled=a<=0),s&&(s.disabled=a>=i-1),e&&o){const d=o.relativeSec===0?"0.0s":`${o.relativeSec.toFixed(1)}s`,h=o.relativeSec===0?`Live (0.0s) · Frame ${a+1}/${i}`:`${o.relativeSec.toFixed(2)}s · Frame ${a+1}/${i}`;e.textContent=d,e.setAttribute("data-tooltip",h),e.setAttribute("title",h)}}selectAnnotationTool(t){this.annotator.setTool(t),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(n=>{const s=n.dataset.tool;n.classList.toggle("active",s===t)})}updateAnnotationControlsUI(){const t=this.annotationBarEl.querySelector("#btn-ann-undo"),e=this.annotationBarEl.querySelector("#btn-ann-redo"),n=this.annotationBarEl.querySelector("#btn-ann-clear");t&&(t.disabled=!this.annotator.canUndo()),e&&(e.disabled=!this.annotator.canRedo()),n&&(n.disabled=this.annotator.getShapes().length===0)}updateFocusPillUI(t){if(this.focusPillEl){if(this.runner.isPaused()){this.focusPillEl.className="focus-status-pill paused",this.focusPillEl.innerHTML="<span>⏸ Paused — Draw on Frame or Scrub 10s DVR</span>";return}t?(this.focusPillEl.className="focus-status-pill focused",this.focusPillEl.innerHTML="<span>● Controls Active (` or F8 to Pause)</span>"):(this.focusPillEl.className="focus-status-pill unfocused",this.focusPillEl.innerHTML="<span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>")}}updateLogsUI(t){const e=this.headerEl.querySelector("#logs-count-badge");e&&(e.textContent=String(t.length));const n=this.viewportEl.querySelector("#logs-drawer-content");n&&(n.textContent=t.length>0?t.join(`
`):"No WASM console output recorded yet.",n.scrollTop=n.scrollHeight)}showReadyStateView(){this.runner.destroy(),this.lastBuildFailure=null,this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.readyStateEl.classList.remove("hidden");const t=this.headerEl.querySelector("#btn-pause-toggle"),e=this.headerEl.querySelector("#pause-btn-label");t&&(t.disabled=!0,t.classList.remove("btn-warning-active")),e&&(e.textContent="⏸️ Pause"),this.updateHeaderInputsUI()}showActiveGameStage(){this.readyStateEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.gameStageEl.classList.remove("hidden")}showBuildErrorView(t){this.runner.destroy(),this.annotationBarEl.classList.add("hidden"),this.readyStateEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.remove("hidden");const e=this.viewportEl.querySelector("#error-state-title"),n=this.viewportEl.querySelector("#error-state-meta"),s=this.viewportEl.querySelector("#error-state-traceback");e&&(e.textContent=t.error||"Go WASM Compilation Failed"),n&&(n.textContent=`Workspace: ${t.workspace} | Package: ${t.pkg} | Exit Code: ${t.exitCode}`),s&&(s.textContent=t.compilerOutput)}showRuntimePanicView(t){const e=k()||".";this.lastBuildFailure={ok:!1,status:422,error:"Go WASM Runtime Panic",compilerOutput:[t,"",...this.runner.getConsoleLogs().slice(-30)].join(`
`),workspace:e,pkg:this.activePkg,exitCode:2},this.showBuildErrorView(this.lastBuildFailure)}async handleSendBuildErrorToChat(){if(!this.lastBuildFailure)return;const t=this.viewportEl.querySelector("#btn-send-build-error");t&&(t.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input")?.value.trim()||"";await at({buildError:this.lastBuildFailure.compilerOutput,note:n,workspace:this.lastBuildFailure.workspace,pkg:this.lastBuildFailure.pkg}),S.success("Sent Go WASM compiler traceback directly to Antigravity chat!")}catch(e){S.error("Failed to send build error to chat",e?.message||String(e))}finally{t&&(t.disabled=!1)}}async ensurePausedFrameLoaded(){if(this.runner.isRunning()&&!this.runner.isPaused()?this.runner.setPaused(!0):this.dvrBuffer.length===0&&(this.runner.syncDvrFromChild(),this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI()),!this.annotator.hasFrozenFrame()){const t=this.runner.getGameCanvas();if(t&&t.width>0&&t.height>0)this.annotator.loadBaseFromCanvas(t);else{const e=this.dvrBuffer.getLatestFrame();e&&(e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}}}decodeDataUrlToImage(t){return new Promise((e,n)=>{const s=new Image;s.onload=()=>e(s),s.onerror=()=>n(new Error("Failed to decode frame dataUrl into HTMLImageElement.")),s.src=t})}async buildDvrAnimatedGifDataUrl(){await this.ensurePausedFrameLoaded();const t=this.dvrBuffer.getFrames(),e=t.length>0?Math.max(0,Math.min(t.length-1,this.activeDvrIndex)):0,n=t.length>0?t.slice(0,e+1):[],s=this.annotator.getDimensions(),i=n[0]?.width||s.width||640,a=n[0]?.height||s.height||360;let o={x:0,y:0,width:i,height:a};const d=n[n.length-1]||n[0];if(d){const b=document.createElement("canvas");b.width=i,b.height=a;const g=b.getContext("2d",{willReadFrequently:!0});if(g){if(g.clearRect(0,0,i,a),d.canvas)g.drawImage(d.canvas,0,0,i,a);else if(d.dataUrl){const C=await this.decodeDataUrlToImage(d.dataUrl);g.drawImage(C,0,0,i,a)}const v=g.getImageData(0,0,i,a);o=$(v.data,i,a)}}const h=480,p=o.width>h?h/o.width:1,u=Math.max(64,Math.round(o.width*p)),f=Math.max(36,Math.round(o.height*p)),m=document.createElement("canvas");m.width=u,m.height=f;const l=m.getContext("2d",{willReadFrequently:!0});if(!l)throw new Error("Failed to acquire 2D context for GIF encoding.");l.imageSmoothingEnabled=!1;const c=[];for(let b=0;b<n.length;b++){const g=n[b];if(l.fillStyle="#090D16",l.fillRect(0,0,u,f),g.canvas)l.drawImage(g.canvas,o.x,o.y,o.width,o.height,0,0,u,f);else{const B=await this.decodeDataUrlToImage(g.dataUrl);l.drawImage(B,o.x,o.y,o.width,o.height,0,0,u,f)}const v=l.getImageData(0,0,u,f),C=b===n.length-1;let A=this.dvrBuffer.captureIntervalMs;if(b+1<n.length){const B=n[b+1].timestampMs-g.timestampMs;Number.isFinite(B)&&B>=15&&B<=250&&(A=Math.round(B))}c.push({rgba:new Uint8Array(v.data),delayMs:C?900:A})}if(c.length===0){const b=this.runner.getGameCanvas();if(l.fillStyle="#090D16",l.fillRect(0,0,u,f),b&&b.width>0&&b.height>0){const v=b.getContext("2d");if(v){const C=v.getImageData(0,0,b.width,b.height);o=$(C.data,b.width,b.height)}l.drawImage(b,o.x,o.y,o.width,o.height,0,0,u,f)}const g=l.getImageData(0,0,u,f);c.push({rgba:new Uint8Array(g.data),delayMs:900})}const y=ht({width:u,height:f,frames:c}),w=n.length>=2?(n[n.length-1].timestampMs-n[0].timestampMs)/1e3:n.length*this.dvrBuffer.captureIntervalMs/1e3,E=Number(Math.max(.04,w).toFixed(2));return{dataUrl:ut(y),width:u,height:f,frameCount:c.length,durationSec:E}}async handleSendGifToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}const t=this.bugBarEl.querySelector("#btn-send-gif-chat"),e=this.bugBarEl.querySelector("#btn-send-bug-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{S.info("Encoding 10s DVR replay (25 FPS) into animated GIF...",2400);const n=await this.buildDvrAnimatedGifDataUrl(),s=this.bugBarEl.querySelector("#bug-note-input"),i=this.bugBarEl.querySelector("#include-logs-checkbox"),a=s?.value.trim()||"",d=(i?i.checked:!0)?this.runner.getConsoleLogs():[],h=this.dvrBuffer.getFrameAt(this.activeDvrIndex),p=h?h.relativeSec===0?"live (0.0s)":`${h.relativeSec.toFixed(2)}s`:"live",u=`playtest-clip-${Date.now()}.gif`,f=await G({filename:u,imageDataUrl:n.dataUrl,note:a,consoleLogs:d,workspace:k()||".",pkg:this.activePkg,frameOffset:`${n.frameCount}f (${n.durationSec}s DVR → ${p})`,resolution:`${n.width}x${n.height}`,width:n.width,height:n.height});S.success(`Delivered 10s DVR GIF "${f.filename||u}" (${n.frameCount} frames) to chat!`),s&&(s.value="")}catch(n){S.error("Failed to encode or send 10s DVR GIF",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}async handleSendBugToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}await this.ensurePausedFrameLoaded();const t=this.bugBarEl.querySelector("#btn-send-bug-chat"),e=this.bugBarEl.querySelector("#btn-send-gif-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input"),s=this.bugBarEl.querySelector("#include-logs-checkbox"),i=n?.value.trim()||"",o=(s?s.checked:!0)?this.runner.getConsoleLogs():[],d=this.annotator.exportSmartComposite(),h=this.dvrBuffer.getFrameAt(this.activeDvrIndex),p=h?h.relativeSec===0?"live (0.0s)":`${h.relativeSec.toFixed(2)}s`:"live",u=`playtest-bug-${Date.now()}.png`,f=await G({filename:u,imageDataUrl:d.dataUrl,note:i,consoleLogs:o,workspace:k()||".",pkg:this.activePkg,frameOffset:p,resolution:`${d.width}x${d.height}`,width:d.width,height:d.height});S.success(`Delivered "${f.filename||u}" to Antigravity chat!`),n&&(n.value="")}catch(n){S.error("Failed to send bug report to chat",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}setBuildButtonsLoading(t){const e=this.headerEl.querySelector("#btn-build-run"),n=this.headerEl.querySelector("#build-btn-label"),s=this.viewportEl.querySelector("#btn-ready-build");e&&(e.disabled=t),s&&(s.disabled=t,s.innerHTML=t?"<span>⏳ Compiling &amp; Launching WASM...</span>":"<span>▶ Compile &amp; Launch Ebitengine WASM</span>"),n&&(n.textContent=t?"⏳ Building...":"🚀 Run")}updateHeaderInputsUI(){const t=k(),e=this.headerEl.querySelector("#workspace-input"),n=this.viewportEl.querySelector("#ready-workspace-input"),s=this.headerEl.querySelector("#pkg-input"),i=this.viewportEl.querySelector("#ready-pkg-input");e&&e.value!==t&&(e.value=t),n&&n.value!==t&&(n.value=t),s&&s.value!==this.activePkg&&(s.value=this.activePkg),i&&i.value!==this.activePkg&&(i.value=this.activePkg);const a=this.headerEl.querySelector("#btn-full-studio");a&&(a.href=R())}updateSessionBadgeUI(){const t=M(),e=this.headerEl.querySelector("#btn-session-badge"),n=this.headerEl.querySelector("#btn-full-studio");if(e){const s=e.querySelector(".status-dot"),i=e.querySelector("#session-badge-text");if(t&&t!=="standalone"){e.className="session-badge connected",s&&(s.className="status-dot online"),i&&(i.textContent=`${t.slice(0,8)}...`);const a=`Session: ${t.slice(0,8)}... (Click to switch)`;e.setAttribute("data-tooltip",a),e.setAttribute("title",a)}else{e.className="session-badge disconnected",s&&(s.className="status-dot offline"),i&&(i.textContent="Standalone");const a="Session: Standalone (Click to connect)";e.setAttribute("data-tooltip",a),e.setAttribute("title",a)}}n&&(n.href=R())}async openSessionSwitcherModal(){const t=document.getElementById("session-switcher-modal");t&&t.remove();const e=document.createElement("div");e.id="session-switcher-modal",e.className="modal-overlay",e.innerHTML=`
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
              value="${this.escapeAttr(M()||"")}"
            />
            <button type="button" id="btn-apply-session" class="btn btn-primary btn-sm">Connect</button>
          </div>
          <div id="recent-sessions-list" class="recent-sessions-list">
            <div class="session-loading">Loading recent Antigravity sessions...</div>
          </div>
        </div>
      </div>
    `;const n=()=>e.remove();e.querySelector("#session-modal-close")?.addEventListener("click",n),e.addEventListener("click",i=>{i.target===e&&n()}),e.querySelector("#btn-apply-session")?.addEventListener("click",()=>{const a=e.querySelector("#manual-session-input").value.trim();if(a)try{T(a),S.success(`Connected to session ${a}`),n()}catch(o){S.error("Invalid Session ID",o?.message||String(o))}}),document.body.appendChild(e);const s=e.querySelector("#recent-sessions-list");try{const i=await it();if(i.length===0){s.innerHTML='<div class="session-empty">No recent sessions found.</div>';return}s.innerHTML=i.map(a=>`
          <button type="button" class="session-item-btn" data-sid="${this.escapeAttr(a.id)}">
            <span class="session-item-id">${this.escapeHtml(a.id)}</span>
            <span class="session-item-time">${this.escapeHtml(new Date(a.updatedAt).toLocaleTimeString())}</span>
          </button>
        `).join(""),s.querySelectorAll(".session-item-btn").forEach(a=>{a.addEventListener("click",()=>{const o=a.dataset.sid;o&&(T(o),S.success(`Connected to session ${o.slice(0,8)}...`),n())})})}catch(i){s.innerHTML=`<div class="session-empty">Failed to load sessions: ${this.escapeHtml(i?.message||String(i))}</div>`}}escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}escapeAttr(t){return this.escapeHtml(t).replace(/'/g,"&#39;")}}function H(){try{const r=tt(),t=r==="preview"?"studio-mode-preview":"studio-mode-full";document.body.classList.remove("studio-mode-preview","studio-mode-full"),document.body.classList.add("studio-container",t),r==="preview"?document.body.classList.add("bg-transparent"):document.body.classList.remove("bg-transparent");const e=document.getElementById("app");e&&(e.classList.remove("studio-mode-preview","studio-mode-full"),e.classList.add("studio-container",t));const n=document.getElementById("app-root");n&&(n.classList.remove("studio-mode-preview","studio-mode-full"),n.classList.add("studio-container",t));const s=document.getElementById("header-bar"),i=document.getElementById("annotation-bar"),a=document.getElementById("viewport-container"),o=document.getElementById("bug-report-bar");if(!s||!i||!a||!o)throw new Error("Required DOM containers not found for Playtest Studio. Missing: "+[!s&&"#header-bar",!i&&"#annotation-bar",!a&&"#viewport-container",!o&&"#bug-report-bar"].filter(Boolean).join(", "));new yt({headerEl:s,annotationBarEl:i,viewportEl:a,bugBarEl:o}),console.log(`[Playtest Studio] Initialized in "${r}" mode`)}catch(r){console.error("[Playtest Studio] Initialization error:",r),S.fatal("Playtest Studio Initialization Failed",r)}}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",H,{once:!0}):H();window.addEventListener("error",r=>{console.error("[Playtest Studio] Uncaught Window Error:",r),S.fatal("Uncaught Runtime Error",r.error||r.message)});window.addEventListener("unhandledrejection",r=>{console.error("[Playtest Studio] Unhandled Promise Rejection:",r),S.fatal("Unhandled Promise Rejection",r.reason)});
