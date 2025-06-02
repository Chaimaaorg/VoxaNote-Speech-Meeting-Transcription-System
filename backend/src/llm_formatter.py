from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.llms import Ollama
from langchain.chains import LLMChain

# Load Ollama LLM (replace with your model if needed)
llm = Ollama(model="llama3:latest")

# Prompt template to clean up the transcription
prompt = PromptTemplate(
    input_variables=["raw_text"],
    template="Correct and format the following voice transcription in English. Only return the corrected and formatted text with proper punctuation and capitalization — no explanations or notes:\n\n{raw_text}"
)

# Create LangChain chain
format_chain = LLMChain(
    llm=llm,
    prompt=prompt,
    output_parser=StrOutputParser()
)

def format_transcription(raw_text: str) -> str:
    """Formats raw transcription using an Ollama LLM through LangChain."""
    return format_chain.invoke({"raw_text": raw_text})
