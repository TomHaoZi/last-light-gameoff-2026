"""Build the standalone 3D HTML5 release candidate for itch.io."""

import hashlib
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
VERSION = "3.0.0-rc.13"
ZIP_DATE = (1980, 1, 1, 0, 0, 0)
REQUIRED_FILES = {
    "index.html", "style.css", "game.js", "visual.js", "audio.js", "levels.js",
    "simulation.js", "lighting.js", "models.js", "surfaces.js",
    "creature.js", "creature-body.js", "creature-head.js", "creature-voice.js",
    "creature-textures.js", "render-idle.js", "office-phase-programs.js", "set-dressing.js",
    "vendor/three.module.js", "vendor/three.core.js",
    "vendor/THREE-LICENSE.txt", "classic/index.html", "classic/style.css",
    "classic/game.js", "classic/actor-art.js", "classic/sector-art.js", "classic/sector-scenery.js",
    "dialogue.js", "frame-budget.js", "photo-surfaces.js",
    "environment-assets.js", "vendor/loaders/GLTFLoader.js",
    "vendor/utils/BufferGeometryUtils.js", "vendor/utils/SkeletonUtils.js",
    "assets/CREDITS.md", "assets/creature/late-worker.glb",
    "assets/creature/SOURCES.md", "assets/env/CREDITS.md",
    "assets/dialogue/CREDITS.md", "assets/surfaces/CREDITS.md",
    "audio/CREDITS.md",
}


REQUIRED_FILES.update(
    f"assets/dialogue/{name}.m4a" for name in ("lost", "evacuate", "calling", "trapped")
)
REQUIRED_FILES.update(
    f"assets/env/{name}.glb" for name in
    ("compressor", "dispatch-radio", "fire-alarm", "records-desk", "records-lamp", "roof-condenser")
)
REQUIRED_FILES.update(
    f"assets/surfaces/{kind}-{channel}.webp"
    for kind in ("boiler", "office", "roof", "block")
    for channel in ("color", "normal", "arm")
)


def collect_runtime():
    dist = ROOT / "dist"
    scene = dist / "3d"
    files = {}
    for path in sorted(scene.rglob("*")):
        relative = path.relative_to(scene)
        if path.is_file() and not path.is_symlink() and all(
            not part.startswith(".") for part in relative.parts
        ):
            files[relative.as_posix()] = path.read_bytes()

    for path in sorted(dist.iterdir()):
        if path.is_file() and not path.is_symlink() and path.suffix in {".html", ".css", ".js"}:
            files[f"classic/{path.name}"] = path.read_bytes()

    missing = REQUIRED_FILES - files.keys()
    if missing:
        raise ValueError(f"Missing runtime files: {', '.join(sorted(missing))}")

    entry = files["index.html"]
    if entry.count(b'href="../"') != 2:
        raise ValueError("Expected the menu and noscript links to the classic edition")
    files["index.html"] = entry.replace(b'href="../"', b'href="./classic/index.html"')
    classic_entry = files["classic/index.html"]
    if classic_entry.count(b'href="./3d/" id="play-3d"') != 1:
        raise ValueError("Expected the classic edition link to the 3D menu")
    files["classic/index.html"] = classic_entry.replace(
        b'href="./3d/" id="play-3d"', b'href="../index.html" id="play-3d"'
    )
    files["LICENSE"] = (ROOT / "LICENSE").read_bytes()
    files["BUILD.json"] = (json.dumps({
        "edition": "LAST LIGHT 3D",
        "version": VERSION,
        "status": "Release candidate",
    }, indent=2) + "\n").encode("utf-8")
    return files


def package():
    files = collect_runtime()
    folder = ROOT / "releases"
    folder.mkdir(exist_ok=True)
    output = folder / f"last-light-3d-{VERSION}-html5.zip"
    with NamedTemporaryFile(dir=folder, suffix=".zip", delete=False) as handle:
        temporary = Path(handle.name)

    try:
        with ZipFile(temporary, "w") as archive:
            for name, content in sorted(files.items()):
                entry = ZipInfo(name, ZIP_DATE)
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, content, compress_type=ZIP_DEFLATED, compresslevel=9)
        with ZipFile(temporary) as archive:
            if set(archive.namelist()) != files.keys() or archive.testzip() is not None:
                raise ValueError("ZIP validation failed")
        temporary.chmod(0o644)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)

    print(f"{output}\n{output.stat().st_size:,} bytes")
    print(f"SHA-256 {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    package()
