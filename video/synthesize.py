"""Genera segmentos de voz Daniela en CUDA y prepara las duraciones de la escena."""
import argparse
import json
import re
import subprocess
import wave
from pathlib import Path

import onnxruntime as ort
from piper import PiperVoice


def speakable(text):
    aliases = {"@": " por la matriz ", "×": " por ", "−": " menos ", "√": " raíz cuadrada de ",
               "σ": "sigma", "²": " al cuadrado", "→": " pasa a ", "CPU": "ce pe u", "CUDA": "cuda",
               "HTTPS": "hache te te pe ese", "DNS": "de ene ese", "TLS": "te ele ese", "URL": "u erre ele",
               "GPU": "ge pe u", "NumPy": "nampai", "UXP": "u equis pe"}
    for source, target in aliases.items():
        text = text.replace(source, target)
    return re.sub(r"[_\[\]{}<>]", " ", text)


def process(voice, lines, length, folder, ffmpeg):
    audio = []
    for idx, text in enumerate(lines):
        filename = folder / f"phrase-{idx:02}.wav"
        with wave.open(str(filename), "wb") as result:
            voice.synthesize_wav(speakable(text), result)
        with wave.open(str(filename), "rb") as result:
            seconds = result.getnframes() / result.getframerate()
        audio.append((filename, seconds))
    spoken = sum(seconds for _, seconds in audio)
    tempo = max(0.88, spoken / max(1, length - 1.5 * len(lines) - 2))
    if tempo > 1.55:
        raise ValueError("Escena con demasiado texto para una narración clara.")
    remaining = length - spoken / tempo - 1.5
    gap = remaining / len(lines)
    copies, captions, start = [], [], 1.5
    for idx, ((source, seconds), text) in enumerate(zip(audio, lines)):
        target = folder / f"segment-{idx:02}.wav"
        duration = seconds / tempo
        delay = 1500 if idx == 0 else 0
        filter_text = f"atempo={tempo:.6f},adelay={delay}:all=1,apad,atrim=duration={duration + gap + delay / 1000:.6f}"
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(source),
                        "-af", filter_text, "-ar", "48000", "-ac", "1", str(target)], check=True)
        copies.append(target.name)
        captions.append({"start": round(start, 3), "end": round(start + duration + min(0.55, gap), 3), "text": text})
        start += duration + gap
    listing = folder / "segments.txt"
    listing.write_text("".join(f"file '{name}'\n" for name in copies), encoding="utf-8")
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "concat",
                    "-safe", "1", "-i", str(listing), "-af", f"apad,atrim=duration={length}",
                    "-ar", "48000", "-ac", "1", str(folder / "voz.wav")], check=True)
    (folder / "captions.json").write_text(json.dumps(captions, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("job", type=Path)
    parser.add_argument("ffmpeg")
    args = parser.parse_args()
    if hasattr(ort, "preload_dlls"):
        ort.preload_dlls()
    voice = PiperVoice.load(str(args.model), use_cuda=True)
    if voice.session.get_providers()[0] != "CUDAExecutionProvider":
        raise SystemExit("CUDA no está activo en ONNX Runtime. Revisa CUDA y cuDNN en Anaconda.")
    scenes = json.loads(args.job.read_text(encoding="utf-8"))
    for scene in scenes:
        folder = args.job.parent / scene["id"]
        folder.mkdir(exist_ok=True)
        process(voice, scene["lines"], scene["seconds"], folder, args.ffmpeg)
    print("Voz Daniela sintetizada con CUDA.")
