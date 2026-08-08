(()=>{
  'use strict';

  const $=s=>document.querySelector(s);
  const baseCanvas=$('#wheel');
  const wheelWrap=$('#wheelWrap');
  const itemsInput=$('#itemsInput');
  const titleInput=$('#titleInput');
  const legacyFirst=$('#spinBtn');
  const legacyAgain=$('#spinAgainBtn');
  const mainSpinBtn=$('#mainSpinBtn');
  const resetBtn=$('#resetBtn');
  const autoHideToggle=$('#autoHideToggle');
  const historyEl=$('#history');
  const resultValue=$('#resultValue');
  const rangeStartInput=$('#rangeStartInput');
  const rangeEndInput=$('#rangeEndInput');
  const rangeGenerateBtn=$('#rangeGenerateBtn');
  if(!baseCanvas||!wheelWrap)return;

  let hasStarted=false;

  function syncMainSpin(){
    if(!mainSpinBtn||!legacyFirst||!legacyAgain)return;
    const chips=historyEl?.querySelectorAll('.history-chip').length||0;
    if(!legacyFirst.disabled&&chips===0)hasStarted=false;
    if(chips>0)hasStarted=true;
    mainSpinBtn.textContent=hasStarted?'Girar otra vez':'Iniciar';
    mainSpinBtn.disabled=legacyFirst.disabled&&legacyAgain.disabled;
  }

  mainSpinBtn?.addEventListener('click',()=>{
    if(!legacyFirst.disabled){hasStarted=true;syncMainSpin();legacyFirst.click();return}
    if(!legacyAgain.disabled){hasStarted=true;syncMainSpin();legacyAgain.click()}
  });

  const buttonObserver=new MutationObserver(syncMainSpin);
  if(legacyFirst)buttonObserver.observe(legacyFirst,{attributes:true,attributeFilter:['disabled']});
  if(legacyAgain)buttonObserver.observe(legacyAgain,{attributes:true,attributeFilter:['disabled']});

  resetBtn?.addEventListener('click',()=>{
    hasStarted=false;
    setTimeout(()=>{
      if(autoHideToggle){
        autoHideToggle.checked=true;
        autoHideToggle.dispatchEvent(new Event('change',{bubbles:true}));
      }
      syncMainSpin();
    },0);
  });

  rangeGenerateBtn?.addEventListener('click',()=>{
    const from=Number.parseInt(rangeStartInput?.value,10);
    const to=Number.parseInt(rangeEndInput?.value,10);
    if(!Number.isFinite(from)||!Number.isFinite(to))return showMiniToast('Escribe un número inicial y uno final.');
    if(from<1||to<1||from>250||to>250)return showMiniToast('Usa números entre 1 y 250.');
    if(from>to)return showMiniToast('El número inicial debe ser menor o igual al final.');
    const count=to-from+1;
    if(count>250)return showMiniToast('La lista puede tener como máximo 250 números.');
    const values=Array.from({length:count},(_,i)=>String(from+i));
    itemsInput.value=values.join('\n');
    itemsInput.dispatchEvent(new Event('input',{bubbles:true}));
    if(titleInput){titleInput.value=`Números ${from}–${to}`;titleInput.dispatchEvent(new Event('input',{bubbles:true}))}
    hasStarted=false;
    setTimeout(syncMainSpin,220);
  });

  for(const input of [rangeStartInput,rangeEndInput])input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rangeGenerateBtn?.click()}});

  function showMiniToast(message){
    const toast=$('#toast');if(!toast)return;
    toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);
  }

  let historyObserver;
  function putNewestAtEnd(){
    if(!historyEl)return;
    const chips=[...historyEl.querySelectorAll('.history-chip')];
    if(chips.length<2){syncMainSpin();return}
    historyObserver?.disconnect();
    chips.reverse().forEach(chip=>historyEl.appendChild(chip));
    historyObserver?.observe(historyEl,{childList:true});
    hasStarted=true;syncMainSpin();
  }
  if(historyEl){historyObserver=new MutationObserver(()=>queueMicrotask(putNewestAtEnd));historyObserver.observe(historyEl,{childList:true})}

  const fx=document.createElement('canvas');
  fx.id='fxCanvas';fx.setAttribute('aria-hidden','true');
  baseCanvas.insertAdjacentElement('afterend',fx);
  const fctx=fx.getContext('2d');
  let fxToken=0,wasRemoving=false;

  function resizeFx(){if(fx.width!==baseCanvas.width||fx.height!==baseCanvas.height){fx.width=baseCanvas.width;fx.height=baseCanvas.height}}
  function clearFx(){fxToken++;resizeFx();fctx.clearRect(0,0,fx.width,fx.height)}

  function sampleWinnerColor(){
    try{
      const c=baseCanvas.width/2,r=baseCanvas.width*.485,x=Math.round(c),y=Math.round(c-r*.68);
      const d=baseCanvas.getContext('2d').getImageData(x,y,1,1).data;
      return [d[0],d[1],d[2]];
    }catch(_){return [130,177,255]}
  }

  function startDissolve(){
    const token=++fxToken;resizeFx();
    const count=Math.max(2,itemsInput.value.split(/\n+/).map(v=>v.trim()).filter(Boolean).length);
    const size=fx.width,c=size/2,r=size*.485,arc=Math.PI*2/count,start=-Math.PI/2-arc/2,end=-Math.PI/2+arc/2;
    const [cr,cg,cb]=sampleWinnerColor();
    const holes=Array.from({length:190},()=>({
      a:start+Math.random()*arc,
      rr:r*(.20+Math.random()*.76),
      s:size*(.0035+Math.random()*.009),
      at:Math.random()*.86
    }));
    const dust=Array.from({length:90},()=>({
      a:start+Math.random()*arc,
      rr:r*(.28+Math.random()*.67),
      s:size*(.0018+Math.random()*.0045),
      at:.15+Math.random()*.72,
      drift:(Math.random()-.5)*size*.035
    }));
    const duration=1850,startTime=performance.now();

    function frame(now){
      if(token!==fxToken)return;
      const p=Math.min(1,(now-startTime)/duration),ease=p*p*(3-2*p);
      fctx.clearRect(0,0,size,size);
      fctx.save();
      fctx.beginPath();fctx.moveTo(c,c);fctx.arc(c,c,r,start,end);fctx.closePath();
      fctx.fillStyle=`rgba(${cr},${cg},${cb},${.96*(1-ease*.18)})`;fctx.fill();
      fctx.globalCompositeOperation='destination-out';
      for(const h of holes){if(p<h.at)continue;const q=Math.min(1,(p-h.at)/Math.max(.08,1-h.at)),rad=h.s*(.8+5*q);fctx.beginPath();fctx.arc(c+Math.cos(h.a)*h.rr,c+Math.sin(h.a)*h.rr,rad,0,Math.PI*2);fctx.fillStyle=`rgba(0,0,0,${.35+.65*q})`;fctx.fill()}
      fctx.restore();

      fctx.save();
      for(const d of dust){if(p<d.at)continue;const q=Math.min(1,(p-d.at)/Math.max(.1,1-d.at)),x0=c+Math.cos(d.a)*d.rr,y0=c+Math.sin(d.a)*d.rr,x=x0+d.drift*q+Math.cos(d.a)*size*.045*q,y=y0-size*.045*q+Math.sin(d.a)*size*.025*q;fctx.globalAlpha=(1-q)*.9;fctx.fillStyle=q<.45?`rgb(${cr},${cg},${cb})`:'rgba(255,255,255,.9)';fctx.beginPath();fctx.arc(x,y,d.s*(1+.7*q),0,Math.PI*2);fctx.fill()}
      fctx.restore();

      fctx.save();fctx.globalAlpha=Math.max(0,.8-p);fctx.strokeStyle='rgba(255,255,255,.9)';fctx.lineWidth=Math.max(2,size*.006);fctx.beginPath();fctx.arc(c,c,r*.985,start+.01,end-.01);fctx.stroke();fctx.restore();

      if(p<1)requestAnimationFrame(frame);else clearFx();
    }
    requestAnimationFrame(frame);
  }

  const classObserver=new MutationObserver(()=>{
    const removing=wheelWrap.classList.contains('is-removing');
    if(removing&&!wasRemoving)startDissolve();
    if(!removing&&!wheelWrap.classList.contains('is-gap'))clearFx();
    wasRemoving=removing;
  });
  classObserver.observe(wheelWrap,{attributes:true,attributeFilter:['class']});

  window.addEventListener('resize',clearFx);
  syncMainSpin();
})();
