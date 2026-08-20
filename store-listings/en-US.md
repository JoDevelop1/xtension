# Xtension

## Short summary

Prepare social posts with AI, generate images, and preserve X/Twitter content as local PDFs.

## Description

Xtension helps you prepare, adapt, and preserve content for supported social platforms from one browser workflow. Improve a draft, create a contextual reply, generate a related image, or keep useful X/Twitter content as a clean PDF. You review every result: Xtension never presses the final publish button.

### Write and adapt social content

On X/Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, and YouTube, Xtension adds writing controls beside recognized post or comment editors:

- **Correction** fixes grammar, spelling, and syntax while preserving your voice.
- **Translation** translates your draft into the output language you select.
- **Generate** turns an instruction into a post or reply adapted to the visible platform.
- **Suggested replies** creates three contextual draft choices from customizable prompts.
- **Image generation on X/Twitter** creates a related image in square, landscape, or portrait formats, with style, framing, and mood controls.
- **Undo and Redo** keeps every AI edit reversible before you publish.
- **Engine and model controls** let you prefer Codex, Claude Code, or Ollama, configure each model, and enable safe fallback.

After you turn on AI features, contextual suggestions may be requested when you deliberately focus an empty supported reply field. Choosing a suggestion only inserts an editable draft.

### Preserve X/Twitter content as PDF

Choose **Download as PDF** from the `...` menu of an X/Twitter article, post, or thread. Xtension preserves headings, paragraphs, lists, quotes, same-author thread structure, quoted posts, available media images, video preview thumbnails, clickable links, and the source URL. The PDF is generated locally in your browser and saved through the normal save dialog. It is not sent to OpenAI or the developer.

### AI connection and privacy

AI features are off by default and require the separately installed, open-source **Xtension Connector** for Windows. Options shows the installed and latest connector versions plus independent states for Codex, Claude Code, and Ollama. After the first manual installation, signed connector updates are verified and installed automatically when no AI request is active. The connector listens only on `127.0.0.1:47623` and accepts only Xtension's fixed Store origins. It uses your existing ChatGPT or Claude subscription session, or a configured local Ollama model. Xtension never asks for an API key.

When you request an AI action, the selected text and useful visible context go through the local connector only to the engine selected for that attempt: OpenAI Codex, Claude Code, or your configured Ollama server. JoDevelop does not receive or store that content, the request, or the response. There are no analytics, ads, or tracking. PDF export and X/Twitter relationship badges remain local.

Private-message routes are excluded. Xtension does not read platform passwords, cookies, or authentication tokens. It contains no microphone or audio-capture code.

The interface is available in English, French, German, Spanish, and Japanese. Source code is published under Apache License 2.0 at https://github.com/JoDevelop1/xtension

Xtension is independent and is not affiliated with X Corp., OpenAI, Microsoft, Google, Mozilla, Apple, or the other supported platforms.

## Keywords

social media, X, Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, YouTube, PDF, AI, ChatGPT, Codex, writing, translation, reply, image
