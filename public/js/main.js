(async function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- Nav scroll state (set up first so it works even if config fails) ---
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const config = await fetch('/api/config').then(r => r.json());
  const weddingDate = new Date(config.weddingDate);
  // Always show the date/time as it is at the venue, whatever the guest's device zone
  const TZ = 'Africa/Harare';

  // --- Names ---
  const { partner1, partner2 } = config.couple;
  $('name-1').textContent = partner1;
  $('name-2').textContent = partner2;
  document.title = `${partner1} & ${partner2} — ${weddingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })}`;

  // --- Dates ---
  const longDate = weddingDate.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
  });
  const time = weddingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  $('hero-tagline').textContent = config.tagline;
  $('hero-date').textContent = longDate;
  $('hero-time').textContent = time;
  $('hero-venue').textContent = config.venue.name;
  $('footer-date').textContent = `${weddingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })}, ${config.venue.name}`;

  const deadline = new Date(config.rsvpDeadline + 'T23:59:59');
  $('rsvp-deadline').textContent = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  $('rsvp-deadline-2').textContent = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // --- Countdown (a quiet line of text, updated once a minute) ---
  function tick() {
    const diff = weddingDate - new Date();
    const el = $('countdown');
    if (diff <= 0) { el.textContent = 'Today is the day.'; return; }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000) % 24;
    el.textContent = days > 0
      ? `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'} to go`
      : `${hours} hour${hours === 1 ? '' : 's'} to go`;
  }
  tick();
  setInterval(tick, 60000);

  // --- Story & schedule ---
  $('story-text').textContent = config.story;

  $('timeline').innerHTML = (config.schedule || []).map(item => `
    <li class="timeline-item">
      <span class="timeline-time">${esc(item.time)}</span>
      <span class="timeline-dot" aria-hidden="true"></span>
      <div class="timeline-body">
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.note || '')}</p>
      </div>
    </li>`).join('');

  // --- Venue ---
  const { name, address, mapQuery } = config.venue;
  const query = encodeURIComponent(mapQuery || `${name}, ${address}`);
  $('venue-name').textContent = name;
  $('venue-address').textContent = address;
  $('venue-time').textContent = `${longDate} at ${time}`;
  $('map').src = `https://maps.google.com/maps?q=${query}&z=14&output=embed`;
  $('directions-link').href = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  // --- Gallery + lightbox ---
  const photos = await fetch('/api/photos').then(r => r.json()).catch(() => []);
  const grid = $('gallery-grid');
  if (photos.length === 0) {
    $('gallery-empty').hidden = false;
  } else {
    photos.forEach((src, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.setAttribute('aria-label', `Open photo ${i + 1} of ${photos.length}`);
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${partner1} and ${partner2}`;
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', () => openLightbox(i));
      grid.appendChild(btn);
    });
  }

  const lightbox = $('lightbox');
  const lbImg = $('lightbox-img');
  let current = 0;
  function show(i) {
    current = (i + photos.length) % photos.length;
    lbImg.src = photos[current];
    lbImg.alt = `Photo ${current + 1} of ${photos.length}`;
  }
  function openLightbox(i) {
    show(i);
    if (typeof lightbox.showModal === 'function') lightbox.showModal();
    else window.open(photos[i], '_blank');
  }
  $('lightbox-close').addEventListener('click', () => lightbox.close());
  $('lightbox-prev').addEventListener('click', () => show(current - 1));
  $('lightbox-next').addEventListener('click', () => show(current + 1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  // --- RSVP form ---
  const form = $('rsvp-form');
  const status = $('form-status');
  const guestsField = $('guests-field');
  const submitBtn = $('rsvp-submit');

  form.addEventListener('change', () => {
    const attending = form.querySelector('input[name="attending"]:checked');
    guestsField.hidden = !!(attending && attending.value === 'no');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = '';
    const attending = form.querySelector('input[name="attending"]:checked');
    if (!form.name.value.trim()) { status.textContent = 'Enter your full name.'; form.name.focus(); return; }
    if (!attending) { status.textContent = 'Choose whether you will attend.'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.value,
          phone: form.phone.value,
          email: form.email.value,
          attending: attending.value,
          guests: form.guests.value,
          message: form.message.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Your RSVP could not be sent. Try again.');
      form.hidden = true;
      if (attending.value === 'no') {
        $('thanks-text').textContent = "Thank you for letting us know. You'll be missed.";
      }
      const thanks = $('rsvp-thanks');
      thanks.hidden = false;
      thanks.focus();
    } catch (err) {
      status.textContent = err.message === 'Failed to fetch'
        ? 'Your RSVP could not be sent. Check your connection and try again.'
        : err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send RSVP';
    }
  });
})();
