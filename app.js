const $=s=>document.querySelector(s);
let T=sessionStorage.getItem('t'),ROLE=sessionStorage.getItem('r'),NAME=sessionStorage.getItem('n')||'',D={},TAB='usr',EID='',ME={},LAP=[],MON='',MD='',LASTRA='',EDITID='';
const esc=s=>String(s==null?'':s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&#39;');
let PEND=0,LT=null;
function ldOn(){PEND++;if(PEND==1){$('#bar').classList.add('on');LT=setTimeout(()=>$('#ld').classList.add('on'),300)}}
function ldOff(){PEND=Math.max(0,PEND-1);if(PEND==0){clearTimeout(LT);$('#bar').classList.remove('on');$('#ld').classList.remove('on')}}
async function call(a,p){ldOn();
  try{
    let res;
    try{res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({a:a,t:T,p:p||{}})})}
    catch(e){throw new Error('Tidak dapat terhubung ke server. Periksa API_URL di konfigurasi.js, akses Anyone, dan koneksi internet.')}
    let r;
    try{r=await res.json()}catch(e){throw new Error('Respons server tidak valid. Pastikan Api.gs sudah di-deploy sebagai New version.')}
    if(!r.ok)throw new Error(r.error);
    return r.data;
  }finally{ldOff()}}
function toast(m,ok){const d=document.createElement('div');d.className='toast '+(ok?'ok':'err');d.textContent=(ok?'\u2714 ':'\u2716 ')+m;document.body.appendChild(d);setTimeout(()=>d.remove(),4500)}
async function run(f){try{await f()}catch(e){toast(e.message,false);if(e.message.indexOf('Sesi berakhir')>=0)logout(true)}}
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const mins=(a,b)=>{const m=x=>+x.slice(0,2)*60+ +x.slice(3,5);return Math.max(0,m(b)-m(a))};
const fmt=m=>Math.floor(m/60)+' jam '+m%60+' menit';
const triw=d=>['I','II','III','IV'][Math.floor((+d.slice(5,7)-1)/3)];
const topbar=t=>`<div class=top><div><b class=b>E-</b><b class=y>KINERJA</b> &nbsp;<span class=muted>${esc(t)}</span></div><button class="btn ghost sm" onclick="logout()">Keluar</button></div>`;

const PAGE=document.body.getAttribute('data-page');
const HOME={admin:'admin.html',user:'pengguna.html'};
function showLogin(){
  $('#app').innerHTML=`<div class=login><h1><span class=b>E-</span><span class=y>KINERJA</span></h1><p>Silakan login dengan akun Anda</p>
  <label>Username (Admin) / NIP (Pengguna)</label><input id=lu autofocus><label>Password</label><input id=lp type=password>
  <button class=btn id=lb onclick=doLogin()>Log In</button></div>`;
  $('#lp').onkeydown=function(e){if(e.key=='Enter'){doLogin()}};
}
async function doLogin(){const b=$('#lb');b.disabled=true;b.textContent='Memproses...';
  try{const r=await call('login',{u:$('#lu').value,p:$('#lp').value});
    T=r.token;ROLE=r.role;NAME=r.name;sessionStorage.setItem('t',T);sessionStorage.setItem('r',ROLE);sessionStorage.setItem('n',NAME);
    location.href=HOME[ROLE]
  }catch(e){toast(e.message,false);b.disabled=false;b.textContent='Log In'}}
function logout(silent){if(!silent&&T)call('logout').catch(()=>{});T=ROLE=null;sessionStorage.clear();location.href='index.html'}
function guard(role){if(!T||ROLE!=role){location.href='index.html';return false}return true}
function initLogin(){if(T&&HOME[ROLE]){location.href=HOME[ROLE];return}showLogin()}
function initAdmin(){if(!guard('admin'))return;run(async()=>{D=await call('a_data');const h=location.hash.slice(1);if(['usr','jab','ra','rk'].indexOf(h)>=0)TAB=h;if(TAB=='rk')await loadRk();else renderAdmin()})}
function initUser(){if(!guard('user'))return;run(async()=>{ME=await call('u_me');LAP=await call('u_list');renderUser()})}
function initSetting(){if(!guard('admin'))return;run(async()=>{D=await call('a_data');renderSetting()})}

/* ================= ADMIN ================= */
async function sv(a,p){await run(async()=>{await call(a,p);EID='';D=await call('a_data');renderAdmin();toast('Berhasil disimpan',true)})}
function tabBar(active){return `<div class="tabs noprint">${[['usr','Pengguna'],['jab','Jabatan'],['ra','Rencana Aksi'],['rk','Rekap Laporan'],['set','Pengaturan']].map(([k,l])=>`<button class="tab ${k==active?'on':''}" onclick="navTab('${k}')">${l}</button>`).join('')}</div>`}
function navTab(k){if(k=='set'){location.href='pengaturan.html';return}if(PAGE=='admin')goTab(k);else location.href='admin.html#'+k}
function renderAdmin(){
  $('#app').innerHTML=topbar('Administrator')+`<div class=wrap>${tabBar(TAB)}<div class=card id=pane></div></div>`;
  ({usr:pUsr,jab:pJab,ra:pRa,rk:pRk})[TAB]();
}
function renderSetting(){$('#app').innerHTML=topbar('Administrator')+`<div class=wrap>${tabBar('set')}<div class=card id=pane></div></div>`;pAcc()}
const jn=id=>(D.jab.find(j=>j.id==id)||{}).nama||'-';
const rn=id=>(D.ra.find(r=>r.id==id)||{}).nama;
const opts=(arr,sel,ph)=>`<option value="">${ph}</option>`+arr.map(x=>`<option value="${x.id}" ${x.id==sel?'selected':''}>${esc(x.nama)}</option>`).join('');
const cancel=`<button class="btn ghost" onclick="EID='';renderAdmin()">Batal</button>`;

function pJab(){const e=D.jab.find(j=>j.id==EID)||{};
  $('#pane').innerHTML=`<h3>${EID?'Edit':'Tambah'} Jabatan</h3><div class=row><input id=f1 placeholder="Nama jabatan" value="${esc(e.nama)}"><button class=btn onclick="sv('a_saveJab',{id:EID,nama:$('#f1').value})">Simpan</button>${EID?cancel:''}</div>
  <div class=tw><table><tr><th>Jabatan</th><th width=150>Aksi</th></tr>${D.jab.map(j=>`<tr><td>${esc(j.nama)}</td><td><button class="btn sm" onclick="EID='${j.id}';renderAdmin()">Edit</button> <button class="btn sm red" onclick="confirm('Hapus jabatan?')&&sv('a_delJab',{id:'${j.id}'})">Hapus</button></td></tr>`).join('')||'<tr><td colspan=2 class=muted>Belum ada jabatan</td></tr>'}</table></div>`}

const rnn=id=>{const r=D.ra.find(x=>x.id==id);return r?r.nama+' ('+r.tahun+')':''};
const yrList=()=>{const c=+today().slice(0,4);return Array.from(new Set(D.ra.map(r=>r.tahun).filter(Boolean).concat([String(c-1),String(c),String(c+1),String(c+2)]))).sort().reverse()};
let FRA={t:today().slice(0,4),j:''},RAY=[],SELRA=new Set();
function pRa(){const e=D.ra.find(r=>r.id==EID)||{},yl=yrList(),ty=e.tahun||FRA.t||today().slice(0,4),cur=+today().slice(0,4);
  const rows=D.ra.filter(r=>(!FRA.t||r.tahun==FRA.t)&&(!FRA.j||r.jabatanId==FRA.j)).sort((a,b)=>b.tahun.localeCompare(a.tahun)||jn(a.jabatanId).localeCompare(jn(b.jabatanId))||a.nama.localeCompare(b.nama));
  const yo=(sel)=>yl.map(y=>`<option ${y==sel?'selected':''}>${y}</option>`).join('');
  $('#pane').innerHTML=`<h3>${EID?'Edit':'Tambah'} Rencana Aksi</h3><div class=row><div style="flex:0 0 110px;min-width:100px"><span class=lbl>Periode Tahun</span><select id=f3>${yo(ty)}</select></div><div><span class=lbl>Jabatan</span><select id=f1>${opts(D.jab,e.jabatanId,'-- Pilih Jabatan --')}</select></div><div style="flex:2"><span class=lbl>Rencana Aksi</span><input id=f2 placeholder="Rencana aksi" value="${esc(e.nama)}"></div><button class=btn style="align-self:end" onclick="sv('a_saveRa',{id:EID,jabatanId:$('#f1').value,tahun:$('#f3').value,nama:$('#f2').value})">Simpan</button>${EID?cancel:''}</div>
  <div class=row style="align-items:end"><div><span class=lbl>Tampilkan Periode Tahun</span><select onchange="FRA.t=this.value;renderAdmin()"><option value="">Semua Tahun</option>${yo(FRA.t)}</select></div><div><span class=lbl>Tampilkan Jabatan</span><select onchange="FRA.j=this.value;renderAdmin()">${opts(D.jab,FRA.j,'Semua Jabatan')}</select></div></div>
  <div class=tw><table><tr><th width=80>Tahun</th><th>Jabatan</th><th>Rencana Aksi</th><th width=150>Aksi</th></tr>${rows.map(r=>`<tr><td>${esc(r.tahun)}</td><td>${esc(jn(r.jabatanId))}</td><td>${esc(r.nama)}</td><td><button class="btn sm" onclick="EID='${r.id}';renderAdmin()">Edit</button> <button class="btn sm red" onclick="confirm('Hapus rencana aksi?')&&sv('a_delRa',{id:'${r.id}'})">Hapus</button></td></tr>`).join('')||'<tr><td colspan=4 class=muted>Belum ada rencana aksi pada filter ini</td></tr>'}</table></div>
  <div class=box style="margin-top:14px"><b>Salin rencana aksi ke tahun baru</b><div class=row style="align-items:end"><div><span class=lbl>Dari tahun</span><select id=cf>${yo(String(cur))}</select></div><div><span class=lbl>Ke tahun</span><select id=ct>${yo(String(cur+1))}</select></div><button class="btn ghost" onclick="copyRa()">Salin</button></div><div class=muted style="font-size:12px">Rencana aksi yang sudah ada di tahun tujuan tidak digandakan.</div></div>`}
function copyRa(){run(async()=>{const f=$('#cf').value,t=$('#ct').value;if(f==t)throw new Error('Tahun asal dan tahun tujuan tidak boleh sama');const n=await call('a_copyRa',{from:f,to:t});D=await call('a_data');FRA.t=t;renderAdmin();toast(n+' rencana aksi disalin ke tahun '+t,true)})}

function pUsr(){const e=D.usr.find(u=>u.id==EID)||{ra:[]};
  $('#pane').innerHTML=`<h3>${EID?'Edit':'Tambah'} Pengguna</h3><div class=row><input id=f1 placeholder="Nama lengkap" value="${esc(e.nama)}"><input id=f2 placeholder="NIP (dipakai untuk login)" value="${esc(e.nip)}"><input id=f3 type=password placeholder="${EID?'Password baru (kosongkan jika tidak diubah)':'Password'}"></div>
  <div class=row><div><span class=lbl>Jabatan</span><select id=f4 onchange="SELRA=new Set();drawRa()">${opts(D.jab,e.jabatanId,'-- Pilih Jabatan (satu) --')}</select></div><div style="flex:0 0 140px;min-width:120px"><span class=lbl>Periode Tahun</span><select id=f5 onchange="drawRa()">${yrList().map(y=>`<option ${y==today().slice(0,4)?'selected':''}>${y}</option>`).join('')}</select></div></div>
  <b style="font-size:14px">Rencana Aksi (boleh lebih dari satu)</b><div class=chk id=rach></div>
  <div class=muted style="font-size:12px;margin-bottom:10px">Pilihan tersimpan untuk semua tahun. Jika pada suatu tahun tidak ada yang dicentang, pengguna otomatis mendapat semua rencana aksi jabatannya pada tahun itu.</div>
  <button class=btn onclick="saveUser()">Simpan</button> ${EID?cancel:''}
  <div class=tw style="margin-top:16px"><table><tr><th>Nama</th><th>NIP</th><th>Jabatan</th><th>Rencana Aksi</th><th width=150>Aksi</th></tr>${D.usr.map(u=>`<tr><td>${esc(u.nama)}</td><td>${esc(u.nip)}</td><td>${esc(jn(u.jabatanId))}</td><td>${u.ra.map(i=>esc(rnn(i))).filter(Boolean).join('<br>')||'-'}</td><td><button class="btn sm" onclick="EID='${u.id}';renderAdmin()">Edit</button> <button class="btn sm red" onclick="confirm('Hapus pengguna beserta laporannya?')&&sv('a_delUser',{id:'${u.id}'})">Hapus</button></td></tr>`).join('')||'<tr><td colspan=5 class=muted>Belum ada pengguna</td></tr>'}</table></div>`;
  SELRA=new Set(e.ra);drawRa()}
function drawRa(){const j=$('#f4').value,y=$('#f5').value,l=D.ra.filter(r=>r.jabatanId==j&&r.tahun==y);
  $('#rach').innerHTML=!j?'<span class=muted>Pilih jabatan dahulu</span>':l.map(r=>`<label><input type=checkbox class=rc value="${r.id}" ${SELRA.has(r.id)?'checked':''} onchange="selRa(this)">${esc(r.nama)}</label>`).join('')||`<span class=muted>Jabatan ini belum punya rencana aksi pada tahun ${y}</span>`}
function selRa(el){if(el.checked)SELRA.add(el.value);else SELRA.delete(el.value)}
function saveUser(){sv('a_saveUser',{id:EID,nama:$('#f1').value,nip:$('#f2').value,password:$('#f3').value,jabatanId:$('#f4').value,ra:Array.from(SELRA)})}

function pAcc(){$('#pane').innerHTML=`<h3>Ubah Username & Password Admin</h3><div style="max-width:380px"><span class=lbl>Password lama</span><input id=f1 type=password><span class=lbl>Username baru</span><input id=f2 placeholder="admin"><span class=lbl>Password baru (kosongkan jika tidak diubah)</span><input id=f3 type=password><br><br><button class=btn onclick="chAdmin()">Simpan</button></div>`}
function chAdmin(){run(async()=>{await call('a_changeAdmin',{old:$('#f1').value,u:$('#f2').value,pass:$('#f3').value});toast('Berhasil. Silakan login ulang.',true);logout(true)})}

/* ================= PENGGUNA ================= */
function renderUser(){const S=F.u,l=S.all?LAP:LAP.filter(r=>r.tanggal.startsWith(S.mon)),tot=l.reduce((s,r)=>s+mins(r.mulai,r.selesai),0),per={};
  l.forEach(r=>{const x=per[r.raNama]=per[r.raNama]||{n:0,m:0,rl:0};x.n++;x.m+=mins(r.mulai,r.selesai);x.rl+=(+r.realisasi||0)});
  $('#app').innerHTML=topbar(ME.nama)+`<div class=wrap><div class="card noprint"><b>${esc(ME.nama)}</b> &middot; NIP ${esc(ME.nip)}<br><span class=muted>${esc(ME.jabatan)}</span></div>
  <div class="card noprint"><div class=row><button class="btn ghost" onclick="refresh()">&#8635; Muat Ulang</button><button class=btn onclick="openQ()">+ Input Cepat Kinerja Harian</button></div><span class=chip>Total: ${fmt(tot)}</span><span class=chip>${l.length} kegiatan</span></div>
  <div class="card noprint"><h3>Rekap per Rencana Aksi</h3><div class=tw><table><tr><th>Rencana Aksi</th><th>Jumlah Kegiatan</th><th>Total Jam</th><th>Total Realisasi</th></tr>${Object.keys(per).map(k=>`<tr><td>${esc(k)}</td><td>${per[k].n}</td><td>${fmt(per[k].m)}</td><td>${per[k].rl}</td></tr>`).join('')||'<tr><td colspan=4 class=muted>Belum ada data</td></tr>'}</table></div></div>
  <div class=card><h3 class=noprint>Rekap Laporan</h3>${rkBar('u',LAP,false)}<div class=onlyprint><h3>Rekap Laporan Kinerja Harian</h3><div>Nama: ${esc(ME.nama)} &middot; NIP ${esc(ME.nip)}</div><div>Jabatan: ${esc(ME.jabatan)}</div><div>Periode: ${periodTxt(S)}</div></div>${rkTable(l,false,true)}</div></div><div id=mdl></div>`}
async function delLap(id){if(!confirm('Hapus laporan ini?'))return;run(async()=>{await call('u_del',{id});LAP=await call('u_list');renderUser();toast('Laporan dihapus',true);if(MD)openQ(MD)})}
function refresh(){run(async()=>{ME=await call('u_me');LAP=await call('u_list');renderUser();toast('Data diperbarui dari database',true)})}
const tm=t=>mins('00:00',t);
const pad2=n=>('0'+n).slice(-2);
const hhmm=t=>pad2(Math.floor(t/60))+':'+pad2(t%60);
const rng=r=>r.mulai+' - '+r.selesai;
const taken=()=>LAP.filter(r=>r.tanggal==MD&&r.id!=EDITID).map(r=>[tm(r.mulai),tm(r.selesai)]);
const TS={a:{h:null,m:null},b:{h:null,m:null}};
const tp=id=>`<div class=ti><input id=${id} readonly placeholder="--:--" onclick="togT('${id}',event)"><svg class=ic width=16 height=16 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=12 r=9></circle><path d="M12 7v5l3 2"></path></svg><div class=tpop id=${id}p onclick="event.stopPropagation()"></div></div>`;
function getT(id){const s=TS[id];return(s.h!=null&&s.m!=null)?s.h*60+s.m:null}
function allowT(id,t){const tk=taken();if(id=='a')return!tk.some(r=>t>=r[0]&&t<r[1]);const st=getT('a');return st==null||(t>st&&!tk.some(r=>r[0]<t&&r[1]>st))}
function firstMin(id,h){for(let m=0;m<60;m+=5)if(allowT(id,h*60+m))return m;return 0}
function syncT(id){const t=getT(id);$('#'+id).value=t==null?'':hhmm(t)}
function setT(id,t){TS[id]=t==null?{h:null,m:null}:{h:Math.floor(t/60),m:t%60};syncT(id)}
function paintT(id){const s=TS[id],p=$('#'+id+'p'),h0=$('#'+id+'hc'),m0=$('#'+id+'mc'),sh=h0?h0.scrollTop:0,sm=m0?m0.scrollTop:0;let hs='',ms='';
  for(let h=0;h<24;h++){let ok=false;for(let m=0;m<60;m+=5)if(allowT(id,h*60+m)){ok=true;break}
    hs+=`<button type=button class="${s.h===h?'sel':''}" ${ok?'':'disabled'} onclick="pickT('${id}','h',${h})">${pad2(h)}</button>`}
  for(let m=0;m<60;m+=5){const ok=s.h==null||allowT(id,s.h*60+m);
    ms+=`<button type=button class="${s.m===m?'sel':''}" ${ok?'':'disabled'} onclick="pickT('${id}','m',${m})">${pad2(m)}</button>`}
  p.innerHTML=`<div class=tcol id=${id}hc>${hs}</div><div class=tcol id=${id}mc>${ms}</div>`;
  $('#'+id+'hc').scrollTop=sh;$('#'+id+'mc').scrollTop=sm}
function togT(id,e){e.stopPropagation();const p=$('#'+id+'p'),open=p.classList.contains('on');closeT();
  if(!open){p.classList.add('on');paintT(id);const el=p.querySelector('.tcol button.sel');if(el)$('#'+id+'hc').scrollTop=Math.max(0,el.offsetTop-90)}}
function closeT(){document.querySelectorAll('.tpop').forEach(x=>x.classList.remove('on'))}
function pickT(id,k,v){const s=TS[id];
  if(k=='h'){s.h=v;s.m=(s.m!=null&&allowT(id,v*60+s.m))?s.m:firstMin(id,v)}
  else{s.m=v;if(s.h==null){let h=8;if(!allowT(id,h*60+v)){h=0;while(h<23&&!allowT(id,h*60+v))h++}s.h=h}}
  syncT(id);if(id=='a')paintT('b');paintT(id);chk();
  if(k=='m')closeT()}
document.addEventListener('click',closeT);
function chk(){const a=getT('a'),b=getT('b'),tk=taken();let err='';
  if(a!=null&&b!=null){if(b<=a)err='Jam selesai harus setelah jam mulai.';else if(tk.some(r=>a<r[1]&&b>r[0]))err='Rentang jam bentrok dengan kegiatan lain pada tanggal ini.'}
  else if(a!=null&&tk.some(r=>a>=r[0]&&a<r[1]))err='Jam mulai berada di rentang yang sudah terpakai.';
  const ok=$('#q2').value&&$('#q3').value.trim()&&a!=null&&b!=null&&$('#q6').value.trim().indexOf('http')===0&&+$('#q7').value>=1&&!err;
  $('#qs').disabled=!ok;$('#qok').disabled=!ok;$('#qh').style.color=err?'#e5484d':'';
  $('#qh').textContent=err||(ok?'':'Semua kolom wajib diisi. Bukti dukung berupa link (diawali http atau https).')}
function numOnly(el){el.value=el.value.split('').filter(c=>c>='0'&&c<='9').join('')}
function readForm(){return{ra:$('#q2').value,keg:$('#q3').value,a:getT('a'),b:getT('b'),bukti:$('#q6').value,rl:$('#q7').value}}
function chDate(v){openQ(v||today(),EDITID,readForm())}
function openQ(d,id,draft){MD=d||today();EDITID=id||'';
  const l=LAP.filter(r=>r.tanggal==MD).sort((a,b)=>a.mulai.localeCompare(b.mulai)),tot=l.reduce((s,r)=>s+mins(r.mulai,r.selesai),0);
  const rec=EDITID?LAP.find(r=>r.id==EDITID):null;
  RAY=ME.ra.filter(r=>r.tahun==MD.slice(0,4));
  const v=draft||(rec?{ra:rec.rencanaAksiId,keg:rec.kegiatan,a:tm(rec.mulai),b:tm(rec.selesai),bukti:rec.bukti=='-'?'':rec.bukti,rl:rec.realisasi||''}:{ra:LASTRA,keg:'',a:null,b:null,bukti:'',rl:''});
  $('#mdl').innerHTML=`<div class=mask><div class=modal><div class=mh>Input Cepat Kinerja Harian<a style="cursor:pointer" onclick="closeQ()">&times;</a></div><div class=mb>
  <div class=row><div><span class=lbl>Tanggal Kegiatan</span><input type=date id=q1 value="${MD}" onchange="chDate(this.value)"></div><div style="flex:0 0 auto;align-self:end"><button class="btn ghost" onclick="chDate(today())">Hari Ini</button> <button class="btn ghost" onclick="chDate(new Date(Date.now()-864e5-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10))">Kemarin</button></div></div>
  <div class=row><div><span class=lbl>SKP / Jabatan</span>${esc(ME.jabatan)}</div><div><span class=lbl>Periode Penilaian</span>TRIWULAN ${triw(MD)} &middot; TAHUN ${MD.slice(0,4)}</div></div><hr>
  <b>Kegiatan Tanggal Ini (${l.length})</b> <span class=chip>Total Jam : ${fmt(tot)}</span>
  <div class=box><b>${rec?'Edit Kegiatan':'Tambah Kegiatan Baru'}</b><span class=lbl>Rencana Aksi</span><div class=ti><input type=hidden id=q2 value=""><div class=dd onclick="togRA(event)"><span class=ddt id=q2t>-- Pilih --</span><svg width=14 height=14 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2.5><path d="M6 9l6 6 6-6"></path></svg></div><div class="tpop ralist" id=q2p onclick="event.stopPropagation()">${RAY.map(r=>`<div class=opt data-id="${r.id}" onclick="pickRA('${r.id}')">${esc(r.nama)}</div>`).join('')||`<div class="opt off">Belum ada rencana aksi periode ${MD.slice(0,4)}</div>`}</div></div>
  <span class=lbl>Kegiatan Harian</span><textarea id=q3 rows=4 oninput="chk()" placeholder="Tulis kegiatan... (Enter untuk baris baru)"></textarea>
  <div class=row><div><span class=lbl>Jam Mulai</span>${tp('a')}</div><div><span class=lbl>Jam Selesai</span>${tp('b')}</div></div>
  ${l.filter(r=>r.id!=EDITID).length?`<div class=muted>Jam terpakai: ${l.filter(r=>r.id!=EDITID).map(rng).join(', ')}</div>`:''}
  <span class=lbl>Realisasi</span><div style="display:flex"><input id=q7 inputmode=numeric placeholder="1" oninput="numOnly(this);chk()" style="border-top-right-radius:0;border-bottom-right-radius:0"><span style="padding:9px 14px;border:1px solid #c9cfdc;border-left:0;background:#eef1f7;border-radius:0 5px 5px 0;color:#6b7690">Dokumen</span></div><div class=muted style="font-size:12px;margin-top:3px">Diisi dengan bilangan bulat positif.</div>
  <span class=lbl>Bukti Dukung (link Google Drive/Dropbox/dll)</span><input id=q6 oninput="chk()" placeholder="Tempel link bukti dukung di sini">
  <div id=qh class=muted style="text-align:right;margin-top:8px"></div><div style="text-align:right;margin-top:6px">${rec?'<button class="btn ghost" onclick="openQ(MD)">Batal Edit</button> ':''}<button class=btn id=qs onclick="saveLap(false)" disabled>${rec?'Simpan Perubahan':'Simpan'}</button></div></div>
  ${l.length?`<div class=tw style="margin-top:10px"><table>${l.map(r=>`<tr style="${r.id==EDITID?'background:#eef3ff':''}"><td>${rng(r)}</td><td>${esc(r.raNama)}</td><td class=pre>${esc(r.kegiatan)}</td><td style="white-space:nowrap"><button class="btn sm" onclick="openQ('${r.tanggal}','${r.id}')">Edit</button> <button class="btn sm red" onclick="delLap('${r.id}')">Hapus</button></td></tr>`).join('')}</table></div>`:'<p class=muted>Belum ada kegiatan pada tanggal ini.</p>'}
  </div><div class=mf><button class="btn ghost" onclick="closeQ()">Close</button><button class=btn id=qok onclick="saveLap(true)" disabled>OK</button></div></div></div>`;
  $('#q3').value=v.keg;$('#q6').value=v.bukti;setRA(RAY.some(r=>r.id==v.ra)?v.ra:(RAY.length==1?RAY[0].id:''));$('#q7').value=v.rl||'';
  setT('a',v.a);setT('b',v.b);chk()}
function setRA(id){const r=RAY.find(x=>x.id==id);$('#q2').value=r?r.id:'';
  $('#q2t').textContent=r?r.nama:(RAY.length?'-- Pilih --':'(Belum ada rencana aksi periode '+MD.slice(0,4)+')');$('#q2t').classList.toggle('ph',!r);
  document.querySelectorAll('#q2p .opt').forEach(x=>x.classList.toggle('sel',x.getAttribute('data-id')==id))}
function togRA(e){e.stopPropagation();const p=$('#q2p'),open=p.classList.contains('on');closeT();if(!open){p.classList.add('on');const el=p.querySelector('.opt.sel');if(el)p.scrollTop=Math.max(0,el.offsetTop-40)}}
function pickRA(id){setRA(id);closeT();chk()}
function closeQ(){MD='';EDITID='';$('#mdl').innerHTML='';renderUser()}
async function saveLap(closeAfter){const bs=[$('#qs'),$('#qok')],labs=bs.map(x=>x.textContent),me=closeAfter?bs[1]:bs[0];bs.forEach(x=>x.disabled=true);me.textContent='Menyimpan...';
  try{const d=$('#q1').value,ed=EDITID;LASTRA=$('#q2').value;
    const p={tanggal:d,rencanaAksiId:LASTRA,kegiatan:$('#q3').value,mulai:hhmm(getT('a')),selesai:hhmm(getT('b')),bukti:$('#q6').value,realisasi:$('#q7').value};
    if(ed)p.id=ed;
    await call(ed?'u_update':'u_save',p);
    LAP=await call('u_list');if(!F.u.all)F.u.mon=d.slice(0,7);
    toast(ed?'Laporan berhasil diperbarui':'Kegiatan berhasil disimpan',true);
    if(closeAfter)closeQ();else openQ(d)
  }catch(e){toast('Gagal menyimpan: '+e.message,false);bs.forEach((x,i)=>x.textContent=labs[i]);chk();if(e.message.indexOf('Sesi berakhir')>=0)logout(true)}}
const MN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const F={u:{mon:today().slice(0,7),all:false},a:{mon:today().slice(0,7),all:false,nama:''}};
let RK=[];
const tgl=d=>d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);
const durK=m=>{const h=Math.floor(m/60),x=m%60;return(h?h+' jam':'')+(h&&x?' ':'')+((x||!h)?x+' menit':'')};
const periodTxt=S=>S.all?'Semua data':MN[+S.mon.slice(5,7)-1]+' '+S.mon.slice(0,4);
function rkTable(rows,admin,edit){
  const g={};rows.forEach(r=>{const k=(admin?r.userId:'')+'|'+r.tanggal;(g[k]=g[k]||[]).push(r)});
  const gs=Object.keys(g).map(k=>g[k]);
  gs.sort((x,y)=>x[0].tanggal.localeCompare(y[0].tanggal)||(admin?x[0].nama.localeCompare(y[0].nama):0));
  let h='<div class=tw><table class=rk><tr>'+(admin?'<th>Nama</th><th>Jabatan</th>':'')+'<th>Tanggal</th><th>Rencana Aksi</th><th>Kegiatan</th><th>Realisasi</th><th>Jam</th><th>Bukti</th><th>Durasi per Kegiatan</th>'+(edit?'<th class=noprint>Aksi</th>':'')+'<th>Total Durasi dalam Satu Hari</th></tr>';
  gs.forEach(a=>{a.sort((p,q)=>p.mulai.localeCompare(q.mulai));const n=a.length,tot=a.reduce((s,r)=>s+mins(r.mulai,r.selesai),0);
    a.forEach((r,i)=>{
      h+='<tr>'+(i==0?(admin?`<td rowspan=${n}>${esc(r.nama)}</td><td rowspan=${n}>${esc(r.jabatan)}</td>`:'')+`<td rowspan=${n}>${tgl(r.tanggal)}</td>`:'')
      +`<td>${esc(r.raNama)}</td><td class="pre kg">${esc(r.kegiatan)}</td><td>${esc(r.realisasi||'-')}</td><td style="white-space:nowrap">${rng(r)}</td><td>${r.bukti.indexOf('http')===0?`<a href="${esc(r.bukti)}" target=_blank>Buka</a>`:'-'}</td><td style="white-space:nowrap">${durK(mins(r.mulai,r.selesai))}</td>`
      +(edit?`<td class=noprint style="white-space:nowrap"><button class="btn sm" onclick="openQ('${r.tanggal}','${r.id}')">Edit</button> <button class="btn sm red" onclick="delLap('${r.id}')">Hapus</button></td>`:'')
      +(i==0?`<td rowspan=${n} style="white-space:nowrap">${fmt(tot)}</td>`:'')+'</tr>'})});
  if(!gs.length)h+=`<tr><td colspan=${admin?10:edit?9:8} class=muted>Belum ada laporan pada periode ini</td></tr>`;
  return h+'</table></div>'}
function rkBar(k,rows,nm){const S=F[k],m=S.mon.slice(5,7),y=S.mon.slice(0,4),ys=Array.from(new Set(rows.map(r=>r.tanggal.slice(0,4)).concat([y,today().slice(0,4)]))).sort().reverse();
  return `<div class="row noprint" style="align-items:end">${nm?`<div><span class=lbl>Nama</span><select onchange="setF('${k}','n',this.value)"><option value="">Semua Nama</option>${D.usr.map(u=>`<option value="${u.id}" ${F.a.nama==u.id?'selected':''}>${esc(u.nama)}</option>`).join('')}</select></div>`:''}
  <div><span class=lbl>Bulan</span><select onchange="setF('${k}','m',this.value)">${MN.map((n,i)=>`<option value="${pad2(i+1)}" ${pad2(i+1)==m?'selected':''}>${n}</option>`).join('')}</select></div>
  <div><span class=lbl>Tahun</span><select onchange="setF('${k}','y',this.value)">${ys.map(v=>`<option ${v==y?'selected':''}>${v}</option>`).join('')}</select></div>
  <button class="btn ghost" onclick="setF('${k}','all')">Tampilkan Semua Data</button><button class=btn onclick="window.print()">Cetak</button>${S.all?'<span class=chip style="flex:0 0 auto;min-width:0">Menampilkan semua data</span>':''}</div>`}
function setF(k,t,v){const S=F[k];
  if(t=='m'){S.mon=S.mon.slice(0,4)+'-'+v;S.all=false}
  else if(t=='y'){S.mon=v+'-'+S.mon.slice(5,7);S.all=false}
  else if(t=='n'){S.nama=v}
  else if(t=='all'){S.all=true}
  if(k=='u')renderUser();else renderAdmin()}
function goTab(k){TAB=k;EID='';history.replaceState(null,'','#'+k);if(k=='rk')loadRk();else renderAdmin()}
async function loadRk(){await run(async()=>{RK=await call('a_rekap');renderAdmin()})}
function pRk(){const S=F.a;let rows=RK;if(!S.all)rows=rows.filter(r=>r.tanggal.startsWith(S.mon));if(S.nama)rows=rows.filter(r=>r.userId==S.nama);
  const nm=S.nama?(D.usr.find(u=>u.id==S.nama)||{}).nama:'Semua Pengguna';
  $('#pane').innerHTML=`<h3 class=noprint>Rekap Laporan</h3>${rkBar('a',RK,true)}<div class=onlyprint><h3>Rekap Laporan Kinerja Harian</h3><div>Nama: ${esc(nm)}</div><div>Periode: ${periodTxt(S)}</div></div>${rkTable(rows,true,false)}`}
if(typeof API_URL==='undefined'||API_URL.indexOf('script.google.com')<0){$('#app').innerHTML='<div class="boot"><b>Konfigurasi belum diisi</b><div>Buka file konfigurasi.js lalu isi API_URL dengan Web app URL dari Apps Script (berakhiran /exec).</div></div>'}
else({login:initLogin,admin:initAdmin,user:initUser,setting:initSetting})[PAGE]();
