const fs = require('fs');

const cssPath = 'assets/index-DyJyWV9P.css';
let css = fs.readFileSync(cssPath, 'utf8');

const perRowStyles = `
/* 7 per row */
.cards-per-row-7 .media-carousel-card {
  flex: 0 0 calc((100% - (6 * 1.25rem)) / 7) !important;
  min-width: calc((100% - (6 * 1.25rem)) / 7) !important;
}

/* 6 per row */
.cards-per-row-6 .media-carousel-card {
  flex: 0 0 calc((100% - (5 * 1.25rem)) / 6) !important;
  min-width: calc((100% - (5 * 1.25rem)) / 6) !important;
}

@media (max-width: 1400px) {
  .cards-per-row-7 .media-carousel-card,
  .cards-per-row-6 .media-carousel-card {
    flex: 0 0 calc((100% - (4 * 1rem)) / 5) !important;
    min-width: calc((100% - (4 * 1rem)) / 5) !important;
  }
}
@media (max-width: 1024px) {
  .cards-per-row-7 .media-carousel-card,
  .cards-per-row-6 .media-carousel-card {
    flex: 0 0 calc((100% - (2 * 1rem)) / 3) !important;
    min-width: calc((100% - (2 * 1rem)) / 3) !important;
  }
}
@media (max-width: 640px) {
  .cards-per-row-7 .media-carousel-card,
  .cards-per-row-6 .media-carousel-card {
    flex: 0 0 calc((100% - 0.75rem) / 2) !important;
    min-width: calc((100% - 0.75rem) / 2) !important;
  }
}
`;

css += perRowStyles;
fs.writeFileSync(cssPath, css, 'utf8');
console.log("CSS updated to support both 6 and 7 cards per row.");
