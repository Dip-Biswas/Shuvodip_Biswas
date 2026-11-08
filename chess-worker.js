import {chooseMove} from './chess-opponent.js';
self.onmessage = ({data}) => self.postMessage(chooseMove(data));
