#!/bin/bash
# Stitches the pitch video: text scene PNGs with slow push-ins, plus the real phone footage in a frame.
set -e
cd "$(dirname "$0")"
FPS=24; E="-c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -r $FPS"
seg() { # name duration zoom(1=push)
  if [ "$3" = "1" ]; then
    ffmpeg -v error -y -loop 1 -i $1.png -t $2 -vf "scale=2400:-1,zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=$FPS,fade=t=in:d=0.15" $E s_$1.mp4
  else
    ffmpeg -v error -y -loop 1 -i $1.png -t $2 -vf "scale=1920:1080" $E s_$1.mp4
  fi
}
seg h1 0.4 0; seg h2 0.4 0; seg h3 0.5 0; seg h4 4.7 1
seg p1 4 1; seg p2 4 1; seg p3 4 1
seg f1 3 0; seg f2 3 0; seg f3 3 0; seg f4 3 0
seg i1 6 1
seg c1 4 1; seg c2 4 1
# Product: real footage in a phone frame, blurred copy as background
ffmpeg -v error -y -ss 8 -t 66 -i ../jaisa-tha-demo.mp4 -loop 1 -i side.png -filter_complex "\
[0:v]setpts=PTS/2.54,split[a][b];\
[a]crop=480:270:720:380,scale=1920:1080,gblur=sigma=40,eq=brightness=-0.62:saturation=1.1[bg];\
[b]crop=480:1040:720:20,scale=-2:980,format=rgba,pad=iw+16:ih+16:8:8:color=0x111111@1[ph];\
[bg][ph]overlay=1010:50[v1];[v1][1:v]overlay=0:0,fps=$FPS,format=yuv420p[v]" -map "[v]" -t 26 -c:v libx264 -crf 20 -preset veryfast -r $FPS s_prod.mp4
: > list.txt
for n in h1 h2 h3 h4 p1 p2 p3 f1 f2 f3 f4 i1 prod c1 c2; do echo "file 's_$n.mp4'" >> list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i list.txt -f lavfi -i anullsrc=r=44100:cl=stereo -shortest -c:v copy -c:a aac -b:a 96k ../jaisa-tha-pitch.mp4
echo built
