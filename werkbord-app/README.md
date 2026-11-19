# Crystal Werkbord

Takenbord van Crystal Services, los van de winkel-app: taken per soort, met dringend, een datum,
"wacht op iemand anders" en afvinken. Achter een pincode, te installeren op gsm ("Toevoegen aan beginscherm").

- `public/` is de app (gewone HTML, CSS en JavaScript, geen build nodig).
- `api/taken.js` is de server-functie; `lib/taken.js` bevat de regels (met tests: `npm test`).
- De taken staan in één privé-bestand in Vercel Blob. Afgevinkte taken verdwijnen na 30 dagen.
- Lokaal testen: `APP_PIN=1234 npm run dev`.

Online zetten: een eigen Vercel-project met root directory `werkbord-app`, de instelling `APP_PIN` en een gekoppelde Blob-opslag.
