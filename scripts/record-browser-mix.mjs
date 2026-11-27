import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Fixed tap at the real WebAudio destination. This neither synthesizes a fake
// route mix nor modifies the app graph's audible connection.
export async function installMixTap(send) {
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...args){
      const result=connect.call(this,destination,...args);
      if(destination!==this.context.destination||window.routeMix)return result;
      if(!navigator||typeof MediaRecorder==='undefined')return result;
      const sink=this.context.createMediaStreamDestination();
      connect.call(this,sink);
      const recorder=new MediaRecorder(sink.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:144000});
      const pieces=[];
      recorder.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};
      window.routeMix={context:this.context,recorder,sink,pieces,stereo:2,mark:[]};
      recorder.start(800);
      return result;
    };
  })()`});
}

export async function saveMix(send, folder, minimumSeconds = 30) {
  await mkdir(folder,{recursive:true});
  const result=await send('Runtime.evaluate',{returnByValue:true,awaitPromise:true,expression:`(async()=>{
    const mix=window.routeMix;
    if(!mix)throw Error('No real WebAudio master was connected');
    if(mix.recorder.state!=='inactive')await new Promise(r=>{mix.recorder.onstop=r;mix.recorder.stop();});
    const blob=new Blob(mix.pieces,{type:'audio/webm'});
    const decoded=await mix.context.decodeAudioData(await blob.arrayBuffer());
    const db=x=>x===0?-Infinity:20*Math.log10(x);
    const windows=[];let peak=0,sum=0,nearClip=0,silentWindows=0;
    const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
    const stride=Math.floor(decoded.sampleRate/2);
    for(let from=0;from<decoded.length;from+=stride){
      const till=Math.min(decoded.length,from+stride);let energy=0,max=0;
      for(const c of channels)for(let j=from;j<till;j++){
        const n=Math.abs(c[j]);energy+=n*n;if(n>=.99)nearClip++;max=Math.max(max,n);
      }
      const rms=Math.sqrt(energy/(channels.length*(till-from)));
      if(rms<.00056)silentWindows++;
      windows.push([from/decoded.sampleRate,Number.isFinite(db(rms))?+db(rms).toFixed(2):null,max]);
      sum+=energy;peak=Math.max(peak,max);
    }
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
    return {data,duration:decoded.duration,channels:decoded.numberOfChannels,sampleRate:decoded.sampleRate,peak,dBFS:db(peak),rmsDbFS:db(Math.sqrt(sum/(channels.length*decoded.length))),nearClip,silentWindows,windows,marks:mix.mark};
  })()`});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  const {data,...stats}=result.result.value;
  if(stats.duration < minimumSeconds || stats.peak <= .1 || stats.channels !== 2)throw Error('Missing live stereo mix: '+JSON.stringify({...stats,windows:undefined}));
  await writeFile(join(folder,'stereo-playthrough.webm'),Buffer.from(data,'base64'));
  await writeFile(join(folder,'mix-metrics.json'),JSON.stringify(stats,null,2)+'\n');
  return {...stats,windows:undefined};
}
