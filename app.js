// ==========================================
// TRIPMAST3R PRO - LÓGICA PRINCIPAL (COMPATIBLE CON BACKUPS ANTERIORES)
// ==========================================

let tripsData = [];
let paymentMethods = [];
let packingList = [];

try {
  tripsData = JSON.parse(localStorage.getItem('tripmast3r_pro_trips')) || [];
  paymentMethods = JSON.parse(localStorage.getItem('tripmast3r_pro_payments')) || [];
  packingList = JSON.parse(localStorage.getItem('tripmast3r_pro_packing')) || [];
} catch (e) {
  tripsData = [];
  paymentMethods = [];
  packingList = [];
}

let activeTripId = null;
let activeItemId = null;
let tripTimeFilter = 'all';

window.addEventListener('load', () => {
  renderTripsList();
  if (typeof populateYearSelects === 'function') populateYearSelects();
  renderPaymentMethods();
  renderPackingList();
  checkServiceWorkerUpdates();
});

function saveToLocalStorage() {
  localStorage.setItem('tripmast3r_pro_trips', JSON.stringify(tripsData));
  localStorage.setItem('tripmast3r_pro_payments', JSON.stringify(paymentMethods));
  localStorage.setItem('tripmast3r_pro_packing', JSON.stringify(packingList));
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
      setTimeout(() => initOrUpdateLeafletMap(), 250);
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

  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  }
  const targetSubview = document.getElementById(`subview-${subviewId}`);
  if (targetSubview) targetSubview.classList.add('active');

  if (subviewId === 'mapa' && typeof initOrUpdateLeafletMap === 'function') {
    setTimeout(() => initOrUpdateLeafletMap(), 250);
  }
  if (subviewId === 'vuelos') renderAirFlightsList();
  if (subviewId === 'stats' && typeof renderSelectedCategoryStats === 'function') {
    renderSelectedCategoryStats();
  }
}

function toggleDropdown(event, dropdownId) {
  if (event) event.stopPropagation();
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

// Renderizado de lista con soporte dual para "name" y "title"
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
    const tripName = trip.name || trip.title || '';
    const tripDest = trip.destination || '';
    const matchesSearch = tripName.toLowerCase().includes(search) || tripDest.toLowerCase().includes(search);
    
    let tripYear = '';
    if (trip.startDate) {
      tripYear = new Date(trip.startDate).getFullYear().toString();
    } else if (trip.dates) {
      const parts = trip.dates.split('–');
      if (parts[0]) tripYear = new Date(parts[0].trim()).getFullYear().toString();
    }
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

    const displayName = trip.name || trip.title || 'Viaje Sin Nombre';
    const displayDates = (trip.startDate && trip.endDate) ? `${trip.startDate} – ${trip.endDate}` : (trip.dates || 'Sin fechas');

    card.innerHTML = `
      <img src="${trip.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828'}" class="trip-card-img" alt="Portada">
      <div class="trip-card-info">
        <div class="trip-card-title">${displayName}</div>
        <div class="trip-card-dates">${displayDates}</div>
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

  if (titleEl) titleEl.textContent = trip.name || trip.title || 'Detalle del Viaje';
  if (datesEl) datesEl.textContent = (trip.startDate && trip.endDate) ? `${trip.startDate} – ${trip.endDate}` : (trip.dates || '');

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
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:0.85rem;">Sin actividades registradas. Toca + para agregar eventos.</div>';
    return;
  }

  const sorted = [...trip.items].sort((a, b) => new Date(a.time || a.timestamp) - new Date(b.time || b.timestamp));

  sorted.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'timeline-item';
    itemEl.onclick = () => openItemDetailsModal(item);

    let iconClass = 'flight';
    let icon = 'fa-plane';
    if (item.type === 'hotel') { iconClass = 'hotel'; icon = 'fa-hotel'; }
    if (item.type === 'car') { iconClass = 'car'; icon = 'fa-car'; }
    if (item.type === 'restaurant' || item.type === 'food') { iconClass = 'food'; icon = 'fa-utensils'; }
    if (item.type === 'activity') { iconClass = 'activity'; icon = 'fa-calendar-check'; }

    let timeStr = '--:--';
    if (item.time) {
      const parsedTime = new Date(item.time);
      timeStr = isNaN(parsedTime.getTime()) ? item.time : parsedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

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
  closeModals();
  const editIdEl = document.getElementById('edit-trip-id');
  const nameEl = document.getElementById('trip-name-input');
  const destEl = document.getElementById('trip-dest-input');
  const startEl = document.getElementById('trip-start-input');
  const endEl = document.getElementById('trip-end-input');
  const imgEl = document.getElementById('trip-image-url');

  if (editIdEl) editIdEl.value = '';
  if (nameEl) nameEl.value = '';
  if (destEl) destEl.value = '';
  if (startEl) startEl.value = '';
  if (endEl) endEl.value = '';
  if (imgEl) imgEl.value = '';
  
  const modal = document.getElementById('modal-new-trip');
  if (modal) modal.classList.add('active');
}

function saveTripForm(e) {
  e.preventDefault();
  
  const editIdEl = document.getElementById('edit-trip-id');
  const nameEl = document.getElementById('trip-name-input');
  const destEl = document.getElementById('trip-dest-input');
  const startEl = document.getElementById('trip-start-input');
  const endEl = document.getElementById('trip-end-input');
  const imgEl = document.getElementById('trip-image-url');

  const id = (editIdEl && editIdEl.value) ? editIdEl.value : 'trip_' + Date.now();
  const name = nameEl ? nameEl.value : 'Nuevo Viaje';
  const dest = destEl ? destEl.value : 'Destino';
  const start = startEl ? startEl.value : '';
  const end = endEl ? endEl.value : '';
  const img = imgEl ? imgEl.value : '';

  const existingIndex = tripsData.findIndex(t => t.id === id);
  const tripObj = {
    id: id,
    name: name,
    title: name,
    destination: dest,
    startDate: start,
    endDate: end,
    dates: `${start} – ${end}`,
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
    const modal = document.getElementById('modal-add-item');
    if (modal) modal.classList.add('active');
  } else {
    openModalNewTrip();
  }
}

// ==========================================
// FORMULARIOS Y MANEJO DE ITINERARIOS
// ==========================================

function openFlightForm() {
  closeModals();
  const modal = document.getElementById('modal-flight-form');
  if (modal) modal.classList.add('active');
}

function openHotelForm() {
  closeModals();
  const modal = document.getElementById('modal-hotel-form');
  if (modal) modal.classList.add('active');
}

function openCarForm() {
  closeModals();
  const modal = document.getElementById('modal-car-form');
  if (modal) modal.classList.add('active');
}

function openRestaurantForm() {
  closeModals();
  const modal = document.getElementById('modal-restaurant-form');
  if (modal) modal.classList.add('active');
}

function openGenericForm(type, titleText) {
  closeModals();
  const typeInput = document.getElementById('generic-item-type');
  const titleInput = document.getElementById('generic-form-title');
  if (typeInput) typeInput.value = type;
  if (titleInput) titleInput.textContent = titleText;
  const modal = document.getElementById('modal-generic-form');
  if (modal) modal.classList.add('active');
}

function addItemToActiveTrip(itemObj) {
  const trip = tripsData.find(t => t.id === activeTripId);
  if (!trip) return;
  if (!trip.items) trip.items = [];
  trip.items.push(itemObj);
  saveToLocalStorage();
  openTripDetail(activeTripId);
}

function saveAdvancedFlight(e) {
  e.preventDefault();
  const flightNo = document.getElementById('flight-no')?.value || '';
  const airline = document.getElementById('flight-airline')?.value || '';
  const origin = document.getElementById('flight-origin')?.value.toUpperCase() || '';
  const dest = document.getElementById('flight-dest')?.value.toUpperCase() || '';
  const time = document.getElementById('flight-dep-time')?.value || '';
  const cost = document.getElementById('flight-total-cost')?.value || '';
  const paymentMethod = document.getElementById('flight-payment-method')?.value || '';

  const itemObj = {
    id: 'item_' + Date.now(),
    type: 'flight',
    title: `${origin} ➔ ${dest}`,
    subtitle: `${airline} (${flightNo})`,
    time: time,
    cost: cost,
    origin: origin,
    dest: dest,
    airline: airline,
    flightNo: flightNo,
    paymentMethod: paymentMethod
  };

  addItemToActiveTrip(itemObj);
  closeModals();
}

function saveAdvancedHotel(e) {
  e.preventDefault();
  const name = document.getElementById('hotel-name')?.value || '';
  const checkin = document.getElementById('hotel-checkin')?.value || '';
  const cost = document.getElementById('hotel-cost')?.value || '';
  const address = document.getElementById('hotel-address')?.value || '';
  const paymentMethod = document.getElementById('hotel-payment-method')?.value || '';

  const itemObj = {
    id: 'item_' + Date.now(),
    type: 'hotel',
    title: name,
    subtitle: address || 'Reserva de Hotel',
    time: checkin,
    checkin: checkin,
    cost: cost,
    paymentMethod: paymentMethod
  };

  addItemToActiveTrip(itemObj);
  closeModals();
}

function saveAdvancedCar(e) {
  e.preventDefault();
  const company = document.getElementById('car-company')?.value || '';
  const model = document.getElementById('car-model')?.value || '';
  const pickup = document.getElementById('car-pickup')?.value || '';
  const cost = document.getElementById('car-cost')?.value || '';
  const paymentMethod = document.getElementById('car-payment-method')?.value || '';

  const itemObj = {
    id: 'item_' + Date.now(),
    type: 'car',
    title: `${company} - ${model}`,
    subtitle: 'Alquiler de Vehículo',
    time: pickup,
    cost: cost,
    paymentMethod: paymentMethod
  };

  addItemToActiveTrip(itemObj);
  closeModals();
}

function saveAdvancedRestaurant(e) {
  e.preventDefault();
  const name = document.getElementById('restaurant-name')?.value || '';
  const time = document.getElementById('restaurant-time')?.value || '';
  const cost = document.getElementById('restaurant-cost')?.value || '';
  const address = document.getElementById('restaurant-address')?.value || '';
  const paymentMethod = document.getElementById('restaurant-payment-method')?.value || '';

  const itemObj = {
    id: 'item_' + Date.now(),
    type: 'restaurant',
    title: name,
    subtitle: address || 'Reserva de Restaurante',
    time: time,
    cost: cost,
    paymentMethod: paymentMethod
  };

  addItemToActiveTrip(itemObj);
  closeModals();
}

function saveGenericItem(e) {
  e.preventDefault();
  const type = document.getElementById('generic-item-type')?.value || 'activity';
  const title = document.getElementById('generic-title')?.value || '';
  const time = document.getElementById('generic-time')?.value || '';
  const sub = document.getElementById('generic-sub')?.value || '';
  const paymentMethod = document.getElementById('generic-payment-method')?.value || '';

  const itemObj = {
    id: 'item_' + Date.now(),
    type: type,
    title: title,
    subtitle: sub,
    time: time,
    paymentMethod: paymentMethod
  };

  addItemToActiveTrip(itemObj);
  closeModals();
}

function openItemDetailsModal(item) {
  activeItemId = item.id;
  const titleEl = document.getElementById('item-detail-title');
  const bodyEl = document.getElementById('item-detail-body');
  if (titleEl) titleEl.textContent = item.title || 'Detalle del Evento';
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="font-size:0.85rem; color:#fff; font-weight:700;">${item.title}</div>
      <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${item.subtitle || ''}</div>
      <div style="font-size:0.75rem; color:#38bdf8; margin-top:6px;"><i class="fa-solid fa-clock"></i> ${item.time ? item.time : 'Sin hora'}</div>
      ${item.cost ? `<div style="font-size:0.85rem; color:#10b981; font-weight:800; margin-top:6px;">Costo: $${item.cost}</div>` : ''}
      ${item.paymentMethod ? `<div style="font-size:0.72rem; color:#cbd5e1; margin-top:4px;"><i class="fa-solid fa-credit-card"></i> ${item.paymentMethod}</div>` : ''}
    `;
  }
  const modal = document.getElementById('modal-item-details');
  if (modal) modal.classList.add('active');
}

function deleteActiveItem() {
  const trip = tripsData.find(t => t.id === activeTripId);
  if (trip && trip.items) {
    trip.items = trip.items.filter(i => i.id !== activeItemId);
    saveToLocalStorage();
    openTripDetail(activeTripId);
  }
  closeModals();
}

function editActiveItem() {
  closeModals();
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
      <div style="font-size:0.75rem; color:#94a3b8;">${fl.depTime ? fl.depTime : 'Fecha N/A'}</div>
      ${fl.totalCost || fl.cost ? `<div style="font-size:0.8rem; color:#10b981; font-weight:700; margin-top:4px;">$${fl.totalCost || fl.cost} USD</div>` : ''}
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
  const modal = document.getElementById('modal-add-payment');
  if (modal) modal.classList.add('active');
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
        <span style="font-size:0.8rem; color:#fff;">${item.name || item.text}</span>
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
  downloadAnchor.setAttribute("download", `TripMast3r_Pro_Backup_${new Date().toISOString().split('T')[0]}.json`);
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
      alert('¡Copia de seguridad cargada con éxito en TripMast3r Pro!');
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
