import numpy as np
from io import BytesIO
import tensorflow as tf
from pydub import AudioSegment
from src.setup_model import num_to_char
from src.constants import (
    frame_length,
    frame_step,
    fft_length,
    num_mel_bins,
    lower_freq,
    upper_freq
)

def segment_audio_bytes(audio_bytes, segment_length_ms=10000, overlap_ms=1000):
    audio = AudioSegment.from_file(BytesIO(audio_bytes), format="wav")
    segments = []

    for start in range(0, len(audio), segment_length_ms - overlap_ms):
        end = min(start + segment_length_ms, len(audio))
        segment = audio[start:end]
        buffer = BytesIO()
        segment.export(buffer, format="wav")
        segments.append(buffer.getvalue())

    return segments


def preprocess_audio(file_bytes):
    audio, sample_rate = tf.audio.decode_wav(file_bytes)
    audio = tf.squeeze(audio, axis=-1)

    stft = tf.signal.stft(audio, frame_length=frame_length, frame_step=frame_step, fft_length=fft_length)
    magnitude_spectrogram = tf.abs(stft)

    num_spectrogram_bins = fft_length // 2 + 1

    linear_to_mel_weight_matrix = tf.signal.linear_to_mel_weight_matrix(
        num_mel_bins=num_mel_bins,
        num_spectrogram_bins=num_spectrogram_bins,
        sample_rate=tf.cast(sample_rate, tf.float32),
        lower_edge_hertz=lower_freq,
        upper_edge_hertz=upper_freq,
    )

    power_spectrogram = tf.square(magnitude_spectrogram)
    mel_spectrogram = tf.matmul(power_spectrogram, linear_to_mel_weight_matrix)
    log_mel_spectrogram = tf.math.log(mel_spectrogram + 1e-6)

    return log_mel_spectrogram

def decode_predictions(pred):
    input_len = np.ones(pred.shape[0]) * pred.shape[1]
    results = tf.keras.backend.ctc_decode(pred, input_length=input_len, greedy=True)[0][0]
    output_text = []
    for result in results:
        result = tf.strings.reduce_join(num_to_char(result)).numpy().decode("utf-8")
        output_text.append(result)
    return output_text
