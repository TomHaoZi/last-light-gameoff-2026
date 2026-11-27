// A presentation-only layout profile. It is deliberately independent of game saves.
export const HUD_KEY = 'last-light-3d-mobile-hud-v1';
export const HUD_CONTROLS = ['move','sprint','walk','jump','interact','shift','attack'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const icons={move:'◉',sprint:'»',walk:'◌',jump:'↑',interact:'◇',shift:'◐',attack:'✦'};
export function defaults(width,height) {
  const wide=width>height;
  const lo=wide ? 46 : 48, hi=wide ? 62 : 65, stick=wide ? 100 : 112;
  const stations={move:[14,height-57,stick],sprint:[13,height-193,lo],walk:[68,height-193,lo],
    jump:[width-110,height-80,hi],interact:[width-40,height-152,hi],
    shift:[width-119,height-174,lo+8],attack:[width-35,height-85,hi]};
  const out={};
  for(const [key,[a,b,size]] of Object.entries(stations)) {
    const x=key==='move' ? a+stick/2 : key==='sprint'||key==='walk' ? a+lo/2 : a;
    const y=key==='move' ? b-stick/2 : b;
    out[key]={x:clamp(x/width,0,1),y:clamp(y/height,0,1),size};
  }
  return out;
}
export function sanitizeLayout(raw,fallback) {
  return Object.fromEntries(HUD_CONTROLS.map(key=>{
    const point=raw?.[key],base=fallback[key];
    const number=(k,a,b)=>Number.isFinite(point?.[k])?clamp(point[k],a,b):base[k];
    return [key,{x:number('x',0,1),y:number('y',0,1),size:number('size',key==='move'?72:44,key==='move'?160:112)}];
  }));
}
const SEPARATION = 4;

function boundedPoint(point,width,height){
  const radius=point.size/2;
  return {...point,x:clamp(point.x*width,radius,width-radius)/width,
    y:clamp(point.y*height,radius,height-radius)/height};
}

function roomFor(point,placed,width,height,zones){
  const radius=point.size/2,x=point.x*width,y=point.y*height;
  if(x-radius<-.01||x+radius>width+.01||y-radius<-.01||y+radius>height+.01)return false;
  if(zones.some(box=>Math.hypot(x-clamp(x,box.left,box.right),y-clamp(y,box.top,box.bottom))<radius+SEPARATION))return false;
  return Object.values(placed).every(other=>Math.hypot((point.x-other.x)*width,(point.y-other.y)*height)>=radius+other.size/2+SEPARATION);
}

// Normalize older or rotated layouts in-place visually, without replacing their
// profile until the player saves. Keep as many requested positions as fit.
export function fitLayout(raw,width,height,zones=[]){
  const base=defaults(width,height),requested=sanitizeLayout(raw,base);
  const pack=(minimumOnly)=>{
    const placed={};
    for(const key of HUD_CONTROLS){
      const minimum=key==='move'?72:44;
      let point=null;
      for(let size=minimumOnly?minimum:requested[key].size;size>=minimum;size=Math.max(minimum,size-8)){
        const preferred=boundedPoint({...requested[key],size},width,height);
        if(roomFor(preferred,placed,width,height,zones))point=preferred;
        else {
          const radius=size/2;
          let distance=Infinity;
          for(let y=radius;y<=height-radius;y+=8)for(let x=radius;x<=width-radius;x+=8){
            const candidate={x:x/width,y:y/height,size};
            const delta=Math.hypot(x-preferred.x*width,y-preferred.y*height);
            if(delta>=distance||!roomFor(candidate,placed,width,height,zones))continue;
            distance=delta;
            point=candidate;
          }
        }
        if(point||size===minimum)break;
      }
      if(!point)return null;
      placed[key]=point;
    }
    return placed;
  };
  return pack(false)??pack(true)??base;
}

export function editLayoutPoint(layout,key,point,width,height,zones=[]){
  const fitted=boundedPoint(point,width,height);
  const others=Object.fromEntries(Object.entries(layout).filter(([other])=>other!==key));
  return roomFor(fitted,others,width,height,zones)?fitted:layout[key];
}

function load() {
  try { const data=JSON.parse(localStorage.getItem(HUD_KEY));return data&&typeof data==='object'?data:{}; }
  catch { return {}; }
}
const texts={
  en:{open:'Layout',title:'Touch layout',note:'Drag or resize a control. Leave space for the status and other controls.',size:'Size',reset:'Reset',cancel:'Cancel',save:'Save',move:'Move',
    sprint:'Sprint',walk:'Quiet',jump:'Jump',interact:'Use',shift:'Shift',attack:'Strike'},
  zh:{open:'键位',title:'触控键位',note:'拖动按钮调整位置，选中后调整大小。请避开状态栏和其他按钮。',size:'大小',reset:'恢复默认',cancel:'取消',save:'保存',move:'移动',
    sprint:'冲刺',walk:'潜行',jump:'跳跃',interact:'交互',shift:'切相',attack:'挥击'}
};

export function bindMobileHud({isMobilePlay,open,close,state}) {
  const stage=document.getElementById('stage'),root=document.documentElement;
  const opener=document.getElementById('touch-layout-open');
  const dialog=document.getElementById('touch-layout-editor');
  const plane=dialog.querySelector('.touch-layout-plane');
  const range=document.getElementById('touch-layout-size');
  const value=document.getElementById('touch-layout-value');
  const live={move:document.getElementById('mobile-stick')};
  for(const key of HUD_CONTROLS.slice(1)) live[key]=document.querySelector(`[data-touch="${key}"]`);
  const editor={};
  const bounds=document.createElement('div');
  bounds.className='touch-layout-bounds';
  bounds.setAttribute('aria-hidden','true');
  stage.append(bounds);
  const topbar=stage.querySelector('.topbar');
  const hudZones=['#phase-badge','#journal','.vitals'].map(selector=>stage.querySelector(selector));
  const toolbar=dialog.querySelector('.touch-layout-tools');
  let draft,orientation,selected='jump',drag=null,liveProfile,visible,lastZones=[];
  const profiles=load();
  for(const key of HUD_CONTROLS) {
    live[key].dataset.hudControl=key; live[key].dataset.icon=icons[key];
    const node=document.createElement('button');
    node.type='button';node.className='touch-layout-control';node.dataset.hudControl=key;node.dataset.icon=icons[key];
    plane.append(node);editor[key]=node;
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||drag)return;
      event.preventDefault();node.focus();select(key);
      const r=node.getBoundingClientRect();
      drag={id:event.pointerId,key,dx:event.clientX-(r.left+r.width/2),dy:event.clientY-(r.top+r.height/2)};
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener('pointermove',e=>{
      if(drag?.id!==e.pointerId)return;
      const r=plane.getBoundingClientRect(),p=draft[key];
      draft[key]=editLayoutPoint(draft,key,{...p,x:(e.clientX-r.left-drag.dx)/r.width,y:(e.clientY-r.top-drag.dy)/r.height},
        r.width,r.height,protectedZones(true));
      position(editor,draft);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
    node.addEventListener('click',()=>select(key));
  }
  function dimensions(){
    const r=bounds.getBoundingClientRect();
    return [Math.max(1,r.width),Math.max(1,r.height)];
  }
  function bucket(){const [w,h]=dimensions();return w>h?'landscape':'portrait';}
  function protectedZones(editing=false){
    const origin=bounds.getBoundingClientRect();
    const read=node=>{
      const rect=node?.getBoundingClientRect();
      return rect?.width&&rect.height?{
        left:rect.left-origin.left,right:rect.right-origin.left,
        top:rect.top-origin.top,bottom:rect.bottom-origin.top
      }:null;
    };
    const current=hudZones.map(read).filter(Boolean);
    if(current.length)lastZones=current;
    return [read(topbar),...(current.length?current:lastZones),editing?read(toolbar):null].filter(Boolean);
  }
  function initial(orientation,editing=false){
    return fitLayout(profiles[orientation],...dimensions(),protectedZones(editing));
  }
  function position(nodes,layout) {
    for(const key of HUD_CONTROLS){
      const node=nodes[key],p=layout[key];
      node.style.setProperty('--hx',`${p.x*100}%`);node.style.setProperty('--hy',`${p.y*100}%`);node.style.setProperty('--hd',`${p.size}px`);
    }
  }
  function copy(){return texts[root.lang.startsWith('zh')?'zh':'en'];}
  function translate(){
    const t=copy();
    opener.textContent=t.open;
    for(const k of ['title','note','reset','cancel','save'])document.getElementById('touch-layout-'+k).textContent=t[k];
    document.getElementById('touch-layout-size-label').textContent=t.size;
    for(const k of HUD_CONTROLS) editor[k].textContent=t[k];
    if(dialog.open)select(selected);
  }
  function select(key){
    selected=key;
    for(const k of HUD_CONTROLS)editor[k].setAttribute('aria-pressed',String(k===key));
    range.setAttribute('aria-label',`${copy().size} · ${copy()[key]}`);
    range.min=key==='move'?72:44;range.max=key==='move'?160:112;
    range.value=draft[key].size;
    value.value=`${draft[key].size}px`;
  }
  function refresh(force=false){
    const enabled=isMobilePlay()&&state()==='playing';
    if(force!==true&&enabled===visible)return;
    visible=enabled;
    opener.hidden=!enabled;
    if(enabled){
      liveProfile=initial(bucket());
      position(live,liveProfile);
    }
    if(dialog.open){
      const next=bucket();
      if(orientation!==next){drag=null;orientation=next;draft=initial(next,true);}
      else draft=fitLayout(draft,...dimensions(),protectedZones(true));
      position(editor,draft);
      select(selected);
    }
  }
  opener.addEventListener('click',()=>{
    if(dialog.open||!isMobilePlay()||state()!=='playing')return;
    const before=liveProfile;
    open();stage.dataset.editTouch='true';dialog.showModal();
    orientation=bucket();
    draft=fitLayout(before??profiles[orientation],...dimensions(),protectedZones(true));
    position(editor,draft);select('jump');
  });
  range.addEventListener('input',()=>{
    draft[selected]=editLayoutPoint(draft,selected,{...draft[selected],size:Number(range.value)},...dimensions(),protectedZones(true));
    select(selected);position(editor,draft);
  });
  document.getElementById('touch-layout-reset').addEventListener('click',()=>{
    draft=fitLayout(null,...dimensions(),protectedZones(true));position(editor,draft);select(selected);
  });
  document.getElementById('touch-layout-cancel').addEventListener('click',()=>dialog.close());
  document.getElementById('touch-layout-save').addEventListener('click',()=>{
    profiles[orientation]=fitLayout(draft,...dimensions(),protectedZones(true));
    try{localStorage.setItem(HUD_KEY,JSON.stringify(profiles));}catch{/* In-memory layout still applies. */}
    dialog.close();
  });
  dialog.addEventListener('close',()=>{drag=null;delete stage.dataset.editTouch;close();refresh(true);if(!opener.hidden)opener.focus();});
  window.addEventListener('lastlightmobileplay',()=>refresh(true));
  const resize=new ResizeObserver(()=>refresh(true));
  for(const node of [bounds,topbar,...hudZones])if(node)resize.observe(node);
  new MutationObserver(translate).observe(root,{attributes:true,attributeFilter:['lang']});
  translate();refresh(true);
  return refresh;
}
