// Client architectural films (YouTube). Titles are the studio's own published video titles.
// Note: TDcKozRHlKs from the supplied list is a third-party beach livestream, so it is excluded.
export const FILMS = [
  { id: '4MpmzYg59g0', project: 'Shubh Kamna Heights', location: 'Pt. Deen Dayal Upadhyaya Nagar, U.P.', type: '3D Walkthrough' },
  { id: '6qBQmVbrGW8', project: 'Arham Residential Building', location: 'Mumbai', type: '3D Walkthrough' },
  { id: 'V5Gm-LI3OAE', project: 'White House', location: 'Subhash Nagar, Chembur, Mumbai', type: '3D Walkthrough' },
  { id: 'llQMhMIu8qg', project: 'Azim Park', location: 'Navi Mumbai', type: '3D Walkthrough' },
  { id: 'FQlNyGNGfpw', project: 'Balaji Estate Phase 2', location: 'Dombivali East', type: '3D Walkthrough' },
];

export const thumb = (id, quality = 'maxresdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
