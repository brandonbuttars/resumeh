import riot from 'riot';

const html = `
  <h2>Experience</h2>
  <experience-block experience="{{opts.experience}}"></education-block>
`;

riot.tag('ui-experience', html, function (opts) {});
