// ==========================================
// FUNCIONES DE GESTIÓN Y EDICIÓN DE VIAJES
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
  
  if (editIdInput) editIdInput.value = trip.id;
  if (titleInput) titleInput.value = trip.title;
  if (destInput) destInput.value = trip.title;
  
  if (trip.dates && trip.dates.includes('–')) {
    const parts = trip.dates.split('–');
    if (startInput) startInput.value = parts[0].trim();
    if (endInput) endInput.value = parts[1].trim();
  }
  
  if (imgUrlInput) imgUrlInput.value = trip.image || '';
  
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
    msgEl.innerText = `Se eliminará de forma permanente el viaje "${trip.title}" y todos sus vuelos, alojamientos y actividades registradas.`;
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
    text: `Miren mi itinerario para ${trip.title} (${trip.dates})`,
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
    alert('✔ Enlace del viaje copiado al portapapeles.');
  }
}
