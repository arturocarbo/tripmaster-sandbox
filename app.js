// ==========================================
// TRIPMASTER PRO - ENGINE COMPLETO INTEGRADO
// ==========================================

let flightMap = null;
let planeAnimMarkers = [];
let mapPolylines = [];
let animFrameId = null;
let airlinesChartObj = null;

let currentTripTimeFilter = 'all';
let currentFlightTimeFilter = 'all';

const GOOGLE_CLIENT_ID = '3946661722-akjk1dp0slafuu03bdc3hehibbe952og.apps.googleusercontent.com';
let tokenClient = null;
let driveAccessToken = null;

let activeSelectedItemId = null;

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
    populateYearDropdowns();
    checkAndPerformAutoBackup();
  } catch (e) { console.error("Error guardando datos:", e); }
}

function loadDataFromStorage() {
  try {
    const storedTrips = localStorage.getItem('tripmaster_trips');
    const storedPacking = localStorage.getItem('tripmaster_packing');
    const storedPayments = localStorage.getItem('tripmaster_payments');

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

    updateLastBackupDisplay();
    renderPaymentMethodsList();
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
    tripSelect.innerHTML = `<option value="all">📅 Año: Todos</option>`;
    sortedYears.forEach(y => { tripSelect.innerHTML += `<option value="${y}">📅 ${y}</option>`; });
    if (currTripVal && Array.from(tripSelect.options).some(o => o.value === currTripVal)) {
      tripSelect.value = currTripVal;
    }
  }

  if (statsSelect) {
    const currStatsVal = statsSelect.value;
    statsSelect.innerHTML = `<option value="all">Todos</option>`;
    sortedYears.forEach(y => { statsSelect.innerHTML += `<option value="${y}">${y}</option>`; });
    if (currStatsVal && Array.from(statsSelect.options).some(o => o.value === currStatsVal)) {
      statsSelect.value = currStatsVal;
    }
  }
}

// NAVEGACIÓN Y PANTALLAS
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');
  currentScreen = screenId;

  if (screenId === 'flight-stats') initFlightMap();
}

function switchTab(screenId, titleName = '') {
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');

  if (screenId === 'placeholder') {
    const pTitle = document.getElementById('placeholder-title');
    if (pTitle) pTitle.innerText = titleName;
  }
  showScreen(screenId);
}

function toggleDropdown(event, menuId) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isVisible = menu.classList.contains('active');
  closeModals();
  if (!isVisible) menu.classList.add('active');
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-menu') && !e.target.closest('.action-icon-btn')) {
    closeModals();
  }
});

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

// RENDERIZADO DE VIAJES E ITINERARIO
function filterTripsList() {
  const query = document.getElementById('trip-search-input')?.value.toLowerCase() || '';
  renderTrips(query);
}

function setTripTimeFilter(filterType) {
  currentTripTimeFilter = filterType;
  document.querySelectorAll('#screen-trips-list .pill-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`pill-trip-${filterType}`);
  if (btn) btn.classList.add('active');
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

    if (selectedYear !== 'all') {
      if (startDate.getFullYear().toString() !== selectedYear) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">No se encontraron viajes en esta categoría o año.</div>`;
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
                <i class="fa-regular fa-clock"></i> Parada de ${durationStr} en ${currentDest}
              </div>
            `;
          }
        }
      }
    }
  }
}

// FORMULARIOS Y GESTIÓN DE EVENTOS DEL ITINERARIO
function openItemDetailsModal(itemId) {
  activeSelectedItemId = itemId;
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  const item = trip.items.find(i => i.id === itemId);
  if (!item) return;

  const titleEl = document.getElementById('item-detail-title');
  if (titleEl) titleEl.innerText = item.title;

  let html = `
    <div style="background:#1e293b; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
      <div style="font-size:0.75rem; color:#10b981; font-weight:700; text-transform:uppercase; margin-bottom:4px;">
        ${item.type.toUpperCase()} • ${item.status || 'Confirmado'}
      </div>
      <div style="font-size:1.1rem; font-weight:800; color:#fff; margin-bottom:4px;">${item.title}</div>
      <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:8px;">${item.subtitle || ''}</div>
      <div style="font-size:0.8rem; color:#38bdf8; margin-bottom:10px;">📅 ${item.dayLabel} a las ${item.time}</div>
  `;

  if (item.paymentMethodId) {
    const payLbl = getPaymentMethodLabel(item.paymentMethodId);
    if (payLbl) {
      html += `<div style="font-size:0.75rem; color:#ffb703; font-weight:700; margin-bottom:8px;"><i class="fa-solid fa-credit-card"></i> Pagado con: ${payLbl}</div>`;
    }
  }

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
    const item = trip.items.find(i => i.id === activeSelectedItemId);
    if (item && item.hotelGroupId) {
      trip.items = trip.items.filter(i => i.hotelGroupId !== item.hotelGroupId);
    } else if (item && item.carGroupId) {
      trip.items = trip.items.filter(i => i.carGroupId !== item.carGroupId);
    } else {
      trip.items = trip.items.filter(i => i.id !== activeSelectedItemId);
    }
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

  if (item.type === 'flight') {
    document.getElementById('flight-form-modal-title').innerText = '✏ Editar Vuelo';
    document.getElementById('edit-item-id').value = item.id;

    const ports = item.title ? item.title.split('–') : ['', ''];
    document.getElementById('flight-origin').value = ports[0] ? ports[0].trim() : '';
    document.getElementById('flight-dest').value = ports[1] ? ports[1].trim() : '';

    const flightMatch = item.subtitle ? item.subtitle.match(/^(.*?)\s*\((.*?)\)$/) : null;
    if (flightMatch) {
      document.getElementById('flight-no').value = flightMatch[1];
      document.getElementById('flight-airline').value = flightMatch[2];
    } else {
      document.getElementById('flight-no').value = item.subtitle || '';
    }

    if (item.timestamp) {
      const dt = new Date(item.timestamp);
      document.getElementById('flight-dep-time').value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    if (item.arrTimestamp) {
      const arrDt = new Date(item.arrTimestamp);
      document.getElementById('flight-arr-time').value = new Date(arrDt.getTime() - (arrDt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    document.getElementById('flight-total-cost').value = item.flightTotalCost || '';
    document.getElementById('flight-fare-cost').value = item.flightFareCost || '';
    document.getElementById('flight-currency').value = item.flightCurrency || 'USD';
    document.getElementById('flight-payment-method').value = item.paymentMethodId || '';

    document.getElementById('modal-flight-form').classList.add('active');
  } else if (item.type === 'hotel') {
    openHotelForm(item);
  } else if (item.type === 'car') {
    openCarForm(item);
  } else if (item.type === 'food') {
    openRestaurantForm(item);
  } else {
    document.getElementById('generic-edit-item-id').value = item.id;
    document.getElementById('generic-item-type').value = item.type;
    document.getElementById('generic-form-title').innerText = `✏ Editar ${item.type}`;
    document.getElementById('generic-title').value = item.title;
    document.getElementById('generic-sub').value = item.subtitle || '';
    document.getElementById('generic-payment-method').value = item.paymentMethodId || '';

    if (item.timestamp) {
      const dt = new Date(item.timestamp);
      document.getElementById('generic-time').value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    document.getElementById('modal-generic-form').classList.add('active');
  }
}

// RESTAURANTE, HOTEL, VUELO Y AUTO FORMS
function openHotelForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const formTitle = document.getElementById('hotel-form-modal-title');
  const editIdInput = document.getElementById('edit-hotel-item-id');
  const nameInput = document.getElementById('hotel-name');
  const checkinInput = document.getElementById('hotel-checkin');
  const checkoutInput = document.getElementById('hotel-checkout');
  const costInput = document.getElementById('hotel-cost');
  const currInput = document.getElementById('hotel-currency');
  const payInput = document.getElementById('hotel-payment-method');
  const addrInput = document.getElementById('hotel-address');

  if (existingItem) {
    formTitle.innerText = '✏ Editar Hotel';
    editIdInput.value = existingItem.hotelGroupId || existingItem.id;
    nameInput.value = (existingItem.title || '').replace(/^Check-in:\s*/i, '').replace(/^Check-out:\s*/i, '');

    if (existingItem.hotelCheckinTimestamp || existingItem.timestamp) {
      const dt = new Date(existingItem.hotelCheckinTimestamp || existingItem.timestamp);
      checkinInput.value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    if (existingItem.hotelCheckoutTimestamp || existingItem.arrTimestamp) {
      const arrDt = new Date(existingItem.hotelCheckoutTimestamp || existingItem.arrTimestamp);
      checkoutInput.value = new Date(arrDt.getTime() - (arrDt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    costInput.value = existingItem.hotelCost || '';
    currInput.value = existingItem.hotelCurrency || 'USD';
    payInput.value = existingItem.paymentMethodId || '';
    addrInput.value = existingItem.hotelAddress || '';
  } else {
    formTitle.innerText = '🏨 Registrar Hotel';
    editIdInput.value = '';
    nameInput.value = '';
    checkinInput.value = '';
    checkoutInput.value = '';
    costInput.value = '';
    currInput.value = 'USD';
    payInput.value = '';
    addrInput.value = '';
  }

  document.getElementById('modal-hotel-form').classList.add('active');
}

function saveAdvancedHotel(e) {
  e.preventDefault();
  const editGroupId = document.getElementById('edit-hotel-item-id').value;
  const hotelName = document.getElementById('hotel-name').value.trim();
  const checkinVal = document.getElementById('hotel-checkin').value;
  const checkoutVal = document.getElementById('hotel-checkout').value;
  const costVal = parseFloat(document.getElementById('hotel-cost').value) || 0;
  const currencyVal = document.getElementById('hotel-currency').value;
  const paymentVal = document.getElementById('hotel-payment-method').value;
  const addressVal = document.getElementById('hotel-address').value.trim();

  const checkinDt = new Date(checkinVal);
  const checkoutDt = new Date(checkoutVal);
  const checkinTimestamp = checkinDt.getTime();
  const checkoutTimestamp = checkoutDt.getTime();

  const diffMs = checkoutTimestamp - checkinTimestamp;
  const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const costPerNight = costVal > 0 ? (costVal / nights).toFixed(2) : 0;

  const checkinTimeStr = checkinDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const checkinDayStr = checkinDt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  const checkoutTimeStr = checkoutDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const checkoutDayStr = checkoutDt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  let detailsCheckin = [`Estadía Total: ${nights} ${nights === 1 ? 'noche' : 'noches'}`];
  if (costVal > 0) {
    detailsCheckin.push(`Costo Total: ${costVal.toFixed(2)} ${currencyVal}`);
    detailsCheckin.push(`Costo por Noche: ${costPerNight} ${currencyVal}/noche`);
  }
  if (paymentVal) {
    const payLbl = getPaymentMethodLabel(paymentVal);
    if (payLbl) detailsCheckin.push(`Pago: ${payLbl}`);
  }
  if (addressVal) detailsCheckin.push(`Dirección: ${addressVal}`);

  let detailsCheckout = [`Finaliza estadía de ${nights} ${nights === 1 ? 'noche' : 'noches'}`];
  if (addressVal) detailsCheckout.push(`Ubicación: ${addressVal}`);

  const groupId = editGroupId || ('hotel-group-' + Date.now());
  const activeTrip = trips.find(t => t.id === activeTripId);

  if (activeTrip) {
    if (editGroupId) {
      activeTrip.items = activeTrip.items.filter(i => i.hotelGroupId !== editGroupId && i.id !== editGroupId);
    }

    activeTrip.items.push({
      id: groupId + '-checkin',
      hotelGroupId: groupId,
      timestamp: checkinTimestamp,
      arrTimestamp: checkoutTimestamp,
      hotelCheckinTimestamp: checkinTimestamp,
      hotelCheckoutTimestamp: checkoutTimestamp,
      dayLabel: checkinDayStr,
      time: checkinTimeStr,
      tz: 'LOCAL',
      type: 'hotel',
      title: `Check-in: ${hotelName}`,
      status: 'Entrada',
      subtitle: `Entrada al alojamiento (${nights} ${nights === 1 ? 'noche' : 'noches'})`,
      details: detailsCheckin,
      hotelCost: costVal,
      hotelCurrency: currencyVal,
      paymentMethodId: paymentVal,
      hotelAddress: addressVal
    });

    activeTrip.items.push({
      id: groupId + '-checkout',
      hotelGroupId: groupId,
      timestamp: checkoutTimestamp,
      arrTimestamp: checkoutTimestamp,
      hotelCheckinTimestamp: checkinTimestamp,
      hotelCheckoutTimestamp: checkoutTimestamp,
      dayLabel: checkoutDayStr,
      time: checkoutTimeStr,
      tz: 'LOCAL',
      type: 'hotel',
      title: `Check-out: ${hotelName}`,
      status: 'Salida',
      subtitle: `Salida del alojamiento`,
      details: detailsCheckout,
      hotelCost: costVal,
      hotelCurrency: currencyVal,
      paymentMethodId: paymentVal,
      hotelAddress: addressVal
    });

    saveDataToStorage();
    renderTimeline();
  }

  closeModals();
  e.target.reset();
}

function openCarForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const formTitle = document.getElementById('car-form-modal-title');
  const editIdInput = document.getElementById('edit-car-item-id');
  const compInput = document.getElementById('car-company');
  const modelInput = document.getElementById('car-model');
  const pickupInput = document.getElementById('car-pickup');
  const dropoffInput = document.getElementById('car-dropoff');
  const costInput = document.getElementById('car-cost');
  const currInput = document.getElementById('car-currency');
  const payInput = document.getElementById('car-payment-method');
  const locInput = document.getElementById('car-location');
  const codeInput = document.getElementById('car-code');

  if (existingItem) {
    formTitle.innerText = '✏ Editar Alquiler de Auto';
    editIdInput.value = existingItem.carGroupId || existingItem.id;
    compInput.value = existingItem.carCompany || '';
    modelInput.value = existingItem.carModel || '';

    if (existingItem.carPickupTimestamp || existingItem.timestamp) {
      const dt = new Date(existingItem.carPickupTimestamp || existingItem.timestamp);
      pickupInput.value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    if (existingItem.carDropoffTimestamp || existingItem.arrTimestamp) {
      const dt = new Date(existingItem.carDropoffTimestamp || existingItem.arrTimestamp);
      dropoffInput.value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    costInput.value = existingItem.carCost || '';
    currInput.value = existingItem.carCurrency || 'USD';
    payInput.value = existingItem.paymentMethodId || '';
    locInput.value = existingItem.carLocation || '';
    codeInput.value = existingItem.carCode || '';
  } else {
    formTitle.innerText = '🚗 Alquiler de Vehículo';
    editIdInput.value = '';
    compInput.value = '';
    modelInput.value = '';
    pickupInput.value = '';
    dropoffInput.value = '';
    costInput.value = '';
    currInput.value = 'USD';
    payInput.value = '';
    locInput.value = '';
    codeInput.value = '';
  }

  document.getElementById('modal-car-form').classList.add('active');
}

function saveAdvancedCar(e) {
  e.preventDefault();
  const editGroupId = document.getElementById('edit-car-item-id').value;
  const company = document.getElementById('car-company').value.trim();
  const model = document.getElementById('car-model').value.trim();
  const pickupVal = document.getElementById('car-pickup').value;
  const dropoffVal = document.getElementById('car-dropoff').value;
  const costVal = parseFloat(document.getElementById('car-cost').value) || 0;
  const currencyVal = document.getElementById('car-currency').value;
  const paymentVal = document.getElementById('car-payment-method').value;
  const locationVal = document.getElementById('car-location').value.trim();
  const codeVal = document.getElementById('car-code').value.trim();

  const pickupDt = new Date(pickupVal);
  const dropoffDt = new Date(dropoffVal);
  const pickupTimestamp = pickupDt.getTime();
  const dropoffTimestamp = dropoffDt.getTime();

  const diffMs = dropoffTimestamp - pickupTimestamp;
  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  const pickupTimeStr = pickupDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pickupDayStr = pickupDt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  const dropoffTimeStr = dropoffDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dropoffDayStr = dropoffDt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  let detailsPickup = [`Vehículo: ${model}`, `Alquiler Total: ${days} ${days === 1 ? 'día' : 'días'}`];
  if (costVal > 0) detailsPickup.push(`Costo Total: ${costVal.toFixed(2)} ${currencyVal}`);
  if (paymentVal) {
    const payLbl = getPaymentMethodLabel(paymentVal);
    if (payLbl) detailsPickup.push(`Pago: ${payLbl}`);
  }
  if (locationVal) detailsPickup.push(`Oficina / Retiro: ${locationVal}`);
  if (codeVal) detailsPickup.push(`Código Reserva: ${codeVal}`);

  let detailsDropoff = [`Vehículo: ${model}`, `Devolución tras ${days} ${days === 1 ? 'día' : 'días'}`];
  if (locationVal) detailsDropoff.push(`Oficina Devolución: ${locationVal}`);

  const groupId = editGroupId || ('car-group-' + Date.now());
  const activeTrip = trips.find(t => t.id === activeTripId);

  if (activeTrip) {
    if (editGroupId) {
      activeTrip.items = activeTrip.items.filter(i => i.carGroupId !== editGroupId && i.id !== editGroupId);
    }

    activeTrip.items.push({
      id: groupId + '-pickup',
      carGroupId: groupId,
      timestamp: pickupTimestamp,
      arrTimestamp: dropoffTimestamp,
      carPickupTimestamp: pickupTimestamp,
      carDropoffTimestamp: dropoffTimestamp,
      dayLabel: pickupDayStr,
      time: pickupTimeStr,
      tz: 'LOCAL',
      type: 'car',
      title: `Retiro: ${company}`,
      status: 'Retiro',
      subtitle: `${model} (${days} ${days === 1 ? 'día' : 'días'})`,
      details: detailsPickup,
      carCost: costVal,
      carCurrency: currencyVal,
      paymentMethodId: paymentVal,
      carCompany: company,
      carModel: model,
      carLocation: locationVal,
      carCode: codeVal
    });

    activeTrip.items.push({
      id: groupId + '-dropoff',
      carGroupId: groupId,
      timestamp: dropoffTimestamp,
      arrTimestamp: dropoffTimestamp,
      carPickupTimestamp: pickupTimestamp,
      carDropoffTimestamp: dropoffTimestamp,
      dayLabel: dropoffDayStr,
      time: dropoffTimeStr,
      tz: 'LOCAL',
      type: 'car',
      title: `Devolución: ${company}`,
      status: 'Devolución',
      subtitle: `Entrega de ${model}`,
      details: detailsDropoff,
      carCost: costVal,
      carCurrency: currencyVal,
      paymentMethodId: paymentVal,
      carCompany: company,
      carModel: model,
      carLocation: locationVal,
      carCode: codeVal
    });

    saveDataToStorage();
    renderTimeline();
  }

  closeModals();
  e.target.reset();
}

function openRestaurantForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const formTitle = document.getElementById('restaurant-form-modal-title');
  const editIdInput = document.getElementById('edit-restaurant-item-id');
  const nameInput = document.getElementById('restaurant-name');
  const timeInput = document.getElementById('restaurant-time');
  const peopleInput = document.getElementById('restaurant-people');
  const costInput = document.getElementById('restaurant-cost');
  const currInput = document.getElementById('restaurant-currency');
  const payInput = document.getElementById('restaurant-payment-method');
  const addrInput = document.getElementById('restaurant-address');
  const notesInput = document.getElementById('restaurant-notes');

  if (existingItem) {
    formTitle.innerText = '✏ Editar Reserva / Factura de Restaurante';
    editIdInput.value = existingItem.id;
    nameInput.value = existingItem.restaurantName || existingItem.title || '';

    if (existingItem.timestamp) {
      const dt = new Date(existingItem.timestamp);
      timeInput.value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    peopleInput.value = existingItem.restaurantPeople || '';
    costInput.value = existingItem.restaurantCost || '';
    currInput.value = existingItem.restaurantCurrency || 'USD';
    payInput.value = existingItem.paymentMethodId || '';
    addrInput.value = existingItem.restaurantAddress || '';
    notesInput.value = existingItem.restaurantNotes || '';
  } else {
    formTitle.innerText = '🍽 Reserva & Factura de Restaurante';
    editIdInput.value = '';
    nameInput.value = '';
    timeInput.value = '';
    peopleInput.value = '';
    costInput.value = '';
    currInput.value = 'USD';
    payInput.value = '';
    addrInput.value = '';
    notesInput.value = '';
  }

  document.getElementById('modal-restaurant-form').classList.add('active');
}

function saveAdvancedRestaurant(e) {
  e.preventDefault();
  const editItemId = document.getElementById('edit-restaurant-item-id').value;
  const name = document.getElementById('restaurant-name').value.trim();
  const timeVal = document.getElementById('restaurant-time').value;
  const peopleVal = document.getElementById('restaurant-people').value.trim();
  const costVal = parseFloat(document.getElementById('restaurant-cost').value) || 0;
  const currencyVal = document.getElementById('restaurant-currency').value;
  const paymentVal = document.getElementById('restaurant-payment-method').value;
  const addressVal = document.getElementById('restaurant-address').value.trim();
  const notesVal = document.getElementById('restaurant-notes').value.trim();

  const dt = new Date(timeVal);
  const timestamp = dt.getTime();
  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  let detailsArr = [];
  if (peopleVal) detailsArr.push(`Mesa / Asistentes: ${peopleVal}`);
  if (costVal > 0) detailsArr.push(`Factura / Presupuesto: ${costVal.toFixed(2)} ${currencyVal}`);
  if (paymentVal) {
    const payLbl = getPaymentMethodLabel(paymentVal);
    if (payLbl) detailsArr.push(`Pago: ${payLbl}`);
  }
  if (addressVal) detailsArr.push(`Ubicación: ${addressVal}`);
  if (notesVal) detailsArr.push(`Notas: ${notesVal}`);

  const activeTrip = trips.find(t => t.id === activeTripId);
  if (activeTrip) {
    if (editItemId) {
      const existingItem = activeTrip.items.find(i => i.id === editItemId);
      if (existingItem) {
        existingItem.timestamp = timestamp;
        existingItem.dayLabel = dayStr;
        existingItem.time = timeStr;
        existingItem.title = name;
        existingItem.subtitle = peopleVal || 'Reserva Gastronómica';
        existingItem.details = detailsArr;
        existingItem.restaurantName = name;
        existingItem.restaurantPeople = peopleVal;
        existingItem.restaurantCost = costVal;
        existingItem.restaurantCurrency = currencyVal;
        existingItem.paymentMethodId = paymentVal;
        existingItem.restaurantAddress = addressVal;
        existingItem.restaurantNotes = notesVal;
      }
    } else {
      activeTrip.items.push({
        id: 'item-' + Date.now(),
        timestamp: timestamp,
        dayLabel: dayStr,
        time: timeStr,
        tz: 'LOCAL',
        type: 'food',
        title: name,
        status: 'Confirmado',
        subtitle: peopleVal || 'Reserva Gastronómica',
        details: detailsArr,
        restaurantName: name,
        restaurantPeople: peopleVal,
        restaurantCost: costVal,
        restaurantCurrency: currencyVal,
        paymentMethodId: paymentVal,
        restaurantAddress: addressVal,
        restaurantNotes: notesVal
      });
    }

    saveDataToStorage();
    renderTimeline();
  }

  closeModals();
  e.target.reset();
}

function openFlightForm() {
  closeModals();
  populatePaymentSelectors();
  document.getElementById('edit-item-id').value = '';
  document.getElementById('flight-total-cost').value = '';
  document.getElementById('flight-fare-cost').value = '';
  document.getElementById('flight-currency').value = 'USD';
  document.getElementById('flight-payment-method').value = '';
  document.getElementById('flight-form-modal-title').innerText = '✈ Registrar Vuelo';
  document.getElementById('modal-flight-form').classList.add('active');
}

function saveAdvancedFlight(e) {
  e.preventDefault();
  const editItemId = document.getElementById('edit-item-id').value;
  const flightNo = document.getElementById('flight-no').value;
  const airline = document.getElementById('flight-airline').value;
  const origin = document.getElementById('flight-origin').value.toUpperCase();
  const dest = document.getElementById('flight-dest').value.toUpperCase();
  const datetime = document.getElementById('flight-dep-time').value;
  const arrDatetime = document.getElementById('flight-arr-time').value;
  const gate = document.getElementById('flight-gate').value;
  const seat = document.getElementById('flight-seat').value;
  const code = document.getElementById('flight-code').value;

  const totalCostVal = parseFloat(document.getElementById('flight-total-cost').value) || 0;
  const fareCostVal = parseFloat(document.getElementById('flight-fare-cost').value) || 0;
  const currencyVal = document.getElementById('flight-currency').value;
  const paymentVal = document.getElementById('flight-payment-method').value;
  const taxesVal = Math.max(0, totalCostVal - fareCostVal);

  const dt = new Date(datetime);
  const timestamp = dt.getTime();
  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  let arrTimestamp = null;
  let detailsArr = [];
  if (code) detailsArr.push(`Confirmación PNR: ${code}`);
  if (seat) detailsArr.push(`Asiento: ${seat}`);
  if (gate) detailsArr.push(`Terminal / Gate: ${gate}`);
  
  if (totalCostVal > 0) {
    let costLine = `Boleto Total: ${totalCostVal.toFixed(2)} ${currencyVal}`;
    if (fareCostVal > 0) {
      costLine += ` (Fare: ${fareCostVal.toFixed(2)} | Impuestos: ${taxesVal.toFixed(2)})`;
    }
    detailsArr.push(costLine);
  }
  if (paymentVal) {
    const payLbl = getPaymentMethodLabel(paymentVal);
    if (payLbl) detailsArr.push(`Pago: ${payLbl}`);
  }

  if (arrDatetime) {
    const arrDt = new Date(arrDatetime);
    arrTimestamp = arrDt.getTime();
    detailsArr.push(`Llegada: ${arrDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  const activeTrip = trips.find(t => t.id === activeTripId);
  if (activeTrip) {
    if (editItemId) {
      const existingItem = activeTrip.items.find(i => i.id === editItemId);
      if (existingItem) {
        existingItem.timestamp = timestamp;
        existingItem.arrTimestamp = arrTimestamp;
        existingItem.dayLabel = dayStr;
        existingItem.time = timeStr;
        existingItem.title = `${origin} – ${dest}`;
        existingItem.subtitle = `${flightNo} (${airline})`;
        existingItem.details = detailsArr;
        existingItem.flightTotalCost = totalCostVal;
        existingItem.flightFareCost = fareCostVal;
        existingItem.flightTaxesCost = taxesVal;
        existingItem.flightCurrency = currencyVal;
        existingItem.paymentMethodId = paymentVal;
      }
    } else {
      activeTrip.items.push({
        id: 'item-' + Date.now(),
        timestamp: timestamp,
        arrTimestamp: arrTimestamp,
        dayLabel: dayStr,
        time: timeStr,
        tz: 'LOCAL',
        type: 'flight',
        title: `${origin} – ${dest}`,
        status: 'Programado',
        subtitle: `${flightNo} (${airline})`,
        details: detailsArr,
        flightTotalCost: totalCostVal,
        flightFareCost: fareCostVal,
        flightTaxesCost: taxesVal,
        flightCurrency: currencyVal,
        paymentMethodId: paymentVal
      });
    }
    saveDataToStorage();
    renderTimeline();
  }

  closeModals();
  e.target.reset();
}

function openGenericForm(type, titleText) {
  closeModals();
  populatePaymentSelectors();
  document.getElementById('generic-edit-item-id').value = '';
  document.getElementById('generic-item-type').value = type;
  document.getElementById('generic-form-title').innerText = titleText;
  document.getElementById('generic-payment-method').value = '';
  document.getElementById('modal-generic-form').classList.add('active');
}

function saveGenericItem(e) {
  e.preventDefault();
  const editItemId = document.getElementById('generic-edit-item-id').value;
  const type = document.getElementById('generic-item-type').value;
  const title = document.getElementById('generic-title').value;
  const datetime = document.getElementById('generic-time').value;
  const sub = document.getElementById('generic-sub').value;
  const paymentVal = document.getElementById('generic-payment-method').value;

  const dt = new Date(datetime);
  const timestamp = dt.getTime();
  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayStr = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  let detailsArr = [];
  if (paymentVal) {
    const payLbl = getPaymentMethodLabel(paymentVal);
    if (payLbl) detailsArr.push(`Pago: ${payLbl}`);
  }

  const activeTrip = trips.find(t => t.id === activeTripId);
  if (activeTrip) {
    if (editItemId) {
      const existingItem = activeTrip.items.find(i => i.id === editItemId);
      if (existingItem) {
        existingItem.timestamp = timestamp;
        existingItem.dayLabel = dayStr;
        existingItem.time = timeStr;
        existingItem.title = title;
        existingItem.subtitle = sub;
        existingItem.paymentMethodId = paymentVal;
        existingItem.details = detailsArr;
      }
    } else {
      activeTrip.items.push({
        id: 'item-' + Date.now(),
        timestamp: timestamp,
        dayLabel: dayStr,
        time: timeStr,
        tz: 'LOCAL',
        type: type,
        title: title,
        status: 'Confirmado',
        subtitle: sub,
        paymentMethodId: paymentVal,
        details: detailsArr
      });
    }
    saveDataToStorage();
    renderTimeline();
  }

  closeModals();
  e.target.reset();
}

// CREACIÓN Y EDICIÓN DE VIAJES
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
      if (imageUrl) trip.image = imageUrl;
      saveDataToStorage();
      renderTimeline();
      renderTrips();
    }
  } else {
    const newTrip = {
      id: Date.now().toString(),
      title: name,
      dates: `${start} – ${end}`,
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

function editCurrentTrip() {
  closeModals();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  document.getElementById('edit-trip-id').value = trip.id;
  document.getElementById('modal-trip-title').innerText = 'Editar Viaje';
  document.getElementById('trip-name-input').value = trip.title;
  document.getElementById('trip-dest-input').value = trip.title;
  document.getElementById('trip-image-url').value = trip.image || '';
  document.getElementById('trip-image-file').value = '';
  updateImagePreview(trip.image || '');
  document.getElementById('modal-new-trip').classList.add('active');
}

function askDeleteCurrentTrip() {
  closeModals();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  document.getElementById('delete-trip-msg').innerText = `Se eliminará el viaje "${trip.title}" y todos sus itinerarios registrados.`;
  document.getElementById('modal-confirm-delete').classList.add('active');
}

function confirmDeleteTrip() {
  trips = trips.filter(t => t.id !== activeTripId);
  saveDataToStorage();
  renderTrips();
  closeModals();
  showScreen('trips-list');
}

function shareActiveTrip() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  if (navigator.share) {
    navigator.share({ title: trip.title, text: `Echa un vistazo a mi itinerario de viaje: ${trip.title}` });
  } else {
    alert(`Enlace copiado al portapapeles.`);
  }
}

function exportCalendar() {
  closeModals();
  alert('Sincronización iniciada: El archivo .ics ha sido preparado.');
}

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

// FLIGHT HUB, MAPAS Y ESTADÍSTICAS
function switchFlightTab(subtabId) {
  document.querySelectorAll('.flight-tab-btn').forEach(b => b.classList.remove('active'));
  if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');

  document.querySelectorAll('.flight-subview').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`subview-${subtabId}`);
  if (target) target.classList.add('active');

  if (subtabId === 'mapa') initFlightMap();
  else if (subtabId === 'vuelos') renderAirFlightsList();
  else if (subtabId === 'stats') renderSelectedCategoryStats();
  else if (subtabId === 'aeropuertos') loadDefaultAirportGuide();
  else if (subtabId === 'equipaje') renderPackingList();
}

function setFlightTimeFilter(filterType) {
  currentFlightTimeFilter = filterType;
  document.querySelectorAll('#subview-vuelos .pill-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`pill-flight-${filterType}`);
  if (btn) btn.classList.add('active');
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
  let airportCounts = {};
  let airlineCounts = {};

  for (let t of trips) {
    for (let i of t.items) {
      if (i.type === 'flight') {
        totalFlightsCount++;

        if (i.subtitle) {
          const match = i.subtitle.match(/\((.*?)\)/);
          const airlineName = match ? match[1].trim() : i.subtitle.trim();
          if (airlineName) airlineCounts[airlineName] = (airlineCounts[airlineName] || 0) + 1;
        }

        const parts = i.title ? i.title.split('–') : [];
        if (parts.length === 2) {
          const origIata = parts[0].trim();
          const destIata = parts[1].trim();

          if (origIata) airportCounts[origIata] = (airportCounts[origIata] || 0) + 1;
          if (destIata) airportCounts[destIata] = (airportCounts[destIata] || 0) + 1;

          let apOrig = await fetchAirportFromWikidata(origIata);
          let apDest = await fetchAirportFromWikidata(destIata);

          if (apOrig && apDest) {
            const startPt = [apOrig.lng, apOrig.lat];
            const endPt = [apDest.lng, apDest.lat];

            const gcArc = turf.greatCircle(turf.point(startPt), turf.point(endPt), { npoints: 50 });
            const leafletCoords = gcArc.geometry.coordinates.map(c => [c[1], c[0]]);

            const polylineLayer = L.polyline(leafletCoords, { color: '#0084ff', weight: 3, opacity: 0.8 }).addTo(flightMap);
            mapPolylines.push(polylineLayer);

            const planeIcon = L.divIcon({
              html: `<i class="fa-solid fa-plane text-emerald-400 text-sm transform -rotate-45"></i>`,
              className: 'plane-pin', iconSize: [16, 16]
            });

            const planeMarker = L.marker(leafletCoords[0], { icon: planeIcon }).addTo(flightMap);
            planeAnimMarkers.push({ marker: planeMarker, coords: leafletCoords, step: 0 });

            totalMiles += Math.round(turf.distance(turf.point(startPt), turf.point(endPt), { units: 'miles' }));
          }
        }
      }
    }
  }

  document.getElementById('map-total-distance').innerText = `${totalMiles.toLocaleString()} mi`;
  document.getElementById('map-total-flights').innerText = totalFlightsCount.toString();

  const sortedAirports = Object.entries(airportCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const airportsUl = document.getElementById('map-top-airports');
  if (sortedAirports.length > 0) {
    airportsUl.innerHTML = sortedAirports.map(([iata, count], index) => `
      <li class="top-list-item">
        <span><b>#${index + 1}</b> ${iata}</span>
        <span class="top-list-badge">${count} ${count === 1 ? 'visita' : 'visitas'}</span>
      </li>
    `).join('');
  } else {
    airportsUl.innerHTML = `<li class="top-list-item" style="color:#94a3b8;">Sin aeropuertos registrados</li>`;
  }

  const sortedAirlines = Object.entries(airlineCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const airlinesUl = document.getElementById('map-top-airlines');
  if (sortedAirlines.length > 0) {
    airlinesUl.innerHTML = sortedAirlines.map(([airline, count], index) => `
      <li class="top-list-item">
        <span><b>#${index + 1}</b> ${airline}</span>
        <span class="top-list-badge">${count} ${count === 1 ? 'vuelo' : 'vuelos'}</span>
      </li>
    `).join('');
  } else {
    airlinesUl.innerHTML = `<li class="top-list-item" style="color:#94a3b8;">Sin aerolíneas registradas</li>`;
  }

  animatePlanes();
}

function animatePlanes() {
  planeAnimMarkers.forEach(p => {
    p.step = (p.step + 1) % p.coords.length;
    p.marker.setLatLng(p.coords[p.step]);
  });
  animFrameId = requestAnimationFrame(() => { setTimeout(animatePlanes, 100); });
}

function renderAirFlightsList() {
  const container = document.getElementById('air-flights-list');
  if (!container) return;
  container.innerHTML = '';
  let flightCount = 0;
  const now = new Date();

  trips.forEach(t => {
    let tripFlights = (t.items || []).filter(i => i.type === 'flight').sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (currentFlightTimeFilter === 'upcoming') {
      tripFlights = tripFlights.filter(f => (f.timestamp || 0) >= now.getTime());
    } else if (currentFlightTimeFilter === 'past') {
      tripFlights = tripFlights.filter(f => (f.timestamp || 0) < now.getTime());
    }

    if (tripFlights.length > 0) {
      let groups = [];
      let currentGroup = [tripFlights[0]];

      for (let i = 0; i < tripFlights.length - 1; i++) {
        const curr = tripFlights[i];
        const next = tripFlights[i + 1];
        const currDest = curr.title ? curr.title.split('–')[1]?.trim() : '';
        const nextOrigin = next.title ? next.title.split('–')[0]?.trim() : '';

        let timeDiffMs = (next.timestamp && curr.arrTimestamp) ? (next.timestamp - curr.arrTimestamp) : 0;
        const isDirectConnection = (currDest && nextOrigin && currDest === nextOrigin && timeDiffMs < 18 * 3600 * 1000);

        if (isDirectConnection) {
          currentGroup.push(next);
        } else {
          groups.push(currentGroup);
          currentGroup = [next];
        }
      }
      if (currentGroup.length > 0 && !groups.includes(currentGroup)) {
        groups.push(currentGroup);
      }

      groups.forEach(group => {
        flightCount++;
        const firstFlight = group[0];
        const lastFlight = group[group.length - 1];

        const startCity = firstFlight.title ? firstFlight.title.split('–')[0]?.trim() : 'Origen';
        const endCity = lastFlight.title ? lastFlight.title.split('–')[1]?.trim() : 'Destino';
        const routeTitle = `${startCity} — ${endCity}`;

        let flightsHtml = '';
        group.forEach(f => {
          const parts = f.title ? f.title.split('–') : ['', ''];
          const fOrig = parts[0]?.trim() || '';
          const fDest = parts[1]?.trim() || '';
          flightsHtml += `
            <div style="margin-bottom: 8px; border-left: 2px solid var(--primary); padding-left: 8px;">
              <div style="font-size:0.8rem; font-weight:700; color:#fff;">${f.subtitle || 'Vuelo'} (${fOrig} — ${fDest})</div>
              <div style="font-size:0.75rem; color:#94a3b8;">📅 ${f.dayLabel} • ${f.time}</div>
            </div>
          `;
        });

        let tripDurationHtml = '';
        const lastArr = lastFlight.arrTimestamp || lastFlight.timestamp;
        const totalMs = lastArr - firstFlight.timestamp;
        if (totalMs > 0) {
          const totalMins = Math.floor(totalMs / (1000 * 60));
          const dh = Math.floor(totalMins / 60);
          const dm = totalMins % 60;
          tripDurationHtml = `
            <div class="trip-duration-footer">
              <i class="fa-regular fa-clock"></i> Duración del trayecto: ${dh} h ${dm > 0 ? dm + ' min' : ''}
            </div>
          `;
        }

        container.innerHTML += `
          <div class="air-flight-card">
            <div class="air-flight-header">
              <div class="air-flight-route">${routeTitle}</div>
              <span class="air-flight-badge">${t.title}</span>
            </div>
            <div style="margin-top: 8px;">
              ${flightsHtml}
            </div>
            ${tripDurationHtml}
          </div>
        `;
      });
    }
  });

  if (flightCount === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">No hay vuelos registrados en esta categoría.</div>`;
  }
}

// CONSULTA DE WIKIDATA Y CLIMA PARA AEROPUERTOS EN VIVO
async function fetchAirportFromWikidata(iata) {
  const cleanIata = iata.toUpperCase().trim();
  const sparqlQuery = `
    SELECT ?item ?itemLabel ?countryLabel ?coord ?loungeLabel ?voltage ?plugLabel WHERE {
      ?item wdt:P238 "${cleanIata}".
      OPTIONAL { ?item wdt:P17 ?country. }
      OPTIONAL { ?item wdt:P625 ?coord. }
      OPTIONAL { ?item wdt:P137 ?lounge. }
      OPTIONAL { ?country wdt:P2884 ?voltage. }
      OPTIONAL { ?country wdt:P2852 ?plug. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } LIMIT 1
  `;
  
  const endpointUrl = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparqlQuery) + '&format=json';
  
  try {
    const res = await fetch(endpointUrl, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (res.ok) {
      const data = await res.json();
      const bindings = data.results?.bindings;
      if (bindings && bindings.length > 0) {
        const b = bindings[0];
        let lat = 0, lng = 0;
        if (b.coord?.value) {
          const matches = b.coord.value.match(/Point\(([-\d\.]+) ([-\d\.]+)\)/);
          if (matches) { lng = parseFloat(matches[1]); lat = parseFloat(matches[2]); }
        }

        return {
          name: b.itemLabel?.value || `Aeropuerto (${cleanIata})`,
          country: b.countryLabel?.value || 'Internacional',
          lat: lat,
          lng: lng,
          lounges: b.loungeLabel?.value ? `Operado por ${b.loungeLabel.value}` : `Salas VIP y Salones de la Terminal ${cleanIata}`,
          plugs: b.voltage?.value ? `${b.voltage.value}V ${b.plugLabel?.value ? '(' + b.plugLabel.value + ')' : ''}` : `Estándar eléctrico local de ${b.countryLabel?.value || 'la región'}`,
          wifi: `Red Wi-Fi oficial del Aeropuerto ${cleanIata}`,
          transport: `Acceso por Taxi, Servicios de Rideshare y Conexiones Urbanas en ${b.countryLabel?.value || cleanIata}`
        };
      }
    }
  } catch (e) { console.error("Error consultando Wikidata:", e); }

  try {
    const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=airport+${cleanIata}`);
    const osmData = await osmRes.json();
    if (osmData && osmData.length > 0) {
      const rawName = osmData[0].display_name.split(',')[0];
      const countryPart = osmData[0].display_name.split(',').pop().trim();
      return {
        name: rawName,
        country: countryPart,
        lat: parseFloat(osmData[0].lat),
        lng: parseFloat(osmData[0].lon),
        lounges: `Salas VIP pertenecientes a ${rawName}`,
        plugs: `Estándar eléctrico oficial de ${countryPart}`,
        wifi: `Wi-Fi disponible en Terminal Central (${cleanIata})`,
        transport: `Taxis, Transfers y Rideshare en ${countryPart}`
      };
    }
  } catch (err) {}

  return null;
}

async function fetchLiveWeather(lat, lng) {
  if (!lat && !lng) return { tempC: '--', wind: '--' };
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
    const data = await res.json();
    if (data && data.current_weather) return { tempC: Math.round(data.current_weather.temperature), wind: Math.round(data.current_weather.windspeed) };
  } catch (err) {}
  return { tempC: '--', wind: '--' };
}

async function fetchWikipediaSummary(name) {
  try {
    const res = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.extract) return data.extract.length > 220 ? data.extract.substring(0, 220) + '...' : data.extract;
    }
  } catch (e) {}
  return "Terminal de transporte aéreo internacional.";
}

async function generateAirportCardHtml(iata) {
  let ap = await fetchAirportFromWikidata(iata);
  if (!ap) return `<div class="dark-card" style="text-align:center; color:#94a3b8;">No se encontró información para "${iata}".</div>`;

  const weather = await fetchLiveWeather(ap.lat, ap.lng);
  const wikiSummary = await fetchWikipediaSummary(ap.name);

  return `
    <div class="dark-card" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:0.7rem; font-weight:700; color:#0084ff; text-transform:uppercase;">${ap.country}</div>
          <div style="font-weight:800; font-size:1rem; color:#fff; line-height:1.2;">${ap.name}</div>
        </div>
        <span style="background:rgba(0,132,255,0.2); color:#0084ff; font-weight:800; font-size:0.9rem; padding:3px 8px; border-radius:8px;">${iata}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:10px 0;">
        <div style="background:#0a192f; padding:8px; border-radius:8px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-temperature-half" style="color:#ffb703; font-size:1rem;"></i>
          <div>
            <span style="font-size:0.65rem; color:#94a3b8; display:block;">Clima</span>
            <span style="font-size:0.8rem; font-weight:700; color:#fff;">${weather.tempC}°C</span>
          </div>
        </div>
        <div style="background:#0a192f; padding:8px; border-radius:8px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-wind" style="color:#38bdf8; font-size:1rem;"></i>
          <div>
            <span style="font-size:0.65rem; color:#94a3b8; display:block;">Viento</span>
            <span style="font-size:0.8rem; font-weight:700; color:#fff;">${weather.wind} km/h</span>
          </div>
        </div>
      </div>

      <div style="background:#0a192f; padding:10px; border-radius:8px; font-size:0.75rem; color:#cbd5e1; border:1px solid rgba(255,255,255,0.05); margin-bottom:8px;">
        <div style="color:#10b981; font-weight:700; font-size:0.68rem; text-transform:uppercase; margin-bottom:3px; display:flex; align-items:center; gap:4px;">
          <i class="fa-solid fa-couch"></i> Salas VIP & Ubicación
        </div>
        <div style="color:#fff; font-weight:600;">${ap.lounges}</div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
        <div style="background:#0a192f; padding:8px; border-radius:8px; font-size:0.72rem;">
          <div style="color:#38bdf8; font-weight:700; font-size:0.65rem; text-transform:uppercase;"><i class="fa-solid fa-wifi"></i> Wi-Fi Oficial</div>
          <div style="color:#fff; font-weight:600; margin-top:2px;">${ap.wifi}</div>
        </div>
        <div style="background:#0a192f; padding:8px; border-radius:8px; font-size:0.72rem;">
          <div style="color:#f59e0b; font-weight:700; font-size:0.65rem; text-transform:uppercase;"><i class="fa-solid fa-plug"></i> Enchufe Local</div>
          <div style="color:#fff; font-weight:600; margin-top:2px;">${ap.plugs}</div>
        </div>
      </div>

      <div style="background:#0a192f; padding:8px; border-radius:8px; font-size:0.72rem; color:#cbd5e1; margin-bottom:8px;">
        <div style="color:#a855f7; font-weight:700; font-size:0.65rem; text-transform:uppercase; margin-bottom:2px;"><i class="fa-solid fa-taxi"></i> Transporte & Uber</div>
        <div>${ap.transport}</div>
      </div>

      <div style="background:#0a192f; padding:8px; border-radius:8px; font-size:0.72rem; color:#cbd5e1; border:1px solid rgba(255,255,255,0.05);">
        <div style="color:#94a3b8; font-weight:700; font-size:0.65rem; text-transform:uppercase; margin-bottom:2px;">Wikipedia Resumen</div>
        <p>${wikiSummary}</p>
      </div>
    </div>
  `;
}

async function loadDefaultAirportGuide() {
  const container = document.getElementById('airports-guide-container');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando aeropuertos en vivo...</div>`;
  let html = '';
  for (let iata of ['SAL', 'EZE', 'MIA']) {
    html += await generateAirportCardHtml(iata);
  }
  container.innerHTML = html;
}

async function searchAirportGuide() {
  const input = document.getElementById('airport-search-input')?.value.trim().toUpperCase();
  if (!input) { loadDefaultAirportGuide(); return; }

  const container = document.getElementById('airports-guide-container');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Consultando ${input}...</div>`;
  const html = await generateAirportCardHtml(input);
  container.innerHTML = html;
}

// ESTADÍSTICAS MULTICATEGORÍA
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
    renderTripCategoryStats();
  } else if (selectedCat === 'flights' && pFlights) {
    pFlights.style.display = 'block';
    renderFlightStats();
  } else if (selectedCat === 'hotels' && pHotels) {
    pHotels.style.display = 'block';
    renderHotelCategoryStats();
  }
}

function renderTripCategoryStats() {
  let totalTripDays = 0;
  let totalTripExpenses = 0;
  let countryCounts = {};
  const activeStatsTrips = getFilteredTripsForStats();

  activeStatsTrips.forEach(t => {
    let items = (t.items || []).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (items.length > 0) {
      const firstTime = items[0].timestamp || 0;
      const lastTime = items[items.length - 1].arrTimestamp || items[items.length - 1].timestamp || firstTime;
      if (lastTime > firstTime) {
        const diffDays = Math.ceil((lastTime - firstTime) / (1000 * 60 * 60 * 24));
        totalTripDays += Math.max(1, diffDays);
      } else {
        totalTripDays += 1;
      }
    }

    const titleParts = t.title.split('–').concat(t.title.split(' '));
    titleParts.forEach(p => {
      const clean = p.trim();
      if (clean.length > 3) countryCounts[clean] = (countryCounts[clean] || 0) + 1;
    });

    (t.items || []).forEach(i => {
      if (i.type === 'hotel' && i.hotelCost && i.status === 'Entrada') {
        totalTripExpenses += parseFloat(i.hotelCost) || 0;
      }
    });
  });

  const totalTripsCount = activeStatsTrips.length;
  const avgDays = totalTripsCount > 0 ? (totalTripDays / totalTripsCount).toFixed(1) : 0;

  document.getElementById('trip-stat-days').innerText = totalTripDays;
  document.getElementById('trip-stat-expenses').innerText = `$${totalTripExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('trip-stat-count').innerText = totalTripsCount;
  document.getElementById('trip-stat-avg-days').innerText = `${avgDays} días`;

  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const countriesUl = document.getElementById('trip-top-countries');
  if (sortedCountries.length > 0) {
    countriesUl.innerHTML = sortedCountries.map(([dest, count], idx) => `
      <li class="top-list-item">
        <span><b>#${idx + 1}</b> ${dest}</span>
        <span class="top-list-badge">${count} ${count === 1 ? 'viaje' : 'viajes'}</span>
      </li>
    `).join('');
  } else {
    countriesUl.innerHTML = `<li class="top-list-item" style="color:#94a3b8;">Sin registros de destinos</li>`;
  }
}

function renderHotelCategoryStats() {
  let totalNights = 0;
  let totalCost = 0;
  let nightsWithCostCount = 0;
  let hotelBrandCounts = {};
  const activeStatsTrips = getFilteredTripsForStats();

  activeStatsTrips.forEach(t => {
    (t.items || []).forEach(i => {
      if (i.type === 'hotel' && i.status === 'Entrada') {
        let nights = 1;
        if (i.hotelCheckinTimestamp && i.hotelCheckoutTimestamp) {
          const diffMs = i.hotelCheckoutTimestamp - i.hotelCheckinTimestamp;
          nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }
        totalNights += nights;

        const costVal = parseFloat(i.hotelCost) || 0;
        if (costVal > 0) {
          totalCost += costVal;
          nightsWithCostCount += nights;
        }

        let cleanTitle = i.title ? i.title.replace(/^Check-in:\s*/i, '').trim() : 'Hotel no especificado';
        hotelBrandCounts[cleanTitle] = (hotelBrandCounts[cleanTitle] || 0) + 1;
      }
    });
  });

  const avgCostPerNight = nightsWithCostCount > 0 ? (totalCost / nightsWithCostCount).toFixed(2) : '0.00';

  document.getElementById('hotel-stat-nights').innerText = totalNights;
  document.getElementById('hotel-stat-cost').innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('hotel-stat-avg-night').innerText = `$${avgCostPerNight}`;

  const sortedBrands = Object.entries(hotelBrandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const brandsUl = document.getElementById('hotel-top-brands');
  if (sortedBrands.length > 0) {
    brandsUl.innerHTML = sortedBrands.map(([brand, count], idx) => `
      <li class="top-list-item">
        <span><b>#${idx + 1}</b> ${brand}</span>
        <span class="top-list-badge">${count} ${count === 1 ? 'reserva' : 'reservas'}</span>
      </li>
    `).join('');
  } else {
    brandsUl.innerHTML = `<li class="top-list-item" style="color:#94a3b8;">Sin hoteles registrados</li>`;
  }
}

async function renderFlightStats() {
  let totalMiles = 0;
  let milesWithCost = 0;
  let totalFlightMinutes = 0;
  let totalFlightsCount = 0;
  let flightsWithCostCount = 0;

  let totalFlightCost = 0;
  let totalFareCost = 0;
  let totalTaxesCost = 0;

  let airlineCounts = {};
  let airlineSpending = {};

  const activeStatsTrips = getFilteredTripsForStats();

  for (let t of activeStatsTrips) {
    for (let i of t.items) {
      if (i.type === 'flight') {
        totalFlightsCount++;

        const flightCostVal = parseFloat(i.flightTotalCost) || 0;
        if (flightCostVal > 0) {
          flightsWithCostCount++;
          totalFlightCost += flightCostVal;
        }

        if (i.flightFareCost) {
          totalFareCost += parseFloat(i.flightFareCost) || 0;
        }
        if (i.flightTaxesCost) {
          totalTaxesCost += parseFloat(i.flightTaxesCost) || 0;
        } else if (i.flightTotalCost && i.flightFareCost) {
          totalTaxesCost += Math.max(0, parseFloat(i.flightTotalCost) - parseFloat(i.flightFareCost));
        }

        if (i.timestamp && i.arrTimestamp) {
          const diffMins = Math.max(0, Math.floor((i.arrTimestamp - i.timestamp) / (1000 * 60)));
          totalFlightMinutes += diffMins;
        }

        const parts = i.title ? i.title.split('–') : [];
        if (parts.length === 2) {
          const origIata = parts[0].trim();
          const destIata = parts[1].trim();
          const apOrig = await fetchAirportFromWikidata(origIata);
          const apDest = await fetchAirportFromWikidata(destIata);
          if (apOrig && apDest) {
            const distMiles = Math.round(turf.distance(
              turf.point([apOrig.lng, apOrig.lat]),
              turf.point([apDest.lng, apDest.lat]),
              { units: 'miles' }
            ));
            totalMiles += distMiles;

            if (flightCostVal > 0) {
              milesWithCost += distMiles;
            }
          }
        }

        if (i.subtitle) {
          const match = i.subtitle.match(/\((.*?)\)/);
          const airlineName = match ? match[1].trim() : 'Otra';
          airlineCounts[airlineName] = (airlineCounts[airlineName] || 0) + 1;
          if (flightCostVal > 0) {
            airlineSpending[airlineName] = (airlineSpending[airlineName] || 0) + flightCostVal;
          }
        }
      }
    }
  }

  const totalFlightHours = (totalFlightMinutes / 60).toFixed(1);
  const avgCostPerFlight = flightsWithCostCount > 0 ? (totalFlightCost / flightsWithCostCount).toFixed(2) : '0.00';
  const costPerMile = milesWithCost > 0 ? (totalFlightCost / milesWithCost).toFixed(2) : '0.00';

  document.getElementById('flight-stat-total-cost').innerText = `$${totalFlightCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('flight-stat-fare-taxes').innerText = `$${totalFareCost.toLocaleString('en-US')} / $${totalTaxesCost.toLocaleString('en-US')}`;
  document.getElementById('stat-miles').innerText = totalMiles.toLocaleString();
  document.getElementById('stat-hours').innerText = `${totalFlightHours} h`;
  document.getElementById('flight-stat-avg-cost').innerText = `$${avgCostPerFlight}`;
  document.getElementById('flight-stat-cost-per-mile').innerText = `$${costPerMile}/mi`;

  const sortedAirlineSpending = Object.entries(airlineSpending).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const airlineSpendingUl = document.getElementById('flight-top-airlines-spending');
  if (sortedAirlineSpending.length > 0) {
    airlineSpendingUl.innerHTML = sortedAirlineSpending.map(([airline, amount], idx) => `
      <li class="top-list-item">
        <span><b>#${idx + 1}</b> ${airline}</span>
        <span class="top-list-badge" style="background:rgba(16,185,129,0.2); color:#10b981;">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </li>
    `).join('');
  } else {
    airlineSpendingUl.innerHTML = `<li class="top-list-item" style="color:#94a3b8;">Sin costos de aerolíneas registrados</li>`;
  }

  const labels = Object.keys(airlineCounts);
  const dataValues = Object.values(airlineCounts);
  const backgroundColors = ['#0084ff', '#10b981', '#ffb703', '#ec4899', '#8b5cf6'];

  const chartEl = document.getElementById('airlinesChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');
  if (airlinesChartObj) airlinesChartObj.destroy();

  if (labels.length === 0) {
    labels.push('Sin vuelos');
    dataValues.push(1);
  }

  airlinesChartObj = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
      }
    }
  });
}

// CHECKLIST DE EQUIPAJE
function renderPackingList() {
  const container = document.getElementById('packing-list-container');
  if (!container) return;
  container.innerHTML = '';
  let doneCount = packingItems.filter(i => i.done).length;
  const progText = document.getElementById('packing-progress-text');
  if (progText) progText.innerText = `${doneCount} de ${packingItems.length} completados`;

  if (packingItems.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">La lista está vacía. Añade tus artículos arriba.</div>`;
    return;
  }

  packingItems.forEach(item => {
    container.innerHTML += `
      <div class="packing-item-card ${item.done ? 'done' : ''}">
        <div style="display:flex; align-items:center; gap:10px; flex:1;" onclick="togglePacking(${item.id})">
          <i class="fa-solid ${item.done ? 'fa-circle-check text-emerald-400' : 'fa-circle text-slate-600'}"></i>
          <span style="font-size:0.8rem; color:#fff;">${item.text}</span>
        </div>
        <button class="delete-item-btn" onclick="deletePackingItem(event, ${item.id})" title="Eliminar artículo">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
  });
}

function togglePacking(id) {
  packingItems = packingItems.map(i => i.id === id ? { ...i, done: !i.done } : i);
  saveDataToStorage();
  renderPackingList();
}

function deletePackingItem(event, id) {
  if (event) event.stopPropagation();
  packingItems = packingItems.filter(i => i.id !== id);
  saveDataToStorage();
  renderPackingList();
}

function resetPackingCheckmarks() {
  packingItems = packingItems.map(i => ({ ...i, done: false }));
  saveDataToStorage();
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

// MÉTODOS DE PAGO
function renderPaymentMethodsList() {
  const container = document.getElementById('payment-methods-list');
  if (!container) return;
  container.innerHTML = '';

  if (paymentMethods.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:12px; color:#94a3b8; font-size:0.75rem;">No tienes métodos de pago guardados.</div>`;
  } else {
    paymentMethods.forEach(method => {
      let icon = 'fa-credit-card';
      if (method.type === 'Visa') icon = 'fa-cc-visa';
      else if (method.type === 'MasterCard') icon = 'fa-cc-mastercard';
      else if (method.type === 'American Express') icon = 'fa-cc-amex';
      else if (method.type === 'Discover') icon = 'fa-cc-discover';
      else if (method.type === 'Efectivo') icon = 'fa-money-bill-wave';
      else if (method.type.includes('Banco') || method.type.includes('Transferencia')) icon = 'fa-building-columns';

      container.innerHTML += `
        <div class="payment-card-item">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid ${icon}" style="font-size:1.2rem; color:#0084ff;"></i>
            <div>
              <div style="font-size:0.82rem; font-weight:700; color:#fff;">${method.name}</div>
              <div style="font-size:0.68rem; color:#94a3b8;">${method.type} ${method.last4 ? '• ••• ' + method.last4 : ''}</div>
            </div>
          </div>
          <button onclick="deletePaymentMethod('${method.id}')" style="background:none; border:none; color:#ef4444; font-size:0.85rem; cursor:pointer; padding:4px;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
    });
  }
  populatePaymentSelectors();
}

function populatePaymentSelectors() {
  const dropdowns = document.querySelectorAll('.payment-selector-dropdown');
  dropdowns.forEach(select => {
    const currentVal = select.value;
    select.innerHTML = `<option value="">Sin definir / No especificado</option>`;
    paymentMethods.forEach(m => {
      const label = `${m.name} (${m.type}${m.last4 ? ' • ' + m.last4 : ''})`;
      select.innerHTML += `<option value="${m.id}">${label}</option>`;
    });
    if (currentVal) select.value = currentVal;
  });
}

function openModalAddPaymentMethod() {
  closeModals();
  document.getElementById('pay-name-input').value = '';
  document.getElementById('pay-last4-input').value = '';
  document.getElementById('pay-type-select').value = 'Visa';
  togglePaymentInputs('Visa');
  document.getElementById('modal-add-payment').classList.add('active');
}

function togglePaymentInputs(typeVal) {
  const last4Group = document.getElementById('group-pay-last4');
  if (last4Group) {
    last4Group.style.display = (typeVal === 'Efectivo' || typeVal.includes('Transferencia')) ? 'none' : 'block';
  }
}

function saveNewPaymentMethod(e) {
  e.preventDefault();
  const type = document.getElementById('pay-type-select').value;
  const name = document.getElementById('pay-name-input').value.trim();
  const last4 = document.getElementById('pay-last4-input').value.trim();

  const newMethod = {
    id: 'pay-' + Date.now(),
    type: type,
    name: name,
    last4: (type === 'Efectivo' || type.includes('Transferencia')) ? '' : last4
  };

  paymentMethods.push(newMethod);
  saveDataToStorage();
  renderPaymentMethodsList();
  closeModals();
}

function deletePaymentMethod(id) {
  paymentMethods = paymentMethods.filter(m => m.id !== id);
  saveDataToStorage();
  renderPaymentMethodsList();
}

function getPaymentMethodLabel(paymentId) {
  if (!paymentId) return null;
  const found = paymentMethods.find(m => m.id === paymentId);
  if (!found) return null;
  return `${found.name} (${found.type}${found.last4 ? ' • ' + found.last4 : ''})`;
}

// IMPORTACIÓN DE APP IN THE AIR Y FUSIÓN DE VIAJES
function openModalImportAppInTheAir() {
  closeModals();
  document.getElementById('ait-text-input').value = '';
  document.getElementById('modal-import-ait').classList.add('active');
}

function handleAitFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('ait-text-input').value = e.target.result;
  };
  reader.readAsText(file);
}

function processAitImportText() {
  const rawText = document.getElementById('ait-text-input').value;
  if (!rawText.trim()) {
    alert("Selecciona un archivo o pega el texto formateado.");
    return;
  }

  const parsedTrips = parseAppInTheAirData(rawText);
  if (parsedTrips.length === 0) {
    alert("No se identificaron itinerarios válidos.");
    return;
  }

  let addedCount = 0;
  parsedTrips.forEach(newTrip => {
    trips.unshift(newTrip);
    addedCount++;
  });

  saveDataToStorage();
  renderTrips();
  closeModals();
  alert(`✔ Importación completada: ${addedCount} viaje(s) añadidos.`);
}

function parseAppInTheAirData(raw) {
  const tripBlocks = raw.split(/Ownership\.MINE;/g).slice(1);
  const importedTrips = [];

  tripBlocks.forEach((block, idx) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const headerParts = lines[0].split(';');
    const depTimeIso = headerParts[0] || '';
    const arrTimeIso = headerParts[1] || '';
    const orig = headerParts[2] || '';
    const dest = headerParts[3] || '';
    let customName = headerParts[6] && headerParts[6] !== 'None' ? headerParts[6] : `${orig} – ${dest}`;

    const items = [];
    let readingFlights = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('flights:')) {
        readingFlights = true;
        continue;
      }
      if (line.startsWith('hotels:') || line.startsWith('rental cars:') || line.startsWith('expenses:')) {
        readingFlights = false;
        continue;
      }

      if (readingFlights && line.includes(';')) {
        const fParts = line.split(';');
        if (fParts.length >= 13) {
          const airlineCode = fParts[7] || '';
          const flightNum = fParts[8] || '';
          const fOrig = fParts[10] || orig;
          const fDest = fParts[11] || dest;
          const fDepIso = fParts[12] || depTimeIso;
          const fArrIso = fParts[13] || arrTimeIso;

          const depDt = fDepIso ? new Date(fDepIso) : new Date();
          const arrDt = fArrIso ? new Date(fArrIso) : null;

          const dayStr = depDt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
          const timeStr = depDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          items.push({
            id: 'item-ait-' + Date.now() + Math.random().toString(36).substr(2, 4),
            timestamp: depDt.getTime(),
            arrTimestamp: arrDt ? arrDt.getTime() : null,
            dayLabel: dayStr,
            time: timeStr,
            tz: 'LOCAL',
            type: 'flight',
            title: `${fOrig} – ${fDest}`,
            status: 'Completado',
            subtitle: `${airlineCode}${flightNum}`,
            details: [`Origen: ${fOrig}`, `Destino: ${fDest}`]
          });
        }
      }
    }

    const startDt = depTimeIso ? new Date(depTimeIso) : new Date();
    const endDt = arrTimeIso ? new Date(arrTimeIso) : startDt;
    const datesFormatted = `${startDt.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })} – ${endDt.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}`;

    importedTrips.push({
      id: 'trip-ait-' + Date.now() + idx,
      title: customName,
      dates: datesFormatted,
      daysCount: 'Histórico',
      daysToGo: 'App in the Air',
      image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=200&q=80',
      items: items
    });
  });

  return importedTrips;
}

function openModalMergeTrips() {
  closeModals();
  const container = document.getElementById('merge-trips-list');
  if (!container) return;
  container.innerHTML = '';

  if (trips.length < 2) {
    container.innerHTML = `<div style="text-align:center; padding:10px; color:#94a3b8;">Necesitas al menos 2 viajes registrados para unirlos.</div>`;
  } else {
    trips.forEach(t => {
      container.innerHTML += `
        <label class="merge-trip-item">
          <input type="checkbox" value="${t.id}" class="merge-checkbox">
          <div style="flex:1;">
            <div style="font-size:0.85rem; font-weight:700; color:#fff;">${t.title}</div>
            <div style="font-size:0.72rem; color:#94a3b8;">${t.dates} • ${t.items ? t.items.length : 0} elementos</div>
          </div>
        </label>
      `;
    });
  }

  document.getElementById('modal-merge-trips').classList.add('active');
}

function executeTripMerge() {
  const selectedBoxes = Array.from(document.querySelectorAll('.merge-checkbox:checked')).map(cb => cb.value);
  if (selectedBoxes.length < 2) {
    alert("Selecciona al menos 2 viajes para fusionar.");
    return;
  }

  const tripsToMerge = trips.filter(t => selectedBoxes.includes(t.id));
  const customNameInput = document.getElementById('merged-trip-name').value.trim();

  let mergedItems = [];
  tripsToMerge.forEach(t => {
    mergedItems = mergedItems.concat(t.items || []);
  });

  mergedItems.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const firstItemTime = mergedItems[0]?.timestamp ? new Date(mergedItems[0].timestamp) : new Date();
  const lastItemTime = mergedItems[mergedItems.length - 1]?.timestamp ? new Date(mergedItems[mergedItems.length - 1].timestamp) : firstItemTime;

  const newTitle = customNameInput || `Viaje Consolidado (${tripsToMerge[0].title.split('–')[0]}...)`;
  const datesFormatted = `${firstItemTime.toLocaleDateString('es-ES', { day:'numeric', month:'short' })} – ${lastItemTime.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}`;

  const mergedTrip = {
    id: 'merged-' + Date.now(),
    title: newTitle,
    dates: datesFormatted,
    daysCount: 'Consolidado',
    daysToGo: 'Unificado',
    image: tripsToMerge[0].image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=80',
    items: mergedItems
  };

  trips = trips.filter(t => !selectedBoxes.includes(t.id));
  trips.unshift(mergedTrip);

  saveDataToStorage();
  renderTrips();
  closeModals();
  alert(`✔ Viajes unificados en "${newTitle}".`);
}

// RESPALDOS Y GOOGLE DRIVE
function connectGoogleDrive() {
  if (typeof google === 'undefined') {
    alert('Librería de Google en proceso de carga.');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.access_token) {
        driveAccessToken = response.access_token;
        const statusEl = document.getElementById('drive-status-text');
        if (statusEl) statusEl.innerHTML = '🟢 <b style="color:#10b981;">Conectado a Google Drive</b>.';
        const btn = document.getElementById('btn-connect-drive');
        if (btn) btn.style.display = 'none';
        performManualBackup();
      }
    },
  });

  tokenClient.requestAccessToken();
}

function performManualBackup() {
  if (!driveAccessToken) {
    connectGoogleDrive();
    return;
  }

  const backupData = {
    app: 'TripMaster Pro',
    version: '2.2',
    timestamp: Date.now(),
    dateStr: new Date().toLocaleString('es-ES'),
    trips: trips,
    packingItems: packingItems,
    paymentMethods: paymentMethods
  };

  const fileContent = JSON.stringify(backupData, null, 2);
  const metadata = { name: 'tripmaster_backup.json', mimeType: 'application/json' };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([fileContent], { type: 'application/json' }));

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + driveAccessToken }),
    body: formData
  }).then(res => res.json()).then(data => {
    const now = Date.now();
    localStorage.setItem('last_drive_backup_timestamp', now.toString());
    updateLastBackupDisplay();
    alert('✔ Respaldo guardado en Google Drive.');
  }).catch(err => {
    console.error('Error Drive:', err);
  });
}

function performManualRestore() {
  if (!driveAccessToken) {
    connectGoogleDrive();
    return;
  }

  fetch("https://www.googleapis.com/drive/v3/files?q=name='tripmaster_backup.json'", {
    headers: { 'Authorization': 'Bearer ' + driveAccessToken }
  })
  .then(res => res.json())
  .then(data => {
    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + driveAccessToken }
      })
      .then(res => res.json())
      .then(backupData => {
        if (backupData.trips) {
          trips = backupData.trips;
          if (backupData.packingItems) packingItems = backupData.packingItems;
          if (backupData.paymentMethods) paymentMethods = backupData.paymentMethods;
          
          saveDataToStorage();
          renderTrips();
          renderPackingList();
          renderPaymentMethodsList();
          alert(`✔ Restauración completada: ${trips.length} viaje(s) recuperados.`);
        }
      });
    } else {
      alert('No se encontró el archivo "tripmaster_backup.json" en Google Drive.');
    }
  });
}

function checkAndPerformAutoBackup() {
  let lastBackup = localStorage.getItem('last_drive_backup_timestamp');
  let frequency = localStorage.getItem('backup_frequency') || 'weekly';

  if (!lastBackup || !driveAccessToken || frequency === 'off') return;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let threshold = ONE_DAY * 7;

  if (frequency === 'daily') threshold = ONE_DAY;
  if (frequency === 'monthly') threshold = ONE_DAY * 30;

  if (now - parseInt(lastBackup) > threshold) performManualBackup();
}

function saveBackupFrequency() {
  const val = document.getElementById('backup-frequency').value;
  localStorage.setItem('backup_frequency', val);
}

function updateLastBackupDisplay() {
  const lastBackup = localStorage.getItem('last_drive_backup_timestamp');
  const freq = localStorage.getItem('backup_frequency') || 'weekly';
  const select = document.getElementById('backup-frequency');
  if (select) select.value = freq;

  if (lastBackup) {
    const dt = new Date(parseInt(lastBackup));
    const lbl = document.getElementById('last-backup-text');
    if (lbl) lbl.innerText = `Último respaldo realizado: ${dt.toLocaleDateString('es-ES')} ${dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }
}

function exportLocalJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips, packingItems, paymentMethods }, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tripmaster_backup_${Date.now()}.json`);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importLocalJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      
      const importedTrips = parsed.trips || parsed.tripsData;
      const importedPacking = parsed.packingItems || parsed.packing;
      const importedPayments = parsed.paymentMethods || parsed.payments;

      if (importedTrips && Array.isArray(importedTrips)) {
        trips = importedTrips;
        if (importedPacking) packingItems = importedPacking;
        if (importedPayments) paymentMethods = importedPayments;
        
        saveDataToStorage();
        renderTrips();
        renderPackingList();
        renderPaymentMethodsList();
        alert('✔ Datos restaurados e importados correctamente.');
      } else {
        alert('El archivo no contiene la estructura correcta de respaldos.');
      }
    } catch (err) {
      console.error('Error al importar:', err);
      alert('El archivo no es un respaldo válido de TripMaster.');
    }
  };
  reader.readAsText(file);
}

// SERVICE WORKERS
let newWorker;

function reloadAppVersion() {
  if (newWorker) {
    newWorker.postMessage({ action: 'skipWaiting' });
  }
  window.location.reload();
}

function showUpdateToast(worker) {
  newWorker = worker;
  const toast = document.getElementById('update-toast');
  if (toast) toast.style.display = 'flex';
}

function checkServiceWorkerUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update();

      if (reg.waiting) {
        showUpdateToast(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(installingWorker);
          }
        });
      });
    }).catch(err => console.error('Error al registrar Service Worker', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}
