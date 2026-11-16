// Snapshot of the content that was hardcoded in the website before the admin panel existed
// (src/js/data/projects.js, src/js/data/films.js and the homepage cards in index.html at commit 8326719).
// It is the source for scripts/import-content.mjs, so the import stays repeatable after those files were
// replaced by runtime API content. Do not edit this to change live content; use the admin panel.

// Featured projects on the home page "Selected Work" carousel. Images are pulled from the media
// manifest by id prefix, so new renders for a project appear in its pop-up automatically.
/**
 * @typedef {object} Project
 * @property {string} prefix   media id prefix in src/data/media.json
 * @property {string} name
 * @property {string} location
 * @property {'interior' | 'exterior' | 'film'} filter  portfolio filter for "View in portfolio"
 * @property {string} discipline
 * @property {string} summary
 * @property {string[]} scope
 * @property {string} [film]   YouTube id of the project film, if any
 */

/** @type {Record<string, Project>} */
export const LEGACY_PROJECTS = {
  'oberoi-360-tower': {
    prefix: 'oberoi-360-tower',
    name: 'Oberoi 360 Tower',
    location: 'Mumbai',
    filter: 'interior',
    discipline: 'Interior CGI',
    summary:
      'Interior visualization for premium sea-facing residences — lounges, living rooms, bedrooms and a private terrace, each resolved with calibrated daylight and true material response so finishes could be approved before fit-out.',
    scope: ['Living & lounge spaces', 'Master & children’s bedrooms', 'Dining & terrace'],
  },
  'abhyudaya-celestial': {
    prefix: 'abhyudaya-celestial',
    name: 'Abhyudaya Celestial',
    location: 'Lucknow',
    filter: 'exterior',
    discipline: 'Exterior CGI',
    summary:
      'Exterior visualization for a premium high-rise development — the neo-classical elevation and dusk façade, the arrival gate and fountain, the landscaped courtyard and an overall masterplan view.',
    scope: ['Façade & elevations', 'Entrance & arrival', 'Landscape & masterplan'],
  },
  'shubh-kamna-heights': {
    prefix: 'shubh-kamna-heights',
    name: 'Shubh Kamna Heights',
    location: 'Varanasi',
    filter: 'film',
    discipline: 'Architectural Film · Exterior & Interior CGI',
    summary:
      'A complete visualization package for a residential township — day and night aerial masterplans, street-level exteriors, clubhouse and sports amenities, show-apartment interiors and a full 3D walkthrough film.',
    scope: ['3D walkthrough film', 'Masterplan & aerials', 'Clubhouse & amenities', 'Interiors'],
    film: '4MpmzYg59g0',
  },
  'lodha-villa-royale-gold': {
    prefix: 'lodha-villa-royale-gold',
    name: 'Lodha Villa Royale',
    location: 'Thane',
    filter: 'interior',
    discipline: 'Interior CGI',
    summary:
      'Interior visualization for a luxury villa — marble dining, layered living rooms and master suites, with stone, rattan and brass finishes resolved under controlled lighting.',
    scope: ['Living & dining', 'Master suites', 'Bathrooms & lounges'],
  },
  'mirador-prangan': {
    prefix: 'mirador-prangan',
    name: 'Mirador Prangan',
    location: 'Atgaon, Thane',
    filter: 'exterior',
    discipline: 'Exterior CGI',
    summary:
      'Exterior visualization for a mid-rise residential township — day and night masterplans, the clubhouse pool deck, landscaped lawns, children’s play areas and the gated community entrance.',
    scope: ['Township masterplan', 'Clubhouse & pool deck', 'Landscape & play areas'],
  },
  'moksha-at-avas': {
    prefix: 'moksha-at-avas',
    name: 'Moksha at Avas',
    location: 'Alibaug',
    filter: 'interior',
    discipline: 'Interior CGI',
    summary:
      'Interior visualization for a villa retreat — a relaxed, rustic-bohemian palette of timber, marble and textured fabrics carried through the living room, bar, dining and bedroom spaces.',
    scope: ['Living & bar lounge', 'Dining & kitchen', 'Bedrooms & bathrooms'],
  },
  'geecee-evana': {
    prefix: 'geecee-evana',
    name: 'GeeCee Evana',
    location: 'Bandra, Mumbai',
    filter: 'exterior',
    discipline: 'Exterior & Interior CGI',
    summary:
      'Visualization for an ultra-luxury residential high-rise — day and dusk elevations, shaded seating gardens, play and party amenities, and the reception lobby.',
    scope: ['Day & dusk elevations', 'Amenity spaces', 'Reception lobby'],
  },
  'applaud-38': {
    prefix: 'applaud-38',
    name: 'Applaud 38',
    location: 'Goregaon, Mumbai',
    filter: 'interior',
    discipline: 'Interior & Exterior CGI',
    summary:
      'A full exterior and interior package for a residential tower — elevations, arrival and retail frontage, rooftop and terrace amenities, the entrance lobby and furnished show apartments.',
    scope: ['Elevations & arrival', 'Lobby & amenities', 'Show apartments'],
  },
};

export const LEGACY_FILMS = [
  { id: '4MpmzYg59g0', project: 'Shubh Kamna Heights', location: 'Pt. Deen Dayal Upadhyaya Nagar, U.P.', type: '3D Walkthrough' },
  { id: '6qBQmVbrGW8', project: 'Arham Residential Building', location: 'Mumbai', type: '3D Walkthrough' },
  { id: 'V5Gm-LI3OAE', project: 'White House', location: 'Subhash Nagar, Chembur, Mumbai', type: '3D Walkthrough' },
  { id: 'llQMhMIu8qg', project: 'Azim Park', location: 'Navi Mumbai', type: '3D Walkthrough' },
  { id: 'FQlNyGNGfpw', project: 'Balaji Estate Phase 2', location: 'Dombivali East', type: '3D Walkthrough' },
];


// Homepage as it was hardcoded in index.html. `lead` is the render each Selected Work card showed.
// The third card (Shubh Kamna Heights) was a film card (play chip, "Architectural Film" label, linked to the
// film filter). Per the agreed rule that Selected Work shows still renders only, it is listed separately and
// is NOT seeded into Selected Work; the project itself is still imported and its film is featured below.
export const LEGACY_HOMEPAGE = {
  selectedWork: [
    { project: 'oberoi-360-tower', lead: 'oberoi-360-tower-grand-piano-lounge-sea-view-interior-mumbai' },
    { project: 'abhyudaya-celestial', lead: 'abhyudaya-celestial-premium-high-rise-facade-dusk-lucknow' },
    { project: 'lodha-villa-royale-gold', lead: 'lodha-villa-royale-gold-premium-rattan-panel-bedroom-thane' },
    { project: 'mirador-prangan', lead: 'mirador-prangan-luxury-clubhouse-pool-deck-render-atgaon-thane' },
    { project: 'moksha-at-avas', lead: 'moksha-at-avas-bohemian-living-room-antler-chandelier-alibaugh' },
    { project: 'geecee-evana', lead: 'geecee-evana-modern-glass-facade-residential-building-mumbai' },
    { project: 'applaud-38', lead: 'applaud-38-grand-entrance-lobby-interior-goregaon' },
  ],
  excludedFilmCards: [{ project: 'shubh-kamna-heights', lead: 'shubh-kamna-heights-illuminated-aerial-masterplan-night-chandauli' }],
  featuredFilm: '4MpmzYg59g0',
  secondaryFilms: ['6qBQmVbrGW8', 'V5Gm-LI3OAE', 'llQMhMIu8qg', 'FQlNyGNGfpw'],
};
