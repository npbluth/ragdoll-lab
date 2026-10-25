/* Local particle emitters share the simulation clock, pause, and slow motion. */
const fireSources=[];
function particleBudget(){return visual.quality==='high'?1400:450;}
function emitParticle(type,x,y,options={}){
  if(effects.length>=particleBudget())return;
  const life=options.life??45;
  effects.push({type,x,y,vx:0,vy:-1,drag:.98,gravity:0,size:8,life,maxLife:life,color:'#ff9b39',...options});
}
function igniteFire(x,y,duration=6000,radius=32,harmful=true){
  if(fireSources.length>=8)fireSources.shift();
  fireSources.push({x,y,until:frameNow+duration,radius,harmful,seed:Math.random()*7});
}
function emitSmoke(x,y,scale=1){
  emitParticle('smoke',x,y,{vx:randomRange(-.38,.38),vy:randomRange(-1.8,-.8),size:randomRange(9,17)*scale,life:randomRange(80,135),gravity:-.006,drag:.992,phase:Math.random()*7});
}
const baseParticleUpdate=updateEffects;
updateEffects=function(){
  const high=visual.quality==='high';
  for(let i=fireSources.length-1;i>=0;i--){
    const f=fireSources[i];
    if(frameNow>=f.until){fireSources.splice(i,1);continue;}
    const fade=Math.min(1,(f.until-frameNow)/900);
    if(simulationTick%(high?2:5)===0){
      for(let j=0;j<(high?4:2);j++){
        const x=f.x+randomRange(-f.radius,f.radius);
        emitParticle('flame',x,f.y+randomRange(-2,3),{vx:randomRange(-.6,.6),vy:randomRange(-2.9,-1.2),size:randomRange(10,20)*fade,life:randomRange(24,44),gravity:-.015,drag:.985,phase:f.seed+j});
      }
      emitSmoke(f.x+randomRange(-f.radius*.6,f.radius*.6),f.y-18,fade);
      emitParticle('ember',f.x+randomRange(-f.radius,f.radius),f.y-6,{vx:randomRange(-1.2,1.2),vy:randomRange(-3.6,-1.3),size:randomRange(1,2),life:randomRange(40,95),drag:.994,gravity:-.003});
    }
    if(f.harmful&&simulationTick%6===0){
      for(const node of nodes){
        if(node.destroyed||Math.abs(node.x-f.x)>f.radius+node.radius||node.y<f.y-65||node.y>f.y+20)continue;
        applyDamageToNode(node,.9,'#ff963f');
      }
    }
  }
  // Fuse smoke, rocket exhaust, and occasional sparks from badly damaged robots.
  if(simulationTick%(high?3:8)===0){
    for(const b of bombs){emitSmoke(b.x,b.y-b.radius,.35);emitParticle('spark',b.x,b.y-b.radius,{vx:randomRange(-1.8,1.8),vy:-2,size:1.2,life:14,gravity:.05,color:'#ffe6a3'});}
    for(const p of projectiles.slice(-18)){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;emitParticle('ember',p.x,p.y,{vx:-(p.vx||0)*.12,vy:-(p.vy||0)*.12,size:2,life:12});}
    for(const refs of ragdollRefsList){const n=refs.chest;if(n&&!n.destroyed&&getNodeIntegrity(n)<.35)emitSmoke(n.x,n.y,.55);}
    if(lava.level>12){for(let j=0;j<(high?5:2);j++){const x=Math.random()*width;emitParticle('ember',x,height-lava.level,{vx:randomRange(-.5,.5),vy:randomRange(-2.6,-.8),size:1.5,life:60});}}
  }
  baseParticleUpdate();
  for(const fx of effects){
    if(fx.delay>0)continue;
    if(fx.type==='flame'||fx.type==='ember')fx.x+=Math.sin(simulationTick*.09+(fx.phase||0))*.25;
    if(fx.type==='smoke'){fx.size+=.07;fx.x+=Math.sin(simulationTick*.025+(fx.phase||0))*.2;}
  }
  if(effects.length>particleBudget())effects.splice(0,effects.length-particleBudget());
};
const baseExplosion=spawnExplosion;
spawnExplosion=function(x,y,radius,force,damage,color,profile){
  baseExplosion(x,y,radius,force,damage,color,profile);
  // Brief burning debris becomes smoke after the blast's initial flash.
  igniteFire(x,Math.min(height-28,y+20),1800,Math.min(45,radius*.15),false);
};
const baseImpact=triggerImpactVisual;
triggerImpactVisual=function(node,amount,color){
  baseImpact(node,amount,color);
  if(!node||amount<3||simulationTick-(node.lastSparkTick??-20)<7)return;
  node.lastSparkTick=simulationTick;
  for(let i=0;i<Math.min(10,Math.ceil(amount));i++)emitParticle('spark',node.x,node.y,{vx:randomRange(-4,4),vy:randomRange(-4,1),size:randomRange(1,2),life:randomRange(12,25),gravity:.14,drag:.95,color:'#ffe2a0'});
};
const baseBuildArena=buildArena;
buildArena=function(){fireSources.length=0;baseBuildArena();};
// Pixel-art effects: hard-edged blobs and stepped flat colours instead of soft gradients.
const fxPixel=3;
const flameSteps=['#fff4c4','#ffd23f','#ff8a1f','#e4461c','#9b1f1f','#4a1414'];
const smokeSteps=['#6b6f7a','#565a66','#444854'];
function steppedColor(steps,progress){return steps[Math.min(steps.length-1,Math.max(0,Math.floor(progress*steps.length)))];}
function snapPixel(v){return Math.round(v/fxPixel)*fxPixel;}
function pixelBlob(x,y,r,color){
  const cx=snapPixel(x),cy=snapPixel(y),steps=Math.max(1,Math.round(r/fxPixel));
  ctx.fillStyle=color;
  for(let i=-steps;i<steps;i++){const t=(i+.5)/steps,half=Math.round(Math.sqrt(1-t*t)*steps)*fxPixel;if(half>0)ctx.fillRect(cx-half,cy+i*fxPixel,half*2,fxPixel);}
}
function drawSmokeParticle(fx){
  const progress=1-fx.life/(fx.maxLife||100),r=Math.max(fxPixel,fx.size*.55);
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=Math.min(1,progress*7)*(1-progress)*.42;
  pixelBlob(fx.x,fx.y,r,steppedColor(smokeSteps,progress));
}
drawEffects=function(){
  ctx.save();
  // Smoke stays behind hot particles so bright flame cores remain readable.
  for(const fx of effects)if(fx.type==='smoke'&&!(fx.delay>0))drawSmokeParticle(fx);
  for(const fx of effects){
    if(fx.type==='smoke'||fx.delay>0)continue;
    const alpha=Math.min(1,Math.max(0,fx.life/(fx.maxLife||30))),progress=1-alpha;
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    if(fx.type==='flame'){
      const r=Math.max(fxPixel,fx.size*.7);
      pixelBlob(fx.x,fx.y,r,steppedColor(flameSteps,progress));
      if(progress<.35)pixelBlob(fx.x,fx.y-r*.15,r*.45,flameSteps[0]);
    }else if(fx.type==='fire'){
      const r=Math.max(fxPixel,(fx.radius||fx.size*1.8)*.4);
      pixelBlob(fx.x,fx.y,r,steppedColor(flameSteps,progress));
      if(progress<.25)pixelBlob(fx.x,fx.y,r*.5,flameSteps[0]);
    }else if(fx.type==='impact'){
      const r=Math.max(fxPixel,(fx.radius||fx.size*1.8)*.5);
      ctx.globalAlpha=alpha;pixelBlob(fx.x,fx.y,r,fx.color);pixelBlob(fx.x,fx.y,r*.4,'#fff4c4');
    }else if(fx.type==='spark'||fx.type==='ember'){
      const trail=fx.type==='spark'?2.3:1.2,s=fx.type==='spark'?fxPixel:Math.max(2,fx.size||2);
      ctx.globalAlpha=alpha;ctx.globalCompositeOperation='screen';
      pathLine(snapPixel(fx.x-(fx.vx||0)*trail),snapPixel(fx.y-(fx.vy||0)*trail),snapPixel(fx.x),snapPixel(fx.y),steppedColor(flameSteps,progress*.6+.15),2);
      ctx.fillStyle=fx.type==='spark'?'#fff4c4':'#ffd23f';ctx.fillRect(snapPixel(fx.x),snapPixel(fx.y),s,s);
    }else if(fx.type==='ring'){
      // Dotted pixel ring for shockwaves.
      const dots=Math.max(16,Math.round(fx.radius*.6));
      ctx.globalAlpha=alpha;ctx.fillStyle=fx.color;
      for(let i=0;i<dots;i++){const a=i/dots*Math.PI*2;ctx.fillRect(snapPixel(fx.x+Math.cos(a)*fx.radius),snapPixel(fx.y+Math.sin(a)*fx.radius*.8),fxPixel,fxPixel);}
    }else{ctx.globalAlpha=alpha;ctx.fillStyle=fx.color;ctx.fillRect(snapPixel(fx.x),snapPixel(fx.y),Math.max(fxPixel,snapPixel(fx.size||3)),Math.max(fxPixel,snapPixel(fx.size||3)));}
  }
  // Local warm light is subtle and confined to active fire sources.
  if(visual.quality==='high')for(const f of fireSources){ctx.globalAlpha=1;glowOrb(f.x,f.y-15,100,'#ff7c24',.08);}
  ctx.restore();
};
document.getElementById('fireButton').addEventListener('click',()=>{
  igniteFire(Math.max(50,Math.min(width-50,pointer.x||width*.5)),height-28);
  showToast('Fire ignited · burns for 6 seconds');
});
