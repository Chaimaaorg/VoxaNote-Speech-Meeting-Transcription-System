from transformers import pipeline
# import torch

def format_transcription(raw_text: str) -> str:
    """
    Format transcription using a small local model
    """
    try:
        # Use a small, efficient model for text processing
        # These models are much smaller (~500MB vs 16GB)
        
        # Option 1: DistilGPT-2 (lightweight)
        generator = pipeline(
            "text-generation",
            model="distilgpt2",
            max_length=len(raw_text.split()) + 50,
            num_return_sequences=1,
            temperature=0.7,
            do_sample=True,
            pad_token_id=50256
        )
        
        prompt = f"Correct this transcription with proper punctuation and capitalization: {raw_text}\n\nCorrected:"
        
        result = generator(prompt, max_new_tokens=100)[0]['generated_text']
        
        # Extract only the corrected part
        if "Corrected:" in result:
            corrected = result.split("Corrected:")[-1].strip()
            return corrected if corrected else basic_format_fallback(raw_text)
        
        return basic_format_fallback(raw_text)
        
    except Exception as e:
        print(f"Model error: {e}")
        return basic_format_fallback(raw_text)

def basic_format_fallback(text: str) -> str:
    """
    Rule-based formatting fallback
    """
    import re
    
    # Basic cleanup
    text = text.strip()
    
    # Capitalize first letter
    if text:
        text = text[0].upper() + text[1:]
    
    # Fix common issues
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces
    text = re.sub(r'\s+([,.!?])', r'\1', text)  # Spaces before punctuation
    
    # Add period if missing
    if text and not text.endswith(('.', '!', '?')):
        text += '.'
    
    return text