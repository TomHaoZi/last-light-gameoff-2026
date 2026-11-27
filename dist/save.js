import {backUpSave,includeSaveGeneration,newSaveGeneration,withSaveSlot} from './save-slot.js';

export const SAVE_KEY='last-light-v3',SCHEMA_VERSION=3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||a));
const strings=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'))]:[];
export function freshSave(){return {schemaVersion:SCHEMA_VERSION,worldRevision:2,sector:0,mechanisms:[],visitedSectors:[],floor:0,hp:3,lang:'en',chapterProgress:[[],[],[]],evidence:[],openedDoors:[],events:[],checkpointId:null,finished:false,resumeMode:'menu',ending:null,settings:{master:.8,music:.7,sfx:.85,reducedEffects:false}};}
export function normalizeSave(raw){
 const v=freshSave();if(!raw||typeof raw!=='object')return v;
 v.worldRevision=raw.worldRevision===2?2:1;v.sector=Math.floor(clamp(raw.sector,0,5));v.mechanisms=strings(raw.mechanisms);v.visitedSectors=strings(raw.visitedSectors);
 v.floor=Math.floor(clamp(raw.floor,0,2));v.lang=raw.lang==='zh'?'zh':'en';v.hp=clamp(raw.hp??3,1,3);
 v.chapterProgress=[0,1,2].map(f=>[0,1,2].map(i=>!!raw.chapterProgress?.[f]?.[i]));
 if(Array.isArray(raw.got))v.chapterProgress[v.floor]=[0,1,2].map(i=>!!raw.got[i]);
 v.evidence=strings(raw.evidence);v.openedDoors=strings(raw.openedDoors);v.events=strings(raw.events);v.finished=!!raw.finished;
 v.checkpointId=typeof raw.checkpointId==='string'?raw.checkpointId:null;
 v.ending=['normal','complete'].includes(raw.ending)?raw.ending:null;
 // Older builds cleared finished when selecting a section on the ending screen.
 const oldRevisit=!v.finished&&v.ending&&(v.floor!==2||v.worldRevision===2&&v.sector!==5);
 if(oldRevisit)v.finished=true;
 v.resumeMode=raw.resumeMode==='between'&&v.floor<2?'between':oldRevisit||v.finished&&raw.resumeMode==='revisit'?'revisit':'menu';
 if(raw.settings&&typeof raw.settings==='object')for(const k of ['master','music','sfx'])v.settings[k]=clamp(raw.settings[k]??v.settings[k],0,1);
 v.settings.reducedEffects=!!raw.settings?.reducedEffects;return v;
}
function compatibleSave(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 return (raw.schemaVersion==null||Number.isInteger(raw.schemaVersion)&&raw.schemaVersion>=1&&raw.schemaVersion<=SCHEMA_VERSION)&&
        (raw.worldRevision==null||Number.isInteger(raw.worldRevision)&&raw.worldRevision>=1&&raw.worldRevision<=2);
}
export function loadSave(storage,{migrate=true}={}){
 const warnings=[];
 let raw;
 try{
  raw=storage.getItem(SAVE_KEY);
  if(raw!==null){
   const parsed=JSON.parse(raw);
   if(!compatibleSave(parsed))return {data:freshSave(),warnings:['future-schema'],readOnly:true,raw};
   if(migrate&&parsed.worldRevision==null&&storage.getItem(`${SAVE_KEY}-before-expanded-world`)==null)storage.setItem(`${SAVE_KEY}-before-expanded-world`,raw);
   return {data:normalizeSave(parsed),warnings,readOnly:false,raw};
  }
  if(migrate)for(const key of ['last-light-v2','last-light-v1']){
   const text=storage.getItem(key);
   if(!text)continue;
   const parsed=JSON.parse(text),backup=`${key}-backup-before-v3`;
   if(storage.getItem(backup)==null)storage.setItem(backup,text);
   const data=normalizeSave(parsed), bytes=JSON.stringify(data);
   storage.setItem(SAVE_KEY,bytes);
   return {data,warnings:[`migrated:${key}`],readOnly:false,raw:bytes};
  }
 }catch(e){warnings.push(`save-unavailable:${e.name}`);return {data:freshSave(),warnings,readOnly:true,raw};}
 return {data:freshSave(),warnings,readOnly:false,raw};
}
export function openSave(storage,options){
 return withSaveSlot(SAVE_KEY,slot=>loadSave(slot,options),storage).catch(()=>{
  const view=loadSave(storage,{migrate:false});
  return {...view,warnings:[...view.warnings,'save-unavailable:database'],readOnly:true,issue:'saveFailed'};
 });
}
function writeSave(storage,bytes,expected){
 const current=storage.getItem(SAVE_KEY);
 if(expected!==undefined&&current!==expected)return {issue:'staleSave'};
 let previous;
 if(current!==null){
  try{previous=JSON.parse(current);}catch{return {issue:'protectedSave'};}
  if(!compatibleSave(previous))return {issue:'protectedSave'};
 }
 const raw=includeSaveGeneration(bytes,previous);
 if(current!==raw)storage.setItem(SAVE_KEY,raw);
 return {raw,issue:null};
}
export function storeSave(storage,data){
 return writeSave(storage,JSON.stringify(normalizeSave(data))).issue===null;
}
export function commitSave(storage,data,session){
 const bytes=JSON.stringify(normalizeSave(data));
 const pending=(session.pending??Promise.resolve()).then(async()=>{
  if(session.readOnly)return session.issue??'protectedSave';
  const {raw,issue}=await withSaveSlot(SAVE_KEY,slot=>writeSave(slot,bytes,session.raw),storage);
  if(issue){
   session.readOnly=true;
   session.issue=issue;
  }else session.raw=raw;
  return issue;
 }).catch(()=> 'saveFailed');
 session.pending=pending;
 return pending;
}
export function restartSave(storage,data){
 backupBeforeRestart(storage);
 storage.setItem(SAVE_KEY,JSON.stringify({...normalizeSave(data),saveGeneration:newSaveGeneration()}));
}
export function restartSavedSession(storage,data){
 return withSaveSlot(SAVE_KEY,slot=>{
  restartSave(slot,data);
  return loadSave(slot,{migrate:false});
 },storage);
}
export function backupBeforeRestart(storage){
 backUpSave(storage,`${SAVE_KEY}-before-restart-${Date.now()}`,storage.getItem(SAVE_KEY));
}
