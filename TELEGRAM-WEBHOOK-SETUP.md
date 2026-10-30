# Telegram replies for HASI.TJ live chat

1. Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Admin → Settings → Telegram (or environment variables).
2. Optionally set `TELEGRAM_WEBHOOK_SECRET` to a long random secret in the production environment.
3. Register the webhook after deploying to HTTPS:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://hasi.tj/api/telegram/webhook","secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET"}'
```

If `TELEGRAM_WEBHOOK_SECRET` is not configured, omit `secret_token` from `setWebhook`. The webhook only accepts replies from the configured `TELEGRAM_CHAT_ID` (or the existing default admin chat ID). When a customer submits a contact/chat message, the Telegram notification contains `[HASI_CHAT_ID:<id>]`. Use Telegram's **Reply** function on that notification and send the reply text. The reply is stored as the response for the website conversation and appears during the widget's next poll.
