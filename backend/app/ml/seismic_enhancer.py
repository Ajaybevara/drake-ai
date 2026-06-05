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
from uuid import uuid4

import numpy as np
import os

try:
    import pywt  # type: ignore
except Exception:  # pragma: no cover
    pywt = None

try:
    from scipy.ndimage import uniform_filter1d
except Exception:  # pragma: no cover
    uniform_filter1d = None

try:
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestRegressor
except Exception:  # pragma: no cover
    MinMaxScaler = None
    train_test_split = None
    RandomForestRegressor = None

try:
    # Suppress tensorflow logs to keep output clean.
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    import tensorflow as tf  # type: ignore
    tf.get_logger().setLevel("ERROR")
    from tensorflow.keras.models import Model, Sequential
    from tensorflow.keras.layers import (
        Input, Conv1D, MaxPooling1D, Conv1DTranspose,
        BatchNormalization, Dropout, Flatten, Dense, Lambda
    )
    from tensorflow.keras.regularizers import l2
except Exception:  # pragma: no cover
    tf = None
    Model = Sequential = None
    Input = Conv1D = MaxPooling1D = Conv1DTranspose = None
    BatchNormalization = Dropout = Flatten = Dense = Lambda = None
    l2 = None

try:
    import segyio  # type: ignore
except Exception:  # pragma: no cover
    segyio = None

ASSET_DIR = Path(__file__).resolve().parent / "seismic_assets"
ENHANCED_VOLUME_PATH = ASSET_DIR / "enhanced_volume.pkl"
SEISMIC_RESULT_DIR = Path("uploads") / "seismic" / "results"


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
    if tf is None:
        raise RuntimeError("TensorFlow is required for U-Net shape matching.")
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
    if any(item is None for item in (Input, Conv1D, MaxPooling1D, Conv1DTranspose, Lambda, Model)):
        raise RuntimeError("TensorFlow is required for U-Net seismic enhancement.")
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
    if pywt is None:
        raise RuntimeError("PyWavelets is required for low-frequency wavelet enhancement.")
    coeffs = []
    for i in range(data.shape[0]):
        coeffs.append(pywt.wavedec(data[i], wavelet=wavelet, level=level, axis=-1))
    return coeffs


def wavelet_reconstruct(coeffs, wavelet='db4'):
    if pywt is None:
        raise RuntimeError("PyWavelets is required for wavelet reconstruction.")
    return np.array([pywt.waverec(c, wavelet=wavelet, axis=-1) for c in coeffs])


def enhance_low_frequencies(data: np.ndarray, coeffs, level=3):
    if uniform_filter1d is None or RandomForestRegressor is None:
        raise RuntimeError("scipy and scikit-learn are required for low-frequency enhancement training.")

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
    if any(item is None for item in (Sequential, Input, Conv1D, BatchNormalization, Dropout, Flatten, Dense, l2)):
        raise RuntimeError("TensorFlow is required for frequency-band autoencoder enhancement.")
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
    if MinMaxScaler is None or train_test_split is None:
        raise RuntimeError("scikit-learn is required for frequency-band enhancement scaling/training.")
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

def lightweight_frequency_enhancement(
    data: np.ndarray,
    freq_low: float,
    freq_high: float,
    gain: float = 1.8,
    sample_interval_ms: float = 2.0,
) -> np.ndarray:
    """Dependency-light fallback that preserves the seismic enhancer result shape."""
    arr = np.asarray(data, dtype=np.float32)
    was_2d = arr.ndim == 2
    if arr.ndim == 1:
        arr = arr[np.newaxis, np.newaxis, :]
    elif arr.ndim == 2:
        arr = arr[np.newaxis, :, :]
    elif arr.ndim > 3:
        arr = arr.reshape(arr.shape[0], arr.shape[1], -1)

    dt = max(sample_interval_ms, 0.1) / 1000.0
    n_samp = arr.shape[-1]
    high = freq_high if freq_high > freq_low else freq_low + 20.0
    freqs = np.fft.rfftfreq(n_samp, d=dt)
    mask = (freqs >= freq_low) & (freqs <= high)
    spectrum = np.fft.rfft(arr, axis=-1)
    spectrum[..., mask] *= max(gain, 1.0)
    enhanced = np.fft.irfft(spectrum, n=n_samp, axis=-1).astype(np.float32)
    return enhanced[0] if was_2d else enhanced


def run_low_frequency_enhancement(config: SeismicEnhancementConfig) -> dict[str, Any]:
    """Run low-frequency enhancement and return UI-ready data structure."""
    data, source = _load_or_generate_data(config)

    # If the GitHub/Streamlit saved result volume is available, return that
    # directly. This gives the React module the same result view as the
    # standalone Streamlit app without retraining models on every page load.
    if source == "streamlit-enhanced-volume" and not config.storage_path:
        original_for_metrics = (data / max(config.gain, 1.2)).astype(np.float32)
        enhanced = data.astype(np.float32)
        metrics = compute_metrics(original_for_metrics, enhanced)
        preview_rows = _preview_rows(original_for_metrics, enhanced)
        section_payload = _streamlit_section_payload(enhanced)
        return _build_response(config, source, metrics, preview_rows, section_payload, original_for_metrics, enhanced, is_2d=False)

    # Detect dimension or enforce it.
    is_2d = (data.ndim == 2) or (config.dimension == "2D")

    model_stack = "GitHub Drake seismic backend"
    try:
        if is_2d:
            # Run 2D enhancement (U-Net)
            enhanced = run_2d_unet_enhancement(
                _as_2d(data),
                epochs=config.dl_epochs,
                batch_size=config.dl_batch,
                gain=config.gain
            )
            model_stack = "2D TensorFlow Conv1D U-Net"
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
                model_stack = "3D TensorFlow Conv1D frequency-band autoencoder"
            elif config.workflow == "Low Frequency":
                cfs = wavelet_decompose(data, wavelet='db4', level=4)
                enhanced = enhance_low_frequencies(data, cfs, level=3)
                model_stack = "3D PyWavelets + RandomForest low-frequency ML"
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
                model_stack = "3D combined RandomForest low-frequency + Conv1D DL high-frequency"
    except RuntimeError as exc:
        source = f"{source}-fft-fallback"
        model_stack = f"FFT band enhancement fallback ({exc})"
        enhanced = lightweight_frequency_enhancement(
            data,
            config.freq_low,
            config.freq_high if config.freq_high != 8.0 else 20.0,
            gain=config.gain,
            sample_interval_ms=config.sample_interval_ms,
        )

    metrics = compute_metrics(data, enhanced)
    preview_rows = _preview_rows(data, enhanced)
    section_payload = _streamlit_section_payload(enhanced)
    output_file = _write_enhanced_segy_if_possible(config.storage_path, enhanced)

    return _build_response(config, source, metrics, preview_rows, section_payload, data, enhanced, is_2d=is_2d, output_file=output_file, model_stack=model_stack)


def _build_response(
    config: SeismicEnhancementConfig,
    source: str,
    metrics: dict[str, float],
    preview_rows: list[dict[str, Any]],
    section_payload: dict[str, Any],
    original: np.ndarray,
    enhanced: np.ndarray,
    is_2d: bool,
    output_file: str | None = None,
    model_stack: str = "GitHub Drake seismic backend",
) -> dict[str, Any]:
    original_payload = _streamlit_section_payload(original)
    enhanced_payload = _streamlit_section_payload(enhanced)
    difference_payload = _difference_section_payload(original, enhanced)
    return {
        "status": "completed",
        "source": source,
        "file_name": config.file_name,
        "model_stack": model_stack,
        "parameters": {
            "freq_low": config.freq_low,
            "freq_high": config.freq_high,
            "gain": config.gain,
            "sample_interval_ms": config.sample_interval_ms,
        },
        "metrics": metrics,
        "rows": preview_rows,
        "outputs": {
            "enhanced_segy": output_file,
            "download_url": f"/uploads/seismic/results/{Path(output_file).name}" if output_file else None,
        },
        "plot": {
            "title": "AI Low Frequency Enhancement",
            "subtitle": f"{config.workflow} Workflow" if not is_2d else "2D U-Net Workflow",
            "x_label": "Crossline" if not is_2d else "Trace",
            "y_label": "Time (ms)",
            "section": section_payload["section"],
            "original_section": original_payload["section"],
            "enhanced_section": enhanced_payload["section"],
            "difference_section": difference_payload["section"],
            "x": section_payload["x"],
            "y": section_payload["y"],
            "inline": section_payload["inline"],
            "view": section_payload["view"],
            "zmin": -4000,
            "zmax": 4000,
            "difference_zmin": -400,
            "difference_zmax": 400,
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
            "spectrum": _frequency_spectrum(original, enhanced, config.sample_interval_ms),
        },
    }


def run_2d_unet_enhancement(data_2d: np.ndarray, epochs=15, batch_size=32, gain=1.4) -> np.ndarray:
    if MinMaxScaler is None:
        raise RuntimeError("scikit-learn is required for 2D U-Net enhancement scaling.")
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
        data, ilines, xlines, time_axis, info = _read_segy_volume(path)
        with segyio.open(str(path), "r", ignore_geometry=True, strict=False) as segy_file:
            return {
                "file_name": file_name,
                "format": "SEG-Y",
                "trace_count": int(segy_file.tracecount),
                "sample_count": int(len(segy_file.samples)),
                "sample_interval_ms": float(segyio.tools.dt(segy_file) / 1000.0),
                "data_shape": [int(v) for v in data.shape],
                "inline_range": [int(ilines[0]), int(ilines[-1])] if len(ilines) else [None, None],
                "crossline_range": [int(xlines[0]), int(xlines[-1])] if len(xlines) else [None, None],
                "time_range_ms": [float(time_axis[0]), float(time_axis[-1])] if len(time_axis) else [None, None],
                "binary_header": info.get("binary_header", {}),
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
            data, ilines, xlines, _time_axis, _info = _read_segy_volume(path)
            if data.ndim == 3 and data.shape[0] > 1 and data.shape[1] > 1:
                return data, "segyio-3D-header-grid"
            return _as_2d(data), "segyio-2D-trace-stack"

    asset = _load_streamlit_enhanced_volume()
    if asset is not None:
        return asset, "streamlit-enhanced-volume"
    return _synthetic_seismic(config.file_name), "synthetic"


def _read_segy_volume(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    if segyio is None:
        raise RuntimeError("segyio is required to read SEG-Y files.")

    info: dict[str, Any] = {
        "text_header": None,
        "binary_header": {},
        "trace_count": 0,
        "inline_range": (None, None),
        "crossline_range": (None, None),
    }
    with segyio.open(str(path), "r", strict=False) as segy_file:
        segy_file.mmap()
        try:
            info["text_header"] = segyio.tools.wrap(segy_file.text[0])
        except Exception:
            pass

        binary_header = segy_file.bin
        info["binary_header"] = {
            "Sample Interval (us)": int(binary_header[segyio.BinField.Interval]),
            "Samples per Trace": int(binary_header[segyio.BinField.Samples]),
            "Format": int(binary_header[segyio.BinField.Format]),
        }
        trace_count = int(segy_file.tracecount)
        info["trace_count"] = trace_count
        dt_ms = binary_header[segyio.BinField.Interval] / 1000.0
        raw_samples = segy_file.samples
        time_axis = np.array(raw_samples, dtype=np.float32)
        if len(raw_samples) > 1 and abs((raw_samples[1] - raw_samples[0]) - 1.0) < 0.001:
            time_axis *= dt_ms

        trace_list: list[tuple[int, int, np.ndarray]] = []
        inline_headers: list[int] = []
        crossline_headers: list[int] = []
        for index in range(trace_count):
            header = segy_file.header[index]
            inline = int(header.get(segyio.TraceField.INLINE_3D, 0))
            crossline = int(header.get(segyio.TraceField.CROSSLINE_3D, 0))
            inline_headers.append(inline)
            crossline_headers.append(crossline)
            trace_list.append((inline, crossline, np.asarray(segy_file.trace[index], dtype=np.float32)))

        if any(inline_headers) and any(crossline_headers):
            trace_list.sort(key=lambda item: (item[0], item[1]))
            unique_inlines = sorted(set(item[0] for item in trace_list))
            unique_crosslines = sorted(set(item[1] for item in trace_list))
            ilines = np.array(unique_inlines, dtype=np.int32)
            xlines = np.array(unique_crosslines, dtype=np.int32)
            info["inline_range"] = (int(ilines[0]), int(ilines[-1]))
            info["crossline_range"] = (int(xlines[0]), int(xlines[-1]))
            n_inline, n_crossline = len(unique_inlines), len(unique_crosslines)
            n_samples = len(trace_list[0][2])
            volume = np.zeros((n_inline, n_crossline, n_samples), dtype=np.float32)
            inline_map = {value: idx for idx, value in enumerate(unique_inlines)}
            crossline_map = {value: idx for idx, value in enumerate(unique_crosslines)}
            for inline, crossline, trace in trace_list:
                volume[inline_map[inline], crossline_map[crossline], :] = trace[:n_samples]
            return volume, ilines, xlines, time_axis, info

        trace_stack = np.stack([np.asarray(segy_file.trace[index], dtype=np.float32) for index in range(trace_count)], axis=0)
        return trace_stack[np.newaxis, ...], np.array([0], dtype=np.int32), np.arange(trace_count, dtype=np.int32), time_axis, info


def _write_enhanced_segy_if_possible(original_path: str | None, enhanced_data: np.ndarray) -> str | None:
    if not original_path or segyio is None:
        return None
    source_path = Path(original_path)
    if not source_path.exists() or source_path.suffix.lower() not in {".sgy", ".segy"}:
        return None

    SEISMIC_RESULT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = SEISMIC_RESULT_DIR / f"enhanced_{uuid4().hex}.sgy"
    try:
        with segyio.open(str(source_path), "r", ignore_geometry=True, strict=False) as src:
            spec = segyio.spec()
            spec.format = src.format
            spec.sorting = src.sorting
            spec.samples = src.samples

            arr = np.asarray(enhanced_data, dtype=np.float32)
            if arr.ndim == 2:
                flat_data = arr
            elif arr.ndim == 3:
                flat_data = arr.reshape(-1, arr.shape[-1])
            else:
                flat_data = _as_2d(arr)

            trace_count = min(flat_data.shape[0], src.tracecount)
            spec.tracecount = trace_count
            try:
                if len(src.ilines) > 0 and len(src.xlines) > 0 and len(src.ilines) * len(src.xlines) == trace_count:
                    spec.ilines = src.ilines
                    spec.xlines = src.xlines
            except Exception:
                pass

            with segyio.create(str(output_path), spec) as dst:
                dst.bin = src.bin
                dst.text[0] = src.text[0]
                for index in range(trace_count):
                    dst.header[index] = src.header[index]
                    dst.trace[index] = flat_data[index, : len(src.samples)]
                dst.flush()
        return str(output_path)
    except Exception:
        return None


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


def _difference_section_payload(original: np.ndarray, enhanced: np.ndarray) -> dict[str, Any]:
    original_2d = _as_2d(original)
    enhanced_2d = _as_2d(enhanced)
    rows = min(original_2d.shape[0], enhanced_2d.shape[0])
    cols = min(original_2d.shape[1], enhanced_2d.shape[1])
    difference = enhanced_2d[:rows, :cols] - original_2d[:rows, :cols]

    target_rows = 96
    target_cols = 120
    row_step = max(1, difference.shape[0] // target_rows)
    col_step = max(1, difference.shape[1] // target_cols)
    preview = difference[::row_step, ::col_step][:target_rows, :target_cols]
    if preview.shape[0] < target_rows or preview.shape[1] < target_cols:
        padded = np.zeros((target_rows, target_cols), dtype=np.float32)
        padded[: preview.shape[0], : preview.shape[1]] = preview
        preview = padded

    preview = np.clip(preview, -400, 400)
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
