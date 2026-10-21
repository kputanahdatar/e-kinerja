/** E-Kinerja - Api.gs (backend Google Apps Script)
 *  Script harus terikat (bound) ke Google Spreadsheet: buka dari Extensions > Apps Script.
 *  Tampilan (index.html, admin.html, dst.) ada di GitHub Pages dan memanggil API ini lewat fetch POST. */
const SHEETS = {
  Config: ['key', 'value'],
  Jabatan: ['id', 'nama'],
  RencanaAksi: ['id', 'jabatanId', 'nama', 'tahun'],
  Pengguna: ['id', 'nip', 'nama', 'passHash', 'jabatanId', 'rencanaAksiIds'],
  Laporan: ['id', 'userId', 'tanggal', 'rencanaAksiId', 'kegiatan', 'mulai', 'selesai', 'bukti', 'dibuat', 'realisasi']
};
const TTL = 21600; // sesi 6 jam

/** Cek status API (dibuka lewat browser akan menampilkan JSON) */
function doGet() {
  setup_();
  return json_({ ok: true, app: 'E-Kinerja API', info: 'API aktif. Buka aplikasi lewat halaman GitHub Pages.' });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Endpoint utama: dipanggil dari GitHub Pages lewat fetch POST (teks JSON {a, t, p}) */
function doPost(e) {
  let out;
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    setup_();
    out = api(b.a, b.t, b.p);
  } catch (err) {
    out = JSON.stringify({ ok: false, error: err.message });
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Setup & helper sheet ---------- */
function setup_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(n => {
    const ex = ss.getSheetByName(n);
    if (ex) { // migrasi: tambah kolom baru (mis. realisasi) pada sheet lama
      const lc = ex.getLastColumn();
      if (lc < SHEETS[n].length) ex.getRange(1, lc + 1, 1, SHEETS[n].length - lc).setValues([SHEETS[n].slice(lc)]).setFontWeight('bold');
      return;
    }
    const s = ss.insertSheet(n);
    s.getRange('A:Z').setNumberFormat('@');
    s.getRange(1, 1, 1, SHEETS[n].length).setValues([SHEETS[n]]).setFontWeight('bold');
    s.setFrozenRows(1);
  });
  if (!cfg_('adminUser')) {
    setCfg_('salt', Utilities.getUuid());
    setCfg_('adminUser', 'admin');
    setCfg_('adminPass', hash_('admin@123'));
  }
  // migrasi: rencana aksi lama tanpa tahun diberi tahun berjalan
  const sr = sh_('RencanaAksi'), data = sr.getDataRange().getValues(), ti = data[0].indexOf('tahun');
  if (ti >= 0) {
    const th = String(new Date().getFullYear());
    for (let i = 1; i < data.length; i++) if (data[i][0] !== '' && String(data[i][ti]) === '') sr.getRange(i + 1, ti + 1).setValue(th);
  }
}
const sh_ = n => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
function rows_(n) {
  const tz = Session.getScriptTimeZone();
  const v = sh_(n).getDataRange().getValues(), h = v.shift();
  return v.filter(r => r[0] !== '').map(r => Object.fromEntries(h.map((k, i) => {
    let x = r[i];
    if (x instanceof Date) x = Utilities.formatDate(x, tz, k === 'tanggal' ? 'yyyy-MM-dd' : (k === 'mulai' || k === 'selesai') ? 'HH:mm' : "yyyy-MM-dd'T'HH:mm:ss");
    return [k, String(x)];
  })));
}
function add_(n, o) { sh_(n).appendRow(SHEETS[n].map(k => o[k] == null ? '' : String(o[k]))); }
function upd_(n, id, o) {
  const s = sh_(n), v = s.getDataRange().getValues(), h = v[0];
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) {
    h.forEach((k, j) => { if (k in o) v[i][j] = o[k]; });
    s.getRange(i + 1, 1, 1, h.length).setValues([v[i]]);
    return true;
  }
  return false;
}
function delWhere_(n, col, val) {
  const s = sh_(n), v = s.getDataRange().getValues(), c = v[0].indexOf(col);
  for (let i = v.length - 1; i >= 1; i--) if (String(v[i][c]) === String(val)) s.deleteRow(i + 1);
}
const cfg_ = k => (rows_('Config').find(r => r.key === k) || {}).value;
function setCfg_(k, val) { if (!upd_('Config', k, { value: val })) add_('Config', { key: k, value: val }); }
const newId_ = () => Utilities.getUuid().slice(0, 8);
function hash_(p) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cfg_('salt') + p)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/* ---------- Endpoint tunggal ---------- */
function api(action, token, p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!A[action]) throw new Error('Aksi tidak dikenal');
    let s = null;
    if (action !== 'login') {
      const c = CacheService.getScriptCache().get(token || 'x');
      if (!c) throw new Error('Sesi berakhir, silakan login ulang');
      s = JSON.parse(c);
      if (action.startsWith('a_') && s.role !== 'admin') throw new Error('Akses ditolak');
      if (action.startsWith('u_') && s.role !== 'user') throw new Error('Akses ditolak');
    }
    return JSON.stringify({ ok: true, data: A[action](p || {}, s) });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.message });
  } finally { lock.releaseLock(); }
}
function mk_(role, id, name) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify({ role, id }), TTL);
  return { token, role, name };
}
const need_ = (v, msg) => { if (!String(v || '').trim()) throw new Error(msg); return String(v).trim(); };

const A = {
  login(p) {
    const u = String(p.u || '').trim();
    if (u === cfg_('adminUser') && hash_(p.p || '') === cfg_('adminPass')) return mk_('admin', 'admin', 'Administrator');
    const x = rows_('Pengguna').find(r => r.nip === u);
    if (x && x.passHash === hash_(p.p || '')) return mk_('user', x.id, x.nama);
    throw new Error('Username atau password salah');
  },
  logout(p, s) { return true; },

  /* ----- Admin ----- */
  a_data() {
    return {
      jab: rows_('Jabatan'),
      ra: rows_('RencanaAksi'),
      usr: rows_('Pengguna').map(u => ({ id: u.id, nip: u.nip, nama: u.nama, jabatanId: u.jabatanId, ra: u.rencanaAksiIds ? u.rencanaAksiIds.split(',') : [] }))
    };
  },
  a_saveJab(p) {
    const nama = need_(p.nama, 'Nama jabatan wajib diisi');
    if (p.id) upd_('Jabatan', p.id, { nama }); else add_('Jabatan', { id: newId_(), nama });
    return true;
  },
  a_delJab(p) {
    if (rows_('RencanaAksi').some(r => r.jabatanId === p.id) || rows_('Pengguna').some(r => r.jabatanId === p.id))
      throw new Error('Jabatan masih dipakai rencana aksi / pengguna');
    delWhere_('Jabatan', 'id', p.id); return true;
  },
  a_saveRa(p) {
    const nama = need_(p.nama, 'Rencana aksi wajib diisi');
    need_(p.jabatanId, 'Pilih jabatan');
    const tahun = String(p.tahun || '').trim();
    if (!/^\d{4}$/.test(tahun)) throw new Error('Pilih periode tahun');
    if (p.id) upd_('RencanaAksi', p.id, { nama, jabatanId: p.jabatanId, tahun });
    else add_('RencanaAksi', { id: newId_(), jabatanId: p.jabatanId, nama, tahun });
    return true;
  },
  a_copyRa(p) {
    const f = String(p.from || ''), t = String(p.to || '');
    if (!/^\d{4}$/.test(f) || !/^\d{4}$/.test(t) || f === t) throw new Error('Tahun asal dan tujuan tidak valid');
    const ex = rows_('RencanaAksi');
    let n = 0;
    ex.filter(r => r.tahun === f).forEach(r => {
      if (!ex.some(x => x.tahun === t && x.jabatanId === r.jabatanId && x.nama === r.nama)) {
        add_('RencanaAksi', { id: newId_(), jabatanId: r.jabatanId, nama: r.nama, tahun: t }); n++;
      }
    });
    return n;
  },
  a_delRa(p) {
    rows_('Pengguna').forEach(u => {
      const ids = u.rencanaAksiIds.split(',').filter(x => x && x !== p.id);
      upd_('Pengguna', u.id, { rencanaAksiIds: ids.join(',') });
    });
    delWhere_('RencanaAksi', 'id', p.id); return true;
  },
  a_saveUser(p) {
    const nama = need_(p.nama, 'Nama wajib diisi'), nip = need_(p.nip, 'NIP wajib diisi');
    need_(p.jabatanId, 'Pilih jabatan');
    if (nip === cfg_('adminUser')) throw new Error('NIP tidak boleh sama dengan username admin');
    if (rows_('Pengguna').some(u => u.nip === nip && u.id !== p.id)) throw new Error('NIP sudah terdaftar');
    const valid = rows_('RencanaAksi').filter(r => r.jabatanId === p.jabatanId).map(r => r.id);
    const ra = (p.ra || []).filter(id => valid.indexOf(id) >= 0);
    const o = { nama, nip, jabatanId: p.jabatanId, rencanaAksiIds: ra.join(',') };
    if (p.id) {
      if (p.password) o.passHash = hash_(p.password);
      upd_('Pengguna', p.id, o);
    } else {
      o.passHash = hash_(need_(p.password, 'Password wajib diisi untuk pengguna baru'));
      o.id = newId_(); add_('Pengguna', o);
    }
    return true;
  },
  a_delUser(p) { delWhere_('Laporan', 'userId', p.id); delWhere_('Pengguna', 'id', p.id); return true; },
  a_changeAdmin(p) {
    if (hash_(p.old || '') !== cfg_('adminPass')) throw new Error('Password lama salah');
    const u = need_(p.u, 'Username wajib diisi');
    if (rows_('Pengguna').some(x => x.nip === u)) throw new Error('Username bentrok dengan NIP pengguna');
    if (p.pass && p.pass.length < 6) throw new Error('Password baru minimal 6 karakter');
    setCfg_('adminUser', u);
    if (p.pass) setCfg_('adminPass', hash_(p.pass));
    return true;
  },

  a_rekap() {
    const us = Object.fromEntries(rows_('Pengguna').map(u => [u.id, u]));
    const jb = Object.fromEntries(rows_('Jabatan').map(j => [j.id, j.nama]));
    const ra = Object.fromEntries(rows_('RencanaAksi').map(r => [r.id, r.nama]));
    return rows_('Laporan').map(r => {
      const u = us[r.userId] || {};
      return Object.assign(r, { nama: u.nama || '(dihapus)', nip: u.nip || '', jabatan: jb[u.jabatanId] || '-', raNama: ra[r.rencanaAksiId] || '(dihapus)' });
    });
  },

  /* ----- Pengguna ----- */
  u_me(p, s) {
    const u = rows_('Pengguna').find(r => r.id === s.id);
    if (!u) throw new Error('Pengguna tidak ditemukan');
    const ids = u.rencanaAksiIds.split(',').filter(Boolean);
    const jab = rows_('Jabatan').find(j => j.id === u.jabatanId) || {};
    // semua rencana aksi milik jabatan pengguna (semua tahun)
    const semua = rows_('RencanaAksi').filter(r => r.jabatanId === u.jabatanId);
    // per tahun: jika admin memilihkan rencana aksi khusus pada tahun itu, pakai itu; jika belum, tampilkan semua milik jabatan pada tahun itu
    let ra = [];
    Array.from(new Set(semua.map(r => r.tahun))).forEach(t => {
      const all = semua.filter(r => r.tahun === t), pick = all.filter(r => ids.indexOf(r.id) >= 0);
      ra = ra.concat(pick.length ? pick : all);
    });
    return { nama: u.nama, nip: u.nip, jabatan: jab.nama || '-', ra };
  },
  u_list(p, s) {
    const ra = Object.fromEntries(rows_('RencanaAksi').map(r => [r.id, r.nama]));
    return rows_('Laporan').filter(r => r.userId === s.id)
      .map(r => Object.assign(r, { raNama: ra[r.rencanaAksiId] || '(dihapus)' }))
      .sort((a, b) => (a.tanggal + a.mulai).localeCompare(b.tanggal + b.mulai));
  },
  u_save(p, s) {
    add_('Laporan', Object.assign({ id: newId_(), userId: s.id, dibuat: new Date().toISOString() }, validasiLaporan_(p, s, '')));
    return true;
  },
  u_update(p, s) {
    if (!rows_('Laporan').some(r => r.id === p.id && r.userId === s.id)) throw new Error('Data tidak ditemukan');
    upd_('Laporan', p.id, validasiLaporan_(p, s, p.id));
    return true;
  },
  u_del(p, s) {
    const r = rows_('Laporan').find(x => x.id === p.id && x.userId === s.id);
    if (!r) throw new Error('Data tidak ditemukan');
    delWhere_('Laporan', 'id', p.id); return true;
  }
};

/* Validasi laporan (dipakai simpan & edit). exceptId = id laporan yang sedang diedit */
function validasiLaporan_(p, s, exceptId) {
  const me = A.u_me(null, s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tanggal || '')) throw new Error('Tanggal tidak valid');
  const raSel = me.ra.find(r => r.id === p.rencanaAksiId);
  if (!raSel) throw new Error('Pilih rencana aksi');
  if (raSel.tahun !== p.tanggal.slice(0, 4)) throw new Error('Rencana aksi tidak sesuai dengan periode tahun ' + p.tanggal.slice(0, 4));
  const kegiatan = need_(p.kegiatan, 'Kegiatan harian wajib diisi');
  const bukti = need_(p.bukti, 'Bukti dukung wajib diisi');
  if (bukti.indexOf('http') !== 0) throw new Error('Bukti dukung harus berupa link (diawali http:// atau https://)');
  if (!/^\d{2}:\d{2}$/.test(p.mulai || '') || !/^\d{2}:\d{2}$/.test(p.selesai || '')) throw new Error('Jam mulai dan jam selesai wajib diisi');
  const m = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  if (m(p.mulai) >= m(p.selesai)) throw new Error('Jam selesai harus setelah jam mulai');
  const bentrok = rows_('Laporan').find(r => r.userId === s.id && r.id !== exceptId && r.tanggal === p.tanggal && m(p.mulai) < m(r.selesai) && m(p.selesai) > m(r.mulai));
  if (bentrok) throw new Error('Rentang jam bentrok dengan kegiatan yang sudah ada (' + bentrok.mulai + '-' + bentrok.selesai + ')');
  const rs = String(p.realisasi == null ? '' : p.realisasi).trim();
  if (!/^\d+$/.test(rs) || Number(rs) < 1) throw new Error('Realisasi harus berupa bilangan bulat positif (minimal 1)');
  return { tanggal: p.tanggal, rencanaAksiId: p.rencanaAksiId, kegiatan, mulai: p.mulai, selesai: p.selesai, bukti, realisasi: String(Number(rs)) };
}
