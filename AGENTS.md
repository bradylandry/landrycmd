# Agents

Before opening or updating a PR, run the verify skill at `.cursor/skills/verify-landrycmd/SKILL.md` and attach its evidence (`/tmp/landrycmd-verify/`, including the browser report, the 360/768/1440 screenshots, and the public-copy scan).

CI runs the same skill on every pull request (`.github/workflows/verify.yml`) and uploads a `verify-evidence` artifact. Put the link to that artifact from the PR's latest run in the PR body under Proof.

When a visitor-facing route, control, or lab changes, update `.cursor/skills/verify-landrycmd/features/`.
