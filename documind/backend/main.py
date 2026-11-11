
import pymupdf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import httpx
import uuid

documents = {}

load_dotenv()


client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

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
    allow_origins=[ "https://ai-document-reader-beige.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Document-ID"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class QuestionRequest(BaseModel):
    question: str
    document_id: str | None = None
    history: list[ChatMessage] = []





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

    document_id = str(uuid.uuid4())

    documents[document_id] = extracted_text

    return StreamingResponse(
        stream_summary(extracted_text),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Document-ID": document_id,
        },
    )


@app.post("/ask")
async def ask_question(request: QuestionRequest):

    if request.document_id:
        document_text = documents.get(request.document_id)

        if document_text is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )
        system_prompt = (
            "You are DocuMind, a helpful AI assistant. "
            "You have access to an uploaded document. "
            "When the user asks a question about the document, "
            "use the document content to provide an accurate answer. "
            "When the user asks a general question unrelated to the document, "
            "answer using your general knowledge. "
            "If the user specifically asks about information in the document "
            "and the answer is not available, clearly say so. "
            "Never invent information about the document."
        )

        user_prompt = (
            f"DOCUMENT CONTENT:\n{document_text}\n\n"
            f"QUESTION:\n{request.question}"
        )

    else:
        system_prompt = (
            "You are DocuMind, a helpful AI assistant. "
            "Answer the user's questions clearly and accurately."
        )

        user_prompt = request.question

    # Keep your existing generate_answer() here
    async def generate_answer():
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openrouter/free",
                    "stream": True,
                    "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    *[
                        {
                            "role": message.role,
                            "content": message.content
                        }
                        for message in request.history
                    ],
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            },
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data = line[6:]

                    if data == "[DONE]":
                        break

                    try:
                        chunk = json.loads(data)

                        content = (
                            chunk.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content")
                        )

                        if content:
                            yield content

                    except (json.JSONDecodeError, IndexError):
                        continue

    return StreamingResponse(generate_answer(), media_type="text/plain")
