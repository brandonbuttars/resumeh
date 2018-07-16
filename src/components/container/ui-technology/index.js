import riot from 'riot';

const html = `
  <h2>Technology</h2>
  <technology-block tid="{{opts.tid}}" technology="{{opts.technology}}"></technology-block>
`;

riot.tag('ui-technology', html, function (opts) {});
