// Aplikasi Sistem Antrian Puskesmas
// Main JavaScript File

// ==================== FIREBASE INITIALIZATION ====================
let database;
let ref;

function initializeFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    ref = database.ref('antrian_hari_ini');
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    showError('Gagal menghubungkan ke server. Coba refresh halaman.');
  }
}

// ==================== GLOBAL VARIABLES ====================
let currentCall = {
  letter: null,
  number: null,
  isRecall: false
};

// ==================== UTILITY FUNCTIONS ====================
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
    console.warn('Gagal memutar suara:', e);
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'status-message status-error';
  errorDiv.textContent = message;
  document.body.prepend(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'status-message status-success';
  successDiv.textContent = message;
  document.body.prepend(successDiv);
  setTimeout(() => successDiv.remove(), 3000);
}

function isSameDay(timestamp) {
  const now = new Date();
  const stored = new Date(timestamp);
  return now.getFullYear() === stored.getFullYear() &&
         now.getMonth() === stored.getMonth() &&
         now.getDate() === stored.getDate();
}

// ==================== CORE FUNCTIONS ====================
function resetAll() {
  const resetData = {};
  ['A','B','C','D'].forEach(letter => {
    resetData[letter] = { 
      start: 1, 
      total: 0, 
      next: 1, 
      recall: [], 
      lastUpdated: Date.now() 
    };
  });
  resetData.E = { 
    start: 1, 
    total: 0, 
    next: 1, 
    recall: [], 
    online: 0, 
    loket: 0,
    lastUpdated: Date.now()
  };
  resetData.lastReset = Date.now();
  
  ref.set(resetData)
    .then(() => showSuccess('Reset berhasil! Semua antrian dikosongkan.'))
    .catch(error => showError('Gagal reset: ' + error.message));
}

function checkAndResetIfNeeded() {
  ref.once('value').then(snapshot => {
    const data = snapshot.val() || {};
    const lastReset = data.lastReset || 0;
    if (!isSameDay(lastReset)) {
      resetAll();
    }
  }).catch(error => {
    console.error('Error checking reset:', error);
  });
}

// ==================== COUNTER FUNCTIONS ====================
function setupCounters() {
  // Setup counters for A-D
  ['A','B','C','D'].forEach(letter => {
    const plusBtn = document.querySelector(`[data-letter="${letter}"].btn-plus`);
    const minusBtn = document.querySelector(`[data-letter="${letter}"].btn-minus`);
    const counterEl = document.getElementById(`total-${letter}`);
    
    if (plusBtn && minusBtn && counterEl) {
      plusBtn.addEventListener('click', () => updateCounter(letter, 'plus'));
      minusBtn.addEventListener('click', () => updateCounter(letter, 'minus'));
    }
  });
  
  // Setup counter for E
  const plusBtnE = document.querySelector('[data-letter="E"].btn-plus');
  const minusBtnE = document.querySelector('[data-letter="E"].btn-minus');
  const totalE = document.getElementById('total-E');
  const onlineE = document.getElementById('online-E');
  
  if (plusBtnE && minusBtnE && totalE) {
    plusBtnE.addEventListener('click', () => updateCounterE('plus'));
    minusBtnE.addEventListener('click', () => updateCounterE('minus'));
  }
  
  if (onlineE) {
    onlineE.addEventListener('input', updateE);
  }
}

function updateCounter(letter, operation) {
  const el = document.getElementById(`total-${letter}`);
  let val = parseInt(el.textContent) || 0;
  
  if (operation === 'plus') {
    val++;
  } else if (operation === 'minus' && val > 0) {
    val--;
  }
  
  el.textContent = val;
  ref.child(letter).update({ 
    total: val, 
    start: 1,
    lastUpdated: Date.now()
  });
  
  if (val === 0) {
    ref.child(letter).update({ 
      next: 1, 
      recall: [],
      lastUpdated: Date.now()
    });
  }
  
  // Add highlight effect
  el.classList.add('highlight');
  setTimeout(() => el.classList.remove('highlight'), 1000);
}

function updateCounterE(operation) {
  const totalE = document.getElementById('total-E');
  let loket = parseInt(totalE.textContent) || 0;
  
  if (operation === 'plus') {
    loket++;
  } else if (operation === 'minus' && loket > 0) {
    loket--;
  }
  
  totalE.textContent = loket;
  updateE();
}

function updateE() {
  const loket = parseInt(document.getElementById('total-E').textContent) || 0;
  const online = parseInt(document.getElementById('online-E').value) || 0;
  const start = online + 1;
  const total = online + loket;
  
  ref.child('E').set({
    online: online,
    start: start,
    total: total,
    next: start,
    recall: [],
    loket: loket,
    lastUpdated: Date.now()
  }).catch(error => {
    showError('Gagal update antrian E: ' + error.message);
  });
}

// ==================== CALL FUNCTIONS ====================
function showConfirmBox(container, letter, number, isRecall) {
  const confirmBoxId = `confirm-${letter}-${number}`;
  
  // Remove existing confirm box
  const existingConfirm = document.getElementById(confirmBoxId);
  if (existingConfirm) {
    existingConfirm.remove();
  }
  
  const confirmBox = document.createElement('div');
  confirmBox.id = confirmBoxId;
  confirmBox.className = 'confirm-box';
  confirmBox.innerHTML = `
    <div class="confirm-title">Konfirmasi ${letter}${number}:</div>
    <div class="confirm-buttons">
      <button class="btn-confirm hadir" 
              data-letter="${letter}" 
              data-number="${number}" 
              data-is-recall="${isRecall}">
        ✅ Hadir
      </button>
      <button class="btn-confirm tidak-hadir" 
              data-letter="${letter}" 
              data-number="${number}" 
              data-is-recall="${isRecall}">
        ❌ Tidak Hadir
      </button>
      <button class="btn-confirm cancel">
        ↩️ Batal
      </button>
    </div>
  `;
  
  container.appendChild(confirmBox);
  
  // Add event listeners for the new buttons
  confirmBox.querySelector('.btn-confirm.cancel').addEventListener('click', () => {
    confirmBox.remove();
  });
  
  return confirmBox;
}

function renderLetter(letter, data) {
  const container = document.getElementById(`call-${letter}`);
  const callBody = document.getElementById(`call-body-${letter}`);
  
  if (!container || !callBody) return;
  
  const start = data.start || 1;
  const total = data.total || 0;
  const next = data.next || start;
  const recall = (data.recall || []).map(x => parseInt(x)).sort((a,b) => a - b);
  
  // Clear the call body
  callBody.innerHTML = '';
  
  if (total === 0 || (letter !== 'E' && total < start)) {
    callBody.innerHTML = `
      <div class="no-queue">
        <p>📭 Tidak ada antrian</p>
        <p><small>Tambahkan antrian di tab Pembagian</small></p>
      </div>
    `;
    return;
  }
  
  // Update online badge for E
  if (letter === 'E') {
    const onlineBadge = document.getElementById('online-badge');
    if (onlineBadge) {
      onlineBadge.textContent = `Online: ${data.online || 0}`;
    }
  }
  
  // Queue info
  const queueInfo = document.createElement('div');
  queueInfo.className = 'queue-info';
  const loketCount = total - (letter === 'E' ? data.online || 0 : 0);
  queueInfo.textContent = `Antrian: ${loketCount} (Total: ${total})`;
  callBody.appendChild(queueInfo);
  
  // Call button for normal queue
  if (next <= total) {
    const callBtn = document.createElement('button');
    callBtn.className = 'btn-call primary';
    callBtn.textContent = `📢 Panggil ${letter}${next}`;
    callBtn.dataset.letter = letter;
    callBtn.dataset.number = next;
    callBtn.dataset.isRecall = 'false';
    
    callBtn.addEventListener('click', (e) => {
      playBeep();
      const letter = e.target.dataset.letter;
      const number = parseInt(e.target.dataset.number);
      const isRecall = e.target.dataset.isRecall === 'true';
      
      // Show current call display
      const currentCallDisplay = document.getElementById('current-call-display');
      currentCallDisplay.textContent = `🔊 Memanggil: ${letter}${number}`;
      currentCallDisplay.style.display = 'block';
      setTimeout(() => {
        currentCallDisplay.style.display = 'none';
      }, 5000);
      
      showConfirmBox(callBody, letter, number, isRecall);
    });
    
    callBody.appendChild(callBtn);
  }
  
  // Recall section
  if (recall.length > 0) {
    const recallSection = document.createElement('div');
    recallSection.className = 'recall-section';
    
    const recallTitle = document.createElement('div');
    recallTitle.className = 'recall-title';
    recallTitle.textContent = `⏰ Belum hadir (${recall.length}):`;
    recallSection.appendChild(recallTitle);
    
    const recallList = document.createElement('div');
    recallList.className = 'recall-list';
    recallSection.appendChild(recallList);
    
    recall.forEach(num => {
      const recallItem = document.createElement('div');
      recallItem.className = 'recall-item';
      recallItem.innerHTML = `
        <span>${letter}${num}</span>
        <button data-letter="${letter}" data-number="${num}">
          📢 Panggil Ulang
        </button>
      `;
      
      recallItem.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        playBeep();
        const letter = e.target.dataset.letter;
        const number = parseInt(e.target.dataset.number);
        
        // Show current call display
        const currentCallDisplay = document.getElementById('current-call-display');
        currentCallDisplay.textContent = `🔊 Memanggil Ulang: ${letter}${number}`;
        currentCallDisplay.style.display = 'block';
        setTimeout(() => {
          currentCallDisplay.style.display = 'none';
        }, 5000);
        
        showConfirmBox(callBody, letter, number, true);
      });
      
      recallList.appendChild(recallItem);
    });
    
    callBody.appendChild(recallSection);
  }
  
  // If all done
  if (next > total && recall.length === 0) {
    callBody.innerHTML = `
      <div class="no-queue">
        <p>✅ Semua antrian selesai</p>
        <p><small>Tidak ada pasien yang menunggu</small></p>
      </div>
    `;
  }
}

function handleConfirmation(e) {
  if (e.target.classList.contains('btn-confirm') && 
      !e.target.classList.contains('cancel')) {
    
    const letter = e.target.dataset.letter;
    const number = parseInt(e.target.dataset.number);
    const isRecall = e.target.dataset.isRecall === 'true';
    const hadir = e.target.classList.contains('hadir');
    
    const letterRef = ref.child(letter);
    letterRef.once('value').then(snapshot => {
      const data = snapshot.val() || {};
      const recall = (data.recall || []).map(x => parseInt(x));
      const start = data.start || 1;
      let next = data.next || start;
      
      let updates = {};
      
      if (hadir) {
        const newRecall = recall.filter(n => n !== number);
        updates.recall = newRecall;
        updates.lastUpdated = Date.now();
        
        if (!isRecall) {
          updates.next = next + 1;
        }
        
        showSuccess(`${letter}${number} dikonfirmasi hadir`);
      } else {
        let newRecall = [...recall];
        if (!newRecall.includes(number)) {
          newRecall.push(number);
        }
        updates.recall = newRecall;
        updates.lastUpdated = Date.now();
        
        if (!isRecall) {
          updates.next = next + 1;
        }
        
        showSuccess(`${letter}${number} ditandai tidak hadir`);
      }
      
      letterRef.update(updates);
      
      // Remove confirm box
      const confirmBox = document.getElementById(`confirm-${letter}-${number}`);
      if (confirmBox) {
        confirmBox.remove();
      }
      
    }).catch(error => {
      showError('Gagal memperbarui status: ' + error.message);
    });
  }
}

// ==================== TAB NAVIGATION ====================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// ==================== MODAL FUNCTIONS ====================
function setupModal() {
  const modal = document.getElementById('info-modal');
  const infoBtn = document.getElementById('info-btn');
  const closeBtn = document.querySelector('.close-modal');
  
  if (infoBtn && modal && closeBtn) {
    infoBtn.addEventListener('click', () => {
      modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('⚠️ Yakin reset semua antrian hari ini?\nSemua data akan dikembalikan ke awal.')) {
        resetAll();
      }
    });
  }
  
  // Confirmation handling in tab2
  const tab2 = document.getElementById('tab2');
  if (tab2) {
    tab2.addEventListener('click', handleConfirmation);
  }
}

// ==================== FIREBASE LISTENER ====================
function setupFirebaseListener() {
  if (!ref) return;
  
  ref.on('value', snapshot => {
    const data = snapshot.val() || {};
    
    // Update counters for A-D
    ['A','B','C','D'].forEach(letter => {
      const total = (data[letter]?.total) || 0;
      const counterEl = document.getElementById(`total-${letter}`);
      if (counterEl) {
        counterEl.textContent = total;
      }
      renderLetter(letter, data[letter] || {});
    });
    
    // Update counter for E
    const eData = data.E || {};
    const eTotal = eData.loket || 0;
    const totalE = document.getElementById('total-E');
    const onlineE = document.getElementById('online-E');
    
    if (totalE) totalE.textContent = eTotal;
    if (onlineE) onlineE.value = eData.online || 0;
    
    renderLetter('E', eData);
    
  }, error => {
    console.error('Firebase listener error:', error);
    showError('Gagal memperbarui data dari server');
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Sistem Antrian Puskesmas Initializing...');
  
  // Initialize Firebase
  initializeFirebase();
  
  // Setup all components
  setupTabs();
  setupCounters();
  setupEventListeners();
  setupModal();
  setupFirebaseListener();
  
  // Check if reset is needed
  setTimeout(() => {
    checkAndResetIfNeeded();
  }, 1000);
  
  console.log('Sistem Antrian Puskesmas Ready!');
  
  // Show welcome message
  setTimeout(() => {
    showSuccess('Sistem Antrian Puskesmas siap digunakan!');
  }, 1500);
});
