// Run with node tests/smoke.cjs. Exercises the real engine with a mock canvas.
const vm=require('node:vm'), fs=require('node:fs'), assert=require('node:assert/strict');
const elements=new Map();
function element(id=''){return {id,style:{},value:'',textContent:'',innerHTML:'',checked:false,clientWidth:1100,clientHeight:650,parentElement:{},classList:{add(){},remove(){}},listeners:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f)},setAttribute(){},prepend(){},append(){},getBoundingClientRect(){return {left:0,top:0}},setPointerCapture(){}};}
const gradient={addColorStop(){}};
const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:80})},{get(t,k){return k in t?t[k]:()=>{}},set(t,k,v){t[k]=v;return true}});
const stage=element('stage');stage.getContext=()=>context;elements.set('stage',stage);
const html=fs.readFileSync('index.html','utf8');for(const id of html.matchAll(/id="([^"]+)"/g))if(!elements.has(id[1]))elements.set(id[1],element(id[1]));
const radios=[...html.matchAll(/name="tool" value="([^"]+)"/g)].map(m=>Object.assign(element(),{value:m[1]}));
const rows=radios.map(()=>element());const actions=[...elements].filter(([id])=>id.endsWith('Button')).map(([,e])=>e);
elements.get('pauseButton');const badge=element();badge.firstChild={nextSibling:{textContent:''}};
const document={getElementById:id=>{assert.ok(elements.has(id),'Missing element '+id);return elements.get(id)},createElement:()=>Object.assign(element(),{getContext:()=>context}),body:element(),documentElement:element(),querySelectorAll:s=>s==='input[name="tool"]'?radios:s==='.tools-grid .tool-row'?rows:s==='.actions button'?actions:[],querySelector:()=>badge};
const sandbox={document,console,performance:{now:()=>0},Image:class{constructor(){this.complete=true;this.naturalWidth=100;this.naturalHeight=100}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},ResizeObserver:class{observe(){}},devicePixelRatio:2};sandbox.window={devicePixelRatio:2,addEventListener(){},removeEventListener(){}};
const scope=vm.createContext(sandbox);
for(const file of ['app.js','renderer.js','particles.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope,{filename:file});
function run(code){return vm.runInContext(code,scope);}
assert.ok(run('nodes.length')>0);assert.equal(run('canvas.width'),2200);
assert.ok(run(`Array.from({length:50},()=>createRandomRagdollStyle()).every(style=>{
  const metrics=getStyleStandingMetrics(style);
  const headHeight=style.headRadius*2.12;
  const ratio=(metrics.footDepth+metrics.headLift+style.headRadius)/headHeight;
  return ratio>7 && ratio<10.5 && style.girthScale<1.1 && style.bellyScale<1.1;
})`),'Adult humanoid proportions stay consistent across random styles');
assert.ok(run('ragdollRefsList.every(p=>p.belly.radius<p.chest.radius && Math.abs(p.handL.x-p.shoulderL.x)<16 && p.handL.y>p.hips.y)'), 'Narrow waist and hands hanging below hips');

const before=run('simulationTick');run('for(let i=1;i<=120;i++) frame(i*1000/120)');assert.ok(Math.abs(run('simulationTick')-before-60)<=1,'60 physics steps per second at 120Hz');
run('visual.paused=true');const frozen=run('simulationTime');run('for(let i=121;i<=240;i++)frame(i*1000/120)');assert.equal(run('simulationTime'),frozen,'Pause freezes simulation clock');
run('visual.paused=false;visual.slow=true');const slow=run('simulationTick');run('for(let i=241;i<=360;i++)frame(i*1000/120)');assert.ok(Math.abs(run('simulationTick')-slow-15)<=1,'Quarter speed runs 15 steps per second');
run('visual.slow=false;resetArenaAndRagdoll();appendRagdoll();appendMasterRagdoll();spawnSuperRagdoll();spawnSixSeven();spawnDropCar();spawnCar();placeBomb();dropAnvil();launchTitaniumBall();spawnSawBlade();spawnTsunami();lava.active=true;');
run('for(let i=361;i<=480;i++)frame(i*1000/120)');assert.ok(run('nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))'),'Hazard simulation stays finite');
for(const theme of ['cyan','violet','amber'])for(const quality of ['high','low']){run(`visual.theme='${theme}';visual.quality='${quality}';render(simulationTime)`);}
for(const tool of radios){run(`activeTool=${JSON.stringify(tool.value)};pointer.down=true;pointer.x=width*.5;pointer.y=height*.5;`);run('for(let i=1;i<=8;i++)frame(lastFrameMs+17);pointer.down=false;');}
run('resetArenaAndRagdoll()');assert.equal(run('bombs.length+cars.length+anvils.length+effects.length+projectiles.length'),0,'Reset clears hazards');assert.ok(run('nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))'));
run('resetArenaAndRagdoll();igniteFire(width*.5,height-28);');
run('for(let i=0;i<35;i++)frame(lastFrameMs+17)');
assert.ok(run("effects.some(fx=>fx.type==='flame') && effects.some(fx=>fx.type==='smoke') && effects.some(fx=>fx.type==='ember')"),'Fire emits flames, smoke, and embers');
run('visual.paused=true');const frozenFire=run('fireSources[0].until-simulationTime');
run('for(let i=0;i<30;i++)frame(lastFrameMs+17)');assert.equal(run('fireSources[0].until-simulationTime'),frozenFire,'Fire duration freezes while paused');
run('visual.paused=false;visual.quality="low";for(let i=0;i<10;i++)igniteFire(width*.5,height-28);for(let i=0;i<20;i++)frame(lastFrameMs+17)');
assert.ok(run('effects.length<=450 && fireSources.length<=8'),'Particle and emitter budgets enforced');
run('resetArenaAndRagdoll()');assert.equal(run('fireSources.length'),0,'Reset clears fire emitters');
run('resetArenaAndRagdoll();chargeDamage(nodes[0],10)');assert.equal(run('damageBill'),25000,'Damage bill charges actual HP loss');
const remaining=run('nodes[0].hp');run('chargeDamage(nodes[0],100000)');assert.equal(run('damageBill'),25000+remaining*2500,'Overkill only bills remaining HP');
const spent=run('damageBill');run('chargeDamage(nodes[0],100)');assert.equal(run('damageBill'),spent,'Destroyed parts do not generate repeated charges');
run('chargeDamage(props[0],12)');assert.equal(run('damageBill'),spent+30000,'Arena props add to bill');
run('resetArenaAndRagdoll()');assert.equal(run('damageBill'),0,'Arena reset clears damage bill');
console.log('PASS: fixed timing, pause, quarter speed, spawn actions, all 12 tools, six theme/quality combinations, finite physics, and reset.');
