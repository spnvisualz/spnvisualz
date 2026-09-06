# Original master media

Large original media lives here and is tracked with **Git LFS**, so it
stays out of ordinary Git history. See `.gitattributes` for the policy.

Nothing in this folder is served to visitors. The site serves the
optimized derivatives in `public/assets/`, which are committed normally.

## Layout

```
media/originals/<project-slug>/   e.g. media/originals/icekiid/
```

## Adding an original

```bash
git lfs install                       # once per machine or Codespace
mkdir -p media/originals/<slug>
cp "/path/to/Master.mov" media/originals/<slug>/
git add media/originals/<slug>
git commit -m "Add <slug> master"
git push
```

The commit stores a small pointer; the file itself goes to LFS storage.

## Getting originals on a new machine

A normal clone gives you pointers, not files:

```bash
git lfs pull                                          # everything
git lfs pull --include="media/originals/icekiid/*"    # one project
```

## Producing the web derivatives

From an original, generate the desktop and mobile variants the site
actually uses. This is the same recipe the current assets were built with:

```bash
SLUG=icekiid
IN="media/originals/$SLUG/Master.mov"

# Desktop: 1080p, 30fps, no audio, faststart
ffmpeg -y -i "$IN" -an -r 30 -c:v libx264 -profile:v high -crf 21 \
  -preset slow -pix_fmt yuv420p -movflags +faststart \
  "public/assets/videos/work/$SLUG.mp4"

# Mobile: 1280 wide — a phone at 3x density needs more than 854px
ffmpeg -y -i "$IN" -an -r 30 -vf "scale=1280:-2:flags=lanczos" \
  -c:v libx264 -profile:v high -crf 23 -preset slow -pix_fmt yuv420p \
  -movflags +faststart "public/assets/videos/work/$SLUG-mobile.mp4"

# Poster frame
ffmpeg -y -ss 1.0 -i "$IN" -frames:v 1 -q:v 3 \
  "public/assets/images/work/$SLUG.jpg"
```

Then register the project in `src/work/projects.js`, including its real
`aspect` — three of the current clips are 2:1, not 16:9, and a wrong
value stretches the video.

## Seamless loops

Clips loop continuously on the site, so a mismatch between the first and
last frame reads as a visible jump. Measure it (0 = perfect loop):

```bash
ffmpeg -y -i in.mp4 -vf "select=eq(n\,0),scale=160:-2" -frames:v 1 first.png
ffmpeg -y -sseof -0.2 -i in.mp4 -vf scale=160:-2 -update 1 last.png
ffmpeg -i first.png -i last.png -filter_complex \
  "[0:v][1:v]blend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" \
  -f null - 2>/dev/null | grep -o 'YAVG=[0-9.]*' | head -1
```

Under ~4 is imperceptible. If it is higher, crossfade the tail back over
the head — output duration becomes `D - X`:

```bash
X=0.5   # blend length in seconds; longer for clips that differ more
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 in.mp4)
MID=$(echo "$D - $X" | bc -l)
ffmpeg -y -i in.mp4 -filter_complex "\
[0:v]trim=0:$X,setpts=PTS-STARTPTS[head];\
[0:v]trim=$X:$MID,setpts=PTS-STARTPTS[mid];\
[0:v]trim=$MID:$D,setpts=PTS-STARTPTS[tail];\
[tail][head]blend=all_expr='A*(1-T/$X)+B*(T/$X)'[bl];\
[bl][mid]concat=n=2:v=1:a=0[v]" -map "[v]" -an \
  -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p \
  -movflags +faststart out.mp4
```
