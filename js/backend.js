/**
 * SafeRoute — Backend Integration (FIXED)
 * =========================================
 * Key fixes:
 * 1. modalShare button now shows immediate feedback + sends SMS reliably
 * 2. GPS is properly awaited before SMS is sent
 * 3. Contacts without phones get a clear "Add phone number" prompt
 * 4. Button shows step-by-step status so user knows what's happening
 * 5. WhatsApp fallback always fires even if backend SMS fails
 */

(function () {
  'use strict';

  const BACKEND_URL = 'https://web-production-32acd.up.railway.app';

  const SESSION_ID = (() => {
    let id = localStorage.getItem('sr_session');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sr_session', id); }
    return id;
  })();

  // ── Socket.io ─────────────────────────────────────────────────────
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
      socket.on('incident:new', (incident) => {
        addLiveIncidentToMap(incident);
        showToast(`⚠ New report nearby: ${incident.type}`);
      });
      socket.on('sos:alert', (data) => {
        showToast('🚨 SOS alert triggered nearby — emergency services notified');
      });
      socket.on('stats:users', ({ online }) => {
        const el = document.getElementById('liveUserCount');
        if (el) el.textContent = online + ' online';
      });
    } catch (e) {
      console.warn('[SafeRoute] Socket init failed:', e);
    }
  }

  function addLiveIncidentToMap(incident) {
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

  async function loadNearbyIncidents(lat, lng) {
    try {
      const url = `${BACKEND_URL}/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=5000`;
      const res = await fetch(url);
      if (!res.ok) return;
      const { incidents } = await res.json();
      incidents.forEach(inc => {
        addLiveIncidentToMap({
          lat: inc.location.coordinates[1],
          lng: inc.location.coordinates[0],
          type: inc.type,
          timeAgo: inc.timeAgo,
          description: inc.description
        });
      });
    } catch (e) {
      console.warn('[SafeRoute] Could not load incidents from backend:', e);
    }
  }

  // ── Helper: get fresh GPS coords (with timeout fallback) ──────────
  function getFreshCoords(timeoutMs = 8000) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          lat: typeof _uLat !== 'undefined' ? _uLat : 19.076,
          lng: typeof _uLng !== 'undefined' ? _uLng : 72.877,
          fresh: false
        });
        return;
      }
      const fallbackTimer = setTimeout(() => {
        resolve({
          lat: typeof _uLat !== 'undefined' ? _uLat : 19.076,
          lng: typeof _uLng !== 'undefined' ? _uLng : 72.877,
          fresh: false
        });
      }, timeoutMs);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          // Update the global coords in app.js too
          if (typeof _uLat !== 'undefined') {
            // Can't reassign let, but we can update via window
            try { window._uLat = pos.coords.latitude; window._uLng = pos.coords.longitude; } catch(e){}
          }
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            fresh: true
          });
        },
        () => {
          clearTimeout(fallbackTimer);
          resolve({
            lat: typeof _uLat !== 'undefined' ? _uLat : 19.076,
            lng: typeof _uLng !== 'undefined' ? _uLng : 72.877,
            fresh: false
          });
        },
        { enableHighAccuracy: true, timeout: timeoutMs - 500, maximumAge: 0 }
      );
    });
  }

  // ── Helper: set button into a loading/status state ────────────────
  function setBtnState(btn, text, styleOverrides = {}) {
    btn.textContent = text;
    btn.disabled = !!styleOverrides.disabled;
    btn.style.opacity    = styleOverrides.opacity    || '';
    btn.style.background = styleOverrides.background || '';
    btn.style.color      = styleOverrides.color      || '';
    btn.style.border     = styleOverrides.border     || '';
    btn.style.cursor     = styleOverrides.cursor     || '';
  }

  // ── Core SOS sender — shared by modalShare AND navSos ─────────────
  async function sendSOSWithLocation(triggerBtn, originalBtnText) {

    // ── 1. Immediate feedback ─────────────────────────────────────
    setBtnState(triggerBtn, '📡 Getting your location…', {
      disabled: true, opacity: '0.75', cursor: 'wait'
    });

    // ── 2. Get fresh GPS ─────────────────────────────────────────
    const { lat, lng, fresh } = await getFreshCoords(8000);
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

    if (!fresh) {
      showToast('⚠ Using approximate location — enable GPS for exact position');
    }

    // ── 3. Check contacts have phone numbers ──────────────────────
    const allContacts = typeof contacts !== 'undefined' ? contacts : [];
    const phonedContacts = allContacts.filter(c => c.phone && c.phone.trim() !== '');

    if (phonedContacts.length === 0) {
      // No phones — still share location via Web Share API / clipboard
      setBtnState(triggerBtn, '⚠ No phone numbers saved', {
        disabled: false,
        background: 'var(--amber-l)',
        color: 'var(--amber)',
        border: '1px solid rgba(242,153,0,.3)'
      });
      showToast('⚠ Add phone numbers to your contacts first! Tap a contact → "Add #"');

      // But still try to share location link via native share
      try {
        if (navigator.share) {
          await navigator.share({ title: '🚨 My SOS Location', url: mapsUrl });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(mapsUrl);
          showToast('📋 Location link copied — paste it and send manually');
        }
      } catch (e) { /* share cancelled */ }

      setTimeout(() => setBtnState(triggerBtn, originalBtnText), 3500);
      return;
    }

    // ── 4. Update button: sending SMS ─────────────────────────────
    setBtnState(triggerBtn, `📡 Sending to ${phonedContacts.length} contact${phonedContacts.length !== 1 ? 's' : ''}…`, {
      disabled: true, opacity: '0.8', cursor: 'wait'
    });

    // ── 5. Send SMS via backend ───────────────────────────────────
    let smsSent = 0;
    let smsError = null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          contacts: phonedContacts.map(c => ({ name: c.name, phone: c.phone })),
          sessionId: SESSION_ID
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        smsSent = data.sent || phonedContacts.length;
      } else {
        smsError = data.error || 'Backend returned failure';
      }
    } catch (e) {
      smsError = e.message;
      console.warn('[SafeRoute] SMS backend call failed:', e);
    }

    // ── 6. WhatsApp fallback — ALWAYS fire this regardless of SMS ──
    // This ensures contacts receive SOMETHING even if Twilio fails
    const names = phonedContacts.map(c => c.name).join(', ');
    const waMessage =
      `🚨 *SafeRoute SOS Alert*\n\n` +
      `*${names || 'Someone'} needs help!*\n\n` +
      `📍 Live location:\n${mapsUrl}\n\n` +
      `⏰ Sent at: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n\n` +
      `Please respond immediately or call 112.`;

    // Open WhatsApp with first contact's number if available, else open chat picker
    const firstPhone = phonedContacts[0]?.phone?.replace(/\D/g, '') || '';
    const waUrl = firstPhone
      ? `https://wa.me/${firstPhone}?text=${encodeURIComponent(waMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

    // Small delay so it doesn't pop up at same time as toast
    setTimeout(() => { window.open(waUrl, '_blank'); }, 800);

    // Also share via native Web Share API if supported (opens share sheet)
    if (navigator.share) {
      navigator.share({
        title: '🚨 SafeRoute SOS — My Location',
        text: `I need help! My location: ${mapsUrl}`,
        url: mapsUrl
      }).catch(() => {}); // user may dismiss
    }

    // ── 7. Show result on button ──────────────────────────────────
    if (smsSent > 0) {
      setBtnState(triggerBtn, `✅ SMS sent to ${smsSent} contact${smsSent !== 1 ? 's' : ''}!`, {
        background: 'var(--green-l)',
        color: 'var(--green)',
        border: '1px solid rgba(30,142,62,.3)'
      });
      showToast(`🚨 SOS sent! SMS to ${smsSent} contact${smsSent !== 1 ? 's' : ''} + WhatsApp opened`);
    } else {
      // SMS failed but WhatsApp opened
      setBtnState(triggerBtn, '📱 WhatsApp opened — check app', {
        background: '#dcf8c6',
        color: '#128c7e',
        border: '1px solid rgba(18,140,126,.3)'
      });
      showToast(`⚠ SMS failed — WhatsApp opened with your location. Error: ${smsError}`);
    }

    // Reset button after 5 seconds
    setTimeout(() => setBtnState(triggerBtn, originalBtnText), 5000);
  }


  // ── Wire everything on DOMContentLoaded ───────────────────────────
  document.addEventListener('DOMContentLoaded', () => {

    // ── modalShare: "Share Live Location" inside SOS modal ────────
    const modalShare = document.getElementById('modalShare');
    if (modalShare) {
      const ORIG_TEXT = modalShare.textContent || '📡 Share Live Location';
      modalShare.addEventListener('click', () => {
        sendSOSWithLocation(modalShare, ORIG_TEXT);
      });
    }

    // ── navSos: top navbar SOS button ─────────────────────────────
    // app.js opens the modal — we additionally send SMS + WhatsApp
    const navSos = document.getElementById('navSos');
    if (navSos) {
      navSos.addEventListener('click', async () => {
        // Let app.js open the modal first
        await new Promise(r => setTimeout(r, 100));

        const allContacts = typeof contacts !== 'undefined' ? contacts : [];
        const phonedContacts = allContacts.filter(c => c.phone && c.phone.trim() !== '');
        if (!phonedContacts.length) return; // modal is open, user can act from there

        // Silent background SMS when nav SOS is pressed
        const { lat, lng } = await getFreshCoords(5000);
        try {
          const res = await fetch(`${BACKEND_URL}/api/sos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat, lng,
              contacts: phonedContacts.map(c => ({ name: c.name, phone: c.phone })),
              sessionId: SESSION_ID
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast(`🚨 SOS SMS sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}`);
          }
        } catch (e) {
          console.warn('[SafeRoute] Nav SOS SMS failed:', e);
        }
      });
    }

    // ── Incident submit: also POST to backend ─────────────────────
    const irSubmit = document.getElementById('irSubmit');
    if (irSubmit) {
      irSubmit.addEventListener('click', async () => {
        await new Promise(r => setTimeout(r, 50));
        const lat = typeof _uLat !== 'undefined' ? _uLat : null;
        const lng = typeof _uLng !== 'undefined' ? _uLng : null;
        if (!lat || !lng) return;
        const type        = document.getElementById('irType')?.value  || 'Other';
        const timeAgo     = document.getElementById('irTime')?.value  || 'Just now';
        const description = window._lastIrDesc || '';
        try {
          await fetch(`${BACKEND_URL}/api/incidents`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ lat, lng, type, timeAgo, description, sessionId: SESSION_ID })
          });
        } catch (e) {
          console.warn('[SafeRoute] Could not POST incident to backend:', e);
        }
      }, true);
    }

    // Stash description before app.js clears it
    const irDesc = document.getElementById('irDesc');
    if (irDesc) {
      irDesc.addEventListener('input', () => { window._lastIrDesc = irDesc.value; });
    }

    // ── Load incidents once map is ready ──────────────────────────
    const mapPoll = setInterval(() => {
      if (typeof map !== 'undefined' && map && map.isStyleLoaded && map.isStyleLoaded()) {
        clearInterval(mapPoll);
        const lat = typeof _uLat !== 'undefined' ? _uLat : 19.076;
        const lng = typeof _uLng !== 'undefined' ? _uLng : 72.877;
        loadNearbyIncidents(lat, lng);
        if (socket) socket.emit('user:location', { lat, lng });
      }
    }, 500);

    injectLiveBadge();
  });

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

  function showToast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3400);
  }

})();
