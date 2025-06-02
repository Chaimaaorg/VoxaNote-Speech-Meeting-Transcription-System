from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import uvicorn
import tensorflow as tf

from src.setup_model import model
from src.llm_formatter import format_transcription  
from fastapi.middleware.cors import CORSMiddleware
from src.process_audio import preprocess_audio, decode_predictions, segment_audio_bytes


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()

        # Segment audio into chunks
        segments = segment_audio_bytes(file_bytes, segment_length_ms=10000, overlap_ms=1000)
        full_transcription = ""

        for segment in segments:
            audio_tensor = preprocess_audio(segment)
            audio_tensor = tf.expand_dims(audio_tensor, 0)
            prediction = model.predict(audio_tensor)
            transcription = decode_predictions(prediction)
            full_transcription += transcription[0] + " "

        raw_text = full_transcription.strip()

        # Use the formatter from the separate module
        formatted_text = format_transcription(raw_text)
        
        return JSONResponse(content={
            "raw_transcription": raw_text,
            "formatted_transcription": {
                "text": formatted_text
            }
        })

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
