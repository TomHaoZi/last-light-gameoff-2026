// Reuse a real completed playthrough profile; no save injection or simulation API.
import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';import {tmpdir} from 'node:os';import {basename,join} from 'node:path';import {readFile,readdir,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
const source=process.env.SOURCE_REPORT||'docs/evidence/expanded/complete-18/attempt.json',prior=JSON.parse(await readFile(source,'utf8'));
const ending=prior.complete?'complete':'normal';
const endState=prior.log.find(entry=>entry.event==='ending')?.snapshot;
if(!prior.passed||prior.continuation||prior.limit!==18||endState?.ending!==ending)throw Error('Requires a fresh 18-section run through the ending');
const expectedEvidence=JSON.stringify([...endState.evidence].sort());
const sameEvidence=state=>JSON.stringify([...state.evidence].sort())===expectedEvidence;
const hashes={};
for(const entry of await readdir('dist',{withFileTypes:true})){
 if(entry.isFile())hashes[entry.name]=createHash('sha256').update(await readFile(`dist/${entry.name}`)).digest('hex');
}
const profile=await mkdtemp(join(tmpdir(),'last-light-revisit-'));await cp(prior.profile,profile,{recursive:true,filter:path=>!['SingletonLock','SingletonSocket','SingletonCookie','DevToolsActivePort'].includes(basename(path))});
const out=process.env.EVIDENCE_DIR||'docs/evidence/expanded/revisit';await mkdir(out,{recursive:true});const port=Number(process.env.PORT||prior.port||8793),debug=Number(process.env.DEBUG_PORT||9233),delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn('python3',['-m','http.server',String(port),'-d','dist'],{stdio:'ignore'}),browser=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'--window-size=1280,1100',`http://127.0.0.1:${port}`],{stdio:'ignore'});
let ws,n=0,error;const wait=new Map(),log=[],errors=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n,timer=setTimeout(()=>reject(Error(`timeout ${method}`)),7000);wait.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const click=async selector=>{const p=await evaluate(`(()=>{let e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});let r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await delay(100);};
const tap=async code=>{await send('Input.dispatchKeyEvent',{type:'keyDown',code,key:code});await delay(40);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:code});await delay(100);};
const shot=async name=>{const p=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`${out}/${name}.png`,Buffer.from(p.data,'base64'));};
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch(`http://127.0.0.1:${debug}/json`)).json();if(tabs.some(t=>t.type==='page'))break;}catch{}await delay(100);}
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=e=>{const m=JSON.parse(e.data),w=wait.get(m.id);if(w){clearTimeout(w.timer);wait.delete(m.id);m.error?w.reject(Error(JSON.stringify(m.error))):w.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params);};
 await send('Runtime.enable');await send('Page.enable');for(let n=0;n<40;n++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}await delay(100);}await send('Page.navigate',{url:`http://127.0.0.1:${port}`});for(let i=0;i<60;i++){if(await evaluate("typeof window.lastLight?.snapshot==='function'&&document.readyState==='complete'"))break;await delay(100);}
 const before=await evaluate('lastLight.snapshot()');log.push({event:'initial-restored-state',snapshot:before});if(before.mode!=='won'||before.ending!==ending||!sameEvidence(before))throw Error('Actual completed save did not restore ending');log.push({event:'finished-reload',snapshot:before});
 await click('#start');const buttons=await evaluate("[...document.querySelectorAll('#visit-entries button')].map(b=>b.textContent)");if(buttons.length!==21)throw Error(`Expected 3 chapter + 18 section buttons, got ${buttons.length}`);await shot('01-visited-sections');
 const visited=[];
 for(let floor=0;floor<3;floor++)for(let sector=0;sector<6;sector++){
  const button=floor*7+sector+2;
  await click(`#visit-entries button:nth-of-type(${button})`);
  const position=await evaluate('lastLight.snapshot()');
  const save=await evaluate("JSON.parse(localStorage.getItem('last-light-v3'))");
  if(position.mode!=='playing'||position.floor!==floor||position.sector!==sector||!save.finished||
     save.ending!==ending||save.resumeMode!=='revisit'||!sameEvidence(position)||position.mechanisms.length!==18)
   throw Error(`Revisit failed at floor ${floor+1}, section ${sector+1}`);
  visited.push({floor,sector,checkpoint:position.checkpoint});
  await click('#chapters');
 }
 log.push({event:'all-18-section-revisits',visited});
 await click('#visit-entries button:nth-of-type(11)');const archive=await evaluate('lastLight.snapshot()');if(archive.floor!==1||archive.sector!==2||archive.mechanisms.length!==18||!sameEvidence(archive))throw Error('Archive revisit discarded completed work');log.push({event:'archive-revisit',snapshot:archive});
 await click('#language');await tap('KeyJ');const journal=await evaluate("({open:document.getElementById('journal-dialog').open,title:document.getElementById('journal-title').textContent,entries:document.querySelectorAll('#journal-entries p').length})");if(!journal.open||journal.entries<10+endState.evidence.length||!journal.title.includes('交班'))throw Error('Bilingual completed journal was not retained');await shot('02-journal-zh');log.push({event:'journal-zh',...journal});await click('#journal-close');await tap('Escape');
 await send('Page.reload');await delay(700);const restored=await evaluate('lastLight.snapshot()');if(restored.mode!=='menu'||restored.ending!==ending||restored.floor!==1||restored.sector!==2||!sameEvidence(restored)||restored.mechanisms.length!==18)throw Error('Reload lost expanded-map revisit state');await click('#start');const resumed=await evaluate('lastLight.snapshot()');if(resumed.mode!=='playing')throw Error('Revisited section failed to resume');log.push({event:'reload-resume',snapshot:resumed});await shot('03-resumed-archive-zh');if(errors.length)throw Error('Runtime exception recorded');console.log('Expanded completed save, 18-section revisit, Chinese journal and reload/resume passed.');
}catch(e){error=String(e);console.error(error);try{log.push({event:'stopped',snapshot:await evaluate('window.lastLight?.snapshot()')});await shot('stopped');}catch{}}finally{if(ws?.readyState===1){try{await send('Browser.close');for(let i=0;i<100&&browser.exitCode==null&&browser.signalCode==null;i++)await delay(100);}catch{}}
 await writeFile(`${out}/report.json`,JSON.stringify({source,ending,kind:'copy of actual completed browser profile; no save-value mutation; normal UI revisit',hashes,sourceHashes:prior.hashes,passed:!error,error,log,errors},null,2));ws?.close();if(browser.exitCode==null&&browser.signalCode==null)browser.kill();server.kill();await rm(profile,{recursive:true,force:true});if(error)process.exitCode=1;}
