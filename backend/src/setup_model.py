import json
import tensorflow as tf
from pathlib import Path

# Get the root directory of the project 
BASE_DIR = Path(__file__).resolve().parent
vocab_path = BASE_DIR.parent / "artifacts" / "vocab.json"
model_path = BASE_DIR.parent / "artifacts" / "best_model.keras"

# Load vocabulary
with open(vocab_path, "r") as f:
    vocab = json.load(f)

# Create char_to_num and num_to_char mappings
characters = sorted(vocab.keys(), key=lambda x: vocab[x])
char_to_num = tf.keras.layers.StringLookup(vocabulary=characters, oov_token="")
num_to_char = tf.keras.layers.StringLookup(vocabulary=characters, oov_token="", invert=True)

def CTCLoss(y_true, y_pred):
    batch_len = tf.cast(tf.shape(y_true)[0], dtype="int64")
    input_length = tf.cast(tf.shape(y_pred)[1], dtype="int64")
    label_length = tf.cast(tf.shape(y_true)[1], dtype="int64")

    input_length = input_length * tf.ones(shape=(batch_len, 1), dtype="int64")
    label_length = label_length * tf.ones(shape=(batch_len, 1), dtype="int64")

    loss = tf.keras.backend.ctc_batch_cost(y_true, y_pred, input_length, label_length)
    return loss

def build_model(input_dim, output_dim, rnn_layers=5, rnn_units=128):
    input_spectrogram = tf.keras.layers.Input((None, input_dim), name="input")
    x = tf.keras.layers.Reshape((-1, input_dim, 1), name="expand_dim")(input_spectrogram)

    x = tf.keras.layers.Conv2D(
        filters=32,
        kernel_size=(11, 41),
        strides=(2, 2),
        padding="same",
        use_bias=False,
        name="conv_1",
    )(x)
    x = tf.keras.layers.BatchNormalization(name="conv_1_bn")(x)
    x = tf.keras.layers.ReLU(name="conv_1_relu")(x)

    x = tf.keras.layers.Conv2D(
        filters=32,
        kernel_size=(11, 21),
        strides=(1, 2),
        padding="same",
        use_bias=False,
        name="conv_2",
    )(x)
    x = tf.keras.layers.BatchNormalization(name="conv_2_bn")(x)
    x = tf.keras.layers.ReLU(name="conv_2_relu")(x)

    x = tf.keras.layers.Reshape((-1, x.shape[-2] * x.shape[-1]))(x)

    for i in range(1, rnn_layers + 1):
        recurrent = tf.keras.layers.GRU(
            units=rnn_units,
            activation="tanh",
            recurrent_activation="sigmoid",
            use_bias=True,
            return_sequences=True,
            reset_after=True,
            name=f"gru_{i}",
        )
        x = tf.keras.layers.Bidirectional(
            recurrent, name=f"bidirectional_{i}", merge_mode="concat"
        )(x)

        if i < rnn_layers:
            x = tf.keras.layers.Dropout(rate=0.5, name=f"dropout_{i}")(x)

    x = tf.keras.layers.Dense(units=rnn_units * 2, name="dense_1")(x)
    x = tf.keras.layers.ReLU(name="dense_1_relu")(x)
    x = tf.keras.layers.Dropout(rate=0.5, name="dense_1_dropout")(x)

    output = tf.keras.layers.Dense(units=output_dim + 1, activation="softmax", name="output")(x)

    model = tf.keras.models.Model(input_spectrogram, output, name="DeepSpeech2")

    opt = tf.keras.optimizers.Adam(learning_rate=1e-4)
    model.compile(optimizer=opt, loss=CTCLoss)

    return model

# Load the pre-trained model
model = tf.keras.models.load_model(str(model_path), custom_objects={"CTCLoss": CTCLoss})

# Set model to inference mode
model.trainable = False
