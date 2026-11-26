'use strict';

const total = 24;
const openingTimes = Array.from({ length: total }, (_, index) =>
  Date.parse('2026-12-' + String(index + 1).padStart(2, '0') + 'T00:00:00+01:00')
);
const simulation = new URLSearchParams(location.search).get('vorschau') === '24';
const now = () => simulation ? openingTimes[23] : Date.now();
const storageKey = 'frotti-lotti-opened-2026';
const first23 = () => new Set(Array.from({ length: 23 }, (_, index) => index + 1));

function readOpened() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(saved) ? saved.filter((day) =>
      Number.isInteger(day) && day >= 1 && day <= total) : []);
  } catch {
    return new Set();
  }
}

let opened = simulation ? first23() : readOpened();
function remember(day) {
  if (!simulation) readOpened().forEach((previous) => opened.add(previous));
  opened.add(day);
  if (!simulation) {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...opened]));
    } catch {
      // Opening remains available when browser storage is disabled.
    }
  }
}

const grid = document.querySelector('#grid');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const countdown = document.querySelector('#countdown');
const preview = document.querySelector('#preview');
const title = document.querySelector('#sticker-title');
const cardList = document.querySelector('#sticker-cards');
const gift = document.querySelector('#gift-opening');
const replay = document.querySelector('#reset-preview');
const tileStates = [];
const tiles = openingTimes.map((_, index) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  tile.addEventListener('click', () => showDoor(index + 1));
  grid.append(tile);
  return tile;
});

function stickerPath(id) {
  return 'stickers/' + String(id).padStart(2, '0') + '.png';
}

function makeCard(id, label) {
  const card = document.createElement('article');
  card.className = 'sticker-card';
  const picture = document.createElement('img');
  picture.src = stickerPath(id);
  picture.alt = label;
  picture.width = picture.height = 512;
  picture.loading = 'lazy';
  const name = document.createElement('p');
  name.textContent = label;
  const actions = document.createElement('div');
  actions.className = 'actions';
  const download = document.createElement('a');
  download.className = 'action';
  download.href = picture.src;
  download.download = 'frotti-lotti-' + String(id).padStart(2, '0') + '.png';
  download.textContent = 'PNG herunterladen';
  download.setAttribute('aria-label', label + ' als PNG herunterladen');
  actions.append(download);

  if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'action';
    share.textContent = 'Teilen / in Fotos sichern';
    share.hidden = true;
    let preparing = false;
    share.addEventListener('pointerenter', prepareShare, { once: true });
    picture.addEventListener('load', prepareShare, { once: true });
    if (picture.complete && picture.naturalWidth) prepareShare();
    async function prepareShare() {
      if (preparing) return;
      preparing = true;
      try {
        const response = await fetch(download.href);
        if (!response.ok) return;
        const file = new File([await response.blob()], download.download, { type: 'image/png' });
        if (!navigator.canShare({ files: [file] })) return;
        share.addEventListener('click', async () => {
          try {
            await navigator.share({ files: [file] });
          } catch (error) {
            if (error.name !== 'AbortError') {
              name.textContent = label + ' · Das Teilen-Menü war nicht verfügbar.';
            }
          }
        });
        share.hidden = false;
      } catch {
        // Download remains available.
      }
    }
    actions.append(share);
  }

  card.append(picture, name, actions);
  return card;
}

let animationTimer;
function showDoor(day) {
  if (now() < openingTimes[day - 1] || preview.open) return;
  const firstOpen = !opened.has(day);
  remember(day);
  render();
  title.textContent = day === 24 ? 'Frohe Weihnachten!' : 'Türchen ' + day;
  const cards = [makeCard(day, day === 24 ? 'Weihnachtssticker' : 'Sticker ' + day)];
  if (day === 24) {
    const heading = document.createElement('h3');
    heading.textContent = '8 Bonus-Sticker';
    cards.push(heading);
    for (let bonus = 1; bonus <= 8; bonus++) {
      cards.push(makeCard('24.' + bonus, 'Bonus ' + bonus));
    }
  }
  const animate = firstOpen && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  cardList.replaceChildren(...cards);
  cardList.hidden = animate;
  gift.hidden = !animate;
  preview.showModal();
  preview.scrollTop = 0;
  if (animate) {
    animationTimer = setTimeout(() => {
      gift.hidden = true;
      cardList.hidden = false;
    }, 950);
  }
}

preview.addEventListener('close', () => {
  clearTimeout(animationTimer);
  gift.hidden = true;
});

function formatCountdown(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const parts = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return (days ? days + (days === 1 ? ' Tag · ' : ' Tage · ') : '') +
    parts.map((value) => String(value).padStart(2, '0')).join(':');
}

function render() {
  const time = now();
  const next = openingTimes.findIndex((opening) => opening > time);
  const available = next === -1 ? total : next;
  const unwrapped = [...opened].filter((day) => day <= available).length;
  const message = unwrapped + ' von 24 ausgepackt · ' + (available < total
    ? 'Türchen ' + (available + 1) + ' öffnet am ' + (available + 1) + '. Dezember um 00:00 Uhr deutscher Zeit.'
    : unwrapped === total ? 'Dein Album ist komplett!' : 'Alle Türchen sind freigeschaltet.');
  progress.value = unwrapped;
  if (status.textContent !== message) status.textContent = message;
  countdown.hidden = available === total;
  if (available < total) countdown.textContent = formatCountdown(openingTimes[available] - time);

  tiles.forEach((tile, index) => {
    const day = index + 1;
    const state = day > available ? 'locked' : opened.has(day) ? 'opened' : 'ready';
    if (tileStates[index] === state) return;
    tileStates[index] = state;
    tile.dataset.state = state;
    tile.disabled = state === 'locked';
    const symbol = document.createElement(state === 'opened' ? 'img' : 'span');
    symbol.className = 'symbol';
    symbol.setAttribute('aria-hidden', 'true');
    if (state === 'opened') {
      symbol.src = stickerPath(day);
      symbol.alt = '';
      symbol.loading = 'lazy';
    } else {
      symbol.textContent = state === 'ready' ? '🎁' : '🔒';
    }
    const number = document.createElement('b');
    number.textContent = day;
    const label = document.createElement('small');
    label.textContent = state === 'opened' ? 'Geöffnet' : state === 'ready' ? 'Auspacken' : 'Geschlossen';
    tile.replaceChildren(symbol, number, label);
    tile.setAttribute('aria-label', 'Türchen ' + day + ' · ' + label.textContent);
  });
}

if (simulation) {
  document.querySelector('#preview-notice').hidden = false;
  replay.addEventListener('click', () => {
    opened = first23();
    render();
    tiles[23].focus();
  });
} else {
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) {
      opened = readOpened();
      render();
    }
  });
}
render();
window.addEventListener('pageshow', render);
document.addEventListener('visibilitychange', render);
setInterval(render, 250);
