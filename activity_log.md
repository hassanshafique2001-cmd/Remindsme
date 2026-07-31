# Reminds Me — Activity Log

Running, dated log of what changed on Reminds Me — both code changes and Google Play Console/AdMob dashboard actions — so anyone (including a future Claude Code session in this folder) can catch up on "what happened last" at a glance.

Most recent entry at the bottom.

## 2026-07-31
- Fixed real-vs-test AdMob ad gating: `EXPO_PUBLIC_USE_REAL_ADS` env var now set only in `eas.json`'s `production` profile, so preview/testing builds always show Google's test ads (`utils/ads.js`, `eas.json`). Reason: `__DEV__` alone is false in preview builds too, so the earlier fix would have shown real ads to closed-testing testers and risked an AdMob invalid-traffic flag.
- Wired real AdMob Android App ID + Banner Ad Unit (`app.json`, `utils/ads.js`) — Android no longer permanently forced to Google's sample test unit. Real IDs: App ID `ca-app-pub-7606267073452752~9674370101`, Banner Ad Unit `ca-app-pub-7606267073452752/9482798410`.
- Google Play Console: Closed testing (Alpha) track live with 12 opted-in testers (11 "Family" list + 1 "Testers" list), release `1.0.0 (5)`. Waiting on the mandatory 14-continuous-day closed-testing period before "Apply for production" unlocks on the Dashboard.
- Privacy Policy and Account Deletion pages published (as Claude Artifacts, since the app has no website of its own):
  - Privacy Policy: https://claude.ai/code/artifact/f2ce82fa-1521-4e0e-a593-64d3cbdcd84c
  - Account/data deletion instructions: https://claude.ai/code/artifact/d4898c44-a313-40a3-b1ee-6a5cde1ff254
- Store listing drafted in Play Console: category Finance, tags Personal finance/Productivity/Calendar, short + full description written, 1024x500 feature graphic uploaded.
