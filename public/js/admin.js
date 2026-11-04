(function () {
  const $ = id => document.getElementById(id);
  const loginView = $('login-view');
  const adminView = $('admin-view');

  async function checkSession() {
    const { authed } = await fetch('/api/session').then(r => r.json());
    loginView.hidden = authed;
    adminView.hidden = !authed;
    if (authed) {
      loadPhotos();
      loadRsvps();
    }
  }

  // --- Login / logout ---

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-error').textContent = '';
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('password').value })
    });
    if (res.ok) {
      $('password').value = '';
      checkSession();
    } else {
      const data = await res.json().catch(() => ({}));
      $('login-error').textContent = data.error || 'Sign in failed';
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    checkSession();
  });

  // --- Photos ---

  async function loadPhotos() {
    const photos = await fetch('/api/photos').then(r => r.json());
    const grid = $('photo-grid');
    grid.innerHTML = '';
    $('photos-empty').hidden = photos.length > 0;
    photos.forEach(src => {
      const tile = document.createElement('div');
      tile.className = 'photo-tile';
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Wedding photo';
      img.loading = 'lazy';
      const del = document.createElement('button');
      del.textContent = '✕';
      del.title = 'Delete photo';
      del.setAttribute('aria-label', 'Delete photo');
      del.addEventListener('click', async () => {
        if (!confirm('Delete this photo from the gallery?')) return;
        const name = src.split('/').pop();
        const res = await fetch(`/api/photos/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (res.ok) loadPhotos();
      });
      tile.append(img, del);
      grid.appendChild(tile);
    });
  }

  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  const uploadStatus = $('upload-status');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

  ['dragover', 'dragenter'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragover'); })
  );
  dropZone.addEventListener('drop', e => uploadFiles(e.dataTransfer.files));

  async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    [...files].forEach(f => formData.append('photos', f));
    uploadStatus.textContent = `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`;
    try {
      const res = await fetch('/api/photos', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploadStatus.textContent = `Uploaded ${data.uploaded} photo${data.uploaded !== 1 ? 's' : ''}. They're live in the gallery.`;
      fileInput.value = '';
      loadPhotos();
    } catch (err) {
      uploadStatus.textContent = err.message;
    }
  }

  // --- RSVPs ---

  async function loadRsvps() {
    const rsvps = await fetch('/api/rsvps').then(r => r.json());
    const body = $('rsvp-body');
    body.innerHTML = '';
    $('rsvps-empty').hidden = rsvps.length > 0;
    $('rsvp-table').style.display = rsvps.length ? '' : 'none';

    let yes = 0, no = 0, guests = 0;
    rsvps.slice().reverse().forEach(r => {
      if (r.attending === 'yes') { yes++; guests += r.guests; } else { no++; }
      const tr = document.createElement('tr');
      const cells = [
        r.name,
        r.phone || '—',
        r.email || '—',
        null, // attending pill
        r.attending === 'yes' ? String(r.guests) : '—',
        r.message || '—',
        new Date(r.submittedAt).toLocaleDateString()
      ];
      cells.forEach((text, i) => {
        const td = document.createElement('td');
        if (i === 3) {
          const pill = document.createElement('span');
          pill.className = 'pill ' + (r.attending === 'yes' ? 'pill-yes' : 'pill-no');
          pill.textContent = r.attending === 'yes' ? 'Yes' : 'No';
          td.appendChild(pill);
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    $('sum-yes').textContent = yes;
    $('sum-no').textContent = no;
    $('sum-guests').textContent = guests;
  }

  checkSession();
})();
