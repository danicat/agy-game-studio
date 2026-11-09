# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai>=1.68.0",
#     "google-auth>=2.0.0",
# ]
# ///

import argparse
import base64
import io
import os
import sys
import time
import warnings
import wave

warnings.filterwarnings("ignore", category=SyntaxWarning, module="google.genai")

import google.auth
from google import genai
from google.genai import types
from google.genai.errors import APIError

DEFAULT_MODEL = "gemini-omni-flash-1.2-preview"

MODEL_MAP = {
    "gemini-omni-flash-1.2-preview": "gemini-omni-flash-1.2-preview",
    "gemini-omni-flash-1.2": "gemini-omni-flash-1.2",
    "gemini-omni-1.2-flash": "gemini-omni-flash-1.2",
    "omni-flash-1.2": "gemini-omni-flash-1.2-preview",
    "omni-1.2": "gemini-omni-flash-1.2-preview",
    "flash-1.2": "gemini-omni-flash-1.2-preview",
    "1.2": "gemini-omni-flash-1.2-preview",
    "gemini-omni-1.1": "gemini-omni-1.1-flash",
    "gemini-omni-1.1-flash": "gemini-omni-1.1-flash",
    "omni-flash-1.1": "gemini-omni-1.1-flash",
    "omni-1.1": "gemini-omni-1.1-flash",
    "flash-1.1": "gemini-omni-1.1-flash",
    "1.1": "gemini-omni-1.1-flash",
    "gemini-omni-flash-1.1-preview": "gemini-omni-flash-1.1-preview",
    "gemini-3.1-flash-tts-preview": "gemini-3.1-flash-tts-preview",
    "3.1-tts": "gemini-3.1-flash-tts-preview",
    "gemini-3.8-flash-tts": "gemini-3.8-flash-tts",
    "3.8-tts": "gemini-3.8-flash-tts",
    "tts": "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts": "gemini-3.8-flash-lite-tts",
    "tts-lite": "gemini-3.8-flash-lite-tts",
}

DEPRECATED_MODELS = {
    "gemini-omni-flash-preview",
}

VALID_VOICES = [
    "Kore",
    "Puck",
    "Zephyr",
    "Charon",
    "Fenrir",
    "Aoede",
    "Leda",
    "Orus",
    "Callirrhoe",
    "Autonoe",
    "Enceladus",
    "Iapetus",
    "Umbriel",
    "Algieba",
    "Despina",
]

VALID_RESOLUTIONS = ["360p", "720p", "1080p", "4k"]
VALID_ASPECT_RATIOS = ["16:9", "9:16"]
VALID_DURATIONS = [f"{s}s" for s in range(3, 11)]

AUTH_HELP_MESSAGE = (
    "Authenticate using one of the following methods:\n"
    "  1. Vertex AI / Gemini Enterprise (Application Default Credentials):\n"
    "     gcloud auth application-default login\n"
    "     export GOOGLE_CLOUD_PROJECT=\"your-gcp-project-id\"\n"
    "     export GOOGLE_CLOUD_LOCATION=\"us-central1\"\n"
    "     export GOOGLE_GENAI_USE_VERTEXAI=\"true\"\n"
    "     (or pass --vertexai --project \"your-gcp-project-id\" --location \"us-central1\")\n"
    "  2. Gemini Developer API (API Key):\n"
    "     export GEMINI_API_KEY=\"your-api-key\"\n\n"
    "AGENT INSTRUCTION: Fail fast with zero fallbacks. Do NOT attempt rogue workarounds, "
    "mock audio/video files, or silent fallbacks. Stop immediately, report this exact "
    "authentication error to the user, and ask them to configure credentials."
)


def resolve_model(model_name: str | None) -> str:
    """Resolve a model alias or canonical ID to a supported Gemini Omni / TTS model string."""
    if not model_name:
        return DEFAULT_MODEL
    key = model_name.strip()
    if key in DEPRECATED_MODELS:
        raise ValueError(
            f"Model '{key}' is deprecated and shut down. "
            f"Use '{DEFAULT_MODEL}', 'gemini-omni-flash-1.2', or 'gemini-omni-1.1-flash'."
        )
    if key not in MODEL_MAP:
        supported = ", ".join(sorted(MODEL_MAP.keys()))
        raise ValueError(f"Unsupported model '{key}'. Supported models and aliases: {supported}")
    return MODEL_MAP[key]


def parse_speaker_mappings(speaker_args: list[str] | None) -> list[tuple[str, str]]:
    """Parse repeatable or comma-separated 'Name=Voice' speaker mappings."""
    if not speaker_args:
        return []
    mappings: list[tuple[str, str]] = []
    for raw_entry in speaker_args:
        for item in raw_entry.split(","):
            part = item.strip()
            if not part:
                continue
            if "=" not in part:
                raise ValueError(
                    f"Invalid speaker mapping '{part}'. Expected format 'SpeakerName=VoiceName' (for example 'Alice=Kore')."
                )
            speaker_name, voice_name = part.split("=", 1)
            speaker_name = speaker_name.strip()
            voice_name = voice_name.strip()
            if not speaker_name or not voice_name:
                raise ValueError(
                    f"Invalid speaker mapping '{part}'. Both speaker name and voice name must be non-empty."
                )
            mappings.append((speaker_name, voice_name))
    if len(mappings) == 1:
        raise ValueError(
            "Multi-speaker dialogue requires at least 2 '--speaker Name=Voice' entries "
            "(or use '--voice VoiceName' for single-speaker speech)."
        )
    return mappings


def build_speech_config(
    voice: str = "Kore",
    speakers: list[str] | None = None,
    language_code: str | None = None,
) -> types.GenerateContentConfig:
    """Build GenerateContentConfig with AUDIO modality and single-speaker or multi-speaker SpeechConfig."""
    parsed_speakers = parse_speaker_mappings(speakers)
    if parsed_speakers:
        speaker_configs = [
            types.SpeakerVoiceConfig(
                speaker=speaker_name,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                ),
            )
            for speaker_name, voice_name in parsed_speakers
        ]
        speech_cfg = types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=speaker_configs
            ),
            language_code=language_code,
        )
    else:
        voice_name = (voice or "Kore").strip()
        if not voice_name:
            raise ValueError("Voice name cannot be empty.")
        speech_cfg = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            ),
            language_code=language_code,
        )

    return types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=speech_cfg,
    )


def wrap_pcm_as_wav(
    audio_bytes: bytes,
    sample_rate: int = 24000,
    channels: int = 1,
    sample_width: int = 2,
) -> bytes:
    """Wrap raw 16-bit PCM audio bytes into a standard RIFF WAVE container if not already WAV."""
    if not audio_bytes:
        raise ValueError("Cannot wrap empty audio buffer into WAV.")
    if len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return audio_bytes

    frame_align = channels * sample_width
    aligned_len = len(audio_bytes) - (len(audio_bytes) % frame_align)
    pcm_payload = audio_bytes[:aligned_len]

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_payload)
    return buf.getvalue()


def init_client(args) -> genai.Client:
    """Initialize Google GenAI Client with Vertex AI ADC or Gemini API Key (fail-fast, zero fallbacks)."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    env_vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in (
        "true",
        "1",
        "yes",
    )
    env_project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")

    use_vertex = bool(
        getattr(args, "vertexai", False)
        or getattr(args, "project", None) is not None
        or env_vertex
        or (env_project and not api_key)
    )

    if use_vertex:
        try:
            credentials, default_project = google.auth.default()
        except Exception as e:
            print(
                f"Error: Failed to load Google Cloud Application Default Credentials for Vertex AI: {e}\n\n"
                f"{AUTH_HELP_MESSAGE}",
                file=sys.stderr,
            )
            sys.exit(1)

        project = getattr(args, "project", None) or env_project or default_project
        location = (
            getattr(args, "location", None)
            or os.environ.get("GOOGLE_CLOUD_LOCATION")
            or "us-central1"
        )

        if not project:
            print(
                "Error: Vertex AI requested (--vertexai, --project, or GOOGLE_GENAI_USE_VERTEXAI=true), "
                "but no GCP Project ID was found. Pass --project <PROJECT_ID> or set GOOGLE_CLOUD_PROJECT.\n\n"
                f"{AUTH_HELP_MESSAGE}",
                file=sys.stderr,
            )
            sys.exit(1)

        return genai.Client(
            vertexai=True,
            project=project,
            location=location,
            credentials=credentials,
        )

    if not api_key:
        print(
            "Error: Missing credentials. Neither GEMINI_API_KEY / GOOGLE_API_KEY nor Vertex AI "
            "(GOOGLE_GENAI_USE_VERTEXAI=true / GOOGLE_CLOUD_PROJECT) is configured.\n\n"
            f"{AUTH_HELP_MESSAGE}",
            file=sys.stderr,
        )
        sys.exit(1)

    return genai.Client(api_key=api_key)


def detect_mime_type(path: str) -> str:
    """Detect media MIME type from file extension."""
    lower = path.lower()
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".mp4"):
        return "video/mp4"
    if lower.endswith(".webm"):
        return "video/webm"
    if lower.endswith(".mov"):
        return "video/mov"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".mp3"):
        return "audio/mp3"
    return "application/octet-stream"


def infer_mode(args) -> str:
    """Determine whether to run in 'speech' (TTS/dialogue) or 'video' mode."""
    if args.mode in ("speech", "tts", "audio"):
        return "speech"
    if args.mode == "video":
        return "video"

    # Auto-detect from flags and output extension
    if args.speaker or args.voice_explicit:
        return "speech"
    if (
        args.input
        or args.previous_interaction_id
        or args.resolution_explicit
        or args.aspect_ratio_explicit
        or args.duration_explicit
        or (args.output and args.output.lower().endswith(".mp4"))
    ):
        return "video"
    return "speech"


def extract_audio_bytes_from_response(response) -> tuple[bytes | None, str | None]:
    """Extract inline audio bytes and MIME type from a generate_content or interactions response."""
    if hasattr(response, "candidates") and response.candidates:
        for candidate in response.candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                inline_data = getattr(part, "inline_data", None)
                if inline_data and getattr(inline_data, "data", None):
                    raw = inline_data.data
                    if isinstance(raw, str):
                        raw = base64.b64decode(raw)
                    return raw, getattr(inline_data, "mime_type", None)

    output_audio = getattr(response, "output_audio", None)
    if output_audio and getattr(output_audio, "data", None):
        raw = output_audio.data
        if isinstance(raw, str):
            raw = base64.b64decode(raw)
        return raw, getattr(output_audio, "mime_type", None)

    for step in getattr(response, "steps", []) or []:
        if getattr(step, "type", None) == "model_output":
            for block in getattr(step, "content", []) or []:
                if getattr(block, "type", None) == "audio" and getattr(block, "data", None):
                    raw = block.data
                    if isinstance(raw, str):
                        raw = base64.b64decode(raw)
                    return raw, getattr(block, "mime_type", None)

    return None, None


def run_speech(client: genai.Client, args, model_id: str, output_path: str) -> None:
    """Generate single-speaker or multi-speaker speech and write WAV/audio to disk."""
    config = build_speech_config(
        voice=args.voice,
        speakers=args.speaker,
        language_code=args.language,
    )

    response = client.models.generate_content(
        model=model_id,
        contents=args.prompt,
        config=config,
    )

    audio_bytes, mime_type = extract_audio_bytes_from_response(response)
    if not audio_bytes:
        raise ValueError(f"No audio bytes returned from model '{model_id}'.")

    is_mp3 = (
        output_path.lower().endswith(".mp3")
        and mime_type
        and "mp3" in mime_type.lower()
    )
    if not is_mp3 and output_path.lower().endswith(".wav"):
        audio_bytes = wrap_pcm_as_wav(
            audio_bytes,
            sample_rate=args.sample_rate,
            channels=1,
            sample_width=2,
        )
    elif not is_mp3 and not (len(audio_bytes) >= 4 and audio_bytes[:4] in (b"RIFF", b"ID3\x03", b"ID3\x04", b"\xff\xfb", b"\xff\xf3")):
        audio_bytes = wrap_pcm_as_wav(
            audio_bytes,
            sample_rate=args.sample_rate,
            channels=1,
            sample_width=2,
        )

    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    print(f"Success! Speech audio saved to {output_path}")


def run_video(client: genai.Client, args, model_id: str, output_path: str) -> None:
    """Generate, edit, or extend video with synchronized audio via the Interactions API."""
    response_format = {
        "type": "video",
        "resolution": args.resolution,
        "aspect_ratio": args.aspect_ratio,
        "duration": args.duration,
        "delivery": args.delivery,
    }

    if args.input:
        input_payload = []
        for media_path in args.input:
            if media_path.startswith(("files/", "http://", "https://", "gs://")):
                media_type = "video" if media_path.lower().endswith(".mp4") or "youtube.com" in media_path or "youtu.be" in media_path else "image"
                input_payload.append({"type": media_type, "uri": media_path})
            else:
                mime = detect_mime_type(media_path)
                media_type = "video" if mime.startswith("video/") else "image"
                with open(media_path, "rb") as f:
                    b64_data = base64.b64encode(f.read()).decode("utf-8")
                input_payload.append(
                    {"type": media_type, "data": b64_data, "mime_type": mime}
                )
        input_payload.append({"type": "text", "text": args.prompt})
    else:
        input_payload = args.prompt

    kwargs = {
        "model": model_id,
        "input": input_payload,
        "response_format": response_format,
    }
    if args.previous_interaction_id:
        kwargs["previous_interaction_id"] = args.previous_interaction_id

    interaction = client.interactions.create(**kwargs)

    video_bytes = None
    output_video = getattr(interaction, "output_video", None)
    if output_video:
        if getattr(output_video, "data", None):
            raw = output_video.data
            video_bytes = base64.b64decode(raw) if isinstance(raw, str) else raw
        elif getattr(output_video, "uri", None):
            uri = output_video.uri
            file_name = "files/" + uri.split("/")[-1] if not uri.startswith("files/") else uri
            for _ in range(120):
                file_info = client.files.get(name=file_name)
                state_name = getattr(getattr(file_info, "state", None), "name", "ACTIVE")
                if state_name == "ACTIVE":
                    break
                if state_name == "FAILED":
                    raise RuntimeError(f"Video file processing failed for {file_name}")
                time.sleep(5)
            video_bytes = client.files.download(file=uri)

    if not video_bytes:
        for step in getattr(interaction, "steps", []) or []:
            if getattr(step, "type", None) == "model_output":
                for block in getattr(step, "content", []) or []:
                    if getattr(block, "type", None) == "video" and getattr(block, "data", None):
                        raw = block.data
                        video_bytes = base64.b64decode(raw) if isinstance(raw, str) else raw
                        break

    if not video_bytes:
        raise ValueError(f"No video data returned from Interactions API for model '{model_id}'.")

    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(video_bytes)

    interaction_id = getattr(interaction, "id", None)
    if interaction_id:
        print(f"Interaction ID: {interaction_id}")
    print(f"Success! Video saved to {output_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Gemini Omni CLI (scripts/omni.py): Generate single-speaker TTS, multi-speaker dialogue, "
            "and conversational video with synchronized audio using Gemini Omni Flash 1.2."
        )
    )
    parser.add_argument(
        "prompt_pos",
        nargs="?",
        default=None,
        help="Positional text prompt or dialogue script (alternative to --prompt)",
    )
    parser.add_argument(
        "-p",
        "--prompt",
        default=None,
        help="Text prompt, narration line, or multi-speaker script to synthesize",
    )
    parser.add_argument(
        "-f",
        "--file",
        dest="prompt_file",
        default=None,
        help="Read input prompt or dialogue script from a text file",
    )
    parser.add_argument(
        "-o",
        "--output",
        "--out",
        "--filename",
        dest="output",
        default=None,
        help="Output file path (defaults to output.wav for speech or output.mp4 for video)",
    )
    parser.add_argument(
        "-m",
        "--model",
        default=DEFAULT_MODEL,
        help=(
            f"Model ID or alias (default: {DEFAULT_MODEL}). "
            "Aliases include: gemini-omni-flash-1.2-preview, gemini-omni-flash-1.2, omni-flash-1.2, "
            "flash-1.2, 1.2, gemini-omni-1.1, gemini-omni-1.1-flash, gemini-omni-flash-1.1-preview, "
            "gemini-3.1-flash-tts-preview, gemini-3.8-flash-tts."
        ),
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "speech", "tts", "audio", "video"],
        default="auto",
        help="Generation mode: 'speech'/'tts' (24 kHz WAV speech/dialogue) or 'video' (Interactions API MP4 video)",
    )
    parser.add_argument(
        "-v",
        "--voice",
        default=None,
        help="Prebuilt voice name for single-speaker speech (default: Kore; e.g. Kore, Puck, Zephyr, Charon, Fenrir, Aoede)",
    )
    parser.add_argument(
        "-s",
        "--speaker",
        "--multi-speaker",
        dest="speaker",
        action="append",
        default=[],
        help="Multi-speaker voice mapping 'Name=Voice' (repeatable or comma-separated, e.g. --speaker Alice=Kore --speaker Bob=Puck)",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Optional BCP-47 language code hint for speech generation (e.g. en-US, pt-BR, ja-JP)",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=24000,
        help="PCM sample rate in Hz when wrapping raw audio into RIFF WAV (default: 24000)",
    )
    parser.add_argument(
        "-i",
        "--input",
        action="append",
        default=[],
        help="Input image or video file path / URI for video generation or editing (repeatable)",
    )
    parser.add_argument(
        "-r",
        "--resolution",
        choices=VALID_RESOLUTIONS,
        default=None,
        help="Video output resolution: 360p, 720p (default), 1080p, 4k",
    )
    parser.add_argument(
        "-a",
        "--aspect-ratio",
        choices=VALID_ASPECT_RATIOS,
        default=None,
        help="Video aspect ratio: 16:9 (default), 9:16",
    )
    parser.add_argument(
        "--duration",
        choices=VALID_DURATIONS,
        default=None,
        help="Video clip duration: 3s to 10s (default: 10s)",
    )
    parser.add_argument(
        "--delivery",
        choices=["inline", "uri"],
        default="inline",
        help="Video delivery mode: 'inline' (default) or 'uri'",
    )
    parser.add_argument(
        "--previous-interaction-id",
        default=None,
        help="Continue from a prior interaction ID for stateful multi-turn video editing or +10s extension",
    )
    parser.add_argument(
        "--vertexai",
        action="store_true",
        help="Use Vertex AI / Gemini Enterprise with Application Default Credentials (ADC)",
    )
    parser.add_argument(
        "--project",
        default=None,
        help="GCP Project ID for Vertex AI (defaults to GOOGLE_CLOUD_PROJECT)",
    )
    parser.add_argument(
        "--location",
        default=None,
        help="GCP Location for Vertex AI (defaults to GOOGLE_CLOUD_LOCATION or 'us-central1')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate model alias, speech/video configuration, and output settings without calling the API",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # Resolve prompt from --prompt, positional argument, or --file
    prompt_text = args.prompt or args.prompt_pos
    if args.prompt_file:
        with open(args.prompt_file, "r", encoding="utf-8") as pf:
            file_text = pf.read().strip()
        prompt_text = f"{file_text}\n{prompt_text}".strip() if prompt_text else file_text

    if not prompt_text:
        print(
            "Error: A text prompt is required. Pass --prompt \"...\", a positional prompt, or --file <script.txt>.",
            file=sys.stderr,
        )
        sys.exit(2)
    args.prompt = prompt_text

    try:
        model_id = resolve_model(args.model)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    args.voice_explicit = args.voice is not None
    if args.voice is None:
        args.voice = "Kore"

    args.resolution_explicit = args.resolution is not None
    if args.resolution is None:
        args.resolution = "720p"

    args.aspect_ratio_explicit = args.aspect_ratio is not None
    if args.aspect_ratio is None:
        args.aspect_ratio = "16:9"

    args.duration_explicit = args.duration is not None
    if args.duration is None:
        args.duration = "10s"

    effective_mode = infer_mode(args)
    output_path = args.output or ("output.mp4" if effective_mode == "video" else "output.wav")

    try:
        if effective_mode == "speech":
            build_speech_config(
                voice=args.voice,
                speakers=args.speaker,
                language_code=args.language,
            )
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    print(f"Model: {model_id} ({args.model}) | Mode: {effective_mode}")
    if effective_mode == "speech":
        if args.speaker:
            parsed = parse_speaker_mappings(args.speaker)
            formatted = ", ".join(f"{name}={voice}" for name, voice in parsed)
            print(f"Speakers: {formatted} | Sample Rate: {args.sample_rate} Hz")
        else:
            print(f"Voice: {args.voice} | Sample Rate: {args.sample_rate} Hz")
    else:
        print(
            f"Resolution: {args.resolution} | Aspect Ratio: {args.aspect_ratio} | Duration: {args.duration}"
        )
        if args.input:
            print(f"Input Media ({len(args.input)}): {args.input}")
    print(f"Output: {output_path}")

    if args.dry_run:
        print("Dry run validation succeeded.")
        return 0

    client = init_client(args)

    try:
        if effective_mode == "speech":
            run_speech(client, args, model_id, output_path)
        else:
            run_video(client, args, model_id, output_path)
        return 0
    except APIError as e:
        print(
            f"API Error running {effective_mode} generation with {model_id}: {e}\n\n"
            f"{AUTH_HELP_MESSAGE}",
            file=sys.stderr,
        )
        sys.exit(1)
    except Exception as e:
        print(
            f"Error running {effective_mode} generation with {model_id}: {e}\n"
            "AGENT INSTRUCTION: Do NOT attempt rogue workarounds or silent fallbacks. Report this exact error to the user.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
