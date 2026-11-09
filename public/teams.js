// Team colors: [jersey color, trim color, city, name]
window.TEAMS = {
  ANA: ['#CF4520', '#111111', 'Anaheim', 'Ducks'],
  BOS: ['#111111', '#FFB81C', 'Boston', 'Bruins'],
  BUF: ['#003087', '#FFB81C', 'Buffalo', 'Sabres'],
  CGY: ['#C8102E', '#F1BE48', 'Calgary', 'Flames'],
  CAR: ['#CE1126', '#111111', 'Carolina', 'Hurricanes'],
  CHI: ['#CF0A2C', '#111111', 'Chicago', 'Blackhawks'],
  COL: ['#6F263D', '#236192', 'Colorado', 'Avalanche'],
  CBJ: ['#002654', '#CE1126', 'Columbus', 'Blue Jackets'],
  DAL: ['#006847', '#8F8F8C', 'Dallas', 'Stars'],
  DET: ['#CE1126', '#FFFFFF', 'Detroit', 'Red Wings'],
  EDM: ['#041E42', '#FF4C00', 'Edmonton', 'Oilers'],
  FLA: ['#C8102E', '#041E42', 'Florida', 'Panthers'],
  LAK: ['#111111', '#A2AAAD', 'Los Angeles', 'Kings'],
  MIN: ['#154734', '#EAAA00', 'Minnesota', 'Wild'],
  MTL: ['#AF1E2D', '#192168', 'Montréal', 'Canadiens'],
  NSH: ['#FFB81C', '#041E42', 'Nashville', 'Predators'],
  NJD: ['#CE1126', '#111111', 'New Jersey', 'Devils'],
  NYI: ['#00539B', '#F47D30', 'New York', 'Islanders'],
  NYR: ['#0038A8', '#CE1126', 'New York', 'Rangers'],
  OTT: ['#C52032', '#C2912C', 'Ottawa', 'Senators'],
  PHI: ['#F74902', '#111111', 'Philadelphia', 'Flyers'],
  PIT: ['#111111', '#FCB514', 'Pittsburgh', 'Penguins'],
  SJS: ['#006D75', '#EA7200', 'San Jose', 'Sharks'],
  SEA: ['#001628', '#99D9D9', 'Seattle', 'Kraken'],
  STL: ['#002F87', '#FCB514', 'St. Louis', 'Blues'],
  TBL: ['#002868', '#FFFFFF', 'Tampa Bay', 'Lightning'],
  TOR: ['#00205B', '#FFFFFF', 'Toronto', 'Maple Leafs'],
  UTA: ['#111111', '#6CACE4', 'Utah', 'Mammoth'],
  VAN: ['#00205B', '#00843D', 'Vancouver', 'Canucks'],
  VGK: ['#B4975A', '#333F42', 'Vegas', 'Golden Knights'],
  WSH: ['#041E42', '#C8102E', 'Washington', 'Capitals'],
  WPG: ['#041E42', '#AC162C', 'Winnipeg', 'Jets']
};
window.teamInfo = function (t) {
  const d = window.TEAMS[t.abbr];
  return {
    abbr: t.abbr,
    color: d ? d[0] : '#3A4654',
    trim: d ? d[1] : '#C9D2DA',
    city: t.place || (d ? d[2] : ''),
    name: d ? d[3] : t.name,
    score: t.score
  };
};
// Readable text on a jersey color
window.inkOn = function (hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#111111' : '#FFFFFF';
};
