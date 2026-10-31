// ===== Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyBG7PDUJit2awcxyKQYNKiOpZqsN3wmvkA",
  authDomain: "krumiew-87c16.firebaseapp.com",
  projectId: "krumiew-87c16",
  storageBucket: "krumiew-87c16.firebasestorage.app",
  messagingSenderId: "209011251216",
  appId: "1:209011251216:web:3694b56cf2182e0bb3d295"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const FieldValue = firebase.firestore.FieldValue;

// ===== DOM / text helpers =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u; }
function emptyState(msg, extra = '') { return `<div class="empty"><p>${msg}</p>${extra}</div>`; }
const loadingHtml = '<div class="empty">กำลังโหลด...</div>';

// ===== Local storage (safe) =====
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

// ===== Password hashing (pure-JS SHA-256 so it works on any device / http) =====
function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const K = [], H = [];
  for (let n = 2, c = 0; c < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (c < 8) H[c] = (Math.pow(n, 1 / 2) % 1) * 4294967296 | 0;
    K[c++] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
  }
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, len * 8);
  const W = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4) | 0;
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15], w2 = W[i - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

// ===== Dates =====
function fmtDate(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function toLocalInput(ms) {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function timeLeft(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return { text: 'เลยกำหนดแล้ว', level: 'over' };
  const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000);
  const text = d ? `เหลือ ${d} วัน ${h} ชม.` : h ? `เหลือ ${h} ชม. ${m} นาที` : `เหลือ ${m} นาที`;
  return { text, level: diff < 86400000 ? 'soon' : diff < 3 * 86400000 ? 'near' : 'ok' };
}

// ===== Classrooms =====
const LEVELS = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
function classroomFields(value = '') {
  const [lv, rm] = String(value).split('/');
  return `<div class="row-2">
    <label>ระดับชั้น<select name="level" required><option value="">เลือก</option>${LEVELS.map(l => `<option${l === lv ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>ห้อง<input type="number" name="room" min="1" max="30" required value="${esc(rm || '')}" placeholder="เช่น 1"></label>
  </div>`;
}
function readClassroom(form) { return `${form.elements.level.value}/${Number(form.elements.room.value)}`; }
function classroomCompare(a, b) {
  const ia = LEVELS.indexOf(String(a).split('/')[0]), ib = LEVELS.indexOf(String(b).split('/')[0]);
  return ia - ib || String(a).localeCompare(String(b), 'th', { numeric: true });
}
function studentCompare(a, b) {
  return classroomCompare(a.classroom, b.classroom) || (Number(a.number) || 0) - (Number(b.number) || 0) || String(a.id).localeCompare(String(b.id));
}

// ===== Submissions =====
function submissionStatus(a, sub) {
  if (sub && sub.submittedAt) return sub.late ? { key: 'late', text: 'ส่งช้า' } : { key: 'done', text: 'ส่งแล้ว' };
  if (sub && sub.score != null) return { key: 'offline', text: 'ครูบันทึกคะแนน' };
  if (Date.now() > a.dueAt) return { key: 'missing', text: 'ค้างส่ง' };
  return { key: 'pending', text: 'ยังไม่ส่ง' };
}
function statusBadge(st) { return `<span class="badge st-${st.key}">${st.text}</span>`; }

const round2 = n => Math.round(n * 100) / 100;
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ===== Gradebook (ตารางคะแนนรวม) =====
// book = gradebooks/{subjectId}: { columns:[{id,title,type,max}], extraRows:[{id,name,classroom,number}],
//   cells:{[rowKey]:{[colId]:value}}, includeAssignments, showGrade, showAll }
const GRADE_STEPS = [[80, '4'], [75, '3.5'], [70, '3'], [65, '2.5'], [60, '2'], [55, '1.5'], [50, '1'], [0, '0']];
const thaiGrade = pct => GRADE_STEPS.find(([min]) => pct >= min)[1];

function gradebookModel(book, assignmentList, roster, subs) {
  book = book || {};
  const cells = book.cells || {};
  const subMap = new Map(subs.map(s => [`${s.assignmentId}_${s.studentId}`, s]));
  const cols = [];
  if (book.includeAssignments !== false) assignmentList.forEach(a => cols.push({ key: 'a:' + a.id, aid: a.id, title: a.title, max: Number(a.maxScore) || 0, kind: 'assign', type: 'number', counted: true }));
  (book.columns || []).forEach(c => cols.push({ key: c.id, id: c.id, title: c.title, max: Number(c.max) || 0, kind: 'custom', type: c.type || 'number', counted: (c.type || 'number') === 'number' }));
  const fullTotal = round2(cols.filter(c => c.counted).reduce((n, c) => n + c.max, 0));
  const rows = [
    ...roster.map(st => ({ key: st.id, id: st.id, studentId: st.id, name: st.name, classroom: st.classroom, number: st.number, custom: false })),
    ...(book.extraRows || []).map(r => ({ key: r.id, id: r.id, name: r.name || '', classroom: r.classroom || '', number: r.number || '', custom: true }))
  ].sort((a, b) => (!a.classroom - !b.classroom) || studentCompare(a, b));
  rows.forEach(r => {
    r.values = {};
    let total = 0;
    cols.forEach(c => {
      let v;
      if (c.kind === 'assign') {
        const s = r.studentId && subMap.get(`${c.aid}_${r.studentId}`);
        v = s && s.score != null ? s.score : '';
      } else {
        const x = (cells[r.key] || {})[c.id];
        v = x == null ? '' : x;
      }
      r.values[c.key] = v;
      if (c.counted && v !== '' && !isNaN(Number(v))) total += Number(v);
    });
    r.total = round2(total);
    r.pct = fullTotal ? round2(total / fullTotal * 100) : 0;
    r.grade = thaiGrade(r.total);
  });
  return { cols, rows, fullTotal };
}

function gradebookTable(model, { editable = false, highlight = '', showGrade = true } = {}) {
  const { cols, rows, fullTotal } = model;
  const span = cols.length + 4 + (showGrade ? 1 : 0);
  const head = `<tr><th class="num sticky-1">เลขที่</th><th class="sticky-2">ชื่อ-นามสกุล</th>${cols.map(c => {
    const label = `${esc(c.title)}<div class="muted small">${c.counted ? 'เต็ม ' + c.max : 'ข้อความ'}${c.kind === 'assign' ? ' · งาน' : ''}</div>`;
    return `<th class="a-col ${c.kind}">${editable && c.kind === 'custom' ? `<button class="col-btn" data-editcol="${c.id}" title="แก้ไข/ย้าย/ลบคอลัมน์">${label}</button>` : label}</th>`;
  }).join('')}<th class="num">รวม<div class="muted small">เต็ม ${fullTotal}</div></th><th class="num">%</th>${showGrade ? '<th class="num">เกรด</th>' : ''}</tr>`;

  let body = '', last = null;
  rows.forEach(r => {
    if (r.classroom !== last) {
      last = r.classroom;
      body += `<tr class="group"><td colspan="${span}">${r.classroom ? 'ห้อง ' + esc(r.classroom) : 'อื่น ๆ'}</td></tr>`;
    }
    body += `<tr data-row="${esc(r.key)}"${r.key === highlight ? ' class="me"' : ''}>
      <td class="num sticky-1">${esc(r.number)}</td>
      <td class="sticky-2 nowrap">${esc(r.name) || '<span class="muted">(ไม่มีชื่อ)</span>'}
        ${editable && r.custom ? `<button class="icon-btn" data-editrow="${esc(r.key)}" title="แก้ไขแถว">✎</button>` : ''}
        <div class="muted small">${r.studentId ? esc(r.studentId) : 'แถวที่เพิ่มเอง'}</div></td>
      ${cols.map(c => {
        const v = r.values[c.key];
        if (editable && c.kind === 'custom') {
          return `<td class="gcell"><input class="gi${c.type === 'text' ? ' text' : ''}" data-r="${esc(r.key)}" data-c="${c.key}" value="${esc(v)}" inputmode="${c.type === 'number' ? 'decimal' : 'text'}" autocomplete="off"></td>`;
        }
        return `<td class="${c.type === 'text' ? '' : 'num'}${c.kind === 'assign' ? ' locked' : ''}">${v === '' ? '<span class="muted">-</span>' : esc(v)}</td>`;
      }).join('')}
      <td class="num t-total"><b>${r.total}</b></td>
      <td class="num t-pct">${r.pct}</td>
      ${showGrade ? `<td class="num t-grade"><b>${r.grade}</b></td>` : ''}
    </tr>`;
  });
  return `<div class="table-wrap sheet"><table class="sheet-table"><thead>${head}</thead><tbody>${body ||
    `<tr><td colspan="${span}" class="empty">ยังไม่มีแถว</td></tr>`}</tbody></table></div>`;
}

function docsOf(snap) { return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
async function getSubs(field, value) {
  return docsOf(await db.collection('submissions').where(field, '==', value).get());
}
async function deleteWhere(col, field, value) {
  const snap = await db.collection(col).where(field, '==', value).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

function workHtml(sub) {
  if (!sub || !sub.submittedAt) return '<p class="muted">ยังไม่มีการส่งงานในระบบ</p>';
  return `<div class="work">
    ${sub.link ? `<div><span class="muted">🔗 ลิงก์งาน:</span> <a href="${esc(safeUrl(sub.link))}" target="_blank" rel="noopener">${esc(sub.link)}</a></div>` : ''}
    ${sub.note ? `<div class="note">${esc(sub.note)}</div>` : ''}
    ${sub.fileCount ? `<div class="files">กำลังโหลดรูป...</div>` : ''}
  </div>`;
}
async function loadFiles(subId, el) {
  if (!el) return;
  try {
    const snap = await db.collection('submissionFiles').where('submissionId', '==', subId).get();
    const files = snap.docs.map(d => d.data()).sort((a, b) => (a.order || 0) - (b.order || 0));
    el.innerHTML = files.length ? '' : '<span class="muted">ไม่มีรูปแนบ</span>';
    files.forEach(f => {
      const img = new Image();
      img.src = f.dataUrl;
      img.alt = f.name || 'รูปงาน';
      img.onclick = () => showLightbox(f.dataUrl);
      el.appendChild(img);
    });
  } catch (e) { el.textContent = 'โหลดรูปไม่สำเร็จ'; }
}
function showLightbox(src) {
  const o = document.createElement('div');
  o.className = 'lightbox';
  o.innerHTML = `<img src="${src}" alt="">`;
  o.onclick = () => o.remove();
  document.body.appendChild(o);
}

// Shrink photos so each one fits in a Firestore document (< 1 MB)
function compressImage(file, maxDim = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = quality, data = c.toDataURL('image/jpeg', q);
      while (data.length > 900000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`อ่านไฟล์รูป ${file.name} ไม่ได้`)); };
    img.src = url;
  });
}

function downloadCSV(filename, rows) {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===== UI feedback =====
function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function fail(e) {
  console.error(e);
  toast(e && e.code === 'permission-denied'
    ? 'ไม่มีสิทธิ์เข้าถึงฐานข้อมูล (ตรวจสอบ Firestore Rules)'
    : 'เกิดข้อผิดพลาด: ' + ((e && e.message) || e), 'err');
}
function setLoading(show) { $('#loading').hidden = !show; }

function openModal(title, bodyHtml) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="ปิด">✕</button></div>
    <div class="modal-body">${bodyHtml}</div></div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(wrap);
  return wrap.querySelector('.modal');
}
function closeModal() { $$('.modal-backdrop').forEach(m => m.remove()); }
