# Neutral editor theme

AI Video Editor uses slate surfaces, light type, and fine borders. Exports have no permanent logo or watermark. The welcome card names the editor; cards in an edit are optional timeline content.

| Role | Color |
| --- | --- |
| Background | `#101418` |
| Raised surface | `#1b2229` |
| Text | `#f5f7fa` |
| Secondary text | `#aab4c0` |
| Muted text | `#84909d` |
| Border | `#303a45` |
| Dim detail | `#495665` |

Edit `src/scenes/kit.tsx` to restyle the shared scene tokens. System sans-serif titles and captions, monospace labels, and the optional serif face require no font download. Keep the speaker recognizable and titles brief.

The internal `BennettsEditor` composition ID remains for compatibility with existing render commands. It is not rendered into the video.
