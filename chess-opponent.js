import {Chess} from './chess-rules.js';

const value = {p:100, n:320, b:335, r:500, q:900, k:0};
const mate = 100000;

function evaluate(game) {
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const file = piece.square.charCodeAt(0) - 97;
      const rank = Number(piece.square[1]) - 1;
      const advance = piece.color === 'w' ? rank : 7-rank;
      const center = 7 - Math.abs(3.5-file) - Math.abs(3.5-rank);
      let position = 0;
      if (piece.type === 'p') position = advance*6 + center*3;
      if (piece.type === 'n' || piece.type === 'b') position = center*9 + (advance>0 ? 14 : 0);
      if (piece.type === 'k' && advance === 0 && (file === 6 || file === 2)) position = 28;
      score += (piece.color === 'w' ? 1 : -1) * (value[piece.type] + position);
    }
  }
  return game.turn() === 'w' ? score : -score;
}

function priority(move) {
  if (move.endsWith('#')) return 10;
  return (move.includes('x') ? 4 : 0) + (move.includes('+') ? 2 : 0) + (move.includes('=') ? 5 : 0);
}

export function chooseMove(history, budget = 650) {
  const game = new Chess();
  for (const move of history) game.move(move);
  const options = game.moves().map(san => ({san, score:0}));
  if (!options.length) return null;
  const deadline = performance.now() + budget;
  const timeout = Symbol('search deadline');

  function search(depth, alpha, beta, ply) {
    if (performance.now() >= deadline) throw timeout;
    const moves = game.moves();
    if (!moves.length) return game.isCheck() ? -mate+ply : 0;
    if (game.isInsufficientMaterial() || game.isThreefoldRepetition() || game.isDrawByFiftyMoves()) return 0;
    if (depth === 0) return evaluate(game);
    moves.sort((a,b) => priority(b)-priority(a));
    for (const san of moves) {
      game.move(san);
      let score;
      try { score = -search(depth-1,-beta,-alpha,ply+1); }
      finally { game.undo(); }
      if (score >= beta) return score;
      alpha = Math.max(alpha,score);
    }
    return alpha;
  }

  options.sort((a,b) => priority(b.san)-priority(a.san));
  let choice = options[0].san;
  for (let depth=1; depth<=3; depth++) {
    let bestScore = -Infinity, bestMove = choice;
    try {
      for (const option of options) {
        game.move(option.san);
        try { option.score = -search(depth-1,-Infinity,-bestScore,1); }
        finally { game.undo(); }
        if (option.score > bestScore) { bestScore=option.score; bestMove=option.san; }
        if (bestScore >= mate-1) return bestMove;
      }
    } catch (error) {
      if (error !== timeout) throw error;
      return choice;
    }
    choice = bestMove;
    options.sort((a,b) => b.score-a.score);
  }
  return choice;
}
