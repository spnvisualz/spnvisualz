import { ScrollTrigger } from "../motion/scrollTimeline.js";

// The camera's dolly path through Origin + Selected Work — the one part of
// the journey where the brief's "camera moving through space" is most
// literal: the camera actually travels down world-space Z and the Work
// video planes are real geometry it passes. Past the end of `endTrigger`
// the scrub simply stops updating, so the camera holds its final position
// for the rest of the page — later chapters animate their own objects in
// front of that parked camera instead (see planetJourney-style per-chapter
// scrubs), which is a proven, lower-risk pattern for content that has to
// stay clear of readable text.
export class WorldRig {
  constructor({ camera, startTrigger, endTrigger, zEnd }) {
    this.camera = camera;
    this.zStart = camera.position.z;
    this.zEnd = zEnd;
    this.progress = 0;

    ScrollTrigger.create({
      trigger: startTrigger,
      endTrigger: endTrigger,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.9,
      onUpdate: (self) => {
        this.progress = self.progress;
        this.camera.position.z = this.zStart + (this.zEnd - this.zStart) * self.progress;
      }
    });
  }

  zAt(fraction) {
    return this.zStart + (this.zEnd - this.zStart) * fraction;
  }
}
