(()=>{
  'use strict';

  const api=window.RuletaApp;
  const autoHideToggle=document.querySelector('#autoHideToggle');
  const undoBtn=document.querySelector('#undoBtn');
  const redoBtn=document.querySelector('#redoBtn');
  const restoreBtn=document.querySelector('#restoreBtn');
  const resetBtn=document.querySelector('#resetBtn');
  const clearBtn=document.querySelector('#clearBtn');
  const wheel=document.querySelector('#wheel');
  const mainSpinBtn=document.querySelector('#mainSpinBtn');
  const resultValue=document.querySelector('#resultValue');
  if(!api||!autoHideToggle)return;

  const LEDGER_KEY='ruleta-auto-hidden-ledger-v1';
  let repairing=false;
  let undoCandidate=null;
  let restoreCandidates=[];

  const normalize=value=>String(value??'').trim().toLocaleLowerCase('es');

  function readLedger(){
    try{
      const parsed=JSON.parse(localStorage.getItem(LEDGER_KEY)||'[]');
      return new Set(Array.isArray(parsed)?parsed.filter(v=>typeof v==='string'&&v):[]);
    }catch(_){return new Set()}
  }

  let excludedIds=readLedger();

  function saveLedger(){
    try{localStorage.setItem(LEDGER_KEY,JSON.stringify([...excludedIds]))}catch(_){}
  }

  function state(){
    try{return api.exportState?.()||null}catch(_){return null}
  }

  function universeOf(s){return [...(Array.isArray(s?.items)?s.items:[]),...(Array.isArray(s?.hidden)?s.hidden:[])]}

  function labelCounts(s){
    const counts=new Map();
    for(const item of universeOf(s)){
      const key=normalize(item?.label);
      if(key)counts.set(key,(counts.get(key)||0)+1);
    }
    return counts;
  }

  function historyLabels(s){return new Set((Array.isArray(s?.history)?s.history:[]).map(entry=>normalize(entry?.label)).filter(Boolean))}

  function bootstrapLegacyState(){
    if(localStorage.getItem(LEDGER_KEY)!==null)return;
    const s=state();
    if(!s||!s.autoHide)return;
    const counts=labelCounts(s),used=historyLabels(s);
    for(const item of universeOf(s)){
      const key=normalize(item?.label);
      // En listas sin nombres duplicados se puede reconstruir con seguridad qué valores ya salieron,
      // incluso si una versión anterior de Deshacer/Rehacer los devolvió por error a la rueda.
      if(item?.id&&key&&counts.get(key)===1&&used.has(key))excludedIds.add(item.id);
    }
    saveLedger();
  }

  function pruneLedger(){
    const s=state();if(!s)return;
    if(!(s.history?.length)){excludedIds.clear();saveLedger();return}
    const valid=new Set(universeOf(s).map(item=>item?.id).filter(Boolean));
    let changed=false;
    for(const id of [...excludedIds])if(!valid.has(id)){excludedIds.delete(id);changed=true}
    if(changed)saveLedger();
  }

  function markCurrentWinner(){
    if(!autoHideToggle.checked)return;
    const s=state(),winner=s?.lastWinner;
    if(!winner?.id)return;
    excludedIds.add(winner.id);saveLedger();
  }

  function enforceExcluded(){
    if(repairing||!autoHideToggle.checked)return false;
    const s=state();if(!s||!Array.isArray(s.items)||!s.items.length)return false;
    const toHide=s.items.filter(item=>item?.id&&excludedIds.has(item.id));
    if(!toHide.length)return false;

    const ids=new Set(toHide.map(item=>item.id));
    s.items=s.items.filter(item=>!ids.has(item?.id));
    s.hidden=Array.isArray(s.hidden)?s.hidden:[];
    const hiddenIds=new Set(s.hidden.map(item=>item?.id).filter(Boolean));
    for(const item of toHide)if(!hiddenIds.has(item.id)){s.hidden.push(item);hiddenIds.add(item.id)}

    repairing=true;
    try{return Boolean(api.importState?.(s))}finally{repairing=false}
  }

  function prepareSpin(){
    pruneLedger();
    enforceExcluded();
  }

  // Se ejecuta antes que los controladores que inician el giro.
  mainSpinBtn?.addEventListener('click',prepareSpin,true);
  wheel?.addEventListener('click',prepareSpin,true);
  document.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName;
    if(event.code==='Space'&&tag!=='TEXTAREA'&&tag!=='INPUT'&&tag!=='BUTTON')prepareSpin();
  },true);

  // Cada ganador con "Esconder al terminar" queda registrado por ID, no solo por su texto.
  if(resultValue){
    const observer=new MutationObserver(()=>{
      if(!resultValue.textContent.trim())return;
      queueMicrotask(markCurrentWinner);
    });
    observer.observe(resultValue,{childList:true,characterData:true,subtree:true});
  }

  // Deshacer debe liberar únicamente el ganador que realmente dejó de formar parte del historial.
  undoBtn?.addEventListener('click',()=>{
    const before=state();
    undoCandidate=before?.lastWinner?.id?{id:before.lastWinner.id,label:before.lastWinner.label}:null;
  },true);
  undoBtn?.addEventListener('click',()=>setTimeout(()=>{
    if(!undoCandidate)return;
    const after=state();
    const counts=labelCounts(after),remainingHistory=historyLabels(after),key=normalize(undoCandidate.label);
    // Si el mismo valor sigue apareciendo en el historial y solo existe una copia física,
    // era un duplicado histórico producido por el bug anterior: debe seguir excluido.
    if(counts.get(key)===1&&remainingHistory.has(key))excludedIds.add(undoCandidate.id);
    else excludedIds.delete(undoCandidate.id);
    undoCandidate=null;saveLedger();enforceExcluded();
  },0));

  // Rehacer vuelve a excluir de inmediato el valor premiado restaurado.
  redoBtn?.addEventListener('click',()=>setTimeout(()=>{
    markCurrentWinner();
    enforceExcluded();
  },0));

  // "Mostrar ocultos" es una decisión explícita del usuario: esos valores vuelven a ser elegibles.
  restoreBtn?.addEventListener('click',()=>{
    const before=state();restoreCandidates=(before?.hidden||[]).map(item=>item?.id).filter(Boolean);
  },true);
  restoreBtn?.addEventListener('click',()=>setTimeout(()=>{
    for(const id of restoreCandidates)excludedIds.delete(id);
    restoreCandidates=[];saveLedger();
  },0));

  function clearLedgerSoon(){setTimeout(()=>{excludedIds.clear();saveLedger()},0)}
  resetBtn?.addEventListener('click',clearLedgerSoon);
  clearBtn?.addEventListener('click',clearLedgerSoon);

  document.addEventListener('ruleta:statechange',()=>{
    if(repairing)return;
    pruneLedger();
  });

  bootstrapLegacyState();
  // Repara inmediatamente sesiones antiguas ya inconsistentes (como un 7 u 8 premiado que volvió a la rueda).
  enforceExcluded();
})();