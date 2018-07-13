import riot from 'riot';

const html = `
  <h2>Education</h2>
  <education-block education="{{opts.education}}"></education-block>
`;

riot.tag('ui-education', html, function (opts) {});
