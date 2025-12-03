// 🔑 Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASLzAtjOgYI2Otko1vMD2Lie8_h3GCUsc",
  authDomain: "antrian-puskesmas-5869a.firebaseapp.com",
  databaseURL: "https://antrian-puskesmas-5869a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "antrian-puskesmas-5869a",
  storageBucket: "antrian-puskesmas-5869a.firebasestorage.app",
  messagingSenderId: "992002959684",
  appId: "1:992002959684:web:ec82ecb075c71927504f11"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const ref = database.ref('antrian_hari_ini');

// === SUARA ===
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 200);
  } catch (e) {
    console.warn("Gagal memutar suara:", e);
  }
}

// === RESET ===
function isSameDay(timestamp) {
  const now = new Date();
  const stored = new Date(timestamp);
  return now.getFullYear() === stored.getFullYear() &&
         now.getMonth() === stored.getMonth() &&
         now.getDate() === stored.getDate();
}

function resetAll() {
  const resetData = {};
  ['A','B','C','D'].forEach(letter => {
    resetData[letter] = { start: 1, total: 0, next: 1, recall: [] };
  });
  resetData.E = { start: 1, total: 0, next: 1, recall: [], online: 0 };
  resetData.lastReset = Date.now();
  ref.set(resetData);
}

function checkAndResetIfNeeded() {
  ref.once('value').then(snapshot => {
    const data = snapshot.val() || {};
    const lastReset = data.lastReset || 0;
    if (!isSameDay(lastReset)) {
      resetAll();
    }
  });
}
checkAndResetIfNeeded();

// === TAB ===
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
  });
});

// === INPUT A-D ===
['A','B','C','D'].forEach(letter => {
  document.querySelectorAll(`[data-letter="${letter}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(`total-${letter}`);
      let val = parseInt(el.textContent) || 0;
      if (btn.classList.contains('btn-plus')) val++;
      else if (btn.classList.contains('btn-minus') && val > 0) val--;
      el.textContent = val;
      ref.child(letter).update({ total: val, start: 1 });
      if (val === 0) {
        ref.child(letter).update({ next: 1, recall: [] });
      }
    });
  });
});

// === INPUT E ===
const onlineE = document.getElementById('online-E');
const totalE = document.getElementById('total-E');

function updateE() {
  const loket = parseInt(totalE.textContent) || 0;
  const online = parseInt(onlineE.value) || 0;
  const start = online + 1;
  const total = online + loket;
  ref.child('E').set({
    online: online,
    start: start,
    total: total,
    next: loket > 0 ? start : 1,
    recall: []
  });
}

document.querySelectorAll('[data-letter="E"]').forEach(btn => {
  btn.addEventListener('click', () => {
    let loket = parseInt(totalE.textContent) || 0;
    if (btn.classList.contains('btn-plus')) loket++;
    else if (btn.classList.contains('btn-minus') && loket > 0) loket--;
    totalE.textContent = loket;
    updateE();
  });
});

onlineE.addEventListener('input', () => {
  updateE();
});

// === RENDER SEMUA HURUF ===
function renderLetter(letter, data) {
  const container = document.getElementById(`call-${letter}`);
  const start = data.start || 1;
  const total = data.total || 0;
  const next = data.next || start;
  const recall = (data.recall || []).map(x => parseInt(x)).sort((a,b) => a - b);

  if (total === 0 || (letter !== 'E' && total < start)) {
    container.innerHTML = `<div class="call-header">${letter}: Tidak ada antrian</div>`;
    return;
  }

  let content = `<div class="call-header">${letter}: ${total - (letter === 'E' ? data.online || 0 : 0)} antrian</div>`;

  if (next <= total) {
    content += `
      <div class="call-info">Panggil: ${letter}${next}</div>
      <button class="btn-call" data-letter="${letter}" data-number="${next}" data-is-recall="false">Panggil ${letter}${next}</button>
    `;
  }

  if (recall.length > 0) {
    const firstRecall = recall[0];
    content += `
      <div class="call-info" style="color:#d95345; margin-top:8px;">Belum hadir: ${recall.map(n => letter + n).join(', ')}</div>
      <button class="btn-call recall" data-letter="${letter}" data-number="${firstRecall}" data-is-recall="true">Panggil Ulang ${letter}${firstRecall}</button>
    `;
  }

  if (next > total && recall.length === 0) {
    content = `<div class="call-header">${letter}: Semua selesai</div>`;
  }

  container.innerHTML = content;

  container.querySelectorAll('.btn-call').forEach(btn => {
    btn.addEventListener('click', () => {
      const number = parseInt(btn.getAttribute('data-number'));
      const isRecall = btn.getAttribute('data-is-recall') === 'true';
      playBeep();
      container.innerHTML += `
        <div style="margin-top:10px;">
          <button class="btn-confirm hadir" data-letter="${letter}" data-number="${number}" data-is-recall="${isRecall}">${letter}${number} Hadir</button>
          <button class="btn-confirm tidak-hadir" data-letter="${letter}" data-number="${number}" data-is-recall="${isRecall}">${letter}${number} Tidak Hadir</button>
        </div>
      `;
    });
  });
}

// === HANDLE KONFIRMASI (PERBAIKAN UTAMA) ===
document.getElementById('tab2').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-confirm')) {
    const letter = e.target.getAttribute('data-letter');
    const number = parseInt(e.target.getAttribute('data-number'));
    const isRecall = e.target.getAttribute('data-is-recall') === 'true';
    const hadir = e.target.classList.contains('hadir');

    const letterRef = ref.child(letter);
    letterRef.once('value').then(snapshot => {
      const data = snapshot.val() || {};
      const recall = (data.recall || []).map(x => parseInt(x));
      const start = data.start || 1;
      let next = data.next || start;

      if (hadir) {
        const newRecall = recall.filter(n => n !== number);
        if (isRecall) {
          letterRef.update({ recall: newRecall });
        } else {
          letterRef.update({ next: next + 1, recall: newRecall });
        }
      } else {
        // 🔥 PERBAIKAN: SELALU NAIKKAN NEXT, BAIK PANGGIL BARU MAUPUN ULANG
        let newRecall = [...recall];
        if (!newRecall.includes(number)) {
          newRecall = [...newRecall, number];
        }
        letterRef.update({ next: next + 1, recall: newRecall }); // ⬅️ INI PERUBAHAN UTAMA
      }
    });
  }
});

// === RESET MANUAL ===
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Yakin reset semua antrian hari ini?')) {
    resetAll();
  }
});

// === REAL-TIME ===
ref.on('value', snapshot => {
  const data = snapshot.val() || {};
  ['A','B','C','D'].forEach(letter => {
    const total = (data[letter]?.total) || 0;
    document.getElementById(`total-${letter}`).textContent = total;
    renderLetter(letter, data[letter] || {});
  });
  const eData = data.E || {};
  const eTotal = (eData.total || 0) - (eData.online || 0);
  totalE.textContent = Math.max(0, eTotal);
  onlineE.value = eData.online || 0;
  renderLetter('E', eData);
});
