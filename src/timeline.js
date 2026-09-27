export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const mix = (a, b, p) => a + (b - a) * p;
export const progress = (p, a, b) => clamp((p - a) / (b - a));
export const smooth = (p, a, b) => { const t = progress(p, a, b); return t * t * (3 - 2 * t); };
export const windowFade = (p, a, b, c, d) => smooth(p, a, b) * (1 - smooth(p, c, d));
export function track(p, keys) {
  for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], smooth(p, keys[i - 1][0], keys[i][0]));
  return keys.at(-1)[1];
}

export function createTimeline() {
  const scenes = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map(e => [e.dataset.scene, e]));
  const left = document.querySelector('.hero-left'), right = document.querySelector('.hero-right');
  const panel = document.querySelector('.scan-panel'), bento = document.querySelector('.bento-content');
  const cards = [...document.querySelectorAll('.orbit-card')];
  const tiles = [...document.querySelectorAll('.tile')];
  const links = [...document.querySelectorAll('.dock a')];
  const anchors = [...document.querySelectorAll('.journey-track > span')];
  const stops = [0, .315, .555, .755, .945];
  const chapterLabel = document.querySelector('#chapter-label');
  const chapterNumber = document.querySelector('#journey-number');
  const bar = document.querySelector('.journey-progress > span');
  const replay = document.querySelector('#replay');
  let scrollLength = 0, lastIndex = -1;
  function resize() {
    scrollLength = document.querySelector('.journey-track').offsetHeight - innerHeight;
    anchors.forEach(a => a.style.top = Number(a.dataset.stop) * scrollLength + 'px');
  }
  function navigate(value, immediate = false) {
    scrollTo({ top: value * scrollLength, behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', event => {
    const anchor = anchors.find(e => '#' + e.id === a.hash);
    if (!anchor) return;
    event.preventDefault(); history.replaceState(null, '', a.hash); navigate(Number(anchor.dataset.stop));
  }));
  document.querySelector('#next-chapter').addEventListener('click', () => {
    const current = scrollY / scrollLength;
    navigate([.17, .315, .405, .49, .555, .62, .755, .84, .945, 1].find(p => p > current + .02) ?? 0);
  });
  replay.addEventListener('click', () => navigate(0));
  function show(name, opacity, transform = '', interactive = true) {
    const e = scenes[name]; const visible = opacity > .005;
    e.style.opacity = opacity.toFixed(4); e.style.transform = transform;
    e.classList.toggle('is-active', visible);
    e.classList.toggle('is-interactive', opacity > .55 && interactive);
    e.inert = opacity < .55 || !interactive;
    e.setAttribute('aria-hidden', String(opacity < .05));
  }
  function update(p, pointer, reduced) {
    const mobile = innerWidth < 650;
    const heroExit = smooth(p, .065, .155);
    show('hero', 1 - smooth(p, .09, .145), reduced ? '' : `scale(${1 + heroExit * .8})`);
    left.style.transform = reduced ? '' : `translate3d(${-heroExit * innerWidth * .35 - pointer.x * 9}px,${-heroExit * 65}px,0)`;
    right.style.transform = reduced ? '' : `translate3d(${heroExit * innerWidth * .4 + pointer.x * 12}px,${heroExit * 55}px,0)`;
    show('tunnel', windowFade(p, .21, .227, .245, .27), `scale(${mix(.65, 1.45, progress(p, .20, .28))})`, false);
    show('signal', windowFade(p, .277, .3, .332, .369), reduced ? '' : `translateY(${-smooth(p, .335, .37) * innerHeight * .6}px) scale(${1 + smooth(p, .33, .38) * .16})`);
    const scanIn = smooth(p, .333, .383), scanOut = smooth(p, .426, .468);
    show('scan', windowFade(p, .335, .365, .432, .461), reduced ? '' : `translate3d(0,${mix(innerHeight * .65, 0, scanIn) - scanOut * innerHeight * .3}px,${mix(-950, 0, scanIn) + scanOut * 550}px) rotateX(${mix(27, 0, scanIn) - scanOut * 15}deg)`);
    panel.style.transform = reduced ? '' : `rotateY(${pointer.x * 4}deg) rotateX(${-pointer.y * 3}deg)`;
    show('dna', windowFade(p, .458, .48, .502, .533), reduced ? '' : `translateY(${mix(30, -60, progress(p, .455, .534))}px) scale(${mix(.8, 1.18, progress(p, .455, .534))})`, false);
    show('orbit', windowFade(p, .515, .54, .65, .69), reduced ? '' : `translateZ(${smooth(p, .652, .693) * 800}px) rotateX(${-smooth(p, .65, .693) * 9}deg)`);
    const turn = mix(-.55, 2.62, progress(p, .53, .65));
    const radius = mobile ? innerWidth * .77 : Math.min(innerWidth * .37, 690);
    cards.forEach((card, i) => {
      const angle = (i - turn) * .94;
      const front = (Math.cos(angle) + 1) / 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * 290 - 280;
      const y = Math.sin(angle) * (mobile ? 28 : 62) + (1 - front) * 20;
      card.style.transform = `translate3d(${x + pointer.x * 9}px,${y - pointer.y * 6}px,${z}px) rotateY(${-angle * 30}deg)`;
      card.style.opacity = String(clamp(front * 1.12, .12, 1));
      card.style.zIndex = String(Math.round(front * 100));
      card.style.filter = `brightness(${.55 + front * .45})`;
      card.inert = front < .3 || p < .535 || p > .667;
    });
    const bentoOpacity = windowFade(p, .686, .719, .865, .91);
    const bentoPan = mix(innerHeight * .46, -innerHeight * .18, progress(p, .705, .865));
    const bentoExit = smooth(p, .87, .914);
    show('bento', bentoOpacity, reduced ? '' : `translateZ(${bentoExit * 600}px) rotateX(${-bentoExit * 15}deg)`);
    bento.style.transform = `translate(-50%,calc(-50% + ${bentoPan}px))`;
    tiles.forEach((tile, i) => {
      const enter = smooth(p, .703 + i * .006, .751 + i * .006);
      tile.style.opacity = String(enter);
      tile.style.transform = reduced ? '' : `perspective(900px) translateY(${(1 - enter) * (80 + i * 8)}px) rotateX(${(1 - enter) * 14}deg) rotateY(${pointer.x * (i % 2 ? -1 : 1) * 2}deg)`;
    });
    show('end', windowFade(p, .9, .928, .966, .989), reduced ? '' : `translateY(${-smooth(p, .967, .994) * innerHeight * .7}px)`);
    show('footer', smooth(p, .976, .998), `translateY(${(1 - smooth(p, .973, 1)) * innerHeight * .45}px)`);
    const index = p < .27 ? 0 : p < .455 ? 1 : p < .687 ? 2 : p < .9 ? 3 : 4;
    if (index !== lastIndex) {
      links.forEach((link, i) => { link.classList.toggle('active', i === index); if (i === index) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
      lastIndex = index;
    }
    chapterNumber.textContent = `${String(p < .14 ? 1 : p < .28 ? 2 : p < .46 ? 3 : p < .69 ? 4 : p < .90 ? 5 : 6).padStart(2, '0')} / 06`;
    chapterLabel.textContent = p < .10 ? 'Листайте, чтобы погрузиться' : p < .28 ? 'Внутри идеи' : p < .455 ? 'Исследуем форму' : p < .69 ? 'На новой орбите' : p < .9 ? 'Независимое мышление' : 'Начало новой истории';
    bar.style.transform = `scaleY(${p})`;
    replay.style.opacity = String(smooth(p, .92, .97)); replay.style.pointerEvents = p > .94 ? 'auto' : 'none';
  }
  resize();
  return { update, resize, navigate, get length() { return scrollLength; }, anchors, stops };
}
