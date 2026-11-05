# Where each project image came from

Every image is a real screen from the project, captured on 2026-11-05 unless noted. None are mocked up. The published copies are in `public/images/projects/<project>/coverImage.webp`.

| Project | Source | How it was made |
|---|---|---|
| AI-Powered Learning Path Generator | The running app | Generated the "Machine Learning" path and opened one Gemini explanation. MySQL was read-only for the run. |
| RAG ML Study Assistant | The project report, page 9 | A screenshot from the report. It can't be re-captured today: `Qwen/Qwen2.5-7B-Instruct` is no longer served by a provider enabled on the Hugging Face account. |
| NeuroScan | `brain-cancer-detection/docs/screenshots/result.png` | An existing screenshot from the repo. |
| Plant Growth Stage Classifier | The running app | EfficientNet-B0 on a public-domain photo ([Pomegranate flower and fruit](https://commons.wikimedia.org/wiki/File:Pomegranate_flower_and_fruit.jpg), Wikimedia Commons). |
| English Coach | The real app | Booted on the JVM with Robolectric's native renderer, because the app is ARM-only and no phone was attached. The profile is new, so it shows 0 XP. |
| Artifact-Robust GI Endoscopy Classifier | The project's dashboard | Shows a test-set sample, which is an exact file match in [HyperKvasir](https://datasets.simula.no/hyper-kvasir/) (CC BY 4.0). The credit is on the card. The crop leaves out the sidebar, whose accuracy figures (98.28% to 98.54%) differ from README section 2 (97.99%). |
| Grassroots Football Talent Analytics | An existing project screenshot | Shows match footage from SoccerTrack-v2 (CC BY 4.0). The credit is on the card. |

The price predictor has no interface, so its card uses a diagram drawn in the page from the facts in README section 2.

The owner approved publishing the screenshots of the two private projects on 2026-11-05. Those projects still never show a repository link.

The copies in `docs/concepts/private-previews/` are the same two images, kept for the concept mockups.
