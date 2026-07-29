# Testing checklist

## Start and general
- Open `index.html` directly in Chrome, Edge, Firefox, or Safari.
- Press **Start Game** and confirm music begins only after the click.
- Test the sound on/off button.
- Resize the window and confirm the game keeps a stable 16:9 layout.
- Test one interaction with a mouse and one with touch or device emulation.

## Round 1
- Confirm seven fruit names are presented in a shuffled order.
- Test **Hear again**.
- Click a wrong fruit: it shakes and progress does not change.
- Click the correct fruit: it flies to the basket and progress increases once.
- Collect all seven fruit types and confirm the next-round button appears only at 7/7.

## Round 2
- Drop the fruit outside the board and confirm it returns.
- Confirm the knife cannot be moved before the fruit reaches the board.
- Drag the fruit to the board, then drag the knife to the board.
- Confirm the cutting animation and cut-fruit replacement appear.
- Drop the cut fruit outside the plate and confirm it returns.
- Complete all seven fruits and confirm the yogurt-round button appears only at 7/7.

## Round 3
- Confirm fruit cannot be dragged before yogurt is added.
- Drag yogurt to the bowl and confirm the bowl changes.
- Add every fruit once and confirm pieces stay clipped inside the bowl.
- Confirm **Mix** stays disabled until the required ingredients are ready.
- Mix and confirm the spoon/content animate without rotating the whole bowl.
- Confirm the final bowl, celebration, **Play Again**, and **Free Play** controls appear.
- In Free Play, test a partial fruit combination, **Mix Again**, and **Clear Bowl**.
