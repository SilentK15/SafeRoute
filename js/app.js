document.addEventListener('DOMContentLoaded',function(){

const MAPBOX_TOKEN='pk.eyJ1Ijoia3NoaXRpajE1IiwiYSI6ImNtbjl0OWF3ajBjeXcycHF5a203ZHE1ZTIifQ.JBBiD5JrUknDSLR12IQ_ZA';

/* ── UTILS ── */
let _tt;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),3400);}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

/* ── IST TIME ── */
function getIST(){const n=new Date();return new Date(n.getTime()+n.getTimezoneOffset()*60000+330*60000);}
function getTimeRisk(d){
  const h=d.getHours();
  if(h>=21||h<5)  return{level:'danger',  label:'High Risk Hours (Night)',    desc:'9 PM–5 AM: Extra caution. Avoid isolated areas.'};
  if(h>=18)       return{level:'moderate',label:'Moderate Risk (Evening)',    desc:'6–9 PM: Avoid isolated lanes. Stay on main roads.'};
  if(h<7)         return{level:'moderate',label:'Early Morning',              desc:'Low activity. Stay on main roads.'};
  return               {level:'safe',    label:'Safe Hours (Daytime)',       desc:'7 AM–6 PM: Normal precautions apply.'};
}
function timeMult(){const h=getIST().getHours();return(h>=21||h<5)?1.5:(h>=18||h<7)?1.2:1.0;}

function updateClock(){
  const ist=getIST();
  document.getElementById('navClock').textContent=String(ist.getHours()).padStart(2,'0')+':'+String(ist.getMinutes()).padStart(2,'0')+' IST';
  const r=getTimeRisk(ist);
  const b=document.getElementById('timeBanner');b.className='time-banner '+r.level;
  document.getElementById('tbText').textContent='🕐 '+r.label+' — '+r.desc;
}
updateClock();setInterval(updateClock,30000);

/* ── NIGHT MODE ── */
let _nightManual=lsGet('sr_night',null);
const STYLE_LIGHT='mapbox://styles/mapbox/streets-v12';
const STYLE_DARK ='mapbox://styles/mapbox/navigation-night-v1';
function isNightNow(){if(_nightManual!==null)return _nightManual;const h=getIST().getHours();return h>=18||h<6;}

function applyNight(on){
  document.documentElement.classList.toggle('night',on);
  document.getElementById('nightBtn').textContent=on?'☀️':'🌙';
  if(map)map.setStyle(on?STYLE_DARK:STYLE_LIGHT);
}
document.getElementById('nightBtn').addEventListener('click',()=>{
  _nightManual=!isNightNow();lsSet('sr_night',_nightManual);applyNight(_nightManual);
  toast(_nightManual?'🌙 Night mode on':'☀️ Day mode on');
});
setInterval(()=>{if(_nightManual===null)applyNight(isNightNow());},300000);

/* ── HOTSPOT DATA ── */
const HS=[
  {lat:19.0596,lng:72.8295,name:'Dharavi',           area:"Dharavi — Asia's largest slum. Narrow lanes, poor lighting. Molestation hotspot.",risk:'high'},
  {lat:19.0178,lng:72.8478,name:'Byculla East',       area:'Byculla — Dense slum belt. Dongri nearby. High harassment rate.',risk:'high'},
  {lat:19.1136,lng:72.8697,name:'Kurla West',         area:'Kurla — Harbour Line station. Snatching capital of Mumbai 2025.',risk:'high'},
  {lat:19.0728,lng:72.8826,name:'Govandi',            area:'Govandi — Quora & police: notorious for anti-social activities.',risk:'high'},
  {lat:19.1715,lng:72.9411,name:'Mankhurd',           area:'Mankhurd — Shivajinagar slum adjacent. Worst Harbour Line zone.',risk:'high'},
  {lat:19.2307,lng:73.0169,name:'Mumbra / Kausa',     area:"Mumbra-Kausa, Thane — Consistently ranked among Maharashtra's most unsafe.",risk:'high'},
  {lat:18.9667,lng:72.8367,name:'Dongri / Nagpada',   area:'Dongri — Dense, underlit. High eve-teasing & assault reports.',risk:'high'},
  {lat:19.0560,lng:72.8310,name:'Shivaji Nagar Slum', area:'Shivaji Nagar, Govandi — Adjacent to landfill. Very high crime density.',risk:'high'},
  {lat:19.0260,lng:72.8520,name:'Reay Road',          area:'Reay Road / Mazgaon — Old mills, deserted after dark. Police-flagged.',risk:'high'},
  {lat:19.1650,lng:72.9350,name:'Vikhroli Pipe Rd',   area:'Vikhroli industrial belt — Isolated stretches, poor lighting.',risk:'high'},
  {lat:19.0330,lng:72.8497,name:'Dadar TT',           area:'Dadar — Busy transit hub. High pickpocketing & snatching.',risk:'moderate'},
  {lat:19.1197,lng:72.9051,name:'Chembur Naka',       area:'Chembur Naka — Moderate crime, worse after 9 PM.',risk:'moderate'},
  {lat:19.0454,lng:72.8572,name:'Sion Circle',        area:'Sion — Elevated crime near station and market areas.',risk:'moderate'},
  {lat:19.0990,lng:72.8544,name:'Matunga Labour Camp',area:'Matunga — Labour colony. Harassment reports, especially evenings.',risk:'moderate'},
  {lat:19.1437,lng:72.8520,name:'Ghatkopar West',     area:'Ghatkopar W — Busy market zone. Pickpocketing & harassment.',risk:'moderate'},
  {lat:19.0607,lng:72.8362,name:'Mahim Causeway',     area:'Mahim — Known for eve-teasing near station & market.',risk:'moderate'},
  {lat:19.2183,lng:72.9781,name:'Mulund Check Naka',  area:'Mulund — Moderate risk. Industrial stretch after dark.',risk:'moderate'},
  {lat:19.1538,lng:72.8490,name:'Malad West',         area:'Malad — High density. Elevated street harassment.',risk:'moderate'},
  {lat:19.1863,lng:72.9739,name:'Bhandup Complex',    area:'Bhandup — Industrial outskirts. Isolated lanes near creek.',risk:'moderate'},
  {lat:19.1072,lng:72.8370,name:'Dharavi Station Rd', area:'Sion-Dharavi Road — Transit risk zone, especially evenings.',risk:'moderate'},
  {lat:19.0760,lng:72.8777,name:'Kurla Station',      area:'Kurla Station — Snatching up 54% in 2025. Stay alert at exits.',risk:'moderate'},
  {lat:19.1190,lng:72.8490,name:'Andheri East Market',area:'Andheri East — MIDC area after dark. Multiple assault reports.',risk:'moderate'},
  {lat:19.0860,lng:72.8880,name:'Tilak Nagar Mkt',    area:'Tilak Nagar — Evening market harassment. Better in daytime.',risk:'moderate'},
  {lat:18.9760,lng:72.8340,name:'Nagpada Jn',         area:'Nagpada — Dense area. Elevated crime post-2022.',risk:'moderate'},
  {lat:19.0700,lng:72.8360,name:'Mahim Dargah Rd',    area:'Mahim Dargah back lanes — Poorly lit, avoid post 8 PM.',risk:'moderate'},
  {lat:19.2050,lng:72.8540,name:'Borivali Station',   area:'Borivali Station area — Busy, high snatching risk.',risk:'moderate'},
  {lat:19.1726,lng:72.8561,name:'Kandivali West',     area:'Kandivali — Generally safe but elevated at night markets.',risk:'moderate'},
  {lat:18.9970,lng:72.8360,name:'Cotton Green',       area:'Cotton Green / Sewri — Industrial. Isolated post 7 PM.',risk:'moderate'},
  {lat:19.2183,lng:73.0469,name:'Kalwa, Thane',       area:'Kalwa — High crime belt. Adjacent to Mumbra.',risk:'high'},
  {lat:19.1800,lng:73.0300,name:'Diva Junction',      area:'Diva — Poorly lit. High chain snatching & assault.',risk:'high'},
  {lat:19.3400,lng:73.0750,name:'Bhiwandi',           area:'Bhiwandi — Textile hub. High crime, especially nights.',risk:'high'},
  {lat:19.2810,lng:73.0570,name:'Mumbra',             area:'Mumbra — Consistently unsafe. Avoid late evenings.',risk:'high'},
  {lat:19.2183,lng:72.9781,name:'Thane City Centre',  area:'Thane Station area — Moderate. Snatching near market.',risk:'moderate'},
  {lat:19.2320,lng:73.1290,name:'Ambernath',          area:'Ambernath — Industrial outskirts. Late night risk.',risk:'moderate'},
  {lat:19.3330,lng:73.0440,name:'Ulhasnagar',         area:'Ulhasnagar — Moderate-high. Market areas chaotic.',risk:'moderate'},
  {lat:19.1550,lng:73.0850,name:'Navi Mumbai APMC',   area:'APMC Vashi — Market area. Elevated after hours.',risk:'moderate'},
  {lat:18.5040,lng:73.9250,name:'Hadapsar',           area:'Hadapsar, Pune — Rapid growth, crime rising. Assault reports.',risk:'high'},
  {lat:18.4860,lng:73.8820,name:'Kondhwa',            area:'Kondhwa, Pune — Isolated pockets. Evening safety concerns.',risk:'moderate'},
  {lat:18.5500,lng:73.8770,name:'Yerawada',           area:'Yerawada, Pune — Near jail area. Moderate-high after dark.',risk:'moderate'},
  {lat:18.6290,lng:73.8010,name:'Pimpri Chinchwad',   area:'Pimpri-Chinchwad — Industrial. Elevated crime near factories.',risk:'moderate'},
  {lat:18.5180,lng:73.8560,name:'Swargate',           area:'Swargate, Pune — Bus stand area. Pickpocketing hotspot.',risk:'moderate'},
  {lat:18.5460,lng:73.9120,name:'Viman Nagar',        area:'Viman Nagar — Generally safe but isolated late-night pockets.',risk:'low'},
  {lat:18.5200,lng:73.8553,name:'Shivajinagar Pune',  area:'Shivajinagar, Pune — Commercial hub. Generally moderate.',risk:'moderate'},
  {lat:21.1235,lng:79.0820,name:'Itwari, Nagpur',     area:'Itwari — Old market belt. Highest crime density in Nagpur.',risk:'high'},
  {lat:21.1500,lng:79.0900,name:'Kamptee Rd',         area:'Kamptee Road, Nagpur — Industrial stretch. Multiple assault reports.',risk:'high'},
  {lat:21.1110,lng:79.0990,name:'Nandanvan',          area:'Nandanvan, Nagpur — Dense slum. High molestation rate.',risk:'high'},
  {lat:21.1380,lng:79.1180,name:'Bhandara Road',      area:'Bhandara Road, Nagpur — Moderate-high after dark.',risk:'moderate'},
  {lat:19.8762,lng:75.3433,name:'CIDCO, Aurangabad',  area:'CIDCO Aurangabad — Rapid growth zone. Crime increasing 2024.',risk:'moderate'},
  {lat:20.0050,lng:73.7710,name:'Nashik Road',        area:'Nashik Road — Industrial. Elevated street crime.',risk:'moderate'},
  {lat:18.9220,lng:72.8320,name:'Colaba',             area:'Colaba — Safest part of Mumbai. Well-policed, tourist heavy.',risk:'low'},
  {lat:18.9402,lng:72.8350,name:'Fort / Nariman Pt',  area:'Fort/Nariman Point — Business district. Low crime, good lighting.',risk:'low'},
  {lat:18.9400,lng:72.8270,name:'Marine Drive',       area:'Marine Drive — Well-lit promenade. Low risk day & night.',risk:'low'},
  {lat:19.0590,lng:72.8260,name:'Bandra West',        area:'Bandra West — Upscale. Lower crime. Normal precautions.',risk:'low'},
  {lat:18.9876,lng:72.8258,name:'Worli Sea Face',     area:'Worli Sea Face — Low risk. Well-lit coastal road.',risk:'low'},
  {lat:19.1197,lng:72.9061,name:'Powai Lake area',    area:'Powai — IT hub. Generally safe. Normal vigilance.',risk:'low'},
  {lat:19.1710,lng:72.9570,name:'Mulund West',        area:'Mulund West — Residential. Lower crime than East.',risk:'low'},
];
const RC={high:'#c8401a',moderate:'#b8860b',low:'#2a6b4a'};

/* ── CONTACTS ── */
let contacts=lsGet('sr_contacts',[{name:'Mom',phone:'',rel:'Mother',color:'#c8401a'},{name:'Friend',phone:'',rel:'Friend',color:'#2c4a6e'}]);
let _uLat=19.076,_uLng=72.877;

function renderContacts(){
  const list=document.getElementById('cList'),sos=document.getElementById('sosContacts');
  list.innerHTML=contacts.map((c,i)=>`<div class="c-row"><div class="c-av" style="background:${c.color}22;color:${c.color}">${c.name[0].toUpperCase()}</div><div style="flex:1;min-width:0;"><div class="c-name">${c.name}</div><div class="c-rel">${c.rel}${c.phone?' · '+c.phone:''}</div></div>${c.phone?`<a class="c-btn" href="tel:${c.phone}">📞 Call</a>`:`<button class="c-btn" data-ei="${i}">Add #</button>`}</div>`).join('');
  list.querySelectorAll('[data-ei]').forEach(b=>b.addEventListener('click',()=>editContact(+b.dataset.ei)));
  sos.innerHTML=contacts.filter(c=>c.phone).map(c=>`<button class="mc-btn" data-p="${c.phone}">${c.name}</button>`).join('');
  sos.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{window.location='tel:'+b.dataset.p;}));
  document.getElementById('waLink').href='https://wa.me/?text='+encodeURIComponent('🚨 SafeRoute SOS — I need help! My location: https://maps.google.com/?q='+_uLat+','+_uLng);
  document.getElementById('fcName').textContent=contacts[0]?contacts[0].name:'Mom';
}
function addContact(){const name=prompt('Contact name:');if(!name)return;const phone=prompt('Phone (e.g. +919876543210):')||'';const rel=prompt('Relationship:','Friend')||'Friend';const cols=['#c8401a','#2c4a6e','#2a6b4a','#b8860b','#7c3aed'];contacts.push({name,phone,rel,color:cols[contacts.length%cols.length]});lsSet('sr_contacts',contacts);renderContacts();toast(name+' added');}
function editContact(i){const p=prompt('Phone for '+contacts[i].name+':',contacts[i].phone);if(p===null)return;contacts[i].phone=p;lsSet('sr_contacts',contacts);renderContacts();}

/* ── TRAVEL MODE ── */
let _mode='driving';
function setMode(m){_mode=m;document.getElementById('modeDrive').classList.toggle('active',m==='driving');document.getElementById('modeWalk').classList.toggle('active',m==='walking');}

/* ── TIMER ── */
let _tI=null,_tS=0,_tOn=false;
function startTimer(){
  document.getElementById('timerBlock').style.display='block';if(_tOn)return;_tOn=true;_tS=0;
  document.getElementById('tcBadge').textContent='Active';document.getElementById('tcBadge').classList.add('on');
  document.getElementById('tcStart').style.display='none';document.getElementById('tcStop').style.display='block';
  document.getElementById('tcSub').textContent='Walk in progress. Tap "✓ Safe" when you arrive.';
  _tI=setInterval(()=>{_tS++;document.getElementById('tcTime').textContent=String(Math.floor(_tS/60)).padStart(2,'0')+':'+String(_tS%60).padStart(2,'0');if(_tS===1800)toast('⚠ 30 min elapsed — are you safe?');},1000);
  toast('Safe walk timer started');
}
function stopTimer(){
  clearInterval(_tI);_tOn=false;
  document.getElementById('tcBadge').textContent='Arrived Safe ✓';document.getElementById('tcBadge').classList.remove('on');
  document.getElementById('tcStart').style.display='block';document.getElementById('tcStop').style.display='none';
  document.getElementById('tcSub').textContent='You arrived safely!';toast('✓ Arrived safely');
}

/* ── FAKE CALL ── */
let _fcT=null;
function startFakeCall(){document.getElementById('fakeCallModal').classList.add('on');_fcT=setTimeout(endFakeCall,30000);}
function endFakeCall(){document.getElementById('fakeCallModal').classList.remove('on');clearTimeout(_fcT);}

/* ── SOS ── */
function openSOS(){renderContacts();document.getElementById('sosModal').classList.add('on');}
function closeSOS(){document.getElementById('sosModal').classList.remove('on');}

/* ── SHARE LOCATION ── */
function shareMyLocation(){
  if(!navigator.geolocation){toast('Geolocation not supported');return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    const url='https://maps.google.com/?q='+pos.coords.latitude+','+pos.coords.longitude;
    if(navigator.share)navigator.share({title:'My Location — SafeRoute',url}).catch(()=>{});
    else navigator.clipboard.writeText(url).then(()=>toast('Location link copied!')).catch(()=>toast(url));
  },()=>toast('Could not get location'));
}

/* ── INCIDENT REPORT ── */
let _irMarkers=lsGet('sr_incidents',[]);
function openIRModal(){document.getElementById('irModal').classList.add('on');}
function closeIRModal(){document.getElementById('irModal').classList.remove('on');}
function submitIncident(){
  const type=document.getElementById('irType').value,time=document.getElementById('irTime').value,desc=document.getElementById('irDesc').value;
  const inc={lat:_uLat,lng:_uLng,type,time,desc};
  _irMarkers.push(inc);lsSet('sr_incidents',_irMarkers);
  addIncidentMarker(inc);
  closeIRModal();document.getElementById('irDesc').value='';toast('Incident reported — thank you!');
}

/* ── DISTANCE FUNCTIONS ── */
function hav(la1,lo1,la2,lo2){const R=6371000,dl=(la2-la1)*Math.PI/180,dg=(lo2-lo1)*Math.PI/180;const a=Math.sin(dl/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dg/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function d2line(pt,line){const step=Math.max(1,Math.floor(line.length/80));let min=Infinity;for(let i=0;i<line.length;i+=step){const d=hav(pt.lat,pt.lng,line[i][0],line[i][1]);if(d<min)min=d;}return min;}

/* ══════════════════════════════════════════════════════
   MAPBOX GL MAP INIT
══════════════════════════════════════════════════════ */
mapboxgl.accessToken=MAPBOX_TOKEN;
const nightInit=isNightNow();
if(nightInit){document.documentElement.classList.add('night');document.getElementById('nightBtn').textContent='☀️';}

const map=new mapboxgl.Map({
  container:'map',
  style:nightInit?STYLE_DARK:STYLE_LIGHT,
  center:[72.877,19.076],
  zoom:12,
  pitch:30,
  bearing:0,
  attributionControl:false
});
map.addControl(new mapboxgl.NavigationControl(),'top-right');
map.addControl(new mapboxgl.AttributionControl({compact:true}),'bottom-right');

/* ── POPUP HELPER ── */
function makePopup(html){return new mapboxgl.Popup({closeButton:true,maxWidth:'240px'}).setHTML(html);}

/* ── HOTSPOT CIRCLES (added after style loads) ── */
function addHotspotLayers(){
  // Clean up before re-adding (handles style reloads)
  try{if(map.getLayer('hotspot-circles'))map.removeLayer('hotspot-circles');}catch(e){}
  try{if(map.getSource('hotspots'))map.removeSource('hotspots');}catch(e){}
  const features=HS.map(h=>({
    type:'Feature',
    geometry:{type:'Point',coordinates:[h.lng,h.lat]},
    properties:{name:h.name,area:h.area,risk:h.risk,color:RC[h.risk]}
  }));
  map.addSource('hotspots',{type:'geojson',data:{type:'FeatureCollection',features}});
  map.addLayer({id:'hotspot-circles',type:'circle',source:'hotspots',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],10,18,14,40],
    'circle-color':['get','color'],
    'circle-opacity':0.15,
    'circle-stroke-width':1.5,
    'circle-stroke-color':['get','color'],
    'circle-stroke-opacity':0.35
  }});
  map.on('click','hotspot-circles',e=>{
    const p=e.features[0].properties;
    const col=RC[p.risk]||'#888';
    new mapboxgl.Popup({maxWidth:'260px'})
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<b style="color:${col}">${p.name}</b><br><span style="color:var(--muted);font-size:.75rem">${p.area}</span><br><span style="color:${col};font-size:.68rem">⚠ ${p.risk} risk zone</span>`)
      .addTo(map);
  });
  map.getCanvas().style.cursor='';
  map.on('mouseenter','hotspot-circles',()=>map.getCanvas().style.cursor='pointer');
  map.on('mouseleave','hotspot-circles',()=>map.getCanvas().style.cursor='');
}

/* ── INCIDENT MARKERS ── */
const _incidentMarkers=[];
function addIncidentMarker(inc){
  const el=document.createElement('div');
  el.style.cssText='width:12px;height:12px;border-radius:50%;background:#e05252;border:2px solid white;box-shadow:0 0 6px #e0525266;cursor:pointer;';
  const m=new mapboxgl.Marker({element:el}).setLngLat([inc.lng,inc.lat])
    .setPopup(makePopup(`<b style="color:#e05252">⚠ ${inc.type}</b><br><span style="font-size:.7rem;color:var(--muted)">${inc.time}</span>${inc.desc?'<br><span style="font-size:.7rem">'+inc.desc+'</span>':''}`))
    .addTo(map);
  _incidentMarkers.push(m);
}
_irMarkers.forEach(addIncidentMarker);

/* ── GPS / MY LOCATION ── */
let _uMarker=null;

async function reverseGeocode(lat,lng){
  // Use Mapbox reverse geocoding — more reliable than Nominatim
  try{
    const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=en&types=address,place,neighborhood,locality&limit=1`;
    const r=await fetch(url);
    const d=await r.json();
    if(d.features&&d.features.length){
      return d.features[0].place_name;
    }
  }catch(e){console.warn('Reverse geocode failed:',e);}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function placeUserMarker(lat,lng){
  if(_uMarker)_uMarker.remove();
  const el=document.createElement('div');
  el.style.cssText='width:16px;height:16px;border-radius:50%;background:var(--blue);border:3px solid white;box-shadow:0 0 0 3px rgba(26,115,232,.3),0 2px 8px rgba(0,0,0,.25);';
  _uMarker=new mapboxgl.Marker({element:el}).setLngLat([lng,lat])
    .setPopup(makePopup('<b>📍 Your location</b>')).addTo(map);
}

function useMyLocation(){
  if(!navigator.geolocation){toast('Geolocation not supported by this browser');return;}
  const btn=document.getElementById('locBtn');
  if(btn)btn.classList.add('loading');
  document.getElementById('inFrom').value='';
  document.getElementById('inFrom').placeholder='Getting location…';

  navigator.geolocation.getCurrentPosition(async pos=>{
    _uLat=pos.coords.latitude;_uLng=pos.coords.longitude;
    fromCoords={lat:_uLat,lng:_uLng};
    placeUserMarker(_uLat,_uLng);
    map.flyTo({center:[_uLng,_uLat],zoom:15});
    const label=await reverseGeocode(_uLat,_uLng);
    document.getElementById('inFrom').value=label;
    document.getElementById('inFrom').placeholder='Starting point';
    if(btn)btn.classList.remove('loading');
    // Save to recents
    _rec=_rec.filter(r=>r.label!==label).slice(0,4);
    _rec.unshift({label,lat:_uLat,lon:_uLng,isLoc:true});
    lsSet('sr_recent',_rec);
    toast('📍 Location set as starting point');
  },err=>{
    document.getElementById('inFrom').placeholder='Starting point';
    if(btn)btn.classList.remove('loading');
    if(err.code===1)toast('Location access denied — please allow in browser settings');
    else if(err.code===2)toast('Could not detect location — check GPS signal');
    else toast('Location request timed out — try again');
  },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
}

/* ── AUTOCOMPLETE ── */
let _sT={},_rec=lsGet('sr_recent',[]);

function posDrop(dId,fId){
  const field=document.getElementById(fId);
  const rect=field.getBoundingClientRect();
  const d=document.getElementById(dId);
  // On mobile, align to screen edges for full-width dropdown
  const isMob=window.innerWidth<=768;
  if(isMob){
    d.style.left='12px';
    d.style.right='12px';
    d.style.width='auto';
  } else {
    d.style.left=rect.left+'px';
    d.style.width=rect.width+'px';
    d.style.right='auto';
  }
  d.style.top=(rect.bottom+4)+'px';
}

function pickDropItem(item, dId){
  const lbl=decodeURIComponent(item.dataset.lbl);
  const lat=+item.dataset.lat, lon=+item.dataset.lon;
  const isFrom=dId==='dropFrom';
  const inp=document.getElementById(isFrom?'inFrom':'inTo');
  // Show short name in input, not the full address
  inp.value=item.dataset.short ? decodeURIComponent(item.dataset.short) : lbl.split(',')[0];
  inp.dataset.fullLabel=lbl; // store full for routing
  if(isFrom){ fromCoords={lat,lng:lon}; _uLat=lat; _uLng=lon; }
  else       { toCoords  ={lat,lng:lon}; }
  _rec=_rec.filter(r=>r.label!==lbl).slice(0,7);
  _rec.unshift({label:lbl,short:lbl.split(',')[0],lat,lon});
  lsSet('sr_recent',_rec);
  hideDrop(dId);
  map.flyTo({center:[lon,lat],zoom:15,duration:800});
}

function showDrop(dId,fId,html){
  posDrop(dId,fId);
  const el=document.getElementById(dId);
  el.innerHTML=html;
  el.classList.add('open');
  // Use pointerdown so it fires on touch AND mouse, before blur fires
  el.querySelectorAll('.di').forEach(item=>{
    item.addEventListener('pointerdown',e=>{
      e.preventDefault();
      pickDropItem(item, dId);
    });
  });
}

function hideDrop(id){document.getElementById(id).classList.remove('open');}

// Icon by place type (Mapbox feature type)
function icoType(types=[]){
  const t=types.join(' ').toLowerCase();
  if(t.includes('poi')){return'📍';} // overridden below by category
  if(t.includes('address'))return'🏠';
  if(t.includes('postcode'))return'📮';
  if(t.includes('neighborhood')||t.includes('locality'))return'🏘️';
  if(t.includes('place')||t.includes('district'))return'🏙️';
  if(t.includes('region'))return'📍';
  return'📍';
}
function icoCategory(cat=''){
  const c=cat.toLowerCase();
  if(c.includes('hospital')||c.includes('medical')||c.includes('clinic'))return'🏥';
  if(c.includes('police'))return'🚓';
  if(c.includes('school')||c.includes('college')||c.includes('university'))return'🎓';
  if(c.includes('railway')||c.includes('station')||c.includes('transit'))return'🚉';
  if(c.includes('mall')||c.includes('shopping')||c.includes('market'))return'🛍️';
  if(c.includes('restaurant')||c.includes('food')||c.includes('cafe'))return'🍽️';
  if(c.includes('hotel')||c.includes('lodging'))return'🏨';
  if(c.includes('airport'))return'✈️';
  if(c.includes('park')||c.includes('garden'))return'🌳';
  if(c.includes('temple')||c.includes('mosque')||c.includes('church'))return'🛕';
  if(c.includes('bank')||c.includes('atm'))return'🏦';
  if(c.includes('pharmacy'))return'💊';
  return'📍';
}

function hlText(txt,q){
  if(!q||!txt)return txt||'';
  const i=txt.toLowerCase().indexOf(q.toLowerCase());
  if(i<0)return txt;
  return txt.slice(0,i)+'<mark>'+txt.slice(i,i+q.length)+'</mark>'+txt.slice(i+q.length);
}

function fmtDist(m){
  if(m<1000)return Math.round(m)+'m';
  return(m/1000).toFixed(1)+'km';
}

function buildDropHtml(features, query, center){
  return features.map(item=>{
    const [lon,lat]=item.center;
    const name=item.text||item.place_name.split(',')[0];
    const sub=item.place_name.includes(',')
      ? item.place_name.slice(item.place_name.indexOf(',')+1).trim()
      : '';
    const dist=hav(center.lat,center.lng,lat,lon);
    const distStr=fmtDist(dist);
    const types=item.place_type||[];
    const cat=item.properties?.category||item.properties?.maki||'';
    const ico=cat ? icoCategory(cat) : icoType(types);
    const safeLabel=encodeURIComponent(item.place_name);
    const safeShort=encodeURIComponent(name);
    return `<div class="di" data-lat="${lat}" data-lon="${lon}" data-lbl="${safeLabel}" data-short="${safeShort}">
      <div class="di-ico">${ico}</div>
      <div style="flex:1;min-width:0;">
        <div class="di-name">${hlText(name,query)}</div>
        ${sub?`<div class="di-sub">${sub}</div>`:''}
      </div>
      <div class="di-dist">${distStr}</div>
    </div>`;
  }).join('');
}

// "My location" entry always shown first in recents for "From" field
function recentHtml(dId){
  const isFrom=dId==='dropFrom';
  let items='';
  if(isFrom){
    items+=`<div class="di" id="dropLocBtn" style="border-bottom:1px solid var(--border);">
      <div class="di-ico">🎯</div>
      <div style="flex:1;min-width:0;">
        <div class="di-name" style="color:var(--blue);font-weight:500;">Use my current location</div>
        <div class="di-sub">Detect via GPS</div>
      </div>
    </div>`;
  }
  if(_rec.length){
    items+=`<div style="padding:6px 12px 2px;font-size:.625rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);">Recent</div>`;
    items+=_rec.slice(0,6).map(r=>`<div class="di" data-lat="${r.lat}" data-lon="${r.lon}" data-lbl="${encodeURIComponent(r.label)}" data-short="${encodeURIComponent(r.short||r.label.split(',')[0])}">
      <div class="di-ico">${r.isLoc?'📍':'🕐'}</div>
      <div style="flex:1;min-width:0;">
        <div class="di-name">${r.short||r.label.split(',')[0]}</div>
        <div class="di-sub">${r.label}</div>
      </div>
    </div>`).join('');
  }
  return items;
}

async function doSearch(q,dId,fId){
  const v=q.trim();
  if(!v){
    const h=recentHtml(dId);
    if(h){ showDrop(dId,fId,h); wireLoc(dId); }
    else hideDrop(dId);
    return;
  }
  if(v.length<2){ hideDrop(dId); return; }

  showDrop(dId,fId,'<div class="drop-msg"><div class="dspin"></div>Searching…</div>');

  try{
    const center=map.getCenter();
    // Build URL — bias to India, all useful types, proximity to map center
    const params=new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: 8,
      language: 'en',
      country: 'in',           // India only — prevents wrong-country results
      proximity: `${center.lng},${center.lat}`,
      types: 'poi,address,place,locality,neighborhood,district,postcode',
      fuzzyMatch: 'true',      // handles typos
      autocomplete: 'true',
    });
    const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?${params}`;
    const res=await fetch(url);
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();

    if(!data.features||!data.features.length){
      // Fallback: try without country restriction (user may search outside India)
      const url2=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?access_token=${MAPBOX_TOKEN}&limit=6&language=en&proximity=${center.lng},${center.lat}&fuzzyMatch=true&autocomplete=true`;
      const res2=await fetch(url2);
      const data2=await res2.json();
      if(!data2.features||!data2.features.length){
        showDrop(dId,fId,'<div class="drop-msg">No results found — try a different name or add city</div>');
        return;
      }
      showDrop(dId,fId,buildDropHtml(data2.features,v,center));
      wireLoc(dId);
      return;
    }

    showDrop(dId,fId,buildDropHtml(data.features,v,center));
    wireLoc(dId);
  }catch(err){
    console.error('Search error:',err);
    showDrop(dId,fId,'<div class="drop-msg">Search unavailable — check connection</div>');
  }
}

// Wire the "Use my location" item inside dropdown
function wireLoc(dId){
  const btn=document.getElementById('dropLocBtn');
  if(!btn)return;
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();
    hideDrop(dId);
    useMyLocation();
  });
}

function wireInput(inpId,dId,fId){
  const inp=document.getElementById(inpId);
  let _debounce;
  inp.addEventListener('input',()=>{
    clearTimeout(_debounce);
    const v=inp.value;
    // Reset coord if user edits manually
    if(dId==='dropFrom') fromCoords=null;
    else toCoords=null;
    _debounce=setTimeout(()=>doSearch(v,dId,fId), v.length<=1?50:v.length<=3?150:250);
  });
  inp.addEventListener('focus',()=>{ posDrop(dId,fId); doSearch(inp.value,dId,fId); });
  inp.addEventListener('blur',()=>setTimeout(()=>hideDrop(dId),300));
  // On mobile, repositioning on scroll
  window.addEventListener('scroll',()=>{ if(document.getElementById(dId).classList.contains('open'))posDrop(dId,fId); },{passive:true});
}
wireInput('inFrom','dropFrom','fFrom');
wireInput('inTo',  'dropTo',  'fTo');

document.addEventListener('click',e=>{
  if(!e.target.closest('#fFrom')&&!e.target.closest('#dropFrom'))hideDrop('dropFrom');
  if(!e.target.closest('#fTo')  &&!e.target.closest('#dropTo'))  hideDrop('dropTo');
});
window.addEventListener('resize',()=>{ hideDrop('dropFrom'); hideDrop('dropTo'); });

/* ── SAFETY ANALYSIS ── */
function analyse(coords){
  const THRESH=1400;
  const near=HS.map(h=>{
    const dist=Math.round(d2line({lat:h.lat,lng:h.lng},coords));
    return{...h,dist};
  }).filter(h=>h.dist<THRESH).sort((a,b)=>a.dist-b.dist);
  let danger=0;
  near.forEach(h=>{
    const decay=Math.exp(-h.dist/500);
    const base=h.risk==='high'?55:h.risk==='moderate'?25:8;
    danger+=base*decay;
  });
  danger=Math.min(danger*timeMult(),100);
  return{score:Math.round(100-danger),near};
}

/* ── OVERPASS — safe spots ── */
async function fetchSS(coords){
  const lats=coords.map(c=>c[0]),lngs=coords.map(c=>c[1]),p=0.08;
  const bb=(Math.min(...lats)-p)+','+(Math.min(...lngs)-p)+','+(Math.max(...lats)+p)+','+(Math.max(...lngs)+p);
  const lines='node["amenity"="police"]('+bb+');way["amenity"="police"]('+bb+');node["amenity"="hospital"]('+bb+');way["amenity"="hospital"]('+bb+');node["amenity"="clinic"]('+bb+');node["amenity"="pharmacy"]('+bb+');node["railway"="station"]('+bb+');way["railway"="station"]('+bb+');';
  const q='[out:json][timeout:20];('+lines+');out center 80;';
  try{
    const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q)});
    const d=await r.json();
    return d.elements.map(el=>{
      const t=el.tags||{},am=t.amenity||t.railway||'';
      let type='',icon='📍',color='var(--muted)';
      if(am==='police'){type='Police Station';icon='🚓';color='#2c4a6e';}
      else if(am==='hospital'){type='Hospital';icon='🏥';color='#2a6b4a';}
      else if(am==='clinic'){type='Clinic';icon='⚕️';color='#2a6b4a';}
      else if(am==='pharmacy'){type='Pharmacy';icon='💊';color='#7c3aed';}
      else if(am==='station'){type='Railway Station';icon='🚉';color='#7c3aed';}
      const name=t.name||t['name:en']||'';const lat=el.lat??el.center?.lat;const lon=el.lon??el.center?.lon;
      return(name&&lat&&lon)?{lat,lng:lon,name,type,icon,color}:null;
    }).filter(Boolean).filter((s,i,a)=>a.findIndex(x=>x.name===s.name&&x.type===s.type)===i);
  }catch(e){console.warn('Overpass:',e);return[];}
}

/* ── TURN-BY-TURN ── */
function manvIcon(type,mod){
  if(type==='depart')return'🚦';if(type==='arrive')return'🏁';
  if(type==='roundabout'||type==='rotary')return'🔄';
  if(!mod)return'⬆';if(mod==='uturn')return'↩';
  if(mod.includes('sharp right'))return'↱';if(mod.includes('sharp left'))return'↰';
  if(mod.includes('right'))return'→';if(mod.includes('left'))return'←';
  if(mod.includes('slight right'))return'↗';if(mod.includes('slight left'))return'↖';
  return'⬆';
}
function renderTurns(steps){
  const list=document.getElementById('turnsList');
  if(!steps||!steps.length){list.innerHTML='<div class="no-item">No step-by-step data available.</div>';return;}
  list.innerHTML=steps.map((s,i)=>{
    const isLast=i===steps.length-1;
    const type=s.maneuver?.type||'',mod=s.maneuver?.modifier||'';
    const icon=manvIcon(type,mod);const name=s.name&&s.name!==''?s.name:'unnamed road';const dist=s.distance>0?fmtDist(s.distance):'';
    let instr='';
    if(type==='depart')instr='Start on <b>'+name+'</b>';
    else if(type==='arrive')instr='Arrive at your <b>destination</b>';
    else if(type==='roundabout'||type==='rotary')instr='Take roundabout'+(s.maneuver?.exit?' (exit '+s.maneuver.exit+')':'')+' onto <b>'+name+'</b>';
    else if(mod.includes('right'))instr='Turn right onto <b>'+name+'</b>';
    else if(mod.includes('left'))instr='Turn left onto <b>'+name+'</b>';
    else if(mod==='uturn')instr='Make a U-turn onto <b>'+name+'</b>';
    else instr='Continue on <b>'+name+'</b>';
    return`<div class="turn-item${isLast?' turn-dest':''}" style="animation-delay:${i*.025}s">
      <div class="turn-num">${i+1}</div>
      <div class="turn-icon">${icon}</div>
      <div style="flex:1;"><div class="turn-text">${instr}</div>${dist?'<div class="turn-dist">'+dist+'</div>':''}</div>
    </div>`;
  }).join('');
}

/* ── ROUTE LAYERS (Mapbox GeoJSON sources) ── */
let routeData=[],ssMarkers=[],fromCoords=null,toCoords=null;
const RCOL=['#2a6b4a','#b8860b','#2c4a6e'];
let _routeLayersAdded=false;

function clearRL(){
  ['route0','route1','route2'].forEach(id=>{
    if(map.getLayer(id))map.removeLayer(id);
    if(map.getSource(id))map.removeSource(id);
  });
  _routeLayersAdded=false;
}
function clearSS(){ssMarkers.forEach(m=>m.remove());ssMarkers=[];}

function add3DBuildings(){
  try{
    if(map.getLayer('3d-buildings'))map.removeLayer('3d-buildings');
  }catch(e){}
  try{
    map.addLayer({
      'id':'3d-buildings',
      'source':'composite',
      'source-layer':'building',
      'filter':['==','extrude','true'],
      'type':'fill-extrusion',
      'minzoom':14,
      'paint':{
        'fill-extrusion-color':isNightNow()?'#223':'#aaa',
        'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,14.05,['get','height']],
        'fill-extrusion-base':['interpolate',['linear'],['zoom'],14,0,14.05,['get','min_height']],
        'fill-extrusion-opacity':0.65
      }
    });
  }catch(e){console.warn('3D buildings layer failed:',e);}
}

function drawRoute(r,idx,opacity,weight){
  const id='route'+idx;
  try{if(map.getLayer(id))map.removeLayer(id);}catch(e){}
  try{if(map.getSource(id))map.removeSource(id);}catch(e){}
  // coords are [lat,lng], mapbox needs [lng,lat]
  const coords=r.coords.map(c=>[c[1],c[0]]);
  map.addSource(id,{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:coords}}});
  const paint={
    'line-color':RCOL[idx],
    'line-width':weight,
    'line-opacity':opacity
  };
  if(idx===1) paint['line-dasharray']=[2,2];
  else if(idx===2) paint['line-dasharray']=[1,2];
  map.addLayer({id,type:'line',source:id,layout:{'line-join':'round','line-cap':'round'},paint});
}

function fitRouteBounds(coords){
  const lngs=coords.map(c=>c[1]),lats=coords.map(c=>c[0]);
  map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:60});
}

/* ── ROUTING ── */
async function geocodeText(text){
  if(!text.trim())return null;
  try{
    const center=map.getCenter();
    const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=en&country=in&proximity=${center.lng},${center.lat}&fuzzyMatch=true`;
    const r=await fetch(url);
    const d=await r.json();
    if(d.features&&d.features.length){
      const [lon,lat]=d.features[0].center;
      return {lat,lng:lon};
    }
  }catch(e){console.warn('Geocode error:',e);}
  return null;
}

async function planRoutes(){
  const fromVal=document.getElementById('inFrom').value.trim();
  const toVal=document.getElementById('inTo').value.trim();
  if(!fromVal||!toVal){toast('Enter both a starting point and destination');return;}

  const btn=document.getElementById('goBtn');btn.disabled=true;btn.classList.add('busy');showPill('Resolving locations…');

  // If coords missing (user typed without picking), geocode on the fly
  if(!fromCoords&&fromVal) fromCoords=await geocodeText(fromVal);
  if(!toCoords&&toVal)     toCoords  =await geocodeText(toVal);

  if(!fromCoords||!toCoords){
    toast('Could not find one of the locations — try picking from dropdown');
    btn.disabled=false;btn.classList.remove('busy');hidePill();return;
  }
  showPill('Fetching routes…');
  try{
    const profile=_mode==='walking'?'foot':'driving';
    const url='https://router.project-osrm.org/route/v1/'+profile+'/'+fromCoords.lng+','+fromCoords.lat+';'+toCoords.lng+','+toCoords.lat+'?overview=full&geometries=geojson&alternatives=true&steps=true';
    const res=await fetch(url);const data=await res.json();
    if(data.code!=='Ok'||!data.routes.length)throw new Error('no route');

    showPill('Analysing safety…');
    let scored=data.routes.slice(0,5).map(r=>{
      const coords=r.geometry.coordinates.map(c=>[c[1],c[0]]);
      const steps=r.legs?.[0]?.steps||[];
      return{coords,dist:r.distance,dur:r.duration,steps,...analyse(coords)};
    });
    while(scored.length<3){
      const base=scored[0];const mid=base.coords[Math.floor(base.coords.length/2)];const sign=scored.length===1?1:-1;
      const wpLat=mid[0]+sign*0.009,wpLng=mid[1]+sign*0.006;
      try{
        const ar=await fetch('https://router.project-osrm.org/route/v1/'+profile+'/'+fromCoords.lng+','+fromCoords.lat+';'+wpLng+','+wpLat+';'+toCoords.lng+','+toCoords.lat+'?overview=full&geometries=geojson&steps=true');
        const ad=await ar.json();
        if(ad.code==='Ok'&&ad.routes.length){const coords=ad.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);scored.push({coords,dist:ad.routes[0].distance,dur:ad.routes[0].duration,steps:ad.routes[0].legs?.[0]?.steps||[],...analyse(coords)});}
        else throw 0;
      }catch{scored.push({...base,dist:base.dist*(scored.length===1?1.1:.92),dur:base.dur*(scored.length===1?1.15:.87),steps:base.steps,score:Math.max(5,base.score-scored.length*8)});}
    }
    const bySafe=[...scored].sort((a,b)=>b.score-a.score);
    const byFast=[...scored].sort((a,b)=>a.dur-b.dur);
    const mxD=Math.max(...scored.map(r=>r.dur));
    const byBal=[...scored].sort((a,b)=>(b.score/100*.55+(1-b.dur/mxD)*.45)-(a.score/100*.55+(1-a.dur/mxD)*.45));
    const used=new Set();function uniq(arr){const r=arr.find(x=>!used.has(x))||arr[0];used.add(r);return r;}
    routeData=[uniq(bySafe),uniq(byFast),uniq(byBal)];

    routeData.forEach((r,i)=>{document.getElementById('rs'+i).textContent=r.score;document.getElementById('rs'+i).style.color=RCOL[i];document.getElementById('rm'+i).textContent=(r.dist/1000).toFixed(1)+' km · '+Math.round(r.dur/60)+' min';});
    clearRL();
    routeData.forEach((r,i)=>drawRoute(r,i,i===0?0.9:0.3,i===0?5:3));
    fitRouteBounds(routeData[0].coords);

    showPill('Loading safe spots…');
    const ssRaw=await fetchSS(routeData[0].coords);
    const ssAll=ssRaw.map(s=>({...s,dist:Math.round(d2line({lat:s.lat,lng:s.lng},routeData[0].coords))})).filter(s=>s.dist<900).sort((a,b)=>a.dist-b.dist).slice(0,20);
    routeData.forEach(r=>{r.ss=ssAll;});
    clearSS();
    ssAll.forEach(s=>{
      const el=document.createElement('div');
      el.style.cssText=`width:12px;height:12px;border-radius:50%;background:${s.color};border:2px solid white;box-shadow:0 0 6px ${s.color}66;cursor:pointer;`;
      s._marker=new mapboxgl.Marker({element:el}).setLngLat([s.lng,s.lat])
        .setPopup(makePopup(`<b>${s.icon} ${s.name}</b><br><span style="color:var(--muted);font-size:.7rem">${s.type}</span><br><span style="color:${s.color};font-size:.68rem">${s.dist}m from route</span>`))
        .addTo(map);
      ssMarkers.push(s._marker);
    });

    document.getElementById('blockRoutes').style.display='block';
    document.getElementById('emptyState').style.display='none';
    [0,1,2].forEach(i=>document.getElementById('rc'+i).classList.toggle('sel',i===0));
    updatePanel(0);hidePill();
  }catch(err){console.error(err);toast('Could not find route — try different locations');hidePill();}
  finally{btn.disabled=false;btn.classList.remove('busy');}
}

function pickRoute(i){
  [0,1,2].forEach(j=>document.getElementById('rc'+j).classList.toggle('sel',j===i));
  routeData.forEach((r,j)=>{
    const id='route'+j;
    if(map.getLayer(id))map.setPaintProperty(id,'line-opacity',j===i?0.9:0.2);
    if(map.getLayer(id))map.setPaintProperty(id,'line-width',j===i?5:2);
  });
  if(routeData[i])fitRouteBounds(routeData[i].coords);
  updatePanel(i);
}

function scCol(s){return s>=80?'#2a6b4a':s>=55?'#b8860b':s>=30?'#c8401a':'#8b0000';}
function updatePanel(i){
  const r=routeData[i];if(!r)return;
  const col=scCol(r.score);const lbl=r.score>=80?'Safe Route':r.score>=55?'Stay Alert':r.score>=30?'High Risk':'Very High Risk';
  document.getElementById('sNum').textContent=r.score;document.getElementById('sNum').style.color=col;
  const tag=document.getElementById('sTag');tag.textContent=lbl;tag.style.cssText='background:'+col+'18;color:'+col+';border:1.5px solid '+col+'30;';
  document.getElementById('sDesc').textContent=getTimeRisk(getIST()).desc;
  setTimeout(()=>{document.getElementById('barFg').style.width=r.score+'%';document.getElementById('barFg').style.background=col;},60);
  document.getElementById('mDist').textContent=(r.dist/1000).toFixed(1)+' km';
  document.getElementById('mTime').textContent=Math.round(r.dur/60)+' min';
  document.getElementById('mHots').textContent=r.near.length;
  document.getElementById('blockScore').style.display='block';
  document.getElementById('blockTurns').style.display='block';
  document.getElementById('navBtns').style.display='flex';
  renderTurns(r.steps);
  document.getElementById('hsList').innerHTML=!r.near.length?'<div class="no-item">✓ No crime hotspots within 1.2 km of this route.</div>':r.near.slice(0,8).map((h,j)=>'<div class="hs-item" style="animation-delay:'+j*.04+'s"><div class="hs-bar" style="background:'+RC[h.risk]+'"></div><div style="flex:1;min-width:0;"><div class="hs-name">'+h.name+'</div><div class="hs-dist">'+h.area+' · '+h.dist+'m from route</div></div><div class="hs-pill" style="background:'+RC[h.risk]+'18;color:'+RC[h.risk]+'">'+h.risk+'</div></div>').join('');
  document.getElementById('blockHs').style.display='block';
  const ss=r.ss||[];
  const ssl=document.getElementById('ssList');
  ssl.innerHTML=!ss.length?'<div class="no-item">ℹ No safe spots found near this route.</div>':ss.slice(0,15).map((s,j)=>'<div class="ss-item" style="animation-delay:'+j*.04+'s" data-idx="'+j+'"><div class="ss-ico" style="background:'+s.color+'18;color:'+s.color+'">'+s.icon+'</div><div style="flex:1;min-width:0;"><div class="ss-name">'+s.name+'</div><div class="ss-type">'+s.type+'</div></div><div class="ss-dist">'+(s.dist<1000?s.dist+'m':(s.dist/1000).toFixed(1)+'km')+'</div></div>').join('');
  ssl.querySelectorAll('.ss-item').forEach(el=>{el.addEventListener('click',()=>{const s=ss[+el.dataset.idx];if(!s)return;map.flyTo({center:[s.lng,s.lat],zoom:16});if(s._marker)setTimeout(()=>s._marker.togglePopup(),350);ssl.querySelectorAll('.ss-item').forEach(x=>x.style.borderColor='');el.style.borderColor='var(--blue)';});});
  document.getElementById('blockSs').style.display='block';
  document.getElementById('ssCount').textContent='('+ss.length+' found)';
  drawTimeline(r);document.getElementById('blockTimeline').style.display='block';
  document.getElementById('sbScroll').scrollTo({top:0,behavior:'smooth'});
}

/* ── TIMELINE CHART ── */
let _chart=null;
function drawTimeline(r){
  const canvas=document.getElementById('timelineChart');if(!canvas)return;
  const scores=Array.from({length:24},(_,h)=>{
    let m=1.0;if(h>=21||h<5)m=1.5;else if(h>=18||h<7)m=1.2;
    let d=0;r.near.forEach(n=>{const decay=Math.exp(-n.dist/500);const base=n.risk==='high'?55:n.risk==='moderate'?25:8;d+=base*decay;});
    return Math.round(100-Math.min(d*m,100));
  });
  const nowH=getIST().getHours();
  const bg=scores.map((_,h)=>h===nowH?'rgba(200,64,26,.85)':h>=21||h<5?'rgba(200,64,26,.22)':h>=18||h<7?'rgba(154,110,0,.22)':'rgba(42,107,74,.22)');
  if(_chart){_chart.destroy();_chart=null;}
  _chart=new Chart(canvas,{type:'bar',data:{labels:Array.from({length:24},(_,h)=>h%6===0?h+':00':''),datasets:[{data:scores,backgroundColor:bg,borderRadius:2,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>'Hour: '+i[0].dataIndex+':00 IST',label:i=>'Score: '+i.raw}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},color:'var(--muted)'}},y:{min:0,max:100,grid:{color:'rgba(128,128,128,.08)'},ticks:{font:{size:9},color:'var(--muted)',stepSize:25}}}}});
}

/* ── HEATMAP (crime zones as Mapbox fill circles) ── */
const CRIME_ZONES=[
  {z:'Zone I — South Mumbai',sub:'Colaba, Fort, Marine Lines, Malabar Hill',lat:18.921,lng:72.832,r:2400,annual2025:412,monthly_jan26:48,breakdown:'Molestation: 112 | Rape: 38 | Kidnapping: 62 | Harassment: 58'},
  {z:'Zone II — South Central',sub:'Byculla, Nagpada, Pydhonie, Dongri',lat:18.978,lng:72.842,r:2600,annual2025:824,monthly_jan26:96,breakdown:'Molestation: 228 | Rape: 89 | Kidnapping: 174 | Harassment: 112'},
  {z:'Zone III — Central',sub:'Dharavi, Dadar, Sion, Mahim, Wadala',lat:19.032,lng:72.851,r:3100,annual2025:1106,monthly_jan26:128,breakdown:'Molestation: 312 | Rape: 124 | Kidnapping: 218 | Harassment: 148'},
  {z:'Zone IV — Western Suburbs',sub:'Andheri, Juhu, Vile Parle, Santacruz',lat:19.116,lng:72.847,r:3400,annual2025:786,monthly_jan26:91,breakdown:'Molestation: 218 | Rape: 88 | Kidnapping: 158 | Harassment: 108'},
  {z:'Zone V — Far Western Suburbs',sub:'Borivali, Kandivali, Malad, Dahisar',lat:19.228,lng:72.858,r:3700,annual2025:598,monthly_jan26:69,breakdown:'Molestation: 164 | Rape: 67 | Kidnapping: 122 | Harassment: 84'},
  {z:'Zone VI — Eastern Suburbs',sub:'Kurla, Chembur, Govandi, Ghatkopar East',lat:19.074,lng:72.898,r:3300,annual2025:1142,monthly_jan26:132,breakdown:'Molestation: 318 | Rape: 128 | Kidnapping: 228 | Harassment: 154'},
  {z:'Zone VII — Far East',sub:'Mankhurd, Vikhroli, Kanjurmarg',lat:19.158,lng:72.938,r:3000,annual2025:1089,monthly_jan26:126,breakdown:'Molestation: 298 | Rape: 122 | Kidnapping: 218 | Harassment: 148'},
  {z:'Zone VIII — North East',sub:'Mulund, Bhandup, Nahur',lat:19.196,lng:72.958,r:2800,annual2025:724,monthly_jan26:84,breakdown:'Molestation: 198 | Rape: 81 | Kidnapping: 148 | Harassment: 98'},
  {z:'Zone IX — North Central',sub:'Ghatkopar West, Powai, Vikhroli West',lat:19.087,lng:72.912,r:2500,annual2025:682,monthly_jan26:79,breakdown:'Molestation: 188 | Rape: 76 | Kidnapping: 138 | Harassment: 94'},
  {z:'Zone X — Harbour Line',sub:'Wadala, Antop Hill, Sewri, GTB Nagar',lat:18.996,lng:72.864,r:2100,annual2025:779,monthly_jan26:90,breakdown:'Molestation: 214 | Rape: 87 | Kidnapping: 160 | Harassment: 106'},
];
const MAX_C=Math.max(...CRIME_ZONES.map(z=>z.annual2025));
let _hon=false;
function toggleHeatmap(){
  if(_hon){
    if(map.getLayer('heatmap-outer'))map.removeLayer('heatmap-outer');
    if(map.getLayer('heatmap-inner'))map.removeLayer('heatmap-inner');
    if(map.getSource('heatmap'))map.removeSource('heatmap');
    _hon=false;document.getElementById('heatmapBtn').classList.remove('on');return;
  }
  _hon=true;document.getElementById('heatmapBtn').classList.add('on');
  const mult=timeMult();
  const features=CRIME_ZONES.map(z=>{
    const intensity=(z.annual2025/MAX_C)*mult;
    let col=intensity>.72?'#c8401a':intensity>.55?'#b87b00':intensity>.35?'#926a3c':'#2a6b4a';
    return{type:'Feature',geometry:{type:'Point',coordinates:[z.lng,z.lat]},
      properties:{...z,col,intensity,radius:z.r/111320}};
  });
  map.addSource('heatmap',{type:'geojson',data:{type:'FeatureCollection',features}});
  map.addLayer({id:'heatmap-outer',type:'circle',source:'heatmap',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],10,['*',['get','intensity'],60],14,['*',['get','intensity'],200]],
    'circle-color':['get','col'],'circle-opacity':0.18,'circle-blur':0.6
  }});
  map.addLayer({id:'heatmap-inner',type:'circle',source:'heatmap',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],10,['*',['get','intensity'],20],14,['*',['get','intensity'],70]],
    'circle-color':['get','col'],'circle-opacity':0.40,'circle-blur':0.3
  }});
  map.on('click','heatmap-outer',e=>{
    const p=e.features[0].properties;
    new mapboxgl.Popup({maxWidth:'260px'}).setLngLat(e.lngLat)
      .setHTML(`<div style="font-family:sans-serif;max-width:220px;"><b style="font-size:.82rem">${p.z}</b><br><span style="color:var(--muted);font-size:.67rem">${p.sub}</span><br><div style="margin-top:6px;padding:6px 8px;background:var(--red-l);border-radius:4px;font-size:.7rem;">📅 <b>Jan 2026:</b> ${p.monthly_jan26} cases<br>📊 <b>Full Year 2025:</b> ${p.annual2025} cases<br><span style="color:var(--muted);font-size:.64rem">${p.breakdown}</span></div></div>`)
      .addTo(map);
  });
  toast('Mumbai Police Data: 7,143 crimes against women in 2025 | 515 in Jan 2026');
}

/* ── LIVE NAVIGATION ── */
let _navActive=false,_navWatchId=null,_navArrowMarker=null;
let _navRoute=null,_navStepIdx=0,_navLastLat=null,_navLastLng=null,_navBearing=0;

function calcBearing(la1,lo1,la2,lo2){
  const f1=la1*Math.PI/180,f2=la2*Math.PI/180,dl=(lo2-lo1)*Math.PI/180;
  const y=Math.sin(dl)*Math.cos(f2),x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl);
  return((Math.atan2(y,x)*180/Math.PI)+360)%360;
}

function onGPSUpdate(pos){
  const lat=pos.coords.latitude,lng=pos.coords.longitude;
  _uLat=lat;_uLng=lng;
  if(_navLastLat!==null){const moved=hav(lat,lng,_navLastLat,_navLastLng);if(moved>2)_navBearing=calcBearing(_navLastLat,_navLastLng,lat,lng);}
  _navLastLat=lat;_navLastLng=lng;
  const el=document.createElement('div');
  el.innerHTML=`<div style="position:relative;width:40px;height:40px;"><div style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:.2;animation:navPulse 1.8s ease-out infinite;"></div><div style="position:absolute;inset:5px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 10px #2563eb99;display:flex;align-items:center;justify-content:center;transform:rotate(${_navBearing}deg);"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L14 14L9 11L4 14Z" fill="white"/></svg></div></div>`;
  if(_navArrowMarker){_navArrowMarker.setLngLat([lng,lat]);const old=_navArrowMarker.getElement();old.innerHTML=el.innerHTML;}
  else{_navArrowMarker=new mapboxgl.Marker({element:el,rotationAlignment:'map'}).setLngLat([lng,lat]).addTo(map);}
  map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),16)});
  detectStep(lat,lng);
  const dest=_navRoute.coords[_navRoute.coords.length-1];
  const distLeft=hav(lat,lng,dest[0],dest[1]);
  document.getElementById('navDistLeft').textContent=distLeft<1000?Math.round(distLeft)+'m':(distLeft/1000).toFixed(1)+'km';
  document.getElementById('navTimeLeft').textContent=Math.round(distLeft/_navSpeed())+' min';
  if(distLeft<30)stopNavigation(true);
}

function detectStep(lat,lng){
  const steps=_navRoute?.steps;if(!steps||!steps.length)return;
  for(let i=_navStepIdx;i<Math.min(_navStepIdx+8,steps.length-1);i++){
    const s=steps[i];if(!s.maneuver?.location)continue;
    const d=hav(lat,lng,s.maneuver.location[1],s.maneuver.location[0]);
    if(d<40&&i+1!==_navStepIdx){
      _navStepIdx=i+1;highlightTurnStep(_navStepIdx);
      const next=steps[_navStepIdx];
      if(next){const mod=next.maneuver?.modifier||'',name=next.name||'road';
        const instr=mod.includes('right')?'Turn right onto '+name:mod.includes('left')?'Turn left onto '+name:'Continue on '+name;
        document.getElementById('navInstruction').textContent=instr;toast('🧭 '+instr);}
      break;
    }
  }
}

function startNavigation(){
  if(!routeData.length){toast('Find a route first');return;}
  if(!navigator.geolocation){toast('GPS not available');return;}
  _navRoute=routeData[0];_navActive=true;_navStepIdx=0;_navLastLat=null;_navLastLng=null;_navBearing=0;
  document.getElementById('startNavBtn').style.display='none';
  document.getElementById('stopNavBtn').style.display='block';
  document.getElementById('navStatus').style.display='flex';
  const first=_navRoute.steps?.[0];
  document.getElementById('navInstruction').textContent=first?'Head towards '+(first.name||'route'):'Follow the blue route';
  toast('🧭 Navigation started — follow the blue route');
  _navWatchId=navigator.geolocation.watchPosition(onGPSUpdate,
    err=>{if(err.code===1)toast('Enable GPS in browser settings');else toast('GPS signal weak — retrying…');},
    {enableHighAccuracy:true,maximumAge:0,timeout:10000});
}

function _navSpeed(){return _mode==='walking'?80:350;}

function stopNavigation(arrived){
  _navActive=false;
  if(_navWatchId!==null){navigator.geolocation.clearWatch(_navWatchId);_navWatchId=null;}
  document.getElementById('startNavBtn').style.display='block';
  document.getElementById('stopNavBtn').style.display='none';
  document.getElementById('navStatus').style.display='none';
  if(_navArrowMarker){_navArrowMarker.remove();_navArrowMarker=null;}
  if(routeData[0])fitRouteBounds(routeData[0].coords);
  toast(arrived?'🏁 You have arrived!':'Navigation stopped');
  document.querySelectorAll('.turn-item').forEach(el=>el.classList.remove('active-turn'));
}

function highlightTurnStep(idx){
  document.querySelectorAll('.turn-item').forEach((el,i)=>{
    el.classList.toggle('active-turn',i===idx);
    if(i===idx)el.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}

/* ── AI ASSISTANT ── */
async function sendAI(){
  const inp=document.getElementById('aiInput');const msgs=document.getElementById('aiMsgs');
  const text=inp.value.trim();if(!text)return;inp.value='';
  const ub=document.createElement('div');ub.className='ai-bubble ai-user';ub.textContent=text;msgs.appendChild(ub);
  const lb=document.createElement('div');lb.className='ai-bubble ai-bot ai-loading';lb.textContent='Thinking…';msgs.appendChild(lb);
  msgs.scrollTop=msgs.scrollHeight;
  await new Promise(r=>setTimeout(r,500+Math.random()*500));
  lb.classList.remove('ai-loading');lb.textContent=aiReply(text.toLowerCase());msgs.scrollTop=msgs.scrollHeight;
}
function aiReply(q){
  const ist=getIST(),h=ist.getHours();
  const isNight=h>=21||h<5,isEve=h>=18&&h<21;
  const hr=routeData.length>0,rs=hr?routeData[0].score:null,hs=hr?routeData[0].near.map(n=>n.name):[];
  if(/help|danger|attack|follow|stalk|emergency|harass|scared/i.test(q))return'🚨 Call 112 immediately or 1091 (Women\'s Helpline). Move to a crowded, lit area — shop, petrol pump, police chowki.';
  if(hr&&/route|path|this route|safe.*travel/i.test(q)){const lbl=rs>=70?'safe':rs>=45?'moderately risky':'high risk';return'Your route scores '+rs+'/100 — '+lbl+'. '+(hs.length?'Watch out near: '+hs.slice(0,3).join(', ')+'.':'No major hotspots detected.')+(isNight?' ⚠ Score is penalised for night hours.':'');}
  if(/dharavi/i.test(q))return'⚠ Dharavi is high-risk, especially after 8 PM. Stick to Sion-Dharavi Road and avoid narrow internal lanes.';
  if(/kurla|govandi|mankhurd/i.test(q))return'🔴 These are highest-risk zones. Travel only in daytime with a companion. Keep 112 ready.';
  if(/colaba|worli/i.test(q))return'🟢 Colaba and Worli are relatively low-risk. Normal precautions apply after midnight.';
  if(/night|dark|late|midnight/i.test(q))return'🌙 At night: (1) Share live location, (2) Use Safe Walk Timer, (3) Stick to lit main roads, (4) Use app-based cabs with trip sharing. Call 1091 if harassed.';
  if(/follow|being followed/i.test(q))return'1. Don\'t go home — enter a crowded shop. 2. Call someone loudly. 3. Find a police chowki. 4. Call 100 if it persists.';
  if(/train|local|metro|railway/i.test(q))return'🚉 Always use the Ladies\' compartment. At night, stand near the guard coach. Avoid empty platforms.';
  if(/sos|helpline|number|emergency/i.test(q))return'📞 112 — All emergencies\n1091 — Women\'s Helpline (24/7)\n100 — Police\n108 — Ambulance';
  if(/tip|advice|safe/i.test(q))return(isNight?'Night — extra caution. ':isEve?'Evening — stay alert. ':'Daytime — generally safe. ')+'Key tips: (1) Share live location, (2) Safe Walk Timer, (3) Lit main roads, (4) Ladies compartment in trains, (5) Keep 112 on speed dial.';
  if(/ncrb|data|statistics|crime rate|mumbai police/i.test(q))return'📊 Mumbai Police Data:\n• 2025: 7,143 crimes against women\n• Jan 2026: 515 cases (80 rape, 111 kidnapping, 174 molestation)\n• Highest risk: Zone III (Central/Dharavi) and Zone VI-VII (Eastern Suburbs)';
  return['I can help with safety tips, area risk info, or analysing your route.','Try asking: "Is Kurla safe at night?" or "What to do if someone follows me?"','I know Mumbai\'s crime zones, transport safety, and emergency numbers.'][Math.floor(Math.random()*3)];
}

/* ── HELPERS ── */
function showPill(t){document.getElementById('pillTxt').textContent=t;document.getElementById('pill').classList.add('on');}
function hidePill(){document.getElementById('pill').classList.remove('on');}

/* ── WIRE ALL EVENTS ── */
document.getElementById('navSos').addEventListener('click',openSOS);
document.getElementById('goBtn').addEventListener('click',planRoutes);
document.getElementById('modeDrive').addEventListener('click',()=>setMode('driving'));
document.getElementById('modeWalk').addEventListener('click',()=>setMode('walking'));
document.getElementById('swapBtn').addEventListener('click',()=>{
  const a=document.getElementById('inFrom').value, b=document.getElementById('inTo').value;
  document.getElementById('inFrom').value=b;
  document.getElementById('inTo').value=a;
  [fromCoords,toCoords]=[toCoords,fromCoords];
  // Clear old route since origin/dest changed
  if(routeData.length){ clearRL(); clearSS(); routeData=[]; ['blockRoutes','blockScore','blockTurns','blockHs','blockSs','blockTimeline','navBtns'].forEach(id=>document.getElementById(id).style.display='none'); document.getElementById('emptyState').style.display='block'; }
});
document.getElementById('clearFrom').addEventListener('click',()=>{document.getElementById('inFrom').value='';fromCoords=null;hideDrop('dropFrom');});
document.getElementById('clearTo').addEventListener('click',  ()=>{document.getElementById('inTo').value='';  toCoords=null;  hideDrop('dropTo');});
document.getElementById('btnLoc').addEventListener('click',useMyLocation);
document.getElementById('locBtn').addEventListener('click',()=>{ hideDrop('dropFrom'); useMyLocation(); });
document.getElementById('btnSos').addEventListener('click',openSOS);
document.getElementById('btnTimer').addEventListener('click',startTimer);
document.getElementById('btnFakeCall').addEventListener('click',startFakeCall);
document.getElementById('tcStart').addEventListener('click',startTimer);
document.getElementById('tcStop').addEventListener('click',stopTimer);
document.getElementById('tcShare').addEventListener('click',shareMyLocation);
document.getElementById('addContactBtn').addEventListener('click',addContact);
document.getElementById('rc0').addEventListener('click',()=>pickRoute(0));
document.getElementById('rc1').addEventListener('click',()=>pickRoute(1));
document.getElementById('rc2').addEventListener('click',()=>pickRoute(2));
document.getElementById('closeSos').addEventListener('click',closeSOS);
document.getElementById('modalShare').addEventListener('click',shareMyLocation);
document.getElementById('sosModal').addEventListener('click',e=>{if(e.target===document.getElementById('sosModal'))closeSOS();});
document.getElementById('fcDecline').addEventListener('click',endFakeCall);
document.getElementById('fcAccept').addEventListener('click',endFakeCall);
document.getElementById('irBannerBtn').addEventListener('click',openIRModal);
document.getElementById('mapReportBtn').addEventListener('click',openIRModal);
document.getElementById('irSubmit').addEventListener('click',submitIncident);
document.getElementById('irCancel').addEventListener('click',closeIRModal);
document.getElementById('irModal').addEventListener('click',e=>{if(e.target===document.getElementById('irModal'))closeIRModal();});
document.getElementById('heatmapBtn').addEventListener('click',toggleHeatmap);
document.getElementById('startNavBtn').addEventListener('click',startNavigation);
document.getElementById('stopNavBtn').addEventListener('click',()=>stopNavigation(false));
document.getElementById('aiSend').addEventListener('click',sendAI);
document.getElementById('aiInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendAI();});

/* ── INIT AFTER MAP LOADS ── */
// style.load fires on initial load AND after style changes (night/day toggle)
map.on('style.load',()=>{
  addHotspotLayers();
  add3DBuildings();
  // Re-add heatmap if it was active before style change
  if(_hon){
    _hon=false; // reset so toggleHeatmap re-adds instead of removes
    toggleHeatmap();
  }
  if(routeData.length){
    _routeLayersAdded=false;
    routeData.forEach((r,i)=>drawRoute(r,i,i===0?0.9:0.3,i===0?5:3));
  }
});

renderContacts();

/* ══════════════════════════════════════
   MOBILE BOTTOM SHEET BEHAVIOUR
   ══════════════════════════════════════ */
(function(){
  const sidebar = document.querySelector('.sidebar');
  if(!sidebar) return;

  const isMobile = () => window.innerWidth <= 768;

  // Expand when user taps the handle area or search
  function expand(){ sidebar.classList.add('expanded'); }
  function collapse(){ sidebar.classList.remove('expanded'); }

  // Auto-expand when route is found
  const _origUpdatePanel = window._updatePanelHook;

  // Tap handle (top 44px of sidebar) to toggle
  sidebar.addEventListener('click', e => {
    if(!isMobile()) return;
    const rect = sidebar.getBoundingClientRect();
    const tapY = e.clientY - rect.top;
    if(tapY < 48) { // hit the handle area
      sidebar.classList.contains('expanded') ? collapse() : expand();
    }
  });

  // Touch drag on the handle
  let startY = 0, startExpanded = false;
  sidebar.addEventListener('touchstart', e => {
    if(!isMobile()) return;
    const rect = sidebar.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;
    if(touchY > 60) return; // only drag from handle zone
    startY = e.touches[0].clientY;
    startExpanded = sidebar.classList.contains('expanded');
  }, {passive: true});

  sidebar.addEventListener('touchend', e => {
    if(!isMobile()) return;
    const endY = e.changedTouches[0].clientY;
    const delta = endY - startY;
    if(Math.abs(delta) < 10) return; // tap, handled above
    if(delta > 30 && startExpanded) collapse();
    if(delta < -30 && !startExpanded) expand();
  }, {passive: true});

  // Tap on map area (outside sidebar) collapses sheet
  document.getElementById('map').addEventListener('click', () => {
    if(isMobile()) collapse();
  });

  // After route is found, expand sheet to show results
  const goBtn = document.getElementById('goBtn');
  if(goBtn){
    goBtn.addEventListener('click', () => {
      if(isMobile()) setTimeout(() => expand(), 2000);
    });
  }

  // Scroll inside sheet shouldn't collapse it
  document.querySelector('.sb').addEventListener('touchmove', e => {
    e.stopPropagation();
  }, {passive: true});

  // On resize, reset
  window.addEventListener('resize', () => {
    if(!isMobile()) sidebar.classList.remove('expanded');
  });
})();


});