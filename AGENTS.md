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

- Keep CineBox playback and details in the existing client bundle with typed `/watch/movie/:id` and `/watch/tv/:id` URLs because the imported SPA owns its streaming providers and internal navigation.
- Keep CineBox collection and network browsing in the existing client bundle with `/collection/:slug` and `/network/:slug` URLs because the imported SPA owns its catalog fetches and navigation.
