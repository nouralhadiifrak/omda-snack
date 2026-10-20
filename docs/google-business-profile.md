# Google Business Profile — AL-OMDA

Everything to copy and paste when creating the profile. It takes about 20 minutes,
then Google verifies the business (usually within a few days).

> **Create it from the manager's own Google account** (or a Gmail made for the
> restaurant, e.g. `alomda.casablanca@gmail.com`). The account that creates the
> profile owns it. You can be added afterwards as a manager.

## 1. Before you start

- [ ] A Google account for the restaurant (see above)
- [ ] The exact street address (street, number, landmark). "Anassi" alone is not enough
- [ ] The restaurant's phone: **06 75 55 22 11**
- [ ] A phone at the restaurant, to film the verification video (step 4)
- [ ] 10 or more photos: storefront with the sign, inside, the counter and spit, dishes
      (the 17 menu photos in `assets/photos/` can be used for the dishes)

## 2. Create the profile

Go to **<https://business.google.com>** → *Gérer maintenant* / *Manage now*, then fill in:

| Question | Answer |
| --- | --- |
| Business name | **AL-OMDA** (or **Al Omda – العمدة**, exactly as on the sign; don't add keywords, Google suspends profiles for that) |
| Business type | Physical location that customers visit (*Établissement physique*) |
| Primary category | **Restaurant de shawarmas** (*Shawarma restaurant*) |
| Location | Street address, then move the pin onto the shop (coordinates: 33.592304, -7.500786) |
| Do you also deliver? | **Yes**: add the delivery area *Anassi* and nearby neighbourhoods (about 4 km) |
| Phone | 06 75 55 22 11 |
| Website | https://al-omda.ma |

## 3. Details (after creation, in *Modifier le profil*)

**Additional categories**: Fast-food · Restaurant de hamburgers · Pizzeria · Restaurant de tacos · Sandwicherie

**Hours**: every day, 12:00 – 00:00 (midnight)

**Description** (French, max. 750 characters):

> AL-OMDA (العمدة) est un snack d'Anassi, à Casablanca, spécialisé dans la
> shawarma grillée à la broche et servie généreusement avec nos sauces maison.
> Au menu également : tacos, bowls, burgers, pizzas, calzones, pasticcio,
> mac & cheese, pâtes, brochettes, salades et menu enfant. Sur place, à emporter
> ou en livraison dans le quartier. Ouvert tous les jours de 12h à minuit.
> Commandez en ligne sur notre site et recevez votre commande sur WhatsApp.

**Attributes** (tick what's true): Sur place · À emporter · Livraison · Paiement en espèces ·
Convient aux enfants · Repas rapide · Places assises

**Menu link**: https://al-omda.ma/#menu

**Order link** ("Commander en ligne"): https://al-omda.ma/#menu

**Social profile**: Instagram https://www.instagram.com/al_omda_001/

**Opening date**: the date the restaurant opened (month and year)

## 4. Verification

Google chooses the method. In Morocco it's usually a **video**:
one continuous video (1–2 minutes) filmed on the spot, showing:

1. The street and a nearby landmark, then the storefront with the **AL-OMDA sign**
2. Walking inside: the counter, the spit, the kitchen equipment
3. Proof that you manage the place: unlocking the door or the till, or a menu or receipt with the name

Tips: daylight, slow movements, no cuts. The review takes 1–5 days.
**Don't edit the name or address while verification is in progress**; it restarts it.

## 5. Once verified: the review link (for the table cards)

1. In the profile, tap **Demander des avis** / *Ask for reviews*
2. Copy the link (looks like `https://g.page/r/XXXXXXXX/review`)
3. Send it to Claude, or put it in `js/config.js`:
   ```js
   googleReviewUrl: "https://g.page/r/XXXXXXXX/review",
   ```

The table cards are already printed with a QR code pointing to
`https://omda-snack.vercel.app/avis/`. That page forwards to this link, so **no
reprint is needed**. Until the link is set, the page shows a "coming soon" message.

> ⚠️ The QR code depends on the website address. The site now lives at
> https://al-omda.ma, but the printed cards still use the Vercel address, which
> redirects to it (`vercel.json`): keep omda-snack.vercel.app attached to the
> project (Vercel keeps it by default), or reprint the cards.

## 6. After launch

- Post the 10+ photos (and add new ones regularly)
- **Reply to every review**, good or bad, within a day or two, politely and in the customer's language
- Never offer gifts or discounts in exchange for reviews, and don't write reviews yourselves: Google removes them and can suspend the profile
- Keep hours up to date (holidays, Ramadan)
