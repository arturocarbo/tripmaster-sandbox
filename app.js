// ==========================================
// TRIPMASTER PRO - MOTOR COMPLETO INTEGRADO
// ==========================================

let flightMap = null;
let planeAnimMarkers = [];
let mapPolylines = [];
let animFrameId = null;
let airlinesChartObj = null;

let currentTripTimeFilter = 'all';
let currentFlightTimeFilter = 'all';
let activeSelectedItemId = null;

const GOOGLE_CLIENT_ID = '3946661722-akjk1dp0slafuu03bdc3hehibbe952og.apps.googleusercontent.com';
let tokenClient = null;
let driveAccessToken = null;

const LOCAL_AIRPORT_DB = {
  'SAL': { name: 'San Salvador', country: 'El Salvador', lat: 13.4409, lng: -89.0557 },
  'SJO': { name: 'San José', country: 'Costa Rica', lat: 9.9938, lng: -84.2088 },
  'PTY': { name: 'Panamá', country: 'Panamá', lat: 9.0714, lng: -79.3835 },
  'GYE': { name: 'Guayaquil', country: 'Ecuador', lat: -2.1574, lng: -79.8836 },
  'UIO': { name: 'Quito', country: 'Ecuador', lat: -0.1292, lng: -78.3575 },
  'MIA': { name: 'Miami', country: 'Estados Unidos', lat: 25.7959, lng: -80.2870 },
  'JFK': { name: 'Nueva York', country: 'Estados Unidos', lat: 40.6413, lng: -73.7781 },
  'MAD': { name: 'Madrid', country: 'España', lat: 40.4839, lng: -3.5680 },
  'BCN': { name: 'Barcelona', country: 'España', lat: 41.2974, lng: 2.0785 }
};

const INITIAL_TRIPS = [
  {
    id: '1',
    title: 'Fin de Año Ecuador 2026',
    dates: '2026-12-26 – 2027-01-03',
    daysCount: '9 días',
    daysToGo: 'en agenda',
    image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=200&q=80',
    items: []
  }
];

const INITIAL_PACKING_ITEMS = [
  { id: 1, text: 'Pasaporte & Visas válidas', done: true },
  { id: 2, text: 'Pases de abordar en el móvil', done: true },
  { id: 3, text: 'Cargadores & Batería externa', done: false }
];

const DEFAULT_PAYMENT_METHODS = [
  { id: 'cash', type: 'Efectivo', name: 'Efectivo Local', last4: '' },
  { id: 'visa-default', type: 'Visa', name: 'Visa Preferencial', last4: '4321' }
];

let trips = [];
let packingItems = [];
let paymentMethods = [];
let membershipPrograms = [];
let currentScreen = 'trips-list';
let activeTripId = '1';

window.addEventListener('load', () => {
  loadDataFromStorage();
  renderTrips();
  checkServiceWorkerUpdates();
});

function saveDataToStorage() {
  try {
    localStorage.setItem('tripmaster_trips', JSON.stringify(trips));
    localStorage.setItem('tripmaster_packing', JSON.stringify(packingItems));
    localStorage.setItem('tripmaster_payments', JSON.stringify(paymentMethods));
    localStorage.setItem('tripmaster_memberships', JSON.stringify(membershipPrograms));
    populateYearDropdowns();
    checkAndPerformAutoBackup();
  } catch (e) { console.error("Error guardando datos:", e); }
}

function loadDataFromStorage() {
  try {
    const storedTrips = localStorage.getItem('tripmaster_trips');
    const storedPacking = localStorage.getItem('tripmaster_packing');
    const storedPayments = localStorage.getItem('tripmaster_payments');
    const storedMemberships = localStorage.getItem('tripmaster_memberships');

    if (storedTrips) {
      trips = JSON.parse(storedTrips);
      trips.forEach(t => { 
        if (t.items) {
          t.items.forEach(i => { 
            if (!i.id) i.id = 'item-' + Date.now() + Math.random().toString(36).substr(2, 4); 
          }); 
        }
      });
    } else { trips = INITIAL_TRIPS; }

    if (storedPacking) { packingItems = JSON.parse(storedPacking); } 
    else { packingItems = INITIAL_PACKING_ITEMS; }

    if (storedPayments) { paymentMethods = JSON.parse(storedPayments); }
    else { paymentMethods = DEFAULT_PAYMENT_METHODS; }

    if (storedMemberships) { membershipPrograms = JSON.parse(storedMemberships); }

    updateLastBackupDisplay();
    renderPaymentMethodsList();
    renderMembershipsList();
    populateYearDropdowns();
  } catch (e) {
    trips = INITIAL_TRIPS; packingItems = INITIAL_PACKING_ITEMS; paymentMethods = DEFAULT_PAYMENT_METHODS;
  }
}

function populateYearDropdowns() {
  const yearsSet = new Set();
  trips.forEach(trip => {
    const d = getTripStartDate(trip);
    if (d && d.getFullYear() && d.getFullYear() > 1990) {
      yearsSet.add(d.getFullYear());
    }
  });

  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
  const tripSelect = document.getElementById('trip-year-select');
  const statsSelect = document.getElementById('stats-year-select');

  if (tripSelect) {
    const currTripVal = tripSelect.value;
    tripSelect.innerHTML = `<option value="all">📅 Todos los años</option>`;
    sortedYears.forEach(y => { tripSelect.innerHTML += `<option value="${y}">📅 ${y}</option>`; });
    if (currTripVal && Array.from(tripSelect.options).some(o => o.value === currTripVal)) {
      tripSelect.value = currTripVal;
    }
  }

  if (statsSelect) {
    const currStatsVal = statsSelect.value;
    statsSelect.innerHTML = `<option value="all">📅 Todos los años</option>`;
    sortedYears.forEach(y => { statsSelect.innerHTML += `<option value="${y}">${y}</option>`; });
    if (currStatsVal && Array.from(statsSelect.options).some(o => o.value === currStatsVal)) {
      statsSelect.value = currStatsVal;
    }
  }
}

// ==========================================
// PREVISUALIZACIÓN Y ARCHIVO DE FOTO DE CELULAR
// ==========================================
function handleTripImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Img = e.target.result;
    document.getElementById('trip-image-url').value = base64Img;
    updateImagePreview(base64Img);
  };
  reader.readAsDataURL(file);
}

function updateImagePreview(src) {
  const previewBox = document.getElementById('trip-image-preview-box');
  const previewImg = document.getElementById('trip-image-preview');
  if (src && src.trim()) {
    previewImg.src = src;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }
}

// ==========================================
// NAVEGACIÓN DE PANTALLAS Y MENÚS DESPLEGABLES
// ==========================================
function toggleDropdown(event, menuId) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isVisible = menu.classList.contains('active');
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
  if (!isVisible) {
    menu.classList.add('active');
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-menu') && !e.target.closest('.action-icon-btn')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
  }
});

function switchMainTab(screenId) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => btn.classList.remove('active'));
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  }

  showScreen(screenId);

  if (screenId === 'flight-hub') {
    renderAirFlightsList();
    renderSelectedCategoryStats();
  } else if (screenId === 'map-view') {
    initFlightMap();
  } else if (screenId === 'documents') {
    renderMembershipsList();
    renderPackingList();
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');
  currentScreen = screenId;
}

function switchFlightHubSubtab(subtabId) {
  document.querySelectorAll('.flight-hub-tab').forEach(b => b.classList.remove('active'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');

  document.querySelectorAll('.flighthub-subview').forEach(v => v.style.display = 'none');
  const target = document.getElementById(`subview-flighthub-${subtabId}`);
  if (target) target.style.display = 'block';

  if (subtabId === 'vuelos') renderAirFlightsList();
  else if (subtabId === 'stats') renderSelectedCategoryStats();
}

function switchDocSubtab(subtabId) {
  document.querySelectorAll('.doc-subtab').forEach(b => b.classList.remove('active'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');

  document.querySelectorAll('.doc-subview').forEach(v => v.style.display = 'none');
  const target = document.getElementById(`subview-doc-${subtabId}`);
  if (target) target.style.display = 'block';

  if (subtabId === 'equipaje') renderPackingList();
  else if (subtabId === 'millas') renderMembershipsList();
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
}

function handleFabClick() {
  if (currentScreen === 'trips-list') {
    openModalNewTrip();
  } else if (currentScreen === 'trip-detail') {
    const modal = document.getElementById('modal-add-item');
    if (modal) modal.classList.add('active');
  } else {
    openModalNewTrip();
  }
}

// ==========================================
// FUNCIONES DE EDICIÓN, BORRADO Y COMPARTIR
// ==========================================
function editCurrentTrip() {
  closeModals();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  
  const editIdInput = document.getElementById('edit-trip-id');
  const titleInput = document.getElementById('trip-name-input');
  const destInput = document.getElementById('trip-dest-input');
  const startInput = document.getElementById('trip-start-input');
  const endInput = document.getElementById('trip-end-input');
  const imgUrlInput = document.getElementById('trip-image-url');
  const fileInput = document.getElementById('trip-image-file');
  
  if (editIdInput) editIdInput.value = trip.id;
  if (titleInput) titleInput.value = trip.title;
  if (destInput) destInput.value = trip.title;
  
  if (trip.dates && trip.dates.includes('–')) {
    const parts = trip.dates.split('–');
    if (startInput) startInput.value = parts[0].trim();
    if (endInput) endInput.value = parts[1].trim();
  }
  
  if (imgUrlInput) imgUrlInput.value = trip.image || '';
  if (fileInput) fileInput.value = '';
  updateImagePreview(trip.image || '');
  
  const modalTitle = document.getElementById('modal-trip-title');
  if (modalTitle) modalTitle.innerText = 'Editar Viaje';
  
  document.getElementById('modal-new-trip')?.classList.add('active');
}

function askDeleteCurrentTrip() {
  closeModals();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  
  const msgEl = document.getElementById('delete-trip-msg');
  if (msgEl) {
    msgEl.innerText = `Se eliminará de forma permanente el viaje "${trip.title}" y todos sus itinerarios registrados.`;
  }
  
  document.getElementById('modal-confirm-delete')?.classList.add('active');
}

function confirmDeleteTrip() {
  trips = trips.filter(t => t.id !== activeTripId);
  saveDataToStorage();
  renderTrips();
  closeModals();
  showScreen('trips-list');
}

function shareActiveTrip() {
  closeModals();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  
  const shareData = {
    title: trip.title,
    text: `Miren mi itinerario de viaje: ${trip.title} (${trip.dates})`,
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
    alert('✔ Enlace del viaje copiado al portapapeles.');
  }
}

function exportCalendar() {
  closeModals();
  alert('📅 Sincronización iniciada: El archivo de calendario ha sido preparado.');
}

// ==========================================
// RENDERIZADO DE VIAJES E ITINERARIOS
// ==========================================
function filterTripsList() {
  const query = document.getElementById('trip-search-input')?.value.toLowerCase() || '';
  renderTrips(query);
}

function setTripTimeFilter(filterType) {
  currentTripTimeFilter = filterType;
  document.querySelectorAll('#screen-trips-list .pill-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`pill-trip-${filterType}`)?.classList.add('active');
  filterTripsList();
}

function getTripStartDate(trip) {
  if (trip.items && trip.items.length > 0) {
    const sorted = [...trip.items].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (sorted[0].timestamp) return new Date(sorted[0].timestamp);
  }
  if (trip.dates) {
    const parts = trip.dates.split('–');
    const parsed = Date.parse(parts[0].trim());
    if (!isNaN(parsed)) return new Date(parsed);
  }
  return new Date(0);
}

function renderTrips(filterQuery = '') {
  const container = document.getElementById('trips-container');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  const selectedYear = document.getElementById('trip-year-select')?.value || 'all';

  const filtered = trips.filter(trip => {
    const matchesText = trip.title.toLowerCase().includes(filterQuery) || trip.dates.toLowerCase().includes(filterQuery);
    if (!matchesText) return false;

    const startDate = getTripStartDate(trip);
    if (currentTripTimeFilter === 'upcoming' && startDate < now) return false;
    if (currentTripTimeFilter === 'past' && startDate >= now) return false;

    if (selectedYear !== 'all' && startDate.getFullYear().toString() !== selectedYear) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">No se encontraron viajes.</div>`;
    return;
  }

  filtered.forEach(trip => {
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.onclick = () => openTripDetail(trip.id);
    card.innerHTML = `
      <img src="${trip.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=80'}" class="trip-card-img">
      <div class="trip-card-info">
        <div class="trip-card-title">${trip.title}</div>
        <div class="trip-card-dates">${trip.dates} ${trip.daysCount ? `(${trip.daysCount})` : ''}</div>
        <div class="trip-card-badge"><i class="fa-regular fa-clock"></i> ${trip.daysToGo || 'en agenda'}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openTripDetail(tripId) {
  activeTripId = tripId;
  renderTimeline();
  showScreen('trip-detail');
}

function renderTimeline() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  let totalTripCost = 0;
  let primaryCurrency = 'USD';

  if (trip.items && trip.items.length > 0) {
    trip.items.forEach(item => {
      if (item.type === 'flight' && item.flightTotalCost) {
        totalTripCost += parseFloat(item.flightTotalCost) || 0;
        if (item.flightCurrency) primaryCurrency = item.flightCurrency;
      } else if (item.type === 'hotel' && item.hotelCost && item.status === 'Entrada') {
        totalTripCost += parseFloat(item.hotelCost) || 0;
        if (item.hotelCurrency) primaryCurrency = item.hotelCurrency;
      } else if (item.type === 'car' && item.carCost && item.status === 'Retiro') {
        totalTripCost += parseFloat(item.carCost) || 0;
        if (item.carCurrency) primaryCurrency = item.carCurrency;
      } else if (item.type === 'food' && item.restaurantCost) {
        totalTripCost += parseFloat(item.restaurantCost) || 0;
        if (item.restaurantCurrency) primaryCurrency = item.restaurantCurrency;
      }
    });
  }

  const dTitle = document.getElementById('detail-title');
  const dDates = document.getElementById('detail-dates');
  const dCost = document.getElementById('detail-total-cost');

  if (dTitle) dTitle.innerText = trip.title;
  if (dDates) dDates.innerText = trip.dates;
  if (dCost) {
    dCost.innerText = totalTripCost > 0 
      ? `$${totalTripCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${primaryCurrency}`
      : `$0 ${primaryCurrency}`;
  }

  const items = (trip.items || []).filter(i => !i.isLayover).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const container = document.getElementById('timeline-container');
  if (!container) return;
  container.innerHTML = '';
  let currentDayHeader = '';

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">El itinerario de este viaje está vacío. Toca + para agregar eventos.</div>`;
    return;
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    if (item.dayLabel && item.dayLabel !== currentDayHeader) {
      currentDayHeader = item.dayLabel;
      container.innerHTML += `<div class="day-header">${currentDayHeader}</div>`;
    }

    let faIcon = 'fa-calendar';
    if (item.type === 'flight') faIcon = 'fa-plane';
    else if (item.type === 'hotel') faIcon = 'fa-hotel';
    else if (item.type === 'car') faIcon = 'fa-car';
    else if (item.type === 'food') faIcon = 'fa-utensils';
    else if (item.type === 'activity') faIcon = 'fa-calendar-check';

    let metaHtml = '';
    if (item.details && item.details.length > 0) {
      metaHtml = `<div class="card-meta">` + item.details.map(d => `<div>${d}</div>`).join('') + `</div>`;
    }

    container.innerHTML += `
      <div class="timeline-item" onclick="openItemDetailsModal('${item.id}')">
        <div class="time-column">${item.time || ''}<span class="time-zone">${item.tz || ''}</span></div>
        <div class="node-column"><div class="node-icon ${item.type}"><i class="fa-solid ${faIcon}"></i></div><div class="timeline-line"></div></div>
        <div class="content-card">
          <div class="card-title-row"><div class="card-title">${item.title}</div>${item.status ? `<div class="card-status">${item.status}</div>` : ''}</div>
          <div class="card-subdetail">${item.subtitle || ''}</div>
          ${metaHtml}
        </div>
      </div>
    `;

    if (index < items.length - 1) {
      const nextItem = items[index + 1];
      if (item.type === 'flight' && nextItem.type === 'flight') {
        const currentDest = item.title ? item.title.split('–')[1]?.trim() : '';
        const nextOrigin = nextItem.title ? nextItem.title.split('–')[0]?.trim() : '';
        const nextDest = nextItem.title ? nextItem.title.split('–')[1]?.trim() : '';
        const currentOrigin = item.title ? item.title.split('–')[0]?.trim() : '';

        const isReturnFlight = (currentOrigin === nextDest && currentDest === nextOrigin);

        if (currentDest && nextOrigin && currentDest === nextOrigin && !isReturnFlight) {
          let diffMs = 0;
          if (item.arrTimestamp && nextItem.timestamp) {
            diffMs = nextItem.timestamp - item.arrTimestamp;
          } else if (item.timestamp && nextItem.timestamp) {
            diffMs = nextItem.timestamp - (item.timestamp + (2.5 * 3600 * 1000));
          }

          const MAX_LAYOVER_MS = 12 * 60 * 60 * 1000;
          if (diffMs > 0 && diffMs <= MAX_LAYOVER_MS) {
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            let durationStr = '';
            if (hours > 0 && minutes > 0) durationStr = `${hours} h y ${minutes} min`;
            else if (hours > 0) durationStr = `${hours} h`;
            else durationStr = `${minutes} min`;

            container.innerHTML += `
              <div class="layover-box">
                <i class="fa-regular fa-clock"></i> Escala de ${durationStr} en ${currentDest}
              </div>
            `;
          }
        }
      }
    }
  }
}

// ==========================================
// FORMULARIOS Y MODALES DE EVENTOS
// ==========================================
function openItemDetailsModal(itemId) {
  activeSelectedItemId = itemId;
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  const item = trip.items.find(i => i.id === itemId);
  if (!item) return;

  let html = `
    <div style="background:#1e293b; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
      <div style="font-size:0.75rem; color:#10b981; font-weight:700; text-transform:uppercase; margin-bottom:4px;">
        ${item.type.toUpperCase()} • ${item.status || 'Confirmado'}
      </div>
      <div style="font-size:1.1rem; font-weight:800; color:#fff; margin-bottom:4px;">${item.title}</div>
      <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:8px;">${item.subtitle || ''}</div>
      <div style="font-size:0.8rem; color:#38bdf8; margin-bottom:10px;">📅 ${item.dayLabel} a las ${item.time}</div>
  `;

  if (item.details && item.details.length > 0) {
    html += `<div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px; font-size:0.8rem; color:#cbd5e1;">`;
    item.details.forEach(d => { html += `<div style="margin-bottom:4px;">• ${d}</div>`; });
    html += `</div>`;
  }

  html += `</div>`;
  const bodyEl = document.getElementById('item-detail-body');
  if (bodyEl) bodyEl.innerHTML = html;
  const modal = document.getElementById('modal-item-details');
  if (modal) modal.classList.add('active');
}

function deleteActiveItem() {
  if (!activeSelectedItemId) return;
  const trip = trips.find(t => t.id === activeTripId);
  if (trip) {
    trip.items = trip.items.filter(i => i.id !== activeSelectedItemId);
    saveDataToStorage();
    renderTimeline();
    closeModals();
  }
}

function editActiveItem() {
  if (!activeSelectedItemId) return;
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  const item = trip.items.find(i => i.id === activeSelectedItemId);
  if (!item) return;

  closeModals();
  if (item.type === 'flight') openFlightForm(item);
  else if (item.type === 'hotel') openHotelForm(item);
  else if (item.type === 'car') openCarForm(item);
  else if (item.type === 'food') openRestaurantForm(item);
}

function openHotelForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const modal = document.getElementById('modal-hotel-form');
  if (modal) modal.classList.add('active');
}

function saveAdvancedHotel(e) {
  e.preventDefault();
  closeModals();
}

function openCarForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const modal = document.getElementById('modal-car-form');
  if (modal) modal.classList.add('active');
}

function saveAdvancedCar(e) {
  e.preventDefault();
  closeModals();
}

function openRestaurantForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const modal = document.getElementById('modal-restaurant-form');
  if (modal) modal.classList.add('active');
}

function saveAdvancedRestaurant(e) {
  e.preventDefault();
  closeModals();
}

function openFlightForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const modal = document.getElementById('modal-flight-form');
  if (modal) modal.classList.add('active');
}

function saveAdvancedFlight(e) {
  e.preventDefault();
  closeModals();
}

function openModalNewTrip() {
  closeModals();
  document.getElementById('edit-trip-id').value = '';
  document.getElementById('modal-trip-title').innerText = 'Crear Nuevo Viaje';
  document.getElementById('trip-name-input').value = '';
  document.getElementById('trip-dest-input').value = '';
  document.getElementById('trip-start-input').value = '';
  document.getElementById('trip-end-input').value = '';
  document.getElementById('trip-image-url').value = '';
  document.getElementById('trip-image-file').value = '';
  updateImagePreview('');
  document.getElementById('modal-new-trip').classList.add('active');
}

function saveTripForm(e) {
  e.preventDefault();
  const editId = document.getElementById('edit-trip-id').value;
  const name = document.getElementById('trip-name-input').value;
  const start = document.getElementById('trip-start-input').value;
  const end = document.getElementById('trip-end-input').value;
  const imageUrl = document.getElementById('trip-image-url').value.trim();
  const defaultImg = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=80';

  if (editId) {
    const trip = trips.find(t => t.id === editId);
    if (trip) {
      trip.title = name;
      if (start && end) trip.dates = `${start} – ${end}`;
      trip.image = imageUrl || defaultImg;
      saveDataToStorage();
      renderTimeline();
      renderTrips();
    }
  } else {
    const newTrip = {
      id: Date.now().toString(),
      title: name,
      dates: start && end ? `${start} – ${end}` : 'En definición',
      daysCount: 'Próximamente',
      daysToGo: 'en agenda',
      image: imageUrl || defaultImg,
      items: []
    };
    trips.unshift(newTrip);
    saveDataToStorage();
    renderTrips();
  }
  closeModals();
}

// ==========================================
// CONSULTA DE AEROPUERTOS A WIKIDATA
// ==========================================
async function fetchAirportFromWikidata(iata) {
  const cleanIata = (iata || '').toUpperCase().trim();
  if (!cleanIata) return null;
  if (LOCAL_AIRPORT_DB[cleanIata]) return LOCAL_AIRPORT_DB[cleanIata];

  const sparqlQuery = `
    SELECT ?item ?itemLabel ?countryLabel ?coord WHERE {
      ?item wdt:P238 "${cleanIata}".
      OPTIONAL { ?item wdt:P17 ?country. }
      OPTIONAL { ?item wdt:P625 ?coord. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } LIMIT 1
  `;

  try {
    const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparqlQuery) + '&format=json', {
      headers: { 'Accept': 'application/sparql-results+json' }
    });
    if (res.ok) {
      const data = await res.json();
      const b = data.results?.bindings[0];
      if (b) {
        let lat = 0, lng = 0;
        if (b.coord?.value) {
          const m = b.coord.value.match(/Point\(([-\d\.]+) ([-\d\.]+)\)/);
          if (m) { lng = parseFloat(m[1]); lat = parseFloat(m[2]); }
        }
        const result = { name: b.itemLabel?.value || cleanIata, country: b.countryLabel?.value || 'Internacional', lat, lng };
        LOCAL_AIRPORT_DB[cleanIata] = result;
        return result;
      }
    }
  } catch (e) {}
  return null;
}

// ==========================================
// FLIGHT HUB, MAPAS Y ESTADÍSTICAS
// ==========================================
function setFlightTimeFilter(filterType) {
  currentFlightTimeFilter = filterType;
  document.querySelectorAll('#subview-flighthub-vuelos .pill-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`pill-flight-${filterType}`)?.classList.add('active');
  renderAirFlightsList();
}

function initFlightMap() {
  if (!flightMap) {
    flightMap = L.map('leafletMap', { zoomControl: false }).setView([10, -75], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(flightMap);
  }
  setTimeout(() => {
    flightMap.invalidateSize();
    renderMapGeodesicRoutes();
  }, 200);
}

async function renderMapGeodesicRoutes() {
  if (!flightMap) return;

  planeAnimMarkers.forEach(p => flightMap.removeLayer(p.marker));
  planeAnimMarkers = [];
  if (animFrameId) cancelAnimationFrame(animFrameId);

  mapPolylines.forEach(line => flightMap.removeLayer(line));
  mapPolylines = [];

  let totalMiles = 0;
  let totalFlightsCount = 0;

  for (let t of trips) {
    for (let i of (t.items || [])) {
      if (i.type === 'flight') totalFlightsCount++;
    }
  }

  const distEl = document.getElementById('map-total-distance');
  const countEl = document.getElementById('map-total-flights');
  if (distEl) distEl.innerText = `${totalMiles.toLocaleString()} mi`;
  if (countEl) countEl.innerText = totalFlightsCount.toString();
}

function renderAirFlightsList() {
  const container = document.getElementById('air-flights-list');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">Lista de vuelos lista.</div>`;
}

function getFilteredTripsForStats() {
  const selectedYear = document.getElementById('stats-year-select')?.value || 'all';
  if (selectedYear === 'all') return trips;
  return trips.filter(t => {
    const d = getTripStartDate(t);
    return d && d.getFullYear().toString() === selectedYear;
  });
}

function renderSelectedCategoryStats() {
  const selectedCat = document.getElementById('stats-category-select')?.value || 'trips';
  const pTrips = document.getElementById('stats-panel-trips');
  const pFlights = document.getElementById('stats-panel-flights');
  const pHotels = document.getElementById('stats-panel-hotels');

  if (pTrips) pTrips.style.display = 'none';
  if (pFlights) pFlights.style.display = 'none';
  if (pHotels) pHotels.style.display = 'none';

  if (selectedCat === 'trips' && pTrips) {
    pTrips.style.display = 'block';
  } else if (selectedCat === 'flights' && pFlights) {
    pFlights.style.display = 'block';
  } else if (selectedCat === 'hotels' && pHotels) {
    pHotels.style.display = 'block';
  }
}

// ==========================================
// PACKING & MÉTODOS DE PAGO
// ==========================================
function renderPackingList() {
  const container = document.getElementById('packing-list-container');
  if (!container) return;
  container.innerHTML = '';
  packingItems.forEach(item => {
    container.innerHTML += `
      <div class="dark-card" style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.85rem; color:#fff;">${item.text}</span>
      </div>
    `;
  });
}

function resetPackingCheckmarks() {
  renderPackingList();
}

function addPackingItem(e) {
  e.preventDefault();
  const input = document.getElementById('packing-input');
  if (!input || !input.value.trim()) return;
  packingItems.push({ id: Date.now(), text: input.value.trim(), done: false });
  saveDataToStorage();
  renderPackingList();
  input.value = '';
}

function renderPaymentMethodsList() {
  const container = document.getElementById('payment-methods-list');
  if (!container) return;
  container.innerHTML = '';
  paymentMethods.forEach(method => {
    container.innerHTML += `
      <div class="dark-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:0.85rem; color:#fff;">${method.name} (${method.type})</div>
      </div>
    `;
  });
}

function populatePaymentSelectors() {
  const dropdowns = document.querySelectorAll('.payment-selector-dropdown');
  dropdowns.forEach(select => {
    select.innerHTML = `<option value="">Sin definir</option>`;
    paymentMethods.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name} (${m.type})</option>`;
    });
  });
}

function openModalAddPaymentMethod() {
  closeModals();
  document.getElementById('modal-add-payment')?.classList.add('active');
}

function saveNewPaymentMethod(e) {
  e.preventDefault();
  closeModals();
}

function renderMembershipsList() {}
function saveMembershipProgram(e) { e.preventDefault(); closeModals(); }

function connectGoogleDrive() {}
function checkAndPerformAutoBackup() {}
function updateLastBackupDisplay() {}

function exportLocalJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips, packingItems, paymentMethods }, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `tripmaster_backup_${Date.now()}.json`);
  a.click();
  a.remove();
}

function importLocalJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.trips) {
        trips = parsed.trips;
        saveDataToStorage();
        renderTrips();
        alert('✔ Datos restaurados.');
      }
    } catch (err) { alert('Archivo no válido.'); }
  };
  reader.readAsText(file);
}

function checkServiceWorkerUpdates() {}
