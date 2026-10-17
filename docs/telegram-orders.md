# Receiving orders on Telegram

When this is set up, the customer taps **Envoyer la commande** and the order
arrives in a Telegram chat on the restaurant's phone. The customer stays on the
website and sees a confirmation. WhatsApp stays available as a fallback.

```
Website  ──order──▶  Cloudflare Worker (holds the bot token)  ──▶  Telegram group
```

It takes about 15 minutes and is free. You need a Telegram account and a free
Cloudflare account.

> **Keep the bot token secret.** It only goes into Cloudflare (step 4). Don't
> put it in the website files, in GitHub, or in a chat.

## 1. Create the bot

1. In Telegram, open **@BotFather** (the official bot with a blue tick).
2. Send `/newbot`.
3. Name: `AL-OMDA Commandes`. Username: something ending in `bot`, e.g. `alomda_commandes_bot`.
4. BotFather replies with a **token** that looks like `123456789:AAH...`. Keep it for step 4.

## 2. Create the orders group

1. Create a new Telegram group, e.g. **AL-OMDA Commandes**.
2. Add the bot to it, plus everyone who should see orders (the restaurant's phone, staff).
3. Send any message in the group, e.g. `test`.

## 3. Find the group's chat ID

1. In a browser, open this address, with your token in place of `<TOKEN>`:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
2. Find `"chat":{"id":-100…` and copy the number, including the minus sign.
   That is the **chat ID**.

If the page shows `"result":[]`, send another message in the group and reload.
If it's still empty, remove the bot from the group, add it back, and send a message again.

## 4. Deploy the Worker on Cloudflare

1. Sign up at <https://dash.cloudflare.com> (free plan).
2. Go to **Workers & Pages → Create → Create Worker**. Name it `omda-orders` and click **Deploy**.
3. Click **Edit code**. Delete everything in the editor, then paste the contents of
   [`worker/order-worker.js`](../worker/order-worker.js). Click **Deploy**.
4. Go back to the Worker. Open **Settings → Variables and Secrets** and add:

   | Name | Type | Value |
   | --- | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | Secret | the token from step 1 |
   | `TELEGRAM_CHAT_ID` | Secret | the chat ID from step 3 |
   | `ALLOWED_ORIGINS` | Text | the website address, e.g. `https://nouralhadiifrak.github.io` |

   `ALLOWED_ORIGINS` is the list of sites allowed to send orders. Write the address
   without a trailing `/` and without the path. To test from your own computer as well,
   add the local address after a comma: `https://nouralhadiifrak.github.io,http://localhost:8000`.
5. Copy the Worker's address, shown at the top: `https://omda-orders.<your-name>.workers.dev`.

## 5. Connect the website

Put the Worker address in `js/config.js`:

```js
orderEndpoint: "https://omda-orders.<your-name>.workers.dev",
```

Or just send the address to Claude. It isn't secret.

## 6. Test

Place an order on the site. The group should receive something like:

```
🛎 Nouvelle commande · 🛵 Livraison

• 1 × Tacos Poulet (sauces Algérienne + Samouraï) — 30 DH
• 2 × Shawarma Frites — 50 DH

Sous-total : 80 DH
Livraison : 10 DH
Total : 90 DH

👤 Youssef
📞 06 00 00 00 00
📍 Rue 12, imm 3
🗺 Ouvrir dans Maps · 1.1 km
📝 Sans oignons
```

For deliveries, a map pin follows right under the message.

## Good to know

- **Call to confirm.** The customer types their own phone number, so call them
  back to confirm the order before cooking. It also filters out fake orders.
- **Prices come from the website.** Staff can check them against the menu when confirming.
- **If sending fails** (no internet, Cloudflare or Telegram down), the customer sees an error
  and can send the same order on WhatsApp in one tap.
- **To switch back to WhatsApp only**, set `orderEndpoint: ""` in `js/config.js`.
- **Using the command line instead of the dashboard** (optional):
  ```sh
  cd worker
  npx wrangler deploy
  npx wrangler secret put TELEGRAM_BOT_TOKEN
  npx wrangler secret put TELEGRAM_CHAT_ID
  ```
  Edit `ALLOWED_ORIGINS` in `worker/wrangler.toml` first.
