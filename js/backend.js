// ── Patch modalShare button: send SOS SMS via backend ─────────
const modalShare = document.getElementById('modalShare');
if (modalShare) {
  modalShare.addEventListener('click', async () => {

    // ── IMMEDIATE FEEDBACK (fixes the "nothing happens" bug) ──
    const origText = modalShare.textContent;
    modalShare.disabled = true;
    modalShare.textContent = '📡 Getting location…';
    modalShare.style.opacity = '0.7';

    // ── Step 1: Get fresh GPS coords ─────────────────────────
    let lat = typeof _uLat !== 'undefined' ? _uLat : null;
    let lng = typeof _uLng !== 'undefined' ? _uLng : null;

    if (navigator.geolocation) {
      await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            resolve();
          },
          () => resolve(), // fall back to stale coords silently
          { timeout: 6000, enableHighAccuracy: true }
        );
      });
    }

    // ── Step 2: Share location link immediately ───────────────
    const locationUrl = `https://maps.google.com/?q=${lat || 19.076},${lng || 72.877}`;
    modalShare.textContent = '📡 Sharing location…';

    if (navigator.share) {
      navigator.share({
        title: '🚨 SafeRoute SOS — My Location',
        url: locationUrl
      }).catch(() => {
        // Share sheet dismissed — copy to clipboard as fallback
        if (navigator.clipboard) {
          navigator.clipboard.writeText(locationUrl)
            .then(() => showToast('📋 Location link copied to clipboard!'))
            .catch(() => showToast('📍 Location: ' + locationUrl));
        }
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(locationUrl)
        .then(() => showToast('📋 Location link copied!'))
        .catch(() => showToast('📍 Your location: ' + locationUrl));
    } else {
      // Last resort — show the URL in a toast
      showToast('📍 Location: ' + locationUrl);
    }

    // ── Step 3: Send SMS via backend ─────────────────────────
    const contactList = typeof contacts !== 'undefined' ? contacts : [];
    const phonedContacts = contactList.filter(c => c.phone);

    if (!lat || !lng) {
      showToast('⚠ Could not get GPS — enable location in browser settings');
      resetBtn();
      return;
    }

    if (!phonedContacts.length) {
      // Location was still shared above — just note SMS didn't fire
      showToast('📋 Location copied! Add contact phone numbers to also send SMS alerts.');
      resetBtn();
      return;
    }

    modalShare.textContent = `📡 Sending SMS to ${phonedContacts.length} contact${phonedContacts.length !== 1 ? 's' : ''}…`;

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
        modalShare.textContent = `✅ Sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}!`;
        modalShare.style.background = 'var(--green-l)';
        modalShare.style.color = 'var(--green)';
        modalShare.style.borderColor = 'rgba(30,142,62,.3)';
        showToast(`📱 SOS sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}!`);
      } else {
        showToast('⚠ SMS failed — location was still shared above');
        resetBtn();
      }
    } catch (e) {
      console.warn('[SafeRoute] SOS backend call failed:', e);
      showToast('⚠ Could not reach server — location link was still shared');
      resetBtn();
    }

    // Re-enable after 4 seconds
    setTimeout(resetBtn, 4000);

    function resetBtn() {
      modalShare.disabled = false;
      modalShare.textContent = origText;
      modalShare.style.opacity = '';
      modalShare.style.background = '';
      modalShare.style.color = '';
      modalShare.style.borderColor = '';
    }
  });
}
