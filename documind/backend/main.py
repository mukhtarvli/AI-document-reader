
import pymupdf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.responses import StreamingResponse

load_dotenv()


client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)



def summarize_document(text: str):
    response = client.responses.create(
        model="openrouter/free",
        instructions=(
            "You are DocuMind, an AI document assistant. "
            "Summarize the provided document clearly and accurately. "
            "Explain the main ideas in simple language. "
            "Include the most important key takeaways. "
            "Do not invent information that is not in the document."
        ),
        input=text,
        max_output_tokens=800
    )

    return response.output_text



def stream_summary(text: str):
    stream = client.chat.completions.create(
        model="openrouter/free",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are DocuMind, an AI document assistant. "
                    "Summarize the document clearly, explain its "
                    "main ideas, and provide key takeaways."
                )
            },
            {
                "role": "user",
                "content": text
            }
        ],
        stream=True
    )

    for chunk in stream:
        if chunk.choices:
            content = chunk.choices[0].delta.content

            if content:
                yield content


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Welcome to DocuMind API",
        "status": "running"
    }



@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 10 MB limit"
        )

    try:
        with pymupdf.open(stream=content, filetype="pdf") as document:
            extracted_text = ""
            for page in document:
                extracted_text += page.get_text()

    except (pymupdf.FileDataError, pymupdf.EmptyFileError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted PDF"
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No readable text found in this PDF"
        )

    return StreamingResponse(
        stream_summary(extracted_text),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache"}
    )





