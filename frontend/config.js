// '/' : l'appli parle à /api/... sur le même site, et Netlify relaie vers le serveur Render (voir _redirects).
// Pour parler directement au serveur, remplace par 'https://weddingbody.onrender.com'.
window.APP_CONFIG = {
  API_URL: '/',
};
