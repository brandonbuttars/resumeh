import app from '../../../../config/app';
import md5 from 'md5';
import riot from 'riot';

const __ = {
  fetch: (tag, key) => {
    fetch(app.api[key]).then(res => res.json()).then(res => {
      tag[key] = res;
      tag.completed++;
      if (key === 'profile') {
        const ghash = md5(res.email.toLowerCase().trim()),
              gravatar = `![${tag[key].first_name} ${tag[key].last_name}](https://www.gravatar.com/avatar/${ghash}?s=400)`;
        tag[key].summary = gravatar + tag[key].summary;
      }
      if (tag.completed > 4) {
        tag.loaded = true;
        setTimeout(() => {
          tag.update();
        }, 2500);
      } else {
        tag.update();
      }
    });
  },
  section: () => {
    const hash = location.hash.split('/')[1];
    return hash !== '' && hash !== undefined ? hash : 'profile';
  },
  id: () => {
    const id = location.hash.split('/')[2];
    return id !== '' && id !== undefined ? decodeURI(id) : false;
  }
};

const html = `
  <ui-menu section="{{section}}"></ui-menu>
  <div content hidden="{{!loaded}}" section="{{section}}">
    <logo></logo>
    <h1 if="{{profile}}">{{profile.first_name}}<strong>{{profile.last_name}}</strong></h1>
    <div contact>
      <div email>{{profile.email}}</div>
      <div phone>{{profile.phone}}</div>
    </div>
    <ui-profile gravatar="{{gravatar}}" profile="{{profile}}" if="{{loaded && section === 'profile'}}"></ui-profile>
    <ui-experience experience="{{experience}}" if="{{loaded && section === 'experience'}}"></ui-experience>
    <ui-technology tid="{{id}}" technology="{{technology}}" if="{{loaded && section === 'technology'}}"></ui-technology>
    <ui-education education="{{education}}" if="{{loaded && section === 'education'}}"></ui-education>
    <ui-portfolio portfolio="{{portfolio}}" if="{{loaded && section === 'portfolio'}}"></ui-education>
  </div>
  <ui-throbber hidden="{{loaded}}"></ui-throbber>
`;

riot.tag('ui-app', html, function (opts) {
  document.title = app.title.root;
  const tag = this,
        root = tag.root;

  tag.completed = 0;
  tag.loaded = false;
  tag.profile = false;
  tag.education = false;
  tag.experience = false;
  tag.technology = false;
  tag.portfolio = false;
  tag.section = __.section() || 'profile';
  tag.id = __.id();

  tag.on('mount', () => {
    const endpoints = ['profile', 'education', 'experience', 'technology', 'portfolio'],
          content = root.querySelector('[content]');

    endpoints.forEach(ep => {
      __.fetch(tag, ep);
    });

    content.addEventListener('click', () => {
      if (document.body.hasAttribute('open')) {
        PubSub.fire('menu:close');
      }
    });

    window.addEventListener('hashchange', () => {
      content.scrollTop = 0;
    });
  });

  window.addEventListener('hashchange', () => {
    tag.section = __.section();
    tag.id = __.id();
    tag.update();
    PubSub.fire('menu:close');
  });
});
