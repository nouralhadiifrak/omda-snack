/* Restaurant details used across the site. */
window.CONFIG = {
  name: "AL-OMDA",
  nameAr: "العمدة",
  // TEMPORARY test number. Restaurant number to restore: 0675552211 / +212675552211 / 212675552211
  phone: "0634235350",
  phoneIntl: "+212634235350",
  // WhatsApp number in international format, digits only (orders are sent here).
  whatsapp: "212634235350",
  instagram: "https://www.instagram.com/al_omda_001/",
  instagramHandle: "@al_omda_001",
  // Full-width hero background photo, e.g. "assets/photos/hero.jpg". Empty = logo artwork.
  heroImage: "",
  address: { fr: "Hay Anassi, Casablanca", ar: "حي أناسي، الدار البيضاء" },
  location: { lat: 33.592244, lng: -7.5007757 },
  // Same hours every day, 24h format, Casablanca time.
  hours: { open: "12:00", close: "23:00" },
  timeZone: "Africa/Casablanca",
  currency: { fr: "DH", ar: "درهم" },
  // Order relay (Cloudflare Worker → Telegram), see docs/telegram-orders.md.
  // Empty = orders open WhatsApp instead.
  orderEndpoint: "",
  // Delivery: flat fee in MAD and maximum straight-line distance from the restaurant.
  delivery: { fee: 10, maxKm: 4 },
};
