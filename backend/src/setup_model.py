import json
import tensorflow as tf
from pathlib import Path
import os

# Required environment variables
os.environ["KERAS_BACKEND"] = "jax"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "true"

import keras
from huggingface_hub import snapshot_download

# 📁 Project directories
BASE_DIR = Path(__file__).resolve().parent
REPO_ID = "manonkrk/deepspeech2_like_model"
FILENAME = "deepspeech2_like_model.keras"
VOCAB_PATH = BASE_DIR.parent / "artifacts" / "vocab.json"

# 📥 Download the model from Hugging Face into a local directory
model_dir = snapshot_download(repo_id=REPO_ID)
model_path = Path(model_dir) / FILENAME

# 📖 Load the vocabulary
with open(VOCAB_PATH, "r", encoding="utf-8") as f:
    vocab = json.load(f)

characters = sorted(vocab.keys(), key=lambda x: vocab[x])
char_to_num = tf.keras.layers.StringLookup(vocabulary=characters, oov_token="")
num_to_char = tf.keras.layers.StringLookup(vocabulary=characters, oov_token="", invert=True)

# 💡 CTC loss function
def CTCLoss(y_true, y_pred):
    batch_len = tf.cast(tf.shape(y_true)[0], dtype="int64")
    input_length = tf.cast(tf.shape(y_pred)[1], dtype="int64")
    label_length = tf.cast(tf.shape(y_true)[1], dtype="int64")

    input_length = input_length * tf.ones(shape=(batch_len, 1), dtype="int64")
    label_length = label_length * tf.ones(shape=(batch_len, 1), dtype="int64")

    loss = tf.keras.backend.ctc_batch_cost(y_true, y_pred, input_length, label_length)
    return loss

# 🧠 Load the model with the custom CTC loss
model = tf.keras.models.load_model(str(model_path), custom_objects={"CTCLoss": CTCLoss})
model.trainable = False
