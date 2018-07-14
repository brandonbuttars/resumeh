import app from '../../../../config/app';
import riot from 'riot';

const html = `
  <h2>Technology</h2>
  <grid compact if="{{opts.technology}}">
    <span each="{{tech in opts.technology}}" level="{{tech.level}}">
      <a active="{{opts.tid === tech.name}}" href="#/technology/{{tech.name}}">{{tech.name}}</a>
    </span>
  </grid>
  <div if="{{opts.tid}}">
    <h3>{{opts.tid}}</h2>
    <span each="{{tech in opts.technology}}" level="{{tech.level}}">
      <a active="{{opts.tid === tech.name}}" href="#/technology/{{tech.name}}">{{tech.name}}</a>
    </span>
  </div>
`;

riot.tag('ui-technology', html, function (opts) {
  document.title = app.title.technology;
});
