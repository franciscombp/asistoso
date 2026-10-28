/* =====================================================================
   Clima de Uku
   Según dónde estés y el clima de hoy, Uku se viste distinto:
   - Costa / Oriente (menos de 1.000 m): palmeras en vez de pinos y, si
     hace calor, guayabera en vez del suéter.
   - Lluvia: paraguas. Frío: gorro de lana. Sol y calor: sombrero de paja
     toquilla y gafas de sol.
   Datos: Open-Meteo (gratis, sin API key; trae la altura del lugar) y el
   nombre de la ciudad con BigDataCloud (también sin key). Sin permiso o
   sin red: Quito. Para probar: ?clima=gye|uio-rain|uio-cold|cuenca|tena.
   ===================================================================== */
(function () {
  'use strict';

  var CACHE = 'uku_clima_v1', DEMO = 'uku_clima_demo', TTL = 30 * 60 * 1000;
  var QUITO = { lat: -0.1807, lon: -78.4678, city: 'Quito' };
  // Escenarios de demo (sin pedir ubicación ni red)
  var PRESETS = {
    gye: { city: 'Guayaquil', temp: 31, code: 1, isDay: 1, elev: 4, lat: -2.19, lon: -79.89 },
    'uio-rain': { city: 'Quito', temp: 13, code: 63, isDay: 1, elev: 2850, lat: -0.18, lon: -78.47 },
    'uio-cold': { city: 'Quito', temp: 8, code: 3, isDay: 1, elev: 2850, lat: -0.18, lon: -78.47 },
    cuenca: { city: 'Cuenca', temp: 22, code: 0, isDay: 1, elev: 2560, lat: -2.9, lon: -79.0 },
    tena: { city: 'Tena', temp: 27, code: 81, isDay: 1, elev: 510, lat: -0.99, lon: -77.81 }
  };
  var LABELS = { auto: 'Según mi ubicación', gye: 'Guayaquil · sol y calor', 'uio-rain': 'Quito · lluvia', 'uio-cold': 'Quito · frío', cuenca: 'Cuenca · soleado', tena: 'Tena · lluvia en la selva' };

  function demo() { try { return localStorage.getItem(DEMO) || 'auto'; } catch (e) { return 'auto'; } }
  function rainy(code) { return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95; }

  /* Qué se pone Uku */
  function dress(w) {
    var low = w.elev < 1000, rain = rainy(w.code), sunny = w.code <= 1 && w.isDay;
    var look = {
      region: low ? 'costa' : 'sierra',
      shirt: low && w.temp >= 22 ? 'guayabera' : 'sueter',
      hat: rain ? 'paraguas' : w.temp < 13 || (w.code >= 71 && w.code <= 86) ? 'lana' : (sunny && w.temp >= 20) || w.temp >= 26 ? 'paja' : null,
      shades: !rain && sunny && w.temp >= 18,
      rain: rain
    };
    var where = w.city ? 'en ' + w.city + ' ' : '';
    var snow = (w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86;
    var sky = rain ? 'está lloviendo' : snow ? 'está nevando' : sunny ? 'hay sol' : w.code === 2 ? 'está parcialmente nublado' : w.code === 3 ? 'está nublado' : w.code === 45 || w.code === 48 ? 'hay neblina' : 'el cielo está tranquilo';
    var wear = [];
    if (look.shirt === 'guayabera') wear.push('la guayabera');
    if (look.hat === 'paja') wear.push('mi sombrero de paja toquilla');
    if (look.hat === 'lana') wear.push('el gorro de lana');
    if (look.hat === 'paraguas') wear.push('el paraguas');
    if (look.shades) wear.push('las gafas de sol');
    var list = wear.length > 1 ? wear.slice(0, -1).join(', ') + ' y ' + wear[wear.length - 1] : wear[0];
    var text = 'Hoy ' + where + 'hace ' + Math.round(w.temp) + '° y ' + sky + (list ? ', así que me puse ' + list + '.' : '. Con mi suéter de siempre estoy perfecto.');
    if (low && !w.coast_said) text += look.region === 'costa' && w.lon > -78.3 ? ' Aquí en la selva hay palmeras.' : ' Y aquí hay palmeras en vez de pinos.';
    // Icono del cielo (Material Symbols): solo se muestra como detalle de fondo
    var icon = rain ? 'rainy' : snow ? 'ac_unit' : sunny ? 'wb_sunny' : w.code === 2 ? 'partly_cloudy_day' : w.code === 3 ? 'cloud' : (w.code === 45 || w.code === 48) ? 'foggy' : w.code >= 95 ? 'thunderstorm' : 'wb_cloudy';
    return { look: look, text: text, temp: Math.round(w.temp), city: w.city, rain: rain, icon: icon };
  }

  function getPos() {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        function () { res(null); }, { timeout: 8000, maximumAge: 30 * 60 * 1000 });
    });
  }
  function fetchJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function weather(pos) {
    return fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + pos.lat + '&longitude=' + pos.lon +
      '&current=temperature_2m,weather_code,is_day&timezone=auto').then(function (j) {
      return { temp: j.current.temperature_2m, code: j.current.weather_code, isDay: j.current.is_day, elev: j.elevation, lat: pos.lat, lon: pos.lon };
    });
  }
  function city(pos) {
    if (pos.city) return Promise.resolve(pos.city);
    return fetchJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + pos.lat + '&longitude=' + pos.lon + '&localityLanguage=es')
      .then(function (j) { return j.city || j.locality || ''; }).catch(function () { return ''; });
  }

  var pending = null, current = null, subs = [];
  function emit() { subs.forEach(function (f) { try { f(current); } catch (e) {} }); }
  function get() {
    var d = demo();
    if (current && current.mode === d) return Promise.resolve(current);
    if (d !== 'auto' && PRESETS[d]) { current = dress(PRESETS[d]); current.mode = d; return Promise.resolve(current); }
    try { var c = JSON.parse(sessionStorage.getItem(CACHE)); if (c && Date.now() - c.at < TTL) { current = dress(c.w); current.mode = 'auto'; return Promise.resolve(current); } } catch (e) {}
    if (pending) return pending;
    pending = getPos().then(function (pos) {
      pos = pos || QUITO;
      return Promise.all([weather(pos), city(pos)]).then(function (r) {
        var w = r[0]; w.city = r[1] || (pos === QUITO ? 'Quito' : '');
        try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), w: w })); } catch (e) {}
        return w;
      });
    }).then(function (w) { current = dress(w); current.mode = 'auto'; return current; })
      .catch(function () { current = null; return null; }) // sin red: Uku se queda como siempre
      .then(function (c) { pending = null; return c; });
    return pending;
  }
  function set(k) {
    try { localStorage.setItem(DEMO, k); } catch (e) {}
    current = null;
    return get().then(function (c) { emit(); return c; });
  }

  window.Clima = {
    get: get, set: set, mode: demo, labels: LABELS,
    last: function () { return current; },
    onChange: function (f) { subs.push(f); }
  };
})();
