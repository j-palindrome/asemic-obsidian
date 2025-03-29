"Asemic" is a livecoded language I created to describe a generative drawing system. Repeated lines and transformations create text, as well as fractal, plant-like systems. Keystrokes can also be correlated to sound patterns, so typing words on the keyboard becomes an abstract, expressive system.

# Point Syntax

- x,y: absolute coordinates in x,y.
- +x,y: relative coordinates in x,y. The point is determined relative to the previous point.
- @t,r: polar coordinates in theta, r. The point is determined starting at the previous point, rotating by theta and moving by r. Theta is given in 0-1 along a circle (0 = 0deg, 1 = 360deg).
- <p: intersection. Returns the point on the previous line p amount along it. p can range from 0 to 1.

# Line Syntax

- [x,y x,y x,y]: points. Create a new line of points.
- +[x,y]: add points. Add points to the current line.
- f(x0,y0 x1,y1 h,w): call the function f. 3(): draw 3 points [0,0 0.5,0 1,0], 4(): draw [0,0 0,1 1,1 1,0] 5(): draw 5 points [0,0 0,.66 .5,1 1,0.66 1,0], 6(): draw 6 points [0,0 0,0 1,0 1,1 1,0 1,0].
- The start point is x0,y0 and the end point is x1,y1. The shape is rotated and scaled to stretch between these two points.
- h,w determines the scale of the curve, h with how much it bends upwards and w with how much it bows outwards in the x-direction. If only one number is provided it is assumed to be h.
- {*x,y @t +x,y}: transformation. The coordinate system is scaled by *x,y (if present), rotated by @theta (if present), and moved by +x,y (if present). Transformations are performed in the order in which they appear.
- Examples: {+0,1} {+1,2 @1/4 \*2,3} {+-.1,2 @0.3}
- {!}: reset the current transformation.
- {+! @! _!} +!: reset transform, @!: reset rotation, _!: reset scale.
