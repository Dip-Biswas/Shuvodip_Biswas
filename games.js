const picker = document.querySelector('#picker');
const player = document.querySelector('#player');
const stage = document.querySelector('#stage');
const cards = [...document.querySelectorAll('[data-game]')];
const back = document.querySelector('#return');
const title = document.querySelector('#playing-title');
let observer;
let activeCard;

function showSelection() {
  const card = cards.find(link => '#' + link.dataset.game === location.hash);
  observer?.disconnect();
  stage.replaceChildren();
  picker.hidden = Boolean(card);
  player.hidden = !card;
  if (!card) {
    document.title = 'Play Games With Me | Shuvodip Biswas';
    activeCard?.focus();
    activeCard = null;
    return;
  }
  activeCard = card;
  const name = card.querySelector('h2').textContent;
  title.textContent = name;
  document.title = name + ' | Play Games With Me';
  document.querySelector('#direct').href = card.href;
  const frame = document.createElement('iframe');
  frame.title = name + ' match against Shuvodip';
  frame.src = card.href + '?view=games';
  frame.addEventListener('load', () => {
    if (frame.parentNode !== stage || !frame.contentDocument?.body) return;
    const body = frame.contentDocument.body;
    function fit() {
      frame.style.height = Math.ceil(body.getBoundingClientRect().height) + 'px';
    }
    observer = new ResizeObserver(fit);
    observer.observe(body);
    fit();
  }, {once: true});
  stage.append(frame);
  title.focus({preventScroll:true});
  window.scrollTo(0,0);
}

for (const card of cards) {
  card.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    location.hash = card.dataset.game;
  });
}
back.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState(null, '', location.pathname + location.search);
  showSelection();
});
window.addEventListener('hashchange', showSelection);
showSelection();
