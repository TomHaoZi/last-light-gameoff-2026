"""Build the standalone 3D HTML5 release candidate for itch.io."""

import hashlib
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
VERSION = "3.0.0-rc.40"
ZIP_DATE = (1980, 1, 1, 0, 0, 0)
SHARED_RUNTIME = {"player-settings.js", "settings-panel.js", "player-settings.css", "mobile-play.js", "mobile-play.css", "save-slot.js"}
HISTORIC_MODELS = {f"assets/creature/{name}.glb" for name in (
    "mourning-clerk", "mourning-clerk-human", "mourning-wings",
)}
REQUIRED_FILES = {
    "index.html", "style.css", "game.js", "visual.js", "audio.js", "levels.js", "mobile-hud.js", "creature-pressure.js", "wound-finish.js",
    "shift-cinematics.js", "dressing-visibility.js", "classic/cinematic-art.js",
    "simulation.js", "save.js", "lighting.js", "models.js", "surfaces.js",
    "creature.js", "creature-body.js", "creature-head.js", "creature-voice.js",
    "creature-textures.js", "render-idle.js", "office-phase-programs.js", "set-dressing.js", "architectural-details.js",
    "vendor/three.module.js", "vendor/three.core.js",
    "vendor/THREE-LICENSE.txt", "classic/index.html", "classic/style.css",
    "classic/game.js", "classic/actor-art.js", "classic/sector-art.js", "classic/sector-scenery.js",
    "backrooms-set.js", "backrooms-track.js", "chase-score.js", "classic/backrooms.js",
    "classic/backrooms-art.js", "classic/chase-props.js", "classic/backrooms-props.png",
    "assets/env/backrooms-annex.glb", "assets/env/steamtrap.glb", "assets/env/ticketcase.glb",
    "assets/env/rainhead.glb", "dialogue.js", "frame-budget.js", "photo-surfaces.js",
    "environment-assets.js", "archive-interior.js", "assets/env/archive-interior.glb",
    "vendor/loaders/GLTFLoader.js",
    "vendor/utils/BufferGeometryUtils.js", "vendor/utils/SkeletonUtils.js",
    "assets/CREDITS.md", "assets/creature/late-worker.glb",
    "assets/creature/SOURCES.md", "assets/env/CREDITS.md",
    "mourning-audio.js", "mourning-figure.js", "mourning-gaze.js", "mourning-capture.js", "creature-rig.js",
    "classic/mourning-clerk.js", "classic/mourning-capture-art.js", "assets/creature/archive-nurse.glb",
    "assets/env/office-phonograph.glb",
    "audio/mourning-sob-soft.m4a", "audio/mourning-sob-held.m4a",
    "assets/dialogue/CREDITS.md", "assets/surfaces/CREDITS.md",
    "audio/CREDITS.md", "air-effects.js", "service-lift.js", "station-traces.js", "workstation-models.js", "janitor-hands.js",
    "assets/janitor/janitor.glb", "assets/janitor/CREDITS.md", "assets/env/service-lift.glb",
    "plant-sets.js", "machinery-motion.js", "field-foley.js", "assets/env/boiler-plant.glb", "assets/env/roof-plant.glb",
    "checkpoint-lamp.js", "assets/env/checkpoint-lamp.glb",
    "assets/env/roof-garden-bed.glb", "assets/env/roof-irrigation-header.glb", "assets/env/roof-nursery-box.glb",
    "roof-combat.js", "assets/env/roof-strike-wrench.glb", "assets/env/boiler-tool-chest.glb",
    "assets/env/archive-drawer-cabinet.glb", "assets/env/annex-steel-rack.glb", "assets/env/boiler-arrival-extractor.glb",
    "map-dressing.js", "assets/env/boiler-cylinder.glb", "assets/env/boiler-maintenance-box.glb",
    "assets/env/archive-notepads.glb", "assets/env/annex-shipping-crate.glb",
    "roof-skyline.js", "assets/env/roof-skyline.glb",
    "architecture-kit.js", "assets/env/architecture-rc27.glb", "assets/env/junctions-rc29.glb", "assets/env/utilities-rc30.glb",
    "assets/env/detail-rc31.glb", "assets/env/fit-rc32.glb", "assets/env/sign-mount-rc33.glb",
    "assets/env/roof-corners-rc34.glb", "assets/env/roof-splices-rc35.glb",
    "city-ground-layout.js", "assets/env/city-ground-rc35.glb",
    "assets/env/boiler-service-generator.glb", "assets/env/archive-wall-utility-box.glb",
    "assets/env/roof-irrigation-wall-hose.glb", "assets/env/annex-recess-bin.glb",
    "assets/env/annex-recess-extinguisher.glb",
    "inspection-details.js", "assets/env/inspection-rc28.glb",
}
REQUIRED_FILES.update(SHARED_RUNTIME)
REQUIRED_FILES.update(f"classic/{name}" for name in SHARED_RUNTIME)
REQUIRED_FILES.update(
    f"audio/{name}.m4a" for name in ("eli-catch", "eli-breath", "eli-recover",
        "boiler-release", "office-ballast", "archive-mechanism", "roof-rain",
        "step-stone", "step-grate", "step-carpet", "door-steel")
)


REQUIRED_FILES.update(
    f"assets/dialogue/{name}.m4a" for name in ("lost", "evacuate", "calling", "trapped",
        "circuit", "doors", "exchange", "farewell", "gap", "lunch", "recovered", "register")
)
REQUIRED_FILES.update(
    f"assets/dialogue/mourning-{cue}-en.m4a"
    for cue in ("guide", "glance", "boiler", "boiler3d", "roof")
)
REQUIRED_FILES.update(
    f"assets/env/{name}.glb" for name in
    ("compressor", "dispatch-radio", "fire-alarm", "records-desk", "records-lamp", "roof-condenser",
     "station-flow", "station-pressure", "station-timeclock")
)
REQUIRED_FILES.update(
    f"assets/surfaces/{kind}-{channel}.webp"
    for kind in ("boiler", "office", "roof", "block", "archive-floor", "archive-plaster")
    for channel in ("color", "normal", "arm")
)


def collect_runtime():
    dist = ROOT / "dist"
    scene = dist / "3d"
    files = {}
    for path in sorted(scene.rglob("*")):
        relative = path.relative_to(scene)
        if relative.parent.as_posix() == "assets/dialogue" and relative.name.endswith("-zh.m4a"):
            continue  # Historical Mandarin masters are not part of the game package.
        if relative.as_posix() not in HISTORIC_MODELS and path.is_file() and not path.is_symlink() and all(
            not part.startswith(".") for part in relative.parts
        ):
            files[relative.as_posix()] = path.read_bytes()

    for path in sorted(dist.iterdir()):
        if path.is_file() and not path.is_symlink() and path.suffix in {".html", ".css", ".js"}:
            content = path.read_bytes()
            files[f"classic/{path.name}"] = content
            if path.name in SHARED_RUNTIME:
                files[path.name] = content

    files["classic/backrooms-props.png"] = (dist / "backrooms-props.png").read_bytes()
    for module in ("chase-score.js", "mourning-audio.js", "field-foley.js"):
        absolute_import = f"'./3d/{module}'".encode()
        sibling_import = f"'../{module}'".encode()
        classic_audio = files["classic/audio.js"]
        if classic_audio.count(absolute_import) != 1:
            raise ValueError(f"Expected one {module} import in the classic edition")
        files["classic/audio.js"] = classic_audio.replace(absolute_import, sibling_import)

    missing = REQUIRED_FILES - files.keys()
    if missing:
        raise ValueError(f"Missing runtime files: {', '.join(sorted(missing))}")

    for scene_file, name in (
        ("index.html", "player-settings.css"),
        ("game.js", "player-settings.js"),
        ("game.js", "settings-panel.js"),
        ("simulation.js", "player-settings.js"),
        ("index.html", "mobile-play.css"),
        ("game.js", "mobile-play.js"),
        ("save.js", "save-slot.js"),
    ):
        parent = f"../{name}".encode()
        if files[scene_file].count(parent) != 1:
            raise ValueError(f"Expected one {name} reference in {scene_file}")
        files[scene_file] = files[scene_file].replace(parent, f"./{name}".encode())

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
