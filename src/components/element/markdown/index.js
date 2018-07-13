import riot from 'riot';
import md from 'snarkdown';

const html = `
  <div></div>
`;

riot.tag('markdown', html, function (opts) {
  const tag = this,
        root = tag.root;
  
  tag.on('mount', () => {
    root.querySelector('div').innerHTML = md(opts.code).replace(/\n/g, '<br/>');
  });
});
