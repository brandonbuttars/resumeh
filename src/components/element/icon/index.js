import riot from 'riot';

const html = `
  <i class="material-icons" circle="{{opts.circle === ''}}">{{opts.is}}</i>
`;

riot.tag('icon', html, function (opts) {});
