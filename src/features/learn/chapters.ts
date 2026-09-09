import type { StageId } from '@/cube/lbl';

export interface Chapter { idea: string; algorithm?: string; sections: Array<{ title: string; body: string[] }> }

/** The theory behind each stage, in the app's voice. Written for an adult who has just done the moves and wants to know why. */
export const CHAPTERS: Record<StageId, Chapter> = {
  'white-cross': {
    idea: 'Four edges around one centre. The first shape you build, and the only stage where you can improvise.',
    sections: [
      { title: 'What an edge is', body: ['A cube has three kinds of pieces: six centres that never move relative to each other, twelve edges with two colours, and eight corners with three. The white cross is four edges, each with a white sticker, placed next to the white centre with their other colour matching the centre beside it.'] },
      { title: 'Why it comes first', body: ['Everything later is built on a fixed floor. With the cross in place you can turn the top layer freely, and the moves in later stages are designed so the cross is always put back before they end.'] },
      { title: 'The two situations', body: ['If the white sticker faces up, line it above its centre and turn that side twice. If white faces sideways, the four-turn twist flips it as it comes down. Every cross edge is one of those two.'] },
    ],
  },
  'white-corners': {
    idea: 'Each corner goes home with the same three turns: right up, top away, right down.',
    algorithm: "R U R'",
    sections: [
      { title: 'A corner has three colours', body: ['White, plus the two centres it sits between. Park it in the top layer directly above its home, then bring it down with the three-turn move. If white ends up facing the wrong way, the same move again turns it a third of the way round; at most three repeats.'] },
      { title: 'Why the three turns are safe', body: ['Right up lifts a slot, top away puts the corner over it, right down drops the slot back. The bottom layer is disturbed for exactly two moves and restored on the third. That pattern, disturb–insert–restore, is the whole beginner method in miniature.'] },
    ],
  },
  'middle-edges': {
    idea: 'Take an edge out of the top, put it into its slot without touching the floor. Two mirror-image inserts.',
    algorithm: "U R U' R' U' F' U F",
    sections: [
      { title: 'The middle layer has no white or yellow', body: ['Four edges with two side colours each. Find one in the top layer, line its side colour with its centre, then look at the top colour: it tells you whether the slot is to the right or the left.'] },
      { title: 'Why eight turns', body: ['The insert is two short sequences back to back. The first pushes the edge into the slot but knocks a bottom corner out; the second puts the corner back. Nothing else moves. Watch the corner on the screen cube and you will see it leave and return.'] },
    ],
  },
  'yellow-cross': {
    idea: 'A dot becomes an L, an L becomes a line, a line becomes a cross. One six-turn move, repeated.',
    algorithm: "F R U R' U' F'",
    sections: [
      { title: 'Orientation, not position', body: ['From here we stop caring where the yellow edges are and only care which way they face. This stage flips edges so all four show yellow on top; the next stages fix positions.'] },
      { title: 'Why the same move works three times', body: ['The move flips two adjacent edges and cycles three of them. Applied to a dot it makes an L; applied to an L held the right way it makes a line; applied to a line it makes a cross. Holding it the right way is the only skill.'] },
    ],
  },
  'yellow-corners': {
    idea: 'One seven-turn move twists three corners a third of the way round. Repeat it until the top is all yellow.',
    algorithm: "R U R' U R U2 R'",
    sections: [
      { title: 'Why a lone corner can never be twisted', body: ['Add up how far every corner is twisted, in thirds of a turn. On a real cube that total is always a multiple of three, because each face turn moves four corners and the twists it adds cancel out. That is why this stage twists three corners at once, and why a cube with one twisted corner is not a cube; it has been taken apart.'] },
      { title: 'Reading the top', body: ['Count the yellow corners on top. With one, hold it at the front-left. With none or two, hold the cube so a yellow sticker faces left or faces you at the front-left. Then the move. It may take two or three rounds, and the pattern between rounds is always one of those.'] },
    ],
  },
  'position-corners': {
    idea: 'Three corners trade places in a cycle while everything else stays put.',
    algorithm: "R' F R' B2 R F' R' B2 R2",
    sections: [
      { title: 'Why a cycle of three', body: ['Swapping just two corners is impossible on a cube; every face turn is an even shuffle of corners, so you can never end up one swap away. Three corners moving in a circle is the smallest change that is allowed, and this move does exactly that.'] },
      { title: 'How to hold it', body: ['Find the corner already between its two colours and keep it at the front-left; the other three cycle. If none is home, do the move once from any side and one will be. Corners with yellow on top are already oriented, so this move is built never to twist them.'] },
    ],
  },
  'position-edges': {
    idea: 'The last three edges cycle home. Eleven turns, and the cube is solved.',
    algorithm: "R U' R U R U R U' R' U' R2",
    sections: [
      { title: 'The final cycle', body: ['Like the corners, edges can only move in cycles of three when everything else is solved. Hold the finished edge at the back and the other three go round. If none is finished, one round of the move finishes one.'] },
      { title: 'Why parity never bites', body: ['On a proper cube the corner shuffle and the edge shuffle are always both even or both odd, so once the corners are home the edges can always be finished with three-cycles. If they cannot, the cube was reassembled wrongly, and the app would have told you before you started.'] },
    ],
  },
};
