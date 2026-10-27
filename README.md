# Shuvodip Biswas — Research & life off-screen

A personal portfolio built around Shuvodip's security research, Dhaka-to-Montréal path, own photograph, running, workouts, and movies.

The static page has no build dependencies. Keep `index.html`, `Shuvodip_Biswas_CV_Classic.pdf`, and `shuvodip-portrait.jpg` together. Save CV downloads the original supplied PDF. The photo is the user's supplied image, unchanged.

## Design and content

Forest green, warm paper, peach annotations, editorial research rows, an illustrated off-screen section, responsive navigation, and optional light/dark themes. The working toolkit emphasizes AI/model security, Burp Suite, mitmproxy, and application security. IJCNN/TabularClust and the projects section remain removed.

Research and experience are grounded in the supplied CV, the original portfolio, and the public GitHub profile. The age-verification manuscript is described as submitted, not accepted. Graduation is expected May 2027. Personal interests were supplied by Shuvodip directly.

The trust-boundary experiment is a deterministic educational illustration of prompt injection, with four predefined outcomes. It makes no AI calls and does not claim to test or secure a real model. Background: https://genai.owasp.org/llmrisk/llm01-prompt-injection/.

## Hosting

GitHub Pages serves the repository root on `main`; `.nojekyll` enables direct static hosting. The Sites copy serves `dist/` according to `.openai/hosting.json`. Concordia serves the same three static assets.

For a local preview, run `python -m http.server 4173 --bind 127.0.0.1` from the folder containing the HTML. In the Sites source, add `--directory dist`.
