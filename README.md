# Pyramid Light

Repo: https://github.com/rliston09/pyramid-light

Two players, one phone, one 20×20×20 cube. Each player has a pyramid and a beam. You never see the other pyramid until you finish. You win by standing on neighboring cells with the beams pointed the same way.

This file is the source of truth for players, for the Pyramid Light Grok Bot, and for any Cursor cloud agent that changes the game. If a rule here and the code disagree, the code in `src/game/geometry.ts` wins, and this file should be updated in the same change.

## How a game goes

Red moves first. You pass the phone after every committed move.

1. Place your pyramid, up to 15 cells on X, Y, and Z from where it is now. The sliders stop at that edge.
2. Aim. Yaw is any angle, 0° through 359°. 0° is north and 90° is east. Pitch is five steps from straight down (−2) to straight up (+2), 45° each.
3. Commit. The turn passes. Your last move stays on the cube as a lit box of cells, and only you see it. When the phone passes, that box is gone.
4. A cell the other pyramid already occupies is refused. You stay on the turn and can pick again. The message is “That cell is taken.”
5. Four cells near the middle are rocks, the same every game: (10, 10, 10), (11, 10, 10), (10, 11, 10), and (10, 10, 11). Both players always see them. Standing on one is refused and does not spend the turn. The message is “That cell is blocked.” Beams pass through. Standing next to a rock is allowed.

The beam on your pyramid follows the aim sliders before you commit. A dashed pyramid shows a new cell before you commit.

Drag the cube to turn it. Pinch to zoom. The cube edges get thicker as you zoom in. The page is white, and it uses the dark neon look when the phone is set to dark mode.

## What you are allowed to see

| You always see | You see later | You never see until the end |
| --- | --- | --- |
| Your pyramid and your beam | The other beam, once the proximity meter is halfway | The other pyramid |
| Your own last move, as lit cubes, on your turn | Both beams turning purple when they mix | A map, coordinates of the other player, or their last move |
| The four center rocks | | |
| Proximity, the parallel meter, and the saved beam view | | |

Halfway is the middle of the proximity bar, half the corner-to-corner span of the cube. Closer than that, the other beam stays visible. The other pyramid appears only when you lock.

The saved beam is the crossing view. It flashes after a move, and either player can pin it open. It does not reveal positions.

## Mixing and winning

Distance is ordinary straight-line distance. “Neighboring” is one step away on the cube, including diagonals and the cells above and below. The same cell is not a neighbor.

- Farther than 5, and not yet halfway: you only have your own beam and the meters.
- Within 5, but the beams are not the same way: status is Close. No mix.
- Within 5, and the beams point the same way (within 45°): the beams mix and turn purple. Each player then has two moves.
- Those four moves are the window. Land on a neighboring cell while still pointing the same way and you lock.
- If both players spend their two moves and you are not neighbors, the mix fades. Get within 5 and aligned again to open a new window.
- Sharing a cell is never a win.

The parallel meter is separate from the mix. It measures how close the two beams are to parallel, same direction or opposite. 90° off is ×1.00. Dead parallel is ×2.00. It follows your aim slider. It does not score points yet.

## Not built yet

Do not add these unless someone asks.

- A score that the parallel multiplier actually changes.
- Choosing a difficulty, or a different set of rocks.
- Own-pace play, where each person moves when they want.
- Realtime play.

## For the Pyramid Light bot

The bot’s only job is this game. It keeps the rules above, answers play questions without revealing the other pyramid, and hands code changes to a Cursor cloud agent.

Create it in Grok Bot: new chat, type Pyramid Light, choose Create “Pyramid Light” Bot. First message:

```text
Remember this as your job.

You are Pyramid Light. You only work on the game Pyramid Light. The README in the repo is your source of truth. If memory and the README disagree, trust the README, then update your memory.

You help two people play and you help change the game. You do not reveal the other pyramid, its cell, or its aim beyond what that player can already see: their own pyramid, their last move, the meters, the saved beam, and the other beam only once proximity is halfway.

When a change belongs in the repo, hand it to a Cursor cloud agent. Name the repository, the change, and the finish line. The agent works on a new branch and opens a pull request. It does not merge. When it finishes, reply with the pull request link, the branch name, and what changed. Ask before handing off anything that is not this game.

Do not build scoring, own-pace play, or realtime play until asked.

First task: restate the win, the refused same-cell rule, and what each player is allowed to see. Stop there.
```

Cursor only receives the handoff if Grok Bot is signed in with Cursor and this repository is connected at cursor.com → Dashboard → Integrations → GitHub. The phone preview is a separate copy. A pull request changes this repository. It does not change the phone preview until that change is brought back.

A handoff sounds like this:

```text
Hand this to a Cursor cloud agent. Repository: https://github.com/rliston09/pyramid-light. Read README.md and follow it. [the change]. Open a pull request. Do not merge.
```

## Where the rules live

| Piece | File |
| --- | --- |
| Grid, moves, mix, lock, parallel multiplier | `src/game/geometry.ts` |
| Rules in numbers | `src/game/geometry.test.ts` |
| Screen, sliders, meters, turn | `src/components/align-game.tsx` |
| Cube, orbit, zoom, who is drawn | `src/components/cube-stage.tsx` |
| Saved beam picture | `src/game/crossCanvas.ts` |
| White and dark colors | `src/styles.css` |
