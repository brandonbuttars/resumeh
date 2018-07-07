const AJAX = {
  get: (url, id = 'AJAX') => {
    if (!window.resumeh) { window.resumeh = {}; }
    // Fire loading event
    fetch(url).then(response => {
      return response.json();
    }).then(data => {
      window.resumeh[id] = data;
      // Fire loaded event
    }).catch(error => {
      console.error('MODULES:FETCH:ERROR:', error);
      // Fire loaded event
    });
  }
};

export default AJAX;
