/**
 * SafeRoute — Backend Integration
 * ================================
 * Drop this file into your project and add ONE line to index.html:
 *
 *   <script src="js/backend.js"></script>
 *
 * Add it AFTER app.js. It patches the existing functions to use the
 * real backend instead of localStorage.
 *
 * Set BACKEND_URL to your Railway deployment URL once deployed.
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────
  // ⚠️  IMPORTANT: Change this to your deployed backend URL before going live.
  // e.g. 'https://saferoute-backend-production.up.railway.app'
  // For local development keep it as 'http://localhost:3001'
  const BACKEND_URL = 'https://web-production-32acd.up.railway.app';

  // A random ID stored in localStorage to identify this browser session
  // (not linked to any personal info — just prevents duplicate spam)
  const SESSION_ID = (() => {
    let id = localStorage.getItem('sr_session');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sr_session', id); }
    return id;
  })();

  // ── Socket.io connection ──────────────────────────────────────────
  // socket.io client is loaded from the backend automatically
  const socketScript = document.createElement('script');
  socketScript.src = BACKEND_URL + '/socket.io/socket.io.js';
  socketScript.onload = initSocket;
  socketScript.onerror = () => console.warn('[SafeRoute] Socket.io not reachable — real-time features disabled');
  document.head.appendChild(socketScript);

  let socket = null;

  function initSocket() {
    try {
      socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        console.log('[SafeRoute] Real-time connected ✅');
        socket.emit('join:city', 'mumbai');
        showToast('🔴 Live — real-time incidents active');
      });

      socket.on('disconnect', () => console.warn('[SafeRoute] Real-time disconnected'));

      // ── New incident reported by ANOTHER user ─────────────────────
      socket.on('incident:new', (incident) => {
        console.log('[SafeRoute] New incident from another user:', incident);
        addLiveIncidentToMap(incident);
        showToast(`⚠ New report nearby: ${incident.type}`);
      });

      // ── SOS from another user (optional: show on map) ─────────────
      socket.on('sos:alert', (data) => {
        console.warn('[SafeRoute] SOS alert nearby:', data);
        showToast('🚨 SOS alert triggered nearby — emergency services notified');
      });

      // ── Live user count ───────────────────────────────────────────
      socket.on('stats:users', ({ online }) => {
        const el = document.getElementById('liveUserCount');
        if (el) el.textContent = online + ' online';
      });

    } catch (e) {
      console.warn('[SafeRoute] Socket init failed:', e);
    }
  }

  // ── Add a live incident marker to the Mapbox map ──────────────────
  function addLiveIncidentToMap(incident) {
    // Wait for Mapbox map to be available (defined in app.js)
    if (typeof map === 'undefined' || !map) return;

    const el = document.createElement('div');
    el.style.cssText = [
      'width:14px', 'height:14px', 'border-radius:50%',
      'background:#e05252', 'border:2.5px solid white',
      'box-shadow:0 0 8px #e0525288', 'cursor:pointer',
      'animation:navPulse 2s ease-out infinite'
    ].join(';');

    const popup = new mapboxgl.Popup({ maxWidth: '240px' }).setHTML(
      `<b style="color:#e05252">⚠ ${incident.type}</b>` +
      `<br><span style="font-size:.7rem;color:var(--muted)">${incident.timeAgo || 'Just now'} · Live report</span>` +
      (incident.description ? `<br><span style="font-size:.7rem">${incident.description}</span>` : '')
    );

    new mapboxgl.Marker({ element: el })
      .setLngLat([incident.lng, incident.lat])
      .setPopup(popup)
      .addTo(map);
  }

  // ── Load existing incidents from DB on map load ───────────────────
  async function loadNearbyIncidents(lat, lng) {
    try {
      const url = `${BACKEND_URL}/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=5000`;
      const res  = await fetch(url);
      if (!res.ok) return;
      const { incidents } = await res.json();
      incidents.forEach(inc => {
        addLiveIncidentToMap({
          lat:         inc.location.coordinates[1],
          lng:         inc.location.coordinates[0],
          type:        inc.type,
          timeAgo:     inc.timeAgo,
          description: inc.description
        });
      });
      if (incidents.length) {
        console.log(`[SafeRoute] Loaded ${incidents.length} incidents from DB`);
      }
    } catch (e) {
      console.warn('[SafeRoute] Could not load incidents from backend:', e);
    }
  }

  // ── Patch submitIncident to POST to the backend ───────────────────
  // The original function in app.js saves to localStorage only.
  // We intercept the submit button click and also POST to the API.
  document.addEventListener('DOMContentLoaded', () => {

    // Patch incident submit button
    const irSubmit = document.getElementById('irSubmit');
    if (irSubmit) {
      irSubmit.addEventListener('click', async () => {
        // app.js fires first (stores to localStorage, closes modal)
        // We fire second to also POST to the backend
        await new Promise(r => setTimeout(r, 50)); // let app.js run first

        // Grab the coords from the app.js global
        const lat = typeof _uLat !== 'undefined' ? _uLat : null;
        const lng = typeof _uLng !== 'undefined' ? _uLng : null;
        if (!lat || !lng) return;

        const type        = document.getElementById('irType')?.value  || 'Other';
        const timeAgo     = document.getElementById('irTime')?.value  || 'Just now';
        // desc may be empty after app.js clears it, so grab before
        const description = window._lastIrDesc || '';

        try {
          await fetch(`${BACKEND_URL}/api/incidents`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ lat, lng, type, timeAgo, description, sessionId: SESSION_ID })
          });
          // Socket.io will broadcast it back to other users automatically
        } catch (e) {
          console.warn('[SafeRoute] Could not POST incident to backend:', e);
        }
      }, true); // capture phase so we run after app.js's listener
    }

    // Stash the description before app.js clears it on submit
    const irDesc = document.getElementById('irDesc');
    if (irDesc) {
      irDesc.addEventListener('input', () => { window._lastIrDesc = irDesc.value; });
    }

    // ── Patch modalShare button: send SOS SMS via backend ─────────
    const modalShare = document.getElementById('modalShare');
    if (modalShare) {
      modalShare.addEventListener('click', async () => {
        const lat = typeof _uLat !== 'undefined' ? _uLat : null;
        const lng = typeof _uLng !== 'undefined' ? _uLng : null;
        const contactList = typeof contacts !== 'undefined' ? contacts : [];

        // Always share location link regardless of contacts
        const locationUrl = `https://maps.google.com/?q=${lat || 19.076},${lng || 72.877}`;
        if (navigator.share) {
          navigator.share({ title: '🚨 SafeRoute SOS — My Location', url: locationUrl }).catch(() => {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(locationUrl).then(() => showToast('📋 Location link copied!')).catch(() => {});
        }

        if (!lat || !lng) {
          showToast('⚠ Location not available — enable GPS');
          return;
        }
        if (!contactList.some(c => c.phone)) {
          showToast('⚠ Add phone numbers to contacts to send SMS alerts');
          return;
        }

        showToast('📡 Sending SOS alerts…');
        try {
          const res = await fetch(`${BACKEND_URL}/api/sos`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              lat, lng,
              contacts:  contactList.map(c => ({ name: c.name, phone: c.phone })),
              sessionId: SESSION_ID
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast(`📱 SOS SMS sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}!`);
          } else {
            showToast('⚠ SMS sending failed — call 112 directly');
          }
        } catch (e) {
          console.warn('[SafeRoute] SOS backend call failed:', e);
          showToast('⚠ Could not reach server — call 112 directly');
        }
      });
    }

    // ── Nav SOS button: send SMS when clicked (modal already opened by app.js) ─
    const navSos = document.getElementById('navSos');
    if (navSos) {
      navSos.addEventListener('click', async () => {
        // Note: app.js already opens the SOS modal on this click.
        // We only need to handle the SMS sending here.
        const lat = typeof _uLat !== 'undefined' ? _uLat : null;
        const lng = typeof _uLng !== 'undefined' ? _uLng : null;
        const contactList = typeof contacts !== 'undefined' ? contacts : [];

        if (!lat || !lng) {
          showToast('⚠ Location not available — enable GPS for SMS alerts');
          return;
        }
        if (!contactList.some(c => c.phone)) {
          showToast('⚠ Add a contact phone number to send SMS alerts');
          return;
        }

        try {
          const res = await fetch(`${BACKEND_URL}/api/sos`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              lat, lng,
              contacts:  contactList.map(c => ({ name: c.name, phone: c.phone })),
              sessionId: SESSION_ID
            })
          });
          const data = await res.json();
          showToast(data.success
            ? `🚨 SMS sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}`
            : '⚠ SMS failed — call 112 directly'
          );
        } catch (e) {
          console.warn('[SafeRoute] Nav SOS failed:', e);
          showToast('⚠ Could not reach server — call 112 directly');
        }
      });
    }

    // ── Load incidents once map is ready ──────────────────────────
    // Poll until the `map` global from app.js is available
    const mapPoll = setInterval(() => {
      if (typeof map !== 'undefined' && map && map.isStyleLoaded && map.isStyleLoaded()) {
        clearInterval(mapPoll);
        const lat = typeof _uLat !== 'undefined' ? _uLat : 19.076;
        const lng = typeof _uLng !== 'undefined' ? _uLng : 72.877;
        loadNearbyIncidents(lat, lng);

        // Send location to socket for online count
        if (socket) socket.emit('user:location', { lat, lng });
      }
    }, 500);

    // ── Inject live user count badge into the nav ─────────────────
    injectLiveBadge();
  });

  // ── Inject "X users online" badge into the navbar ─────────────────
  function injectLiveBadge() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;
    const badge = document.createElement('div');
    badge.id = 'liveBadge';
    badge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:5px',
      'font-size:.7rem', 'color:var(--muted)',
      'padding:4px 10px', 'border-radius:10px',
      'background:var(--bg)', 'white-space:nowrap'
    ].join(';');
    badge.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#2a6b4a;flex-shrink:0;animation:blink 2s ease infinite"></span><span id="liveUserCount">connecting…</span>`;
    navRight.insertBefore(badge, navRight.firstChild);
  }

  // ── Toast helper (mirrors app.js's toast) ─────────────────────────
  function showToast(msg) {
    // Use app.js's toast if available, else fallback
    if (typeof toast === 'function') { toast(msg); return; }
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3400);
  }

})();
