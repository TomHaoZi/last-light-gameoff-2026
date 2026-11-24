"""Rebuild the eight human speech edits. Supply the three credited preview masters."""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--pa", required=True, type=Path, help="RICHERlandTV source preview")
parser.add_argument("--lunch", required=True, type=Path, help="HorathDrak source preview")
parser.add_argument("--survivor", required=True, type=Path, help="GreasyPlastic source preview")
parser.add_argument("--ffmpeg", default="ffmpeg")
args = parser.parse_args()
output_dir = Path(__file__).resolve().parents[1] / "dist/3d/assets/dialogue"

# Times follow the source preview masters listed in CREDITS.md. Recordings of
# two separate takes include a deliberate pause before the relay answers.
edits = {
    "gap": (args.pa, [(128.82, 130.53)], 0),
    "doors": (args.pa, [(200.49, 202.75)], 0),
    "register": (args.pa, [(158.28, 159.57), (140.38, 142.22)], .17),
    "exchange": (args.pa, [(161.23, 166.86)], 0),
    "circuit": (args.pa, [(146.98, 149.00), (120.18, 121.12)], .10),
    "farewell": (args.pa, [(108.85, 109.92)], 0),
    "lunch": (args.lunch, [(0, 1.71)], 0),
    "recovered": (args.survivor, [(.84, 2.82)], 0)
}

for name, (source, passages, pause) in edits.items():
    filters = []
    pieces = []
    for index, (start, end) in enumerate(passages):
        duration = end - start
        tail = f",apad=pad_dur={pause}" if index + 1 < len(passages) else ""
        filters.append(
            f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.018,afade=t=out:st={duration - .075:.4f}:d=0.075{tail}[cut{index}]"
        )
        pieces.append(f"[cut{index}]")
    filters.append(
        "".join(pieces) + f"concat=n={len(pieces)}:v=0:a=1,"
        "aformat=channel_layouts=mono,highpass=f=75,"
        "acompressor=threshold=.12:ratio=2.7:attack=6:release=80:knee=2,"
        "loudnorm=I=-20:TP=-3.8:LRA=7,"
        "aresample=32000,alimiter=limit=.66:attack=4:release=50:level=false:latency=true[voice]"
    )
    subprocess.run([
        args.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-filter_complex", ";".join(filters), "-map", "[voice]",
        "-map_metadata", "-1", "-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart",
        str(output_dir / (name + ".m4a"))
    ], check=True)
