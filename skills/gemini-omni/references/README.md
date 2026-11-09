# Gemini Omni Reference Index

This directory contains deep technical documentation for Google's **Gemini Omni** multimodal speech, dialogue, video generation, and conversational editing models:

- **[gemini-omni-flash-1-2.md](gemini-omni-flash-1-2.md)**: Complete specification for **Gemini Omni Flash 1.2** (`gemini-omni-flash-1.2-preview` and `gemini-omni-flash-1.2`), covering `uv run scripts/omni.py` CLI workflows, Vertex AI / Gemini Enterprise ADC authentication, single-speaker TTS and multi-speaker dialogue (`response_modalities=["AUDIO"]`, `SpeechConfig`, 24 kHz RIFF WAV wrapping), conversational video generation and editing, and Ebitengine 2D game audio integration.
- **[gemini-omni-1-1-flash.md](gemini-omni-1-1-flash.md)**: Full specification for `gemini-omni-1.1-flash`, including `gemini-api video` CLI workflows, media role tags (`<FIRST_FRAME>`, `<LAST_FRAME>`, `<IMAGE_REF_N>`, `<VIDEO_REF_N>`, `[# Sources ...]`), multi-turn editing and `+10s` video extension (up to `40s`), `delivery: "uri"`, and Python/TypeScript/Go SDK integration patterns.
