import app from '../../../../config/app';
import riot from 'riot';

const __ = {
  getTech: (tid, techs) => {
    if (!!tid) {
      return techs.find((tech) => tech.link === tid ? tech : false);
    }
  }
};

const html = `
  <p>Click on a technology to get a blurb about my experience and opinion on the technology.</p>
  <grid compact if="{{opts.technology}}">
    <span each="{{tech in opts.technology}}" level="{{tech.level}}">
      <a active="{{opts.tid === tech.link}}" href="#/technology/{{tech.link}}">{{tech.name}}</a>
    </span>
  </grid>
  <div if="{{opts.tid}}">
    <h3 if="{{tech_name}}">{{tech_name}}</h2>
    <markdown if="{{tech_body}}" code="{{tech_body}}"></markdown>
  </div>
`;

riot.tag('technology-block', html, function (opts) {
  document.title = app.title.technology;

  const tag = this;

  tag.toSlug = (str) => str.toLowerCase().replace(' ', '-');
  tag.tech_name = false;
  tag.tech_body = false;

  function updateContent() {
    const content = __.getTech(opts.tid, opts.technology);
    tag.update({ tech_name: false, tech_body: false }); // Reset so DOM clears out old content
    tag.update({ tech_name: content.name, tech_body: content.body });
  }

  tag.on('mount', () => {
    if (!!opts.tid) { updateContent() }
  });

  window.addEventListener('hashchange', () => { updateContent() });
});
