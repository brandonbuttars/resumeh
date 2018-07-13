import app from '../../../../config/app';
import riot from 'riot';

const html = `
  <grid compact each="{{exp in opts.experience}}">
    <div size="12" mobile="3" desktop="2">
      <h5>{{exp.start}}{{ exp.start !== exp.end ? ' - ' : '' }}{{exp.current ? 'Current' : exp.start !== exp.end ? exp.end : ''}}</h5>
      <img if="{{exp.logo}}" src="${app.api.root}{{exp.logo.url}}"/>
    </div>
    <div size="12" mobile="9" desktop="10">
      <h4>{{exp.company}}</h4>
      <h6>{{exp.position}}</h6>
      <markdown code="{{exp.description}}"></markdown>
    </div>
  </grid>
`;

riot.tag('experience-block', html, function (opts) {});
