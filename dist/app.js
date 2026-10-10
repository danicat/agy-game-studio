(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(i){if(i.ep)return;i.ep=!0;const s=e(i);fetch(i.href,s)}})();let T=null,D=null;const N=[],H=[];function L(r){if(typeof r=="number"&&Number.isFinite(r))return!0;if(typeof r!="string")return!1;const t=r.trim();return t.length>0&&!(t.startsWith("__")&&t.endsWith("__"))}async function B(r,t={}){const e=r.startsWith("http://")||r.startsWith("https://")?r:`${q()}${r}`;return window.sidecar&&typeof window.sidecar.fetch=="function"?window.sidecar.fetch(e,t):fetch(e,t)}function q(){const r=window.__STUDIO_CONFIG__?.apiBaseUrl;return L(r)?String(r).trim().replace(/\/+$/,""):""}const P=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;function Y(){const r=window.sidecar?.conversationId?.trim();if(r&&P.test(r))return r;const t=new URLSearchParams(window.location.search),e=(t.get("conversationId")||t.get("session_id")||t.get("sessionId"))?.trim();if(e&&L(e)&&P.test(e))return e;const n=window.__STUDIO_CONFIG__?.sessionId;if(L(n)){const i=String(n).trim();if(P.test(i))return i}return""}function I(){return T===null&&(T=Y()),T}function F(){const r=I();return r||null}function V(r){const t=r.trim();if(!t||!P.test(t))throw new Error(`Invalid session_id "${r}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`);T=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.sessionId=t);for(const e of N)e(t)}function x(r){V(r)}function j(r){N.push(r)}function K(){const t=new URLSearchParams(window.location.search).get("workspace")?.trim();if(t&&L(t))return t;const e=window.__STUDIO_CONFIG__?.workspace;return L(e)?String(e).trim():""}function S(){return D===null&&(D=K()),D}function R(r){const t=r.trim();D=t,window.__STUDIO_CONFIG__&&(window.__STUDIO_CONFIG__.workspace=t);for(const e of H)e(t)}function J(r){H.push(r)}function Z(){return new URLSearchParams(window.location.search).get("mode")==="preview"||window.__STUDIO_CONFIG__?.mode==="preview"?"preview":"full"}function M(){const r=window.location.protocol==="http:"||window.location.protocol==="https:"?window.location.origin:q(),t=I()||"standalone",e=S(),n=new URLSearchParams({mode:"full",conversationId:t}),i=new URLSearchParams(window.location.search).get("token");return i&&n.set("token",i),e&&n.set("workspace",e),`${r}/?${n.toString()}`}async function Q(r){const t=await B("/api/workspace/resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceUri:r})});if(!t.ok){const e=await t.json().catch(()=>({}));throw new Error(e.error||`Failed to resolve workspace URI: HTTP ${t.status}`)}return await t.json()}async function tt(){const r=await B("/api/health",{method:"GET",cache:"no-store"});if(!r.ok)throw new Error(`Failed to fetch sidecar health: HTTP ${r.status} ${r.statusText}`);const t=await r.json();return t.activeSessionId&&!I()&&V(t.activeSessionId),t.defaultWorkspace&&!S()&&R(t.defaultWorkspace),t}async function et(){const r=await B("/api/sessions",{method:"GET",cache:"no-store"});if(!r.ok)throw new Error(`Failed to fetch recent sessions: HTTP ${r.status} ${r.statusText}`);const t=await r.json();return Array.isArray(t.sessions)?t.sessions:[]}async function nt(r){const t=r.workspace.trim();if(!t)throw new Error("Workspace path is required to compile Go WASM.");const e=r.pkg?.trim()||void 0,n=await B("/api/playtest/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:t,pkg:e})}),i=await n.text();let s={};if(i.trim())try{s=JSON.parse(i)}catch{throw new Error(`Unexpected non-JSON response from /api/playtest/build (HTTP ${n.status}): ${i.slice(0,300)}`)}if(n.status===422)return{ok:!1,status:422,error:s.error||"Go WASM compilation failed",compilerOutput:s.compilerOutput||s.stderr||s.error||i,workspace:s.workspace||t,pkg:s.pkg||e||".",exitCode:typeof s.exitCode=="number"?s.exitCode:1};if(!n.ok)throw new Error(s.error||`WASM build request failed with HTTP ${n.status} ${n.statusText}`);return{ok:!0,status:200,buildId:s.buildId,workspace:s.workspace||t,pkg:s.pkg||e||".",wasmBytes:s.wasmBytes??0,durationMs:s.durationMs??0,wasmUrl:s.wasmUrl||`/api/playtest/wasm?buildId=${encodeURIComponent(s.buildId)}`,wasmExecUrl:s.wasmExecUrl||"/api/playtest/wasm_exec.js"}}async function $(r){const t=r.sessionId||window.sidecar?.conversationId||I()||"standalone",e=r.workspace||S(),n=r.pkg||".",i=r.filename||`playtest-bug-${Date.now()}.png`,s=await B("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,filename:i,image:r.imageDataUrl,note:r.note||"",consoleLogs:r.consoleLogs||[],workspace:e,pkg:n,metadata:{workspace:e,pkg:n,frameOffset:r.frameOffset??"live",resolution:r.resolution||(r.width&&r.height?`${r.width}x${r.height}`:"canvas"),width:r.width,height:r.height}})}),a=await s.text();let o={};try{o=a?JSON.parse(a):{}}catch{o={error:a}}if(!s.ok)throw new Error(o.error||`Failed to send bug report to chat: HTTP ${s.status} ${s.statusText}`);return o}async function it(r){const t=r.sessionId||window.sidecar?.conversationId||I()||"standalone",e=r.workspace||S(),n=r.pkg||".",i=await B("/api/send-to-chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:t,buildError:r.buildError,note:r.note||"",workspace:e,pkg:n,metadata:{workspace:e,pkg:n}})}),s=await i.text();let a={};try{a=s?JSON.parse(s):{}}catch{a={error:s}}if(!i.ok)throw new Error(a.error||`Failed to send build error to chat: HTTP ${i.status} ${i.statusText}`);return a}class st{maxFrames;captureIntervalMs;slots;writePtr=0;count=0;sequence=0;lastCaptureTimeMs=-1/0;constructor(t=250,e=40){if(!Number.isInteger(t)||t<1)throw new Error(`[FrameDvrBuffer] Invalid maxFrames=${t}. Must be a positive integer.`);if(!Number.isFinite(e)||e<1)throw new Error(`[FrameDvrBuffer] Invalid captureIntervalMs=${e}. Must be a positive number.`);this.maxFrames=t,this.captureIntervalMs=e,this.slots=new Array(t).fill(null)}get length(){return this.count}shouldCapture(t){return t-this.lastCaptureTimeMs>=this.captureIntervalMs}recordFrame(t,e=performance.now()){if(!t||typeof t.toDataURL!="function"||typeof t.width!="number"||typeof t.height!="number")throw new Error("[FrameDvrBuffer] recordFrame requires a valid canvas element with width, height, and toDataURL().");if(t.width<=0||t.height<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${t.width}x${t.height}).`);const n=t.toDataURL("image/png");return this.recordFrameDataUrl(n,t.width,t.height,e)}recordFrameDataUrl(t,e,n,i=performance.now()){if(typeof t!="string"||!t.startsWith("data:image/"))throw new Error("[FrameDvrBuffer] Canvas toDataURL() did not return a valid image data URI.");if(!Number.isFinite(e)||!Number.isFinite(n)||e<=0||n<=0)throw new Error(`[FrameDvrBuffer] Cannot record frame from zero-sized canvas (${e}x${n}).`);const s=++this.sequence,a={frameNumber:s,timestampMs:i,width:e,height:n,dataUrl:t};return this.slots[this.writePtr]=a,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=i,{index:this.count-1,frameNumber:s,timestampMs:i,relativeSec:0,width:a.width,height:a.height,dataUrl:a.dataUrl}}recordCanvasSlot(t,e,n,i){const a={frameNumber:++this.sequence,timestampMs:i,width:e,height:n,dataUrl:"",canvas:t};this.slots[this.writePtr]=a,this.writePtr=(this.writePtr+1)%this.maxFrames,this.count<this.maxFrames&&this.count++,this.lastCaptureTimeMs=i}recordFrameIfDue(t,e=performance.now()){return this.shouldCapture(e)?this.recordFrame(t,e):null}createDvrFrameFromSlot(t,e,n){return{index:e,frameNumber:t.frameNumber,timestampMs:t.timestampMs,relativeSec:n,width:t.width,height:t.height,canvas:t.canvas,get dataUrl(){return!t.dataUrl&&t.canvas&&(t.dataUrl=t.canvas.toDataURL("image/png")),t.dataUrl}}}getFrames(){if(this.count===0)return[];const t=this.count<this.maxFrames?0:this.writePtr,e=(t+this.count-1)%this.maxFrames,n=this.slots[e],i=n?n.timestampMs:0,s=new Array(this.count);for(let a=0;a<this.count;a++){const o=(t+a)%this.maxFrames,d=this.slots[o],c=(d.timestampMs-i)/1e3,u=c===0?0:Number(c.toFixed(2));s[a]=this.createDvrFrameFromSlot(d,a,u)}return s}getFrameAt(t){if(!Number.isInteger(t)||t<0||t>=this.count)return null;const e=this.count<this.maxFrames?0:this.writePtr,n=(e+t)%this.maxFrames,i=this.slots[n];if(!i)return null;const s=(e+this.count-1)%this.maxFrames,a=this.slots[s],o=a?a.timestampMs:i.timestampMs,d=(i.timestampMs-o)/1e3,c=d===0?0:Number(d.toFixed(2));return this.createDvrFrameFromSlot(i,t,c)}getLatestFrame(){return this.count===0?null:this.getFrameAt(this.count-1)}clear(){this.slots.fill(null),this.writePtr=0,this.count=0,this.lastCaptureTimeMs=-1/0}}const z=[{name:"Red",hex:"#EF4444"},{name:"Yellow",hex:"#FACC15"},{name:"Cyan",hex:"#06B6D4"},{name:"Lime",hex:"#22C55E"},{name:"White",hex:"#FFFFFF"}];function at(r,t){const e=r.replace(/^#/,"").trim();if(e.length===3){const n=parseInt(e[0]+e[0],16),i=parseInt(e[1]+e[1],16),s=parseInt(e[2]+e[2],16);return`rgba(${n}, ${i}, ${s}, ${t})`}if(e.length===6){const n=parseInt(e.slice(0,2),16),i=parseInt(e.slice(2,4),16),s=parseInt(e.slice(4,6),16);return`rgba(${n}, ${i}, ${s}, ${t})`}return`rgba(239, 68, 68, ${t})`}function X(r){return r.type==="pen"?{...r,points:r.points.map(t=>({x:t.x,y:t.y}))}:{...r}}function k(r){return r.map(X)}class ot{baseCanvas;overlayCanvas;onHistoryChange;activeTool="box";activeColor=z[0].hex;strokeWidth=3;shapes=[];undoStack=[];redoStack=[];isDrawing=!1;draftShape=null;shapeCounter=0;activeTextInputEl=null;width;height;hasBaseSnapshot=!1;constructor(t={}){this.baseCanvas=t.baseCanvas??null,this.overlayCanvas=t.overlayCanvas??null,this.onHistoryChange=t.onHistoryChange??null,this.width=t.width??(this.baseCanvas?.width||640),this.height=t.height??(this.baseCanvas?.height||360),this.baseCanvas&&(this.baseCanvas.width=this.width,this.baseCanvas.height=this.height),this.overlayCanvas&&(this.overlayCanvas.width=this.width,this.overlayCanvas.height=this.height,this.bindPointerEvents(this.overlayCanvas))}getTool(){return this.activeTool}setTool(t){this.commitOrCloseActiveTextInput(),this.activeTool=t}getColor(){return this.activeColor}setColor(t){if(!t||typeof t!="string")throw new Error("[BugAnnotator] Invalid color value.");this.activeColor=t}getDimensions(){return{width:this.width,height:this.height}}setDimensions(t,e){if(t<=0||e<=0)throw new Error(`[BugAnnotator] Invalid dimensions: ${t}x${e}`);this.width=t,this.height=e,this.baseCanvas&&(this.baseCanvas.width!==t||this.baseCanvas.height!==e)&&(this.baseCanvas.width=t,this.baseCanvas.height=e),this.overlayCanvas&&(this.overlayCanvas.width!==t||this.overlayCanvas.height!==e)&&(this.overlayCanvas.width=t,this.overlayCanvas.height=e),this.renderOverlay()}getShapes(){return k(this.shapes)}canUndo(){return this.undoStack.length>0}canRedo(){return this.redoStack.length>0}addShape(t){this.undoStack.push(k(this.shapes)),this.redoStack=[],this.shapes.push(X(t)),this.renderOverlay(),this.notifyHistoryChange()}addTextAnnotation(t,e,n){const i=n.trim();if(!i)return null;const s={id:this.nextShapeId(),type:"text",color:this.activeColor,x:Math.round(t),y:Math.round(e),text:i};return this.addShape(s),s}undo(){if(this.undoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.redoStack.push(k(this.shapes));const t=this.undoStack.pop();return this.shapes=k(t),this.renderOverlay(),this.notifyHistoryChange(),!0}redo(){if(this.redoStack.length===0)return!1;this.commitOrCloseActiveTextInput(),this.undoStack.push(k(this.shapes));const t=this.redoStack.pop();return this.shapes=k(t),this.renderOverlay(),this.notifyHistoryChange(),!0}clearAnnotations(){this.commitOrCloseActiveTextInput(),this.shapes.length!==0&&(this.undoStack.push(k(this.shapes)),this.redoStack=[],this.shapes=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange())}resetHistory(){this.commitOrCloseActiveTextInput(),this.shapes=[],this.undoStack=[],this.redoStack=[],this.draftShape=null,this.renderOverlay(),this.notifyHistoryChange()}loadBaseFromCanvas(t){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to receive snapshot.");t.width>0&&t.height>0&&this.setDimensions(t.width,t.height);const e=this.baseCanvas.getContext("2d");if(!e)throw new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas.");e.clearRect(0,0,this.width,this.height),e.drawImage(t,0,0,this.width,this.height),this.hasBaseSnapshot=!0,this.renderOverlay()}loadBaseFrameDataUrl(t,e,n){if(!this.baseCanvas)throw new Error("[BugAnnotator] No baseCanvas configured to load frame data URL.");if(!t||!t.startsWith("data:image/"))throw new Error("[BugAnnotator] Invalid image dataUrl passed to loadBaseFrameDataUrl.");return new Promise((i,s)=>{const a=new Image;a.onload=()=>{const o=e&&e>0?e:a.naturalWidth||this.width,d=n&&n>0?n:a.naturalHeight||this.height;this.setDimensions(o,d);const c=this.baseCanvas.getContext("2d");if(!c){s(new Error("[BugAnnotator] Failed to acquire 2D context on baseCanvas."));return}c.clearRect(0,0,o,d),c.drawImage(a,0,0,o,d),this.hasBaseSnapshot=!0,this.renderOverlay(),i()},a.onerror=()=>{s(new Error("[BugAnnotator] Failed to decode DVR frame dataUrl into Image."))},a.src=t})}hasFrozenFrame(){return this.hasBaseSnapshot}renderOverlay(){if(!this.overlayCanvas)return;const t=this.overlayCanvas.getContext("2d");if(t){t.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);for(const e of this.shapes)this.renderShape(t,e);this.draftShape&&this.renderShape(t,this.draftShape)}}renderShape(t,e){if(t.save(),e.type==="pen"){if(e.points.length>0){t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.lineJoin="round",t.moveTo(e.points[0].x,e.points[0].y);for(let n=1;n<e.points.length;n++)t.lineTo(e.points[n].x,e.points[n].y);e.points.length===1&&t.lineTo(e.points[0].x+.5,e.points[0].y+.5),t.stroke()}}else if(e.type==="arrow"){const n=e.endX-e.startX,i=e.endY-e.startY;if(Math.hypot(n,i)>=2){const a=Math.atan2(i,n),o=Math.max(12,e.strokeWidth*4.5),d=Math.PI/6.5,c=e.endX-o*Math.cos(a-d),u=e.endY-o*Math.sin(a-d),p=e.endX-o*Math.cos(a+d),g=e.endY-o*Math.sin(a+d);t.beginPath(),t.strokeStyle="rgba(0, 0, 0, 0.72)",t.lineWidth=e.strokeWidth+2.5,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(a),e.endY-o*.55*Math.sin(a)),t.stroke(),t.beginPath(),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.lineCap="round",t.moveTo(e.startX,e.startY),t.lineTo(e.endX-o*.55*Math.cos(a),e.endY-o*.55*Math.sin(a)),t.stroke(),t.beginPath(),t.moveTo(e.endX,e.endY),t.lineTo(c,u),t.lineTo(p,g),t.closePath(),t.fillStyle=e.color,t.strokeStyle="rgba(0, 0, 0, 0.75)",t.lineWidth=1.5,t.stroke(),t.fill()}}else if(e.type==="box"){const n=e.width>=0?e.x:e.x+e.width,i=e.height>=0?e.y:e.y+e.height,s=Math.abs(e.width),a=Math.abs(e.height);(s>=1||a>=1)&&(t.fillStyle=at(e.color,.14),t.fillRect(n,i,s,a),t.strokeStyle="rgba(0, 0, 0, 0.7)",t.lineWidth=e.strokeWidth+2,t.strokeRect(n,i,s,a),t.strokeStyle=e.color,t.lineWidth=e.strokeWidth,t.strokeRect(n,i,s,a))}else if(e.type==="text"){const n='600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';t.font=n;const i=t.measureText(e.text),s=8,a=5,o=Math.ceil(i.width)+s*2,d=24,c=Math.max(4,Math.min(this.width-o-4,e.x)),u=Math.max(4,Math.min(this.height-d-4,e.y-d/2));t.fillStyle="rgba(9, 13, 22, 0.9)",t.strokeStyle=e.color,t.lineWidth=2,t.beginPath(),typeof t.roundRect=="function"?t.roundRect(c,u,o,d,6):t.rect(c,u,o,d),t.fill(),t.stroke(),t.fillStyle="#FFFFFF",t.textBaseline="middle",t.fillText(e.text,c+s,u+d/2+a*.05)}t.restore()}exportCompositeDataUrl(t){const e=t??(typeof document<"u"?document.createElement("canvas"):null);if(!e)throw new Error("[BugAnnotator] Cannot export composite image without a DOM document or customOffscreenCanvas.");e.width=this.width,e.height=this.height;const n=e.getContext("2d");if(!n)throw new Error("[BugAnnotator] Failed to acquire 2D context for composite export.");this.baseCanvas?n.drawImage(this.baseCanvas,0,0,this.width,this.height):(n.fillStyle="#090D16",n.fillRect(0,0,this.width,this.height));for(const i of this.shapes)this.renderShape(n,i);return e.toDataURL("image/png")}bindPointerEvents(t){const e=i=>{const s=t.getBoundingClientRect(),a=s.width>0?t.width/s.width:1,o=s.height>0?t.height/s.height:1;return{x:(i.clientX-s.left)*a,y:(i.clientY-s.top)*o}};t.addEventListener("pointerdown",i=>{if(i.button!==0)return;i.preventDefault();const s=e(i);if(this.activeTool==="text"){this.openInlineTextInput(s.x,s.y,i.clientX,i.clientY);return}this.commitOrCloseActiveTextInput(),this.isDrawing=!0;try{t.setPointerCapture(i.pointerId)}catch{}const a=this.nextShapeId();this.activeTool==="pen"?this.draftShape={id:a,type:"pen",color:this.activeColor,strokeWidth:this.strokeWidth,points:[s]}:this.activeTool==="arrow"?this.draftShape={id:a,type:"arrow",color:this.activeColor,strokeWidth:this.strokeWidth,startX:s.x,startY:s.y,endX:s.x,endY:s.y}:this.activeTool==="box"&&(this.draftShape={id:a,type:"box",color:this.activeColor,strokeWidth:this.strokeWidth,x:s.x,y:s.y,width:0,height:0}),this.renderOverlay()}),t.addEventListener("pointermove",i=>{if(!this.isDrawing||!this.draftShape)return;const s=e(i);this.draftShape.type==="pen"?this.draftShape.points.push(s):this.draftShape.type==="arrow"?(this.draftShape.endX=s.x,this.draftShape.endY=s.y):this.draftShape.type==="box"&&(this.draftShape.width=s.x-this.draftShape.x,this.draftShape.height=s.y-this.draftShape.y),this.renderOverlay()});const n=i=>{if(!this.isDrawing||!this.draftShape)return;this.isDrawing=!1;try{t.hasPointerCapture(i.pointerId)&&t.releasePointerCapture(i.pointerId)}catch{}const s=this.draftShape;if(this.draftShape=null,s.type==="arrow"){if(Math.hypot(s.endX-s.startX,s.endY-s.startY)<4){this.renderOverlay();return}}else if(s.type==="box"&&Math.abs(s.width)<3&&Math.abs(s.height)<3){this.renderOverlay();return}this.addShape(s)};t.addEventListener("pointerup",n),t.addEventListener("pointercancel",n)}openInlineTextInput(t,e,n,i){if(this.commitOrCloseActiveTextInput(),!this.overlayCanvas||!this.overlayCanvas.parentElement)return;const s=this.overlayCanvas.parentElement,a=s.getBoundingClientRect(),o=document.createElement("input");o.type="text",o.className="annotation-inline-text-input",o.placeholder="Type bug label & press Enter...",o.style.position="absolute",o.style.left=`${Math.max(8,Math.min(a.width-180,n-a.left))}px`,o.style.top=`${Math.max(8,Math.min(a.height-34,i-a.top-14))}px`,o.style.zIndex="50",o.style.background="rgba(9, 13, 22, 0.95)",o.style.color="#FFFFFF",o.style.border=`2px solid ${this.activeColor}`,o.style.borderRadius="6px",o.style.padding="4px 8px",o.style.fontSize="12px",o.style.fontWeight="600",o.style.outline="none",o.style.minWidth="160px",o.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.45)";let d=!1;const c=()=>{if(d)return;d=!0;const p=o.value.trim();o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null),p&&this.addTextAnnotation(t,e,p)},u=()=>{d||(d=!0,o.parentElement&&o.remove(),this.activeTextInputEl===o&&(this.activeTextInputEl=null))};o.addEventListener("keydown",p=>{p.stopPropagation(),p.key==="Enter"?(p.preventDefault(),c()):p.key==="Escape"&&(p.preventDefault(),u())}),o.addEventListener("blur",()=>{c()}),this.activeTextInputEl=o,s.appendChild(o),requestAnimationFrame(()=>o.focus())}commitOrCloseActiveTextInput(){this.activeTextInputEl&&(this.activeTextInputEl.blur(),this.activeTextInputEl=null)}nextShapeId(){return`ann-${++this.shapeCounter}-${Date.now()}`}notifyHistoryChange(){this.onHistoryChange&&this.onHistoryChange()}}const O=200,G=15e3;class rt{container;dvrBuffer;callbacks;iframe=null;currentRunnerId=0;activeMessageHandler=null;paused=!1;muted=!1;focused=!1;running=!1;consoleLogs=[];constructor(t,e,n={}){this.container=t,this.dvrBuffer=e,this.callbacks=n}isRunning(){return this.running}isPaused(){return this.paused}isMuted(){return this.muted}isFocused(){return this.focused}getConsoleLogs(){return[...this.consoleLogs]}clearConsoleLogs(){this.consoleLogs=[]}getGameCanvas(){try{const t=this.iframe?.contentWindow?.document;return t?this.iframe?.contentWindow?.__ACTIVE_GAME_CANVAS__||t.querySelector("canvas"):null}catch{return null}}async launchBuild(t){if(!t||typeof t!="string")throw new Error("[WasmRunner] launchBuild requires a non-empty buildId.");this.destroy(),this.dvrBuffer.clear(),this.clearConsoleLogs(),this.paused=!1,this.callbacks.onStateChange?.("loading"),await this.mountSidecarRunnerIframe({buildId:t})}postToChild(t){this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage({source:"playtest-runner-parent",runnerId:this.currentRunnerId,...t},"*")}mountSidecarRunnerIframe(t){return new Promise((e,n)=>{const i=++this.currentRunnerId;let s=!1;const a=window.setTimeout(()=>{s||(s=!0,this.callbacks.onStateChange?.("error"),n(new Error(`[WasmRunner] Timed out after ${G}ms waiting for sidecar runner iframe (/api/playtest/runner) to initialize.`)))},G),o=m=>{const l=m.data;if(!(!l||l.source!=="playtest-runner-child"||l.runnerId!==i))switch(l.type){case"READY":{this.running=!0,this.callbacks.onStateChange?.("running"),s||(s=!0,window.clearTimeout(a),e());break}case"FRAME":{if(typeof l.dataUrl=="string"&&typeof l.width=="number"&&typeof l.height=="number"&&l.width>0&&l.height>0)try{this.dvrBuffer.recordFrameDataUrl(l.dataUrl,l.width,l.height,l.timestampMs??performance.now()),this.callbacks.onFrameRecorded?.()}catch(h){console.error("[WasmRunner] Frame DVR capture error:",h)}break}case"LOG":{const h=l.level||"log";this.appendLog(h,l.text||"");break}case"PANIC":{const h=l.message||"Unknown Go WASM runtime error";this.appendLog("error",h),this.callbacks.onPanic?.(h,this.getConsoleLogs()),s||(s=!0,window.clearTimeout(a),n(new Error(h)));break}case"TOGGLE_PAUSE":{this.togglePause();break}case"FOCUS_CHANGE":{const h=!!l.focused;this.focused=h,this.callbacks.onFocusChange?.(h);break}}};this.activeMessageHandler=o,window.addEventListener("message",o);const d=q(),c=new URLSearchParams({runnerId:String(i),muted:this.muted?"1":"0",captureIntervalMs:String(this.dvrBuffer.captureIntervalMs),buildId:t.buildId}),u=new URLSearchParams(window.location.search).get("token");u&&c.set("token",u);const p=`${d}/api/playtest/runner?${c.toString()}`,g=document.createElement("iframe");g.className="wasm-runner-iframe",g.setAttribute("title","Ebitengine Playtest Viewport"),g.src=p,this.container.innerHTML="",this.container.appendChild(g),this.iframe=g})}syncDvrFromChild(){try{const t=this.iframe?.contentWindow;if(!t||typeof t.__PLAYTEST_GET_DVR_FRAMES__!="function")return;const e=t.__PLAYTEST_GET_DVR_FRAMES__();if(!Array.isArray(e)||e.length===0)return;this.dvrBuffer.clear();for(let n=0;n<e.length;n++){const i=e[n];i&&i.canvas&&i.width>0&&i.height>0&&this.dvrBuffer.recordCanvasSlot(i.canvas,i.width,i.height,i.timestampMs)}}catch{}}captureImmediateFrame(){this.running&&(this.postToChild({type:"CAPTURE_NOW"}),this.syncDvrFromChild())}setPaused(t){!this.running||this.paused===t||(this.paused=t,this.postToChild({type:"SET_PAUSED",paused:t}),t&&this.syncDvrFromChild(),this.callbacks.onPauseChange?.(t),this.callbacks.onStateChange?.(t?"paused":"running"))}togglePause(){return this.running?(this.setPaused(!this.paused),this.paused):!1}setMuted(t){this.muted=t,this.postToChild({type:"SET_MUTED",muted:t})}toggleMuted(){return this.setMuted(!this.muted),this.muted}focus(){try{this.iframe?.contentWindow?.focus()}catch{}this.postToChild({type:"FOCUS_GAME"})}dispatchVirtualKey(t,e,n){this.postToChild({type:"DISPATCH_KEY",code:t,key:e,keyEventType:n})}destroy(){this.activeMessageHandler&&(window.removeEventListener("message",this.activeMessageHandler),this.activeMessageHandler=null),this.running=!1,this.paused=!1,this.focused=!1,this.iframe&&(this.iframe.src="about:blank",this.iframe.remove(),this.iframe=null),this.container.innerHTML="",this.callbacks.onFocusChange?.(!1)}appendLog(t,e){const i=`[${new Date().toISOString().slice(11,23)}] [${t.toUpperCase()}] ${e}`;this.consoleLogs.push(i),this.consoleLogs.length>O&&this.consoleLogs.splice(0,this.consoleLogs.length-O),this.callbacks.onLog?.(t,i,this.getConsoleLogs())}}function lt(){const r=new Uint8Array(768);let t=0;const e=(a,o,d)=>{t>=256||(r[t*3]=a,r[t*3+1]=o,r[t*3+2]=d,t++)},n=[0,51,102,153,204,255];for(let a=0;a<6;a++)for(let o=0;o<6;o++)for(let d=0;d<6;d++)e(n[a],n[o],n[d]);for(let a=0;a<24;a++){const o=Math.round(8+a*238/23);e(o,o,o)}const i=[[239,68,68],[250,204,21],[6,182,212],[34,197,94],[255,255,255],[9,13,22],[11,15,26],[16,23,38],[20,12,14],[56,189,248],[244,63,94],[168,85,247],[16,185,129],[245,158,11],[99,102,241],[236,72,153]];for(const[a,o,d]of i)e(a,o,d);const s=new Uint8Array(32768);for(let a=0;a<32;a++){const o=a<<3|a>>2;for(let d=0;d<32;d++){const c=d<<3|d>>2;for(let u=0;u<32;u++){const p=u<<3|u>>2;let g=0,m=1/0;for(let l=0;l<256;l++){const h=r[l*3],f=r[l*3+1],w=r[l*3+2],b=o-h,v=c-f,E=p-w,A=b*b*2+v*v*4+E*E;if(A<m&&(m=A,g=l,A===0))break}s[a<<10|d<<5|u]=g}}}return{palette:r,lut15:s}}let U=null;function dt(){return U||(U=lt()),U}class ct{buf;length=0;constructor(t=262144){this.buf=new Uint8Array(t)}ensure(t){const e=this.length+t;if(e<=this.buf.length)return;let n=this.buf.length*2;for(;n<e;)n*=2;const i=new Uint8Array(n);i.set(this.buf.subarray(0,this.length)),this.buf=i}writeByte(t){this.ensure(1),this.buf[this.length++]=t&255}writeUint16LE(t){this.ensure(2),this.buf[this.length++]=t&255,this.buf[this.length++]=t>>8&255}writeBytes(t){this.ensure(t.length),this.buf.set(t,this.length),this.length+=t.length}writeAscii(t){this.ensure(t.length);for(let e=0;e<t.length;e++)this.buf[this.length++]=t.charCodeAt(e)&255}toUint8Array(){return this.buf.slice(0,this.length)}}function ut(r,t,e){r.writeByte(8);let a=9,o=258,d=(1<<a)-1;e.fill(-1);const c=new Uint8Array(255);let u=0,p=0,g=0;const m=()=>{u>0&&(r.writeByte(u),r.writeBytes(c.subarray(0,u)),u=0)},l=h=>{for(p|=h<<g,g+=a;g>=8;)c[u++]=p&255,u===255&&m(),p>>=8,g-=8};if(l(256),t.length>0){let h=t[0];for(let f=1;f<t.length;f++){const w=t[f],b=h<<8|w,v=e[b];v!==-1?h=v:(l(h),o<4096?(e[b]=o,o>d&&a<12&&(a++,d=(1<<a)-1),o++):(l(256),e.fill(-1),a=9,o=258,d=(1<<a)-1),h=w)}l(h)}l(257),g>0&&(c[u++]=p&255),m(),r.writeByte(0)}function ht(r){const{width:t,height:e,frames:n}=r;if(!Number.isInteger(t)||!Number.isInteger(e)||t<=0||e<=0)throw new Error(`[GifEncoder] Invalid GIF dimensions: ${t}x${e}.`);if(!Array.isArray(n)||n.length===0)throw new Error("[GifEncoder] encodeAnimatedGif requires at least 1 frame.");const i=t*e*4;for(let p=0;p<n.length;p++){const g=n[p];if(!g||!g.rgba||g.rgba.length!==i)throw new Error(`[GifEncoder] Frame ${p} RGBA length (${g?.rgba?.length??0}) does not match ${t}x${e}x4 (${i}).`)}const{palette:s,lut15:a}=dt(),o=new ct(Math.max(65536,t*e*Math.min(n.length,8)));o.writeAscii("GIF89a"),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(247),o.writeByte(0),o.writeByte(0),o.writeBytes(s),o.writeBytes([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);const d=t*e,c=new Uint8Array(d),u=new Int32Array(4096*256);for(let p=0;p<n.length;p++){const g=n[p],m=g.rgba,l=Math.max(2,Math.round((g.delayMs||66)/10));for(let h=0,f=0;h<d;h++,f+=4){const w=m[f]>>3,b=m[f+1]>>3,v=m[f+2]>>3;c[h]=a[w<<10|b<<5|v]}o.writeBytes([33,249,4,0]),o.writeUint16LE(l),o.writeBytes([0,0]),o.writeByte(44),o.writeUint16LE(0),o.writeUint16LE(0),o.writeUint16LE(t),o.writeUint16LE(e),o.writeByte(0),ut(o,c,u)}return o.writeByte(59),o.toUint8Array()}function pt(r){const e=[];for(let i=0;i<r.length;i+=32768){const s=r.subarray(i,i+32768);e.push(String.fromCharCode(...s))}const n=e.join("");return`data:image/gif;base64,${btoa(n)}`}class y{static container=null;static getContainer(){return this.container||(this.container=document.createElement("div"),this.container.className="notification-container",document.body.appendChild(this.container)),this.container}static show(t,e="info",n=4e3,i){const s=this.getContainer(),a=document.createElement("div");a.className=`notification-toast toast-${e}`;const o=document.createElement("span");o.className="toast-icon",o.textContent=e==="success"?"✓":e==="error"?"⚠️":"ℹ";const d=document.createElement("div");d.className="toast-message";const c=document.createElement("div");if(c.className="toast-title",c.textContent=t,d.appendChild(c),i){const p=document.createElement("pre");p.className="toast-detail",p.textContent=i,d.appendChild(p)}const u=document.createElement("button");u.className="toast-close",u.textContent="✕",u.title="Dismiss",u.onclick=()=>a.remove(),a.appendChild(o),a.appendChild(d),a.appendChild(u),s.appendChild(a),n>0&&setTimeout(()=>{a.classList.add("toast-fade-out"),setTimeout(()=>a.remove(),280)},n)}static info(t,e=3e3){this.show(t,"info",e)}static success(t,e=3800){this.show(t,"success",e)}static error(t,e){console.error("[Playtest Studio Error]",t,e||""),this.show(t,"error",0,e)}static fatal(t,e,n){console.error("[Playtest Studio FATAL]",t,e,n??"");const i=document.getElementById("fatal-error-overlay");i&&i.remove();const s=document.createElement("div");s.id="fatal-error-overlay",s.className="modal-overlay fatal-overlay",s.setAttribute("role","alertdialog"),s.setAttribute("aria-modal","true");const a=e instanceof Error?`${e.name}: ${e.message}`:String(e),o=e instanceof Error&&e.stack?e.stack:"",d=[n?`[Context] ${n}`:"",a,o&&o!==a?o:""].filter(Boolean).join(`

`);s.innerHTML=`
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
    `;const c=s.querySelector(".fatal-title");c&&(c.textContent=t);const u=s.querySelector(".fatal-pre");u&&(u.textContent=d);const p=()=>{window.removeEventListener("keydown",g),s.remove()},g=m=>{m.key==="Escape"&&(m.preventDefault(),p())};window.addEventListener("keydown",g),s.querySelector("#fatal-reload-btn")?.addEventListener("click",()=>{window.location.reload()}),s.querySelector("#fatal-dismiss-btn")?.addEventListener("click",p),document.body.appendChild(s)}}class gt{headerEl;annotationBarEl;viewportEl;bugBarEl;dvrBuffer;annotator;runner;activePkg=".";activeDvrIndex=0;keypadVisible=!1;logsDrawerVisible=!1;isBuilding=!1;lastBuildFailure=null;runnerMountEl;annotationStageEl;readyStateEl;errorStateEl;gameStageEl;focusPillEl;keypadOverlayEl;logsDrawerEl;constructor(t){this.headerEl=t.headerEl,this.annotationBarEl=t.annotationBarEl,this.viewportEl=t.viewportEl,this.bugBarEl=t.bugBarEl,this.dvrBuffer=new st(250,40),this.renderHeader(),this.renderAnnotationBar(),this.renderViewport(),this.renderBugReportBar();const e=this.viewportEl.querySelector("#annotation-base-canvas"),n=this.viewportEl.querySelector("#annotation-overlay-canvas");this.annotator=new ot({baseCanvas:e,overlayCanvas:n,width:640,height:360,onHistoryChange:()=>this.updateAnnotationControlsUI()}),this.runner=new rt(this.runnerMountEl,this.dvrBuffer,{onFrameRecorded:()=>{if(this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.runner.isPaused()&&this.annotator.getShapes().length===0){const i=this.dvrBuffer.getLatestFrame();i&&this.annotator.loadBaseFrameDataUrl(i.dataUrl,i.width,i.height)}},onPauseChange:i=>{this.handlePauseStateChanged(i)},onFocusChange:i=>{this.updateFocusPillUI(i)},onLog:(i,s,a)=>{this.updateLogsUI(a)},onPanic:(i,s)=>{this.updateLogsUI(s),this.showRuntimePanicView(i)}}),this.bindEvents(),this.syncSessionAndWorkspaceFromServer()}async applyWorkspaceUri(t){if(!t||!t.trim())return!1;try{const e=await Q(t);return e.workspace&&R(e.workspace),e.pkg&&(this.activePkg=e.pkg),this.updateHeaderInputsUI(),!!e.hasGoMod}catch(e){return console.warn("[PlaytestStudioUI] Failed to resolve workspace URI:",e),!1}}async syncSessionAndWorkspaceFromServer(){let t=!!new URLSearchParams(window.location.search).get("workspace")?.trim();if(window.sidecar?.conversationId&&!F())try{x(window.sidecar.conversationId)}catch{}window.sidecar&&typeof window.sidecar.onWorkspaceChange=="function"&&window.sidecar.onWorkspaceChange(e=>{Array.isArray(e)&&e.length>0&&e[0]&&this.applyWorkspaceUri(e[0])});try{const e=await tt();if(e.activeSessionId&&!F()&&x(e.activeSessionId),e.defaultWorkspace){const n=await this.applyWorkspaceUri(e.defaultWorkspace);t=t||n}this.updateHeaderInputsUI(),this.updateSessionBadgeUI()}catch(e){console.warn("[PlaytestStudioUI] Sidecar health check skipped or unavailable:",e)}if(window.sidecar&&typeof window.sidecar.getWorkspaceUris=="function")try{const e=await Promise.race([window.sidecar.getWorkspaceUris(),new Promise(n=>setTimeout(()=>n([]),1200))]);if(Array.isArray(e)&&e.length>0&&e[0]){const n=await this.applyWorkspaceUri(e[0]);t=t||n}}catch(e){console.warn("[PlaytestStudioUI] getWorkspaceUris skipped:",e)}t&&S().trim()&&!this.isBuilding&&!this.runner.isRunning()&&this.handleBuildAndRun()}renderHeader(){const t=S();this.headerEl.innerHTML=`
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
          href="${this.escapeAttr(M())}"
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
    `}renderViewport(){const t=S();this.viewportEl.innerHTML=`
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
    `}bindEvents(){const t=this.headerEl.querySelector("#workspace-input"),e=this.headerEl.querySelector("#pkg-input"),n=this.viewportEl.querySelector("#ready-workspace-input"),i=this.viewportEl.querySelector("#ready-pkg-input"),s=l=>{R(l),t.value!==l&&(t.value=l),n.value!==l&&(n.value=l)},a=l=>{this.activePkg=l.trim()||".",e.value!==l&&(e.value=l),i.value!==l&&(i.value=l)};t.addEventListener("change",()=>s(t.value)),n.addEventListener("input",()=>s(n.value)),e.addEventListener("change",()=>a(e.value)),i.addEventListener("input",()=>a(i.value)),J(()=>this.updateHeaderInputsUI()),j(()=>this.updateSessionBadgeUI()),this.headerEl.querySelector("#btn-build-run")?.addEventListener("click",()=>{s(t.value),a(e.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-ready-build")?.addEventListener("click",()=>{s(n.value),a(i.value),this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-retry-build")?.addEventListener("click",()=>{this.handleBuildAndRun()}),this.viewportEl.querySelector("#btn-send-build-error")?.addEventListener("click",()=>{this.handleSendBuildErrorToChat()}),this.headerEl.querySelector("#btn-pause-toggle")?.addEventListener("click",()=>{this.runner.togglePause()}),this.headerEl.querySelector("#btn-home-ready")?.addEventListener("click",()=>{this.showReadyStateView()}),this.headerEl.querySelector("#btn-keypad-toggle")?.addEventListener("click",()=>{this.keypadVisible=!this.keypadVisible,this.keypadOverlayEl.classList.toggle("hidden",!this.keypadVisible),this.headerEl.querySelector("#btn-keypad-toggle")?.classList.toggle("active",this.keypadVisible)}),this.headerEl.querySelector("#btn-mute-toggle")?.addEventListener("click",()=>{const l=this.runner.toggleMuted(),h=this.headerEl.querySelector("#mute-btn-label"),f=this.headerEl.querySelector("#btn-mute-toggle");if(h&&(h.textContent=l?"🔇":"🔊"),f){const w=l?"Unmute Game Audio (Muted)":"Mute Game Audio";f.setAttribute("data-tooltip",w),f.setAttribute("title",w)}}),this.headerEl.querySelector("#btn-logs-toggle")?.addEventListener("click",()=>{this.logsDrawerVisible=!this.logsDrawerVisible,this.logsDrawerEl.classList.toggle("hidden",!this.logsDrawerVisible),this.headerEl.querySelector("#btn-logs-toggle")?.classList.toggle("active",this.logsDrawerVisible)}),this.viewportEl.querySelector("#btn-close-logs")?.addEventListener("click",()=>{this.logsDrawerVisible=!1,this.logsDrawerEl.classList.add("hidden"),this.headerEl.querySelector("#btn-logs-toggle")?.classList.remove("active")}),this.viewportEl.querySelector("#btn-clear-logs")?.addEventListener("click",()=>{this.runner.clearConsoleLogs(),this.updateLogsUI([])}),this.headerEl.querySelector("#btn-session-badge")?.addEventListener("click",()=>{this.openSessionSwitcherModal()}),this.focusPillEl.addEventListener("click",()=>{this.runner.isPaused()||this.runner.focus()}),this.keypadOverlayEl.querySelectorAll(".keypad-btn").forEach(l=>{const h=l,f=h.dataset.code||"Space",w=h.dataset.key||" ",b=E=>{E.preventDefault(),h.classList.add("pressed"),this.runner.dispatchVirtualKey(f,w,"keydown")},v=E=>{E.preventDefault(),h.classList.contains("pressed")&&(h.classList.remove("pressed"),this.runner.dispatchVirtualKey(f,w,"keyup"))};h.addEventListener("pointerdown",b),h.addEventListener("pointerup",v),h.addEventListener("pointerleave",v),h.addEventListener("pointercancel",v)}),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(l=>{l.addEventListener("click",()=>{const h=l.dataset.tool;h&&this.selectAnnotationTool(h)})});const c=this.annotationBarEl.querySelectorAll(".qa-color-swatch");c.forEach(l=>{l.addEventListener("click",()=>{const h=l.dataset.color;h&&(this.annotator.setColor(h),c.forEach(f=>f.classList.remove("active")),l.classList.add("active"))})}),this.annotationBarEl.querySelector("#btn-ann-undo")?.addEventListener("click",()=>{this.annotator.undo()}),this.annotationBarEl.querySelector("#btn-ann-redo")?.addEventListener("click",()=>{this.annotator.redo()}),this.annotationBarEl.querySelector("#btn-ann-clear")?.addEventListener("click",()=>{this.annotator.clearAnnotations()});const u=this.annotationBarEl.querySelector("#dvr-scrubber-slider");u.addEventListener("input",()=>{const l=Number.parseInt(u.value,10);this.scrubToDvrFrame(l)}),this.annotationBarEl.querySelector("#btn-dvr-prev")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.max(0,this.activeDvrIndex-1);this.scrubToDvrFrame(l)}}),this.annotationBarEl.querySelector("#btn-dvr-next")?.addEventListener("click",()=>{if(this.dvrBuffer.length>0){const l=Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1);this.scrubToDvrFrame(l)}});const p=this.bugBarEl.querySelector("#btn-toggle-attach-logs"),g=this.bugBarEl.querySelector("#include-logs-checkbox");p?.addEventListener("click",()=>{const l=g?!g.checked:!1;g&&(g.checked=l),p.classList.toggle("active",l),p.setAttribute("aria-pressed",String(l));const h=l?"Attach WASM Console Logs (ON)":"Attach WASM Console Logs (OFF)";p.setAttribute("data-tooltip",h),p.setAttribute("title",h)}),this.bugBarEl.querySelector("#bug-note-input").addEventListener("keydown",l=>{l.key==="Enter"&&(l.preventDefault(),this.handleSendBugToChat())}),this.bugBarEl.querySelector("#btn-send-bug-chat")?.addEventListener("click",()=>{this.handleSendBugToChat()}),this.bugBarEl.querySelector("#btn-send-gif-chat")?.addEventListener("click",()=>{this.handleSendGifToChat()}),window.addEventListener("keydown",l=>{const h=l.target,f=h&&(h.tagName==="INPUT"||h.tagName==="TEXTAREA"||h.isContentEditable);if(l.code==="F8"||!f&&l.code==="Backquote"){this.runner.isRunning()&&(l.preventDefault(),l.stopPropagation(),this.runner.togglePause());return}if(!(f||!this.runner.isPaused())){if((l.metaKey||l.ctrlKey)&&l.key.toLowerCase()==="z"){l.preventDefault(),l.shiftKey?this.annotator.redo():this.annotator.undo();return}l.code==="KeyP"?(l.preventDefault(),this.selectAnnotationTool("pen")):l.code==="KeyA"?(l.preventDefault(),this.selectAnnotationTool("arrow")):l.code==="KeyB"?(l.preventDefault(),this.selectAnnotationTool("box")):l.code==="KeyT"?(l.preventDefault(),this.selectAnnotationTool("text")):l.code==="ArrowLeft"?(l.preventDefault(),this.scrubToDvrFrame(Math.max(0,this.activeDvrIndex-1))):l.code==="ArrowRight"&&(l.preventDefault(),this.scrubToDvrFrame(Math.min(this.dvrBuffer.length-1,this.activeDvrIndex+1)))}},{capture:!0})}async handleBuildAndRun(){if(this.isBuilding)return;const t=S().trim();if(!t){y.error("Missing Go Workspace Path","Enter the path to your Ebitengine Go workspace in the header bar before building.");return}this.isBuilding=!0,this.lastBuildFailure=null,this.setBuildButtonsLoading(!0);try{y.info(`Compiling Go WASM in "${t}" (${this.activePkg})...`,2500);const e=await nt({workspace:t,pkg:this.activePkg});if(!e.ok){this.lastBuildFailure=e,this.showBuildErrorView(e),y.error("Go WASM Compilation Failed (HTTP 422)",e.compilerOutput.slice(0,240));return}this.showActiveGameStage(),await this.runner.launchBuild(e.buildId);const n=this.headerEl.querySelector("#btn-pause-toggle");n&&(n.disabled=!1);const i=(e.wasmBytes/(1024*1024)).toFixed(2);y.success(`Built & launched ${e.pkg} (${i} MB WASM in ${e.durationMs}ms)`),this.runner.focus()}catch(e){y.error("WASM Build / Launch Error",e?.message||String(e))}finally{this.isBuilding=!1,this.setBuildButtonsLoading(!1)}}handlePauseStateChanged(t){const e=this.headerEl.querySelector("#btn-pause-toggle"),n=this.headerEl.querySelector("#pause-btn-label");if(t){e&&(e.classList.add("btn-warning-active"),e.setAttribute("data-tooltip","Resume Gameplay (` or F8)"),e.setAttribute("title","Resume Gameplay (` or F8)")),n&&(n.textContent="▶️ Resume"),this.annotationBarEl.classList.remove("hidden"),this.annotationStageEl.classList.remove("hidden");const i=this.runner.getGameCanvas();if(i&&i.width>0&&i.height>0)this.annotator.loadBaseFromCanvas(i);else{const s=this.dvrBuffer.getLatestFrame();s&&this.annotator.loadBaseFrameDataUrl(s.dataUrl,s.width,s.height)}this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI(),this.updateFocusPillUI(!1)}else e&&(e.classList.remove("btn-warning-active"),e.setAttribute("data-tooltip","Freeze Frame & Annotate Bug (` or F8)"),e.setAttribute("title","Freeze Frame & Annotate Bug (` or F8)")),n&&(n.textContent="⏸️ Pause"),this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.runner.focus()}async scrubToDvrFrame(t){const e=this.dvrBuffer.getFrameAt(t);e&&(this.activeDvrIndex=e.index,this.updateDvrScrubberUI(),e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}updateDvrScrubberUI(){const t=this.annotationBarEl.querySelector("#dvr-scrubber-slider"),e=this.annotationBarEl.querySelector("#dvr-frame-badge"),n=this.annotationBarEl.querySelector("#btn-dvr-prev"),i=this.annotationBarEl.querySelector("#btn-dvr-next"),s=this.dvrBuffer.length;if(s===0){t&&(t.min="0",t.max="0",t.value="0",t.disabled=!0),e&&(e.textContent="0.0s",e.setAttribute("data-tooltip","Live (0.0s)"),e.setAttribute("title","Live (0.0s)")),n&&(n.disabled=!0),i&&(i.disabled=!0);return}const a=Math.max(0,Math.min(s-1,this.activeDvrIndex)),o=this.dvrBuffer.getFrameAt(a);if(t&&(t.disabled=!1,t.min="0",t.max=String(s-1),t.value=String(a)),n&&(n.disabled=a<=0),i&&(i.disabled=a>=s-1),e&&o){const d=o.relativeSec===0?"0.0s":`${o.relativeSec.toFixed(1)}s`,c=o.relativeSec===0?`Live (0.0s) · Frame ${a+1}/${s}`:`${o.relativeSec.toFixed(2)}s · Frame ${a+1}/${s}`;e.textContent=d,e.setAttribute("data-tooltip",c),e.setAttribute("title",c)}}selectAnnotationTool(t){this.annotator.setTool(t),this.annotationBarEl.querySelectorAll(".ann-tool-btn").forEach(n=>{const i=n.dataset.tool;n.classList.toggle("active",i===t)})}updateAnnotationControlsUI(){const t=this.annotationBarEl.querySelector("#btn-ann-undo"),e=this.annotationBarEl.querySelector("#btn-ann-redo"),n=this.annotationBarEl.querySelector("#btn-ann-clear");t&&(t.disabled=!this.annotator.canUndo()),e&&(e.disabled=!this.annotator.canRedo()),n&&(n.disabled=this.annotator.getShapes().length===0)}updateFocusPillUI(t){if(this.focusPillEl){if(this.runner.isPaused()){this.focusPillEl.className="focus-status-pill paused",this.focusPillEl.innerHTML="<span>⏸ Paused — Draw on Frame or Scrub 10s DVR</span>";return}t?(this.focusPillEl.className="focus-status-pill focused",this.focusPillEl.innerHTML="<span>● Controls Active (` or F8 to Pause)</span>"):(this.focusPillEl.className="focus-status-pill unfocused",this.focusPillEl.innerHTML="<span>🎮 Click Game Viewport to Capture Keyboard &amp; Audio</span>")}}updateLogsUI(t){const e=this.headerEl.querySelector("#logs-count-badge");e&&(e.textContent=String(t.length));const n=this.viewportEl.querySelector("#logs-drawer-content");n&&(n.textContent=t.length>0?t.join(`
`):"No WASM console output recorded yet.",n.scrollTop=n.scrollHeight)}showReadyStateView(){this.runner.destroy(),this.lastBuildFailure=null,this.annotationBarEl.classList.add("hidden"),this.annotationStageEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.readyStateEl.classList.remove("hidden");const t=this.headerEl.querySelector("#btn-pause-toggle"),e=this.headerEl.querySelector("#pause-btn-label");t&&(t.disabled=!0,t.classList.remove("btn-warning-active")),e&&(e.textContent="⏸️ Pause"),this.updateHeaderInputsUI()}showActiveGameStage(){this.readyStateEl.classList.add("hidden"),this.errorStateEl.classList.add("hidden"),this.gameStageEl.classList.remove("hidden")}showBuildErrorView(t){this.runner.destroy(),this.annotationBarEl.classList.add("hidden"),this.readyStateEl.classList.add("hidden"),this.gameStageEl.classList.add("hidden"),this.errorStateEl.classList.remove("hidden");const e=this.viewportEl.querySelector("#error-state-title"),n=this.viewportEl.querySelector("#error-state-meta"),i=this.viewportEl.querySelector("#error-state-traceback");e&&(e.textContent=t.error||"Go WASM Compilation Failed"),n&&(n.textContent=`Workspace: ${t.workspace} | Package: ${t.pkg} | Exit Code: ${t.exitCode}`),i&&(i.textContent=t.compilerOutput)}showRuntimePanicView(t){const e=S()||".";this.lastBuildFailure={ok:!1,status:422,error:"Go WASM Runtime Panic",compilerOutput:[t,"",...this.runner.getConsoleLogs().slice(-30)].join(`
`),workspace:e,pkg:this.activePkg,exitCode:2},this.showBuildErrorView(this.lastBuildFailure)}async handleSendBuildErrorToChat(){if(!this.lastBuildFailure)return;const t=this.viewportEl.querySelector("#btn-send-build-error");t&&(t.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input")?.value.trim()||"";await it({buildError:this.lastBuildFailure.compilerOutput,note:n,workspace:this.lastBuildFailure.workspace,pkg:this.lastBuildFailure.pkg}),y.success("Sent Go WASM compiler traceback directly to Antigravity chat!")}catch(e){y.error("Failed to send build error to chat",e?.message||String(e))}finally{t&&(t.disabled=!1)}}async ensurePausedFrameLoaded(){if(this.runner.isRunning()&&!this.runner.isPaused()?this.runner.setPaused(!0):this.dvrBuffer.length===0&&(this.runner.syncDvrFromChild(),this.activeDvrIndex=Math.max(0,this.dvrBuffer.length-1),this.updateDvrScrubberUI()),!this.annotator.hasFrozenFrame()){const t=this.runner.getGameCanvas();if(t&&t.width>0&&t.height>0)this.annotator.loadBaseFromCanvas(t);else{const e=this.dvrBuffer.getLatestFrame();e&&(e.canvas?this.annotator.loadBaseFromCanvas(e.canvas):await this.annotator.loadBaseFrameDataUrl(e.dataUrl,e.width,e.height))}}}decodeDataUrlToImage(t){return new Promise((e,n)=>{const i=new Image;i.onload=()=>e(i),i.onerror=()=>n(new Error("Failed to decode frame dataUrl into HTMLImageElement.")),i.src=t})}async buildDvrAnimatedGifDataUrl(){await this.ensurePausedFrameLoaded();const t=this.dvrBuffer.getFrames(),e=t.length>0?Math.max(0,Math.min(t.length-1,this.activeDvrIndex)):0,n=t.length>0?t.slice(0,e+1):[],i=this.annotator.getDimensions(),s=n[0]?.width||i.width||640,a=n[0]?.height||i.height||360,o=480,d=s>o?o/s:1,c=Math.max(64,Math.round(s*d)),u=Math.max(36,Math.round(a*d)),p=document.createElement("canvas");p.width=c,p.height=u;const g=p.getContext("2d",{willReadFrequently:!0});if(!g)throw new Error("Failed to acquire 2D context for GIF encoding.");g.imageSmoothingEnabled=!1;const m=[],l=this.annotator.getShapes().length>0;for(let b=0;b<n.length;b++){const v=n[b];if(g.fillStyle="#090D16",g.fillRect(0,0,c,u),v.canvas)g.drawImage(v.canvas,0,0,c,u);else{const C=await this.decodeDataUrlToImage(v.dataUrl);g.drawImage(C,0,0,c,u)}const E=g.getImageData(0,0,c,u),A=b===n.length-1&&!l;let W=this.dvrBuffer.captureIntervalMs;if(b+1<n.length){const C=n[b+1].timestampMs-v.timestampMs;Number.isFinite(C)&&C>=15&&C<=250&&(W=Math.round(C))}m.push({rgba:new Uint8Array(E.data),delayMs:A?900:W})}if(l||m.length===0){const b=this.annotator.exportCompositeDataUrl(),v=await this.decodeDataUrlToImage(b);g.fillStyle="#090D16",g.fillRect(0,0,c,u),g.drawImage(v,0,0,c,u);const E=g.getImageData(0,0,c,u);m.push({rgba:new Uint8Array(E.data),delayMs:1500})}const h=ht({width:c,height:u,frames:m}),f=n.length>=2?(n[n.length-1].timestampMs-n[0].timestampMs)/1e3:n.length*this.dvrBuffer.captureIntervalMs/1e3,w=Number(Math.max(.04,f).toFixed(2));return{dataUrl:pt(h),width:c,height:u,frameCount:m.length,durationSec:w}}async handleSendGifToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}const t=this.bugBarEl.querySelector("#btn-send-gif-chat"),e=this.bugBarEl.querySelector("#btn-send-bug-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{y.info("Encoding 10s DVR replay (25 FPS) into animated GIF...",2400);const n=await this.buildDvrAnimatedGifDataUrl(),i=this.bugBarEl.querySelector("#bug-note-input"),s=this.bugBarEl.querySelector("#include-logs-checkbox"),a=i?.value.trim()||"",d=(s?s.checked:!0)?this.runner.getConsoleLogs():[],c=this.dvrBuffer.getFrameAt(this.activeDvrIndex),u=c?c.relativeSec===0?"live (0.0s)":`${c.relativeSec.toFixed(2)}s`:"live",p=`playtest-clip-${Date.now()}.gif`,g=await $({filename:p,imageDataUrl:n.dataUrl,note:a,consoleLogs:d,workspace:S()||".",pkg:this.activePkg,frameOffset:`${n.frameCount}f (${n.durationSec}s DVR → ${u})`,resolution:`${n.width}x${n.height}`,width:n.width,height:n.height});y.success(`Delivered 10s DVR GIF "${g.filename||p}" (${n.frameCount} frames) to chat!`),i&&(i.value="")}catch(n){y.error("Failed to encode or send 10s DVR GIF",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}async handleSendBugToChat(){if(this.lastBuildFailure&&!this.runner.isRunning()){await this.handleSendBuildErrorToChat();return}await this.ensurePausedFrameLoaded();const t=this.bugBarEl.querySelector("#btn-send-bug-chat"),e=this.bugBarEl.querySelector("#btn-send-gif-chat");t&&(t.disabled=!0),e&&(e.disabled=!0);try{const n=this.bugBarEl.querySelector("#bug-note-input"),i=this.bugBarEl.querySelector("#include-logs-checkbox"),s=n?.value.trim()||"",o=(i?i.checked:!0)?this.runner.getConsoleLogs():[],d=this.annotator.exportCompositeDataUrl(),c=this.annotator.getDimensions(),u=this.dvrBuffer.getFrameAt(this.activeDvrIndex),p=u?u.relativeSec===0?"live (0.0s)":`${u.relativeSec.toFixed(2)}s`:"live",g=`playtest-bug-${Date.now()}.png`,m=await $({filename:g,imageDataUrl:d,note:s,consoleLogs:o,workspace:S()||".",pkg:this.activePkg,frameOffset:p,resolution:`${c.width}x${c.height}`,width:c.width,height:c.height});y.success(`Delivered "${m.filename||g}" to Antigravity chat!`),n&&(n.value="")}catch(n){y.error("Failed to send bug report to chat",n?.message||String(n))}finally{t&&(t.disabled=!1),e&&(e.disabled=!1)}}setBuildButtonsLoading(t){const e=this.headerEl.querySelector("#btn-build-run"),n=this.headerEl.querySelector("#build-btn-label"),i=this.viewportEl.querySelector("#btn-ready-build");e&&(e.disabled=t),i&&(i.disabled=t,i.innerHTML=t?"<span>⏳ Compiling &amp; Launching WASM...</span>":"<span>▶ Compile &amp; Launch Ebitengine WASM</span>"),n&&(n.textContent=t?"⏳ Building...":"🚀 Run")}updateHeaderInputsUI(){const t=S(),e=this.headerEl.querySelector("#workspace-input"),n=this.viewportEl.querySelector("#ready-workspace-input"),i=this.headerEl.querySelector("#pkg-input"),s=this.viewportEl.querySelector("#ready-pkg-input");e&&e.value!==t&&(e.value=t),n&&n.value!==t&&(n.value=t),i&&i.value!==this.activePkg&&(i.value=this.activePkg),s&&s.value!==this.activePkg&&(s.value=this.activePkg);const a=this.headerEl.querySelector("#btn-full-studio");a&&(a.href=M())}updateSessionBadgeUI(){const t=F(),e=this.headerEl.querySelector("#btn-session-badge"),n=this.headerEl.querySelector("#btn-full-studio");if(e){const i=e.querySelector(".status-dot"),s=e.querySelector("#session-badge-text");if(t&&t!=="standalone"){e.className="session-badge connected",i&&(i.className="status-dot online"),s&&(s.textContent=`${t.slice(0,8)}...`);const a=`Session: ${t.slice(0,8)}... (Click to switch)`;e.setAttribute("data-tooltip",a),e.setAttribute("title",a)}else{e.className="session-badge disconnected",i&&(i.className="status-dot offline"),s&&(s.textContent="Standalone");const a="Session: Standalone (Click to connect)";e.setAttribute("data-tooltip",a),e.setAttribute("title",a)}}n&&(n.href=M())}async openSessionSwitcherModal(){const t=document.getElementById("session-switcher-modal");t&&t.remove();const e=document.createElement("div");e.id="session-switcher-modal",e.className="modal-overlay",e.innerHTML=`
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
              value="${this.escapeAttr(F()||"")}"
            />
            <button type="button" id="btn-apply-session" class="btn btn-primary btn-sm">Connect</button>
          </div>
          <div id="recent-sessions-list" class="recent-sessions-list">
            <div class="session-loading">Loading recent Antigravity sessions...</div>
          </div>
        </div>
      </div>
    `;const n=()=>e.remove();e.querySelector("#session-modal-close")?.addEventListener("click",n),e.addEventListener("click",s=>{s.target===e&&n()}),e.querySelector("#btn-apply-session")?.addEventListener("click",()=>{const a=e.querySelector("#manual-session-input").value.trim();if(a)try{x(a),y.success(`Connected to session ${a}`),n()}catch(o){y.error("Invalid Session ID",o?.message||String(o))}}),document.body.appendChild(e);const i=e.querySelector("#recent-sessions-list");try{const s=await et();if(s.length===0){i.innerHTML='<div class="session-empty">No recent sessions found.</div>';return}i.innerHTML=s.map(a=>`
          <button type="button" class="session-item-btn" data-sid="${this.escapeAttr(a.id)}">
            <span class="session-item-id">${this.escapeHtml(a.id)}</span>
            <span class="session-item-time">${this.escapeHtml(new Date(a.updatedAt).toLocaleTimeString())}</span>
          </button>
        `).join(""),i.querySelectorAll(".session-item-btn").forEach(a=>{a.addEventListener("click",()=>{const o=a.dataset.sid;o&&(x(o),y.success(`Connected to session ${o.slice(0,8)}...`),n())})})}catch(s){i.innerHTML=`<div class="session-empty">Failed to load sessions: ${this.escapeHtml(s?.message||String(s))}</div>`}}escapeHtml(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}escapeAttr(t){return this.escapeHtml(t).replace(/'/g,"&#39;")}}function _(){try{const r=Z(),t=r==="preview"?"studio-mode-preview":"studio-mode-full";document.body.classList.remove("studio-mode-preview","studio-mode-full"),document.body.classList.add("studio-container",t),r==="preview"?document.body.classList.add("bg-transparent"):document.body.classList.remove("bg-transparent");const e=document.getElementById("app");e&&(e.classList.remove("studio-mode-preview","studio-mode-full"),e.classList.add("studio-container",t));const n=document.getElementById("app-root");n&&(n.classList.remove("studio-mode-preview","studio-mode-full"),n.classList.add("studio-container",t));const i=document.getElementById("header-bar"),s=document.getElementById("annotation-bar"),a=document.getElementById("viewport-container"),o=document.getElementById("bug-report-bar");if(!i||!s||!a||!o)throw new Error("Required DOM containers not found for Playtest Studio. Missing: "+[!i&&"#header-bar",!s&&"#annotation-bar",!a&&"#viewport-container",!o&&"#bug-report-bar"].filter(Boolean).join(", "));new gt({headerEl:i,annotationBarEl:s,viewportEl:a,bugBarEl:o}),console.log(`[Playtest Studio] Initialized in "${r}" mode`)}catch(r){console.error("[Playtest Studio] Initialization error:",r),y.fatal("Playtest Studio Initialization Failed",r)}}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",_,{once:!0}):_();window.addEventListener("error",r=>{console.error("[Playtest Studio] Uncaught Window Error:",r),y.fatal("Uncaught Runtime Error",r.error||r.message)});window.addEventListener("unhandledrejection",r=>{console.error("[Playtest Studio] Unhandled Promise Rejection:",r),y.fatal("Unhandled Promise Rejection",r.reason)});
