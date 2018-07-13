import riot from 'riot';

const html = `
  <grid compact each="{{ed in opts.education}}">
    <div size="12" mobile="3" desktop="2">
      <h5>{{ed.start}} - {{ed.end}}</h5>
    </div>
    <div size="12" mobile="9" desktop="10">
      <h4>{{ed.institution}}</h4>
      <h6>{{ed.emphasis}}</h6>
    </div>
  </grid>
`;

riot.tag('education-block', html, function (opts) {});
