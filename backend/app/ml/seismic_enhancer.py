"""Backend-ready seismic frequency enhancement utilities.

This module integrates the machine learning and signal processing algorithms from the
AI-Low-Frequency-Enhancer project, including U-Net for 2D traces, Wavelets + Random Forest
for 3D low frequencies, and Conv1D Autoencoders for 3D high frequencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import hashlib
import math
import warnings

import numpy as np
import pywt
from scipy.ndimage import uniform_filter1d
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor

# Suppress tensorflow logs to keep output clean
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
tf.get_logger().setLevel("ERROR")

from tensorflow.keras.models import Model, Sequential
from tensorflow.keras.layers import (
    Input, Conv1D, MaxPooling1D, Conv1DTranspose,
    BatchNormalization, Dropout, Flatten, Dense, Lambda
)
from tensorflow.keras.regularizers import l2

try:
    import segyio  # type: ignore
except Exception:  # pragma: no cover
    segyio = None

ASSET_DIR = Path(__file__).resolve().parent / "seismic_assets"
ENHANCED_VOLUME_PATH = ASSET_DIR / "enhanced_volume.pkl"


@dataclass
class SeismicEnhancementConfig:
    file_name: str
    storage_path: str | None = None
    freq_low: float = 0.0
    freq_high: float = 8.0
    gain: float = 1.8
    sample_interval_ms: float = 2.0
    workflow: str = "Both"
    dimension: str = "3D"
    dl_epochs: int = 15
    dl_batch: int = 32


# ── Shape Matching Helper for U-Net ─────────────────────────────────────────

def concat_match_shapes(inputs):
    x, target = inputs
    x_len = tf.shape(x)[1]
    t_len = tf.shape(target)[1]
    diff = t_len - x_len

    def pad_fn():
        return tf.pad(x, [[0, 0], [0, diff], [0, 0]])

    def crop_fn():
        return x[:, :t_len, :]

    x_matched = tf.cond(diff > 0, pad_fn, crop_fn)
    if target.shape[1] is not None:
        x_matched.set_shape([None, target.shape[1], x.shape[2]])
    return tf.concat([x_matched, target], axis=-1)


# ── 2D U-Net Model ──────────────────────────────────────────────────────────

def unet_model(input_shape):
    inputs = Input(shape=input_shape)

    # Encoder
    c1 = Conv1D(32, 3, activation='relu', padding='same')(inputs)
    c1 = Conv1D(32, 3, activation='relu', padding='same')(c1)
    p1 = MaxPooling1D(2)(c1)

    c2 = Conv1D(64, 3, activation='relu', padding='same')(p1)
    c2 = Conv1D(64, 3, activation='relu', padding='same')(c2)
    p2 = MaxPooling1D(2)(c2)

    # Bottleneck
    c3 = Conv1D(256, 3, activation='relu', padding='same')(p2)

    # Decoder
    u1 = Conv1DTranspose(64, 3, strides=2, padding='same')(c3)
    concat1 = Lambda(concat_match_shapes)([u1, c2])
    c4 = Conv1D(64, 3, activation='relu', padding='same')(concat1)
    c4 = Conv1D(64, 3, activation='relu', padding='same')(c4)

    u2 = Conv1DTranspose(32, 3, strides=2, padding='same')(c4)
    concat2 = Lambda(concat_match_shapes)([u2, c1])
    c5 = Conv1D(32, 3, activation='relu', padding='same')(concat2)
    c5 = Conv1D(32, 3, activation='relu', padding='same')(c5)

    outputs = Conv1D(1, 1, activation='linear', padding='same')(c5)
    model = Model(inputs, outputs)
    model.compile(optimizer='adam', loss='mse')
    return model


# ── 3D Wavelet Enhancement ──────────────────────────────────────────────────

def wavelet_decompose(data: np.ndarray, wavelet='db4', level=4):
    coeffs = []
    for i in range(data.shape[0]):
        coeffs.append(pywt.wavedec(data[i], wavelet=wavelet, level=level, axis=-1))
    return coeffs


def wavelet_reconstruct(coeffs, wavelet='db4'):
    return np.array([pywt.waverec(c, wavelet=wavelet, axis=-1) for c in coeffs])


def enhance_low_frequencies(data: np.ndarray, coeffs, level=3):
    from scipy.ndimage import uniform_filter1d

    low_data = np.array([c[level] for c in coeffs])
    X = low_data.reshape(-1, low_data.shape[-1])

    sample_size = min(1000, X.shape[0])
    idxs = np.random.choice(X.shape[0], sample_size, replace=False)

    X_smooth = uniform_filter1d(X, size=5, axis=1)
    model = RandomForestRegressor(n_estimators=100, n_jobs=-1, random_state=42)
    model.fit(X[idxs], X_smooth[idxs])
    pred = model.predict(X).reshape(low_data.shape)

    gain = 1.5
    for i in range(len(coeffs)):
        coeffs[i][level] = gain * pred[i] + (1.0 - gain) * low_data[i]
        coeffs[i][0] = coeffs[i][0] * 0.5

    return wavelet_reconstruct(coeffs, 'db4')


# ── 3D Conv Autoencoder Frequency Band ──────────────────────────────────────

def build_dl_model(band_size):
    model = Sequential([
        Input(shape=(band_size, 1)),
        Conv1D(32, 3, activation='relu', padding='same', kernel_regularizer=l2(0.001)),
        BatchNormalization(), Dropout(0.2),
        Conv1D(64, 3, activation='relu', padding='same', kernel_regularizer=l2(0.001)),
        BatchNormalization(), Dropout(0.2),
        Conv1D(64, 3, activation='relu', padding='same', kernel_regularizer=l2(0.001)),
        BatchNormalization(), Flatten(),
        Dense(128, activation='relu', kernel_regularizer=l2(0.001)),
        Dropout(0.2),
        Dense(band_size, activation='sigmoid'),
    ])
    model.compile(optimizer='adam', loss='mse')
    return model


def enhance_freq_band_dl(band_data, epochs=15, batch_size=32):
    scaler = MinMaxScaler()
    shaped = scaler.fit_transform(band_data)

    noise_factor = 0.05
    noisy = shaped + noise_factor * np.random.randn(*shaped.shape)
    noisy = np.clip(noisy, 0.0, 1.0)

    X_train_noisy, _ = train_test_split(noisy, test_size=0.2, random_state=42)
    X_train_clean, _ = train_test_split(shaped, test_size=0.2, random_state=42)
    X_train_noisy = X_train_noisy[:, :, np.newaxis]
    X_train_clean = X_train_clean[:, :, np.newaxis]

    m = build_dl_model(band_data.shape[1])
    m.fit(X_train_noisy, X_train_clean, epochs=epochs, batch_size=batch_size, validation_split=0.1, verbose=0)

    predicted = m.predict(shaped[:, :, np.newaxis], verbose=0)
    enhanced_scaled = predicted.reshape(-1, band_data.shape[1])

    freq_gain = 1.4
    enhanced_scaled = np.clip(shaped * (1.0 - freq_gain) + enhanced_scaled * freq_gain, 0.0, 1.2)

    return scaler.inverse_transform(np.clip(enhanced_scaled, 0.0, 1.0))


def enhance_selected_freq_range(data: np.ndarray, freq_low: float, freq_high: float, dl_epochs=15, dl_batch=32):
    dt = 0.002
    n_il, n_xl, n_samp = data.shape
    freq = np.fft.fftfreq(n_samp, d=dt)
    half_n = n_samp // 2
    pos_freq = freq[:half_n]
    band_mask = (pos_freq >= freq_low) & (pos_freq <= freq_high)
    band_idxs = np.where(band_mask)[0]

    if len(band_idxs) == 0:
        return data.copy()

    out_data = np.zeros_like(data, dtype=np.float32)
    total = n_il * n_xl
    band_mags = np.zeros((total, len(band_idxs)), dtype=np.float32)
    band_phases = {}
    idx = 0
    for i in range(n_il):
        for j in range(n_xl):
            spec = np.fft.fft(data[i, j, :])
            half = spec[:half_n]
            band_mags[idx, :] = np.abs(half)[band_idxs]
            band_phases[(i, j)] = np.angle(half)[band_idxs]
            idx += 1

    new_band = enhance_freq_band_dl(band_mags, epochs=dl_epochs, batch_size=dl_batch)

    idx = 0
    for i in range(n_il):
        for j in range(n_xl):
            spec = np.fft.fft(data[i, j, :])
            half = spec[:half_n]
            mag = np.abs(half)
            phs = np.angle(half)

            mag[band_idxs] = new_band[idx, :]
            phs[band_idxs] = band_phases[(i, j)]

            half_upd = mag * np.exp(1j * phs)
            full_spec = np.zeros(n_samp, dtype=np.complex128)
            full_spec[:half_n] = half_upd
            for kk in range(1, half_n - (0 if n_samp % 2 != 0 else 1)):
                full_spec[n_samp - kk] = np.conjugate(half_upd[kk])

            out_data[i, j, :] = np.fft.ifft(full_spec).real
            idx += 1
    return out_data


def combine_enhancements(orig_data, low_data, high_data, cutoff=35.0):
    dt = 0.002
    n_il, n_xl, n_samp = orig_data.shape
    freq = np.fft.fftfreq(n_samp, d=dt)
    out = np.zeros_like(orig_data, dtype=np.float32)
    for i in range(n_il):
        for j in range(n_xl):
            fl = np.fft.fft(low_data[i, j, :])
            fh = np.fft.fft(high_data[i, j, :])
            sel = np.where(abs(freq) < cutoff, fl, fh)
            out[i, j, :] = np.fft.ifft(sel).real
    return out


# ── Core Pipeline Entry ─────────────────────────────────────────────────────

def run_low_frequency_enhancement(config: SeismicEnhancementConfig) -> dict[str, Any]:
    """Run low-frequency enhancement and return UI-ready data structure."""
    data, source = _load_or_generate_data(config)

    # Detect dimension or enforce it
    is_2d = (data.ndim == 2) or (config.dimension == "2D")

    if is_2d:
        # Run 2D enhancement (U-Net)
        enhanced = run_2d_unet_enhancement(
            _as_2d(data),
            epochs=config.dl_epochs,
            batch_size=config.dl_batch,
            gain=config.gain
        )
    else:
        # Run 3D pipeline
        if config.workflow == "High Frequency":
            enhanced = enhance_selected_freq_range(
                data,
                config.freq_low,
                config.freq_high,
                dl_epochs=config.dl_epochs,
                dl_batch=config.dl_batch
            )
        elif config.workflow == "Low Frequency":
            cfs = wavelet_decompose(data, wavelet='db4', level=4)
            enhanced = enhance_low_frequencies(data, cfs, level=3)
        else:
            # Both (combined workflow)
            high_data = enhance_selected_freq_range(
                data,
                config.freq_low,
                config.freq_high,
                dl_epochs=config.dl_epochs,
                dl_batch=config.dl_batch
            )
            cfs = wavelet_decompose(data, wavelet='db4', level=4)
            low_data = enhance_low_frequencies(data, cfs, level=3)
            enhanced = combine_enhancements(
                data,
                low_data,
                high_data,
                cutoff=35.0
            )

    metrics = compute_metrics(data, enhanced)
    preview_rows = _preview_rows(data, enhanced)
    section_payload = _streamlit_section_payload(enhanced)

    return {
        "status": "completed",
        "source": source,
        "file_name": config.file_name,
        "parameters": {
            "freq_low": config.freq_low,
            "freq_high": config.freq_high,
            "gain": config.gain,
            "sample_interval_ms": config.sample_interval_ms,
        },
        "metrics": metrics,
        "rows": preview_rows,
        "plot": {
            "title": "AI Low Frequency Enhancement",
            "subtitle": f"{config.workflow} Workflow" if not is_2d else "2D U-Net Workflow",
            "x_label": "Crossline" if not is_2d else "Trace",
            "y_label": "Time (ms)",
            "section": section_payload["section"],
            "x": section_payload["x"],
            "y": section_payload["y"],
            "inline": section_payload["inline"],
            "view": section_payload["view"],
            "zmin": -4000,
            "zmax": 4000,
            "color_scale": "RdBu",
            "amplitude_range": "+/-4k",
            "controls": {
                "data_dimension": "2D" if is_2d else "3D",
                "low_frequency_hz": config.freq_low,
                "high_frequency_hz": config.freq_high if config.freq_high != 8.0 else 20.0,
                "workflow": config.workflow,
                "inline_range": [200, 650],
                "crossline_range": [700, 1200],
                "selected_inline": 426,
                "selected_crossline": 950,
            },
            "spectrum": _frequency_spectrum(data, enhanced, config.sample_interval_ms),
        },
    }


def run_2d_unet_enhancement(data_2d: np.ndarray, epochs=15, batch_size=32, gain=1.4) -> np.ndarray:
    scaler = MinMaxScaler()
    scaled = np.array([scaler.fit_transform(tr.reshape(-1, 1)).flatten() for tr in data_2d])
    X = np.expand_dims(scaled, -1)

    unet = unet_model((data_2d.shape[1], 1))
    noise_factor = 0.05
    X_noisy = X + noise_factor * np.random.randn(*X.shape)
    X_noisy = np.clip(X_noisy, 0.0, 1.0).astype(np.float32)

    unet.fit(X_noisy, X, epochs=epochs, batch_size=batch_size, verbose=0)
    enh = unet.predict(X, verbose=0)

    # Apply enhancement gain
    enh = np.clip(X * (1.0 - gain) + enh * gain, 0.0, 1.0)
    enhanced = np.array([scaler.inverse_transform(enh[i]).flatten() for i in range(enh.shape[0])])
    return enhanced.astype(np.float32)


def compute_metrics(original: np.ndarray, enhanced: np.ndarray) -> dict[str, float]:
    original_2d = _as_2d(original)
    enhanced_2d = _as_2d(enhanced)
    delta = enhanced_2d - original_2d
    original_energy = float(np.mean(np.square(original_2d)))
    enhanced_energy = float(np.mean(np.square(enhanced_2d)))
    delta_energy = float(np.mean(np.square(delta)))
    similarity = 1.0 - min(1.0, float(np.mean(np.abs(delta))) / (float(np.mean(np.abs(original_2d))) + 1e-6))
    return {
        "original_energy": round(original_energy, 6),
        "enhanced_energy": round(enhanced_energy, 6),
        "energy_uplift_pct": round(((enhanced_energy - original_energy) / (original_energy + 1e-6)) * 100.0, 3),
        "difference_energy": round(delta_energy, 6),
        "structural_similarity": round(max(0.0, similarity), 4),
    }


def inspect_seismic_file(file_name: str, storage_path: str | None = None) -> dict[str, Any]:
    path = Path(storage_path) if storage_path else None
    if path and path.exists() and path.suffix.lower() in {".sgy", ".segy"} and segyio is not None:
        with segyio.open(str(path), "r", ignore_geometry=True, strict=False) as segy_file:
            return {
                "file_name": file_name,
                "format": "SEG-Y",
                "trace_count": int(segy_file.tracecount),
                "sample_count": int(len(segy_file.samples)),
                "sample_interval_ms": float(segyio.tools.dt(segy_file) / 1000.0),
                "backend": "segyio",
            }
    data, source = _load_or_generate_data(SeismicEnhancementConfig(file_name=file_name, storage_path=storage_path))
    section = _as_2d(data)
    return {
        "file_name": file_name,
        "format": Path(file_name).suffix.upper().replace(".", "") or "SYNTHETIC",
        "trace_count": int(section.shape[0]),
        "sample_count": int(section.shape[1]),
        "sample_interval_ms": 2.0,
        "backend": source,
    }


def _load_or_generate_data(config: SeismicEnhancementConfig) -> tuple[np.ndarray, str]:
    path = Path(config.storage_path) if config.storage_path else None
    if path and path.exists():
        suffix = path.suffix.lower()
        if suffix == ".npy":
            return np.load(path), "npy"
        if suffix in {".csv", ".txt"}:
            return np.loadtxt(path, delimiter=","), "csv"
        if suffix in {".sgy", ".segy"} and segyio is not None:
            # Check if geometry can be read; if so load as 3D cube, otherwise fallback to 2D trace stack
            try:
                with segyio.open(str(path), "r", strict=False) as segy_file:
                    segy_file.mmap()
                    if len(segy_file.ilines) > 1 and len(segy_file.xlines) > 1:
                        # Preallocate and load 3D cube
                        n_il = len(segy_file.ilines)
                        n_xl = len(segy_file.xlines)
                        n_samp = len(segy_file.samples)
                        # Read and reshape trace data
                        traces = segy_file.trace.raw[:]
                        # Safe shape match
                        if traces.shape[0] == n_il * n_xl:
                            cube = traces.reshape(n_il, n_xl, n_samp)
                            return cube, "segyio-3D"
            except Exception:
                pass
            # 2D fallback: read first 256 traces
            with segyio.open(str(path), "r", ignore_geometry=True, strict=False) as segy_file:
                traces = [trace.copy() for trace in segy_file.trace[: min(segy_file.tracecount, 256)]]
                return np.stack(traces), "segyio-2D"

    asset = _load_streamlit_enhanced_volume()
    if asset is not None:
        return asset, "streamlit-enhanced-volume"
    return _synthetic_seismic(config.file_name), "synthetic"


def _synthetic_seismic(seed_text: str) -> np.ndarray:
    seed = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    traces, samples = 160, 220
    x = np.linspace(0, 1, traces)[:, None]
    t = np.linspace(0, 1, samples)[None, :]
    reflector_1 = np.sin(2 * math.pi * (14.0 * (t + 0.09 * np.sin(5 * x))))
    reflector_2 = np.sin(2 * math.pi * (24.0 * (t - 0.13 * np.cos(4 * x))))
    low = np.sin(2 * math.pi * (3.0 * t + 0.45 * x))
    noise = 0.22 * rng.normal(size=(traces, samples))
    envelope = (
        np.exp(-((t - 0.22 - 0.025 * np.sin(7 * x)) ** 2) / 0.0008)
        + np.exp(-((t - 0.48 - 0.16 * x) ** 2) / 0.018)
        + np.exp(-((t - 0.72 + 0.05 * np.sin(8 * x)) ** 2) / 0.008)
    )
    return (1750 * (0.8 * reflector_1 + 0.65 * reflector_2 + 0.45 * low + noise) * envelope).astype(np.float32)


def _load_streamlit_enhanced_volume() -> np.ndarray | None:
    if not ENHANCED_VOLUME_PATH.exists():
        return None
    try:
        import joblib  # type: ignore
        obj = joblib.load(ENHANCED_VOLUME_PATH)
    except Exception:
        try:
            import pickle
            with ENHANCED_VOLUME_PATH.open("rb") as handle:
                obj = pickle.load(handle)
        except Exception:
            return None

    if isinstance(obj, dict):
        for key in ("enhanced_volume", "enhanced_data", "volume", "data"):
            value = obj.get(key)
            if hasattr(value, "shape"):
                return np.asarray(value, dtype=np.float32)
        for value in obj.values():
            if hasattr(value, "shape"):
                return np.asarray(value, dtype=np.float32)
    if hasattr(obj, "shape"):
        return np.asarray(obj, dtype=np.float32)
    return None


def _as_2d(data: np.ndarray) -> np.ndarray:
    arr = np.asarray(data, dtype=np.float32)
    if arr.ndim == 1:
        return arr[None, :]
    if arr.ndim == 2:
        return arr
    if arr.ndim == 3:
        return arr[arr.shape[0] // 2, :, :]
    return arr.reshape(arr.shape[0], -1)


def _preview_rows(original: np.ndarray, enhanced: np.ndarray) -> list[dict[str, Any]]:
    o = _as_2d(original)
    e = _as_2d(enhanced)
    rows: list[dict[str, Any]] = []
    for idx in range(5):
        trace_idx = min(idx * max(1, o.shape[0] // 5), o.shape[0] - 1)
        sample_idx = min(idx * max(1, o.shape[1] // 5), o.shape[1] - 1)
        rows.append({
            "#": idx + 1,
            "Trace": int(trace_idx),
            "Sample": int(sample_idx),
            "Original Amp": round(float(o[trace_idx, sample_idx]), 5),
            "Enhanced Amp": round(float(e[trace_idx, sample_idx]), 5),
            "Delta": round(float(e[trace_idx, sample_idx] - o[trace_idx, sample_idx]), 5),
        })
    return rows


def _section_preview(data: np.ndarray) -> list[list[float]]:
    section = _as_2d(data)
    trace_step = max(1, section.shape[0] // 48)
    sample_step = max(1, section.shape[1] // 96)
    preview = section[::trace_step, ::sample_step][:48, :96]
    return [[round(float(value), 5) for value in row] for row in preview]


def _streamlit_section_payload(data: np.ndarray) -> dict[str, Any]:
    section = _as_2d(data)
    target_rows = 96
    target_cols = 120
    row_step = max(1, section.shape[0] // target_rows)
    col_step = max(1, section.shape[1] // target_cols)
    preview = section[::row_step, ::col_step][:target_rows, :target_cols]
    if preview.shape[0] < target_rows or preview.shape[1] < target_cols:
        padded = np.zeros((target_rows, target_cols), dtype=np.float32)
        padded[: preview.shape[0], : preview.shape[1]] = preview
        preview = padded
    preview = np.clip(preview, -4000, 4000)
    x = np.linspace(700, 1200, preview.shape[1])
    y = np.linspace(400, 1100, preview.shape[0])
    return {
        "inline": 426,
        "view": "Inline",
        "x": [round(float(value), 2) for value in x],
        "y": [round(float(value), 2) for value in y],
        "section": [[round(float(value), 3) for value in row] for row in preview],
    }


def _frequency_spectrum(original: np.ndarray, enhanced: np.ndarray, sample_interval_ms: float) -> list[dict[str, float]]:
    o = np.mean(_as_2d(original), axis=0)
    e = np.mean(_as_2d(enhanced), axis=0)
    dt_seconds = max(sample_interval_ms, 0.1) / 1000.0
    freqs = np.fft.rfftfreq(o.shape[0], d=dt_seconds)
    amp_o = np.abs(np.fft.rfft(o))
    amp_e = np.abs(np.fft.rfft(e))
    step = max(1, len(freqs) // 32)
    return [
        {
            "frequency": round(float(freqs[i]), 4),
            "original": round(float(amp_o[i]), 5),
            "enhanced": round(float(amp_e[i]), 5),
        }
        for i in range(0, len(freqs), step)
    ][:32]
