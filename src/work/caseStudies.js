// Extra copy for the generated case-study pages (scripts/build-case-studies.mjs).
// Kept out of projects.js so none of it ships in the homepage bundle.
//
// `onScreen` describes only what is visible in the reel itself, checked
// against its frames: no client brief, goals or results are claimed. When
// the studio has the real story for a project, add it as `story` (an array
// of paragraphs) and it is printed under the on-screen description.
// `article` links an existing Visual Lab write-up about the same project.
export const CASE_STUDIES = {
  "byron-messia": {
    onScreen: "A cracked red heart carries the Byron Messia name through pink and violet flames, turning in 3D so the lettering shows its depth before it swings back to face the camera."
  },
  "illegal-vybz-darkoo": {
    onScreen: "The red Illegal Vybz mark holds the top of the frame while Darkoo's jagged white signature tears in and out beneath it, with scratched brush strokes flickering around the name."
  },
  "3-nation-studios": {
    onScreen: "Rose-gold 3D lettering set with diamonds and wrapped in a Cuban chain turns against black, catching glints of light as it swings back to the front."
  },
  "motion-view": {
    onScreen: "An iridescent chrome blackletter monogram rotates against black, its colours shifting with every turn and small sparkles flaring at its edges."
  },
  "prince-o": {
    onScreen: "A chrome script P locked onto a star turns slowly in front of dark, streaked metal, with light sweeping across its surfaces."
  },
  "no-one-is-illegal": {
    onScreen: "The headline No One Is Illegal sits above the Illegal Vybz mark, which is caged inside a glowing wireframe sphere in a red, smoke-filled hall, with glitches cutting through the word Illegal."
  },
  "illegal-vybz-truck": {
    onScreen: "A black lorry wrapped in red Illegal Vybz graffiti lettering drives down a rain-soaked motorway at night while a helicopter follows it with a searchlight."
  },
  "tao-1": {
    onScreen: "Icy chrome TAO lettering, surrounded by crystal shards and sparkles, spins through a full turn against black so the name reads backwards as it passes behind.",
    article: { href: "/visual-lab/articles/tao-black-chrome-motion-loop-case-study/", title: "Inside TAO’s Black-and-Chrome Motion World" }
  },
  "tao-2": {
    onScreen: "The same icy TAO mark turns over grainy night-time footage with street lights in the background, carrying the identity into live-action video.",
    article: { href: "/visual-lab/articles/tao-black-chrome-motion-loop-case-study/", title: "Inside TAO’s Black-and-Chrome Motion World" }
  }
};
