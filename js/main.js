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

  // Keep the scroll speed visually consistent no matter how many photos
  // are in the strip.
  requestAnimationFrame(() => {
    const setWidth = track.scrollWidth / 2;
    const pxPerSecond = 55;
    const duration = Math.min(90, Math.max(14, setWidth / pxPerSecond));
    track.style.animationDuration = `${duration}s`;
  });

  initLightbox(track, photos);
}

// Click-to-enlarge lightbox for the hero gallery. Every strip item (including
// the duplicated ones used for the seamless marquee loop) opens the same
// underlying `photos` list, indexed by src so prev/next stay in sync.
function initLightbox(track, photos) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <button class="lightbox-prev" aria-label="Previous photo">&#10094;</button>
    <img class="lightbox-img" alt="">
    <button class="lightbox-next" aria-label="Next photo">&#10095;</button>
  `;
  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector('.lightbox-img');
  let index = 0;

  const show = (i) => {
    index = (i + photos.length) % photos.length;
    imgEl.src = photos[index];
  };
  const open = (i) => {
    show(i);
    overlay.classList.add('open');
    document.body.classList.add('lightbox-lock');
  };
  const close = () => {
    overlay.classList.remove('open');
    document.body.classList.remove('lightbox-lock');
  };

  track.querySelectorAll('.gallery-item').forEach(item => {
    item.style.cursor = 'zoom-in';
    item.addEventListener('click', () => {
      const src = item.querySelector('img').getAttribute('src');
      open(photos.indexOf(src));
    });
  });

  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  overlay.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
  overlay.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
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
