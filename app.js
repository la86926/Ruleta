(()=>{
  'use strict';

  const $=s=>document.querySelector(s);
  const canvas=$('#wheel'),ctx=canvas.getContext('2d'),wheelWrap=$('#wheelWrap'),itemsInput=$('#itemsInput'),titleInput=$('#titleInput'),spinBtn=$('#spinBtn'),resetBtn=$('#resetBtn'),clearBtn=$('#clearBtn'),restoreBtn=$('#restoreBtn'),autoHideToggle=$('#autoHideToggle'),itemCount=$('#itemCount'),resultCard=$('#resultCard'),resultValue=$('#resultValue'),spinAgainBtn=$('#spinAgainBtn'),hideWinnerBtn=$('#hideWinnerBtn'),historyEl=$('#history'),clearHistoryBtn=$('#clearHistoryBtn'),fullscreenBtn=$('#fullscreenBtn'),emptyWheel=$('#emptyWheel'),presetGrid=$('#presetGrid'),toast=$('#toast'),spinHint=$('#spinHint'),numberCountInput=$('#numberCountInput'),generateNumbersBtn=$('#generateNumbersBtn');

  const DEFAULT_ITEMS=Array.from({length:12},(_,i)=>String(i+1));
  const PALETTE=['#FF8A80','#82B1FF','#B9F6CA','#FFE0B2','#E1BEE7','#80DEEA','#FFD180','#B39DDB','#A5D6A7','#F8BBD0','#90CAF9','#FFF59D'];
  const STORAGE_KEY='ruleta-state';
  const LEGACY_STORAGE_KEYS=['ruleta-state-v7','ruleta-state-v6','ruleta-state-v4','ruleta-state-v3','ruleta-state-v2','ruleta-state-v1'];
  const STATE_FORMAT_VERSION=2;

  const PRESETS={
    'Números 1–12':DEFAULT_ITEMS,
    'Sí / No':['Sí','No'],
    'Ciudades':['Lima','Piura','Cusco','Arequipa','Trujillo','Chiclayo','Iquitos','Tacna'],
    'Animales':['Perro','Gato','León','Elefante','Delfín','Águila','Conejo','Tigre'],
    'Emojis':['😀','😂','😍','😎','🤔','🥳','😴','🤩','🙃','🔥'],
    'Comidas':['Pizza','Hamburguesa','Tacos','Ceviche','Pasta','Pollo','Sushi','Ensalada'],
    'Carnes':['Pollo','Res','Cerdo','Pavo','Pescado','Cordero'],
    'Frutas':['Mango','Manzana','Plátano','Fresa','Piña','Uva','Sandía','Naranja'],
    'Vegetales':['Zanahoria','Brócoli','Tomate','Pepino','Espinaca','Pimiento','Lechuga'],
    'Postres':['Helado','Torta','Brownie','Flan','Gelatina','Cheesecake','Galletas'],
    'Actividades':['Caminar','Leer','Cocinar','Ver una película','Escuchar música','Dibujar','Ejercicio'],
    'Planes con amigos':['Karaoke','Película','Juegos de mesa','Paseo','Cocinar juntos','Fotos','Trivia'],
    'Géneros de películas':['Acción','Comedia','Drama','Terror','Ciencia ficción','Romance','Animación','Suspenso'],
    'Categorías para mímica':['Animal','Película','Profesión','Objeto','Deporte','Lugar','Personaje','Acción'],
    'Preferencias':['Viajar','Quedarte en casa','Dulce','Salado','Playa','Montaña','Mañana','Noche'],
    'Temas personales':['Viajes','Comida','Escuela','Trabajo','Música','Películas','Tecnología','Amistad'],
    'Participantes':['Persona 1','Persona 2','Persona 3','Persona 4','Persona 5','Persona 6'],
    'Categorías':['Nombre','Animal','Ciudad','Comida','Objeto','Profesión','Color','Marca'],
    'Géneros musicales':['Rock','Pop','Balada','Salsa','Cumbia','Reggaetón','Clásica','Años 80'],
    'Objetos para buscar':['Algo rojo','Algo pequeño','Algo suave','Algo antiguo','Algo brillante','Algo de madera','Algo redondo'],
    'Orden de exposición':['Equipo 1','Equipo 2','Equipo 3','Equipo 4','Equipo 5','Equipo 6'],
    'Números 1–20':Array.from({length:20},(_,i)=>String(i+1)),
    'Colores':['Rojo','Azul','Verde','Amarillo','Morado','Naranja','Rosa','Negro'],
    'Temas de conversación':['Viajes','Música','Comida','Películas','Metas','Hobbies','Infancia','Tecnología'],
    'Tareas del hogar':['Barrer','Trapear','Lavar platos','Ordenar','Sacar basura','Limpiar mesa','Cocinar'],
    'Días de la semana':['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'],
    'Meses':['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    'Turnos':['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto','Séptimo','Octavo']
  };

  let colorCursor=0;
  let items=DEFAULT_ITEMS.map(makeItem),hiddenItems=[],history=[],lastWinner=null,rotation=0;
  let spinning=false,transitioning=false,hasSpun=false,raf=null,toastTimer=null,animationToken=0,pendingHideId=null;
  let undoStack=[],redoStack=[];

  function makeId(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
  function makeItem(label,color,id){return{id:id||makeId(),label:String(label).trim(),color:isUsableColor(color)?color:PALETTE[(colorCursor++)%PALETTE.length]}}
  function isUsableColor(color){return typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)&&color.toLowerCase()!=='#000000'}
  function hydrateItem(value){if(typeof value==='string')return makeItem(value);const label=String(value?.label??'').trim();return makeItem(label,value?.color,value?.id)}
  function cloneItem(item){return{id:item.id,label:item.label,color:item.color}}
  function parseInput(){return itemsInput.value.split(/\n+/).map(v=>v.trim()).filter(Boolean).slice(0,250)}
  function isBusy(){return spinning||transitioning}
  function syncTextarea(){itemsInput.value=items.map(i=>i.label).join('\n')}
  function resetSpinState(){hasSpun=false;lastWinner=null;pendingHideId=null;resultCard.classList.remove('show','winner-pop','is-hiding');wheelWrap.classList.remove('repeat-mode','is-removing','is-gap','is-closing','just-settled')}

  function snapshot(){return{formatVersion:STATE_FORMAT_VERSION,title:titleInput.value,items:items.map(cloneItem),hidden:hiddenItems.map(cloneItem),history:history.map(entry=>({...entry})),autoHide:autoHideToggle.checked,rotation,hasSpun,lastWinner:lastWinner?cloneItem(lastWinner):null,resultVisible:resultCard.classList.contains('show'),resultValue:resultValue.textContent||''}}
  function notifyState(){document.dispatchEvent(new CustomEvent('ruleta:statechange',{detail:{canUndo:undoStack.length>0,canRedo:redoStack.length>0,historyLength:history.length}}))}
  function clearUndoRedo(){undoStack=[];redoStack=[];notifyState()}
  function recordBeforeSpin(){undoStack.push(snapshot());if(undoStack.length>30)undoStack.shift();redoStack=[];notifyState()}

  function restoreSnapshot(state,{save=true}={}){
    if(!state||!Array.isArray(state.items))return false;
    animationToken++;if(raf){cancelAnimationFrame(raf);raf=null}
    spinning=false;transitioning=false;pendingHideId=null;colorCursor=0;
    items=state.items.slice(0,250).map(hydrateItem).filter(i=>i.label);
    hiddenItems=Array.isArray(state.hidden)?state.hidden.slice(0,250).map(hydrateItem).filter(i=>i.label):[];
    history=Array.isArray(state.history)?state.history.slice(0,24).map(entry=>({label:String(entry?.label??''),at:Number(entry?.at)||Date.now()})).filter(e=>e.label):[];
    rotation=Number.isFinite(Number(state.rotation))?Number(state.rotation):0;
    titleInput.value=typeof state.title==='string'?state.title.slice(0,80):'La Ruleta Aleatoria';
    autoHideToggle.checked=typeof state.autoHide==='boolean'?state.autoHide:true;
    hasSpun=typeof state.hasSpun==='boolean'?state.hasSpun:history.length>0;
    lastWinner=state.lastWinner?hydrateItem(state.lastWinner):null;
    resultCard.classList.remove('winner-pop','is-hiding');wheelWrap.classList.remove('is-removing','is-gap','is-closing','just-settled');
    if(state.resultVisible||history.length){resultValue.textContent=String(state.resultValue||history[0]?.label||'');resultCard.classList.add('show')}else{resultValue.textContent='';resultCard.classList.remove('show')}
    syncTextarea();updateUI();if(save)persist();notifyState();return true;
  }

  function undoLastResult(){if(spinning)return false;if(transitioning)finishTransitionNow();if(!undoStack.length)return false;const target=undoStack.pop();redoStack.push(snapshot());const ok=restoreSnapshot(target);notifyState();return ok}
  function redoLastResult(){if(isBusy()||!redoStack.length)return false;const target=redoStack.pop();undoStack.push(snapshot());const ok=restoreSnapshot(target);notifyState();return ok}

  function rebuildFromInput(){if(spinning)return;if(transitioning)finishTransitionNow();colorCursor=0;items=parseInput().map(makeItem);hiddenItems=[];history=[];rotation=0;resetSpinState();clearUndoRedo();updateUI();persist()}

  function updateUI(){
    const n=items.length,busy=isBusy();
    itemCount.textContent=`${n} ${n===1?'opción':'opciones'}`;
    spinBtn.disabled=n<2||busy||hasSpun;spinAgainBtn.disabled=n<2||spinning;hideWinnerBtn.disabled=!lastWinner||!items.some(i=>i.id===lastWinner.id)||busy;restoreBtn.disabled=hiddenItems.length===0||busy;restoreBtn.textContent=`Mostrar ocultos (${hiddenItems.length})`;
    generateNumbersBtn.disabled=busy;autoHideToggle.disabled=busy;emptyWheel.style.display=n<1?'grid':'none';wheelWrap.classList.toggle('repeat-mode',hasSpun);spinHint.innerHTML=hasSpun?'Presiona <span class="kbd">Espacio</span> o usa “Girar otra vez”':'Haz clic en la rueda o presiona <span class="kbd">Espacio</span>';
    if(!transitioning)drawWheel();renderHistory();notifyState();
  }

  function fitCanvas(){const dpr=Math.min(window.devicePixelRatio||1,2),rect=canvas.getBoundingClientRect(),size=Math.max(320,Math.floor(rect.width*dpr));if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size}}
  function drawWheel(scene={}){fitCanvas();const renderItems=scene.items||items,size=canvas.width,center=size/2,radius=size*.485;ctx.clearRect(0,0,size,size);if(!renderItems.length){ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.fillStyle='#ececf0';ctx.fill();ctx.strokeStyle='#d8d8dd';ctx.lineWidth=Math.max(2,size*.003);ctx.stroke();return}if(scene.closing){drawClosingWheel(scene,center,radius,size);return}const arc=Math.PI*2/renderItems.length,fontSize=getFontSize(renderItems.length,size),labelStep=renderItems.length>70?Math.ceil(renderItems.length/55):1;for(let i=0;i<renderItems.length;i++){const item=renderItems[i],start=rotation-Math.PI/2+i*arc,end=start+arc,isTarget=scene.targetId===item.id;const opacity=isTarget&&typeof scene.targetOpacity==='number'?scene.targetOpacity:1;if(isTarget&&scene.hole)drawHole(start,end,center,radius,size,true);else drawSegment(item,start,end,center,radius,size,fontSize,i%labelStep===0,opacity)}drawOuterRing(center,radius,size)}
  function getFontSize(count,size){return Math.max(7,Math.min(size*.052,size*(.46/Math.max(5,Math.sqrt(count)))))}
  function drawOuterRing(center,radius,size){ctx.save();ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=Math.max(2,size*.003);ctx.stroke();ctx.restore()}
  function drawSegment(item,start,end,center,radius,size,fontSize,showLabel=true,opacity=1){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,opacity));ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,radius,start,end);ctx.closePath();ctx.fillStyle=isUsableColor(item.color)?item.color:'#82B1FF';ctx.fill();ctx.strokeStyle='rgba(0,0,0,.07)';ctx.lineWidth=Math.max(.5,size*.0012);ctx.stroke();if(showLabel&&opacity>.04)drawLabel(item.label,(start+end)/2,center,radius,fontSize,opacity);ctx.restore()}
  function drawHole(start,end,center,radius,size,showDash){if(end<=start)return;ctx.save();ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,radius,start,end);ctx.closePath();ctx.fillStyle='rgba(255,255,255,.22)';ctx.fill();ctx.strokeStyle='rgba(29,29,31,.22)';ctx.lineWidth=Math.max(1.4,size*.0026);if(showDash)ctx.setLineDash([Math.max(5,size*.007),Math.max(5,size*.007)]);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
  function drawLabel(label,angle,center,radius,baseFontSize,opacity=1){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,opacity));ctx.translate(center,center);ctx.rotate(angle);let fontSize=baseFontSize,maxWidth=Math.max(34,radius*.43),safe=label.length>32?`${label.slice(0,30)}…`:label;ctx.font=`700 ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;while(ctx.measureText(safe).width>maxWidth&&fontSize>7){fontSize-=1;ctx.font=`700 ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`}ctx.fillStyle='#111114';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(safe,radius*.64,0,maxWidth);ctx.restore()}

  function drawClosingWheel(scene,center,radius,size){const oldItems=scene.items,removedIndex=scene.removedIndex,t=scene.progress,remaining=oldItems.filter((_,i)=>i!==removedIndex);if(!remaining.length)return;const oldArc=Math.PI*2/oldItems.length,newArc=Math.PI*2/remaining.length,fontSize=getFontSize(remaining.length,size),labelStep=remaining.length>70?Math.ceil(remaining.length/55):1,ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,base=rotation-Math.PI/2;for(let oldIndex=0;oldIndex<oldItems.length;oldIndex++){if(oldIndex===removedIndex)continue;const item=oldItems[oldIndex],newIndex=oldIndex<removedIndex?oldIndex:oldIndex-1,oldStart=base+oldIndex*oldArc,oldEnd=oldStart+oldArc,newStart=base+newIndex*newArc,newEnd=newStart+newArc;drawSegment(item,oldStart+(newStart-oldStart)*ease,oldEnd+(newEnd-oldEnd)*ease,center,radius,size,fontSize,newIndex%labelStep===0,1)}if(t<.995){let leftBoundary,rightBoundary;if(removedIndex===0){leftBoundary=base}else{const oldEnd=base+removedIndex*oldArc,newEnd=base+removedIndex*newArc;leftBoundary=oldEnd+(newEnd-oldEnd)*ease}if(removedIndex===oldItems.length-1){rightBoundary=base+Math.PI*2}else{const oldStart=base+(removedIndex+1)*oldArc,newStart=base+removedIndex*newArc;rightBoundary=oldStart+(newStart-oldStart)*ease}if(rightBoundary-leftBoundary>.006)drawHole(leftBoundary,rightBoundary,center,radius,size,false)}drawOuterRing(center,radius,size)}

  function randomIndex(max){if(max<=0)return 0;if(crypto.getRandomValues){const maxUint=0xffffffff,limit=maxUint-(maxUint%max),arr=new Uint32Array(1);do crypto.getRandomValues(arr);while(arr[0]>=limit);return arr[0]%max}return Math.floor(Math.random()*max)}
  const mod=(n,m)=>((n%m)+m)%m;
  function finishTransitionNow(){if(!transitioning)return;animationToken++;if(raf){cancelAnimationFrame(raf);raf=null}if(pendingHideId){const index=items.findIndex(i=>i.id===pendingHideId);if(index>=0){const [removed]=items.splice(index,1);hiddenItems.push(removed);syncTextarea()}}pendingHideId=null;transitioning=false;resultCard.classList.remove('is-hiding');wheelWrap.classList.remove('is-removing','is-gap','is-closing','just-settled');drawWheel();updateUI();persist()}

  function spin(){
    if(spinning)return;if(transitioning)finishTransitionNow();if(items.length<2){showToast('Agrega al menos 2 opciones para girar.');return}recordBeforeSpin();
    animationToken++;spinning=true;lastWinner=null;pendingHideId=null;resultCard.classList.remove('show','winner-pop','is-hiding');updateUI();
    const winnerIndex=randomIndex(items.length),winner=items[winnerIndex],arc=Math.PI*2/items.length,centerAngleBase=winnerIndex*arc+arc/2,desired=mod(-centerAngleBase,Math.PI*2),current=mod(rotation,Math.PI*2),delta=mod(desired-current,Math.PI*2),extraTurns=6+randomIndex(3),startRotation=rotation,targetRotation=rotation+extraTurns*Math.PI*2+delta,duration=4200+randomIndex(700),startTime=performance.now(),ease=t=>1-Math.pow(1-t,5);
    function frame(now){const t=Math.min(1,(now-startTime)/duration);rotation=startRotation+(targetRotation-startRotation)*ease(t);drawWheel();if(t<1)raf=requestAnimationFrame(frame);else{rotation=targetRotation;spinning=false;hasSpun=true;wheelWrap.classList.add('repeat-mode');lastWinner=winner;history.unshift({label:winner.label,at:Date.now()});history=history.slice(0,24);resultValue.textContent=winner.label;resultCard.classList.add('show','winner-pop');updateUI();persist();presentWinner(winner)}}
    raf=requestAnimationFrame(frame);
  }

  async function presentWinner(winner){if(!autoHideToggle.checked||!items.some(i=>i.id===winner.id)){transitioning=false;pendingHideId=null;updateUI();return}const token=++animationToken;transitioning=true;pendingHideId=winner.id;updateUI();const ready=await wait(300,token);if(!ready||token!==animationToken)return;await animateRemoveInternal(winner.id,false,token,true)}
  function startFirstSpin(){spin()}
  async function animateHideItemById(id,announce=true){if(spinning)return;if(transitioning)finishTransitionNow();const token=++animationToken;transitioning=true;pendingHideId=id;updateUI();await animateRemoveInternal(id,announce,token,false)}
  async function animateRemoveInternal(id,announce,token,fromAuto){const removedIndex=items.findIndex(i=>i.id===id);if(removedIndex===-1){pendingHideId=null;transitioning=false;updateUI();return}const oldItems=items.slice(),removed=oldItems[removedIndex],newItems=oldItems.filter((_,i)=>i!==removedIndex);pendingHideId=id;resultCard.classList.add('is-hiding');wheelWrap.classList.add('is-removing');const fadeOk=await tween(1850,t=>{const eased=t<.15?t*.25:.0375+((t-.15)/.85)*.9625,smooth=eased*eased*(3-2*eased);drawWheel({items:oldItems,targetId:id,targetOpacity:1-smooth})},token);if(!fadeOk||token!==animationToken)return;wheelWrap.classList.remove('is-removing');wheelWrap.classList.add('is-gap');drawWheel({items:oldItems,targetId:id,hole:true});const gapOk=await wait(950,token);if(!gapOk||token!==animationToken)return;wheelWrap.classList.remove('is-gap');wheelWrap.classList.add('is-closing');const closeOk=await tween(1650,t=>drawWheel({items:oldItems,closing:true,removedIndex,progress:t}),token);if(!closeOk||token!==animationToken)return;items=newItems;hiddenItems.push(removed);pendingHideId=null;syncTextarea();resultCard.classList.remove('is-hiding');wheelWrap.classList.remove('is-closing');wheelWrap.classList.add('just-settled');setTimeout(()=>wheelWrap.classList.remove('just-settled'),850);transitioning=false;updateUI();persist();if(announce)showToast(`“${removed.label}” fue escondido.`);else if(fromAuto)showToast(`“${removed.label}” salió de la ruleta.`)}
  function tween(duration,draw,token){return new Promise(resolve=>{const start=performance.now();function step(now){if(token!==animationToken){resolve(false);return}const t=Math.min(1,(now-start)/duration);draw(t);if(t<1)raf=requestAnimationFrame(step);else resolve(true)}raf=requestAnimationFrame(step)})}
  function wait(ms,token){return new Promise(resolve=>setTimeout(()=>resolve(token===animationToken),ms))}

  function restoreHidden(){if(!hiddenItems.length||isBusy())return;colorCursor=items.length;items.push(...hiddenItems.map(v=>makeItem(v.label,v.color,v.id)));hiddenItems=[];syncTextarea();clearUndoRedo();showToast('Se restauraron todos los valores ocultos.');updateUI();persist()}
  function renderHistory(){historyEl.innerHTML='';if(!history.length){const e=document.createElement('span');e.className='history-empty';e.textContent='Aún no hay resultados.';historyEl.appendChild(e);return}history.slice(0,10).forEach((entry,index)=>{const chip=document.createElement('span');chip.className='history-chip';const number=history.length-index;chip.textContent=`${number}. ${entry.label}`;chip.dataset.label=entry.label;chip.dataset.number=String(number);chip.title=`${number}. ${entry.label}`;historyEl.appendChild(chip)})}

  function loadValues(values,title){if(spinning)return;if(transitioning)finishTransitionNow();animationToken++;colorCursor=0;items=values.slice(0,250).map(makeItem);hiddenItems=[];history=[];rotation=0;resetSpinState();clearUndoRedo();titleInput.value=title;syncTextarea();updateUI();persist();window.scrollTo({top:0,behavior:'smooth'})}
  function applyPreset(name){const values=PRESETS[name];if(!values)return;loadValues(values,name==='Números 1–12'?'La Ruleta Aleatoria':name)}
  function renderPresets(){Object.keys(PRESETS).forEach(name=>{const b=document.createElement('button');b.className='preset';b.type='button';b.textContent=name;b.addEventListener('click',()=>applyPreset(name));presetGrid.appendChild(b)})}
  function generateNumbers(){if(isBusy())return;let n=Number.parseInt(numberCountInput.value,10);if(!Number.isFinite(n)){showToast('Escribe una cantidad entre 2 y 250.');numberCountInput.focus();return}n=Math.max(2,Math.min(250,n));numberCountInput.value=String(n);loadValues(Array.from({length:n},(_,i)=>String(i+1)),`Números 1–${n}`);showToast(`Se generaron ${n} números.`)}

  function resetAll(){animationToken++;if(raf)cancelAnimationFrame(raf);spinning=false;transitioning=false;pendingHideId=null;colorCursor=0;items=DEFAULT_ITEMS.map(makeItem);hiddenItems=[];history=[];rotation=0;titleInput.value='La Ruleta Aleatoria';autoHideToggle.checked=true;autoHideToggle.disabled=false;numberCountInput.value='';resetSpinState();clearUndoRedo();syncTextarea();updateUI();persist();showToast('Ruleta reiniciada.')}
  function clearItems(){if(spinning)return;if(transitioning)finishTransitionNow();animationToken++;items=[];hiddenItems=[];history=[];rotation=0;itemsInput.value='';resetSpinState();clearUndoRedo();updateUI();persist();itemsInput.focus()}
  function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()))}catch(_){}}

  function restorePersisted(){try{let raw=localStorage.getItem(STORAGE_KEY);if(!raw){for(const key of LEGACY_STORAGE_KEYS){raw=localStorage.getItem(key);if(raw)break}}if(!raw){autoHideToggle.checked=true;return}const saved=JSON.parse(raw);if(!Array.isArray(saved.items)||!saved.items.length){autoHideToggle.checked=true;return}restoreSnapshot(saved,{save:false});persist();for(const key of LEGACY_STORAGE_KEYS)localStorage.removeItem(key)}catch(_){autoHideToggle.checked=true;colorCursor=0;items=DEFAULT_ITEMS.map(makeItem)}}
  function importState(state){if(!state||!Array.isArray(state.items)||state.items.length<1)return false;if(spinning)return false;if(transitioning)finishTransitionNow();const importedUndo=Array.isArray(state.undoStack)?state.undoStack.slice(-30):[],importedRedo=Array.isArray(state.redoStack)?state.redoStack.slice(-30):[];undoStack=[];redoStack=[];const ok=restoreSnapshot(state);if(ok){undoStack=importedUndo;redoStack=importedRedo;notifyState()}return ok}
  function exportState(){return{...snapshot(),undoStack:undoStack.map(s=>JSON.parse(JSON.stringify(s))),redoStack:redoStack.map(s=>JSON.parse(JSON.stringify(s)))}}

  async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){showToast('El navegador no permitió activar pantalla completa.')}}

  window.RuletaApp={exportState,importState,undo:undoLastResult,redo:redoLastResult,canUndo:()=>undoStack.length>0,canRedo:()=>redoStack.length>0,isBusy,stateFormatVersion:STATE_FORMAT_VERSION};

  itemsInput.addEventListener('input',rebuildFromInput);titleInput.addEventListener('input',persist);autoHideToggle.addEventListener('change',persist);spinBtn.addEventListener('click',startFirstSpin);spinAgainBtn.addEventListener('click',spin);canvas.addEventListener('click',startFirstSpin);resetBtn.addEventListener('click',resetAll);clearBtn.addEventListener('click',clearItems);restoreBtn.addEventListener('click',restoreHidden);generateNumbersBtn.addEventListener('click',generateNumbers);numberCountInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();generateNumbers()}});hideWinnerBtn.addEventListener('click',()=>{if(lastWinner)animateHideItemById(lastWinner.id)});clearHistoryBtn.addEventListener('click',()=>{history=[];lastWinner=null;resultValue.textContent='';resultCard.classList.remove('show');clearUndoRedo();renderHistory();persist()});fullscreenBtn.addEventListener('click',toggleFullscreen);
  document.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if(event.code==='Space'&&tag!=='TEXTAREA'&&tag!=='INPUT'&&tag!=='BUTTON'){event.preventDefault();spin()}if((event.key==='r'||event.key==='R')&&tag!=='TEXTAREA'&&tag!=='INPUT'){resetAll()}});
  window.addEventListener('resize',()=>requestAnimationFrame(()=>{if(!transitioning)drawWheel()}));document.addEventListener('fullscreenchange',()=>{fullscreenBtn.textContent=document.fullscreenElement?'⤢':'⛶';fullscreenBtn.title=document.fullscreenElement?'Salir de pantalla completa':'Pantalla completa';setTimeout(()=>{if(!transitioning)drawWheel()},100)});

  restorePersisted();renderPresets();updateUI();
})();