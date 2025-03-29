export class AsemicFont {
  protected defaultCharacters: Record<string, string> = {}
  characters: Record<string, string>
  reset() {
    this.characters = { ...this.defaultCharacters }
  }
  resetCharacter(char: string) {
    this.characters[char] = this.defaultCharacters[char]
  }
  constructor(characters: string) {
    characters.split('\n').forEach(char => {
      let [name, markup] = char.split(': ')
      const escapedCharacters = {
        '\\n': '\n',
        '\\s': ' '
      }
      for (let char of Object.keys(escapedCharacters)) {
        if (name.includes(char)) {
          name = name.replace(char, escapedCharacters[char])
        }
      }
      this.defaultCharacters[name] = markup
    })
    this.reset()
  }
}

export const defaultFont = new AsemicFont(
  `a: 4(1,-1 1,0 1) 3(1,-1 +0,1 .05) {+1,0}
b: [0,-2 0,0] 4(0,-1 0,0 -1) {+1,0}
c: 5(1,-.8 @1/4,.6 1,.2) {+1,0}
d: [1,-2 1,0] 4(1,-1 1,0 1) {+1,0}
e: 6(1,-.7 @1/4,.4 1,.3) [<0 <.5] {+1,0}
f: {+.25,0} 4(1,-1.5 +-1,0 .5) +[0,0] {+-.25,0} [0,-1 @0,.5] {+1,0}
g: circle(.5,-.5 .5,.5) [1,-.5] +3(@1/4,1 +-1,0 -.5) {+1,0}
h: [0,0 0,-2] [0,-.8 1,-1 1,0] {+1,0}
i: {+0.5,0} [0,0 +0,-1] circle(0,-1.5 .25,.25) {+0.5,0}
j: {+.5,0} [0,-1] +3(@1/4,1.5 @.5,1 -.3) circle(0,-1.5 .25,.25) {+.5,0}
k: [0,0 @-1/4,2] [0,-1 1,0] [0,-1 @-1/8,.5] {+1,0}
l: {+0.5,0} [0,-2] +3(0,-.2 @0,.3 .2) {+0.5,0}
m: [0,0 0,-1] 3(<.8 @0,.5 -0.2) +[@1/4,1] 3(+0,-1 @0,.5 -0.2) +[@1/4,1] {+1,0}
n: [0,0 0,-1] 3(0,-.9 @0,1 -0.2) +[@1/4,1] {+1,0}
o: circle(.5,-.5 .5,.5) {+1,0}
p: [0,1 @-1/4,2] 5(+0,0 @1/4,1 -1,.2) {+1,0}
q: [1,1 @-1/4,2] 5(+0,0 @1/4,1 1,.2) {+1,0}
r: [0,0 @-1/4,1] 3(0,-.9 @0,1 -0.2) {+1,0}
s: 3(1,-1 @0,-0.6 0.2) +3(1,-0.2 @0,-1 -0.3) {+1,0}
t: [.5,0 +0,-2] [0,-1 +1,0] {+1,0}
u: 4(0,-1 1,-1 1,0) {+1,0}
v: [0,-1 .5,0] [.5,0 1,-1] {+1,0}
w: {*0.5,1} [0,-1 .5,0] [.5,0 1,-1] {+1,0} [0,-1 .5,0] [.5,0 1,-1] {+1,0 *2,1}
x: [0,-1 +1,1] [0,0 +1,-1] {+1,0}
y: [0,1 +1,-2] [<0.5 0,-1] {+1,0}
z: [0,-1 +1,0] [1,-1 0,0] [0,0 +1,0] {+1,0}
\\s: {+1,0}
\\n: {< +0,3 >}
\\^: {>}
\\.: {+.1,0}`
)
