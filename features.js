(()=>{
  'use strict';

  const $=s=>document.querySelector(s);
  const itemsInput=$('#itemsInput');
  const titleInput=$('#titleInput');
  const autoHideToggle=$('#autoHideToggle');
  const soundToggle=$('#soundToggle');
  const resetBtn=$('#resetBtn');
  const mixListBtn=$('#mixListBtn');
  const shareBtn=$('#shareBtn');
  const lockEditBtn=$('#lockEditBtn');
  const copyHistoryBtn=$('#copyHistoryBtn');
  const duplicateWarning=$('#duplicateWarning');
  const historyEl=$('#history');
  const mainSpinBtn=$('#mainSpinBtn');
  const wheel=$('#wheel');
  const wheelWrap=$('#wheelWrap');
  const resultValue=$('#resultValue');
  const toast=$('#toast');
  const legacyFirst=$('#spinBtn');
  const legacyAgain=$('#spinAgainBtn');
  if(!itemsInput||!titleInput)return;

  let toastTimer=null;
  function showToast(message){
    if(!toast)return;
    clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
  }

  function values(){return itemsInput.value.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,250)}

  function updateDuplicateWarning(){
    if(!duplicateWarning)return;
    const map=new Map();
    for(const value of values()){
      const key=value.toLocaleLowerCase('es');
      const entry=map.get(key)||{label:value,count:0};entry.count++;map.set(key,entry);
    }
    const duplicates=[...map.values()].filter(v=>v.count>1);
    if(!duplicates.length){duplicateWarning.textContent='';duplicateWarning.classList.remove('show');return}
    const preview=duplicates.slice(0,3).map(v=>`${v.label} (${v.count})`).join(', ');
    duplicateWarning.textContent=duplicates.length===1?`Duplicado detectado: ${preview}.`:`${duplicates.length} duplicados detectados: ${preview}${duplicates.length>3?'…':''}.`;
    duplicateWarning.classList.add('show');
  }
  itemsInput.addEventListener('input',updateDuplicateWarning);
  updateDuplicateWarning();

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true}catch(_){
      try{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}catch(__){return false}
    }
  }

  copyHistoryBtn?.addEventListener('click',async()=>{
    const entries=[...(historyEl?.querySelectorAll('.history-chip')||[])].map(el=>el.textContent.trim()).filter(Boolean);
    if(!entries.length){showToast('Todavía no hay resultados para copiar.');return}
    const ok=await copyText(entries.join('\n'));
    showToast(ok?'Historial copiado.':'No se pudo copiar el historial.');
  });

  function transitionActive(){return ['is-removing','is-gap','is-closing'].some(c=>wheelWrap?.classList.contains(c))}
  function spinningNow(){return Boolean(legacyFirst?.disabled&&legacyAgain?.disabled&&!transitionActive())}

  mixListBtn?.addEventListener('click',()=>{
    if(document.body.classList.contains('edition-locked')){showToast('Desbloquea la edición para mezclar la lista.');return}
    if(spinningNow()||transitionActive()){showToast('Espera a que termine el proceso actual.');return}
    const list=values();
    if(list.length<2){showToast('Agrega al menos 2 opciones para mezclar.');return}
    for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
    itemsInput.value=list.join('\n');itemsInput.dispatchEvent(new Event('input',{bubbles:true}));
    showToast('Lista mezclada.');
  });

  shareBtn?.addEventListener('click',async()=>{
    const config={title:titleInput.value.trim()||'La Ruleta Aleatoria',items:values(),autoHide:Boolean(autoHideToggle?.checked)};
    if(config.items.length<1){showToast('Agrega opciones antes de compartir.');return}
    const base=`${location.origin}${location.pathname}${location.search}`;
    const url=`${base}#config=${encodeURIComponent(JSON.stringify(config))}`;
    const ok=await copyText(url);
    showToast(ok?'Enlace de configuración copiado.':'No se pudo copiar el enlace.');
  });

  function loadSharedConfig(){
    if(!location.hash.startsWith('#config='))return;
    try{
      const config=JSON.parse(decodeURIComponent(location.hash.slice(8)));
      if(!Array.isArray(config.items)||!config.items.length)return;
      itemsInput.value=config.items.slice(0,250).map(v=>String(v).trim()).filter(Boolean).join('\n');
      itemsInput.dispatchEvent(new Event('input',{bubbles:true}));
      if(typeof config.title==='string'&&config.title.trim()){titleInput.value=config.title.slice(0,80);titleInput.dispatchEvent(new Event('input',{bubbles:true}))}
      if(autoHideToggle&&typeof config.autoHide==='boolean'){autoHideToggle.checked=config.autoHide;autoHideToggle.dispatchEvent(new Event('change',{bubbles:true}))}
      updateDuplicateWarning();
      setTimeout(()=>showToast('Configuración compartida cargada.'),120);
    }catch(_){}
  }

  let locked=sessionStorage.getItem('ruleta-edit-locked')==='1';
  function applyLock(){
    document.body.classList.toggle('edition-locked',locked);
    itemsInput.readOnly=locked;titleInput.readOnly=locked;
    const rangeStart=$('#rangeStartInput'),rangeEnd=$('#rangeEndInput');
    if(rangeStart)rangeStart.readOnly=locked;if(rangeEnd)rangeEnd.readOnly=locked;
    if(lockEditBtn){lockEditBtn.textContent=locked?'Desbloquear edición':'Bloquear edición';lockEditBtn.classList.toggle('is-locked',locked);lockEditBtn.setAttribute('aria-pressed',String(locked))}
    sessionStorage.setItem('ruleta-edit-locked',locked?'1':'0');
  }
  lockEditBtn?.addEventListener('click',()=>{locked=!locked;applyLock();showToast(locked?'Edición bloqueada.':'Edición desbloqueada.')});
  applyLock();

  const blockedWhenLocked='#clearBtn,#restoreBtn,#mixListBtn,#rangeGenerateBtn,.preset';
  document.addEventListener('click',event=>{
    if(!locked)return;
    const target=event.target instanceof Element?event.target.closest(blockedWhenLocked):null;
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();showToast('La edición está bloqueada.');
  },true);

  const SOUND_KEY='ruleta-sound-enabled';
  let soundEnabled=localStorage.getItem(SOUND_KEY)!=='0';
  if(soundToggle){soundToggle.checked=soundEnabled;soundToggle.addEventListener('change',()=>{soundEnabled=soundToggle.checked;localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0');if(!soundEnabled)stopSpinSound()})}

  let audioCtx=null,tickTimer=null,tickStopTimer=null;
  function ensureAudio(){
    if(!soundEnabled)return null;
    try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch(_){return null}
  }
  function tone(freq,duration=0.025,gain=.025,type='sine',delay=0){
    const ac=ensureAudio();if(!ac)return;
    const osc=ac.createOscillator(),amp=ac.createGain(),start=ac.currentTime+delay;
    osc.type=type;osc.frequency.setValueAtTime(freq,start);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(gain,start+.004);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(amp);amp.connect(ac.destination);osc.start(start);osc.stop(start+duration+.01);
  }
  function tick(){tone(760,0.022,.018,'triangle')}
  function startSpinSound(){
    if(!soundEnabled||values().length<2)return;
    stopSpinSound();ensureAudio();tick();tickTimer=setInterval(tick,92);tickStopTimer=setTimeout(stopSpinSound,6500);
  }
  function stopSpinSound(){if(tickTimer){clearInterval(tickTimer);tickTimer=null}if(tickStopTimer){clearTimeout(tickStopTimer);tickStopTimer=null}}
  function winnerSound(){if(!soundEnabled)return;stopSpinSound();tone(660,.11,.035,'sine',0);tone(880,.13,.035,'sine',.09);tone(1100,.16,.03,'sine',.19)}

  function confirmReset(){return window.confirm('¿Reiniciar la ruleta? Se borrarán la lista actual, el historial y los valores ocultos.')}
  resetBtn?.addEventListener('click',event=>{
    if(!confirmReset()){event.preventDefault();event.stopImmediatePropagation();return}
    stopSpinSound();
  },true);
  document.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName;
    if((event.key==='r'||event.key==='R')&&tag!=='TEXTAREA'&&tag!=='INPUT'){
      if(!confirmReset()){event.preventDefault();event.stopImmediatePropagation();return}
      stopSpinSound();
    }
  },true);

  mainSpinBtn?.addEventListener('click',()=>{if(!mainSpinBtn.disabled)startSpinSound()},true);
  wheel?.addEventListener('click',()=>{if(values().length>=2)startSpinSound()},true);
  document.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName;
    if(event.code==='Space'&&tag!=='TEXTAREA'&&tag!=='INPUT'&&tag!=='BUTTON'&&values().length>=2)startSpinSound();
  },true);

  if(resultValue){
    const resultObserver=new MutationObserver(()=>{
      if(resultValue.textContent.trim())winnerSound();
    });
    resultObserver.observe(resultValue,{childList:true,characterData:true,subtree:true});
  }

  loadSharedConfig();
})();
