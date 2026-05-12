# Text-to-SQL AI Agent

Ask questions in plain English, get SQL results instantly.

## What it does
- Converts natural language questions into SQL using Claude (Anthropic)
- Uses RAG (ChromaDB + sentence-transformers) to retrieve only relevant schema
- Runs queries against a real e-commerce dataset (Olist, 100k+ orders)
- Safety guard blocks any write operations before execution
- Explain mode: Claude narrates the generated SQL line by line
- Export results as CSV with one click

## Tech stack
Python · FastAPI · Claude API · ChromaDB · SQLite · React · TypeScript
