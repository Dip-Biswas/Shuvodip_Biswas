import {Chess} from './chess-rules.js';
import {chooseMove} from './chess-opponent.js';

if (window.self !== window.top && new URLSearchParams(location.search).get('view') === 'games') {
  document.documentElement.classList.add('embedded');
}
const game = new Chess();
const board = document.querySelector('#board');
const squares = new Map();
const pieces = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
const names = {p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const files = 'abcdefgh';
const promotion = document.querySelector('#promotion');
let selected = '', legal = [], promoting = '', cursor = 'e2', worker = null, searchId = 0;

for (let rank=8;rank>=1;rank--) {
  for (const file of files) {
    const square = file+rank;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.square = square;
    button.className = 'square';
    button.classList.toggle('alt', (files.indexOf(file)+8-rank)%2===1);
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden','true');
    button.append(glyph);
    for (const [visible, label, position] of [[file==='a',rank,'rank'],[rank===1,file,'file']]) {
      if (!visible) continue;
      const coord = document.createElement('span');
      coord.className = 'coord '+position;
      coord.textContent = label;
      button.append(coord);
    }
    squares.set(square,button);
    board.append(button);
  }
}
function clearSelection() {
  selected = ''; legal = []; promoting = '';
  promotion.hidden = true;
}
function status() {
  if (game.isCheckmate()) return game.turn()==='w' ? 'Checkmate. Shuvodip wins.' : 'Checkmate. You win!';
  if (game.isStalemate()) return 'Draw by stalemate.';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material.';
  if (game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
  if (game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
  if (promoting) return 'Choose a promotion piece.';
  if (game.turn()==='b') return game.isCheck() ? 'Shuvodip is in check and thinking…' : 'Shuvodip is thinking…';
  return game.isCheck() ? 'Your king is in check.' : 'Your move.';
}
function render() {
  const history = game.history({verbose:true});
  const last = history.at(-1);
  const checked = game.isCheck();
  for (const [square, button] of squares) {
    const piece = game.get(square);
    const glyph = button.firstElementChild;
    glyph.textContent = piece ? pieces[piece.type]+'\uFE0E' : '';
    glyph.className = 'piece' + (piece?.color === 'w' ? ' white' : '');
    const target = legal.some(move => move.to === square);
    button.classList.toggle('target',target);
    button.classList.toggle('occupied',Boolean(piece));
    button.classList.toggle('last',square===last?.from || square===last?.to);
    button.classList.toggle('selected',square===selected);
    button.classList.toggle('check',checked && piece?.type==='k' && piece.color===game.turn());
    const label = piece ? (piece.color==='w'?'White ':'Black ')+names[piece.type] : 'empty';
    button.setAttribute('aria-label',square+', '+label+(target?', legal move':''));
    button.setAttribute('aria-pressed',String(square===selected));
    button.tabIndex = square===cursor ? 0 : -1;
  }
  const sheet = document.querySelector('#sheet');
  sheet.replaceChildren();
  if (!history.length) sheet.textContent = 'No moves yet.';
  for (let i=0;i<history.length;i+=2) {
    const row = document.createElement('div');
    row.className = 'row';
    for (const text of [(i/2+1)+'.',history[i].san,history[i+1]?.san || '']) {
      const entry = document.createElement('span');
      entry.textContent = text; row.append(entry);
    }
    sheet.append(row);
  }
  sheet.scrollTop = sheet.scrollHeight;
  document.querySelector('#status').textContent = status();
  document.querySelector('#undo').disabled = !history.length;
  promotion.hidden = !promoting;
}
function stopSearch() {
  searchId++;
  worker?.terminate();
  worker = null;
}
function computerTurn() {
  if (game.turn()!=='b' || game.isGameOver()) return;
  const id = ++searchId;
  const history = game.history();
  function reply(san) {
    if (id !== searchId || game.turn()!=='b') return;
    stopSearch();
    game.move(san);
    render();
  }
  function fallback() {
    if (id===searchId) reply(chooseMove(history,150));
  }
  try {
    worker = new Worker(new URL('./chess-worker.js',import.meta.url),{type:'module'});
    worker.onmessage = event => reply(event.data);
    worker.onerror = fallback;
    worker.postMessage(history);
  } catch { setTimeout(fallback,0); }
}
function play(to, promote) {
  game.move({from:selected,to,promotion:promote});
  clearSelection(); render(); computerTurn();
}
function activate(square) {
  if (game.turn()!=='w' || game.isGameOver() || promoting) return;
  const move = legal.find(candidate => candidate.to===square);
  if (move?.promotion) {
    promoting = square; render(); document.querySelector('#promotions button').focus(); return;
  }
  if (move) { play(square); return; }
  const select = square!==selected && game.get(square)?.color==='w';
  clearSelection();
  if (select) { selected=square; legal=game.moves({square,verbose:true}); }
  render();
}
board.addEventListener('click', event => {
  const button=event.target.closest('button');
  if (!button) return;
  cursor=button.dataset.square; activate(cursor);
});
board.addEventListener('keydown', event => {
  const shifts = {ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if (event.key==='Escape') { clearSelection(); render(); return; }
  const shift = shifts[event.key];
  if (!shift) return;
  event.preventDefault();
  const file = Math.max(0,Math.min(7,files.indexOf(cursor[0])+shift[0]));
  const rank = Math.max(1,Math.min(8,Number(cursor[1])+shift[1]));
  squares.get(cursor).tabIndex=-1;
  cursor=files[file]+rank;
  squares.get(cursor).tabIndex=0; squares.get(cursor).focus();
});
for (const type of ['q','r','b','n']) {
  const button = document.createElement('button');
  button.type='button'; button.textContent=names[type];
  button.addEventListener('click',()=>{ if (promoting) play(promoting,type); squares.get(cursor).focus(); });
  document.querySelector('#promotions').append(button);
}
document.querySelector('#cancel').onclick = () => { clearSelection(); render(); squares.get(cursor).focus(); };
document.querySelector('#undo').onclick = () => {
  stopSearch(); clearSelection();
  game.undo();
  if (game.turn()==='b') game.undo();
  render();
};
document.querySelector('#reset').onclick = () => {
  stopSearch(); clearSelection(); game.reset(); cursor='e2'; render();
};
render();
