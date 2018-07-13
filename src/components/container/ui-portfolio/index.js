import riot from 'riot';

const html = `
  <h2>Portfolio</h2>
  <portfolio-block portfolio="{{opts.portfolio}}"></portfolio-block>
`;

riot.tag('ui-portfolio', html, function (opts) {});
