# Xtension

## Short summary

Export X/Twitter posts as PDF, and write better with your own ChatGPT account.

## Description

Xtension adds two independent sets of tools to X/Twitter. Each one works without the other.

**1. PDF export — entirely local**

Open the `...` menu on an X article, tweet or thread and choose **Download as PDF**. The extension detects the relevant content, extracts text, structure, quoted tweets and media images, then generates the PDF in your browser. For threads, Xtension groups contiguous posts from the same author and stops before replies from other accounts. Your browser opens its normal **Save as** dialog so you choose the file name and folder. No external service is involved.

- Direct PDF export from an X/Twitter article, tweet or thread menu.
- Preserves article structure: headings, paragraphs, lists and quotes.
- Detects same-author threads without capturing every reply.
- Includes quoted tweets with their available content.
- Embeds media images, avatars, card images and video preview thumbnails.
- Keeps links clickable and adds the source URL.
- Generated locally, offline, without an external service.

**2. AI writing tools — through your own ChatGPT account**

When you enable the draft tools, a compact toolbar appears in the X/Twitter composer:

- **Correction** — fixes grammar, spelling and syntax while keeping your voice.
- **Translation** — translates your draft into the output language you choose.
- **Reformulation** — rewrites your draft to be clearer or more impactful.
- **Generate** — turns an instruction into a finished post; on an empty draft under a tweet, it writes a contextual reply instead.
- **Reply suggestions** — ready-to-post replies in several angles (human reaction, short impact, concrete argument, positive agreement, contextual humour, sharp angle, useful context, question), plus three prompts you can customize.
- **Image generation** — describe an image and attach it to your post, with square, landscape and portrait formats, style presets, framing and mood options.
- **Undo / Redo** — every AI edit is reversible from the composer toolbar.
- **Model control** — choose any Codex model available to your ChatGPT account and set the reasoning effort per request.

These AI features require the **Xtension Codex Connector**, a small program you install separately on Windows. It listens only on `127.0.0.1:47623`, is reachable only from your own machine, and starts the official Codex App Server using the ChatGPT sign-in that already exists on your computer. Xtension never asks for an OpenAI API key and never sends your data to a server owned by the developer. The connector is a separate download: https://xtension.jodevelop.com

Voice dictation is deliberately unavailable in this mode: ChatGPT-managed Codex does not expose a transcription model, and Xtension does not silently fall back to another speech service.

The extension interface is available in English, French, German, Spanish and Japanese.

Permissions:

- `x.com` / `twitter.com`: add Xtension actions to the X/Twitter menu and composer, and read only the visible content you selected.
- `pbs.twimg.com`: fetch the public X/Twitter images, avatars, card images and video preview thumbnails referenced by the selected content.
- `localhost:47623` / `127.0.0.1:47623`: connect the optional AI tools to the Codex Connector running on your own computer. The extension itself cannot execute local commands.
- `storage`: save your settings in the browser.

Xtension does not collect personal data, does not send content to a developer-owned server, contains no analytics or tracking, and does not modify your X/Twitter account. The full source code is published at https://github.com/JoDevelop1/xtension

Xtension is an independent project. It is not affiliated with X Corp., OpenAI, Microsoft, Google, Mozilla or Apple.

## Keywords

X, Twitter, PDF, export, thread, article, AI, ChatGPT, Codex, writing, correction, translation, reply
