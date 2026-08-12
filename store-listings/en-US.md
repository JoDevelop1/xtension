# Xtension

## Short summary

Generate AI replies across social platforms with your own ChatGPT account, plus PDF export on X.

## Description

Xtension adds user-invoked AI reply tools to X/Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky and YouTube. X/Twitter also includes local PDF export, ImageGen and direct Following / Not following badges in the timeline.

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

When you enable the draft tools, a compact toolbar appears beside supported social reply editors:

- **Correction** — fixes grammar, spelling and syntax while keeping your voice.
- **Translation** — translates your draft into the output language you choose.
- **Reformulation** — rewrites your draft to be clearer or more impactful.
- **Generate** — turns an instruction into a finished post or reply adapted to the visible platform.
- **Reply suggestions** — three contextual responses generated independently from customizable prompts.
- **Image generation on X/Twitter** — describe an image and attach it to your post, with square, landscape and portrait formats, style presets, framing and mood options.
- **Undo / Redo** — every AI edit is reversible from the composer toolbar.
- **Model control** — choose any Codex model available to your ChatGPT account and set the reasoning effort per request.

These AI features require the **Xtension Codex Connector**, a small program you install separately on Windows. It listens only on `127.0.0.1:47623`, is reachable only from your own machine, and starts the official Codex App Server using the ChatGPT sign-in that already exists on your computer. Xtension never asks for an OpenAI API key and never sends your data to a server owned by the developer. The connector is a separate download: https://xtension.jodevelop.com

The extension interface is available in English, French, German, Spanish and Japanese.

Permissions:

- `x.com` / `twitter.com`: add Xtension actions to the X/Twitter menu and composer, and read only the visible content you selected.
- Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky and YouTube: add the AI toolbar beside recognized post/comment editors and read the nearby visible post when you use reply assistance. Private-message routes are excluded.
- `pbs.twimg.com`: fetch the public X/Twitter images, avatars, card images and video preview thumbnails referenced by the selected content.
- `localhost:47623` / `127.0.0.1:47623`: connect the optional AI tools to the Codex Connector running on your own computer. The extension itself cannot execute local commands.
- `storage`: save your settings in the browser.

Xtension does not collect personal data, does not send content to a developer-owned server, and contains no analytics or tracking. It inserts generated text as a draft and never presses the final publish button. It contains no microphone or audio-capture code. The full source code is published under the Apache License 2.0 at https://github.com/JoDevelop1/xtension

Xtension is an independent project. It is not affiliated with X Corp., OpenAI, Microsoft, Google, Mozilla or Apple.

## Keywords

X, Twitter, Reddit, Facebook, Instagram, Threads, LinkedIn, Bluesky, YouTube, PDF, AI, ChatGPT, Codex, writing, translation, reply
