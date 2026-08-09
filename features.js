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
  const undoBtn=$('#undoBtn');
  const redoBtn=$('#redoBtn');
  const exportBtn=$('#exportBtn');
  const importBtn=$('#importBtn');
  const importInput=$('#importInput');
  const duplicateWarning=$('#duplicateWarning');
  const historyEl=$('#history');
  const mainSpinBtn=$('#mainSpinBtn');
  const wheel=$('#wheel');
  const wheelWrap=$('#wheelWrap');
  const resultValue=$('#resultValue');
  const toast=$('#toast');
  const legacyFirst=$('#spinBtn');
  const legacyAgain=$('#spinAgainBtn');
  const rangeStartInput=$('#rangeStartInput');
  const rangeEndInput=$('#rangeEndInput');
  if(!itemsInput||!titleInput)return;

  let toastTimer=null;
  function showToast(message){if(!toast)return;clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
  function values(){return itemsInput.value.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,250)}

  function updateDuplicateWarning(){
    if(!duplicateWarning)return;
    const map=new Map();
    for(const value of values()){const key=value.toLocaleLowerCase('es'),entry=map.get(key)||{label:value,count:0};entry.count++;map.set(key,entry)}
    const duplicates=[...map.values()].filter(v=>v.count>1);
    if(!duplicates.length){duplicateWarning.textContent='';duplicateWarning.classList.remove('show');return}
    const preview=duplicates.slice(0,3).map(v=>`${v.label} (${v.count})`).join(', ');
    duplicateWarning.textContent=duplicates.length===1?`Duplicado detectado: ${preview}.`:`${duplicates.length} duplicados detectados: ${preview}${duplicates.length>3?'…':''}.`;duplicateWarning.classList.add('show');
  }
  itemsInput.addEventListener('input',updateDuplicateWarning);updateDuplicateWarning();

  async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch(_){try{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}catch(__){return false}}}

  copyHistoryBtn?.addEventListener('click',async()=>{
    const entries=[...(historyEl?.querySelectorAll('.history-chip')||[])].map(el=>({number:Number(el.dataset.number)||0,text:el.textContent.trim()})).filter(v=>v.text).sort((a,b)=>a.number-b.number);
    if(!entries.length){showToast('Todavía no hay resultados para copiar.');return}
    const ok=await copyText(entries.map(v=>v.text).join('\n'));
    if(ok){copyHistoryBtn.classList.add('is-done');copyHistoryBtn.textContent='Copiado ✓';setTimeout(()=>{copyHistoryBtn.classList.remove('is-done');copyHistoryBtn.textContent='Copiar'},1500)}
    showToast(ok?'Historial numerado copiado.':'No se pudo copiar el historial.');
  });

  function transitionActive(){return ['is-removing','is-gap','is-closing'].some(c=>wheelWrap?.classList.contains(c))}
  function spinningNow(){return Boolean(legacyFirst?.disabled&&legacyAgain?.disabled&&!transitionActive())}

  mixListBtn?.addEventListener('click',()=>{
    if(document.body.classList.contains('edition-locked')){showToast('Desbloquea la edición para mezclar la lista.');return}
    if(spinningNow()||transitionActive()){showToast('Espera a que termine el proceso actual.');return}
    const list=values();if(list.length<2){showToast('Agrega al menos 2 opciones para mezclar.');return}
    for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
    itemsInput.value=list.join('\n');itemsInput.dispatchEvent(new Event('input',{bubbles:true}));showToast('Lista mezclada.');
  });

  shareBtn?.addEventListener('click',async()=>{
    const config={title:titleInput.value.trim()||'La Ruleta Aleatoria',items:values(),autoHide:Boolean(autoHideToggle?.checked)};
    if(config.items.length<1){showToast('Agrega opciones antes de compartir.');return}
    const base=`${location.origin}${location.pathname}${location.search}`,url=`${base}#config=${encodeURIComponent(JSON.stringify(config))}`,ok=await copyText(url);showToast(ok?'Enlace de configuración copiado.':'No se pudo copiar el enlace.');
  });

  function loadSharedConfig(){
    if(!location.hash.startsWith('#config='))return;
    try{const config=JSON.parse(decodeURIComponent(location.hash.slice(8)));if(!Array.isArray(config.items)||!config.items.length)return;itemsInput.value=config.items.slice(0,250).map(v=>String(v).trim()).filter(Boolean).join('\n');itemsInput.dispatchEvent(new Event('input',{bubbles:true}));if(typeof config.title==='string'&&config.title.trim()){titleInput.value=config.title.slice(0,80);titleInput.dispatchEvent(new Event('input',{bubbles:true}))}if(autoHideToggle&&typeof config.autoHide==='boolean'){autoHideToggle.checked=config.autoHide;autoHideToggle.dispatchEvent(new Event('change',{bubbles:true}))}updateDuplicateWarning();setTimeout(()=>showToast('Configuración compartida cargada.'),120)}catch(_){}
  }

  let locked=sessionStorage.getItem('ruleta-edit-locked')==='1';
  function applyLock(){document.body.classList.toggle('edition-locked',locked);itemsInput.readOnly=locked;titleInput.readOnly=locked;if(rangeStartInput)rangeStartInput.readOnly=locked;if(rangeEndInput)rangeEndInput.readOnly=locked;if(lockEditBtn){lockEditBtn.textContent=locked?'Desbloquear edición':'Bloquear edición';lockEditBtn.classList.toggle('is-locked',locked);lockEditBtn.setAttribute('aria-pressed',String(locked))}sessionStorage.setItem('ruleta-edit-locked',locked?'1':'0')}
  lockEditBtn?.addEventListener('click',()=>{locked=!locked;applyLock();showToast(locked?'Edición bloqueada.':'Edición desbloqueada.')});applyLock();

  const blockedWhenLocked='#clearBtn,#restoreBtn,#mixListBtn,#rangeGenerateBtn,#importBtn,.preset';
  document.addEventListener('click',event=>{if(!locked)return;const target=event.target instanceof Element?event.target.closest(blockedWhenLocked):null;if(!target)return;event.preventDefault();event.stopImmediatePropagation();showToast('La edición está bloqueada.')},true);

  function syncUndoRedo(){const api=window.RuletaApp;if(undoBtn)undoBtn.disabled=!api?.canUndo?.();if(redoBtn)redoBtn.disabled=!api?.canRedo?.()}
  undoBtn?.addEventListener('click',()=>{const ok=window.RuletaApp?.undo?.();showToast(ok?'Último resultado deshecho.':'No hay resultados para deshacer.');syncUndoRedo()});
  redoBtn?.addEventListener('click',()=>{const ok=window.RuletaApp?.redo?.();showToast(ok?'Resultado rehecho.':'No hay resultados para rehacer.');syncUndoRedo()});
  document.addEventListener('ruleta:statechange',syncUndoRedo);syncUndoRedo();

  const SOUND_KEY='ruleta-sound-enabled';
  let soundEnabled=localStorage.getItem(SOUND_KEY)!=='0';
  if(soundToggle){soundToggle.checked=soundEnabled;soundToggle.addEventListener('change',()=>{soundEnabled=soundToggle.checked;localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0');if(!soundEnabled)stopSpinSound()})}

  function safeFilename(value){return String(value||'ruleta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'ruleta'}

  exportBtn?.addEventListener('click',()=>{
    const state=window.RuletaApp?.exportState?.();if(!state){showToast('No se pudo preparar la ruleta para exportar.');return}
    const pack={type:'ruleta-aleatoria',fileFormatVersion:1,appVersion:window.RULETA_ASSET_VERSION||'unknown',exportedAt:new Date().toISOString(),state,settings:{sound:soundEnabled,locked,rangeStart:rangeStartInput?.value||'1',rangeEnd:rangeEndInput?.value||'12'}};
    const text=`RULETA ALEATORIA — ARCHIVO DE CONFIGURACIÓN\nFormato: 1\nNo modifiques el contenido JSON si deseas una restauración fiel.\n---\n${JSON.stringify(pack,null,2)}\n`,blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${safeFilename(state.title)}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Ruleta exportada en TXT.');
  });

  importBtn?.addEventListener('click',()=>{if(locked){showToast('Desbloquea la edición para importar una ruleta.');return}importInput?.click()});
  function parseImportedText(text){const raw=String(text||'').trim(),marker='---',body=raw.includes(marker)?raw.slice(raw.indexOf(marker)+marker.length).trim():raw,pack=JSON.parse(body);if(pack?.type!=='ruleta-aleatoria'||pack?.fileFormatVersion!==1||!pack?.state)throw new Error('Formato no compatible');return pack}
  importInput?.addEventListener('change',async()=>{
    const file=importInput.files?.[0];if(!file)return;
    try{if(!window.confirm('Importar esta ruleta reemplazará la sesión actual. ¿Continuar?'))return;const pack=parseImportedText(await file.text()),ok=window.RuletaApp?.importState?.(pack.state);if(!ok)throw new Error('No se pudo restaurar el estado');if(typeof pack.settings?.sound==='boolean'){soundEnabled=pack.settings.sound;if(soundToggle)soundToggle.checked=soundEnabled;localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0');if(!soundEnabled)stopSpinSound()}if(rangeStartInput&&pack.settings?.rangeStart!=null)rangeStartInput.value=String(pack.settings.rangeStart);if(rangeEndInput&&pack.settings?.rangeEnd!=null)rangeEndInput.value=String(pack.settings.rangeEnd);if(typeof pack.settings?.locked==='boolean'){locked=pack.settings.locked;applyLock()}updateDuplicateWarning();syncUndoRedo();showToast('Ruleta importada fielmente.')}catch(_){showToast('El archivo TXT no es una ruleta válida o compatible.')}finally{importInput.value=''}
  });

  let audioCtx=null,soundRaf=null,spinSoundToken=0,lastSectorKey=null,lastTickAt=0,spinStartedAt=0;
  const SOUND_PALETTE=[[255,138,128],[130,177,255],[185,246,202],[255,224,178],[225,190,231],[128,222,234],[255,209,128],[179,157,219],[165,214,167],[248,187,208],[144,202,249],[255,245,157]];
  function ensureAudio(){if(!soundEnabled)return null;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch(_){return null}}
  function tone(freq,duration=0.025,gain=.04,type='sine',delay=0){const ac=ensureAudio();if(!ac)return;const osc=ac.createOscillator(),amp=ac.createGain(),start=ac.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,start);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(gain,start+.004);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(amp);amp.connect(ac.destination);osc.start(start);osc.stop(start+duration+.01)}
  function sectorUnderPointer(){if(!wheel||!wheel.width)return null;try{const c=wheel.width/2,r=wheel.width*.485,x=Math.max(0,Math.min(wheel.width-1,Math.round(c))),y=Math.max(0,Math.min(wheel.height-1,Math.round(c-r*.82))),d=wheel.getContext('2d').getImageData(x,y,1,1).data;if(d[3]<80)return null;let best=0,bestDist=Infinity;for(let i=0;i<SOUND_PALETTE.length;i++){const p=SOUND_PALETTE[i],dr=d[0]-p[0],dg=d[1]-p[1],db=d[2]-p[2],dist=dr*dr+dg*dg+db*db;if(dist<bestDist){bestDist=dist;best=i}}return best}catch(_){return null}}
  function playSyncedTick(now){const gap=lastTickAt?now-lastTickAt:45,slow=Math.max(0,Math.min(1,(gap-45)/430)),frequency=880-220*slow,gain=.058-.014*slow;tone(frequency,.027,gain,'triangle');lastTickAt=now}
  function startSpinSound(){if(!soundEnabled||values().length<2)return;stopSpinSound();ensureAudio();const token=++spinSoundToken;spinStartedAt=performance.now();lastSectorKey=sectorUnderPointer();lastTickAt=0;playSyncedTick(spinStartedAt);function followWheel(now){if(token!==spinSoundToken||!soundEnabled)return;if(now-spinStartedAt>6200){stopSpinSound();return}const currentKey=sectorUnderPointer();if(currentKey!==null){if(lastSectorKey===null){lastSectorKey=currentKey}else if(currentKey!==lastSectorKey){if(now-lastTickAt>=28)playSyncedTick(now);lastSectorKey=currentKey}}soundRaf=requestAnimationFrame(followWheel)}soundRaf=requestAnimationFrame(followWheel)}
  function stopSpinSound(){spinSoundToken++;if(soundRaf){cancelAnimationFrame(soundRaf);soundRaf=null}lastSectorKey=null;lastTickAt=0}
  function winnerSound(){if(!soundEnabled)return;stopSpinSound();tone(660,.12,.062,'sine',0);tone(880,.14,.060,'sine',.09);tone(1100,.17,.056,'sine',.19)}

  function confirmReset(){return window.confirm('¿Reiniciar la ruleta? Se borrarán la lista actual, el historial y los valores ocultos.')}
  resetBtn?.addEventListener('click',event=>{if(!confirmReset()){event.preventDefault();event.stopImmediatePropagation();return}stopSpinSound()},true);
  document.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if((event.key==='r'||event.key==='R')&&tag!=='TEXTAREA'&&tag!=='INPUT'){if(!confirmReset()){event.preventDefault();event.stopImmediatePropagation();return}stopSpinSound()}},true);

  mainSpinBtn?.addEventListener('click',()=>{if(!mainSpinBtn.disabled)startSpinSound()},true);wheel?.addEventListener('click',()=>{if(values().length>=2)startSpinSound()},true);document.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if(event.code==='Space'&&tag!=='TEXTAREA'&&tag!=='INPUT'&&tag!=='BUTTON'&&values().length>=2)startSpinSound()},true);
  if(resultValue){const resultObserver=new MutationObserver(()=>{if(resultValue.textContent.trim())winnerSound()});resultObserver.observe(resultValue,{childList:true,characterData:true,subtree:true})}

  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});document.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});document.addEventListener('touchmove',e=>{if(e.touches?.length>1)e.preventDefault()},{passive:false});document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()},{passive:false});document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;if(['+','-','=','0'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation()}},true);let lastTouchEnd=0;document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<=320)e.preventDefault();lastTouchEnd=now},{passive:false});

  loadSharedConfig();
})();