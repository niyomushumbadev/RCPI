export type Language = 'rw' | 'en' | 'fr';

export const translations: Record<Language, {
  welcome: string;
  dashboardSubtitle: string;
  reportProblem: string;
  totalReports: string;
  awaitingReview: string;
  underReview: string;
  inProgress: string;
  resolved: string;
  rejected: string;
  recentReports: string;
  viewAll: string;
  communityMap: string;
  communityInsights: string;
}> = {
  rw: {
    welcome: 'Murakaza neza',
    dashboardSubtitle: 'Rapora ibibazo byimibereho ande ufashe iterambere ry’umuryango wawe.',
    reportProblem: 'Rapora ikibazo',
    totalReports: 'Ibibazo byose',
    awaitingReview: 'Bitegereje isuzuma',
    underReview: 'Birimo gusuzumwa',
    inProgress: 'Birimo gukorwa',
    resolved: 'Byakemuwe',
    rejected: 'Byanze',
    recentReports: 'Ibibazo bya vuba',
    viewAll: 'Reba byose',
    communityMap: 'Ikarita y’umuryango',
    communityInsights: 'Ibyangombwa by’umuryango',
  },
  en: {
    welcome: 'Welcome',
    dashboardSubtitle: 'Report community problems and help improve your neighbourhood.',
    reportProblem: 'Report a problem',
    totalReports: 'Total reports',
    awaitingReview: 'Awaiting review',
    underReview: 'Under review',
    inProgress: 'In progress',
    resolved: 'Resolved',
    rejected: 'Rejected',
    recentReports: 'Recent reports',
    viewAll: 'View all',
    communityMap: 'Community map',
    communityInsights: 'Community insights',
  },
  fr: {
    welcome: 'Bienvenue',
    dashboardSubtitle: 'Signalez les problèmes de la communauté et contribuez à améliorer votre quartier.',
    reportProblem: 'Signaler un problème',
    totalReports: 'Total des signalements',
    awaitingReview: 'En attente',
    underReview: 'En cours d’examen',
    inProgress: 'En cours',
    resolved: 'Résolu',
    rejected: 'Rejeté',
    recentReports: 'Signalements récents',
    viewAll: 'Voir tout',
    communityMap: 'Carte communautaire',
    communityInsights: 'Statistiques de la communauté',
  },
};

export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'rw';
  const saved = window.localStorage.getItem('rcpi-language');
  if (saved === 'rw' || saved === 'en' || saved === 'fr') return saved;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('en')) return 'en';
  return 'rw';
}

export function setLanguage(language: Language) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('rcpi-language', language);
  document.documentElement.lang = language;
  window.dispatchEvent(new CustomEvent('rcpi-language-change', { detail: language }));
}
