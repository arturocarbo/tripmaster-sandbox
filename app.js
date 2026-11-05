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
