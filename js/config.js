/* Restaurant details used across the site. */
window.CONFIG = {
  name: "AL-OMDA",
  nameAr: "العمدة",
  phone: "0675552211",
  phoneIntl: "+212675552211",
  // WhatsApp number in international format, digits only (orders are sent here).
  whatsapp: "212675552211",
  instagram: "https://www.instagram.com/al_omda_001/",
  instagramHandle: "@al_omda_001",
  // Google review link, from Google Business Profile > "Ask for reviews" (e.g. "https://g.page/r/XXXX/review").
  // The table cards' QR code opens /avis, which forwards here. Empty = a "coming soon" page.
  googleReviewUrl: "https://g.page/r/Cfu_Gglx8xjcEBM/review",
  // Full-width hero background photo, e.g. "assets/photos/hero.jpg". Empty = logo artwork.
  heroImage: "",
  address: { fr: "Anassi, Casablanca", ar: "أناسي، الدار البيضاء" },
  location: { lat: 33.592304, lng: -7.500786 },
  // The Google Maps listing ("Voir la localisation" and "Itinéraire" open it). The CID is read from the review link above.
  googleMapsUrl: "https://maps.google.com/?cid=15859693754594803707",
  // Name of the Google listing; the embedded map searches it so it shows the listing's own pin.
  googleMapsName: "AL OMDA FAST FOOD, Casablanca",
  // Same hours every day, 24h format, Casablanca time. A close at or before open means after midnight.
  hours: { open: "12:00", close: "00:00" },
  timeZone: "Africa/Casablanca",
  currency: { fr: "DH", ar: "درهم" },
  // Delivery: flat fee in MAD and maximum straight-line distance from the restaurant.
  delivery: { fee: 10, maxKm: 4 },
};
