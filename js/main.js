// Probes images/gallery/ for photo-1.jpg, photo-2.jpg, ... (stopping at the
// first missing number) and builds the hero photo strip from whatever it
// finds. Add or remove files there and the gallery grows/shrinks on its own
// — no HTML edits needed.
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function buildGallery() {
  const wrapper = document.querySelector('.hero-gallery');
  const track = document.querySelector('.gallery-track');
  if (!wrapper || !track) return;

  const MAX_PHOTOS = 40;
  const checks = await Promise.all(
    Array.from({ length: MAX_PHOTOS }, (_, i) => loadImage(`images/gallery/photo-${i + 1}.jpg`))
  );

  const photos = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    if (!checks[i]) break;
    photos.push(`images/gallery/photo-${i + 1}.jpg`);
  }

  if (photos.length === 0) {
    wrapper.remove();
    return;
  }

  // Repeat the found photos so the strip stays visually full even with
  // just one or two images, then duplicate that whole set once more so
  // the CSS marquee (translateX -50%) loops seamlessly.
  const repeats = Math.max(1, Math.ceil(6 / photos.length));
  const set = Array.from({ length: repeats }, () => photos).flat();

  const makeItem = (src, isDuplicate) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.index = photos.indexOf(src);
    const img = document.createElement('img');
    img.src = src;
    if (isDuplicate) {
      item.setAttribute('aria-hidden', 'true');
      img.alt = '';
    } else {
      img.alt = 'Ag-Hydrology Laboratory fieldwork photo';
    }
    item.appendChild(img);
    return item;
  };

  set.forEach(src => track.appendChild(makeItem(src, false)));
  set.forEach(src => track.appendChild(makeItem(src, true)));

  setupGalleryScroll(wrapper, track);
  setupLightbox(wrapper, photos);
}

// The strip drifts by nudging scrollLeft rather than animating a transform,
// so the user can grab it, flick it, or wheel through it at any time. The
// second (duplicate) half of the track is what makes the wrap seamless.
function setupGalleryScroll(wrapper, track) {
  const PX_PER_SECOND = 55;
  const RESUME_DELAY = 1400;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const half = () => track.scrollWidth / 2;
  let resumeAt = 0;
  let dragging = false;
  let lastX = 0;
  let moved = 0;
  let prevLeft = 0;

  const hold = () => { resumeAt = performance.now() + RESUME_DELAY; };

  // Keep scrollLeft inside the first copy of the set so the loop never ends.
  wrapper.addEventListener('scroll', () => {
    const h = half();
    if (!h) return;
    if (wrapper.scrollLeft >= h) wrapper.scrollLeft -= h;
    else if (wrapper.scrollLeft <= 0 && prevLeft > 2) wrapper.scrollLeft = h - 1;
    prevLeft = wrapper.scrollLeft;
  });

  wrapper.addEventListener('wheel', hold, { passive: true });
  wrapper.addEventListener('touchstart', hold, { passive: true });
  wrapper.addEventListener('mouseenter', hold);
  wrapper.addEventListener('mouseleave', hold);

  wrapper.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // native touch scrolling handles this
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    wrapper.classList.add('is-dragging');
    wrapper.setPointerCapture(e.pointerId);
  });

  wrapper.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    wrapper.scrollLeft -= dx;
    hold();
  });

  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    wrapper.classList.remove('is-dragging');
    if (wrapper.hasPointerCapture?.(e.pointerId)) wrapper.releasePointerCapture(e.pointerId);
    hold();
  };
  wrapper.addEventListener('pointerup', endDrag);
  wrapper.addEventListener('pointercancel', endDrag);

  // A drag that travelled more than a few pixels shouldn't also count as a
  // click on the photo underneath.
  wrapper.addEventListener('click', e => {
    if (moved > 6) { e.stopPropagation(); moved = 0; }
  }, true);

  if (reduceMotion) return;

  let last = 0;
  const step = now => {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    const idle = now > resumeAt && !dragging && !document.hidden
      && !document.body.classList.contains('lightbox-open');
    if (idle) wrapper.scrollLeft += PX_PER_SECOND * dt;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Click a photo to open it full size; arrows or the keyboard step through
// the set, Escape or a click on the backdrop closes it.
function setupLightbox(wrapper, photos) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
    <button class="lightbox-prev" type="button" aria-label="Previous photo">&#8249;</button>
    <button class="lightbox-next" type="button" aria-label="Next photo">&#8250;</button>
    <img alt="Ag-Hydrology Laboratory fieldwork photo">
    <div class="lightbox-count"></div>`;
  document.body.appendChild(box);

  const img = box.querySelector('img');
  const count = box.querySelector('.lightbox-count');
  const multiple = photos.length > 1;
  box.querySelector('.lightbox-prev').hidden = !multiple;
  box.querySelector('.lightbox-next').hidden = !multiple;

  let current = 0;

  const show = i => {
    current = (i + photos.length) % photos.length;
    img.src = photos[current];
    count.textContent = multiple ? `${current + 1} / ${photos.length}` : '';
  };

  const open = i => {
    show(i);
    box.classList.add('open');
    document.body.classList.add('lightbox-open');
    box.querySelector('.lightbox-close').focus();
  };

  const close = () => {
    box.classList.remove('open');
    document.body.classList.remove('lightbox-open');
  };

  wrapper.addEventListener('click', e => {
    const item = e.target.closest('.gallery-item');
    if (item) open(Number(item.dataset.index) || 0);
  });

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-prev').addEventListener('click', e => {
    e.stopPropagation();
    show(current - 1);
  });
  box.querySelector('.lightbox-next').addEventListener('click', e => {
    e.stopPropagation();
    show(current + 1);
  });
  box.addEventListener('click', e => { if (e.target === box) close(); });

  document.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
  });
}

// This code runs only after all page sections (partials) have finished loading.
// See js/include.js for how sections are loaded and the 'includesLoaded' event.
document.addEventListener('includesLoaded', () => {
  buildGallery();

  // mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', false);
  }));

  // scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { 
  threshold: 0.01,              // Trigger as soon as 1% is visible
  rootMargin: '0px 0px 50px 0px'  // Pre-trigger 50px before entering viewport
});
  revealEls.forEach(el => io.observe(el));

  // Fade out scroll cue on scroll
  const scrollCue = document.querySelector('.scroll-cue');
  if (scrollCue) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        scrollCue.style.opacity = '0';
      } else {
        scrollCue.style.opacity = '1';
      }
    });
  }

});
