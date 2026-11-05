// ==========================================
// TRIPMASTER PRO - MOTOR COMPLETO INTEGRADO
// ==========================================

let currentTripTimeFilter = 'all';
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

let trips = [];
let currentScreen = 'trips-list';
let activeTripId = '1';

window.addEventListener('load', () => {
  loadDataFromStorage();
  renderTrips();
});

function saveDataToStorage() {
  try {
    localStorage.setItem('tripmaster_trips', JSON.stringify(trips));
    populateYearDropdowns();
  } catch (e) { console.error("Error guardando datos:", e); }
}

function loadDataFromStorage() {
  try {
    const storedTrips = localStorage.getItem('tripmaster_trips');
    if (storedTrips) {
      trips = JSON.parse(storedTrips);
    } else { 
      trips = INITIAL_TRIPS; 
    }
    populateYearDropdowns();
  } catch (e) {
    trips = INITIAL_TRIPS;
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

  if (tripSelect) {
    const currTripVal = tripSelect.value;
    tripSelect.innerHTML = `<option value="all">📅 Todos los años</option>`;
    sortedYears.forEach(y => { tripSelect.innerHTML += `<option value="${y}">📅 ${y}</option>`; });
    if (currTripVal && Array.from(tripSelect.options).some(o => o.value === currTripVal)) {
      tripSelect.value = currTripVal;
    }
  }
}

// ==========================================
// FUNCIONES PARA PREVISUALIZAR Y PROCESAR FOTOS
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
// NAVEGACIÓN Y MENÚS
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
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');
  currentScreen = screenId;
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
}

function handleFabClick() {
  openModalNewTrip();
}

// ==========================================
// EDICIÓN, BORRADO Y COMPARTIR VIAJE
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
// CONTROLADOR DE LISTA DE VIAJES
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

  const dTitle = document.getElementById('detail-title');
  const dDates = document.getElementById('detail-dates');
  if (dTitle) dTitle.innerText = trip.title;
  if (dDates) dDates.innerText = trip.dates;

  const container = document.getElementById('timeline-container');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;">Itinerario listo.</div>`;
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

function exportLocalJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ trips }, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `tripmaster_backup_${Date.now()}.json`);
  a.click();
  a.remove();
}
