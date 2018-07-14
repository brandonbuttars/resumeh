const navigator = window.navigator;

class DeviceClass {
  constructor(alias = 'DeviceInfo') {
    if (!window[alias]) {
      const info = this.identify();
      window[alias] = info;
    }
  }

  os() {
    const opts = {
      ios: { match: 'iphone|ipod|ipad' },
      android: { match: 'android' },
      mac: { match: 'mac' },
      windows: { match: 'win' },
      linux: { match: 'linux' }
    };

    for (let key in opts) {
      if (navigator.userAgent.toLowerCase().match(opts[key]['match'])) {
        return key;
      }
    }
  }

  touch() {
    return ('ontouchstart' in window) ? 'touch' : 'no-touch';
  }

  mouse() {
    if (this.os() === 'ios' || this.os() === 'android') {
      return 'no-mouse';
    } else {
      return ('onmousemove' in window) ? 'mouse' : 'no-mouse';
    }
  }

  platform() {
    return this.os() === 'ios' || this.os() === 'android' ? 'mobile' : 'desktop';
  }

  browser() {
    const ua = navigator.userAgent.toLowerCase(),
      browsers = {
        firefox: ['firefox'],
        safari: ['safari'],
        chrome: ['chrome'],
        opera: ['opr', 'opera'],
        ie: ['trident', 'ie'],
        edge: ['edge']
      };

    let browser = 'unknown';

    function _browser_check(arr, name) {
      if (ua.indexOf(arr[0]) > -1 || ua.indexOf(arr[1]) > -1) {
        browser = name;
      }
    }

    for (let key in browsers) {
      _browser_check(browsers[key], key);
    }

    return browser;
  }

  identify() {
    const htmlElement = document.body.parentNode;

    htmlElement.setAttribute('os', this.os());
    htmlElement.setAttribute('browser', this.browser());
    htmlElement.setAttribute('platform', this.platform());
    htmlElement.setAttribute(this.touch(), '');
    htmlElement.setAttribute(this.mouse(), '');

    let obj = {
      os: this.os(),
      browser: this.browser(),
      platform: this.platform(),
      touch: this.touch() === 'touch' ? true : false,
      mouse: this.mouse() === 'mouse' ? true : false
    }

    return obj;
  }
}

export default DeviceClass;
