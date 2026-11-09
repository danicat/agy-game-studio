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
#     "pytest>=8.0.0",
# ]
# ///

import argparse
import io
import os
import shutil
import subprocess
import sys
import unittest
from unittest import mock
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import omni  # noqa: E402

SCRIPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omni.py")
CMD_BASE = ["uv", "run", SCRIPT_PATH] if shutil.which("uv") else [sys.executable, SCRIPT_PATH]


class TestOmniUnit(unittest.TestCase):
    def test_model_alias_resolution_omni_flash_1_2(self):
        self.assertEqual(omni.resolve_model(None), "gemini-omni-flash-1.2-preview")
        self.assertEqual(omni.resolve_model("gemini-omni-flash-1.2-preview"), "gemini-omni-flash-1.2-preview")
        self.assertEqual(omni.resolve_model("gemini-omni-flash-1.2"), "gemini-omni-flash-1.2")
        self.assertEqual(omni.resolve_model("gemini-omni-1.2-flash"), "gemini-omni-flash-1.2")
        self.assertEqual(omni.resolve_model("omni-flash-1.2"), "gemini-omni-flash-1.2-preview")
        self.assertEqual(omni.resolve_model("flash-1.2"), "gemini-omni-flash-1.2-preview")
        self.assertEqual(omni.resolve_model("1.2"), "gemini-omni-flash-1.2-preview")

    def test_model_alias_resolution_other_supported_models(self):
        self.assertEqual(omni.resolve_model("gemini-omni-1.1"), "gemini-omni-1.1-flash")
        self.assertEqual(omni.resolve_model("gemini-omni-1.1-flash"), "gemini-omni-1.1-flash")
        self.assertEqual(omni.resolve_model("gemini-omni-flash-1.1-preview"), "gemini-omni-flash-1.1-preview")
        self.assertEqual(omni.resolve_model("gemini-3.1-flash-tts-preview"), "gemini-3.1-flash-tts-preview")
        self.assertEqual(omni.resolve_model("gemini-3.8-flash-tts"), "gemini-3.8-flash-tts")

    def test_deprecated_and_unknown_models_fail_fast(self):
        with self.assertRaises(ValueError) as ctx:
            omni.resolve_model("gemini-omni-flash-preview")
        self.assertIn("deprecated", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            omni.resolve_model("non-existent-model-xyz")
        self.assertIn("Unsupported model", str(ctx2.exception))

    def test_single_speaker_speech_config(self):
        cfg = omni.build_speech_config(voice="Puck", speakers=None, language_code="en-US")
        self.assertEqual(cfg.response_modalities, ["AUDIO"])
        self.assertIsNotNone(cfg.speech_config)
        self.assertEqual(cfg.speech_config.language_code, "en-US")
        self.assertIsNone(cfg.speech_config.multi_speaker_voice_config)
        self.assertEqual(
            cfg.speech_config.voice_config.prebuilt_voice_config.voice_name,
            "Puck",
        )

    def test_multi_speaker_speech_config(self):
        cfg = omni.build_speech_config(
            voice="Kore",
            speakers=["Alice=Kore", "Bob=Charon"],
            language_code="en-US",
        )
        self.assertEqual(cfg.response_modalities, ["AUDIO"])
        self.assertIsNone(cfg.speech_config.voice_config)
        ms_cfg = cfg.speech_config.multi_speaker_voice_config
        self.assertIsNotNone(ms_cfg)
        self.assertEqual(len(ms_cfg.speaker_voice_configs), 2)
        self.assertEqual(ms_cfg.speaker_voice_configs[0].speaker, "Alice")
        self.assertEqual(
            ms_cfg.speaker_voice_configs[0].voice_config.prebuilt_voice_config.voice_name,
            "Kore",
        )
        self.assertEqual(ms_cfg.speaker_voice_configs[1].speaker, "Bob")
        self.assertEqual(
            ms_cfg.speaker_voice_configs[1].voice_config.prebuilt_voice_config.voice_name,
            "Charon",
        )

    def test_speaker_mapping_validation_errors(self):
        with self.assertRaises(ValueError):
            omni.parse_speaker_mappings(["AliceOnly"])
        with self.assertRaises(ValueError):
            omni.parse_speaker_mappings(["Alice=Kore"])

    def test_wrap_pcm_as_wav_header_and_idempotency(self):
        # 2400 samples of 16-bit mono silence (0.1 seconds at 24 kHz = 4800 bytes)
        raw_pcm = b"\x00\x00" * 2400
        wav_bytes = omni.wrap_pcm_as_wav(raw_pcm, sample_rate=24000, channels=1, sample_width=2)
        self.assertTrue(wav_bytes.startswith(b"RIFF"))
        self.assertEqual(wav_bytes[8:12], b"WAVE")

        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2)
            self.assertEqual(wf.getframerate(), 24000)
            self.assertEqual(wf.getnframes(), 2400)
            self.assertEqual(wf.readframes(2400), raw_pcm)

        # Already-wrapped RIFF WAVE should pass through unchanged
        wrapped_again = omni.wrap_pcm_as_wav(wav_bytes, sample_rate=24000)
        self.assertEqual(wrapped_again, wav_bytes)

    def test_init_client_api_key_vs_vertex_ai(self):
        args_api_key = argparse.Namespace(vertexai=False, project=None, location=None)
        with mock.patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-gemini-key"},
            clear=True,
        ), mock.patch("omni.genai.Client") as mock_client:
            omni.init_client(args_api_key)
            mock_client.assert_called_once_with(api_key="test-gemini-key")

        args_vertex = argparse.Namespace(vertexai=True, project="my-vertex-proj", location="europe-west4")
        fake_creds = object()
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch(
            "omni.google.auth.default", return_value=(fake_creds, "default-proj")
        ), mock.patch("omni.genai.Client") as mock_client:
            omni.init_client(args_vertex)
            mock_client.assert_called_once_with(
                vertexai=True,
                project="my-vertex-proj",
                location="europe-west4",
                credentials=fake_creds,
            )

        # Environment-driven Vertex AI initialization
        args_env_vertex = argparse.Namespace(vertexai=False, project=None, location=None)
        with mock.patch.dict(
            os.environ,
            {
                "GOOGLE_GENAI_USE_VERTEXAI": "true",
                "GOOGLE_CLOUD_PROJECT": "env-gcp-proj",
                "GOOGLE_CLOUD_LOCATION": "us-central1",
            },
            clear=True,
        ), mock.patch(
            "omni.google.auth.default", return_value=(fake_creds, None)
        ), mock.patch("omni.genai.Client") as mock_client:
            omni.init_client(args_env_vertex)
            mock_client.assert_called_once_with(
                vertexai=True,
                project="env-gcp-proj",
                location="us-central1",
                credentials=fake_creds,
            )

    def test_init_client_fail_fast_missing_auth(self):
        args_none = argparse.Namespace(vertexai=False, project=None, location=None)
        stderr_buf = io.StringIO()
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                omni.init_client(args_none)
            self.assertEqual(cm.exception.code, 1)
        err_out = stderr_buf.getvalue()
        self.assertIn("GEMINI_API_KEY", err_out)
        self.assertIn("GOOGLE_CLOUD_PROJECT", err_out)
        self.assertIn("Do NOT attempt rogue workarounds", err_out)

    def test_cli_help_and_dry_run(self):
        help_res = subprocess.run(CMD_BASE + ["--help"], capture_output=True, text=True)
        self.assertEqual(help_res.returncode, 0)
        unwrapped_help = " ".join(help_res.stdout.split()).replace("- ", "-")
        self.assertIn("gemini-omni-flash-1.2-preview", unwrapped_help)
        self.assertIn("gemini-omni-flash-1.2", unwrapped_help)
        self.assertIn("--voice", help_res.stdout)
        self.assertIn("--speaker", help_res.stdout)
        self.assertIn("--vertexai", help_res.stdout)

        for alias in ("gemini-omni-flash-1.2-preview", "gemini-omni-flash-1.2", "omni-flash-1.2", "1.2", "flash-1.2"):
            dry_res = subprocess.run(
                CMD_BASE
                + [
                    "--prompt",
                    "Systems online.",
                    "--model",
                    alias,
                    "--voice",
                    "Kore",
                    "--output",
                    "line.wav",
                    "--dry-run",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(dry_res.returncode, 0, msg=dry_res.stderr)
            self.assertIn("Mode: speech", dry_res.stdout)
            self.assertIn("Dry run validation succeeded.", dry_res.stdout)

        ms_dry_res = subprocess.run(
            CMD_BASE
            + [
                "--prompt",
                "Captain: Shields up! Engineer: Holding at eighty percent!",
                "--speaker",
                "Captain=Kore",
                "--speaker",
                "Engineer=Puck",
                "--output",
                "dialogue.wav",
                "--dry-run",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(ms_dry_res.returncode, 0, msg=ms_dry_res.stderr)
        self.assertIn("Speakers: Captain=Kore, Engineer=Puck", ms_dry_res.stdout)


if __name__ == "__main__":
    unittest.main()
