/* Procedural chamber renderer. No remote assets or rendering dependencies. */
const visual = { theme: 'cyan', quality: 'high', paused: false, slow: false, fps: 60, lastHud: 0, clock: 0 };
const palettes = {
  cyan: { light: '#65e4ef', dim: '#183a48', sky: '#0b1c2a', floor: '#132a34', title: 'Orbital chamber' },
  violet: { light: '#bb9bff', dim: '#32254e', sky: '#171229', floor: '#29203c', title: 'Neon reactor' },
  amber: { light: '#ffbf6c', dim: '#48352a', sky: '#271d19', floor: '#352920', title: 'Solar foundry' }
};
function pathLine(x,y,x2,y2,color,lineWidth=1){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function glowOrb(x,y,r,color,alpha=1){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function plate(x,y,w,h,color,r=4){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
// Faint pixel scenery per arena theme, painted once at 1/3 scale and cached until the theme or size changes.
const backdropCache={};
function seededRandom(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}
function getBackdropScenery(){
  const key=visual.theme+width+'x'+height;
  if(backdropCache.key===key)return backdropCache.canvas;
  const w=Math.ceil(width/3),h=Math.ceil((height-24)/3),c=document.createElement('canvas');c.width=w;c.height=h;
  const b=c.getContext('2d'),p=palettes[visual.theme],rand=seededRandom(7);
  const rect=(x,y,rw,rh,color)=>{b.fillStyle=color;b.fillRect(Math.round(x),Math.round(y),Math.round(rw),Math.round(rh));};
  const disc=(cx,cy,r,color)=>{for(let y=-r;y<=r;y++){const half=Math.round(Math.sqrt(r*r-y*y));rect(cx-half,cy+y,half*2+1,1,color);}};
  if(visual.theme==='cyan'){
    for(let i=0;i<w*h*.004;i++)rect(rand()*w,rand()*h*.8,1,1,rand()<.2?p.light+'90':'#2b4a5a');
    const pr=Math.round(h*.32),px=Math.round(w*.78),py=Math.round(h*.3);
    disc(px,py,pr,'#2a5566');disc(px+2,py+2,pr,p.dim);
    for(let y=-pr;y<pr;y+=5)rect(px-pr,py+y,pr*2,1,'#14303c');
    disc(px+2,py+pr+3,pr+2,'#080e14');
    for(let x=0;x<w;x+=Math.round(w/5)){rect(x,0,5,h,'#0d1a22');rect(x+5,0,1,h,'#1d3644');}
    rect(0,0,w,4,'#0d1a22');rect(0,4,w,1,'#1d3644');
    for(let x=4;x<w;x+=18+rand()*20){const ch=5+rand()*9;rect(x,h-ch,10+rand()*10,ch,'#0b161d');rect(x+2,h-ch+2,2,1,p.light+'70');}
  }else if(visual.theme==='violet'){
    for(const y of [h*.28,h*.55]){rect(0,y,w,4,'#1a1428');rect(0,y,w,1,'#2c2245');for(let x=10;x<w;x+=34)rect(x,y-1,3,6,'#241b38');}
    const cx=Math.round(w*.5),cw=34;
    rect(cx-cw/2,0,cw,h,'#1d1630');rect(cx-cw/2,0,2,h,'#2c2245');rect(cx+cw/2-2,0,2,h,'#120d1f');
    for(let y=6;y<h;y+=12)rect(cx-cw/2-3,y,cw+6,2,'#3a2d63');
    rect(cx-3,0,6,h,p.light+'20');rect(cx-1,0,2,h,p.light+'33');
    for(let x=0;x<w;x+=Math.round(w/7))if(Math.abs(x-cx)>cw)rect(x,h*.55,2,h,'#161122');
    rect(0,h*.68,w,1,'#2c2245');for(let x=0;x<w;x+=12)rect(x,h*.68,1,8,'#211a33');
  }else{
    for(let i=0;i<6;i++)rect(0,h*i/6,w,h/6+1,['#120c0a','#170f0c','#1d130e','#24170f','#2b1b11','#311e12'][i]);
    disc(Math.round(w*.3),Math.round(h*.78),Math.round(h*.34),'#4a2c16');disc(Math.round(w*.3),Math.round(h*.78),Math.round(h*.26),'#5a3518');
    let x=0;while(x<w){const bw=12+rand()*26,bh=h*(.15+rand()*.3);rect(x,h-bh,bw,bh,'#140e0b');
      if(rand()<.45){const sx=x+bw*.3,sh=h*(.45+rand()*.25);rect(sx,h-sh,4,sh,'#140e0b');rect(sx,h-sh,4,1,p.light+'60');for(let k=0;k<3;k++)disc(Math.round(sx+2+k*4),Math.round(h-sh-4-k*5),2+k,'#2a1d16');}
      rect(x+3,h-bh+3,2,1,p.light+'50');x+=bw;}
    rect(w*.7,h*.2,1,h*.8,'#1a120e');rect(w*.6,h*.2,w*.2,2,'#1a120e');
  }
  backdropCache.key=key;backdropCache.canvas=c;return c;
}
const nativeDrawArena=drawArena;
getNodeHeadImage = () => null;
drawGround = function(){
  const p=palettes[visual.theme], floor=height-24;
  // Quiet, near-black backdrop keeps silhouettes and active effects readable.
  const backdrop=ctx.createLinearGradient(0,0,0,height);
  backdrop.addColorStop(0,'#04070b');
  backdrop.addColorStop(1,'#080e14');
  ctx.fillStyle=backdrop;
  ctx.fillRect(0,0,width,height);
  const scenery=getBackdropScenery();ctx.imageSmoothingEnabled=false;ctx.drawImage(scenery,0,0,scenery.width*3,scenery.height*3);
  plate(0,floor,width,24,'#0c141b',0);
  pathLine(0,floor,width,floor,p.light+'45',1);
};
// Keep the background clear and avoid darkening the robots with a foreground vignette.
drawSceneAtmosphere = function(){};
drawArena = function(){
  // Preserve special physical props, then add machined surfaces and lit edge strips.
  nativeDrawArena();
  const p=palettes[visual.theme];
  for(const o of obstacles){if(o.melted||o.type)continue;
    const material=ctx.createLinearGradient(o.x,o.y,o.x,o.y+o.h);material.addColorStop(0,'#3e5867');material.addColorStop(.2,'#263e4b');material.addColorStop(1,'#10212c');
    plate(o.x,o.y,o.w,o.h,material,3);ctx.strokeStyle='#567380';ctx.lineWidth=1;ctx.strokeRect(o.x+.5,o.y+.5,o.w-1,o.h-1);
    plate(o.x+5,o.y+3,o.w-10,2,p.light+'ba',0);
    for(const dx of [5,o.w-5]){ctx.fillStyle='#07141e';ctx.beginPath();ctx.arc(o.x+dx,o.y+o.h-5,2,0,7);ctx.fill();}
    if(o.h>40){ctx.fillStyle='#779ca9';ctx.font='8px monospace';ctx.fillText('R/L — 04',o.x+10,o.y+29);for(let j=0;j<5;j++)plate(o.x+10,o.y+42+j*8,o.w-20,3,'#0c202b',1);}
  }
  for(const o of props){if(o.broken)continue;plate(o.x,o.y,o.w,o.h,'#34474b',2);ctx.strokeStyle='#7d9898';ctx.strokeRect(o.x+2,o.y+2,o.w-4,o.h-4);plate(o.x+5,o.y+6,o.w-10,4,'#b6ce6c',1);pathLine(o.x+6,o.y+15,o.x+o.w-6,o.y+o.h-6,'#607b80',2);pathLine(o.x+o.w-6,o.y+15,o.x+6,o.y+o.h-6,'#607b80',2);}
};
// Armored robot limbs, articulated bearings, and emissive visors.
drawLimbSegment = function(a,b,color,m=1){
  if(!a||!b||a.destroyed||b.destroyed)return;
  const r=Math.max(6,(a.radius+b.radius)*.58*m),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
  ctx.lineCap='round';pathLine(a.x+2,a.y+4,b.x+2,b.y+4,'#00000066',r+4);
  pathLine(a.x,a.y,b.x,b.y,'#0a1721',r+4);
  const g=ctx.createLinearGradient(a.x-nx*r,a.y-ny*r,a.x+nx*r,a.y+ny*r);g.addColorStop(0,'#233541');g.addColorStop(.3,'#78909b');g.addColorStop(.48,'#3d5562');g.addColorStop(1,'#14232e');pathLine(a.x,a.y,b.x,b.y,g,r);
  pathLine(a.x+dx*.22,a.y+dy*.22,b.x-dx*.22,b.y-dy*.22,color,r*.48);
  pathLine(a.x+nx*r*.3+dx*.15,a.y+ny*r*.3+dy*.15,b.x+nx*r*.3-dx*.15,b.y+ny*r*.3-dy*.15,'#bceef555',1.2);ctx.lineCap='butt';
};
drawJoint = function(n){
  if(!n||n.destroyed||n.part==='earL'||n.part==='earR')return;
  const p=palettes[visual.theme],r=n.radius;
  ctx.save();ctx.translate(n.x,n.y);
  if(n.part==='head'){
    if(n.neckNode)ctx.rotate(Math.atan2(n.neckNode.y-n.y,n.neckNode.x-n.x)-Math.PI/2);
    const g=ctx.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#b0c8cf');g.addColorStop(.45,'#536d7b');g.addColorStop(1,'#1e3444');
    plate(-r,-r*1.07,r*2,r*2.12,g,r*.45);ctx.strokeStyle='#bdd7db77';ctx.lineWidth=1;ctx.stroke();
    plate(-r*.92,-r*.42,r*1.84,r*.87,'#06131e',r*.26);
    if(visual.quality==='high'){ctx.shadowBlur=14;ctx.shadowColor=p.light;}
    plate(-r*.64,-r*.14,r*.45,r*.14,p.light,2);plate(r*.19,-r*.14,r*.45,r*.14,p.light,2);ctx.shadowBlur=0;
    plate(-r*.26,r*.64,r*.52,2,'#96b6bd',1);plate(-r*1.1,-r*.18,3,r*.6,'#243d4e',1);plate(r*.96,-r*.18,3,r*.6,'#243d4e',1);
  }else{
    const g=ctx.createRadialGradient(-r*.3,-r*.4,1,0,0,r);g.addColorStop(0,'#7e97a3');g.addColorStop(.55,'#344f60');g.addColorStop(1,'#101e29');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.strokeStyle='#819ca55c';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#0b1923';ctx.beginPath();ctx.arc(0,0,r*.48,0,7);ctx.fill();ctx.fillStyle=n.hitFlash>.1?'#fff0c5':p.light+'a0';ctx.beginPath();ctx.arc(0,0,Math.max(1,r*.16),0,7);ctx.fill();
  }
  if(getNodeIntegrity(n)<.4){pathLine(-r*.4,-r*.7,r*.2,r*.5,'#fa9364',1.5);}
  ctx.restore();
};
// Separate chest, flexible abdomen, pelvis, hands, and boots follow physics parts.
function armorPlate(points, color) {
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const g=ctx.createLinearGradient(minX,0,maxX,0);
  g.addColorStop(0,'#243a49');g.addColorStop(.28,color);g.addColorStop(.65,color);g.addColorStop(1,'#172b39');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(...points[0]);for(const pt of points.slice(1))ctx.lineTo(...pt);ctx.closePath();ctx.fill();ctx.strokeStyle='#bfdce86b';ctx.lineWidth=1;ctx.stroke();
}
drawRagdollBodyMass=function(p){
  const c=p.chest,b=p.belly,h=p.hips;
  if(c&&b&&!c.destroyed&&!b.destroyed&&hasIntactConstraint(c,b)){
    const scale=c.radius/15, half=22*scale, length=Math.hypot(b.x-c.x,b.y-c.y);
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.atan2(b.y-c.y,b.x-c.x)-Math.PI/2);
    // Tapered rib cage leaves a narrow, articulated waist below it.
    armorPlate([[-half,-9*scale],[half,-9*scale],[half*.91,11*scale],[half*.58,length-3*scale],[-half*.58,length-3*scale],[-half*.91,11*scale]],c.color);
    pathLine(-half*.7,4*scale,-half*.2,9*scale,'#b9e4f855',1);
    pathLine(half*.7,4*scale,half*.2,9*scale,'#b9e4f855',1);
    const light=palettes[visual.theme].light;
    if(visual.quality==='high'){ctx.shadowBlur=10;ctx.shadowColor=light;}
    plate(-3*scale,6*scale,6*scale,9*scale,light,2*scale);ctx.shadowBlur=0;
    ctx.restore();
  }
  if(b&&h&&!b.destroyed&&!h.destroyed&&hasIntactConstraint(b,h)){
    const scale=h.radius/12,length=Math.hypot(h.x-b.x,h.y-b.y);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(h.y-b.y,h.x-b.x)-Math.PI/2);
    // Abdominal plates stop before the pelvis, exposing a short waist joint.
    for(let i=0;i<3;i++)plate(-9*scale,3*scale+i*6*scale,18*scale,4*scale,'#52717e',1);
    ctx.translate(0,length);
    armorPlate([[-17*scale,-9*scale],[17*scale,-9*scale],[15*scale,5*scale],[6*scale,11*scale],[-6*scale,11*scale],[-15*scale,5*scale]],h.color);
    pathLine(-11*scale,-4*scale,11*scale,-4*scale,'#b2d3dd77',1);
    ctx.restore();
  }
};
drawHumanExtremities=function(p){
  for(const [end,parent,isFoot,side] of [[p.handL,p.elbowL,false,-1],[p.handR,p.elbowR,false,1],[p.footL,p.kneeL,true,-1],[p.footR,p.kneeR,true,1]]){
    if(!end||end.destroyed)continue;
    const r=end.radius;
    ctx.save();ctx.translate(end.x,end.y);
    if(parent&&!parent.destroyed)ctx.rotate(Math.atan2(end.y-parent.y,end.x-parent.x)-Math.PI/2);
    if(isFoot){
      plate(-r*.85,-r*.65,r*1.7,r*1.4,'#354f60',3);
      plate(side<0?-r*1.4:-r*.6,r*.15,r*2,r*.75,'#7594a4',3);
      pathLine(-r*.8,r*.85,r*.8,r*.85,'#bfd7de99',1);
    }else{
      plate(-r*.75,-r*.65,r*1.5,r*1.65,'#7894a1',3);
      plate(side<0?r*.55:-r*.95,-r*.2,r*.4,r*.8,'#526d7b',2);
      for(let i=-1;i<=1;i++)pathLine(i*r*.32,r*.4,i*r*.32,r*.8,'#263e4e',.8);
    }
    ctx.restore();
  }
};
drawRagdollMaterialPass=()=>{};drawCharacterFace=()=>{};
// Draw torso armor after inner bearings so its reactor remains visible.

drawHUD=function(now){
  if(visual.clock-visual.lastHud<180)return;visual.lastHud=visual.clock;
  document.getElementById('damageStat').textContent='$'+Math.round(damageBill).toLocaleString('en-US');
  document.getElementById('activeEquipment').textContent=activeTool==='hand'?'Grab & throw':(toolConfigs[activeTool]?.name||activeTool);
  document.getElementById('integrityStat').textContent=getRagdollIntegrityPercent()+'%';
  document.getElementById('standingStat').textContent=getAliveCount()+' / '+ragdollCount;
  document.getElementById('fractureStat').textContent=getFractureCount();
  document.getElementById('fpsValue').textContent=Math.round(visual.fps)+' FPS';
};
resize=function(){
  width=canvas.clientWidth;height=canvas.clientHeight;
  const dpr=visual.quality==='high'?Math.min(window.devicePixelRatio||1,2):1;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(pointer.x===0&&pointer.y===0){pointer.x=width*.52;pointer.y=height*.5;pointer.prevX=pointer.x;pointer.prevY=pointer.y;}
  buildArena();buildRagdolls(ragdollCount);
};
const icons={'hand':'✥','health-boost':'✚','explosive-touch':'✷','bungee-rope':'⌁','nuclear-bomb':'☢','anvil-dropper':'⏷','water-lance':'◉','psychic-bat':'⚒','gravity-reverser':'⇅','ranger-shotgun':'⋮','rocket-launcher':'➶','grenade-launcher':'◌'};
document.querySelectorAll('.tools-grid .tool-row').forEach(row=>{const icon=document.createElement('span');icon.className='tool-symbol';icon.textContent=icons[row.querySelector?.('input')?.value];icon.ariaHidden='true';row.prepend(icon);});
const toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');document.body.append(toast);let toastTimer;
function showToast(message){toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),1800);}
function togglePause(){visual.paused=!visual.paused;const b=document.getElementById('pauseButton');b.innerHTML=visual.paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';b.setAttribute('aria-pressed',String(visual.paused));b.setAttribute('aria-label',visual.paused?'Resume simulation':'Pause simulation');document.querySelector('.arena-badge').firstChild.nextSibling.textContent=visual.paused?' SIMULATION PAUSED ':' PHYSICS ACTIVE ';}
document.getElementById('pauseButton').onclick=togglePause;
document.getElementById('slowButton').onclick=()=>{visual.slow=!visual.slow;document.getElementById('slowButton').setAttribute('aria-pressed',String(visual.slow));showToast(visual.slow?'Slow motion · ¼ speed':'Normal speed');};
document.getElementById('arenaTheme').onchange=e=>{visual.theme=e.target.value;document.getElementById('chamberTitle').innerHTML=palettes[visual.theme].title+' <span>01</span>';showToast(palettes[visual.theme].title+' loaded');};
document.getElementById('qualitySelect').onchange=e=>{visual.quality=e.target.value;const dpr=visual.quality==='high'?Math.min(devicePixelRatio||1,2):1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);showToast('Graphics updated');};
document.getElementById('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showToast('Fullscreen is unavailable in this browser');}};
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.repeat)return;if(e.code==='Space'){e.preventDefault();togglePause();}if(e.code==='KeyR'){resetArenaAndRagdoll();showToast('Chamber reset');}});
document.querySelectorAll('.actions button, #resetButton').forEach(b=>b.addEventListener('click',()=>showToast(b.id==='resetButton'?'Chamber reset':b.textContent+' activated')));
// Game shell: hotbar tabs and number keys, tool hints, and the Robots and Settings panels.
const hotbarTabs=[...document.querySelectorAll('[data-tab]')];
const hotbarPanels=[...document.querySelectorAll('[data-panel]')];
const toolHint=document.getElementById('toolHint');
const activeEquipmentLabel=document.getElementById('activeEquipment'),weaponStatusLabel=document.getElementById('weaponStatus');
const panels={robots:[document.getElementById('robotsPanel'),document.getElementById('robotsButton')],settings:[document.getElementById('settingsPanel'),document.getElementById('settingsButton')]};
function showHotbarTab(id){
  hotbarTabs.forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab===id)));
  hotbarPanels.forEach(panel=>{panel.hidden=panel.dataset.panel!==id;});
}
function selectedToolHint(){return document.querySelector('input[name="tool"]:checked')?.closest('[data-hint]')?.dataset.hint||'';}
function togglePanel(key,open){
  for(const [name,[panel,button]] of Object.entries(panels)){
    const show=name===key&&(open??panel.hidden);
    panel.hidden=!show;button.setAttribute('aria-expanded',String(show));
  }
}
hotbarTabs.forEach(tab=>tab.addEventListener('click',()=>showHotbarTab(tab.dataset.tab)));
hotbarPanels.forEach(panel=>[...panel.children].forEach((slot,i)=>{
  const key=document.createElement('span');key.className='slot-key';key.textContent=i+1;key.ariaHidden='true';slot.prepend(key);
  // Hovering previews that slot's name and hint; leaving restores the selected tool's.
  const name=(slot.querySelector('input+span')||slot.lastChild).textContent.trim();
  slot.addEventListener('pointerenter',()=>{activeEquipmentLabel.hidden=weaponStatusLabel.hidden=true;toolHint.textContent=name+' — '+slot.dataset.hint;});
  slot.addEventListener('pointerleave',()=>{activeEquipmentLabel.hidden=weaponStatusLabel.hidden=false;toolHint.textContent=selectedToolHint();});
}));
document.querySelectorAll('input[name="tool"]').forEach(radio=>radio.addEventListener('change',()=>{toolHint.textContent=selectedToolHint();}));
panels.robots[1].addEventListener('click',()=>togglePanel('robots'));
panels.settings[1].addEventListener('click',()=>togglePanel('settings'));
window.addEventListener('keydown',e=>{
  if(e.target.matches?.('select,textarea,input:not([type=radio]):not([type=checkbox])')||e.repeat)return;
  if(e.code==='KeyK'){togglePanel('robots');return;}
  if(e.code==='Escape'){togglePanel(null);return;}
  const digit=/^Digit([1-9])$/.exec(e.code);
  if(!digit)return;
  const index=Number(digit[1])-1;
  // With the Robots panel open, numbers pick a behavior; otherwise they pick a slot in the open hotbar group.
  const slots=panels.robots[0].hidden?[...(hotbarPanels.find(panel=>!panel.hidden)?.children||[])]:[...document.querySelectorAll('[data-behavior]')];
  slots[index]?.click();
});
// ResizeObserver responds to layout changes as well as window resizing.

let sizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(sizeFrame);sizeFrame=requestAnimationFrame(()=>{if(Math.abs(width-canvas.clientWidth)>1||Math.abs(height-canvas.clientHeight)>1)resize();});}).observe(canvas.parentElement);
resize();

const nativeToolCursor=drawToolCursor;
let cursorVisible=false;
canvas.addEventListener('pointerenter',()=>cursorVisible=true);
canvas.addEventListener('pointerleave',()=>cursorVisible=false);
drawToolCursor=function(){if(!cursorVisible)return;if(activeTool==='hand'){ctx.save();ctx.strokeStyle=palettes[visual.theme].light;ctx.lineWidth=1;ctx.beginPath();ctx.arc(pointer.x,pointer.y,pointer.down?9:6,0,Math.PI*2);ctx.stroke();ctx.restore();}else nativeToolCursor();};
const armoredRagdoll=drawRagdoll;
drawRagdoll=function(p){
  armoredRagdoll(p);drawRagdollBodyMass(p);
  if(!p.head||p.head.destroyed)return;
  const x=p.head.x,y=p.head.y-p.head.radius-18;
  const intact=p.allNodes.filter(n=>!n.destroyed),health=intact.reduce((sum,n)=>sum+getNodeIntegrity(n),0)/Math.max(1,p.allNodes.length);
  ctx.save();ctx.textAlign='center';ctx.font='7px monospace';ctx.fillStyle='#a5c5ce';ctx.fillText(p.isSuper?'ALPHA / PILOT':'UNIT '+String(p.head.ragdollId??'01').padStart(2,'0'),x,y-5);plate(x-16,y,32,2,'#1d3845',1);plate(x-16,y,32*health,2,health>.4?palettes[visual.theme].light:'#fda275',1);ctx.restore();
};
