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
    tripSelect.innerHTML = `<option value="all">📅 Año: Todos</option>`;
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
// NAVEGACIÓN Y PANTALLAS
// ==========================================
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

  if (subtabId === 'aeropuertos') loadDefaultAirportGuide();
  else if (subtabId === 'equipaje') renderPackingList();
  else if (subtabId === 'millas') renderMembershipsList();
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
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
// MEMBRESÍAS Y MILLAS
// ==========================================
function saveMembershipProgram(e) {
  e.preventDefault();
  const airline = document.getElementById('member-airline').value.trim();
  const number = document.getElementById('member-number').value.trim();
  const miles = parseInt(document.getElementById('member-miles').value) || 0;

  membershipPrograms.push({ id: 'mem-' + Date.now(), airline, number, miles });
  saveDataToStorage();
  renderMembershipsList();
  e.target.reset();
}

function renderMembershipsList() {
  const container = document.getElementById('memberships-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (membershipPrograms.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.8rem;">No hay programas registrados. Añade uno arriba.</div>`;
    return;
  }

  membershipPrograms.forEach(mem => {
    container.innerHTML += `
      <div class="dark-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; color:#fff; font-size:0.9rem;">${mem.airline}</div>
          <div style="font-size:0.75rem; color:#94a3b8;">Socio N°: <b style="color:#cbd5e1;">${mem.number}</b></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.9rem; font-weight:800; color:#ffb703;">${mem.miles.toLocaleString()} mi</div>
          <button onclick="deleteMembership('${mem.id}')" style="background:none; border:none; color:#ef4444; font-size:0.75rem; cursor:pointer; margin-top:2px;">Eliminar</button>
        </div>
      </div>
    `;
  });
}

function deleteMembership(id) {
  membershipPrograms = membershipPrograms.filter(m => m.id !== id);
  saveDataToStorage();
  renderMembershipsList();
}

// ==========================================
// RENDERIZADO DE VIAJES E ITINERARIO
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

// ==========================================
// MODALES Y FORMULARIOS DE ELEMENTOS
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
    openFlightForm(item);
  } else if (item.type === 'hotel') {
    openHotelForm(item);
  } else if (item.type === 'car') {
    openCarForm(item);
  } else if (item.type === 'food') {
    openRestaurantForm(item);
  }
}

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

function openFlightForm(existingItem = null) {
  closeModals();
  populatePaymentSelectors();
  const formTitle = document.getElementById('flight-form-modal-title');
  const editIdInput = document.getElementById('edit-item-id');
  const noInput = document.getElementById('flight-no');
  const airlineInput = document.getElementById('flight-airline');
  const origInput = document.getElementById('flight-origin');
  const destInput = document.getElementById('flight-dest');
  const depTimeInput = document.getElementById('flight-dep-time');
  const arrTimeInput = document.getElementById('flight-arr-time');
  const totalCostInput = document.getElementById('flight-total-cost');
  const fareCostInput = document.getElementById('flight-fare-cost');
  const currInput = document.getElementById('flight-currency');
  const payInput = document.getElementById('flight-payment-method');
  const gateInput = document.getElementById('flight-gate');
  const seatInput = document.getElementById('flight-seat');
  const codeInput = document.getElementById('flight-code');

  if (existingItem) {
    formTitle.innerText = '✏ Editar Vuelo';
    editIdInput.value = existingItem.id;

    const ports = existingItem.title ? existingItem.title.split('–') : ['', ''];
    origInput.value = ports[0] ? ports[0].trim() : '';
    destInput.value = ports[1] ? ports[1].trim() : '';

    const flightMatch = existingItem.subtitle ? existingItem.subtitle.match(/^(.*?)\s*\((.*?)\)$/) : null;
    if (flightMatch) {
      noInput.value = flightMatch[1];
      airlineInput.value = flightMatch[2];
    } else {
      noInput.value = existingItem.subtitle || '';
      airlineInput.value = '';
    }

    if (existingItem.timestamp) {
      const dt = new Date(existingItem.timestamp);
      depTimeInput.value = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    if (existingItem.arrTimestamp) {
      const arrDt = new Date(existingItem.arrTimestamp);
      arrTimeInput.value = new Date(arrDt.getTime() - (arrDt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }

    totalCostInput.value = existingItem.flightTotalCost || '';
    fareCostInput.value = existingItem.flightFareCost || '';
    currInput.value = existingItem.flightCurrency || 'USD';
    payInput.value = existingItem.paymentMethodId || '';
  } else {
    formTitle.innerText = '✈ Registrar Vuelo';
    editIdInput.value = '';
    noInput.value = '';
    airlineInput.value = '';
    origInput.value = '';
    destInput.value = '';
    depTimeInput.value = '';
    arrTimeInput.value = '';
    totalCostInput.value = '';
    fareCostInput.value = '';
    currInput.value = 'USD';
    payInput.value = '';
    gateInput.value = '';
    seatInput.value = '';
    codeInput.value = '';
  }

  document.getElementById('modal-flight-form').classList.add('active');
}

function saveAdvancedFlight(e) {
  e.preventDefault();
  const editItemId = document.getElementById('edit-item-id').value;
  const flightNo = document.getElementById('flight-no').value.trim();
  const airline = document.getElementById('flight-airline').value.trim();
  const origin = document.getElementById('flight-origin').value.toUpperCase().trim();
  const dest = document.getElementById('flight-dest').value.toUpperCase().trim();
  const datetime = document.getElementById('flight-dep-time').value;
  const arrDatetime = document.getElementById('flight-arr-time').value;
  const gate = document.getElementById('flight-gate').value.trim();
  const seat = document.getElementById('flight-seat').value.trim();
  const code = document.getElementById('flight-code').value.trim();

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
    const subtitleStr = airline ? `${flightNo} (${airline})` : flightNo;
    if (editItemId) {
      const existingItem = activeTrip.items.find(i => i.id === editItemId);
      if (existingItem) {
        existingItem.timestamp = timestamp;
        existingItem.arrTimestamp = arrTimestamp;
        existingItem.dayLabel = dayStr;
        existingItem.time = timeStr;
        existingItem.title = `${origin} – ${dest}`;
        existingItem.subtitle = subtitleStr;
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
        subtitle: subtitleStr,
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

function openModalNewTrip() {
  closeModals();
  document.getElementById('edit-trip-id').value = '';
  document.getElementById('modal-trip-title').innerText = 'Crear Nuevo Viaje';
  document.getElementById('trip-name-input').value = '';
  document.getElementById('trip-dest-input').value = '';
  document.getElementById('trip-start-input').value = '';
  document.getElementById('trip-end-input').value = '';
  document.getElementById('trip-image-url').value = '';
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
  let airportCounts = {};
  let airlineCounts = {};

  for (let t of trips) {
    for (let i of (t.items || [])) {
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

  const distEl = document.getElementById('map-total-distance');
  const countEl = document.getElementById('map-total-flights');
  if (distEl) distEl.innerText = `${totalMiles.toLocaleString()} mi`;
  if (countEl) countEl.innerText = totalFlightsCount.toString();

  const sortedAirports = Object.entries(airportCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const airportsUl = document.getElementById('map-top-airports');
  if (airportsUl) {
    airportsUl.innerHTML = sortedAirports.length > 0 
      ? sortedAirports.map(([iata, count], index) => `<li class="top-list-item"><span><b>#${index + 1}</b> ${iata}</span><span class="top-list-badge">${count} visitas</span></li>`).join('')
      : `<li class="top-list-item" style="color:#94a3b8;">Sin aeropuertos registrados</li>`;
  }

  const sortedAirlines = Object.entries(airlineCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const airlinesUl = document.getElementById('map-top-airlines');
  if (airlinesUl) {
    airlinesUl.innerHTML = sortedAirlines.length > 0
      ? sortedAirlines.map(([airline, count], index) => `<li class="top-list-item"><span><b>#${index + 1}</b> ${airline}</span><span class="top-list-badge">${count} vuelos</span></li>`).join('')
      : `<li class="top-list-item" style="color:#94a3b8;">Sin aerolíneas registradas</li>`;
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

// FUNCIÓN DE RENDERIZADO DE VUELOS UNIFICADA POR TRAYECTO/ESCALAS
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

    if (tripFlights.length === 0) return;

    // Agrupamiento por trayectos continuos (escalas o tramos del mismo viaje)
    let groupedRoutes = [];
    let currentGroup = [];

    tripFlights.forEach((f, idx) => {
      if (currentGroup.length === 0) {
        currentGroup.push(f);
      } else {
        const prevFlight = currentGroup[currentGroup.length - 1];
        const prevDest = prevFlight.title ? prevFlight.title.split('–')[1]?.trim() : '';
        const currOrig = f.title ? f.title.split('–')[0]?.trim() : '';
        
        // Si el origen de este vuelo coincide con el destino del anterior (escala/conexión)
        if (prevDest && currOrig && prevDest === currOrig) {
          currentGroup.push(f);
        } else {
          groupedRoutes.push(currentGroup);
          currentGroup = [f];
        }
      }
      if (idx === tripFlights.length - 1 && currentGroup.length > 0) {
        groupedRoutes.push(currentGroup);
      }
    });

    groupedRoutes.forEach(group => {
      flightCount += group.length;
      const originAirport = group[0].title ? group[0].title.split('–')[0]?.trim() : '';
      const destAirport = group[group.length - 1].title ? group[group.length - 1].title.split('–')[1]?.trim() : '';

      // Cálculo de duración del trayecto
      let durationStr = 'Sin definir';
      const firstDep = group[0].timestamp;
      const lastArr = group[group.length - 1].arrTimestamp || group[group.length - 1].timestamp;

      if (firstDep && lastArr && lastArr > firstDep) {
        const diffMs = lastArr - firstDep;
        const totalMin = Math.floor(diffMs / (1000 * 60));
        const hrs = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        durationStr = hrs > 0 ? `${hrs} h ${mins} min` : `${mins} min`;
      }

      let segmentsHtml = '';
      group.forEach(f => {
        segmentsHtml += `
          <div style="border-left: 3px solid #0084ff; padding-left: 10px; margin-bottom: 8px;">
            <div style="font-weight:700; color:#fff; font-size:0.85rem;">${f.subtitle || 'Vuelo'} (${f.title})</div>
            <div style="font-size:0.75rem; color:#38bdf8; margin-top:2px;">📅 ${f.dayLabel} • ${f.time}</div>
          </div>
        `;
      });

      container.innerHTML += `
        <div class="dark-card" style="margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:800; color:#38bdf8; font-size:1.05rem;">${originAirport} – ${destAirport}</div>
            <span style="font-size:0.7rem; background:rgba(0,132,255,0.2); color:#0084ff; padding:3px 8px; border-radius:6px; font-weight:700;">${t.title}</span>
          </div>
          ${segmentsHtml}
          <div style="font-size:0.75rem; color:#ffb703; border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px; margin-top:6px;">
            <i class="fa-regular fa-clock"></i> Duración del trayecto: <b>${durationStr}</b>
          </div>
        </div>
      `;
    });
  });

  if (flightCount === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">No hay vuelos registrados en esta categoría.</div>`;
  }
}

async function fetchAirportFromWikidata(iata) {
  const cleanIata = iata.toUpperCase().trim();
  const sparqlQuery = `
    SELECT ?item ?itemLabel ?countryLabel ?coord WHERE {
      ?item wdt:P238 "${cleanIata}".
      OPTIONAL { ?item wdt:P17 ?country. }
      OPTIONAL { ?item wdt:P625 ?coord. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    } LIMIT 1
  `;
  try {
    const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparqlQuery) + '&format=json', { headers: { 'Accept': 'application/sparql-results+json' } });
    if (res.ok) {
      const data = await res.json();
      const b = data.results?.bindings[0];
      if (b) {
        let lat = 0, lng = 0;
        if (b.coord?.value) {
          const m = b.coord.value.match(/Point\(([-\d\.]+) ([-\d\.]+)\)/);
          if (m) { lng = parseFloat(m[1]); lat = parseFloat(m[2]); }
        }
        return { name: b.itemLabel?.value || cleanIata, country: b.countryLabel?.value || 'Internacional', lat, lng };
      }
    }
  } catch (e) {}
  return null;
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
  const activeStatsTrips = getFilteredTripsForStats();

  activeStatsTrips.forEach(t => {
    let items = (t.items || []).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (items.length > 0) {
      const firstTime = items[0].timestamp || 0;
      const lastTime = items[items.length - 1].arrTimestamp || items[items.length - 1].timestamp || firstTime;
      if (lastTime > firstTime) {
        totalTripDays += Math.max(1, Math.ceil((lastTime - firstTime) / (1000 * 60 * 60 * 24)));
      } else { totalTripDays += 1; }
    }
    (t.items || []).forEach(i => {
      if (i.type === 'hotel' && i.hotelCost && i.status === 'Entrada') {
        totalTripExpenses += parseFloat(i.hotelCost) || 0;
      }
    });
  });

  const totalTripsCount = activeStatsTrips.length;
  const avgDays = totalTripsCount > 0 ? (totalTripDays / totalTripsCount).toFixed(1) : 0;

  document.getElementById('trip-stat-days').innerText = totalTripDays;
  document.getElementById('trip-stat-expenses').innerText = `$${totalTripExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('trip-stat-count').innerText = totalTripsCount;
  document.getElementById('trip-stat-avg-days').innerText = `${avgDays} días`;
}

function renderHotelCategoryStats() {
  let totalNights = 0;
  let totalCost = 0;
  const activeStatsTrips = getFilteredTripsForStats();

  activeStatsTrips.forEach(t => {
    (t.items || []).forEach(i => {
      if (i.type === 'hotel' && i.status === 'Entrada') {
        totalNights += 1;
        totalCost += parseFloat(i.hotelCost) || 0;
      }
    });
  });

  document.getElementById('hotel-stat-nights').innerText = totalNights;
  document.getElementById('hotel-stat-cost').innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

async function renderFlightStats() {
  let totalFlightCost = 0;
  const activeStatsTrips = getFilteredTripsForStats();

  activeStatsTrips.forEach(t => {
    (t.items || []).forEach(i => {
      if (i.type === 'flight') totalFlightCost += parseFloat(i.flightTotalCost) || 0;
    });
  });

  document.getElementById('flight-stat-total-cost').innerText = `$${totalFlightCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ==========================================
// PACKING & MÉTODOS DE PAGO
// ==========================================
function renderPackingList() {
  const container = document.getElementById('packing-list-container');
  if (!container) return;
  container.innerHTML = '';
  let doneCount = packingItems.filter(i => i.done).length;
  const progText = document.getElementById('packing-progress-text');
  if (progText) progText.innerText = `${doneCount} de ${packingItems.length} completados`;

  packingItems.forEach(item => {
    container.innerHTML += `
      <div class="dark-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="togglePacking(${item.id})">
          <i class="fa-solid ${item.done ? 'fa-circle-check text-emerald-400' : 'fa-circle text-slate-600'}"></i>
          <span style="font-size:0.85rem; color:#fff; ${item.done ? 'text-decoration:line-through; opacity:0.6;' : ''}">${item.text}</span>
        </div>
        <button onclick="deletePackingItem(${item.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });
}

function togglePacking(id) {
  packingItems = packingItems.map(i => i.id === id ? { ...i, done: !i.done } : i);
  saveDataToStorage();
  renderPackingList();
}

function deletePackingItem(id) {
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

function renderPaymentMethodsList() {
  const container = document.getElementById('payment-methods-list');
  if (!container) return;
  container.innerHTML = '';
  paymentMethods.forEach(method => {
    container.innerHTML += `
      <div class="dark-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="font-size:0.85rem; color:#fff;">${method.name} (${method.type})</div>
        <button onclick="deletePaymentMethod('${method.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });
  populatePaymentSelectors();
}

function populatePaymentSelectors() {
  const dropdowns = document.querySelectorAll('.payment-selector-dropdown');
  dropdowns.forEach(select => {
    const currentVal = select.value;
    select.innerHTML = `<option value="">Sin definir / No especificado</option>`;
    paymentMethods.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name} (${m.type})</option>`;
    });
    if (currentVal) select.value = currentVal;
  });
}

function openModalAddPaymentMethod() {
  closeModals();
  document.getElementById('modal-add-payment')?.classList.add('active');
}

function saveNewPaymentMethod(e) {
  e.preventDefault();
  const type = document.getElementById('pay-type-select').value;
  const name = document.getElementById('pay-name-input').value.trim();
  const last4 = document.getElementById('pay-last4-input').value.trim();

  paymentMethods.push({ id: 'pay-' + Date.now(), type, name, last4 });
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
  const found = paymentMethods.find(m => m.id === paymentId);
  return found ? `${found.name} (${found.type})` : null;
}

// ==========================================
// IMPORTACIÓN & RESPALDOS (GOOGLE DRIVE & JSON)
// ==========================================
function openModalImportAppInTheAir() { closeModals(); document.getElementById('modal-import-ait')?.classList.add('active'); }
function openModalMergeTrips() { closeModals(); document.getElementById('modal-merge-trips')?.classList.add('active'); }

function connectGoogleDrive() {
  if (typeof google === 'undefined') { alert('Librería de Google cargando...'); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (res) => {
      if (res.access_token) {
        driveAccessToken = res.access_token;
        const st = document.getElementById('drive-status-text');
        if (st) st.innerHTML = '🟢 <b style="color:#10b981;">Conectado a Google Drive</b>.';
        performManualBackup();
      }
    }
  });
  tokenClient.requestAccessToken();
}

function performManualBackup() {
  if (!driveAccessToken) { connectGoogleDrive(); return; }
  const backupData = { app: 'TripMaster Pro', timestamp: Date.now(), trips, packingItems, paymentMethods, membershipPrograms };
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify({ name: 'tripmaster_backup.json', mimeType: 'application/json' })], { type: 'application/json' }));
  formData.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + driveAccessToken }),
    body: formData
  }).then(res => res.json()).then(() => {
    localStorage.setItem('last_drive_backup_timestamp', Date.now().toString());
    updateLastBackupDisplay();
    alert('✔ Respaldo guardado en Google Drive.');
  }).catch(e => console.error(e));
}

function performManualRestore() {
  if (!driveAccessToken) { connectGoogleDrive(); return; }
  fetch("https://www.googleapis.com/drive/v3/files?q=name='tripmaster_backup.json'", {
    headers: { 'Authorization': 'Bearer ' + driveAccessToken }
  }).then(r => r.json()).then(data => {
    if (data.files && data.files.length > 0) {
      fetch(`https://www.googleapis.com/drive/v3/files/${data.files[0].id}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + driveAccessToken }
      }).then(r => r.json()).then(bData => {
        if (bData.trips) {
          trips = bData.trips;
          if (bData.packingItems) packingItems = bData.packingItems;
          if (bData.paymentMethods) paymentMethods = bData.paymentMethods;
          if (bData.membershipPrograms) membershipPrograms = bData.membershipPrograms;
          saveDataToStorage(); renderTrips(); renderPackingList(); renderPaymentMethodsList(); renderMembershipsList();
          alert(`✔ Restauración exitosa.`);
        }
      });
    }
  });
}

function checkAndPerformAutoBackup() {
  let lastBackup = localStorage.getItem('last_drive_backup_timestamp');
  if (lastBackup && driveAccessToken && (Date.now() - parseInt(lastBackup) > 7 * 24 * 60 * 60 * 1000)) performManualBackup();
}

function updateLastBackupDisplay() {
  const lastBackup = localStorage.getItem('last_drive_backup_timestamp');
  const lbl = document.getElementById('last-backup-text');
  if (lbl && lastBackup) {
    const dt = new Date(parseInt(lastBackup));
    lbl.innerText = `Último respaldo: ${dt.toLocaleDateString('es-ES')} ${dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }
}

function exportLocalJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips, packingItems, paymentMethods, membershipPrograms }, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `tripmaster_backup_${Date.now()}.json`);
  a.click(); a.remove();
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
        if (parsed.packingItems) packingItems = parsed.packingItems;
        if (parsed.paymentMethods) paymentMethods = parsed.paymentMethods;
        if (parsed.membershipPrograms) membershipPrograms = parsed.membershipPrograms;
        saveDataToStorage(); renderTrips(); renderPackingList(); renderPaymentMethodsList(); renderMembershipsList();
        alert('✔ Datos importados correctamente.');
      }
    } catch (err) { alert('Archivo no válido.'); }
  };
  reader.readAsText(file);
}

// ==========================================
// SERVICE WORKERS COMPLETO
// ==========================================
let newWorker;

function reloadAppVersion() {
  if (newWorker) newWorker.postMessage({ action: 'skipWaiting' });
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
      if (reg.waiting) showUpdateToast(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(installingWorker);
          }
        });
      });
    }).catch(err => console.error('Error Service Worker:', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}
