<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Playwright preview auth

- Inject the minted session as a **single** JSON string: `localStorage.setItem(storage_key, JSON.stringify(session))`. On `localhost:8080` the client falls back to plain `localStorage` (the postMessage broker only activates on `*.lovable.app` preview hosts), so double-encoding the value makes the app redirect to `/`.

## Comment workflow

- Persist admin feedback completion in `comments.resolved_at` so project alerts and the checklist stay consistent across devices.
