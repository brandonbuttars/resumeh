import riot from 'riot';

const html = `
  <div>
    <div class="ripple">
      <div></div>
      <div></div>
    </div>
  </div>
`;

riot.tag('ui-throbber', html, function (opts) {});
