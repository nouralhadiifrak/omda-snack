# Menu QR sticker (works offline)

`menu-qr-print.pdf` is the print file: 100 × 100 mm sticker plus 3 mm bleed on each side
(page 106 × 106 mm), so the print shop cuts at 100 mm. `menu-qr-300dpi.png` is the same at 300 dpi.

The QR code holds the French menu as plain text (`menu.txt`, ~1,850 characters, QR version 32,
error correction L), so a phone shows the dishes and prices without internet. Because it holds
so much text the code is dense: print it no smaller than 10 × 10 cm.

When prices or dishes change, `menu.txt` and the sticker must be regenerated, or the sticker
will show the old prices.
