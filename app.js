// ==========================================
// APP.JS - LÓGICA PRINCIPAL Y MODALES
// ==========================================

let tripsData = JSON.parse(localStorage.getItem('tripmaster_trips')) || [];
let paymentMethods = JSON.parse(localStorage.getItem('tripmaster_payments')) || [];
let packingList = JSON.parse(localStorage.getItem('tripmaster_packing')) || [];

let activeTripId = null;
let activeItemId = null;
let tripTimeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  renderTripsList();
  populateYearSelects();
  renderPaymentMethods();
  renderPackingList();
  checkServiceWorkerUpdates();
});

function saveToLocalStorage() {
  localStorage.setItem('tripmaster_trips', JSON.stringify(tripsData));
  localStorage.setItem('tripmaster_payments', JSON.stringify(paymentMethods));
  localStorage.setItem('tripmaster_packing', JSON.stringify(packingList));
  if (typeof populateYearSelects === 'function') populateYearSelects();
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');
}

function switchTab(tabId, titleText = '') {
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  
  if (tabId === 'trips-list') {
    showScreen('trips-list');
    const navBtn = document.querySelectorAll('.nav-item')[0];
    if (navBtn) navBtn.classList.add('active');
    renderTripsList();
  } else if (tabId === 'flight-stats') {
    showScreen('flight-stats');
    const navBtn = document.querySelectorAll('.nav-item')[2];
    if (navBtn) navBtn.classList.add('active');
    if (typeof initOrUpdateLeafletMap === 'function') {
      setTimeout(() => initOrUpdateLeafletMap(), 200);
    }
  } else if (tabId === 'account') {
    showScreen('account');
    const navBtn = document.querySelectorAll('.nav-item')[4];
    if (navBtn) navBtn.classList.add('active');
  } else if (tabId === 'placeholder') {
    showScreen('placeholder');
    const titleEl = document.getElementById('placeholder-title');
    if (titleEl) titleEl.textContent = titleText;
  }
}

function switchFlightTab(subviewId) {
  document.querySelectorAll('.flight-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.flight-subview').forEach(v => v.classList.remove('active'));

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  const targetSubview = document.getElementById(`subview-${subviewId}`);
  if (targetSubview) targetSubview.classList.add('active');

  if (subviewId === 'mapa' && typeof initOrUpdateLeafletMap === 'function') {
    setTimeout(() => initOrUpdateLeafletMap(), 200);
  }
  if (subviewId === 'vuelos') renderAirFlightsList();
  if (subviewId === 'stats' && typeof renderSelectedCategoryStats === 'function') {
    renderSelectedCategoryStats();
  }
}

function toggleDropdown(event, dropdownId) {
  event.stopPropagation();
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  const isVisible = dropdown.classList.contains('active');
  closeModals();
  if (!isVisible) dropdown.classList.add('active');
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('.header-actions')) {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('active'));
  }
});

function renderTripsList() {
  const container = document.getElementById('trips-container');
  if (!container) return;

  const searchInput = document.getElementById('trip-search-input');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  
  const yearSelect = document.getElementById('trip-year-select');
  const yearVal = yearSelect ? yearSelect.value : 'all';

  container.innerHTML = '';
  const now = new Date();

  const filtered = tripsData.filter(trip => {
    const matchesSearch = (trip.name || '').toLowerCase().includes(search) || 
                          (trip.destination || '').toLowerCase().includes(search);
    
    const tripYear = trip.startDate ? new Date(trip.startDate).getFullYear().toString() : '';
    const matchesYear = (yearVal === 'all' || tripYear === yearVal);

    let matchesTime = true;
    if (tripTimeFilter === 'upcoming' && trip.endDate) matchesTime = new Date(trip.endDate) >= now;
    if (tripTimeFilter === 'past' && trip.endDate) matchesTime = new Date(trip.endDate) < now;

    return matchesSearch && matchesYear && matchesTime;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px; font-size:0.85rem;">No se encontraron viajes. Toca + para crear uno nuevo.</div>';
    return;
  }

  filtered.forEach(trip => {
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.onclick = () => openTripDetail(trip.id);
    card.innerHTML = `
      <img src="${trip.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828'}" class="trip-card-img" alt="Portada">
      <div class="trip-card-info">
        <div class="trip-card-title">${trip.name}</div>
        <div class="trip-card-dates">${trip.startDate || 'Sin fecha'} – ${trip.endDate || 'Sin fecha'}</div>
        <div class="trip-card-badge">${trip.destination || 'Destino'}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterTripsList() {
  renderTripsList();
}

function setTripTimeFilter(type) {
  tripTimeFilter = type;
  document.querySelectorAll('#screen-trips-list .pill-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`pill-trip-${type}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderTripsList();
}

function openTripDetail(tripId) {
  activeTripId = tripId;
  const trip = tripsData.find(t => t.id === tripId);
  if (!trip) return;

  const titleEl = document.getElementById('detail-title');
  const datesEl = document.getElementById('detail-dates');
  const costEl = document.getElementById('detail-total-cost');

  if (titleEl) titleEl.textContent = trip.name;
  if (datesEl) datesEl.textContent = `${trip.startDate || ''} – ${trip.endDate || ''}`;

  let totalCost = 0;
  if (trip.items) {
    trip.items.forEach(i => { if (i.cost) totalCost += parseFloat(i.cost); });
  }
  if (costEl) costEl.textContent = '$' + totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' USD';

  renderTimeline(trip);
  showScreen('trip-detail');
}

function renderTimeline(trip) {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  container.innerHTML = '';

  if (!trip.items || trip.items.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:0.85rem;">Sin actividades registradas. Toca el botón + para agregar vuelos, hoteles o actividades.</div>';
    return;
  }

  const sorted = [...trip.items].sort((a, b) => new Date(a.time) - new Date(b.time));

  sorted.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'timeline-item';
    itemEl.onclick = () => openItemDetailsModal(item);

    let iconClass = 'flight';
    let icon = 'fa-plane';
    if (item.type === 'hotel') { iconClass = 'hotel'; icon = 'fa-hotel'; }
    if (item.type === 'car') { iconClass = 'car'; icon = 'fa-car'; }
    if (item.type === 'restaurant') { iconClass = 'food'; icon = 'fa-utensils'; }
    if (item.type === 'activity') { iconClass = 'activity'; icon = 'fa-calendar-check'; }

    const timeStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

    itemEl.innerHTML = `
      <div class="time-column">${timeStr}</div>
      <div class="node-column">
        <div class="node-icon ${iconClass}"><i class="fa-solid ${icon}"></i></div>
        <div class="timeline-line"></div>
      </div>
      <div class="content-card">
        <div class="card-title-row">
          <div class="card-title">${item.title || 'Evento'}</div>
          ${item.cost ? `<div class="card-status">$${item.cost}</div>` : ''}
        </div>
        <div class="card-subdetail">${item.subtitle || ''}</div>
        ${item.paymentMethod ? `<div class="card-meta"><i class="fa-solid fa-credit-card"></i> ${item.paymentMethod}</div>` : ''}
      </div>
    `;
    container.appendChild(itemEl);
  });
}

function openModalNewTrip() {
  document.getElementById('edit-trip-id').value = '';
  document.getElementById('trip-name-input').value = '';
  document.getElementById('trip-dest-input').value = '';
  document.getElementById('trip-start-input').value = '';
  document.getElementById('trip-end-input').value = '';
  document.getElementById('trip-image-url').value = '';
  const prevBox = document.getElementById('trip-image-preview-box');
  if (prevBox) prevBox.style.display = 'none';
  
  document.getElementById('modal-new-trip').classList.add('active');
}

function saveTripForm(e) {
  e.preventDefault();
  const id = document.getElementById('edit-trip-id').value || 'trip_' + Date.now();
  const name = document.getElementById('trip-name-input').value;
  const dest = document.getElementById('trip-dest-input').value;
  const start = document.getElementById('trip-start-input').value;
  const end = document.getElementById('trip-end-input').value;
  const img = document.getElementById('trip-image-url').value;

  const existingIndex = tripsData.findIndex(t => t.id === id);
  const tripObj = {
    id: id,
    name: name,
    destination: dest,
    startDate: start,
    endDate: end,
    image: img || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828',
    items: existingIndex >= 0 ? (tripsData[existingIndex].items || []) : []
  };

  if (existingIndex >= 0) {
    tripsData[existingIndex] = tripObj;
  } else {
    tripsData.push(tripObj);
  }

  saveToLocalStorage();
  closeModals();
  renderTripsList();
}

function handleFabClick() {
  const activeScreen = document.querySelector('.screen.active')?.id;
  if (activeScreen === 'screen-trip-detail') {
    populatePaymentDropdowns();
    document.getElementById('modal-add-item').classList.add('active');
  } else {
    openModalNewTrip();
  }
}

function getAllAirFlights() {
  const flights = [];
  tripsData.forEach(t => {
    if (t.items) {
      t.items.filter(i => i.type === 'flight').forEach(f => {
        flights.push({
          ...f,
          airline: f.airline || f.title,
          origin: f.origin || (f.subtitle ? f.subtitle.split('➔')[0].trim() : ''),
          dest: f.dest || (f.subtitle ? f.subtitle.split('➔')[1].trim() : ''),
          depTime: f.time
        });
      });
    }
  });
  return flights;
}

function renderAirFlightsList() {
  const container = document.getElementById('air-flights-list');
  if (!container) return;
  const flights = getAllAirFlights();

  if (flights.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:0.85rem;">No hay vuelos registrados en tus itinerarios.</div>';
    return;
  }

  container.innerHTML = flights.map(fl => `
    <div class="air-flight-card">
      <div class="air-flight-header">
        <div class="air-flight-route">${fl.origin || '???'} ➔ ${fl.dest || '???'}</div>
        <div class="air-flight-badge">${fl.airline || 'Vuelo'}</div>
      </div>
      <div style="font-size:0.8rem; color:#fff; font-weight:600;">${fl.title || 'Vuelo'} (${fl.flightNo || 'N/A'})</div>
      <div style="font-size:0.75rem; color:#94a3b8;">${fl.depTime ? new Date(fl.depTime).toLocaleString() : 'Fecha N/A'}</div>
      ${fl.totalCost ? `<div style="font-size:0.8rem; color:#10b981; font-weight:700; margin-top:4px;">$${fl.totalCost} USD</div>` : ''}
    </div>
  `).join('');
}

function populatePaymentDropdowns() {
  const dropdowns = document.querySelectorAll('.payment-selector-dropdown');
  const optionsHtml = '<option value="">Sin especificar</option>' + 
    paymentMethods.map(p => `<option value="${p.name}">${p.name} (${p.type})</option>`).join('');
  dropdowns.forEach(d => d.innerHTML = optionsHtml);
}

function renderPaymentMethods() {
  const container = document.getElementById('payment-methods-list');
  if (!container) return;
  if (paymentMethods.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:#94a3b8;">No tienes métodos de pago guardados.</div>';
    return;
  }
  container.innerHTML = paymentMethods.map((p, idx) => `
    <div class="payment-card-item">
      <div>
        <div style="font-size:0.8rem; font-weight:700; color:#fff;">${p.name}</div>
        <div style="font-size:0.7rem; color:#94a3b8;">${p.type} ${p.last4 ? '•••• ' + p.last4 : ''}</div>
      </div>
      <button onclick="deletePaymentMethod(${idx})" class="delete-item-btn"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function openModalAddPaymentMethod() {
  document.getElementById('modal-add-payment').classList.add('active');
}

function saveNewPaymentMethod(e) {
  e.preventDefault();
  const type = document.getElementById('pay-type-select').value;
  const name = document.getElementById('pay-name-input').value;
  const last4 = document.getElementById('pay-last4-input').value;

  paymentMethods.push({ type, name, last4 });
  saveToLocalStorage();
  renderPaymentMethods();
  closeModals();
}

function deletePaymentMethod(idx) {
  paymentMethods.splice(idx, 1);
  saveToLocalStorage();
  renderPaymentMethods();
}

function renderPackingList() {
  const container = document.getElementById('packing-list-container');
  const textProgress = document.getElementById('packing-progress-text');
  if (!container) return;

  const completed = packingList.filter(i => i.done).length;
  if (textProgress) textProgress.textContent = `${completed} de ${packingList.length} completado`;

  if (packingList.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:#94a3b8; text-align:center; padding:10px;">Tu lista de equipaje está vacía.</div>';
    return;
  }

  container.innerHTML = packingList.map((item, idx) => `
    <div class="packing-item-card ${item.done ? 'done' : ''}" onclick="togglePackingItem(${idx})">
      <div style="display:flex; align-items:center; gap:8px;">
        <i class="fa-regular ${item.done ? 'fa-square-check' : 'fa-square'}" style="color:${item.done ? '#10b981' : '#94a3b8'};"></i>
        <span style="font-size:0.8rem; color:#fff;">${item.name}</span>
      </div>
      <button onclick="event.stopPropagation(); deletePackingItem(${idx})" class="delete-item-btn">&times;</button>
    </div>
  `).join('');
}

function addPackingItem(e) {
  e.preventDefault();
  const input = document.getElementById('packing-input');
  if (!input || !input.value.trim()) return;
  packingList.push({ name: input.value.trim(), done: false });
  input.value = '';
  saveToLocalStorage();
  renderPackingList();
}

function togglePackingItem(idx) {
  packingList[idx].done = !packingList[idx].done;
  saveToLocalStorage();
  renderPackingList();
}

function resetPackingCheckmarks() {
  packingList.forEach(i => i.done = false);
  saveToLocalStorage();
  renderPackingList();
}

function deletePackingItem(idx) {
  packingList.splice(idx, 1);
  saveToLocalStorage();
  renderPackingList();
}

function exportLocalJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips: tripsData, payments: paymentMethods, packing: packingList }, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `TripMaster_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importLocalJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.trips) tripsData = parsed.trips;
      if (parsed.payments) paymentMethods = parsed.payments;
      if (parsed.packing) packingList = parsed.packing;
      saveToLocalStorage();
      renderTripsList();
      renderPaymentMethods();
      renderPackingList();
      alert('¡Copia de seguridad cargada con éxito!');
    } catch (err) {
      alert('Error al leer el archivo JSON.');
    }
  };
  reader.readAsText(file);
}

function checkServiceWorkerUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            const updateToast = document.getElementById('update-toast');
            if (updateToast) updateToast.style.display = 'flex';
          }
        });
      });
    });
  }
}

function reloadAppVersion() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ action: 'skipWaiting' });
      }
      window.location.reload();
    });
  } else {
    window.location.reload();
  }
}
